import { defineConfig } from "vitest/config";

// ============================================================================
// Vitest — configuración RAÍZ del monorepo.
//
// No define tests propios: agrupa un PROYECTO por paquete (`test.projects`).
// Cada paquete conserva su propio `vitest.config.ts` con su entorno y sus
// globs, igual que ya conserva su `tsconfig.json`. Así:
//
//   - `npx vitest` en la raíz  -> corre todo, con los resultados etiquetados
//                                 por proyecto (shared, ai, rag, web…).
//   - `turbo run test`         -> corre cada paquete por separado, en paralelo
//                                 y con caché por paquete (ver turbo.json).
//
// Ambas vías leen exactamente la misma configuración: no hay dos verdades.
//
// Solo se listan los paquetes con lógica que probar. `types` y `config` no
// aparecen a propósito (son tipos y tsconfigs: los verifica `tsc --noEmit`),
// ni `database` (un factory de cliente: probarlo sería probar a supabase-js).
// ============================================================================

export default defineConfig({
  test: {
    projects: [
      "packages/shared",
      "packages/ai",
      "packages/services",
      "packages/rag",
      "apps/web",
      "apps/mcp",
    ],

    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      reporter: ["text", "html", "lcov"],
      // Solo se mide lo que se decidió probar. Incluir lo que nunca se va a
      // probar (tipos, tsconfigs, wrappers de shadcn) haría que el porcentaje
      // mintiera en ambas direcciones.
      include: [
        "packages/{shared,ai,services,rag}/src/**/*.ts",
        "apps/web/{hooks,lib,components}/**/*.{ts,tsx}",
        "apps/mcp/src/**/*.ts",
      ],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/index.ts", // solo re-exports
        "apps/web/components/ui/**", // wrappers de shadcn/Radix, sin lógica propia
        "**/node_modules/**",
        "**/dist/**",
        "**/.next/**",
      ],
    },
  },
});
