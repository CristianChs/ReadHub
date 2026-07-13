import { describe, expect, it } from "vitest";

import { articleService } from "./article.service";
import { createSupabaseFake } from "./testing/supabase-fake";

// ============================================================================
// article.service — mapeo BD -> dominio, contadores agregados y búsqueda léxica.
//
// Todo con un cliente de Supabase FALSO: el service lo recibe por parámetro, así
// que no hace falta red, ni claves, ni interceptar módulos.
// ============================================================================

const ROW = {
  id: "art-1",
  title: "SCRUM Práctico",
  summary: "Un resumen",
  image_path: "u1/portada.png",
  author_id: "user-1",
  created_at: "2026-07-01T10:00:00Z",
  category_id: "cat-1",
};

const STATS_ROW = { article_id: "art-1", views_count: 7, likes_count: 3 };

describe("list", () => {
  it("mapea snake_case a camelCase y adjunta los contadores", async () => {
    const { client } = createSupabaseFake({
      articles: { data: [ROW], error: null },
      article_stats: { data: [STATS_ROW], error: null },
    });

    const [article] = await articleService.list(client);

    expect(article).toEqual({
      id: "art-1",
      title: "SCRUM Práctico",
      summary: "Un resumen",
      imagePath: "u1/portada.png",
      authorId: "user-1",
      createdAt: "2026-07-01T10:00:00Z",
      categoryId: "cat-1",
      views: 7,
      likes: 3,
    });
  });

  it("filtra por is_public y ordena por fecha descendente", async () => {
    const fake = createSupabaseFake({
      articles: { data: [ROW], error: null },
      article_stats: { data: [], error: null },
    });

    await articleService.list(fake.client);

    expect(fake.argsOf("eq")).toEqual(["is_public", true]);
    expect(fake.argsOf("order")).toEqual([
      "created_at",
      { ascending: false },
    ]);
  });

  it("usa contadores a 0 cuando el artículo no tiene fila en article_stats", async () => {
    // Caso real: un artículo recién publicado, sin vistas ni likes todavía.
    const { client } = createSupabaseFake({
      articles: { data: [ROW], error: null },
      article_stats: { data: [], error: null },
    });

    const [article] = await articleService.list(client);

    expect(article.views).toBe(0);
    expect(article.likes).toBe(0);
  });

  it("trata un contador nulo como 0", async () => {
    const { client } = createSupabaseFake({
      articles: { data: [ROW], error: null },
      article_stats: {
        data: [{ article_id: "art-1", views_count: null, likes_count: null }],
        error: null,
      },
    });

    const [article] = await articleService.list(client);

    expect(article.views).toBe(0);
    expect(article.likes).toBe(0);
  });

  it("devuelve [] cuando no hay artículos, sin consultar los contadores", async () => {
    // `article_stats` no está preparada a propósito: si el service la consultara
    // con una lista vacía de ids, el fake lanzaría y el test fallaría.
    const { client } = createSupabaseFake({
      articles: { data: [], error: null },
    });

    await expect(articleService.list(client)).resolves.toEqual([]);
  });

  it("tolera data null (PostgREST puede devolverlo)", async () => {
    const { client } = createSupabaseFake({
      articles: { data: null, error: null },
    });

    await expect(articleService.list(client)).resolves.toEqual([]);
  });

  it("propaga el error de Supabase en vez de devolver una lista vacía", async () => {
    // Silenciar el error mostraría "aún no hay artículos" cuando en realidad la
    // consulta falló: la UI debe poder distinguir ambos casos.
    const { client } = createSupabaseFake({
      articles: { data: null, error: { message: "permission denied", code: "42501" } },
    });

    await expect(articleService.list(client)).rejects.toMatchObject({
      code: "42501",
    });
  });

  it("propaga también el error de la consulta de contadores", async () => {
    const { client } = createSupabaseFake({
      articles: { data: [ROW], error: null },
      article_stats: { data: null, error: { message: "boom" } },
    });

    await expect(articleService.list(client)).rejects.toMatchObject({
      message: "boom",
    });
  });
});

describe("search (búsqueda léxica)", () => {
  it("busca el término en el título y en el resumen", async () => {
    const fake = createSupabaseFake({
      articles: { data: [ROW], error: null },
      article_stats: { data: [STATS_ROW], error: null },
    });

    const result = await articleService.search(fake.client, "scrum");

    expect(result).toHaveLength(1);
    expect(fake.argsOf("or")).toEqual([
      "title.ilike.%scrum%,summary.ilike.%scrum%",
    ]);
  });

  it("respeta el límite por defecto y el explícito", async () => {
    const porDefecto = createSupabaseFake({
      articles: { data: [], error: null },
    });
    await articleService.search(porDefecto.client, "scrum");
    expect(porDefecto.argsOf("limit")).toEqual([20]);

    const explicito = createSupabaseFake({
      articles: { data: [], error: null },
    });
    await articleService.search(explicito.client, "scrum", 5);
    expect(explicito.argsOf("limit")).toEqual([5]);
  });

  // --- Neutralización de metacaracteres -------------------------------------
  // PostgREST separa los filtros de `or` por COMAS y los agrupa con PARÉNTESIS;
  // dentro de un `ilike`, `%` y `_` son comodines. Si cualquiera de esos
  // caracteres llegara desde la consulta del usuario, el filtro dejaría de
  // significar lo que dice. Esto es una defensa de inyección: se prueba a fondo.

  it.each([
    ["comas (separador de filtros de PostgREST)", "scrum,kanban"],
    ["paréntesis (agrupador de PostgREST)", "scrum(o)kanban"],
    ["comodín de porcentaje", "scrum%"],
    ["comodín de guion bajo", "scr_m"],
    ["barra invertida (escape)", "scrum\\"],
  ])("neutraliza %s antes de construir el filtro", async (_caso, query) => {
    const fake = createSupabaseFake({
      articles: { data: [], error: null },
    });

    await articleService.search(fake.client, query);

    const [filtro] = fake.argsOf("or") as [string];
    const termino = filtro.slice("title.ilike.%".length, filtro.indexOf("%,"));

    expect(termino).not.toMatch(/[,()%_\\]/);
  });

  it("colapsa los espacios que deja la neutralización", async () => {
    const fake = createSupabaseFake({ articles: { data: [], error: null } });

    await articleService.search(fake.client, "  scrum ,  ágil  ");

    expect(fake.argsOf("or")).toEqual([
      "title.ilike.%scrum ágil%,summary.ilike.%scrum ágil%",
    ]);
  });

  it.each([
    ["cadena vacía", ""],
    ["solo espacios", "   "],
    ["solo metacaracteres", "%%__,,()"],
  ])(
    "devuelve [] sin llegar a consultar la base de datos ante %s",
    async (_caso, query) => {
      // El fake no tiene ninguna tabla preparada: si el service consultara,
      // lanzaría. Que resuelva a [] demuestra el cortocircuito.
      const { client, calls } = createSupabaseFake({});

      await expect(articleService.search(client, query)).resolves.toEqual([]);
      expect(calls).toHaveLength(0);
    },
  );
});

