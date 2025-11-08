/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production';

const nextConfig = {
  // Use static export only for production builds
  ...(isDev ? {} : { output: 'export', trailingSlash: true }),
  // In dev, use default .next to avoid loading stale out/server runtime
  distDir: isDev ? '.next' : 'out',
  images: {
    unoptimized: !isDev,
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
      { protocol: 'https', hostname: 'via.placeholder.com', pathname: '/**' },
      { protocol: 'https', hostname: 'coindesk.com', pathname: '/**' },
      { protocol: 'https', hostname: 'www.coindesk.com', pathname: '/**' },
      { protocol: 'https', hostname: 'espn.com', pathname: '/**' },
      { protocol: 'https', hostname: 'www.espn.com', pathname: '/**' },
    ]
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