import type { NextConfig } from 'next'

const isGithubPages = process.env.GITHUB_PAGES === 'true'
const basePath = isGithubPages ? '/vinted-hub' : process.env.NEXT_PUBLIC_BASE_PATH || ''

const nextConfig: NextConfig = {
  ...(isGithubPages
    ? {
        output: 'export' as const,
        trailingSlash: true,
      }
    : {}),
  basePath: basePath || undefined,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'images.vinted.net',
        pathname: '/**',
      },
    ],
  },
}

export default nextConfig
