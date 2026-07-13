# @readhub/mcp

Servidor **MCP (Model Context Protocol)** de ReadHub. Expone el conocimiento de
la plataforma a clientes MCP (Claude Desktop, Claude Code, etc.).

> **Estado: 11 Tools (5 de consulta + 6 de análisis) + 5 Resources + 5 Prompts.**
> Todo delega en los paquetes compartidos del monorepo.

## Tools

**Consulta** — leer y buscar artículos:

| Tool | Responsabilidad | Delega en |
|---|---|---|
| `list_articles` | Catálogo de artículos públicos, del más reciente al más antiguo. | `articleService.list` |
| `get_article` | Un artículo por su `id`, con el nombre del autor si es legible. | `articleService.getById` + `authService.getAuthorNames` |
| `search_articles` | Búsqueda **léxica**: coincidencias literales en título o resumen. | `articleService.search` |
| `semantic_search_articles` | Búsqueda **semántica**: fragmentos relevantes por significado. | `vectorSearchService.search` |
| `ask_readhub` | Pipeline RAG completo: respuesta redactada con fuentes citadas. | `chatService.ask` |

**Análisis multi-documento** — convierten ReadHub en una base de conocimiento
para LLMs. Trabajan sobre el TEXTO REAL de los documentos (`rag.articleContent`)
y la matemática de texto de `@readhub/shared` (tokenización, TF-IDF, coseno):

| Tool | Responsabilidad | Núcleo |
|---|---|---|
| `compare_multiple_articles` | Matriz de similitud léxica entre 2-8 artículos (par más/menos parecido, media). | `cosineSimilarity` |
| `find_similarities_and_differences` | Términos compartidos vs. distintivos de cada artículo. | `documentFrequencies` + `tfidfKeywords` |
| `extract_main_topics` | Temas principales de un conjunto o de toda la plataforma. | frecuencia × amplitud |
| `generate_global_summary` | Ensambla temas comunes + resúmenes + extractos para una síntesis global. | agregación léxica |
| `map_document_relationships` | Grafo de relaciones (aristas por umbral de similitud, términos conectores). | `cosineSimilarity` |
| `build_research_context` | Dosier de investigación sobre un tema, con fuentes citadas. | semántica → **degrada a léxica** |

Todas son `readOnlyHint: true`. Llevan `openWorldHint: true` las que pueden
llamar a proveedores externos de pago (`ask_readhub`, `semantic_search_articles`
y `build_research_context`, que intenta la vía semántica antes de degradar); el
resto, `openWorldHint: false` — son deterministas y locales.

### Por qué el análisis es determinista (léxico) y no solo semántico

El núcleo del análisis mide **solapamiento de vocabulario** (TF-IDF + coseno),
no significado. Es una decisión, no una carencia:

- **Funciona sin claves ni embeddings.** El análisis rinde hoy, contra el corpus
  real, sin depender de Voyage/Groq ni de que los artículos estén indexados.
- **Es determinista y verificable.** Los mismos artículos dan los mismos números,
  comprobables en una prueba.
- **Complementa la semántica, no la sustituye.** Donde hay embeddings, la vía
  semántica los aprovecha (`build_research_context`, `semantic_search_articles`,
  `ask_readhub`). El análisis léxico es la capa que siempre está disponible.

### Convenciones

- **Ninguna Tool habla con Supabase ni con los SDK de IA.** Reciben el contexto
  y delegan. La lógica vive en `@readhub/services` y `@readhub/rag`.
- Un resultado vacío o un artículo inexistente **no son errores**: `get_article`
  devuelve `found: false` y `ask_readhub` devuelve `hasContext: false`. Marcarlos
  como error obligaría al modelo a interpretar un fallo donde la respuesta
  correcta es "no hay nada".
- Los fallos reales se devuelven con `isError: true` y un mensaje legible, no
  como excepción: así el modelo puede corregir el rumbo.
- Añadir una Tool es crear un fichero `*.tool.ts` que exporte un `ToolRegistrar`
  y añadirlo al array de `tools/index.ts`. No se toca el servidor.

### Límites conocidos

- `semantic_search_articles` y `ask_readhub` requieren `VOYAGE_API_KEY` /
  `GROQ_API_KEY` **y** artículos indexados. Sin ellos devuelven un
  `isError` explicando qué falta.

## Resources

Datos estructurados navegables (`application/json`). Colecciones fijas más
plantillas por entidad, para listar y para profundizar.

| URI | Expone | Delega en |
|---|---|---|
| `readhub://overview` | Qué es ReadHub, cifras rápidas e índice de Resources. | `articleService.list` |
| `readhub://stats` | Totales, reparto por categoría, top artículos y autores. | `articleService.list` + `categoryService.listWithCounts` |
| `readhub://articles` | Colección de artículos públicos. | `articleService.list` |
| `readhub://articles/{id}` | Un artículo, con el nombre de su autor. | `articleService.getById` + `authService.getAuthorNames` |
| `readhub://authors` | Autores con artículos públicos y su actividad. | `articleService.list` + `authService.getAuthorNames` |
| `readhub://authors/{id}` | Un autor y sus artículos. | ídem |
| `readhub://categories` | Catálogo de categorías, con nº de artículos. | `categoryService.listWithCounts` |
| `readhub://categories/{slug}` | Una categoría y sus artículos. | `categoryService.list` + `articleService.list` |

