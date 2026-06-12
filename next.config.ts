import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Ensure sharp native addon is available in serverless functions
  serverExternalPackages: ['sharp'],
  // Empty turbopack config to silence the warning (no custom webpack needed)
  turbopack: {},
};

export default nextConfig;