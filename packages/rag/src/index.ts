// Sistema RAG de ReadHub. **SOLO SERVIDOR**: arrastra el SDK de openai (Groq),
// unpdf y mammoth, que no pueden entrar en el bundle del navegador.
//
// Consúmelo únicamente desde Route Handlers o desde procesos de Node
// (p. ej. el futuro servidor MCP). Nunca desde componentes ni hooks.
export * from "./article-content.service";
export * from "./chat.service";
export * from "./context-builder.service";
export * from "./embedding.service";
export * from "./indexing.service";
export * from "./vector-search.service";
