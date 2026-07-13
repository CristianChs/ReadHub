## Este documento contiene la especificación completa del laboratorio. Léelo completamente antes de generar cualquier código. No hagas suposiciones fuera de lo especificado. 

## **OBJETIVO LABORATORIO**

Construir un MVP completamente funcional de ReadHub utilizando la infraestructura implementada en la sesión anterior. Al finalizar el laboratorio deberá ser posible ejecutar la aplicación localmente, recorrer todos los flujos principales del sistema e interactuar con Supabase para validar visual y funcionalmente la aplicación. 

## **LABORATORIO**

Claude deberá generar automáticamente:

* Verificar la configuración existente de TailwindCSS y Shadcn/UI. Si alguno no está instalado correctamente, completar su instalación y configuración.   
* Diseñar el sistema visual del proyecto.  
* Construir los Layouts.  
* Construir la Barra de Navegación.  
* Construir los componentes reutilizables.  
* Construir e integrar funcionalmente todas las pantallas definidas utilizando la infraestructura existente de Supabase.   
* Organizar toda la lógica mediante Custom Hooks.  
* Mantener separación UI/Lógica.  
* Diseñar el responsive de las pantalla.  
* Reutilizar los componentes repetitivos entre pantallas.

# **Tecnologías Base**

* Next.js 15 (App Router)  
* React 19  
* TypeScript  
* TailwindCSS  
* Shadcn/UI  
* Supabase  
* PostgreSQL  
* Supabase Auth  
* Supabase Storage

## **Claude deberá reutilizar la infraestructura existente**

* Mantener la configuración existente de Next.js 15\.  
* Mantener la configuración de Supabase.  
* Reutilizar las migraciones existentes.  
* Reutilizar las políticas RLS existentes.  
* Reutilizar la estructura de la base de datos.  
* No modificar el esquema SQL salvo que sea estrictamente necesario.  
* No alterar las migraciones existentes.  
* No modificar `seed.sql`.  
* No modificar las políticas RLS.  
* Construir el frontend sobre la infraestructura desarrollada en la sesión anterior.

# **Arquitectura General**