describe("getById", () => {
  it("devuelve el detalle con documento y visibilidad", async () => {
    const { client } = createSupabaseFake({
      articles: {
        data: { ...ROW, document_path: "u1/doc.pdf", is_public: true },
        error: null,
      },
      article_stats: { data: [STATS_ROW], error: null },
    });

    const article = await articleService.getById(client, "art-1");

    expect(article).toMatchObject({
      id: "art-1",
      documentPath: "u1/doc.pdf",
      isPublic: true,
      views: 7,
    });
  });

  it("devuelve null cuando el artículo no existe (no lanza)", async () => {
    // Un id inexistente —o uno que la RLS oculta— no es un error: es un 404.
    const { client } = createSupabaseFake({
      articles: { data: null, error: null },
    });

    await expect(articleService.getById(client, "fantasma")).resolves.toBeNull();
  });

  it("propaga un error real de la consulta", async () => {
    const { client } = createSupabaseFake({
      articles: { data: null, error: { message: "boom" } },
    });

    await expect(articleService.getById(client, "art-1")).rejects.toMatchObject({
      message: "boom",
    });
  });
});

describe("update", () => {
  it("mapea el modelo de dominio a las columnas de la BD", async () => {
    const fake = createSupabaseFake({
      articles: { data: { id: "art-1" }, error: null },
    });

    await articleService.update(fake.client, "art-1", {
      title: "Nuevo título",
      isPublic: false,
    });

    expect(fake.argsOf("update")).toEqual([
      { title: "Nuevo título", is_public: false },
    ]);
  });

  it("omite los campos no enviados (no los pisa con undefined)", async () => {
    // Un PATCH parcial no debe borrar el resumen solo por no mencionarlo.
    const fake = createSupabaseFake({
      articles: { data: { id: "art-1" }, error: null },
    });

    await articleService.update(fake.client, "art-1", { title: "Solo el título" });

    expect(fake.argsOf("update")).toEqual([{ title: "Solo el título" }]);
  });

  it("SÍ permite vaciar el resumen explícitamente con null", async () => {
    // `null` es un valor, `undefined` es una ausencia: el service los distingue.
    const fake = createSupabaseFake({
      articles: { data: { id: "art-1" }, error: null },
    });

    await articleService.update(fake.client, "art-1", { summary: null });

    expect(fake.argsOf("update")).toEqual([{ summary: null }]);
  });

  it("propaga el error de la actualización", async () => {
    const { client } = createSupabaseFake({
      articles: { data: null, error: { message: "denied", code: "42501" } },
    });

    await expect(
      articleService.update(client, "art-1", { title: "x" }),
    ).rejects.toMatchObject({ code: "42501" });
  });
});

describe("likes y vistas", () => {
  it("hasLiked es true cuando existe la fila", async () => {
    const { client } = createSupabaseFake({
      likes: { data: { id: "like-1" }, error: null },
    });

    await expect(articleService.hasLiked(client, "art-1", "user-1")).resolves.toBe(
      true,
    );
  });

  it("hasLiked es false cuando no existe (ausencia, no error)", async () => {
    const { client } = createSupabaseFake({
      likes: { data: null, error: null },
    });

    await expect(articleService.hasLiked(client, "art-1", "user-1")).resolves.toBe(
      false,
    );
  });

  it("addLike propaga el conflicto de la restricción unique", async () => {
    // La BD es la garantía final contra el doble like: el service no la esconde.
    const { client } = createSupabaseFake({
      likes: { data: null, error: { code: "23505", message: "duplicate key" } },
    });

    await expect(
      articleService.addLike(client, "art-1", "user-1"),
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("getLikeCount y getViewCount devuelven 0 si no hay estadísticas", async () => {
    const { client } = createSupabaseFake({
      article_stats: { data: [], error: null },
    });

    await expect(articleService.getLikeCount(client, "art-1")).resolves.toBe(0);
    await expect(articleService.getViewCount(client, "art-1")).resolves.toBe(0);
  });

  it("registerView propaga el error de inserción", async () => {
    const { client } = createSupabaseFake({
      views: { data: null, error: { message: "rls" } },
    });

    await expect(
      articleService.registerView(client, "art-1", "user-1"),
    ).rejects.toMatchObject({ message: "rls" });
  });
});
