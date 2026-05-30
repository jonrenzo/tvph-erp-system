import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  serverExternalPackages: ["pdfkit"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
