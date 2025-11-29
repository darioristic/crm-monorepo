import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  output: "standalone",
  transpilePackages: ["@crm/types", "@crm/utils"],
  // typedRoutes disabled due to dynamic route compatibility issues
  // typedRoutes: true,
  env: {
    API_URL: process.env.API_URL || "http://localhost:3001",
  },
  // Configure Turbopack for monorepo structure
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
  // Output file tracing for standalone builds in monorepo
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
