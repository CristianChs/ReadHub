import { MAIN_NAV } from "../pages/dashboard.page";
import { UNKNOWN_USER, VALID_USER, WRONG_PASSWORD_USER } from "../data/users";
import { ANONYMOUS, expect, test } from "../support/fixtures";

// ============================================================================
// Flujo principal de autenticación, de extremo a extremo.
//
// Ejerce el sistema REAL: formulario -> useAuth -> auth.service -> Supabase Auth
// -> cookies -> middleware -> layout privado en el servidor. Sin atajos, sin
// tokens inyectados a mano y sin tocar la aplicación para facilitar la prueba.
//
// Estas pruebas arrancan SIN sesión (`ANONYMOUS`): el login es justamente lo que
// están probando, así que partir de una sesión ya hecha no probaría nada.
//
// Lo que NO se prueba aquí, porque ya lo cubre Vitest y repetirlo sería pagar
// dos veces por la misma certeza: las combinaciones de validación del formulario
// y la traducción de cada mensaje de error de Supabase. Aquí se comprueba que
// las piezas están CONECTADAS.
// ============================================================================

test.use(ANONYMOUS);

test.describe("Autenticación", () => {
  test("un usuario inicia sesión, usa la aplicación y cierra sesión", async ({
    page,
    loginPage,
    dashboardPage,
  }) => {
    await test.step("abrir la aplicación sin sesión lleva al login", async () => {
      await page.goto("/");

      // No es una redirección cosmética: la impone el middleware sobre la cookie
      // de sesión. Es la primera prueba de que el área privada está cerrada.
      await expect(page).toHaveURL("/login");
      await expect(loginPage.submitButton).toBeVisible();
    });

    await test.step("introducir credenciales válidas y autenticarse", async () => {
      await loginPage.submit(VALID_USER);
    });

    await test.step("la aplicación redirige al dashboard", async () => {
      await expect(page).toHaveURL("/");
      await expect(dashboardPage.heading).toBeVisible();
    });

    await test.step("la información del usuario se cargó correctamente", async () => {
      // El correo lo pinta el LAYOUT DE SERVIDOR a partir de la sesión
      // (`(dashboard)/layout.tsx`). Que aparezca demuestra que la cookie viajó y
      // que Supabase la resolvió en el servidor, no solo en el navegador.
      await expect(dashboardPage.userName).toHaveText(VALID_USER.email);
    });

    await test.step("la navegación principal está disponible", async () => {
      await dashboardPage.expectMainNavigation();
    });

    await test.step("la sesión da acceso real a una ruta protegida", async () => {
      // Entrar de verdad en una ruta privada: si la sesión fuese solo aparente,
      // el middleware devolvería al login aquí.
      await dashboardPage.navLink("Cargar artículo").click();
      await expect(page).toHaveURL("/upload");
      await expect(
        page.getByRole("heading", { name: "Cargar artículo", level: 1 }),
      ).toBeVisible();
    });

    await test.step("cerrar sesión devuelve al login", async () => {
      await dashboardPage.logout();
      await expect(page).toHaveURL("/login");
      await expect(loginPage.submitButton).toBeVisible();
    });

    await test.step("tras cerrar sesión, el área privada vuelve a estar cerrada", async () => {
      // El paso que de verdad demuestra que la sesión se destruyó: sin esto, un
      // logout que solo cambiara de página seguiría pasando la prueba.
      await page.goto("/");
      await expect(page).toHaveURL("/login");
      await expect(dashboardPage.logoutButton).toBeHidden();
    });
  });

  test("el botón Atrás no devuelve al área privada tras cerrar sesión", async ({
    page,
    loginPage,
    dashboardPage,
  }) => {
    await loginPage.goto();
    await loginPage.submit(VALID_USER);
    await expect(dashboardPage.heading).toBeVisible();

    // Hay que NAVEGAR a una ruta privada para que entre en el historial: tanto el
    // login como el logout usan `router.replace`, que sustituye la entrada en vez
    // de apilarla. Sin este paso, el historial no contiene ninguna página privada
    // y "volver atrás" no probaría nada (de hecho sale a about:blank).
    await dashboardPage.navLink("Cargar artículo").click();
    await expect(page).toHaveURL("/upload");

    await dashboardPage.logout();
    await expect(page).toHaveURL("/login");

    // Ahora sí: el historial tiene /upload detrás. Volver atrás no debe mostrar
    // contenido privado. `router.refresh()` tras el logout existe precisamente
    // para invalidar la caché del cliente y que el historial no sirva una página
    // privada cacheada; el middleware es la garantía final.
    await page.goBack();

    await expect(page).toHaveURL("/login");
    await expect(dashboardPage.logoutButton).toBeHidden();
  });

  test("una contraseña incorrecta no autentica y no revela si el correo existe", async ({
    page,
    loginPage,
  }) => {
    await loginPage.goto();
    await loginPage.submit(WRONG_PASSWORD_USER);

    await expect(loginPage.errorAlert).toBeVisible();
    await expect(page).toHaveURL("/login");

    // El mismo mensaje que para un correo inexistente: no se filtra qué correos
    // están registrados.
    await expect(loginPage.errorAlert).toHaveText(
      "Correo o contraseña incorrectos.",
    );
  });

  test("un correo no registrado recibe exactamente el mismo mensaje", async ({
    loginPage,
  }) => {
    await loginPage.goto();
    await loginPage.submit(UNKNOWN_USER);

    await expect(loginPage.errorAlert).toHaveText(
      "Correo o contraseña incorrectos.",
    );
  });

  test("un intento fallido conserva el correo pero borra la contraseña", async ({
    loginPage,
  }) => {
    await loginPage.goto();
    await loginPage.submit(WRONG_PASSWORD_USER);
    await expect(loginPage.errorAlert).toBeVisible();

    // El usuario no debe reescribir su correo para reintentar; la contraseña sí
    // se limpia, para no dejarla en pantalla tras un fallo.
    await expect(loginPage.emailInput).toHaveValue(WRONG_PASSWORD_USER.email);
    await expect(loginPage.passwordInput).toHaveValue("");
  });

  test("un formulario vacío no llega a enviarse al servidor", async ({
    page,
    loginPage,
  }) => {
    await loginPage.goto();
    await loginPage.submitButton.click();

    // Un único caso: aquí solo se verifica que el formulario está CABLEADO al
    // validador. Las combinaciones de campos inválidos ya están cubiertas, una a
    // una, en las pruebas unitarias de `lib/validators/auth`.
    await expect(page.getByText("El correo es obligatorio.")).toBeVisible();
    await expect(page).toHaveURL("/login");
  });

  test.describe("rutas protegidas sin sesión", () => {
    for (const { name, href } of MAIN_NAV.filter((link) => link.href !== "/")) {
      test(`${href} redirige al login`, async ({ page, loginPage }) => {
        await page.goto(href);

        await expect(page, `"${name}" debería exigir sesión`).toHaveURL("/login");
        await expect(loginPage.submitButton).toBeVisible();
      });
    }
  });
});
