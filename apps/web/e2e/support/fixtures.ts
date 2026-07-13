import { test as base, expect } from "@playwright/test";

import { DashboardPage } from "../pages/dashboard.page";
import { LoginPage } from "../pages/login.page";

// ============================================================================
// UTILIDADES compartidas por las pruebas E2E.
//
// Extiende el `test` de Playwright inyectando los Page Objects ya construidos.
// Las pruebas los reciben como argumento y no instancian nada:
//
//     test("...", async ({ loginPage, dashboardPage }) => { … });
//
// Reexporta `expect` para que un fichero de prueba importe de un único sitio.
// ============================================================================

interface ReadHubFixtures {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
}

export const test = base.extend<ReadHubFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
});

export { expect };

/**
 * Estado de navegador SIN sesión.
 *
 * Los proyectos de `playwright.config.ts` arrancan autenticados (reutilizan las
 * cookies que guarda `auth.setup.ts`), porque es lo que le conviene a la mayoría
 * de las pruebas. Las que prueban la autenticación en sí tienen que empezar
 * desde cero, y se desmarcan así:
 *
 *     test.use(ANONYMOUS);
 *
 * No desactiva ni rodea la autenticación: simplemente no parte de una sesión ya
 * hecha, para poder ejercer el login real.
 */
export const ANONYMOUS: Parameters<typeof test.use>[0] = {
  storageState: { cookies: [], origins: [] },
};
