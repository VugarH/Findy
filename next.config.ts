import type { NextConfig } from "next";
import { STATIC_SECURITY_HEADERS } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  turbopack: { root: import.meta.dirname },
  async headers() {
    return [{ source: "/:path*", headers: STATIC_SECURITY_HEADERS }];
  },
};

export default nextConfig;
