# ReadHub

Plataforma de publicación y lectura de artículos (estilo Medium/Dev.to) con un
**asistente conversacional RAG** que responde únicamente con el conocimiento
publicado en la propia plataforma y cita sus fuentes.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · TailwindCSS ·
Shadcn/UI · Supabase (Auth, Postgres, Storage) · **pgvector** · **Claude** ·
**Voyage AI** (embeddings).

---

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # completar las claves
npm run dev
```

### Variables de entorno

| Variable | Ámbito | Necesaria para |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | cliente | todo |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | cliente | todo |
| `VOYAGE_API_KEY` | **solo servidor** | indexación y búsqueda semántica |
| `ANTHROPIC_API_KEY` | **solo servidor** | respuestas del asistente |

> Las claves de RAG **no llevan** prefijo `NEXT_PUBLIC_`: Next solo inyecta en el
> bundle del navegador las variables con ese prefijo, de modo que nunca pueden
> filtrarse al cliente.

> **⚠️ Registro → Login inmediato.** Si Supabase tiene *"Confirm email"* activado,
> el usuario debe confirmar el correo antes de iniciar sesión. Desactívalo en
> **Authentication → Sign In / Providers → Email**. La app soporta ambos modos.

---

## Arquitectura

Dos cadenas coexisten. La segunda existe porque las claves de los proveedores
de IA **no pueden llegar al navegador**:

```
CRUD:  Componentes → Hooks → Services → Supabase
RAG:   Componentes → Hooks → Route Handlers → Services → Supabase / Claude / Voyage
```

```
readhub/
├── app/
│   ├── (auth)/            login, register
│   ├── (dashboard)/       home, upload, article/[id], assistant
│   └── api/v1/
│       ├── chat/                      POST  → flujo RAG en streaming (NDJSON)
│       └── articles/[id]/index/       POST  → indexación vectorial
├── components/
│   ├── chat/              ventana, mensaje, entrada, fuentes, carga
│   └── ui, layout, forms, cards, navigation, dialogs, comments, articles
├── hooks/                 useAuth · useArticles · useComments · useLikes
│                          useUpload · useChat
├── services/              auth · article · comment · storage
│                          embedding · indexing · vector-search
│                          context-builder · chat
├── lib/
│   ├── ai/                claude.ts · embeddings.ts · prompts.ts
│   ├── text/              extract-document.ts   (TXT · PDF · DOCX)
│   ├── supabase/          clientes browser/server/middleware
│   └── api/               responses.ts · indexing.ts
├── types/                 article · auth · chat · comment · database
│                          embedding · user · vector-search
└── supabase/migrations/   esquema, RLS, vistas, buckets, pgvector
```

### Responsabilidad de cada módulo RAG

| Módulo | Responsabilidad única | No hace |
|---|---|---|
| `lib/ai/embeddings.ts` | Único que conoce **Voyage AI** | nada de dominio |
| `lib/ai/claude.ts` | Único que importa el **SDK de Anthropic** | nada de RAG |
| `lib/ai/prompts.ts` | Plantillas del prompt | lógica |
| `lib/text/extract-document.ts` | Bytes → texto plano | red, BD |
| `embedding.service` | Componer, fragmentar, validar, persistir vectores | buscar |
| `indexing.service` | Obtener contenido y delegar la vectorización | generar embeddings |
| `vector-search.service` | Búsqueda por similitud (pgvector) | construir contexto |
| `context-builder.service` | Seleccionar, ordenar, acotar, citar. **Función pura** | buscar, llamar al LLM |
| `chat.service` | **Orquestar** el flujo RAG | recuperar, vectorizar |

### Flujo del sistema

```
Publicar artículo → useUpload → POST /api/v1/articles/{id}/index
                                  ├─ storage.download + extract (TXT/PDF/DOCX)
                                  └─ embedding.service → pgvector

Preguntar → useChat → POST /api/v1/chat  (NDJSON en streaming)
                        └─ chat.service
                             ├─ vector-search  → embedding.service → Voyage
                             │                 → rpc match_article_chunks (HNSW)
                             ├─ context-builder → prompt + fuentes
                             └─ lib/ai/claude   → respuesta con citas [n]
