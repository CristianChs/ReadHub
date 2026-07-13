import { defineConfig } from "vitest/config";

// Servidor MCP. Se prueba sin levantar el transporte stdio: `src/context.ts`
// expone un registry inyectable (`ContextFactory`), de modo que Tools, Resources
// y Prompts reciben un contexto falso.
//
// `dist/` queda fuera del glob: ahí vive el bundle de tsup, no el fuente.
export default defineConfig({
  test: {
    name: "mcp",
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["dist/**", "node_modules/**"],
    passWithNoTests: true,
    // Nombres canónicos del servidor MCP (sin prefijo NEXT_PUBLIC_): son los
    // que lee `src/config/env.ts`.
    env: {
      SUPABASE_URL: "http://localhost:54321",
      SUPABASE_ANON_KEY: "test-anon-key",
      VOYAGE_API_KEY: "test-voyage-key",
      GROQ_API_KEY: "test-groq-key",
    },
  },
});
