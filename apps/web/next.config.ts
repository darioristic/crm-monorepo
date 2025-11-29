import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  output: "standalone",
  transpilePackages: ["@crm/types", "@crm/utils"],
  typedRoutes: true,
  env: {
    API_URL: process.env.API_URL || "http://localhost:3001",
  },
};

export default nextConfig;
