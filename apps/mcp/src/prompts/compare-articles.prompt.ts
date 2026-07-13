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
 * `compare_articles` — compara dos artículos de ReadHub.
 *
 * Carga el material de ambos y pide un contraste estructurado. El `focus`
 * opcional permite dirigir la comparación (p. ej. "enfoque metodológico").
 */
export const registerCompareArticles: PromptRegistrar = (server, getContext) => {
  server.registerPrompt(
    "compare_articles",
    {
      title: "Comparar artículos",
      description:
        "Compara dos artículos de ReadHub: puntos en común, diferencias y conclusiones.",
      argsSchema: {
        articleIdA: articleIdArg(getContext, "Id del primer artículo."),
        articleIdB: articleIdArg(getContext, "Id del segundo artículo."),
        focus: z
          .string()
          .optional()
          .describe(
            "Aspecto en el que centrar la comparación. Opcional; si se omite, se comparan de forma general.",
          ),
        language: LANGUAGE_ARG,
      },
    },
    async ({ articleIdA, articleIdB, focus, language }) => {
      const ctx = getContext();
      // Se cargan en paralelo; cada uno lanza por su cuenta si no existe.
      const [a, b] = await Promise.all([
        loadArticleMaterial(ctx, articleIdA),
        loadArticleMaterial(ctx, articleIdB),
      ]);

      const focusLine = focus
        ? `Centra la comparación en: ${focus}.`
        : "Compáralos de forma general.";

      return userPrompt(
        [
          `Compara los dos artículos siguientes y redacta el resultado en ${language ?? DEFAULT_LANGUAGE}.`,
          focusLine,
          "Estructura la respuesta en: (1) puntos en común, (2) diferencias, (3) conclusión.",
          "Fundaméntate únicamente en el contenido proporcionado; no añadas información externa.",
          "",
          "----- ARTÍCULO A -----",
          renderArticleBlock(a),
          "",
          "----- ARTÍCULO B -----",
          renderArticleBlock(b),
        ].join("\n"),
      );
    },
  );
};