Las tres plantillas (`{id}` / `{slug}`) tienen callback `list`, así que sus
instancias concretas aparecen también en `resources/list`: el cliente puede
recorrer el corpus sin conocer los identificadores de antemano.

`readhub://authors` derivan de agrupar `articleService.list` por `authorId`:
ReadHub no tiene tabla de autores, un autor es un perfil con artículos públicos.
No hay consulta nueva, solo composición.

## Prompts

Plantillas de mensajes reutilizables. Un Prompt **no ejecuta ni llama al LLM**
(eso es la Tool `ask_readhub`): devuelve los mensajes que el cliente entrega a su
propio modelo, con la instrucción ya redactada y el contenido del artículo
embebido.

| Prompt | Propósito | Argumentos |
|---|---|---|
| `summarize_article` | Resume un artículo. | `articleId`, `length` (breve/media/detallada), `language` |
| `explain_article` | Explica un artículo adaptando la profundidad al lector. | `articleId`, `level` (principiante/intermedio/experto), `language` |
| `compare_articles` | Contrasta dos artículos (común, diferencias, conclusión). | `articleIdA`, `articleIdB`, `focus?`, `language` |
| `generate_questions` | Genera preguntas sobre un artículo. | `articleId`, `count`, `type` (comprension/debate/examen), `language` |
| `extract_key_concepts` | Extrae los conceptos clave como glosario. | `articleId`, `count`, `language` |

### Convenciones

- **El material del artículo se obtiene de `rag.articleContent.getText`**, la
  misma ruta de extracción (descarga de storage + `extractDocumentText`) que usa
  el indexador. Se factorizó a un service propio para que Prompts, Tools e
  indexador compartan una sola implementación. Si el documento no tiene texto
  extraíble, el Prompt se degrada a título + resumen en vez de fallar.
- Todo `articleId` ofrece **autocompletado** (`completion/complete`) que reutiliza
  `articleService.list`: al teclear, el cliente ve los id cuyo título coincide.
- Solo `articleId` es obligatorio; el resto son opcionales con valor por defecto
  aplicado en el handler. Se declaran `.optional()` (no `.default()`) porque el
  SDK anuncia un `.default()` como argumento REQUERIDO en `prompts/list`.
- Añadir un Prompt es crear un `*.prompt.ts` que exporte un `PromptRegistrar` y
  sumarlo al array de `prompts/index.ts`. El servidor no se toca.

### Notas de esquema

- **Categorías**: ReadHub no las tenía. Se añadió la tabla catálogo
  `public.categories` (8 categorías canónicas) y una FK opcional
  `articles.category_id` (migración `20260710120100`). Los artículos existentes
  quedan sin categoría; publicar sigue sin exigirla.
- **Nombres de autor**: la vista `author_profiles` ahora concede `SELECT` a
  `anon` (migración `20260710120000`), de modo que el servidor MCP resuelve los
  nombres pese a usar la anon key sin sesión. La vista es SECURITY DEFINER y solo
  expone `id + full_name`; el resto de `profiles` sigue protegido.

## Uso

```bash
npm run build --workspace=@readhub/mcp   # compila a dist/
npm run start --workspace=@readhub/mcp   # arranca sobre STDIO
npm run dev   --workspace=@readhub/mcp   # recarga en caliente (tsx watch)
```

Para conectarlo a un cliente MCP, apúntalo a `node apps/mcp/dist/index.js`.

## Estructura

```
src/
├── index.ts           punto de entrada: crea el servidor y lo conecta a STDIO
├── server.ts          createServer(): instancia McpServer y registra capacidades
├── context.ts         reúne cliente Supabase + services + rag (sin envolverlos)
├── supabase.ts        cliente Supabase propio, sin dependencias de Next
├── config/env.ts      lectura y validación de variables de entorno
├── tools/
│   ├── index.ts       registra en bucle: familias de consulta y de análisis
│   ├── shared.ts      esquemas de salida, anotaciones y traducción de errores
│   ├── *.tool.ts      Tools de consulta (una por fichero)
│   └── analysis/
│       ├── shared.ts  carga de artículos con su texto y vector de términos
│       └── *.tool.ts  Tools de análisis multi-documento
├── resources/
│   ├── index.ts       registra en bucle el array de ResourceRegistrar
│   ├── shared.ts      URIs, empaquetado JSON y agregaciones de presentación
│   └── *.resource.ts  un grupo de Resources por fichero
└── prompts/
    ├── index.ts       registra en bucle el array de PromptRegistrar
    ├── shared.ts      carga de material del artículo y autocompletado de id
    └── *.prompt.ts    un Prompt por fichero
```

`index.ts` (transporte) está separado de `server.ts` (servidor) a propósito: el
mismo servidor podrá exponerse mañana por HTTP o desde una prueba sin tocar la
lógica de creación.

