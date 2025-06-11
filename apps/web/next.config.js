/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configure output based on environment
  ...(process.env.STATIC_EXPORT === 'true' && {
    output: 'export',
    trailingSlash: true,
  }),
  ...(process.env.NODE_ENV === 'production' && process.env.STATIC_EXPORT !== 'true' && {
    output: 'standalone',
  }),
  
  images: {
    unoptimized: true
  },
  
  // Disable ESLint during build for quick testing
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Configure environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  
  // Webpack configuration for Monaco Editor
  webpack: (config, { isServer }) => {
    // Monaco Editor configuration for client-side only
    if (!isServer) {
      // Configure fallbacks for Node.js modules
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
        stream: false,
        assert: false,
        http: false,
        https: false,
        url: false,
        zlib: false,
      };
    }
    
    return config;
  },
  
  // Security headers (won't work with static export but kept for reference)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig; 