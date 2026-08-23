import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Anteprima sandbox: consenti le richieste dev dal proxy di preview
  allowedDevOrigins: ["*.space-z.ai"],
};

export default nextConfig;
