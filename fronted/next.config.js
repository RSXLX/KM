/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production';

const nextConfig = {
  // Disable static export to support dynamic routes during build
  ...(isDev ? {} : { trailingSlash: true }),
  // Use default .next directory for all builds
  distDir: '.next',
  images: {
    unoptimized: !isDev,
    domains: ['localhost', '127.0.0.1', 'images.unsplash.com', 'via.placeholder.com', 'coindesk.com', 'espn.com']
  },
  experimental: {
    optimizeCss: false
  },
  typescript: {
    ignoreBuildErrors: true,
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