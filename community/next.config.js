/** @type {import('next').NextConfig} */
const basePath = "/community";

const nextConfig = {
  basePath,
  async redirects() {
    return [
      {
        source: "/",
        destination: basePath,
        basePath: false,
        permanent: false,
      },
    ];
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    // Prefer opening Community via base (port 3000) when using dev rewrites; direct :3006/community still works.
    NEXT_PUBLIC_COMMUNITY_ENTRY_URL:
      process.env.NEXT_PUBLIC_COMMUNITY_ENTRY_URL || "http://localhost:3000/community",
  },
};

module.exports = nextConfig;
