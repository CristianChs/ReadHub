import { expect, type Locator, type Page } from "@playwright/test";

import type { TestUser } from "../data/users";

// ============================================================================
// Page Object de /login.
//
// Encapsula LOS SELECTORES y las acciones de la pantalla. Los tests hablan en
// lenguaje de usuario ("inicia sesión con este usuario"), no en lenguaje de DOM.
// Si mañana cambia el formulario, se toca este fichero y ni una sola prueba.
//
// Los localizadores son por ROL y por ETIQUETA —lo que un usuario ve y lo que
// un lector de pantalla anuncia—, no por clases de Tailwind ni por ids internos:
// así una prueba solo se rompe si de verdad cambia el comportamiento.
// ============================================================================

export class LoginPage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly registerToggle: Locator;
  readonly errorAlert: Locator;

  constructor(private readonly page: Page) {
    this.emailInput = page.getByRole("textbox", {
      name: /^Correo electrónico/,
    });

    // OJO con este: el `<Label>` añade un asterisco de campo obligatorio
    // ("Contraseña*") y el ojo de mostrar/ocultar tiene aria-label "Mostrar
    // contraseña". Un `getByLabel("Contraseña")` coincidiría con LOS DOS y
    // Playwright fallaría por ambigüedad. El ancla `^` deja fuera el botón.
    // Tampoco vale `getByRole("textbox")`: un input de contraseña no expone ese
    // rol de accesibilidad.
    this.passwordInput = page.getByLabel(/^Contraseña/);

    this.submitButton = page.getByRole("button", { name: "Iniciar sesión" });
    this.registerToggle = page.getByRole("button", { name: "Regístrate" });

    // El componente Alert ya expone role="alert"... pero no es el único: Next
    // inyecta su anunciador de rutas (`#__next-route-announcer__`), que también
    // es un role="alert" y existe igualmente en producción. Es un nodo VACÍO, así
    // que basta con quedarse con la alerta que tiene texto.
    this.errorAlert = page.getByRole("alert").filter({ hasText: /\S/ });
  }

  async goto() {
    await this.page.goto("/login");
    await expect(this.submitButton).toBeVisible();
  }

  /** Rellena el formulario sin enviarlo. */
  async fill(user: TestUser) {
    await this.emailInput.fill(user.email);
    await this.passwordInput.fill(user.password);
  }

  /** Rellena y envía. No asume si el login va a tener éxito o no. */
  async submit(user: TestUser) {
    await this.fill(user);
    await this.submitButton.click();
  }
}
