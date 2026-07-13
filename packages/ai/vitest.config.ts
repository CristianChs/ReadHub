import { defineConfig } from "vitest/config";

// Frontera con los proveedores externos (Voyage para embeddings, Groq para el
// LLM). En las pruebas se fakean AQUÍ —`fetch` y el cliente `openai`— y en
// ningún otro sitio: es el único paquete que los conoce.
//
// `env` fija credenciales de mentira para que un test que olvide fakear la red
// falle con un 401 evidente en lugar de gastar cuota real.
export default defineConfig({
  test: {
    name: "ai",
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      VOYAGE_API_KEY: "test-voyage-key",
      GROQ_API_KEY: "test-groq-key",
    },
  },
});
