/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  poweredByHeader: false,
  experimental: { serverComponentsExternalPackages: ["@prisma/client", "bcryptjs"] },
  async headers() {
    // Baseline security headers applied by the app itself. The bundled nginx
    // proxy sets an equivalent set, but the app is also reachable directly on
    // :3000 (see README), so these must not depend on the proxy. A strict
    // Content-Security-Policy is intentionally left out here — Next.js relies on
    // inline runtime scripts, so a CSP needs per-deployment nonce work and is
    // documented as a recommendation rather than shipped blind.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
