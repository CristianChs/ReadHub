"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import {
  validateLogin,
  validateRegister,
  translateAuthError,
  type LoginErrors,
  type RegisterErrors,
} from "@/lib/validators/auth";
import { getErrorMessage } from "@/lib/utils";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Mode = "login" | "register";

interface AuthFormValues {
  email: string;
  birthDate: string;
  phone: string;
  password: string;
}

const EMPTY_VALUES: AuthFormValues = {
  email: "",
  birthDate: "",
  phone: "",
  password: "",
};

export function AuthForm({ initialMode = "login" }: { initialMode?: Mode }) {
  const router = useRouter();
  const { login, register } = useAuth();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [values, setValues] = useState<AuthFormValues>(EMPTY_VALUES);
  const [fieldErrors, setFieldErrors] = useState<
    LoginErrors & RegisterErrors
  >({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isLogin = mode === "login";

  function setField(field: keyof AuthFormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  // Cambio dinámico entre login y registro sin abandonar la página (Flujo 2).
  function switchMode(next: Mode) {
    setMode(next);
    setFieldErrors({});
    setFormError(null);
    setSuccessMessage(null);
    setShowPassword(false);
    setValues((prev) => ({ ...prev, password: "" }));
  }

  async function handleLogin() {
    const errors = validateLogin({
      email: values.email,
      password: values.password,
    });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    setFormError(null);
    try {
      await login({ email: values.email.trim(), password: values.password });
      setSuccessMessage("Inicio de sesión exitoso.");
      router.replace("/");
      router.refresh();
    } catch (error) {
      setFormError(translateAuthError(getErrorMessage(error)));
      // Se conservan los datos ingresados excepto la contraseña (Flujo 3).
      setValues((prev) => ({ ...prev, password: "" }));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegister() {
    const errors = validateRegister({
      email: values.email,
      birthDate: values.birthDate,
      phone: values.phone,
      password: values.password,
    });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    setFormError(null);
    try {
      const data = await register({
        email: values.email.trim(),
        password: values.password,
        birthDate: values.birthDate,
        phone: values.phone.trim(),
      });

      if (data.session) {
        // Sesión creada de inmediato: se accede a la página principal (Flujo 2).
        setSuccessMessage("Registro exitoso.");
        router.replace("/");
        router.refresh();
      } else {
        // Confirmación de correo activada: no hay sesión todavía.
        setSuccessMessage(
          "Registro exitoso. Revisa tu correo para confirmar tu cuenta e inicia sesión.",
        );
        switchMode("login");
        setValues((prev) => ({ ...EMPTY_VALUES, email: prev.email }));
      }
    } catch (error) {
      setFormError(translateAuthError(getErrorMessage(error)));
      setValues((prev) => ({ ...prev, password: "" }));
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLogin) void handleLogin();
    else void handleRegister();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h2 className="text-xl font-semibold tracking-tight">
          {isLogin ? "Iniciar sesión" : "Crear cuenta"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isLogin
            ? "Accede a tu cuenta para continuar."
            : "Regístrate para publicar y descubrir artículos."}
        </p>
      </div>

      {successMessage && (
        <Alert variant="success">
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField
          label="Correo electrónico"
          htmlFor="email"
          error={fieldErrors.email}
          required
        >
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={(e) => setField("email", e.target.value)}
            aria-invalid={!!fieldErrors.email}
            placeholder="tucorreo@email.com"
          />
        </FormField>

        {!isLogin && (
          <>
            <FormField
              label="Fecha de nacimiento"
              htmlFor="birthDate"
              error={fieldErrors.birthDate}
              required
            >
              <Input
                id="birthDate"
                type="date"
                value={values.birthDate}
                onChange={(e) => setField("birthDate", e.target.value)}
                aria-invalid={!!fieldErrors.birthDate}
              />
            </FormField>

            <FormField
              label="Número celular"
              htmlFor="phone"
              error={fieldErrors.phone}
              required
            >
              <Input
                id="phone"
                type="tel"
                autoComplete="tel"
                value={values.phone}
                onChange={(e) => setField("phone", e.target.value)}
                aria-invalid={!!fieldErrors.phone}
                placeholder="3001234567"
              />
            </FormField>
          </>
        )}

        <FormField
          label="Contraseña"
          htmlFor="password"
          error={fieldErrors.password}
          required
        >
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete={isLogin ? "current-password" : "new-password"}
              value={values.password}
              onChange={(e) => setField("password", e.target.value)}
              aria-invalid={!!fieldErrors.password}
              className="pr-10"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={
                showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
              }
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
        </FormField>

        <SubmitButton
          className="w-full"
          loading={submitting}
          loadingText={isLogin ? "Iniciando sesión…" : "Creando cuenta…"}
        >
          {isLogin ? "Iniciar sesión" : "Registrarse"}
        </SubmitButton>
      </form>

      <div className="text-center text-sm text-muted-foreground">
        {isLogin ? (
          <>
            ¿No tienes cuenta?{" "}
            <Button
              type="button"
              variant="link"
              className="h-auto p-0"
              onClick={() => switchMode("register")}
            >
              Regístrate
            </Button>
          </>
        ) : (
          <>
            ¿Ya tienes cuenta?{" "}
            <Button
              type="button"
              variant="link"
              className="h-auto p-0"
              onClick={() => switchMode("login")}
            >
              Inicia sesión
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
