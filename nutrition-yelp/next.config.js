/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "s3-media*.yelpcdn.com",
      },
    ],
  },
};
module.exports = nextConfig;
