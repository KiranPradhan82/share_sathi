import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Native addon - cannot be bundled by Turbopack
  serverExternalPackages: ['@resvg/resvg-js'],
  turbopack: {},
};

export default nextConfig;