// Validación de formularios de autenticación (lógica pura, sin UI ni Supabase).

export interface LoginFormValues {
  email: string;
  password: string;
}

export interface RegisterFormValues {
  email: string;
  birthDate: string;
  phone: string;
  password: string;
}

export type LoginErrors = Partial<Record<keyof LoginFormValues, string>>;
export type RegisterErrors = Partial<Record<keyof RegisterFormValues, string>>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[\d\s-]{7,15}$/;
const MIN_PASSWORD_LENGTH = 6;

export function validateLogin(values: LoginFormValues): LoginErrors {
  const errors: LoginErrors = {};
  if (!values.email.trim()) {
    errors.email = "El correo es obligatorio.";
  } else if (!EMAIL_REGEX.test(values.email.trim())) {
    errors.email = "Introduce un correo válido.";
  }
  if (!values.password) {
    errors.password = "La contraseña es obligatoria.";
  }
  return errors;
}

export function validateRegister(values: RegisterFormValues): RegisterErrors {
  const errors: RegisterErrors = {};

  if (!values.email.trim()) {
    errors.email = "El correo es obligatorio.";
  } else if (!EMAIL_REGEX.test(values.email.trim())) {
    errors.email = "Introduce un correo válido.";
  }

  if (!values.birthDate) {
    errors.birthDate = "La fecha de nacimiento es obligatoria.";
  } else if (new Date(values.birthDate) > new Date()) {
    errors.birthDate = "La fecha de nacimiento no puede ser futura.";
  }

  if (!values.phone.trim()) {
    errors.phone = "El número celular es obligatorio.";
  } else if (!PHONE_REGEX.test(values.phone.trim())) {
    errors.phone = "Introduce un número celular válido.";
  }

  if (!values.password) {
    errors.password = "La contraseña es obligatoria.";
  } else if (values.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }

  return errors;
}

// Traduce los mensajes de error de Supabase Auth (en inglés) a mensajes claros
// en español, sin revelar información interna del servidor.
export function translateAuthError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "Correo o contraseña incorrectos.";
  }
  if (
    normalized.includes("already registered") ||
    normalized.includes("already been registered") ||
    normalized.includes("user already exists")
  ) {
    return "El correo electrónico ya se encuentra registrado.";
  }
  if (normalized.includes("password should be at least")) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }
  if (normalized.includes("unable to validate email address") ||
      normalized.includes("invalid email")) {
    return "El correo electrónico no es válido.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Debes confirmar tu correo antes de iniciar sesión.";
  }
  if (normalized.includes("rate limit") || normalized.includes("too many")) {
    return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
  }

  return "No se pudo completar la operación. Inténtalo de nuevo.";
}
