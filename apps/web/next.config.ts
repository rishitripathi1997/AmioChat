import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@amiochat/backend', '@amiochat/shared'],
  serverExternalPackages: [
    '@aws-sdk/client-cognito-identity-provider',
    '@aws-sdk/client-dynamodb',
    '@aws-sdk/lib-dynamodb',
    '@aws-sdk/client-s3',
    '@aws-sdk/client-chime-sdk-meetings',
    '@aws-sdk/client-apigatewaymanagementapi',
    '@aws-sdk/client-ssm',
    '@aws-sdk/s3-request-presigner',
  ],
};

export default nextConfig;
