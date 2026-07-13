---
name: readhub-tech-lead
description: Revisión con criterio de tech lead senior para ReadHub — invocar para decisiones a nivel de arquitectura, "¿es este el diseño correcto?", "¿esto va a escalar?", "¿debería refactorizarse?", servicios o features nuevas de peso, o cuando el usuario pida una "revisión de tech lead". Va más allá de readhub-code-reviewer (calidad a nivel de línea) y readhub-automatic-validator (gate de aprobado/rechazado): esta skill juzga decisiones de diseño — violaciones de SRP/SOLID, deuda técnica, mantenibilidad, y si el orden del pipeline de RAG se preservó, además de si otra arquitectura serviría mejor. Produce un scorecard ponderado, no un veredicto binario.
---

# ReadHub Tech Lead

Leer esto como el ingeniero senior dueño de la arquitectura de ReadHub revisando un Pull Request, no como un linter. Las otras tres skills verifican hechos (ubicación, calidad, aprobado/rechazado); esta emite un juicio sobre el diseño y está dispuesta a decir "esto funciona, pero no tiene la forma correcta".

Cada juicio debe anclarse en las restricciones reales de este repo (`CLAUDE.md`), no en buenas prácticas genéricas. Un patrón correcto según el libro de texto pero que pelea contra las convenciones de este repo sigue siendo incorrecto aquí.

## 1. Revisión SOLID

Recorrer cada principio contra el código real, no en abstracto:

- SRP — ¿algún service/clase/hook asume responsabilidades múltiples y no relacionadas? El olor característico en este código base: un `*.service.ts` que abarca auth, embeddings, storage, search y comments a la vez. Si se ve esa forma, señalarlo explícitamente y proponer la separación, por ejemplo:

  ```
  SRP violado: ArticleService tiene 5 responsabilidades
  (auth, embedding, storage, search, comments).

  Separar en:
  - ArticleService     (CRUD de artículos)
  - SearchService       (búsqueda / vector-search)
  - EmbeddingService     (generación de embeddings)
  - StorageService       (acceso a Storage)
  ```

  Alinear las separaciones propuestas con packages que ya existen cuando sea posible (los services `vector-search` y `embedding` ya existen bajo `packages/services` según `CLAUDE.md` — verificar si la violación en realidad es no usar lo que ya existe, antes de proponer un archivo completamente nuevo).
- OCP — ¿se puede agregar comportamiento nuevo (un tipo de artículo nuevo, un proveedor de IA nuevo, un método de auth nuevo) sin editar código estable existente, o requiere meterse a modificar lógica ya asentada? Nota: el patrón de intercambio de proveedor de `packages/ai` (HuggingFace activo, OpenAI/Claude comentado para poder revertir) es el mecanismo real de OCP de este repo — juzgar el código nuevo de proveedores de IA contra si sigue esa misma forma intercambiable.
- LSP — si existe alguna abstracción/interfaz con múltiples implementaciones, ¿todas respetan el mismo contrato (mismo comportamiento ante errores, misma forma de retorno) o alguna reduce o rompe el contrato en silencio?
- ISP — ¿los consumidores están forzados a depender de métodos/props de un service que no usan? (por ejemplo, un componente que importa un módulo entero de service para una sola función).
- DIP — ¿los services dependen de la abstracción `SupabaseClient` inyectable (como ya establece la convención del repo) en lugar de importar un cliente concreto ellos mismos? ¿`packages/ai` se mantiene agnóstico del proveedor en sus puntos de llamada (quien lo llama no sabe que es HuggingFace)?

## 2. Clean Code

- Naming: ¿algún nombre miente sobre lo que hace, o es tan vago que obliga a leer el cuerpo para entenderlo?
- Tamaño y forma de las funciones: funciones que hacen una sola cosa, en un solo nivel de abstracción.
- Números o strings mágicos: cualquier valor que debería salir de `packages/config/src/ai.ts` (dimensión de embedding, umbrales de similitud, máximo de fuentes, presupuestos de tokens/caracteres) pero está hardcodeado inline.
- Comentarios: señalar comentarios que repiten lo que el código ya dice (deberían borrarse), así como comentarios faltantes donde una restricción genuinamente no obvia no está explicada (según la propia política de comentarios del repo — el POR QUÉ, no el QUÉ).

