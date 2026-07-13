# 1\. Objetivos del Laboratorio

### **Nombre del Laboratorio**

Implementación de Sistema RAG y Asistente Inteligente para ReadHub

### **Objetivo General**

Transformar ReadHub en una plataforma de conocimiento conversacional mediante la implementación de un sistema RAG (Retrieval-Augmented Generation) capaz de indexar los artículos publicados, almacenarlos como representaciones vectoriales y responder consultas en lenguaje natural utilizando exclusivamente la información disponible dentro de la plataforma.

El laboratorio deberá integrar pgvector, generación de embeddings, recuperación semántica y un asistente inteligente basado en Claude, manteniendo la arquitectura desarrollada en las sesiones anteriores.

### **Objetivos Específicos**

* Comprender el flujo completo de un sistema RAG.  
* Configurar pgvector sobre Supabase.  
* Generar embeddings para los artículos publicados.  
* Almacenar y administrar representaciones vectoriales.  
* Implementar indexación automática de contenido.  
* Realizar búsquedas semánticas mediante similitud vectorial.  
* Construir contexto optimizado para modelos de lenguaje.  
* Integrar Claude como motor de generación de respuestas.  
* Desarrollar una interfaz conversacional moderna.  
* Mostrar las fuentes utilizadas en cada respuesta.  
* Mantener la separación entre UI, Hooks, Services y Supabase.  
* Preparar la plataforma para futuras capacidades de IA avanzada.

# 2\. Tecnologías Base

* Next.js 15 (App Router)  
* React 19  
* TypeScript  
* TailwindCSS  
* Shadcn/UI  
* Supabase  
* PostgreSQL  
* pgvector  
* Supabase Auth  
* Supabase Storage  
* Claude API  
* Vercel AI SDK (opcional para streaming)

# 3\. Arquitectura General del Sistema RAG

## Introducción

La cuarta sesión de ReadHub incorpora una nueva capacidad al proyecto: transformar la plataforma en un sistema de conocimiento conversacional mediante la implementación de un flujo Retrieval-Augmented Generation (RAG).

A diferencia de las sesiones anteriores, donde la aplicación se centraba en la gestión y visualización de artículos, esta iteración introduce una arquitectura especializada que permite indexar el conocimiento almacenado, recuperarlo mediante búsqueda semántica y utilizarlo como contexto para generar respuestas fundamentadas con un modelo de lenguaje.

El objetivo no consiste únicamente en integrar un chatbot, sino en construir un pipeline RAG desacoplado, reutilizable y escalable que pueda evolucionar en futuras iteraciones sin comprometer la arquitectura existente del proyecto.

La arquitectura propuesta mantiene la separación de responsabilidades utilizada en las sesiones anteriores y añade una nueva capa de servicios especializados para el procesamiento de conocimiento.

---

## Arquitectura General

El sistema estará compuesto por dos grandes procesos independientes que trabajan de manera coordinada:

1\. Pipeline de Indexación

Responsable de transformar los artículos publicados en representaciones vectoriales almacenadas dentro de la base de conocimiento.

Este proceso se ejecuta automáticamente cada vez que un artículo es creado o actualizado.

Su finalidad es garantizar que toda la información disponible en ReadHub pueda ser recuperada posteriormente mediante consultas semánticas.

El flujo será el siguiente:

Usuario publica o actualiza un artículo  
               │  
               ▼  
Obtención del contenido del artículo  
               │  
               ▼  
Extracción del conocimiento relevante  
               │  
               ▼  
Generación del embedding  
               │  
               ▼  
Almacenamiento del embedding  
               │  
               ▼  
Base Vectorial (pgvector)

---

2\. Pipeline de Recuperación (RAG)

Responsable de responder preguntas realizadas por los usuarios utilizando únicamente el conocimiento almacenado dentro de ReadHub.

Este flujo comienza cuando el usuario realiza una consulta en lenguaje natural.

El sistema transforma la consulta en un embedding, recupera los documentos más relevantes mediante búsqueda semántica y construye un contexto que posteriormente será enviado a Claude para generar una respuesta fundamentada.

El flujo será el siguiente:

Usuario realiza una consulta  
               │  
               ▼  
Generación del embedding de la consulta  
               │  
               ▼  
Similarity Search  
               │  
               ▼  
Recuperación de documentos relevantes  
               │  
               ▼  
Construcción del contexto  
               │  
               ▼  
Claude  
               │  
               ▼  
Respuesta contextual  
               │  
               ▼  
Visualización de fuentes

## Componentes Arquitectónicos

La solución estará organizada mediante componentes especializados con responsabilidades claramente definidas.

## Embedding Service

Responsable de generar los embeddings tanto de los artículos como de las consultas realizadas por los usuarios.

