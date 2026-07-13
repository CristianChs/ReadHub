import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// ============================================================================
// Vitest — aplicación web (Next.js 15 + React 19).
//
// No usa `next/jest` ni ningún puente con el build de Next: los tests unitarios
// prueban hooks, componentes y utilidades, que son React y TypeScript normales.
// Lo que sí hay que replicar de Next es su RESOLUCIÓN de módulos, y son dos
// cosas, ambas abajo:
//
//   1. El alias "@/..."           (tsconfig.json -> paths)
//   2. Los paquetes @readhub/*    (next.config.ts -> transpilePackages)
//
// Entorno `jsdom` por defecto, porque la mayoría de los tests de esta app son
// de hooks y componentes. Un test que no toque el DOM (p. ej. `lib/validators`)
// puede pedir Node con un docblock en su primera línea:
//
//     // @vitest-environment node
//
// ============================================================================

const root = dirname(fileURLToPath(import.meta.url));
const pkg = (name: string) =>
  resolve(root, `../../packages/${name}/src/index.ts`);

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      // 1. Mismo alias que usan los componentes: "@/lib/utils", "@/hooks/…".
      "@": root,

      // 2. Los paquetes del monorepo se consumen como FUENTE TypeScript, sin
      //    paso de build (igual que en `transpilePackages`). Vite ya los
      //    resolvería por symlink, pero se declaran explícitamente para que la
      //    resolución en tests sea idéntica a la de `tsconfig.json` y no dependa
      //    de cómo npm decida hoistear el workspace.
      "@readhub/types": pkg("types"),
      "@readhub/database": pkg("database"),
      "@readhub/shared": pkg("shared"),
      "@readhub/ai": pkg("ai"),
      "@readhub/services": pkg("services"),
      "@readhub/rag": pkg("rag"),
    },
  },

  test: {
    name: "web",
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "{app,components,hooks,lib}/**/*.test.{ts,tsx}",
      "*.test.ts", // middleware.test.ts, si algún día se prueba aislado
    ],
    // `e2e/` es territorio de Playwright: sus ficheros son `*.spec.ts` y viven
    // fuera de esta app, pero se excluye igualmente para que ningún glob futuro
    // pueda hacer que los dos runners recojan el mismo fichero.
    exclude: ["node_modules/**", ".next/**", "e2e/**"],
    css: false,
  },
});
