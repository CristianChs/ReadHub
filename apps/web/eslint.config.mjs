import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { FlatCompat } from "@eslint/eslintrc";

// ============================================================================
// ESLint 9 (flat config).
//
// El proyecto ya declaraba `eslint` + `eslint-config-next` y un script `lint`,
// pero le faltaba el fichero de configuración: `npm run lint` fallaba con
// "couldn't find an eslint.config.js" desde antes de existir el pipeline. Sin
// esto, el paso de ESLint del CI no podría pasar nunca.
//
// `eslint-config-next` todavía se publica en el formato antiguo (eslintrc), así
// que se adapta con FlatCompat en vez de reescribir sus reglas a mano.
// ============================================================================

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const config = [
  {
    // Artefactos generados: nunca se lintan. `next-env.d.ts` lo REESCRIBE Next
    // en cada build (con su triple-slash reference, que la propia regla de Next
    // prohíbe), así que lintarlo es pelearse con un fichero que no controlamos.
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "next-env.d.ts",
      "e2e/playwright-report/**",
      "e2e/test-results/**",
      "e2e/.auth/**",
    ],
  },

  ...compat.extends("next/core-web-vitals", "next/typescript"),

  {
    // Las pruebas E2E no son código de React.
    //
    // Los fixtures de Playwright reciben una función `use()` para entregar el
    // valor al test. La regla `rules-of-hooks` ve una llamada a algo que empieza
    // por "use" y cree que es un hook llamado fuera de un componente: es un falso
    // positivo, y aquí no hay ningún hook que validar.
    files: ["e2e/**/*.ts", "playwright.config.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
];

export default config;