Este servicio centraliza toda la comunicación con el proveedor de embeddings, evitando duplicar lógica en el resto de la aplicación.

## Vector Search Service

Encargado de ejecutar búsquedas por similitud sobre la base vectorial utilizando pgvector.

Su responsabilidad consiste únicamente en recuperar los documentos más relevantes para una consulta determinada.

No construye contexto ni interactúa con el modelo de lenguaje.

## Context Builder Service

Recibe los documentos recuperados por el motor de búsqueda y construye el contexto que será enviado al modelo de IA.

Durante este proceso organiza los documentos, elimina redundancias, limita el tamaño del contexto y mantiene la trazabilidad de las fuentes utilizadas.

## Chat Service

Actúa como orquestador del sistema RAG.

Coordina la interacción entre los diferentes servicios implementados durante el laboratorio y es el único componente responsable de comunicarse con Claude.

No implementa lógica de recuperación ni generación de embeddings; simplemente reutiliza los servicios existentes.

## Route Handlers

Funcionan como la capa de comunicación entre el frontend y la lógica del sistema RAG.

Toda la interacción entre la interfaz y los servicios especializados deberá realizarse mediante Route Handlers, evitando exponer directamente la lógica de negocio al cliente.

## Principios Arquitectónicos

Toda la implementación deberá respetar los siguientes principios:

* Responsabilidad única para cada servicio.  
* Separación estricta entre UI, lógica de negocio y persistencia.  
* Reutilización de componentes existentes.  
* Bajo acoplamiento entre módulos.  
* Alta cohesión dentro de cada servicio.  
* Escalabilidad para futuras funcionalidades de IA.  
* Independencia del proveedor de modelos de lenguaje.  
* Arquitectura preparada para incorporar nuevas fuentes de conocimiento.

Flujo General del Sistema

                   ReadHub

                      │  
       ┌──────────────┴──────────────┐  
       │                             │  
       ▼                             ▼

Pipeline de Indexación        Pipeline de Consulta

Artículo                     Pregunta del Usuario  
       │                             │  
       ▼                             ▼  
Embedding Service          Embedding Service  
       │                             │  
       ▼                             ▼  
Base Vectorial             Vector Search  
       │                             │  
       └──────────────┬──────────────┘  
                      ▼  
            Context Builder  
                      │  
                      ▼  
               Chat Service  
                      │  
                      ▼  
                   Claude  
                      │  
                      ▼  
                Respuesta Final

---

# **4\. Arquitectura del Proyecto**

## Introducción:

La incorporación del sistema RAG requiere extender la arquitectura existente de ReadHub sin modificar las capas implementadas en sesiones anteriores.

Todas las nuevas funcionalidades deberán integrarse respetando la organización actual del proyecto, reutilizando la infraestructura desarrollada y manteniendo una separación clara entre presentación, lógica de negocio y acceso a datos.

La arquitectura continuará basada en el patrón:

UI  
│  
▼  
Hooks  
│  
▼  
Route Handlers  
│  
▼  
Services  
│  
▼  
Supabase / Claude

Nueva Estructura del Proyecto

La siguiente estructura representa únicamente los nuevos módulos que serán incorporados durante este laboratorio.

src/

├── app/  
│   └── api/  
│       ├── chat/  
│       │   └── route.ts  
│       │  
│       └── search/  
│           └── route.ts  
│  
├── components/  
│   ├── chat/  
│   │   ├── ChatWindow.tsx  
│   │   ├── ChatMessage.tsx  
│   │   ├── ChatInput.tsx  
│   │   ├── SourcesList.tsx  
│   │   └── LoadingMessage.tsx  
│   │  
│   └── search/  
│       └── SemanticSearch.tsx  
│  
├── hooks/  
│   ├── useChat.ts  
│   └── useSemanticSearch.ts  
│  
├── services/  
│   ├── embedding.service.ts  
│   ├── vector-search.service.ts  
│   ├── context-builder.service.ts  
│   └── chat.service.ts  
│  
├── lib/  
│   └── ai/  
│       ├── embeddings.ts  
│       └── prompts.ts  
│  
└── types/  
   ├── chat.ts  
   ├── embedding.ts  
   └── vector-search.ts

## Responsabilidad de cada módulo:

app/api

Contiene los Route Handlers responsables de exponer la funcionalidad del sistema RAG al frontend.

Ningún componente React deberá comunicarse directamente con los Services.

---

## components/chat:

Implementa toda la interfaz conversacional del asistente inteligente.

Su única responsabilidad consiste en representar el estado del chat.

No contiene lógica de negocio.

---

## hooks:

Centraliza la interacción entre la interfaz y los Route Handlers.

Gestiona estados de carga, historial, streaming y comunicación con el backend.

---

## services:

