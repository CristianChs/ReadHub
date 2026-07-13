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
 * `generate_questions` — genera preguntas a partir de un artículo.
 *
 * Útil para estudiar, evaluar comprensión o abrir debate. El tipo cambia la
 * naturaleza de las preguntas; el número las acota.
 */
export const registerGenerateQuestions: PromptRegistrar = (server, getContext) => {
  server.registerPrompt(
    "generate_questions",
    {
      title: "Generar preguntas",
      description:
        "Genera preguntas sobre un artículo de ReadHub, del tipo y en la cantidad que elijas.",
      argsSchema: {
        articleId: articleIdArg(getContext, "Id del artículo de partida."),
        count: z
          .coerce.number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .describe("Número de preguntas a generar. Por defecto 5."),
        type: z
          .enum(["comprension", "debate", "examen"])
          .optional()
          .describe("Naturaleza de las preguntas. Por defecto comprension."),
        language: LANGUAGE_ARG,
      },
    },
    async ({ articleId, count, type, language }) => {
      const material = await loadArticleMaterial(getContext(), articleId);

      const resolvedType = type ?? "comprension";
      const guidanceByType: Record<string, string> = {
        comprension:
          "Preguntas que comprueben si se ha entendido lo que dice el artículo. Cada una debe poder responderse con su contenido.",
        debate:
          "Preguntas abiertas que inviten a discutir, opinar o cuestionar las ideas del artículo. No tienen una única respuesta.",
        examen:
          "Preguntas de evaluación con respuesta objetiva y verificable en el texto. Incluye la respuesta esperada tras cada una.",
      };
      const guidance = guidanceByType[resolvedType];

      return userPrompt(
        [
          `Genera ${count ?? 5} preguntas en ${language ?? DEFAULT_LANGUAGE} sobre el siguiente artículo.`,
          `Tipo: ${resolvedType}. ${guidance}`,
          "Numera las preguntas. Fundaméntate solo en el contenido proporcionado.",
          "",
          renderArticleBlock(material),
        ].join("\n"),
      );
    },
  );
};
