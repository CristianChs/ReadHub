import { defineConfig, devices } from "@playwright/test";

// ============================================================================
// Playwright — pruebas End-to-End de ReadHub.
//
// Vive DENTRO de apps/web (y no en la raíz del monorepo) porque el `ci.yml` del
// proyecto ya lo espera aquí: instala con `--prefix apps/web` y publica los
// artefactos desde `apps/web/e2e/`. Adaptarse a esa configuración existente es
// preferible a reescribirla.
//
// Reparto de responsabilidades con Vitest, para no probar dos veces lo mismo:
//   - Vitest    -> "¿la lógica es correcta?" (ramas, casos límite, errores)
//   - Playwright-> "¿las piezas están conectadas?" (sesión, cookies, RLS,
//                  redirecciones del middleware, streaming real sobre HTTP)
// Separación mecánica por nombre: los tests de Vitest son `*.test.ts`; los de
// Playwright, `*.spec.ts`. Los globs son disjuntos y ningún runner puede
// recoger los ficheros del otro.
// ============================================================================

/** Sesión reutilizable que produce `e2e/support/auth.setup.ts`. */
export const STORAGE_STATE = "./e2e/.auth/user.json";

const CI = !!process.env.CI;
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  // Solo los `.spec.ts` son pruebas. El setup se declara aparte, abajo.
  testMatch: /.*\.spec\.ts/,

  // Artefactos de una ejecución fallida (screenshots, vídeos, traces).
  outputDir: "./e2e/test-results",

  fullyParallel: true,
  // En CI, un `test.only` olvidado dejaría pasar el resto en silencio.
  forbidOnly: CI,
  // Un reintento absorbe la flakiness real de red/arranque; dos ya taparían un
  // bug intermitente de verdad.
  retries: CI ? 2 : 0,
  // En SERIE, siempre. No es pereza, es la fuente de flakiness que se midió:
  //   - En CI los runners tienen 2 vCPU y todas las pruebas comparten la misma
  //     base de datos: paralelizar produce carreras, no velocidad.
  //   - En local hay un único proceso `next dev` detrás. Con varios workers
  //     entrando a la vez, la compilación bajo demanda de cada ruta se encola y
  //     las navegaciones se pasan del timeout: pruebas rojas sin nada roto
  //     (observado: los dos casos que hacen login dentro del test fallaban ~1 de
  //     cada 3 ejecuciones en paralelo, y nunca en serie).
  // La suite tarda ~40 s: no hay nada que ganar arriesgando resultados falsos.
  workers: 1,
  timeout: 60_000,
  // Margen amplio a propósito: en LOCAL, `next dev` compila cada ruta la primera
  // vez que se visita, y esa primera navegación puede tardar varios segundos
  // (más aún con varias pruebas entrando en paralelo a rutas distintas). Con 10 s
  // la primera prueba que tocaba /upload o / fallaba por timeout sin que nada
  // estuviera roto. En CI no aplica: allí se sirve un build de producción.
  expect: { timeout: 20_000 },

  // --- Reportes -------------------------------------------------------------
  reporter: [
    ["list"],
    // HTML navegable, con el vídeo y el trace incrustados en cada fallo.
    // `open: "never"` evita que en CI se quede colgado sirviendo el informe.
    ["html", { outputFolder: "./e2e/playwright-report", open: "never" }],
    // JUnit: es lo que cualquier CI (Actions, GitLab, Jenkins) sabe leer para
    // pintar la lista de pruebas fallidas.
    ["junit", { outputFile: "./e2e/playwright-report/junit.xml" }],
    // En GitHub Actions, además, anota el fallo sobre el diff del propio PR.
    ...(CI ? [["github"] as const] : []),
  ],

  use: {
    baseURL: BASE_URL,

    // --- Diagnóstico de fallos (lo que pide el enunciado) -------------------
    // Solo al fallar: en verde no se generan artefactos, así que una suite
    // que pasa no cuesta ni disco ni tiempo.
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // El trace es lo que de verdad se usa para depurar (DOM, red y consola paso
    // a paso). Se captura en el reintento para no ralentizar la primera pasada.
    trace: "on-first-retry",

    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },

  // --- Proyectos ------------------------------------------------------------
  projects: [
    // 1. Inicia sesión UNA vez y guarda las cookies. El resto de proyectos las
    //    reutilizan, en vez de repetir el login en cada prueba.
    {
      name: "setup",
      testMatch: /support\/auth\.setup\.ts/,
    },

    // 2. Navegadores. Arrancan ya autenticados.
    //
    //    Las pruebas que deben correr SIN sesión (login, registro, el guard del
    //    middleware, logout) se desmarcan por fichero, sin tocar esta config:
    //
    //        test.use({ storageState: { cookies: [], origins: [] } });
    //
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: STORAGE_STATE },
      dependencies: ["setup"],
    },
    // Firefox y WebKit quedan disponibles para ejecutarlos en local
    // (`npx playwright test --project=firefox`). En CI solo corre Chromium,
    // para mantener el job rápido.
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"], storageState: STORAGE_STATE },
      dependencies: ["setup"],
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"], storageState: STORAGE_STATE },
      dependencies: ["setup"],
    },
  ],

  // --- Servidor de la aplicación --------------------------------------------
  // Playwright levanta Next por su cuenta y espera a que responda.
  //
  //   - En local: `next dev`, y si ya tienes un servidor levantado lo reutiliza
  //     (`reuseExistingServer`), así que no te lo pisa ni tarda en arrancar.
  //   - En CI: SOLO `next start`. El build de producción lo hace el workflow en
  //     un paso PROPIO, antes de llamar a Playwright.
  //
  // Que el build viva fuera de aquí no es un detalle de estilo, son dos cosas:
  //
  //   1. Diagnóstico. Metido dentro de `webServer.command`, un fallo de compilación
  //      se reporta como "Process from config.webServer was not able to start.
  //      Exit code: 1" y el error real queda enterrado. En un paso propio, el log
  //      del CI muestra el error de TypeScript o de Next tal cual.
  //   2. Timeout. Este presupuesto cubre el ARRANQUE del servidor, no una
  //      compilación entera: un `next build` en un runner de 2 vCPU se come los
  //      120 s él solo y Playwright mataría el proceso antes de empezar.
  webServer: {
    command: CI ? "npm run start" : "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
