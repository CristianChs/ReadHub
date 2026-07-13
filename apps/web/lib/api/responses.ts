import { NextResponse } from "next/server";

// Respuestas JSON con el formato uniforme definido en la especificación.

export function apiSuccess(data?: unknown, status = 200) {
  return NextResponse.json({ success: true, data: data ?? null }, { status });
}

export function apiError(code: string, message: string, status = 400) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status },
  );
}

// Marcador para endpoints aún no implementados. La lógica real de estos
// recursos vive por ahora en la capa services (consumida desde los hooks);
// estos handlers dejan preparada la estructura /api/v1 versionada.
export function notImplemented() {
  return apiError(
    "NOT_IMPLEMENTED",
    "Endpoint no implementado todavía.",
    501,
  );
}