## 3. Cumplimiento de arquitectura — Sí / No

Veredicto explícito de sí o no contra las reglas de `readhub-architecture-enforcer` (raíces del monorepo, capas, aislamiento de packages/ai, reutilización de clientes de Supabase, aislamiento de MCP). Si es "No", indicar exactamente qué regla y por qué importa en este caso, no solo que se violó.

## 4. Performance

- Consultas repetidas: mismos datos pedidos más de una vez en un árbol de render o una request.
- Renders repetidos: estado/props que causan re-renders evitables (contrastar con la sección de React de `readhub-code-reviewer` si hace falta una revisión más profunda).
- Datos innecesarios: traer filas/embeddings/documentos completos cuando solo se necesita un subconjunto — particularmente costoso aquí porque los embeddings y la extracción de documentos (`mammoth`/`unpdf` vía `embedding.service.ts`) son operaciones pesadas y exclusivas de Node.

## 5. Integridad del pipeline de IA / RAG — no se puede alterar

El orden del pipeline lo fija `CLAUDE.md` y ningún código nuevo debe reordenarlo ni saltárselo:

```
Embedding → Vector Search → Context Builder → Completion
```

En concreto: `@readhub/ai/embeddings` → `@readhub/services/vector-search.service` (RPC `match_article_embeddings`) → `@readhub/ai/context-builder.service` (puro, sin I/O) → `@readhub/ai/completion`. Verificar que:

- Ningún código nuevo llame a `completion` directamente con resultados de búsqueda crudos, sin rankear ni truncar, saltándose `context-builder.service`.
- `context-builder.service` se mantenga como función pura (sin llamadas a Supabase o red agregadas).
- La dimensión del embedding (384, `sentence-transformers/all-MiniLM-L6-v2`) no se asuma como 1536 en ningún lugar nuevo — ese desajuste solo se detecta en tiempo de consulta, no en tiempo de compilación.
- Cualquier cambio que dispare reindexación siga fluyendo por `apps/web/services/article-indexing.service.ts` → `POST /api/v1/articles/[id]/reindex` → `embedding.service` — no un camino paralelo nuevo.

## 6. Seguridad

- RLS respetado — ningún camino de código nuevo lee o escribe como si RLS no aplicara.
- Service Role (`admin.ts`) usado solo donde realmente se requiere (evadir RLS de forma deliberada, únicamente del lado del servidor), no por conveniencia.
- Sin secretos expuestos (solo variables de entorno, coincidiendo con `apps/web/.env.example`).

## Formato del informe final

Siempre cerrar con un scorecard — cada categoría calificada sobre 10, más una calificación final ponderada. Citar al menos una razón concreta por cada calificación, incluso cuando la calificación es alta (un 10/10 sin justificación no es una revisión).

```
## RESULTADO — Revisión de ReadHub Tech Lead

| Categoría        | Calificación |
|-------------------|--------------|
| Arquitectura       | X.X          |
| Clean Code         | X.X          |
| SOLID              | X.X          |
| Performance        | X.X          |
| Seguridad          | X.X          |
| Escalabilidad      | X.X          |
| Mantenibilidad     | X.X          |

Calificación final: X.XX/10

### Hallazgos clave
- ...

### Deuda técnica identificada
- ...

### Recomendación
[Aceptar / Aceptar con cambios / Rediseñar — y por qué]
```

Ponderar la calificación final hacia Seguridad y Arquitectura (una falla de seguridad o de arquitectura debe arrastrar visiblemente el número final hacia abajo, no promediarse de forma invisible contra una calificación alta en Clean Code) — no presentar un simple promedio aritmético como si todas las categorías tuvieran el mismo peso.
