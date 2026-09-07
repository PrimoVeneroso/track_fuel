import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
  // Anteprima sandbox: consenti le richieste dev dal proxy di preview
  allowedDevOrigins: ["*.space-z.ai"],
};

export default nextConfig;
