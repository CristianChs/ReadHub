import { z } from "zod";

import { READ_ONLY, runTool } from "../shared.js";
import type { ToolRegistrar } from "../shared.js";
import { articleIdsSchema, loadCorpus } from "./shared.js";

const MAX_EXCERPT = 1200;

/**
 * `generate_global_summary` — dosier de síntesis de varios artículos.
 *
 * ReadHub es una plataforma de conocimiento PARA LLMs: esta Tool no llama a
 * ningún modelo (eso obligaría a una clave y duplicaría a `ask_readhub`).
 * Ensambla, de forma determinista, el material que un LLM necesita para redactar
 * un resumen global: los temas comunes del conjunto, el resumen propio de cada
 * artículo y un extracto de cada uno. El modelo del cliente produce la síntesis.
 *
 * El `content` textual va listo para entregárselo a un modelo; el
 * `structuredContent` da lo mismo estructurado para un agente.
 */
export const registerGlobalSummary: ToolRegistrar = (server, getContext) => {
  server.registerTool(
    "generate_global_summary",
    {
      title: "Resumen global de varios artículos",
      description:
        "Prepara la síntesis de un conjunto de artículos (o de toda la plataforma si no indicas ids): reúne los temas comunes, el resumen de cada artículo y un extracto de cada uno, listo para que un modelo redacte un resumen global. No genera el texto por sí misma; ensambla el material fundado.",
      inputSchema: {
        articleIds: articleIdsSchema.max(25).optional(),
        language: z
          .string()
          .default("español")
          .describe("Idioma sugerido para la síntesis."),
      },
      outputSchema: {
        articleCount: z.number(),
        truncated: z.boolean(),
        commonTopics: z.array(z.string()),
        articles: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            summary: z.string().nullable(),
            excerpt: z.string(),
            hasText: z.boolean(),
          }),
        ),
      },
      annotations: READ_ONLY,
    },
    async ({ articleIds, language }) =>
      runTool("generate_global_summary", async () => {
        const { articles, truncated } = await loadCorpus(getContext(), articleIds);

        // Temas comunes: términos presentes en varios artículos.
        const docFreq = new Map<string, number>();
        const total = new Map<string, number>();
        for (const a of articles) {
          for (const [term, count] of a.tf) {
            docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
            total.set(term, (total.get(term) ?? 0) + count);
          }
        }
        const threshold = Math.max(2, Math.ceil(articles.length / 2));
        const commonTopics = [...docFreq.entries()]
          .filter(([, df]) => df >= threshold)
          .sort((a, b) => b[1] - a[1] || (total.get(b[0]) ?? 0) - (total.get(a[0]) ?? 0))
          .slice(0, 12)
          .map(([term]) => term);

        const items = articles.map((a) => ({
          id: a.id,
          title: a.title,
          summary: a.summary,
          excerpt: (a.text ?? a.summary ?? "").slice(0, MAX_EXCERPT),
          hasText: a.hasText,
        }));

        const text = [
          `Redacta en ${language} un resumen global de los ${articles.length} artículos siguientes.`,
          "Integra sus ideas en una visión de conjunto; no los resumas por separado.",
          commonTopics.length
            ? `Temas comunes detectados: ${commonTopics.join(", ")}.`
            : "No se detectaron temas comunes claros; señala si los artículos son dispares.",
          "",
          ...items.map((it) =>
            [
              `## ${it.title}`,
              it.summary ? `Resumen: ${it.summary}` : null,
              `Extracto: ${it.excerpt || "(sin texto extraíble)"}`,
            ]
              .filter(Boolean)
              .join("\n"),
          ),
        ].join("\n");

        return {
          content: [{ type: "text" as const, text }],
          structuredContent: {
            articleCount: articles.length,
            truncated,
            commonTopics,
            articles: items,
          },
        };
      }),
  );
};
