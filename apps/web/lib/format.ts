// Utilidades de presentación (formato). No contienen lógica de negocio.

const dateFormatter = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const countFormatter = new Intl.NumberFormat("es", { notation: "compact" });

/** Fecha legible en español, p. ej. "3 jul 2026". */
export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return dateFormatter.format(date);
}

/** Cuenta compacta, p. ej. 1500 -> "1,5 mil". */
export function formatCount(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return countFormatter.format(value);
}

/** Iniciales (máx. 2) a partir de un nombre o correo, para avatares. */
export function getInitials(name: string): string {
  const base = name.includes("@") ? name.split("@")[0] : name;
  const words = base.trim().split(/[\s._-]+/).filter(Boolean);
  if (words.length === 0) return "?";
  const initials = words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "");
  return initials.join("") || "?";
}
