# Cómo consultar el conocimiento de ReadHub

> **No existe un servidor MCP propio de ReadHub.** El único MCP configurado en
> el proyecto es el oficial de Supabase (`.mcp.json`). No inventes herramientas
> como `readhub_search`: no existen.

Hay tres caminos. Usa el primero que esté disponible y **di cuál usaste**.

---

## Camino 1 — Asistente RAG (preferido)

Es el sistema de recuperación que ya existe en ReadHub. **Úsalo en vez de
reimplementar búsqueda semántica.** Devuelve fuentes citadas.

**Precondiciones:** la app corriendo (`npm run dev`), sesión iniciada,
`VOYAGE_API_KEY` y `ANTHROPIC_API_KEY` configuradas.

```
POST /api/v1/chat
Content-Type: application/json
Cookie: <sesión de Supabase>

{"query": "¿qué se ha publicado sobre estimación en equipos ágiles?"}
```

Responde **NDJSON** (una línea JSON por evento):

```
{"type":"meta","query":"...","hasContext":true,"sources":[{"rank":1,"articleId":"…","title":"…","similarity":0.71,"url":"/article/…"}]}
{"type":"delta","text":"Según "}
{"type":"delta","text":"[1], la estimación…"}
{"type":"done","metadata":{"llmInvoked":true,"chunksUsed":4,…}}
```

Cómo leerlo:
- `meta` llega **primero**: ahí están las **fuentes**. Úsalas para citar.
- Si `hasContext` es `false`, **no hay nada publicado sobre eso**. Es una
  respuesta válida y valiosa: significa que el hueco existe.
- `error` significa fallo del proveedor. No lo interpretes como "no hay nada".

---

## Camino 2 — SQL de solo lectura (`mcp__supabase__execute_sql`)

Búsqueda **léxica**, no semántica. Sirve cuando el RAG no está disponible o
cuando quieres un barrido exhaustivo por término exacto.

**Solo `SELECT`. Solo `is_public = true`.**

### Artículos relacionados por título o resumen

```sql
select id, title, summary
from public.articles
where is_public = true
  and (title ilike '%scrum%' or coalesce(summary,'') ilike '%scrum%')
order by created_at desc
limit 10;
```

### Búsqueda dentro del texto indexado

Requiere que los artículos estén indexados (tabla `article_embeddings`).
Devuelve el fragmento donde aparece el término, útil para **detectar
contradicciones** y ver el contexto exacto.

```sql
select a.id, a.title, e.chunk_index, left(e.content, 300) as fragmento
from public.article_embeddings e
join public.articles a on a.id = e.article_id
where a.is_public = true
  and e.content ilike '%estimación%'
order by a.created_at desc, e.chunk_index
limit 10;
```

### Comprobar si el corpus está indexado

Si esto devuelve 0, la búsqueda por contenido no encontrará nada aunque el
artículo exista. **Dilo**, no concluyas que "no hay nada publicado".

```sql
select
  (select count(*) from public.articles where is_public) as publicos,
  (select count(distinct article_id) from public.article_embeddings) as indexados;
```

---

## Camino 3 — Sin acceso

Si ni el RAG ni el MCP responden:

> "No he podido consultar ReadHub, así que no sé si esto ya está publicado.
> Continúo con el resto y lo verificamos cuando haya acceso."

**Nunca** rellenes el hueco con conocimiento propio presentándolo como si
viniera de ReadHub.

---

## Cómo interpretar los resultados

| Observación | Lectura |
|---|---|
| Varios artículos con solape alto | Riesgo de duplicar. Fuerza al autor a definir su aportación diferencial |
| Un artículo afirma lo contrario | **Contradicción**: material valioso. El autor debe abordarla y citarla, no ignorarla |
| Nada relevante, y el corpus **sí** está indexado | Hueco real. Es un buen argumento para publicar |
| Nada relevante, y el corpus **no** está indexado | No concluyas nada. Dilo |

## Cómo citar

Siempre: **título + enlace**.

> Esto ya se trata en [Estadística Descriptiva](/article/f9742aad-…), que define
> la mediana en el mismo sentido que tu sección 2.
