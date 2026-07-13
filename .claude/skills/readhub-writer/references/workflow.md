# Flujo de trabajo — las 6 fases

Cada fase termina en una **puerta**. No la cruces sin confirmación explícita del
autor. Si el autor entra a mitad del proceso (por ejemplo, con un borrador ya
escrito), salta a la fase que corresponda y dilo: *"Empiezo en la fase 4; si
quieres revisamos antes la estructura."*

---

## Fase 1 — Encuadre

**Objetivo:** que el autor y tú compartáis la misma idea del artículo antes de
gastar una sola frase.

Pregunta lo mínimo imprescindible. **No hagas un interrogatorio**: propón
respuestas por defecto a partir de lo que ya te haya contado y pide que las
corrija.

1. **Tesis en una frase.** ¿Qué afirma este artículo? Si el autor no puede
   resumirlo en una oración, aún no está listo para escribir. Ayúdale a
   destilarla.
2. **Audiencia.** ¿Estudiantes? ¿Profesionales del área? ¿Público general?
   Determina qué se puede dar por sabido.
3. **Tipo.** Divulgación · tutorial técnico · revisión de literatura ·
   investigación original · ensayo de opinión fundamentado.
4. **Alcance y extensión.** Qué queda **fuera** es tan importante como qué entra.

**Puerta 1:** el autor confirma tesis, audiencia, tipo y alcance.
Devuélvelo en 4 líneas y pide "¿lo doy por bueno?".

> Señal de alarma: si la tesis es una descripción del tema ("hablaré sobre
> SCRUM") y no una afirmación ("SCRUM falla en equipos distribuidos porque…"),
> insiste. Un artículo sin tesis se convierte en un resumen sin propósito.

---

## Fase 2 — Investigación en ReadHub

**Objetivo:** situar el artículo respecto a lo ya publicado. Evitar duplicar,
detectar contradicciones y encontrar huecos que el artículo pueda llenar.

Lee `references/research.md` y usa el camino disponible.

1. **Artículos relacionados.** Busca por la tesis, por los conceptos clave y por
   sinónimos. Al menos 2 consultas distintas.
2. **Solapamiento.** Para cada artículo relacionado, responde: *¿qué dice ya que
   este artículo pretende decir?* Si el solape es alto, plantéalo sin rodeos:
   *"Esto ya está cubierto en [X]. Tu aportación diferencial tendría que ser…"*
3. **Contradicciones.** Si la tesis del autor choca con algo publicado,
   **dilo y cita**. No es un problema: es material para el artículo. Pero el
   autor debe abordarlo explícitamente, no ignorarlo.
4. **Huecos.** Qué preguntas dejan abiertas los artículos existentes.

**Puerta 2:** presenta un mapa breve: *relacionados · solapamiento · tensiones ·
hueco que llenas*. El autor decide si ajusta la tesis.

> Si no pudiste consultar ReadHub, **dilo en la primera línea** y no finjas un
> mapa. Ofrece continuar y verificar más adelante.

---

## Fase 3 — Planificación

**Objetivo:** un esquema que sostenga la tesis.

1. Parte de `templates/outline.md`.
2. Para **cada sección**, escribe una frase que diga qué aporta a la tesis. Si
   una sección no aporta nada, sobra: dilo.
3. Ordena por **dependencia**, no por cronología. El lector solo puede entender
   la sección N si ya tiene lo de la N−1.
4. Marca dónde harán falta **evidencias** (datos, citas, ejemplos) y de dónde
   saldrán.

**Puerta 3:** el autor aprueba el esquema. Solo entonces se redacta.

---

## Fase 4 — Redacción y mejora

**Objetivo:** que el texto diga lo que quiere decir, y solo eso.

Lee `references/writing-guide.md`. Trabaja en **pasadas separadas**; mezclarlas
produce revisiones superficiales:

| Pasada | Pregunta que respondes |
|---|---|
| **Estructura** | ¿Cada sección hace lo que prometió el esquema? |
| **Coherencia** | ¿Se sostiene el hilo? ¿Hay saltos lógicos? ¿Contradicciones internas? |
| **Claridad** | ¿Se entiende a la primera? ¿Hay jerga sin definir? |
| **Redundancia** | ¿Qué se dice dos veces? ¿Qué párrafo puede desaparecer sin pérdida? |
| **Rigor** | ¿Cada afirmación fuerte tiene apoyo? ¿Hay generalizaciones indefendibles? |

Entrega **diffs concretos**, priorizados (🔴 / 🟡 / 🟢). No reescribas el texto
entero: eso borra la voz del autor y hace la revisión imposible de auditar.

**Puerta 4:** el autor aplica (o rechaza) los cambios.

---

## Fase 5 — Metadatos

**Objetivo:** que el artículo se encuentre y se elija.

Con el texto ya estable:

1. **Títulos.** Ofrece 3–5 opciones con registros distintos (descriptivo,
   provocador, orientado al beneficio). Explica el compromiso de cada uno.
2. **Resumen.** 2–4 frases. Debe contener la **tesis**, no una descripción del
   tema. Alguien que lea solo el resumen debe saber qué se afirma.
3. **Palabras clave.** 5–8 términos. Mezcla el vocabulario del **autor** y el
   del **lector que buscaría** el artículo (no siempre coinciden).

Entrega con `templates/metadata.md`.

**Puerta 5:** el autor elige título y aprueba resumen y keywords.

> Nota de plataforma: hoy ReadHub deriva el resumen del primer párrafo del
> documento cuando es `.txt`; en PDF/DOCX queda vacío. Si el autor publica en
> PDF, el resumen que acordéis aquí **no** se cargará solo.

---

## Fase 6 — Pre-publicación

Recorre `references/publication-checklist.md` punto por punto.

Entrega un veredicto claro:

- ✅ **Listo para publicar** — o
- 🔴 **Bloqueantes** (lista numerada, cada uno accionable), y
- 🟡 recomendaciones que el autor puede ignorar.

Nunca digas "listo" si hay un bloqueante. Es la última barrera antes de que el
artículo lleve el nombre del autor.