```

---

## Decisiones arquitectónicas relevantes

1. **Tabla de fragmentos, no columna de vector.** `article_embeddings` es 1:N con
   `articles`. Permite citar a nivel de fragmento y admite documentos largos.
2. **Índice HNSW, no IVFFlat.** IVFFlat requiere datos para entrenarse y hay que
   reconstruirlo al crecer; HNSW se construye incrementalmente y sirve desde la
   tabla vacía.
3. **`match_article_chunks` es `SECURITY DEFINER` y filtra `is_public`.** Es la
   *única* puerta de lectura del índice: la RLS impide leer la tabla
   directamente, así que un borrador ajeno nunca puede recuperarse.
4. **Sin `SUPABASE_SERVICE_ROLE_KEY` en la app.** La indexación escribe con la
   sesión del usuario; la RLS exige ser el autor del artículo.
5. **Cabecera de contexto al vectorizar, no al almacenar.** Cada fragmento se
   vectoriza con `Título: …` antepuesto (ancla semántica), pero se almacena
   desnudo: el título se reensambla al recuperar y no gasta tokens dos veces.
6. **Cortocircuito anti-alucinación.** Si no hay contexto relevante, `chat.service`
   devuelve la frase canónica **sin llamar al modelo**. La regla "no inventar" no
   depende de que el LLM obedezca.
7. **Indexación no bloqueante.** Publicar nunca falla porque falle la indexación;
   la operación es idempotente (`delete` + `insert`, con `unique(article_id, chunk_index)`).
8. **Vectores huérfanos imposibles.** `ON DELETE CASCADE` desde `articles`.
9. **Independencia de proveedor.** Sustituir Voyage o Claude implica reescribir
   **un solo archivo** en `lib/ai/`.

---

## Rendimiento

Las optimizaciones aplicadas afectan a la **entrega** (qué descarga el navegador
y en qué orden), no al renderizado ni a la lógica. La aplicación sigue obteniendo
sus datos desde el cliente; eso está documentado abajo como deuda consciente.

### Estrategias implementadas

| Estrategia | Dónde | Qué resuelve |
|---|---|---|
| **Fuentes auto-alojadas** (`next/font`) | `app/layout.tsx` | Inter y Lora estaban *declaradas* en `globals.css` pero **nunca se cargaban**: la app caía al fallback del sistema en silencio |
| **Imágenes optimizadas** (`next/image`) | `article-card.tsx`, `article-header.tsx` | Portadas servidas en tamaño original, sin `srcset` ni AVIF/WebP |
| **Prioridad de carga** | `article-list.tsx` (3 primeras), `article-header.tsx` | La imagen candidata a LCP estaba marcada `loading="lazy"` |
| **Límites de Suspense** | `loading.tsx`, `error.tsx` | El esqueleto solo aparecía **tras hidratar**; hasta entonces, pantalla en blanco |
| **Memoización del chat** | `chat-message.tsx` | Cada token del streaming repintaba la conversación **entera** |
| **Scroll en `requestAnimationFrame`** | `chat-window.tsx` | Una animación de scroll **por token**, cancelándose entre sí |

### Efecto sobre Core Web Vitals

**LCP** — Es donde está la mejora mayor. La portada del artículo (elemento LCP
del detalle) pasa de `<img>` diferido y sin optimizar a `next/image` con
`priority`: se precarga en vez de descubrirse al hidratar, y llega convertida y
redimensionada al ancho real del dispositivo. Las tres primeras tarjetas del
listado reciben el mismo trato porque una de ellas *es* el LCP en escritorio.

**CLS** — `next/font` calcula el `size-adjust` de la fuente de respaldo para que
sus métricas coincidan con las de Inter y Lora: el intercambio ocurre **sin
desplazar una línea de texto**. Los contenedores de imagen ya reservaban su hueco
con `aspect-ratio`, y `fill` lo respeta.

**INP** — La pantalla que lo gobierna es el asistente. Memoizar `ChatMessage` y
agrupar el scroll en un frame libera el hilo principal durante el streaming, que
es justo cuando el usuario puede querer escribir o pulsar «Detener».

**FCP** — Los `loading.tsx` emiten el esqueleto en el HTML del servidor,
reutilizando los mismos componentes que ya usaba el estado de carga del hook. Hay
contenido en pantalla **sin esperar a JavaScript**.

> **Techo conocido.** El inicio y el detalle siguen siendo Client Components que
> descargan sus datos tras hidratar: el HTML del servidor no contiene ni un título
> de artículo. Convertirlos a Server Components es la mejora de LCP más grande que
> queda pendiente, y es un cambio de arquitectura de renderizado — deliberadamente
> fuera del alcance de las optimizaciones de entrega.

### Buenas prácticas para mantenerlo

1. **Toda imagen entra por `next/image`.** Si aparece un `<img>` con un
   `eslint-disable` encima, es una regresión disfrazada de excepción — que es
   exactamente cómo llegaron las dos que había.
2. **Quien pinta una lista decide la prioridad.** El componente hijo no sabe si
   está sobre el pliegue; el padre sí. Por eso `priority` es una prop de
   `ArticleCard`, no una decisión interna suya.
3. **Una ruta nueva trae su `loading.tsx`.** Es el coste de diez líneas por no
   dejar la pantalla en blanco mientras el segmento resuelve.
4. **Antes de subir el presupuesto de bundle, mira el treemap.** Está en el
   artefacto del pipeline. Subir el límite es la última opción, no la primera.
5. **Un componente que se re-renderiza en un bucle de streaming va memoizado.**
   La regla no es «memoizar todo»: es memoizar lo que el padre repinta sin que
   sus props cambien.
6. **Las fuentes se cargan con `next/font`, nunca con `@import`.** Un `@import` a
   un CDN de fuentes reintroduce la petición bloqueante a un tercero que
   `next/font` existe para eliminar.

---

## Integración continua y despliegue

Pipeline en `.github/workflows/ci.yml`. Cuatro jobs encadenados: **cada uno solo
arranca si el anterior pasó**.

```
checks ──▶ e2e ──▶ performance ──▶ deploy
                        ▲              ▲
                  gate de rendimiento  solo en push a main
