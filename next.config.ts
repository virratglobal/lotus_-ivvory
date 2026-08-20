import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist ships ESM that needs transpiling
  transpilePackages: ["pdfjs-dist"],

  // Webpack fallback for Vercel / serverless build environment (canvas mock)
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },

  // Turbopack config (Next.js 16 default)
  turbopack: {
    resolveAlias: {
      canvas: "./empty-module.js",
    },
  },
};

export default nextConfig;
