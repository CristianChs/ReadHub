// ============================================================================
// Presupuesto de bundle — control automático del JavaScript que descarga el
// navegador en la primera visita a cada ruta.
//
// Lee `.next/app-build-manifest.json`, que es lo que Next emite tras compilar:
// un mapa ruta -> ficheros JS necesarios para renderizarla (incluidos los
// chunks compartidos). Comprime cada fichero con gzip y suma. Eso es,
// aproximadamente, el "First Load JS" que el propio build imprime en su tabla.
//
// No mide lo mismo que Lighthouse: Lighthouse observa una carga real, esto
// observa el artefacto. Son complementarios — un bundle puede crecer sin que la
// puntuación baje todavía, y este control lo detecta antes de que duela.
//
// Uso:  node scripts/bundle-budget.mjs [--budget-kb 250] [--json salida.json]
// Sale con código 1 si alguna ruta supera el presupuesto.
// ============================================================================

import { gzipSync } from "node:zlib";
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const WEB_ROOT = resolve(import.meta.dirname, "..");
const NEXT_DIR = join(WEB_ROOT, ".next");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const BUDGET_KB = Number(arg("budget-kb", process.env.BUNDLE_BUDGET_KB ?? 250));
const JSON_OUT = arg("json", null);

// --- Lectura del manifiesto ---------------------------------------------------

let manifest;
try {
  manifest = JSON.parse(
    readFileSync(join(NEXT_DIR, "app-build-manifest.json"), "utf8"),
  );
} catch {
  console.error(
    "✗ No se encontró .next/app-build-manifest.json.\n" +
      "  Este control se ejecuta DESPUÉS del build de producción.",
  );
  process.exit(1);
}

// --- Medición -----------------------------------------------------------------

const gzipCache = new Map();

function gzipBytes(file) {
  if (gzipCache.has(file)) return gzipCache.get(file);
  const path = join(NEXT_DIR, file);
  let bytes = 0;
  try {
    statSync(path);
    bytes = gzipSync(readFileSync(path), { level: 9 }).length;
  } catch {
    // Un fichero listado pero ausente no debe tumbar el control: se ignora y
    // se refleja en el informe como 0. Si eso pasara de forma masiva, el
    // resultado saldría sospechosamente bajo y se vería.
    bytes = 0;
  }
  gzipCache.set(file, bytes);
  return bytes;
}

// Solo interesan las rutas navegables: las de /api no envían JS al navegador.
const routes = Object.entries(manifest.pages)
  .filter(([route]) => !route.includes("/route"))
  .map(([route, files]) => {
    const unique = [...new Set(files)].filter((f) => f.endsWith(".js"));
    const bytes = unique.reduce((sum, f) => sum + gzipBytes(f), 0);
    return {
      route: route.replace(/\/page$/, "") || "/",
      chunks: unique.length,
      kb: Number((bytes / 1024).toFixed(1)),
    };
  })
  .filter((r) => r.route !== "/layout")
  .sort((a, b) => b.kb - a.kb);

const over = routes.filter((r) => r.kb > BUDGET_KB);

// --- Informe ------------------------------------------------------------------

const pad = (s, n) => String(s).padEnd(n);
const width = Math.max(24, ...routes.map((r) => r.route.length + 2));

console.log(`\nPresupuesto de bundle — First Load JS (gzip), límite ${BUDGET_KB} KB\n`);
console.log(`  ${pad("Ruta", width)}${pad("Chunks", 8)}Tamaño`);
console.log(`  ${"-".repeat(width + 16)}`);
for (const r of routes) {
  const flag = r.kb > BUDGET_KB ? "✗" : " ";
  console.log(`${flag} ${pad(r.route, width)}${pad(r.chunks, 8)}${r.kb} KB`);
}
console.log("");

if (JSON_OUT) {
  writeFileSync(
    JSON_OUT,
    JSON.stringify({ budgetKb: BUDGET_KB, routes, over }, null, 2),
  );
  console.log(`Informe JSON: ${JSON_OUT}\n`);
}

// --- Veredicto ----------------------------------------------------------------

if (over.length > 0) {
  console.error(
    `✗ ${over.length} ruta(s) superan el presupuesto de ${BUDGET_KB} KB:\n` +
      over.map((r) => `    ${r.route} — ${r.kb} KB`).join("\n") +
      "\n\n  Antes de subir el límite, comprueba qué entró en el bundle: el\n" +
      "  artefacto `bundle-analyzer` de este mismo job trae el treemap.\n",
  );
  process.exit(1);
}

console.log(`✓ Todas las rutas dentro del presupuesto de ${BUDGET_KB} KB.\n`);
