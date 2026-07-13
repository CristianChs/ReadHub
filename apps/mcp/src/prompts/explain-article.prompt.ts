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
 * `explain_article` — explica un artículo adaptando el nivel al lector.
 *
 * A diferencia de resumir (comprimir), aquí se pide desarrollar y aclarar: útil
 * para entender un artículo denso. El nivel ajusta el vocabulario y la
 * profundidad.
 */
export const registerExplainArticle: PromptRegistrar = (server, getContext) => {
  server.registerPrompt(
    "explain_article",
    {
      title: "Explicar artículo",
      description:
        "Explica un artículo de ReadHub adaptando la profundidad al nivel del lector.",
      argsSchema: {
        articleId: articleIdArg(getContext, "Id del artículo a explicar."),
        level: z
          .enum(["principiante", "intermedio", "experto"])
          .optional()
          .describe("Nivel del lector. Por defecto principiante."),
        language: LANGUAGE_ARG,
      },
    },
    async ({ articleId, level, language }) => {
      const material = await loadArticleMaterial(getContext(), articleId);

      const resolvedLevel = level ?? "principiante";
      const guidanceByLevel: Record<string, string> = {
        principiante:
          "Asume que el lector no conoce el tema. Evita la jerga o defínela, y usa analogías sencillas.",
        intermedio:
          "El lector conoce lo básico. Céntrate en el porqué y en las relaciones entre ideas.",
        experto:
          "El lector domina el tema. Sé preciso y conciso; destaca matices, límites y supuestos.",
      };
      const guidance = guidanceByLevel[resolvedLevel];

      return userPrompt(
        [
          `Explica el siguiente artículo en ${language ?? DEFAULT_LANGUAGE} para un lector de nivel ${resolvedLevel}.`,
          guidance,
          "Aclara los conceptos difíciles y el hilo del razonamiento. Fundaméntate solo en el contenido proporcionado.",
          "",
          renderArticleBlock(material),
        ].join("\n"),
      );
    },
  );
};
