import { z } from "zod";

import {
  DEFAULT_LANGUAGE,
  LANGUAGE_ARG,
  articleIdArg,
  loadArticleMaterial,
  renderArticleBlock,
  userPrompt,
} from "./shared.js";
import type { PromptRegistrar } from "./shared.js";

/**
 * `extract_key_concepts` — extrae los conceptos clave de un artículo.
 *
 * Devuelve un glosario: los términos e ideas centrales, cada uno con una
 * definición breve tomada del propio artículo. Útil para indexar mentalmente un
 * texto o para repasar.
 */
export const registerExtractKeyConcepts: PromptRegistrar = (server, getContext) => {
  server.registerPrompt(
    "extract_key_concepts",
    {
      title: "Extraer conceptos clave",
      description:
        "Extrae los conceptos clave de un artículo de ReadHub, cada uno con una definición breve.",
      argsSchema: {
        articleId: articleIdArg(getContext, "Id del artículo a analizar."),
        count: z
          .coerce.number()
          .int()
          .min(1)
          .max(30)
          .optional()
          .describe("Número máximo de conceptos a extraer. Por defecto 8."),
        language: LANGUAGE_ARG,
      },
    },
    async ({ articleId, count, language }) => {
      const material = await loadArticleMaterial(getContext(), articleId);

      return userPrompt(
        [
          `Extrae hasta ${count ?? 8} conceptos clave del siguiente artículo y escríbelos en ${language ?? DEFAULT_LANGUAGE}.`,
          "Preséntalos como una lista. Para cada concepto: el término en negrita y una definición de una frase, tomada del propio artículo.",
          "Ordénalos por importancia. Fundaméntate solo en el contenido proporcionado.",
          "",
          renderArticleBlock(material),
        ].join("\n"),
      );
    },
  );
};
