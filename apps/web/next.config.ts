import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  output: "standalone",
  transpilePackages: ["@crm/types", "@crm/utils"],
  env: {
    API_URL: process.env.API_URL || "http://localhost:3001",
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://localhost:3001",
  },
  // Configure Turbopack for monorepo structure
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
  // Output file tracing for standalone builds in monorepo
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // Proxy API requests to backend to avoid cross-origin cookie issues
  async rewrites() {
    // Use internal Kubernetes service URL for production, localhost for dev
    const apiUrl =
      process.env.NODE_ENV === "production"
        ? "http://crm-backend:3001"
        : process.env.API_URL || "http://localhost:3001";
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
