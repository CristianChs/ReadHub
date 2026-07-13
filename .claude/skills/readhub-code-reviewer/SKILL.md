---
name: readhub-code-reviewer
description: Revisión de calidad de código, de solo lectura, para cambios en ReadHub — invocar cuando el usuario pida "revisa este código", "code review", "haz un review", o antes de dar un diff por terminado. Produce un informe estilo Pull Request de GitHub con calificación /10, errores críticos, errores importantes y mejoras sugeridas. Nunca edita archivos. Complementa a readhub-architecture-enforcer (ubicación) y es distinta de la skill genérica /code-review (no conoce ReadHub) — usar esta para verificaciones específicas del dominio de ReadHub (RLS, pipeline de RAG, límites de packages/ai).
---

# ReadHub Code Reviewer

De solo lectura. Esta skill nunca llama a Edit/Write. Inspecciona el diff o los archivos en cuestión y produce un informe. Si el usuario quiere que se apliquen las correcciones, debe pedirlo explícitamente (o usar `/code-review --fix` / `readhub-automatic-validator`) — esta skill solo reporta.

## Alcance de la revisión

### TypeScript

- `any` usado donde existe un tipo real derivable (de los tipos generados de Supabase en `packages/types/src/database.ts`, del tipo de retorno de un service, de esquemas Zod).
- `unknown` dejado sin acotar antes de usarse (sin type guard ni `zod.parse`) en lugar de acotarlo correctamente.
- Tipado incompleto: funciones exportadas sin tipo de retorno explícito donde la inferencia es ambigua, `@ts-ignore`/`@ts-expect-error` sin un comentario que explique el motivo.

### React

- Componentes que hacen demasiado (fetching de datos + lógica de negocio pesada + árbol de render grande) — marcar si un archivo `.tsx` mezcla responsabilidades que deberían estar en un hook o un service (contrastar con `readhub-architecture-enforcer`).
- Props innecesarias (props que atraviesan 2+ niveles sin usarse, o que duplican estado ya disponible en un context/hook).
- Mal uso de `useEffect`: arrays de dependencias faltantes o incorrectos, efectos usados para estado derivado (debería calcularse inline o con `useMemo`), efectos que en realidad deberían ser un event handler.
- Renderizados innecesarios: falta de memoización en valores derivados costosos que se pasan a hijos, objetos/arrays/funciones literales inline pasados como props a hijos memoizados, estado elevado más arriba de lo necesario.

### Next.js

Este fork — verificar contra `node_modules/next/dist/docs/` según AGENTS.md, no asumir el comportamiento estándar de Next.js.

- Errores en el límite server/client: APIs exclusivas de cliente dentro de un server component, o un componente marcado `"use client"` que no hace nada específico de cliente.
- Lógica de `fetch`/data-fetching duplicada que debería ser un hook o una llamada a un service compartidos, en lugar de estar copiada y pegada entre rutas/componentes.
- Route Handlers agregados para lógica que podría correr del lado del cliente vía un hook — contrastar con la nota de "dos caminos paralelos de acceso a datos" en `CLAUDE.md` (solo chat, reindex y auth son Route Handlers realmente usados).

### Supabase

- Consultas construidas con interpolación de strings sin sanitizar en lugar del query builder o parámetros de RPC (superficie de inyección SQL).
- Falta de consideración por RLS: ¿el código asume que puede leer/escribir filas que las políticas RLS de un usuario normal (no admin) no permitirían? ¿`admin.ts` se usa solo donde realmente se requiere acceso con service role?
- `select('*')` demasiado amplio donde claramente se necesita un subconjunto de columnas más acotado, o falta de `.limit()` en consultas potencialmente no acotadas.

### Performance

- Renders redundantes, fetches redundantes (mismos datos pedidos por el padre y por el hijo), patrones N+1, grandes volúmenes de datos cargados en memoria cuando existe una alternativa paginada/streaming.
- Duplicación: lógica copiada y pegada entre archivos en lugar de reutilizarse desde `packages/services` o `packages/shared`.

### Seguridad

- Secretos/claves/tokens hardcodeados en el código fuente (deberían ser `process.env.*`, listados en `apps/web/.env.example`, nunca commiteados con valores reales).
- `SUPABASE_SERVICE_ROLE_KEY` / `admin.ts` alcanzable desde código `"use client"`.
- Superficie de XSS: `dangerouslySetInnerHTML` sin sanitizar, contenido de usuario renderizado como HTML/markdown sin escapar.
- Superficie de inyección SQL (ver sección de Supabase).

### Arquitectura

- Delegar las verificaciones de ubicación/capas a las reglas de `readhub-architecture-enforcer` (raíces del monorepo, Componente→Hook→Service→Base de datos, aislamiento de packages/ai, sin clientes de Supabase nuevos, aislamiento de MCP). Señalar las violaciones encontradas, pero sin volver a derivar las reglas aquí — citarlas.
- Higiene de imports: importar los archivos internos de un package en lugar de su export declarado (`@readhub/services/article.service`, nunca un import de la raíz del package, ya que no existe export de barril `"."`).

## Formato de salida

Siempre terminar con un informe en esta forma:

```
## Revisión de código ReadHub

Calificación: X.X/10

### Errores críticos
- [archivo:línea] — problema, por qué es crítico, escenario concreto de falla

### Errores importantes
- [archivo:línea] — problema, por qué importa

### Mejoras sugeridas
- [archivo:línea] — mejora opcional, justificación
```

- Si una sección está vacía, escribir "Ninguno" en lugar de omitir el encabezado.
- Cada hallazgo necesita un archivo:línea y una razón concreta, no un vago "podría ser mejor".
- La calificación refleja severidad, no cantidad de hallazgos: un solo error crítico (fuga de secreto, bypass de RLS, inyección SQL) limita la calificación muy por debajo de 5/10 sin importar qué tan limpio esté el resto.
