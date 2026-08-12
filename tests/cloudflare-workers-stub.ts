// Local unit tests intentionally run without Cloudflare bindings. The server
// repository provider sees an empty environment and uses its non-production
// fixture adapter; production still requires the real `DB` binding.
export const env: Record<string, unknown> = {};
