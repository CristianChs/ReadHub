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

### Pendiente

- **Claves `VOYAGE_API_KEY` y `ANTHROPIC_API_KEY`** — sin ellas el asistente no
  puede responder; el flujo se recorre entero pero falla en el proveedor.
- **Backfill**: los artículos publicados antes del indexador no están en la base
  vectorial. `POST /api/v1/articles/{id}/index` es idempotente; basta invocarlo
  una vez por artículo.
- **Calibrar el umbral de similitud** (`0.4`) contra el corpus real.
