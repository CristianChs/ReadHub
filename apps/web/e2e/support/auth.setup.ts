import { expect, test as setup } from "@playwright/test";

import { VALID_USER } from "../data/users";
import { DashboardPage } from "../pages/dashboard.page";
import { LoginPage } from "../pages/login.page";
import { STORAGE_STATE } from "../../playwright.config";

// ============================================================================
// Setup de autenticación. NO es una prueba: no afirma nada sobre el producto.
// Su único trabajo es dejar una sesión guardada en disco para que las demás
// pruebas arranquen ya dentro de la aplicación, en vez de repetir el login
// cincuenta veces.
//
// Inicia sesión por la INTERFAZ REAL (formulario -> useAuth -> auth.service ->
// Supabase), sin atajos ni tokens inyectados a mano: así las cookies que quedan
// guardadas son exactamente las que produce la aplicación en producción. No se
// modifica ni se rodea la autenticación existente; solo se usa.
//
// Reutiliza los mismos Page Objects y los mismos datos que las pruebas: los
// selectores del formulario de login viven en UN solo sitio.
//
// El flujo de login en sí SÍ se prueba, pero en `tests/auth.spec.ts`, que corre
// sin sesión previa. Aquí no se duplica.
// ============================================================================

setup("autenticar", async ({ page }) => {
  const loginPage = new LoginPage(page);
  const dashboard = new DashboardPage(page);

  await loginPage.goto();
  await loginPage.submit(VALID_USER);

  // El middleware redirige al home en cuanto hay sesión. Esperar a la
  // navegación —y no a un texto— es lo que garantiza que la cookie ya está
  // escrita antes de guardarla.
  await page.waitForURL("/", { timeout: 15_000 });

  // Si las credenciales no existen en la base de datos, el formulario se queda
  // en /login con una alerta. Comprobarlo aquí da un mensaje claro en vez de
  // dejar que fallen, sin explicación, todas las pruebas que dependen del setup.
  await expect(
    dashboard.logoutButton,
    `No se pudo iniciar sesión con ${VALID_USER.email}. ¿Está la base de datos ` +
      `sembrada (supabase db reset), o hay que definir E2E_USER_EMAIL y ` +
      `E2E_USER_PASSWORD para apuntar a un usuario existente?`,
  ).toBeVisible();

  await page.context().storageState({ path: STORAGE_STATE });
});