├── app/  
│   ├── (auth)/  
│   │   ├── login/  
│   │   ├── register/  
│   │   └── layout.tsx  
│   │  
│   ├── (dashboard)/  
│   │   ├── page.tsx —\> pagina principal  
│   │   ├── upload/  
│   │   ├── article/  
│   │   │   └── \[id\]/  
│   │   └── layout.tsx —\> Diseño compartido  
│   │  
│   ├── api/  
│   │  
│   ├── globals.css  
│   ├── layout.tsx  
│   └── page.tsx  
│  
├── components/  
│   ├── ui/  
│   ├── layout/  
│   ├── forms/  
│   ├── cards/  
│   ├── navigation/  
│   ├── dialogs/  
│   ├── comments/  
│   └── articles/  
│  
├── hooks/ —\>(validaciones de logueo y busqueda)  
│   ├── useAuth.ts  
│   ├── [useArticles.ts](http://useArticles.ts) —\> Backend puro TS  
│   ├── useComments.ts  
│   ├── useLikes.ts  
│   └── [useUpload.ts](http://useUpload.ts)  
│  
│  
├── services/—\>(inicialización de consultas a supabase)  
│   ├── article.service.ts  
│   ├── auth.service.ts  
│   ├── storage.service.ts  
│   └── [comment.service.ts](http://comment.service.ts)  
│  
├── public/ —\> Lo que el navegador necesita  
│   ├── images/  
│   └── icons/  
│  
├── styles/  
├── [middleware.ts](http://middleware.ts) —\>(validaciones primarias, conectados a hooks)  
│  
├── components.json—\>(dirección de instalación de comp…s/ carpeta comp…)  
│  
├── [tailwind.config.ts](http://tailwind.config.ts) —\>(extensión de estilos)  
│  
├── [next.config.ts](http://next.config.ts) —\> Variables de entorno  
│  
├── tsconfig.json  
│  
├── package.json  
│  
└── README.md

# **3\. Flujo de Navegación entre Pantallas**

# **Mapa General de Navegación**

                       ┌──────────────────────┐

                        │      Inicio          │

                        │ (Login / Registro)   │

                        └──────────┬───────────┘

                                   │

                     Login exitoso │

                                   ▼

                     ┌─────────────────────────┐

                     │ Página Principal (Home) │

                     │ Listado de Artículos    │

                     └──────┬───────────┬──────┘

                            │           │

                            │           │

               Ver artículo │           │ Crear artículo

                            ▼           ▼

                  ┌──────────────┐   ┌─────────────────┐

                  │   Artículo                      │   │ Subir Artículo                     │

                  │   Completo                   │   └────────┬────────┘

                  └──────┬───────┘                           │

                                    │                                                 │

                                    └────────────┬───────┘

                                      ▼

                          Regresar a la Página Principal

# **Flujo 1\. Inicio de la Aplicación**

Cuando un usuario accede a la plataforma deberá visualizar únicamente la pantalla de autenticación.

Esta pantalla será el punto de entrada obligatorio para todos los usuarios no autenticados.

La interfaz mostrará:

* Logotipo de la plataforma.  
* Nombre del producto.  
* Formulario de inicio de sesión.  
* Botón "Iniciar Sesión".  
* Botón "Registrarse".

No deberá mostrarse ninguna otra funcionalidad antes de autenticarse.

---

# **Flujo 2\. Registro**

Al seleccionar el botón **Registrarse**, el formulario cambiará dinámicamente sin abandonar la página.

El usuario visualizará los siguientes campos:

* Correo electrónico.  
* Fecha de nacimiento.  
* Número celular.  
* Contraseña.

Una vez enviado el formulario:

* Se validarán los datos.  
* Se almacenará el usuario en la base de datos.  
* Se mostrará un mensaje indicando que el registro fue exitoso y accederá la página principal.

---

# **Flujo 3\. Inicio de Sesión**

El usuario ingresará:

* Correo electrónico.  
* Contraseña.

Si las credenciales son correctas:

* Se creará una sesión autenticada.  
* El usuario será redirigido a la página principal.

Si las credenciales son incorrectas:

* Permanecerá en la misma pantalla.  
* Se mostrará un mensaje de error.  
* Los datos ingresados permanecerán visibles, excepto la contraseña.

---

# **Flujo 4\. Página Principal**

Después del inicio de sesión, el usuario accederá a la página principal.

La interfaz estará compuesta por:

## **Barra de navegación**

La barra superior deberá contener:

* Logotipo.  
* Nombre de la plataforma.  
* Botón Inicio.  
* Botón Cargar Artículo.  
* Nombre del usuario autenticado.  
* Botón Cerrar Sesión.

---

## **Área Principal**

El contenido central mostrará todos los artículos disponibles.

Cada artículo se representará mediante una tarjeta con:

* Imagen de portada.  
* Título.  
* Resumen.  
* Autor.  
* Fecha de publicación.  
* Número de visualizaciones.  
* Cantidad de "Me gusta".

Cada tarjeta será completamente seleccionable.

Al hacer clic sobre ella, el usuario accederá al artículo completo.

---

# **Flujo 5\. Visualización de un Artículo**

Al abrir un artículo deberán ocurrir automáticamente las siguientes acciones:

* Registrar una nueva visualización.  
* Obtener el contenido desde la base de datos.  
* Mostrar el documento completo.  
* Mostrar la imagen de portada.  
* Mostrar los comentarios existentes.  
* Mostrar la cantidad de "Me gusta".

Desde esta pantalla el usuario podrá:

* Leer el contenido.  
* Dar "Me gusta".  
* Escribir comentarios.  
* Regresar al inicio.

---

# **Flujo 6\. Publicación de un Artículo**

Al seleccionar **Cargar Artículo**, el usuario accederá al formulario de publicación.

El formulario incluirá:

* Título.  
* Selección del documento.  
* Selección de imagen de portada.  
* Botón Publicar.  
* Botón Cancelar.

---

## **Validaciones**

Antes de almacenar la información deberán verificarse las siguientes condiciones:

* El título no puede estar vacío.  
* Debe seleccionarse un documento válido.  
* El documento debe tener formato TXT, DOCX o PDF.  
* Debe seleccionarse una imagen válida.

Si alguna validación falla, el formulario permanecerá abierto mostrando el mensaje correspondiente.

---

## **Publicación Exitosa**

Cuando el artículo sea almacenado correctamente:

* El documento será guardado en el servidor.  
* La imagen será almacenada.  
* El registro será insertado en la base de datos.  
* El usuario será redirigido automáticamente a la página principal.

El nuevo artículo deberá aparecer inmediatamente en el listado.

---

# **Flujo 7\. Comentarios**

Desde la vista del artículo, el usuario podrá escribir un comentario.

Al enviarlo:

* El comentario será almacenado.  
* Se actualizará la lista de comentarios.  
* No será necesario recargar la página.

---

# **Flujo 8\. Likes**

Cada usuario podrá indicar que un artículo le gusta.

Al presionar el botón correspondiente:

* Se almacenará el registro en la base de datos.  
* Se actualizará el contador.  
* El usuario no podrá registrar múltiples "Me gusta" sobre el mismo artículo.

---

# **Flujo 9\. Cierre de Sesión**

Al seleccionar **Cerrar Sesión**:

* Se eliminará la sesión activa.  
* Se invalidarán los datos de autenticación.  
* El usuario será redirigido nuevamente a la pantalla de inicio de sesión.

No será posible acceder nuevamente a las páginas protegidas utilizando el botón "Atrás" del navegador.

---

# **Reglas Generales de Navegación**

Durante toda la aplicación deberán cumplirse las siguientes reglas:

* Todas las pantallas protegidas requerirán una sesión autenticada.  
* Las rutas privadas no deberán ser accesibles directamente mediante URL.  
* Después de cada acción exitosa, el usuario recibirá una confirmación visual.  
* Ante cualquier error, el sistema mostrará un mensaje claro indicando el problema y cómo corregirlo.  
* La navegación deberá mantener siempre una experiencia fluida y consistente.

---

# **Consideraciones de Diseño**

Claude Code deberá utilizar una interfaz moderna y limpia, inspirada en plataformas de publicación de contenido como Medium, Dev.to o Hashnode, manteniendo un estilo minimalista.

Se recomienda:

* Espaciado consistente entre componentes.  
* Tarjetas con esquinas redondeadas.  
* Sombras sutiles para resaltar elementos interactivos.  
* Botones con estados *hover*, *focus* y *disabled*.  
* Tipografía legible y jerarquía visual clara.  
* Diseño responsive desde el inicio (*mobile-first* cuando sea posible).

El objetivo es ofrecer una experiencia de usuario agradable y profesional sin sacrificar simplicidad o rendimiento.

---

# **Regla General**

Todas las funcionalidades implementadas deberán respetar las reglas definidas en este documento.

Si durante el desarrollo surge un conflicto entre una decisión de implementación y una regla de negocio, prevalecerá siempre la regla de negocio.

---

# **Seguridad**

La API deberá cumplir las siguientes reglas:

* Todas las rutas privadas requerirán autenticación.  
* Las contraseñas nunca viajarán cifradas manualmente; se utilizará HTTPS en producción.  
* No se expondrán datos sensibles como `password_hash`.  
* Las cargas de archivos deberán validar tipo y tamaño antes de almacenarse.  
* Las respuestas de error no deberán revelar información interna del servidor.

---

# **Versionado**

Desde el inicio, la API deberá diseñarse para soportar versionado.

Ejemplo:

/api/v1/auth/login

/api/v1/articles

Aunque inicialmente solo exista la versión `v1`, toda la estructura deberá quedar preparada para futuras versiones sin romper la compatibilidad con los clientes existentes.

---

# **7\. Especificación de la API REST**

## **Objetivo**

La aplicación expondrá una API REST que permitirá la comunicación entre el Frontend y el Backend.

Todas las operaciones deberán intercambiar información utilizando JSON, excepto aquellas que impliquen carga de archivos, las cuales utilizarán `multipart/form-data`.

La API deberá seguir principios REST y utilizar correctamente los métodos HTTP.

---

# **URL Base**

http://localhost:3000/api

---

# **Convenciones Generales**

## **Métodos HTTP**

| Método | Uso |
| ----- | ----- |
| GET | Obtener información |
| POST | Crear recursos |
| PUT | Actualizar completamente un recurso |
| PATCH | Actualizar parcialmente un recurso |
| DELETE | Eliminar recursos |

---

## **Códigos HTTP**

| Código | Significado |
| ----- | ----- |
| 200 | Operación exitosa |
| 201 | Recurso creado |
| 204 | Sin contenido |
| 400 | Solicitud inválida |
| 401 | No autenticado |
| 403 | Acceso denegado |
| 404 | Recurso inexistente |
| 409 | Conflicto (ej. correo duplicado) |
| 422 | Error de validación |
| 500 | Error interno |

---

# **Módulo de Autenticación**

## **Registrar Usuario**

### **Endpoint**

POST /api/auth/register

### **Request**

{

  "email": "usuario@email.com",

  "birth\_date": "2000-01-15",

  "phone": "3001234567",

  "password": "MiPassword123"

}

### **Response (201)**

{

  "message": "Usuario registrado correctamente."

}

---

## **Iniciar Sesión**

POST /api/auth/login

### **Request**

{

  "email": "usuario@email.com",

  "password": "MiPassword123"

}

### **Response**

{

  "message": "Inicio de sesión exitoso.",

  "user": {

    "id": 1,

    "email": "usuario@email.com",

    "role": "writer"

  }

}

---

## **Cerrar Sesión**

POST /api/auth/logout

### **Response**

{

  "message": "Sesión cerrada correctamente."

}

---

## **Usuario Autenticado**

GET /api/auth/me

### **Response**

{

  "id": 1,

  "email": "usuario@email.com",

  "role": "writer"

}

---

# **Módulo de Artículos**

## **Obtener todos los artículos**

GET /api/articles

### **Response**

\[

  {

    "id": 1,

    "title": "Mi primer artículo",

    "summary": "Primer párrafo...",

    "image": "/uploads/images/cover.jpg",

    "author": "Juan Pérez",

    "views": 150,

    "likes": 35

  }

\]

---

## **Obtener un artículo**

GET /api/articles/{id}

### **Response**

{

  "id": 1,

  "title": "Mi primer artículo",

  "summary": "...",

  "content": "...",

  "image": "...",

  "author": "...",

  "comments": \[\],

  "likes": 20,

  "views": 180

}

---

## **Crear artículo**

POST /api/articles

### **Content-Type**

multipart/form-data

### **Campos**

* title  
* document  
* image

### **Response**

{

  "message": "Artículo publicado correctamente."

}

---

## **Editar artículo**

PUT /api/articles/{id}

### **Request**

{

  "title": "Nuevo título"

}

---

## **Eliminar artículo**

DELETE /api/articles/{id}

---

# **Respuesta de Error**

Todos los errores deberán seguir una estructura uniforme.

{

  "success": false,

  "error": {

    "code": "VALIDATION\_ERROR",

    "message": "El correo electrónico ya se encuentra registrado."

  }

}

---

# **Respuesta Exitosa**

{

  "success": true,

  "data": { }

}

o

{

  "success": true,

  "message": "Operación realizada correctamente."

}

# **Criterios de Aceptación**

La navegación se considerará correcta cuando sea posible completar el siguiente recorrido sin errores:

1. Abrir la aplicación.  
2. Registrar un nuevo usuario.  
3. Iniciar sesión.  
4. Acceder a la página principal.  
5. Publicar un artículo.  
6. Ver el artículo en el listado.  
7. Abrir el artículo.  
8. Regresar al inicio.  
9. Cerrar la sesión.

# **8\. Funcionalidades Mínimas Obligatorias**

El laboratorio deberá implementar las funcionalidades mínimas necesarias para obtener un MVP completamente funcional de ReadHub utilizando la infraestructura desarrollada en la sesión anterior.

## **8.1 Autenticación**

Deberá implementarse completamente la integración con Supabase Auth.

Como mínimo deberá permitir:

* Registro de nuevos usuarios.  
* Inicio de sesión.  
* Cierre de sesión.  
* Persistencia de la sesión entre recargas.  
* Protección de rutas privadas.  
* Redirección automática según el estado de autenticación.

Las operaciones deberán utilizar Supabase Auth y respetar las políticas RLS implementadas en la sesión anterior.

---

## **8.2 Página Principal**

La página principal deberá consultar los artículos almacenados en Supabase.

Como mínimo deberá mostrar:

* Imagen de portada.  
* Título.  
* Resumen.  
* Autor.  
* Fecha de publicación.  
* Número de visualizaciones.  
* Cantidad de "Me gusta".

La información deberá obtenerse desde la base de datos y no mediante datos simulados.

---

## **8.3 Publicación de Artículos**

El formulario de publicación deberá encontrarse completamente operativo.

Como mínimo deberá permitir:

* Ingresar el título.  
* Seleccionar un documento.  
* Seleccionar una imagen de portada.  
* Validar la información antes del envío.  
* Almacenar el documento en Supabase Storage.  
* Almacenar la imagen en Supabase Storage.  
* Registrar el artículo en la base de datos.  
* Redirigir automáticamente al usuario a la página principal.

---

## **8.4 Visualización de Artículos**

Al abrir un artículo deberán ejecutarse automáticamente las acciones definidas en el documento.

Como mínimo:

* Registrar una nueva visualización.  
* Obtener la información desde Supabase.  
* Mostrar el contenido del artículo.  
* Mostrar la imagen de portada.  
* Mostrar los comentarios existentes.  
* Mostrar la cantidad de "Me gusta".

---

## **8.5 Comentarios**

La vista del artículo deberá permitir:

* Crear comentarios.  
* Almacenar los comentarios en la base de datos.  
* Actualizar automáticamente la lista de comentarios sin recargar la página.

---

## **8.6 Likes**

El usuario deberá poder registrar un "Me gusta" sobre un artículo.

La implementación deberá respetar las restricciones definidas por las políticas RLS y evitar múltiples registros sobre el mismo artículo.

---

## **8.7 Navegación**

Todas las pantallas deberán encontrarse completamente conectadas.

El usuario deberá poder recorrer toda la aplicación sin acceder manualmente a rutas mediante la URL.

---

## **8.8 Arquitectura Frontend**

La implementación deberá respetar la arquitectura definida para el proyecto.

Como mínimo deberá incluir:

* App Router.  
* Layouts.  
* Componentes reutilizables.  
* Hooks.  
* Services.  
* Separación entre presentación y lógica.  
* Diseño responsive.

---

# **9\. Restricciones del Laboratorio**

Este laboratorio tiene como objetivo desarrollar exclusivamente la capa de presentación e integrar la infraestructura desarrollada en la sesión anterior.

Por lo tanto, deberán respetarse las siguientes restricciones.

## **Infraestructura**

No deberá:

* Crear una nueva base de datos.  
* Modificar el esquema SQL existente.  
* Crear nuevas migraciones salvo que sean estrictamente necesarias.  
* Modificar las políticas RLS existentes.  
* Modificar el archivo `seed.sql`.  
* Alterar la configuración principal de Supabase.

Toda la infraestructura desarrollada en la sesión anterior deberá reutilizarse.

---

## **Arquitectura**

No deberá:

* Cambiar la estructura general del proyecto.  
* Duplicar componentes.  
* Mezclar lógica de negocio con componentes de interfaz.  
* Realizar consultas directas a Supabase desde los componentes.

Toda interacción con Supabase deberá realizarse mediante la capa Services y ser consumida a través de Custom Hooks.

---

## **Desarrollo**

No deberán utilizarse datos simulados cuando exista una implementación funcional utilizando Supabase.

Toda la información visualizada deberá obtenerse desde la base de datos siempre que sea posible.

---

## **Alcance**

No deberán implementarse funcionalidades correspondientes a sesiones posteriores, tales como:

* Sistemas RAG.  
* Embeddings.  
* Motores vectoriales.  
* MCP.  
* Custom Skills.  
* Testing automatizado.  
* Playwright.  
* Vitest.  
* CI/CD.  
* Optimización de rendimiento.  
* Panel administrativo.  
* Agentes inteligentes.

---

# **10\. Resultado Esperado**

Al finalizar el laboratorio deberá existir una primera versión completamente funcional de ReadHub.

La aplicación deberá poder ejecutarse localmente utilizando:

npm install

npm run dev

La compilación deberá completarse sin errores y todas las dependencias necesarias deberán encontrarse correctamente configuradas.

La aplicación deberá iniciar correctamente y permitir recorrer los principales flujos definidos para el MVP.

La navegación deberá ser completamente funcional y todas las pantallas principales deberán encontrarse conectadas entre sí.

La información deberá obtenerse desde Supabase utilizando la infraestructura implementada en la sesión anterior.

La arquitectura deberá mantenerse modular, reutilizable y preparada para incorporar las funcionalidades de Inteligencia Artificial, RAG, Testing y CI/CD en las siguientes sesiones.

---

# **11\. Definición de MVP**

El MVP se considerará finalizado cuando sea posible ejecutar la aplicación y completar satisfactoriamente el siguiente recorrido sin errores funcionales.

## **Flujo Principal**

1. Abrir la aplicación.  
2. Registrar un nuevo usuario.  
3. Iniciar sesión.  
4. Acceder a la página principal.  
5. Visualizar el listado de artículos.  
6. Publicar un nuevo artículo.  
7. Subir correctamente el documento y la imagen de portada.  
8. Ver el nuevo artículo publicado en la página principal.  
9. Abrir el artículo.  
10. Registrar automáticamente una nueva visualización.  
11. Publicar un comentario.  
12. Registrar un "Me gusta".  
13. Regresar a la página principal.  
14. Cerrar la sesión.

---

## **Criterios de Aceptación del MVP**

El MVP se considerará exitoso únicamente si se cumplen todas las siguientes condiciones:

* La aplicación compila sin errores.  
* La aplicación puede ejecutarse mediante `npm run dev`.  
* La autenticación funciona correctamente mediante Supabase Auth.  
* Todas las rutas protegidas requieren autenticación.  
* Los artículos se almacenan correctamente en la base de datos.  
* Los archivos se almacenan correctamente en Supabase Storage.  
* La página principal muestra información obtenida desde Supabase.  
* Las visualizaciones se registran automáticamente.  
* Los comentarios se almacenan correctamente.  
* Los "Me gusta" respetan las políticas RLS implementadas.  
* La navegación entre todas las pantallas es completamente funcional.  
* La interfaz mantiene un diseño responsive y consistente.  
* La arquitectura respeta la separación entre Components, Hooks y Services.  
* El proyecto queda preparado para desarrollar las funcionalidades de IA, RAG, Testing y Despliegue en las siguientes sesiones sin necesidad de reorganizar la arquitectura existente.

