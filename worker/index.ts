/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { createOpsD1Repository } from "../lib/ops/d1-repository";
import { runOutboxDeliveryCycle } from "../lib/ops/outbox-delivery";
import { createNotificationEmailTransport, emailRuntimeFromEnvironment } from "../lib/ops/email-delivery";
import { runPmRecurrenceCycle, runSlaEscalationCycle } from "../lib/ops/job-workers";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  EMAIL_PROVIDER?: string;
  EMAIL_API_KEY?: string;
  EMAIL_FROM?: string;
  EMAIL_REPLY_TO?: string;
  NEXT_PUBLIC_SITE_URL?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },

  // Platform job cycles: transactional-outbox delivery, then SLA escalation.
  // Both are idempotent per message/slot; cron scheduling for this handler is
  // owned by the deployment configuration.
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil((async () => {
      const repository = createOpsD1Repository(env.DB);
      const email = emailRuntimeFromEnvironment({ EMAIL_PROVIDER: env.EMAIL_PROVIDER, EMAIL_API_KEY: env.EMAIL_API_KEY, EMAIL_FROM: env.EMAIL_FROM, EMAIL_REPLY_TO: env.EMAIL_REPLY_TO, NEXT_PUBLIC_SITE_URL: env.NEXT_PUBLIC_SITE_URL });
      const transport = createNotificationEmailTransport({ repository, provider: email.provider, baseUrl: email.baseUrl });
      const deliverySummary = await runOutboxDeliveryCycle({ repository }, transport);
      const escalationSummary = await runSlaEscalationCycle({ repository });
      const pmRecurrenceSummary = await runPmRecurrenceCycle({ repository });
      console.log(JSON.stringify({ channel: "ops.jobs.cycle", runtime: "d1", transport: transport.name, outbox: deliverySummary, slaEscalation: escalationSummary, pmRecurrence: pmRecurrenceSummary }));
    })());
  },
};

export default worker;
