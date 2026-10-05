import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  typescript: {
    // Next owns and may update this Render-only config with generated route
    // types. Vinext and clean source typechecking keep using tsconfig.json.
    tsconfigPath: process.env.OPS_RUNTIME === "render" ? "tsconfig.render.json" : "tsconfig.json",
  },
  // Render's build machine reports dozens of CPUs but has little memory; one page-data
  // worker per CPU runs it out of memory. Two workers keep the build well inside the limit.
  ...(process.env.OPS_RUNTIME === "render" ? { experimental: { cpus: 2 } } : {}),
  // The standard Next Node server serves both application routes and emitted
  // static assets. Render injects PORT; start:render binds to 0.0.0.0.
};

export default nextConfig;
