import type { PublicUpload } from "./contracts";

export interface StoredPublicUpload {
  key: string;
  originalName: string;
  mediaType: string;
  size: number;
  sha256: string;
  stored: boolean;
}

export interface PublicUploadStore {
  store(input: {
    organizationId: string;
    subjectType: "request" | "visit" | "invoice";
    subjectId: string;
    uploads: PublicUpload[];
    idempotencyKey?: string;
  }): Promise<StoredPublicUpload[]>;
}

type RuntimeEnvironment = Record<string, string | undefined>;
type StorageProvider = "r2" | "s3";

interface R2BucketLike {
  put(
    key: string,
    value: ArrayBuffer,
    options: {
      httpMetadata: { contentType: string; cacheControl: string };
      customMetadata: Record<string, string>;
    },
  ): Promise<unknown>;
}

interface S3Configuration {
  endpoint: URL;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  forcePathStyle: boolean;
  serverSideEncryption?: string;
}

interface PublicUploadStoreDependencies {
  environment?: RuntimeEnvironment;
  fetch?: typeof fetch;
  now?: () => Date;
  randomUUID?: () => string;
  r2Bucket?: R2BucketLike | null;
}

const PRIVATE_OBJECT_PREFIX = "ops-private/v1";
const PRIVATE_CACHE_CONTROL = "private, no-store";

function currentEnvironment(): RuntimeEnvironment {
  return typeof process === "undefined" ? {} : process.env;
}

function configuredProvider(environment: RuntimeEnvironment): StorageProvider {
  const explicit = (
    environment.OPS_OBJECT_STORAGE_PROVIDER?.trim()
    || environment.TRACEOPS_OBJECT_STORAGE_PROVIDER?.trim()
    || ""
  ).toLowerCase();
  if (explicit && explicit !== "r2" && explicit !== "s3") {
    throw new Error("OPS_OBJECT_STORAGE_PROVIDER must be either `r2` or `s3`.");
  }
  if (explicit) return explicit as StorageProvider;

  const hasS3Configuration = [
    environment.S3_ENDPOINT,
    environment.S3_BUCKET,
    environment.S3_ACCESS_KEY_ID,
    environment.AWS_ACCESS_KEY_ID,
  ].some((value) => Boolean(value?.trim()));
  if (hasS3Configuration || environment.RENDER === "true" || environment.RENDER_SERVICE_ID) return "s3";
  return "r2";
}

function requiredEnvironmentValue(environment: RuntimeEnvironment, name: string, fallbackName?: string): string {
  const value = environment[name]?.trim() || (fallbackName ? environment[fallbackName]?.trim() : undefined);
  if (!value) {
    throw new Error(
      `S3-compatible file storage is selected, but ${name}${fallbackName ? ` (or ${fallbackName})` : ""} is not configured.`,
    );
  }
  return value;
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value?.trim()) return defaultValue;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error("S3_FORCE_PATH_STYLE must be `true` or `false` when configured.");
}

function readS3Configuration(environment: RuntimeEnvironment): S3Configuration {
  const endpointValue = requiredEnvironmentValue(environment, "S3_ENDPOINT");
  let endpoint: URL;
  try {
    endpoint = new URL(endpointValue);
  } catch {
    throw new Error("S3_ENDPOINT must be a valid HTTPS URL.");
  }
  if (endpoint.protocol !== "https:") throw new Error("S3_ENDPOINT must use HTTPS.");
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error("S3_ENDPOINT must not contain credentials, a query string, or a fragment.");
  }
  endpoint.pathname = endpoint.pathname.replace(/\/+$/, "");

  const serverSideEncryption = environment.S3_SERVER_SIDE_ENCRYPTION?.trim();
  if (serverSideEncryption && !/^[A-Za-z0-9:_./-]{1,80}$/.test(serverSideEncryption)) {
    throw new Error("S3_SERVER_SIDE_ENCRYPTION contains unsupported characters.");
  }

  return {
    endpoint,
    region: requiredEnvironmentValue(environment, "S3_REGION"),
    bucket: requiredEnvironmentValue(environment, "S3_BUCKET"),
    accessKeyId: requiredEnvironmentValue(environment, "S3_ACCESS_KEY_ID", "AWS_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnvironmentValue(environment, "S3_SECRET_ACCESS_KEY", "AWS_SECRET_ACCESS_KEY"),
    sessionToken: environment.S3_SESSION_TOKEN?.trim() || environment.AWS_SESSION_TOKEN?.trim() || undefined,
    forcePathStyle: parseBoolean(environment.S3_FORCE_PATH_STYLE, true),
    serverSideEncryption,
  };
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: ArrayBuffer | Uint8Array | string): Promise<Uint8Array> {
  const bytes = typeof value === "string"
    ? new TextEncoder().encode(value)
    : value instanceof Uint8Array
      ? value
      : new Uint8Array(value);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes).buffer));
}

