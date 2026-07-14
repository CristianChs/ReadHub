"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/ui/error-state";

// Límite de error del área privada.
//
// No sustituye a los estados de error que ya gestiona cada hook (esos siguen
// intactos): cubre el caso que hasta ahora no cubría nadie —una excepción
// lanzada durante el render— que dejaba la pantalla completamente en blanco.
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="Algo salió mal"
      message="No pudimos mostrar esta pantalla. Inténtalo de nuevo."
      onRetry={reset}
    />
  );
}
