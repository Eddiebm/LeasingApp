/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  experimental: {
    appDir: true
  }
};

export default nextConfig;