async function sha256Hex(value: ArrayBuffer | Uint8Array | string): Promise<string> {
  return bytesToHex(await sha256(value));
}

async function hmacSha256(key: Uint8Array, value: string): Promise<Uint8Array> {
  const importedKey = await crypto.subtle.importKey(
    "raw",
    Uint8Array.from(key).buffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", importedKey, Uint8Array.from(new TextEncoder().encode(value)).buffer));
}

function base64UrlUtf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function encodePath(value: string): string {
  return value.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

async function privateObjectKey(input: {
  organizationId: string;
  subjectType: "request" | "visit" | "invoice";
  subjectId: string;
  randomUUID: () => string;
  stableSuffix?: string;
}): Promise<string> {
  const [organizationHash, subjectHash] = await Promise.all([
    sha256Hex(input.organizationId),
    sha256Hex(input.subjectId),
  ]);
  return [
    PRIVATE_OBJECT_PREFIX,
    organizationHash.slice(0, 32),
    input.subjectType,
    subjectHash.slice(0, 32),
    input.stableSuffix ?? input.randomUUID(),
  ].join("/");
}

async function stableUploadSuffix(idempotencyKey: string | undefined, index: number, payloadHash: string): Promise<string | undefined> {
  if (!idempotencyKey) return undefined;
  return `retry-${(await sha256Hex(`${idempotencyKey}:${index}:${payloadHash}`)).slice(0, 48)}`;
}

function safeMediaType(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/.test(normalized)) {
    throw new Error("Upload media type is invalid.");
  }
  return normalized;
}

async function defaultR2BindingLoader(): Promise<R2BucketLike | undefined> {
  const { env } = await import("cloudflare:workers");
  return (env as unknown as { FILES?: R2BucketLike }).FILES;
}

class SitesR2PublicUploadStore implements PublicUploadStore {
  constructor(private readonly dependencies: PublicUploadStoreDependencies) {}

  async store(input: {
    organizationId: string;
    subjectType: "request" | "visit" | "invoice";
    subjectId: string;
    uploads: PublicUpload[];
    idempotencyKey?: string;
  }): Promise<StoredPublicUpload[]> {
    const binding = this.dependencies.r2Bucket === undefined
      ? await defaultR2BindingLoader()
      : this.dependencies.r2Bucket ?? undefined;
    const randomUUID = this.dependencies.randomUUID ?? (() => crypto.randomUUID());
    const stored: StoredPublicUpload[] = [];
    for (const [index, upload] of input.uploads.entries()) {
      const digest = await sha256Hex(upload.bytes);
      const key = await privateObjectKey({
        ...input,
        randomUUID,
        stableSuffix: await stableUploadSuffix(input.idempotencyKey, index, digest),
      });
      const mediaType = safeMediaType(upload.mediaType);
      if (binding) {
        await binding.put(key, upload.bytes, {
          httpMetadata: { contentType: mediaType, cacheControl: PRIVATE_CACHE_CONTROL },
          customMetadata: {
            organizationId: input.organizationId,
            subjectType: input.subjectType,
            subjectId: input.subjectId,
            originalName: upload.name,
            sha256: digest,
          },
        });
      }
      stored.push({
        key,
        originalName: upload.name,
        mediaType,
        size: upload.size,
        sha256: digest,
        stored: Boolean(binding),
      });
    }
    return stored;
  }
}

function amzDate(date: Date): { timestamp: string; dateStamp: string } {
  const timestamp = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { timestamp, dateStamp: timestamp.slice(0, 8) };
}

function canonicalHeaderValue(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

async function authorizationHeader(input: {
  configuration: S3Configuration;
  method: "PUT";
  canonicalUri: string;
  headers: Record<string, string>;
  payloadHash: string;
  timestamp: string;
  dateStamp: string;
}): Promise<string> {
  const sortedHeaders = Object.entries(input.headers)
    .map(([name, value]) => [name.toLowerCase(), canonicalHeaderValue(value)] as const)
    .sort(([left], [right]) => left.localeCompare(right));
  const canonicalHeaders = `${sortedHeaders.map(([name, value]) => `${name}:${value}`).join("\n")}\n`;
  const signedHeaders = sortedHeaders.map(([name]) => name).join(";");
  const canonicalRequest = [
    input.method,
    input.canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    input.payloadHash,
  ].join("\n");
  const credentialScope = `${input.dateStamp}/${input.configuration.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    input.timestamp,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");
  const dateKey = await hmacSha256(new TextEncoder().encode(`AWS4${input.configuration.secretAccessKey}`), input.dateStamp);
  const regionKey = await hmacSha256(dateKey, input.configuration.region);
  const serviceKey = await hmacSha256(regionKey, "s3");
  const signingKey = await hmacSha256(serviceKey, "aws4_request");
  const signature = bytesToHex(await hmacSha256(signingKey, stringToSign));
  return `AWS4-HMAC-SHA256 Credential=${input.configuration.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

function s3ObjectLocation(configuration: S3Configuration, key: string): { url: URL; canonicalUri: string } {
  const encodedKey = encodePath(key);
  const url = new URL(configuration.endpoint.toString());
  const endpointPath = url.pathname.replace(/\/$/, "");
  if (configuration.forcePathStyle) {
    url.pathname = `${endpointPath}/${encodeURIComponent(configuration.bucket)}/${encodedKey}`;
  } else {
    url.hostname = `${configuration.bucket}.${url.hostname}`;
    url.pathname = `${endpointPath}/${encodedKey}`;
  }
  return { url, canonicalUri: url.pathname };
}

class S3PublicUploadStore implements PublicUploadStore {
  private readonly configuration: S3Configuration;

  constructor(private readonly dependencies: PublicUploadStoreDependencies) {
    this.configuration = readS3Configuration(dependencies.environment ?? currentEnvironment());
  }

  async store(input: {
    organizationId: string;
    subjectType: "request" | "visit" | "invoice";
    subjectId: string;
    uploads: PublicUpload[];
    idempotencyKey?: string;
  }): Promise<StoredPublicUpload[]> {
    const fetchRequest = this.dependencies.fetch ?? fetch;
    const currentDate = this.dependencies.now ?? (() => new Date());
    const randomUUID = this.dependencies.randomUUID ?? (() => crypto.randomUUID());
    const stored: StoredPublicUpload[] = [];

    for (const [index, upload] of input.uploads.entries()) {
      const payloadHash = await sha256Hex(upload.bytes);
      const key = await privateObjectKey({
        ...input,
        randomUUID,
        stableSuffix: await stableUploadSuffix(input.idempotencyKey, index, payloadHash),
      });
      const mediaType = safeMediaType(upload.mediaType);
      const { url, canonicalUri } = s3ObjectLocation(this.configuration, key);
      const { timestamp, dateStamp } = amzDate(currentDate());
      const headers: Record<string, string> = {
        "cache-control": PRIVATE_CACHE_CONTROL,
        "content-type": mediaType,
        host: url.host,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": timestamp,
        "x-amz-meta-organization-id-b64": base64UrlUtf8(input.organizationId),
        "x-amz-meta-original-name-b64": base64UrlUtf8(upload.name),
        "x-amz-meta-subject-id-b64": base64UrlUtf8(input.subjectId),
        "x-amz-meta-subject-type": input.subjectType,
        "x-amz-meta-upload-sha256": payloadHash,
      };
      if (this.configuration.sessionToken) headers["x-amz-security-token"] = this.configuration.sessionToken;
      if (this.configuration.serverSideEncryption) {
        headers["x-amz-server-side-encryption"] = this.configuration.serverSideEncryption;
      }
      headers.authorization = await authorizationHeader({
        configuration: this.configuration,
        method: "PUT",
        canonicalUri,
        headers,
        payloadHash,
        timestamp,
        dateStamp,
      });

      const response = await fetchRequest(url, {
        method: "PUT",
        headers,
        body: upload.bytes,
        redirect: "error",
      });
      if (!response.ok) {
        const requestId = response.headers.get("x-amz-request-id") ?? response.headers.get("x-request-id");
        throw new Error(`Private object upload failed with status ${response.status}${requestId ? ` (request ${requestId})` : ""}.`);
      }
      stored.push({
        key,
        originalName: upload.name,
        mediaType,
        size: upload.size,
        sha256: payloadHash,
        stored: true,
      });
    }
    return stored;
  }
}

export function createPublicUploadStore(dependencies: PublicUploadStoreDependencies = {}): PublicUploadStore {
  const environment = dependencies.environment ?? currentEnvironment();
  return configuredProvider(environment) === "s3"
    ? new S3PublicUploadStore({ ...dependencies, environment })
    : new SitesR2PublicUploadStore({ ...dependencies, environment });
}

export function getPublicUploadStore(): PublicUploadStore {
  return createPublicUploadStore();
}
