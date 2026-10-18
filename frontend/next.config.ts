import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  logging: {
    serverFunctions: false,
  },
  async headers() {
    return [
      {
        // Vendored logos are content-addressed by filename — cache hard.
        source: "/logos/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