## Regla crítica del transporte STDIO

`stdout` es el canal del protocolo JSON-RPC. **Un solo `console.log` corrompe la
sesión.** Todo diagnóstico va a `stderr` mediante `console.error`.

## Notas del SDK (`@modelcontextprotocol/sdk` 1.29)

Verificado contra el paquete instalado, no asumido:

- El export raíz `@modelcontextprotocol/sdk` apunta a un fichero inexistente:
  **no lo uses**.
- `./server` solo expone el `Server` de bajo nivel, no `McpServer`.
- El paquete declara un export comodín `"./*"`, por lo que los **deep imports**
  son la vía correcta:
  ```ts
  import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
  import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
  ```
## Resolución de módulos: por qué `bundler` y no `NodeNext`

Quien empaqueta esta app es **tsup/esbuild**, un bundler. `NodeNext` describía un
cargador de módulos que este binario nunca usa, y además rompía los tipos:

`@supabase/supabase-js` publica dos ficheros de tipos, `index.d.mts` (condición
`import`) e `index.d.cts` (condición `require`). Bajo `NodeNext`, TypeScript elige
uno u otro según el `"type"` del paquete que contiene cada fichero. Como
`apps/mcp` es ESM y los paquetes compartidos no lo declaraban, `TypedSupabaseClient`
acababa apuntando a la clase `SupabaseClient` del `.d.cts` y el `createClient` de
aquí a la del `.d.mts`: **dos clases distintas**, incompatibles por sus miembros
`protected`. Ningún service habría aceptado el cliente de este servidor.

Se corrigió en la raíz, no con un cast:

1. Los paquetes `@readhub/*` declaran `"type": "module"` — es lo que son, fuente
   TypeScript con `import`/`export`. Nadie los carga como CommonJS.
2. Este `tsconfig` usa `moduleResolution: "Bundler"`, que aplica la condición
   `import` de forma uniforme a todo el grafo. Los deep imports `.js` del SDK
   siguen resolviendo por su `exports` comodín `"./*"`.

Sin el punto 1, `tsx` compilaba los paquetes a CommonJS y Node no lograba detectar
los nombres reexportados con `export *`: `npm run dev` fallaba con
`does not provide an export named 'articleService'`.

## Frontera del bundle

`skipNodeModulesBundle: true` + `noExternal: [/^@readhub\//]`:

- **Dentro** del binario (~33 KB): todo el código de `@readhub/*`, que se publica
  como fuente TypeScript sin paso de build.
- **Fuera**: las dependencias npm reales. Sin `skipNodeModulesBundle`, tsup solo
  externaliza lo declarado en `dependencies`, y los SDK que llegan de forma
  transitiva por `@readhub/ai` y `@readhub/rag` acababan incrustados (3,74 MB,
  con `pdfjs` dentro — frágil, carga workers por `import.meta.url`).

Por eso `openai`, `unpdf` y `mammoth` figuran en las `dependencies` de
esta app: al inlinear los paquetes compartidos, el binario pasa a importarlos en
su propio nombre y debe poder resolverlos sin depender del *hoisting* de npm.

## Capacidades disponibles para las siguientes fases

La lógica ya existe. No se duplicará: se delegará en los paquetes compartidos.

| Necesidad | Paquete que ya la resuelve |
|---|---|
| Buscar artículos por similitud | `@readhub/rag` → `vectorSearchService` |
| Responder preguntas con RAG | `@readhub/rag` → `chatService` |
| Indexar un artículo | `@readhub/rag` → `indexingService` |
| Leer artículos, perfiles, comentarios | `@readhub/services` |
| Tipos de los contratos | `@readhub/types` |
| Cliente Supabase tipado | `@readhub/database` |

Los services reciben el cliente Supabase **como parámetro**, así que este
servidor crea el suyo con `@supabase/supabase-js` (sin `next/headers`) y se lo
pasa. Esa es la razón por la que los clientes de Next se quedaron en `apps/web`,
y lo que mantiene ambas aplicaciones desacopladas: comparten dominio, no runtime.

Todo se expone a través de `getContext()`, que devuelve `{ supabase, services, rag }`.
Es **perezoso**: el cliente Supabase se construye la primera vez que una capacidad
lo pide, de modo que el servidor completa el handshake MCP aunque el entorno aún
no esté configurado, en vez de morir al arrancar.

## Entorno

| Variable | Obligatoria | Notas |
|---|---|---|
| `SUPABASE_URL` | sí (al usar una capacidad) | acepta `NEXT_PUBLIC_SUPABASE_URL` como respaldo |
| `SUPABASE_ANON_KEY` | sí (al usar una capacidad) | acepta `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `VOYAGE_API_KEY` | solo para embeddings/búsqueda | usada por `@readhub/ai` |
| `GROQ_API_KEY` | solo para `chatService` (generación) | usada por `@readhub/ai` |
| `GROQ_MODEL` | no (por defecto `llama-3.3-70b-versatile`) | modelo de Groq a usar |

Se usa deliberadamente la **anon key**, no la `service_role`: así el servidor MCP
queda sujeto a las mismas políticas RLS que la web.
