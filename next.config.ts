import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // unpdf ships its own PDF.js build; let Node load it instead of bundling it.
  serverExternalPackages: ["unpdf"],
  async headers() {
    return [
      {
        // The widget page is made to be framed by other websites.
        source: "/((?!embed).*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
