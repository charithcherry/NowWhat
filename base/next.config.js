/** @type {import('next').NextConfig} */
const nextConfig = {
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
        destination: 'http://localhost:3002/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
