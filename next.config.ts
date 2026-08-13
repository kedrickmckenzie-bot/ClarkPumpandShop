import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  // The standard Next Node server serves both application routes and emitted
  // static assets. Render injects PORT; start:render binds to 0.0.0.0.
};

export default nextConfig;
