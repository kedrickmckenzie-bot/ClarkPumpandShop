const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array) {
  let value = "";
  bytes.forEach((byte) => { value += String.fromCharCode(byte); });
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const decoded = atob(normalized);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signOpaqueToken(opaqueValue: string, purpose: string, secret: string) {
  const versioned = `v1.${purpose}.${opaqueValue}`;
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(versioned)));
  return `${opaqueValue}.${toBase64Url(signature)}`;
}

export async function verifyOpaqueToken(token: string, purpose: string, secret: string) {
  const separator = token.lastIndexOf(".");
  if (separator < 1) return null;
  const opaqueValue = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const valid = await crypto.subtle.verify("HMAC", await hmacKey(secret), fromBase64Url(signature), encoder.encode(`v1.${purpose}.${opaqueValue}`));
  return valid ? opaqueValue : null;
}

export async function hashOpaqueToken(token: string) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(token)));
  return toBase64Url(digest);
}
