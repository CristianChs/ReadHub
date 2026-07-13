import { defineConfig } from "vitest/config";

// Sistema RAG. Mismo patrón que `services` (el cliente de Supabase entra por
// parámetro) y, además, gran parte de la lógica —troceado, selección de
// contexto, agrupación— ya está exportada como funciones puras.
//
// Las credenciales de mentira replican las de `@readhub/ai`: si un test alcanza
// al proveedor de verdad, debe fallar en vez de facturar.
export default defineConfig({
  test: {
    name: "rag",
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      VOYAGE_API_KEY: "test-voyage-key",
      GROQ_API_KEY: "test-groq-key",
    },
  },
});
