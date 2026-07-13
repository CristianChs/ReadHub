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
 * `summarize_article` — resume un artículo de ReadHub.
 *
 * Produce la instrucción + el contenido real del artículo. El resumen lo redacta
 * el modelo del cliente; este Prompt solo prepara el material.
 */
export const registerSummarizeArticle: PromptRegistrar = (server, getContext) => {
  server.registerPrompt(
    "summarize_article",
    {
      title: "Resumir artículo",
      description:
        "Genera un resumen de un artículo de ReadHub, con la longitud y el idioma que elijas.",
      argsSchema: {
        articleId: articleIdArg(getContext, "Id del artículo a resumir."),
        length: z
          .enum(["breve", "media", "detallada"])
          .optional()
          .describe("Extensión del resumen. Por defecto media."),
        language: LANGUAGE_ARG,
      },
    },
    async ({ articleId, length, language }) => {
      const material = await loadArticleMaterial(getContext(), articleId);

      // zod ya validó que `length` es uno de estos valores (o undefined -> media).
      const shapes: Record<string, string> = {
        breve: "un párrafo de 2-3 frases",
        media: "un párrafo de 4-6 frases",
        detallada: "varios párrafos que cubran todos los puntos principales",
      };
      const shape = shapes[length ?? "media"];

      return userPrompt(
        [
          `Resume el siguiente artículo en ${language ?? DEFAULT_LANGUAGE}. Escribe ${shape}.`,
          "Fundaméntate ÚNICAMENTE en el contenido proporcionado; no añadas información externa.",
          "",
          renderArticleBlock(material),
        ].join("\n"),
      );
    },
  );
};
