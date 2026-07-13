---
name: readhub-architecture-enforcer
description: Gate de arquitectura para el monorepo ReadHub — invocar ANTES de crear cualquier archivo nuevo, mover código entre apps/packages, agregar una llamada a Supabase, agregar una llamada a IA/HuggingFace, o crear un componente/hook/service. Activar con peticiones como "agrega una página/ruta nueva", "crea un componente que consulte datos", "agrega un service", "llama a la API de IA/HuggingFace", "crea un cliente de Supabase", "agrega una tool de MCP", o cualquier creación de archivo dentro de apps/ o packages/.
---

# ReadHub Architecture Enforcer

Esta skill es un filtro, no un linter de estilo. Se ejecuta antes de escribir código, no después. Solo verifica dónde vive el código y qué puede depender de qué — nunca calidad de código, naming ni estilo. Si una verificación falla, hay que detenerse y corregir la ubicación antes de seguir; no continuar con una ubicación arquitectónicamente incorrecta "por ahora".

La fuente de verdad para todo esto es el propio `CLAUDE.md` del repo. Si algo aquí parece contradecirlo, hay que releer `CLAUDE.md` — ese archivo tiene prioridad.

## 1. Límites del monorepo

Raíces permitidas: `apps/`, `packages/`, `supabase/`. Todo lo demás (docs, configuración) vive en archivos individuales en la raíz del repo.

- Nunca crear `src/`, `backend/`, `frontend/`, un `api/` a nivel raíz — este proyecto no está estructurado así, aunque "se sienta natural" viniendo de otros proyectos.
- Nunca inventar un `packages/*` nuevo sin una razón sólida — primero verificar si el código pertenece a un package existente: `types`, `config`, `database`, `ai`, `services`, `shared`.
- Solo crear una app nueva si el usuario lo pide explícitamente (por ejemplo, un segundo consumidor de los packages, como fue `apps/mcp`). Nunca agregar una de forma especulativa.
- Cada package exporta su código fuente directamente (`"./*": "./src/*.ts"`) — ningún package tiene export de barril `"."`. Se importa un archivo específico (`@readhub/services/article.service`), nunca la raíz del package.

## 2. Enrutamiento de Next.js (apps/web)

- Nunca crear un directorio `pages/` ni archivos `pages/*.tsx`. Esta app usa exclusivamente el App Router (`apps/web/app/`).
- Antes de escribir cualquier código específico de Next.js (rutas, layouts, server actions, route handlers), revisar `node_modules/next/dist/docs/` según indica `AGENTS.md` — este fork tiene cambios que rompen compatibilidad respecto al Next.js estándar. No asumir que aplican las convenciones habituales de Next.js.
- Los Route Handlers bajo `apps/web/app/api/v1/` son solo para trabajo que el navegador genuinamente no puede hacer: secretos (`POST /api/v1/chat`), paquetes exclusivos de Node o la service-role key (`POST /api/v1/articles/[id]/reindex`), o manejo de sesión por cookies (`/api/v1/auth/*`). No agregar un Route Handler nuevo para un CRUD ordinario que RLS más el cliente del navegador ya pueden resolver — verificar primero si algún hook ya lo hace antes de asumir que se necesita un endpoint REST (`apps/web/app/api/v1/articles/**` es una implementación paralela conocida y sin uso; no extenderla asumiendo que el frontend la llama).

## 3. Capas: Componente → Hook → Service → Base de datos

```
apps/web/components/   solo presentación — sin fetching de datos, sin llamadas directas a Supabase/IA
apps/web/hooks/         estado y orquestación del lado del cliente — llama a @readhub/services
packages/services/      lógica de negocio — la única capa autorizada a hablar directo con Supabase
packages/database/      solo factories del cliente de Supabase (sin lógica de negocio)
```

