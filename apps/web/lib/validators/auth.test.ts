// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  translateAuthError,
  validateLogin,
  validateRegister,
  type RegisterFormValues,
} from "./auth";

// ============================================================================
// validators/auth — lógica pura. Es lo que decide qué mensaje ve el usuario
// cuando se equivoca, así que cada rama se prueba explícitamente.
//
// Estos tests cubren TODAS las ramas a propósito: el E2E de Playwright probará
// un único caso inválido, solo para verificar que el formulario está cableado
// a este validador. No repetirá las combinaciones (ver la estrategia de tests).
// ============================================================================

const VALID_REGISTER: RegisterFormValues = {
  email: "ana@readhub.dev",
  birthDate: "1990-05-20",
  phone: "3001234567",
  password: "secreto123",
};

describe("validateLogin", () => {
  it("no devuelve errores con credenciales bien formadas", () => {
    expect(
      validateLogin({ email: "ana@readhub.dev", password: "secreto123" }),
    ).toEqual({});
  });

  it("exige el correo cuando está vacío o es solo espacios", () => {
    expect(validateLogin({ email: "", password: "x" }).email).toBe(
      "El correo es obligatorio.",
    );
    // Caso límite: espacios en blanco no son un correo.
    expect(validateLogin({ email: "   ", password: "x" }).email).toBe(
      "El correo es obligatorio.",
    );
  });

  it.each([
    ["sin arroba", "anareadhub.dev"],
    ["sin dominio", "ana@"],
    ["sin extensión", "ana@readhub"],
    ["con espacio interior", "an a@readhub.dev"],
    ["doble arroba", "ana@@readhub.dev"],
  ])("rechaza un correo %s", (_caso, email) => {
    expect(validateLogin({ email, password: "x" }).email).toBe(
      "Introduce un correo válido.",
    );
  });

  it("acepta un correo con espacios alrededor (se recortan antes de validar)", () => {
    expect(
      validateLogin({ email: "  ana@readhub.dev  ", password: "x" }).email,
    ).toBeUndefined();
  });

  it("exige la contraseña, pero NO impone longitud mínima al iniciar sesión", () => {
    // Deliberado: la longitud mínima es una regla del registro. En login, exigirla
    // filtraría cuentas antiguas y además revelaría información sobre la política.
    expect(validateLogin({ email: "ana@readhub.dev", password: "" }).password).toBe(
      "La contraseña es obligatoria.",
    );
    expect(
      validateLogin({ email: "ana@readhub.dev", password: "abc" }).password,
    ).toBeUndefined();
  });

  it("acumula los errores de todos los campos a la vez", () => {
    expect(validateLogin({ email: "", password: "" })).toEqual({
      email: "El correo es obligatorio.",
      password: "La contraseña es obligatoria.",
    });
  });
});

describe("validateRegister", () => {
  it("no devuelve errores con un formulario completo y válido", () => {
    expect(validateRegister(VALID_REGISTER)).toEqual({});
  });

  it("exige la fecha de nacimiento", () => {
    expect(
      validateRegister({ ...VALID_REGISTER, birthDate: "" }).birthDate,
    ).toBe("La fecha de nacimiento es obligatoria.");
  });

  it("rechaza una fecha de nacimiento futura", () => {
    const mañana = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    expect(
      validateRegister({ ...VALID_REGISTER, birthDate: mañana }).birthDate,
    ).toBe("La fecha de nacimiento no puede ser futura.");
  });

  it("acepta una fecha de nacimiento pasada", () => {
    expect(
      validateRegister({ ...VALID_REGISTER, birthDate: "1900-01-01" }).birthDate,
    ).toBeUndefined();
  });

  it.each([
    ["vacío", "", "El número celular es obligatorio."],
    ["solo espacios", "   ", "El número celular es obligatorio."],
    ["demasiado corto", "12345", "Introduce un número celular válido."],
    ["con letras", "300abc4567", "Introduce un número celular válido."],
    [
      "demasiado largo",
      "12345678901234567890",
      "Introduce un número celular válido.",
    ],
  ])("rechaza un teléfono %s", (_caso, phone, mensaje) => {
    expect(validateRegister({ ...VALID_REGISTER, phone }).phone).toBe(mensaje);
  });

  it.each([
    ["con prefijo internacional", "+34 600 123 456"],
    ["con guiones", "300-123-4567"],
    ["en el mínimo de 7 dígitos", "1234567"],
  ])("acepta un teléfono %s", (_caso, phone) => {
    expect(validateRegister({ ...VALID_REGISTER, phone }).phone).toBeUndefined();
  });

  it("exige contraseña y aplica el mínimo de 6 caracteres", () => {
    expect(
      validateRegister({ ...VALID_REGISTER, password: "" }).password,
    ).toBe("La contraseña es obligatoria.");
    // Caso límite: 5 caracteres falla, 6 pasa.
    expect(
      validateRegister({ ...VALID_REGISTER, password: "12345" }).password,
    ).toBe("La contraseña debe tener al menos 6 caracteres.");
    expect(
      validateRegister({ ...VALID_REGISTER, password: "123456" }).password,
    ).toBeUndefined();
  });

  it("acumula todos los errores de un formulario vacío", () => {
    const errors = validateRegister({
      email: "",
      birthDate: "",
      phone: "",
      password: "",
    });
    expect(Object.keys(errors).sort()).toEqual([
      "birthDate",
      "email",
      "password",
      "phone",
    ]);
  });
});

describe("translateAuthError", () => {
  it.each([
    ["Invalid login credentials", "Correo o contraseña incorrectos."],
    [
      "User already registered",
      "El correo electrónico ya se encuentra registrado.",
    ],
    [
      "Email address has already been registered",
      "El correo electrónico ya se encuentra registrado.",
    ],
    [
      "Password should be at least 6 characters",
      "La contraseña debe tener al menos 6 caracteres.",
    ],
    [
      "Unable to validate email address: invalid format",
      "El correo electrónico no es válido.",
    ],
    [
      "Email not confirmed",
      "Debes confirmar tu correo antes de iniciar sesión.",
    ],
    [
      "Email rate limit exceeded",
      "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
    ],
  ])("traduce %j", (original, esperado) => {
    expect(translateAuthError(original)).toBe(esperado);
  });

  it("es insensible a mayúsculas y minúsculas", () => {
    expect(translateAuthError("INVALID LOGIN CREDENTIALS")).toBe(
      "Correo o contraseña incorrectos.",
    );
  });

  it("devuelve un mensaje genérico ante un error desconocido, sin filtrarlo", () => {
    const interno =
      'PGRST301: JWT expired at pg-host-42.internal (secret=abc123)';
    const traducido = translateAuthError(interno);

    expect(traducido).toBe("No se pudo completar la operación. Inténtalo de nuevo.");
    // El detalle interno del servidor NO debe llegar nunca a la interfaz.
    expect(traducido).not.toContain("pg-host-42");
    expect(traducido).not.toContain("secret");
  });

  it("no revienta con una cadena vacía", () => {
    expect(translateAuthError("")).toBe(
      "No se pudo completar la operación. Inténtalo de nuevo.",
    );
  });
});
