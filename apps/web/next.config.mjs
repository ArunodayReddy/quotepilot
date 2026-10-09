/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Dev convenience: proxy relative /api calls to the local Express API so
  // `scripts/dev.sh` keeps working with zero config. In production the client
  // uses NEXT_PUBLIC_API_URL (absolute), so this rewrite never fires there.
  // Override with API_PROXY_TARGET if the API lives elsewhere in dev.
  async rewrites() {
    const target = (process.env.API_PROXY_TARGET || "http://localhost:3001").replace(/\/$/, "");
    return [{ source: "/api/:path*", destination: `${target}/api/:path*` }];
  },
};

export default nextConfig;