- Un componente nunca debe importar un cliente de Supabase, una función de `packages/services` que golpee la base de datos directamente sin pasar por un hook, ni `packages/ai`. Si un componente necesita datos, llama a un hook.
- Un componente nunca debe tener lógica de `.tsx`/JSX mezclada dentro de `packages/services` o `packages/ai` — esos packages son TS puro, sin React/JSX, sin `"use client"`.
- Los hooks llaman a funciones de `@readhub/services/*.service` y sostienen el estado resultante (loading/error/data). Los hooks no implementan reglas de negocio propias (por ejemplo, lógica manual de filtrado/validación que debería estar en un service).
- Los services aceptan un `SupabaseClient` inyectable (por defecto: el cliente del navegador desde `@readhub/database`), contienen la lógica de negocio real y devuelven datos planos — nunca JSX, nunca nada consciente de React.
- La única excepción a "componentes/hooks llaman a services, no a rutas": el conjunto reducido de Route Handlers realmente usados descrito en la sección 2. Incluso ahí, el Route Handler debe delegar en `packages/services`/`packages/ai`, no reimplementar la lógica inline.

## 4. packages/ai es el único lugar que conoce la forma de un proveedor de IA

- Nunca llamar a HuggingFace (ni a ninguna API de LLM/embeddings) directamente desde un componente, un hook, un Route Handler o código de `apps/mcp`. Ningún `fetch` crudo a un endpoint de inferencia fuera de `packages/ai/src/{embeddings,completion,prompts,document-extraction}.ts`.
- La cadena de llamadas siempre es `Componente → Hook → Service → packages/ai`. Un Route Handler (por ejemplo `/api/v1/chat`) puede ubicarse entre Hook y Service solo donde la sección 2 ya lo permite, pero igual debe llamar a `@readhub/ai`, no implementar las llamadas al proveedor por su cuenta.
- Los embeddings deben usar `InferenceClient.featureExtraction` de `@huggingface/inference` — no `fetch` crudo (el router compatible con OpenAI no soporta feature-extraction, y el endpoint clásico de inferencia está dado de baja).
- El código comentado de OpenAI/Claude en `embeddings.ts`/`completion.ts`/`packages/config/src/ai.ts` es intencional (facilita revertir el cambio) — no borrarlo ni tratarlo como código muerto que hay que limpiar.

## 5. Acceso a base de datos

- Nunca instanciar un cliente de Supabase nuevo de forma ad hoc (`createClient(...)`) dentro de un componente, hook, service o ruta. Reutilizar las factories de `packages/database` (`client.ts` cliente del navegador, `admin.ts` cliente con service role) o, para necesidades exclusivas de Next.js (`next/headers`, middleware), `apps/web/lib/supabase/server.ts` / `middleware.ts`.
- `admin.ts` (service role, evade RLS) nunca debe importarse en código `"use client"` — es exclusivo del servidor.
- `supabase/migrations/*.sql` es la fuente de verdad del esquema; `supabase/schema.sql` y `supabase/policies.sql` son copias de referencia mantenidas a mano — actualizar ambas, pero sin tratar las copias como autoritativas.

## 6. Servidor MCP (apps/mcp)

- Nunca implementar lógica del protocolo MCP (registro de tools/resources/prompts, manejo del transporte stdio) fuera de `apps/mcp`.
- `apps/mcp` es un segundo consumidor independiente de `packages/*` — nunca debe importar desde `apps/web`, y `apps/web` nunca debe importar desde `apps/mcp`.
- `apps/mcp` se empaqueta con `tsup`, no con Next.js — no agregarle supuestos del tipo `transpilePackages`.

## Checklist previo a escribir código

Antes de crear o mover un archivo, responder:

1. ¿Esto pertenece a `apps/` o a `packages/`? ¿A cuál existente — no a una raíz nueva?
2. Si es UI: ¿evita por completo importar data-fetching/Supabase/IA?
3. Si es un hook: ¿solo sostiene estado y delega la lógica a un service?
4. Si es lógica de negocio: ¿está en `packages/services`, con cliente inyectable, sin JSX?
5. Si toca un LLM/embeddings: ¿está únicamente en `packages/ai`, y todo lo demás llega a él vía Service → (Route Handler opcional) → `packages/ai`?
6. Si toca Supabase: ¿reutiliza las factories de `packages/database` / `apps/web/lib/supabase/` en lugar de crear un cliente nuevo?
7. Si es relacionado con MCP: ¿está únicamente dentro de `apps/mcp`?

Si alguna respuesta es "no", corregir la ubicación antes de escribir el código — no dejar una nota para arreglarlo después.
