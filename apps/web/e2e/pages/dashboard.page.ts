import { expect, type Locator, type Page } from "@playwright/test";

// ============================================================================
// Page Object del área privada (el "dashboard"): la barra de navegación común
// a todas sus pantallas y el listado de artículos que es su página inicial.
// ============================================================================

/** Enlaces principales, tal y como los define `nav-links.tsx`. */
export const MAIN_NAV = [
  { name: "Inicio", href: "/" },
  { name: "Asistente", href: "/assistant" },
  { name: "Cargar artículo", href: "/upload" },
] as const;

export class DashboardPage {
  readonly brand: Locator;
  readonly heading: Locator;
  readonly userName: Locator;
  readonly logoutButton: Locator;

  constructor(private readonly page: Page) {
    this.brand = page.getByRole("link", { name: "ReadHub" });
    this.heading = page.getByRole("heading", { name: "Artículos", level: 1 });

    // El layout privado pinta el correo del usuario autenticado en la barra
    // (`user.email`, ver `(dashboard)/layout.tsx`). Es la prueba visible de que
    // la sesión se resolvió EN EL SERVIDOR, no solo en el navegador.
    this.userName = page.locator("header").getByText(/@/);

    this.logoutButton = page.getByRole("button", { name: "Cerrar sesión" });
  }

  /** Enlace de la navegación principal por su nombre visible. */
  navLink(name: string): Locator {
    return this.page.locator("header").getByRole("link", { name, exact: true });
  }

  async logout() {
    await this.logoutButton.click();
  }

  /** Comprueba que la navegación principal está completa y operativa. */
  async expectMainNavigation() {
    for (const link of MAIN_NAV) {
      const locator = this.navLink(link.name);
      await expect(locator).toBeVisible();
      await expect(locator).toHaveAttribute("href", link.href);
    }
  }
}