Constituye el núcleo del sistema RAG.

Cada servicio implementa una única responsabilidad:

* embedding.service.ts → generación y persistencia de embeddings.  
* vector-search.service.ts → búsqueda semántica.  
* context-builder.service.ts → construcción del contexto.  
* chat.service.ts → orquestación del flujo RAG e integración con Claude.

---

## lib/ai:

Agrupa utilidades relacionadas con la Inteligencia Artificial.

Permite desacoplar la configuración del proveedor de IA y centralizar plantillas de prompts o funciones auxiliares.

---

## types:

Define todos los contratos de datos utilizados por el sistema RAG.

Su objetivo es mantener un tipado consistente entre frontend, backend y servicios.

### 

# 5\. Funcionalidades Mínimas Obligatorias:

### **5.1 Infraestructura Vectorial**

Obligatorio

* Instalación de pgvector.  
* Creación de estructuras vectoriales.  
* Índices de similitud.  
* Funciones SQL reutilizables.

### **5.2 Sistema de Embeddings**

Obligatorio

* Extracción de texto de artículos.  
* Generación de embeddings.  
* Persistencia de vectores.

### **5.3 Indexación Automática**

Obligatorio

* Generación automática al crear artículos.  
* Actualización automática al editar artículos.  
* Eliminación de vectores huérfanos.

### **5.4 Búsqueda Semántica**

Obligatorio

* Consultas en lenguaje natural.  
* Similarity Search.  
* Recuperación de documentos relevantes.

### **5.5 Constructor de Contexto**

Obligatorio

* Selección de documentos.  
* Orden por relevancia.  
* Limitación de contexto.  
* Citación de fuentes.

### **5.6 Servicio Conversacional**

Obligatorio

* Orquestación del flujo RAG.  
* Integración con Claude.  
* Respuestas fundamentadas.

### **5.7 Interfaz del Asistente**

Obligatorio

* Ventana de chat.  
* Historial de conversación.  
* Streaming de respuestas.  
* Fuentes utilizadas.  
* Enlaces a artículos.

### **5.8 Integración y Optimización**

Obligatorio

* Integración completa del sistema.  
* Optimización de consultas.  
* Revisión arquitectónica.  
* Documentación final.

# 6\. Restricciones del Laboratorio

### **Infraestructura**

No modificar

* No crear una nueva base de datos.  
* No alterar migraciones existentes.  
* No modificar políticas RLS actuales.  
* No modificar seed.sql.  
* No alterar la configuración principal de Supabase.

### **Arquitectura**

Mantener separación

* No mezclar lógica con componentes.  
* No realizar consultas directas a Supabase desde React.  
* Toda la lógica deberá estar en Services y Hooks.  
* No duplicar funcionalidades existentes.

### **Alcance**

Fuera de alcance

* Agentes inteligentes multi-tool.  
* MCP.  
* Panel administrativo.  
* Testing automatizado.  
* CI/CD.  
* Entrenamiento de modelos.

# 7\. Resultado Esperado:

Al finalizar el laboratorio deberá existir un sistema RAG completamente funcional integrado en ReadHub.

La aplicación deberá permitir:

* Publicar artículos.  
* Generar embeddings automáticamente.  
* Almacenar vectores en pgvector.  
* Realizar consultas en lenguaje natural.  
* Recuperar artículos relevantes.  
* Generar respuestas utilizando Claude.  
* Mostrar las fuentes utilizadas.  
* Navegar desde las respuestas hacia los artículos originales.

# 8\. Criterios de Aceptación:

El laboratorio se considerará aprobado únicamente si se cumplen todas las siguientes condiciones:

| Componente | Resultado esperado |
| ----- | ----- |
| pgvector | Instalado y funcional |
| Embeddings | Se generan correctamente |
| Indexación | Es automática |
| Similarity Search | Recupera documentos relevantes |
| Context Builder | Construye prompts válidos |
| Chat | Responde usando el contexto |
| Fuentes | Se muestran correctamente |
| Arquitectura | Se mantiene la separación de capas |
| Compilación | npm run dev funciona sin errores |

# 9\. Casos de Prueba:

### **Caso 1 — Indexación automática**

Crítico

### **Caso 2 — Recuperación semántica**

Crítico

### **Caso 3 — Respuesta contextual**

Crítico

### **Caso 4 — Sin información relevante**

Importante

### **Caso 5 — Navegación desde fuentes**

Importante

### **Validaciones Técnicas**

Obligatorio

* No existen errores en consola.  
* Las consultas vectoriales utilizan índices.  
* No existen embeddings duplicados.  
* Las respuestas citan correctamente las fuentes.  
* La arquitectura mantiene separación UI / Hooks / Services / Supabase.  
* La aplicación continúa funcionando mediante npm run dev.

