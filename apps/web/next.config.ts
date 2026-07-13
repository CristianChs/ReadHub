import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Los paquetes del monorepo se consumen como fuente TypeScript (sin paso de
  // build). Next los compila junto a la app: cero configuración de bundling y
  // salto directo a la definición desde el editor.
  transpilePackages: [
    "@readhub/types",
    "@readhub/database",
    "@readhub/shared",
    "@readhub/ai",
    "@readhub/services",
    "@readhub/rag",
  ],

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