```

| Job | Qué hace | Bloquea |
|---|---|---|
| `checks` | TypeScript · ESLint · Vitest (258 pruebas, con cobertura) | todo lo demás |
| `e2e` | Playwright contra un **Supabase local y efímero** (Docker + CLI) | `performance` |
| `performance` | Build de producción → presupuesto de bundle → Lighthouse | **el despliegue** |
| `deploy` | Vercel, **solo** en `push` a `main` | — |

### El job de rendimiento

Se ejecuta **después** de las pruebas por una razón: medir la velocidad de una
aplicación que aún no se sabe si es correcta no significa nada. Un LCP excelente
sobre una pantalla rota sigue siendo una pantalla rota.

Compila **una sola vez** el build de producción, y de ese mismo artefacto salen
los tres controles:

1. **Presupuesto de bundle** — `scripts/bundle-budget.mjs` lee el
   `app-build-manifest.json` que emite Next, comprime cada chunk con gzip y suma
   por ruta. Falla por encima de **220 KB** de First Load JS. Detecta una
   regresión de peso *antes* de que llegue a notarse en la puntuación.
2. **Lighthouse** — Levanta `next start`, audita `/login` y `/register` **tres
   veces cada una** (la mediana absorbe el ruido del runner) y verifica los
   umbrales de `lighthouserc.json`.
3. **Treemap** — El build corre con `ANALYZE=true`, que activa
   `@next/bundle-analyzer`. Un build normal no cambia en nada.

Umbrales que **bloquean el despliegue**:

| Métrica | Umbral | Core Web Vital |
|---|---|---|
| Performance (score) | ≥ 0.90 | — |
| Largest Contentful Paint | ≤ 2500 ms | **LCP** |
| Cumulative Layout Shift | ≤ 0.1 | **CLS** |
| Total Blocking Time | ≤ 300 ms | proxy de **INP** |

> **El INP no se puede medir en laboratorio**: requiere interacción real. El TBT
> es su sustituto —mide cuánto queda bloqueado el hilo principal— y es lo mejor
> que se obtiene sin datos de campo. Para INP real haría falta RUM, no CI.

**Cobertura de la auditoría:** solo `/login` y `/register`, las únicas rutas
públicas. El listado de artículos —la pantalla con el LCP más caro— **no está
cubierta**. Se resuelve con un `puppeteerScript` que se autentique contra el
Supabase efímero antes de medir; queda como siguiente paso.

### Reportes

El artefacto `performance-report` se publica **siempre**, también cuando el job
falla: es lo que explica *por qué* no se cumplió el umbral.

| Fichero | Cómo leerlo |
|---|---|
| `lighthouse-report/*.html` | Ábrelo en el navegador. Bloque *Metrics* (LCP/CLS/TBT con color) y luego *Opportunities*, ordenadas por milisegundos ahorrados |
| `bundle-report.json` | Tabla ruta → KB gzip, de mayor a menor, con el presupuesto y las rutas que lo superan |
| `.next/analyze/client.html` | Treemap. Cada rectángulo es un módulo, proporcional a su peso. Es donde se ve que una librería entera se coló en el bundle del cliente |

### Despliegue en Vercel

Solo en **push a `main`**. Un Pull Request ejecuta las auditorías completas pero
**no publica**: el pipeline dice si la rama es desplegable, sin desplegarla.

Se compila en el runner y se sube con `--prebuilt` en lugar de dejar que Vercel
recompile: así se despliega **exactamente el commit que pasó las auditorías**, y
no una recompilación posterior que nadie ha verificado.

**Secretos** (GitHub → *Settings → Secrets and variables → Actions*):

| Secreto | De dónde sale |
|---|---|
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens |
| `VERCEL_ORG_ID` | `.vercel/project.json` tras `vercel link`, o Team Settings → General |
| `VERCEL_PROJECT_ID` | mismo sitio |

**Las claves de aplicación no van aquí.** `vercel pull` descarga las variables de
entorno del proyecto directamente de Vercel, que es su sitio: se configuran una
vez en **Vercel → Project → Settings → Environment Variables** y el pipeline nunca
las ve.

| Variable en Vercel | Ámbito |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | cliente |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | cliente |
| `VOYAGE_API_KEY` | **solo servidor** |
| `GROQ_API_KEY` | **solo servidor** |

Con esto, el workflow mantiene la propiedad que ya tenía: **no contiene ni un
secreto de aplicación**. El E2E se autentica contra un Supabase local cuyas claves
son públicas por diseño, y el despliegue delega las suyas en Vercel.

---

## Dependencias

| Paquete | Para qué |
|---|---|
| `@supabase/supabase-js`, `@supabase/ssr` | Auth, Postgres, Storage |
| `@anthropic-ai/sdk` | Generación de respuestas (Claude) |
| `unpdf`, `mammoth` | Extracción de texto de PDF y DOCX |
| `@radix-ui/*`, `class-variance-authority`, `tailwind-merge`, `lucide-react` | Sistema de diseño |

Los embeddings usan la **API HTTP** de Voyage AI; no requieren SDK.

---

## Base de datos

```bash
supabase db reset      # aplica migraciones + seed
```

Objetos del RAG: extensión `vector`, tabla `article_embeddings`
(FK `ON DELETE CASCADE`, `unique(article_id, chunk_index)`), índice **HNSW**
con `vector_cosine_ops` y la función `match_article_chunks`.

---

## Estado

MVP completo (registro, login, artículos, Storage, comentarios, likes) **más el
sistema RAG completo**: infraestructura vectorial, embeddings, indexación
automática, búsqueda semántica, constructor de contexto, servicio conversacional
e interfaz del asistente con streaming y fuentes citables.

**Calidad y entrega:** 258 pruebas unitarias (Vitest), 9 pruebas E2E (Playwright),
pipeline de CI con auditoría de rendimiento y despliegue automático a Vercel
bloqueado por umbrales.

### Comandos

```bash
npm run test              # Vitest — los 6 proyectos del monorepo
npm run test:coverage     # + informe de cobertura consolidado
npm run test:e2e          # Playwright (requiere la app y Supabase en marcha)

cd apps/web
npm run build             # build de producción
npm run bundle:budget     # presupuesto de First Load JS (tras el build)
npm run lighthouse        # auditoría local de Lighthouse
ANALYZE=true npm run build   # + treemap del bundle en .next/analyze/
```

### Pendiente

- **Claves `VOYAGE_API_KEY` y `ANTHROPIC_API_KEY`** — sin ellas el asistente no
  puede responder; el flujo se recorre entero pero falla en el proveedor.
- **Backfill**: los artículos publicados antes del indexador no están en la base
  vectorial. `POST /api/v1/articles/{id}/index` es idempotente; basta invocarlo
  una vez por artículo.
- **Calibrar el umbral de similitud** (`0.4`) contra el corpus real.
- **Rendimiento:** migrar el inicio y el detalle a Server Components (el mayor
  margen de LCP que queda) y extender Lighthouse a las rutas autenticadas.
- **Calibrar los umbrales de Lighthouse** contra la primera ejecución real en el
  runner: hoy son una foto del proyecto, no una ley.
