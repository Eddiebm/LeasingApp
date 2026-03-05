/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  experimental: {
    appDir: true
  },
  // Expose server-side env vars to the edge worker bundle at build time.
  // On Cloudflare Pages, process.env is not reliably populated at runtime for
  // server-side secrets, so we bake them in via next.config env.
  env: {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY || "",
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  },
};

export default nextConfig;
