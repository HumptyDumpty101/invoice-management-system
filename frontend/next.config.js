const NEXT_PUBLIC_API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

module.exports = {
  images: {
    domains: ["localhost"],
  },
  env: {
    NEXT_PUBLIC_API_URL,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${NEXT_PUBLIC_API_URL}/:path*`,
      },
    ];
  },
};
