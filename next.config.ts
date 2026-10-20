import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Photo uploads are capped at 5 MB in the action; leave headroom for form overhead.
    serverActions: {
      bodySizeLimit: "6mb",
      // GitHub Codespaces serves the app through a forwarding proxy on *.app.github.dev.
      allowedOrigins: ["localhost:3000", "*.app.github.dev"],
    },
  },
};

export default nextConfig;
