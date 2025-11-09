/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production';

const nextConfig = {
  // Use static export only for production builds
  ...(isDev ? {} : { output: 'export', trailingSlash: true }),
  // In dev, use default .next to avoid loading stale out/server runtime
  distDir: isDev ? '.next' : 'out',
  images: {
    unoptimized: !isDev,
    domains: ['images.unsplash.com', 'via.placeholder.com', 'coindesk.com', 'espn.com']
  },
  experimental: {
    optimizeCss: false
  },
  webpack: (config, { isServer }) => {
    // Exclude netlify functions from client-side build
    config.resolve.alias = {
      ...config.resolve.alias,
      '@netlify/functions': false
    };

    // Client-side fallbacks
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    return config;
  }
};

module.exports = nextConfig;