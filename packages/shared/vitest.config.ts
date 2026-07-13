import { defineConfig } from "vitest/config";

// Utilidades agnósticas de runtime: no dependen de React, Next ni Supabase.
// Entorno `node`, sin setup y sin mocks: son funciones puras.
export default defineConfig({
  test: {
    name: "shared",
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
