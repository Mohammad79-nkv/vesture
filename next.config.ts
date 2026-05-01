import type { NextConfig } from "next";
import path from "node:path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

const nextConfig: NextConfig = {
  // Tell Turbopack which directory is the workspace root. Without this it
  // walks up looking for a lockfile and may pick the wrong one when other
  // projects sit higher in the tree.
  turbopack: {
    root: path.join(__dirname),
  },
  typedRoutes: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
  },
};

export default withNextIntl(nextConfig);
