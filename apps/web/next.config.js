/** @type {import('next').NextConfig} */
const nextConfig = {
  // Only use static export for local builds, not Railway
  ...(process.env.STATIC_EXPORT === 'true' && {
    output: 'export',
    trailingSlash: true,
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
  webpack: (config, { isServer, dev }) => {
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