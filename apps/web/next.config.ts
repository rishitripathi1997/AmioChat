import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@amiochat/backend', '@amiochat/shared'],
};

export default nextConfig;
