/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
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
  reactStrictMode: false,
  images: {
    domains: ['localhost'],
  },
  async rewrites() {
    const skinUrl = process.env.SKIN_SERVICE_URL || 'http://localhost:3002';
    return [
      {
        source: '/skin/:path*',
        destination: `${skinUrl}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
