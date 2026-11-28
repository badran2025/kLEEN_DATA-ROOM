import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["googleapis", "node:sqlite", "pg", "@netlify/database"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push("node:sqlite", "pg-native");
    }
    return config;
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
