import { defineConfig } from "tsup";

/**
 * Los paquetes del monorepo (`@readhub/*`) se publican como FUENTE TypeScript,
 * sin paso de build. La app web los consume con `transpilePackages` de Next.
 * Un binario de Node necesita el equivalente: se **inlinean** en el bundle.
 *
 * Las dependencias npm reales (SDK de MCP, Supabase, openai, unpdf, mammoth)
 * quedan EXTERNAS: Node las resuelve desde node_modules en tiempo de ejecución.
 *
 * `skipNodeModulesBundle` es lo que hace cumplir esa frontera. Sin él, tsup solo
 * externaliza lo declarado en `dependencies`, y los SDK que llegan de forma
 * transitiva por `@readhub/ai` y `@readhub/rag` acababan dentro del binario.
 * Empaquetar `pdfjs` así es frágil: carga workers por `import.meta.url`.
 */
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node20",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  splitting: false,
  skipNodeModulesBundle: true,
  noExternal: [/^@readhub\//],
  // Sin `banner`: el shebang ya está en `src/index.ts` y esbuild lo conserva.
  // Añadirlo aquí producía dos, y Node solo acepta uno en la primera línea.
});
