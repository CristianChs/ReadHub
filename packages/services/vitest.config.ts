import { defineConfig } from "vitest/config";

// Services de dominio. Todas sus funciones reciben el cliente de Supabase como
// primer PARÁMETRO, así que se prueban pasándole un cliente falso: no hace
// falta interceptar módulos, ni variables de entorno, ni red.
export default defineConfig({
  test: {
    name: "services",
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
