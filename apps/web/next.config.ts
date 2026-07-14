import bundleAnalyzer from "@next/bundle-analyzer";
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

// El analizador solo se activa con ANALYZE=true. Un build normal (local, CI o
// Vercel) no cambia en nada: mismo output, mismo tiempo. Cuando se activa,
// emite los treemaps HTML en .next/analyze/ y el pipeline los publica como
// artefacto — es lo que permite responder "¿qué metió esos 40 KB?" sin
// adivinar.
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: false,
});

export default withBundleAnalyzer(nextConfig);
