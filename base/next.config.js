/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  webpack: (config, { isServer }) => {
    // MediaPipe requires WebAssembly
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Handle MediaPipe files
    config.module.rules.push({
      test: /\.(wasm)$/,
      type: 'webassembly/async',
    });

    // Ignore node-specific modules on client side
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    return config;
  },
  // Disable React Strict Mode to prevent MediaPipe camera from being destroyed
  // Strict Mode causes double-mounting (mount -> unmount -> mount) which destroys the pose instance
  reactStrictMode: false,
  // Image optimization
  images: {
    domains: ['localhost'],
  },
  // Proxy rewrites for microservices
  async rewrites() {
    return [
      {
        source: '/skin/:path*',
        destination: `${process.env.NEXT_PUBLIC_SKIN_URL || 'http://localhost:3002'}/:path*`,
      },
      // Community Next app (UI + /community/api/*) on one upstream port
      {
        source: '/community',
        destination: `${process.env.NEXT_PUBLIC_COMMUNITY_URL || 'http://localhost:3006/community'}`,
      },
      {
        source: '/community/:path*',
        destination: `${process.env.NEXT_PUBLIC_COMMUNITY_URL || 'http://localhost:3006/community'}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
