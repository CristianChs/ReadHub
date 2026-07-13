---
name: readhub-automatic-validator
description: Quality gate para cambios en ReadHub — invocar antes de dar un cambio por "terminado", antes de hacer commit, o cuando el usuario pida "valida esto", "valida el código", o "¿está listo para mergear?". A diferencia de readhub-code-reviewer (que solo reporta), esta skill emite un veredicto de aprobado/rechazado contra una checklist fija y BLOQUEA la aceptación si algo falla, con un informe de "VALIDACIÓN FALLIDA". Ejecutar primero las reglas de readhub-architecture-enforcer y las verificaciones de readhub-code-reviewer — esta skill consume esos hallazgos para emitir el veredicto.
---

# ReadHub Automatic Validator

Esto es un filtro de aceptación, no una recomendación. La salida es binaria: VALIDACIÓN APROBADA o VALIDACIÓN FALLIDA. Un solo ítem de la checklist que falle es suficiente para que todo el gate falle — no existe una aprobación parcial. No suavizar un fallo convirtiéndolo en "aprobado con observaciones".

Esta skill no corrige el código por sí misma. Reporta qué está mal y qué habría que cambiar; el usuario o una edición posterior hace la corrección, y luego se vuelve a correr el gate.

## Checklist

Revisar cada ítem. Marcar CUMPLE / NO CUMPLE / NO VERIFICADO (NO VERIFICADO cuando no hay forma de confirmarlo en esta sesión, por ejemplo si no se puede ejecutar un comando — decirlo explícitamente, no adivinar).

1. Compila — `npm run build` (o `npm run type-check` si un build completo es demasiado lento o está fuera de alcance) se ejecuta con éxito desde la raíz del repo.
2. TypeScript correcto — sin `any` injustificado, sin `unknown` sin acotar, sin `@ts-ignore`/`@ts-expect-error` sin explicación.
3. ESLint — `npm run lint` pasa (reglas next/core-web-vitals + next/typescript).
4. Arquitectura — cumple cada regla de `readhub-architecture-enforcer` (raíces del monorepo, Componente→Hook→Service→Base de datos, aislamiento de packages/ai, sin clientes de Supabase ad hoc, aislamiento de MCP, sin router `pages/`).
5. SOLID — ninguna clase/service/función asume más de una responsabilidad clara (ver `readhub-tech-lead` para el análisis más profundo de SRP si hace falta desglosarlo).
6. Clean Code — nombres descriptivos, funciones de propósito único y de tamaño razonable, sin código muerto, sin bloques comentados salvo los bloques intencionales de reversión a OpenAI/Claude documentados en `CLAUDE.md`.
7. Sin duplicación — ninguna lógica copiada y pegada donde un `packages/services`, `packages/shared` o hook existente ya hace lo mismo.
8. Manejo de errores — las llamadas asíncronas a Supabase/IA/fetch tienen manejo de errores; las fallas llegan a la UI o al llamador en lugar de fallar en silencio.
9. Seguridad — sin secretos hardcodeados, sin `admin.ts`/service role alcanzable desde `"use client"`, sin inyección de HTML sin sanitizar, sin SQL construido por concatenación de strings.
10. Performance — sin patrones N+1 evidentes, sin fetch/render redundante, sin `select('*')` no acotado sin `.limit()` donde el conjunto de datos puede crecer.
11. Tipado — las firmas de funciones públicas (exports de services, valores de retorno de hooks) están tipadas explícitamente, no dejadas a inferencia amplia.
12. Documentación — la lógica no obvia (workarounds, invariantes sutiles) tiene un comentario breve; ni más ni menos — no reprobar código por carecer de docstrings que la propia política de comentarios de `CLAUDE.md` tampoco pediría.
13. RLS — cualquier cambio nuevo de tabla/política tiene su migración correspondiente en `supabase/migrations/*.sql`, y las copias de referencia `supabase/schema.sql` / `policies.sql` están actualizadas para coincidir; RLS no se evade desde código alcanzable por el cliente.
14. Hooks correctos — los hooks solo sostienen estado/orquestación, sin lógica de negocio embebida que debería estar en un service.
15. Services correctos — los services reciben un `SupabaseClient` inyectable, contienen la lógica real, devuelven datos planos, sin JSX ni conciencia de React.
16. Componentes pequeños — ningún componente mezcla árboles de render grandes con lógica inline pesada que debería extraerse a un hook, subcomponente o service.
17. Imports válidos — los imports usan el archivo específico exportado por un package (`@readhub/services/article.service`), nunca un barril `"."` inexistente; se respetan los límites internos entre packages (sin import cruzado entre `apps/mcp` y `apps/web`).
18. Naming — consistente con las convenciones del código circundante (nombres de archivo, casing, patrones ya establecidos como `*.service.ts` / `use*.ts`).
19. Tests — solo a modo de nota, no reprueba por sí solo: este repo no tiene suite de tests (`CLAUDE.md` — sin script de test, sin framework configurado). No exigir tests que el propio tooling del proyecto no soporta; si el usuario está introduciendo un framework de testing, sí validar que los tests nuevos efectivamente corren.

## Formato de salida

### Si todo cumple:

```
## VALIDACIÓN APROBADA

Checklist: 19/19 (o N/19, listando los NO VERIFICADO y por qué no se pudieron confirmar)
```

### Si algo falla:

```
## VALIDACIÓN FALLIDA

Motivo:
- [Ítem de la checklist] — [archivo:línea] — descripción concreta (por ejemplo, "Uso de `any` en ArticleService.getById sin necesidad, el tipo ya existe en database.ts")

Correcciones sugeridas:
- [archivo:línea] — corrección específica y accionable (no "mejorar el tipado" — decir qué tipo usar y de dónde sale)
```

Listar todos los ítems que fallan, no solo el primero encontrado — el usuario debe recibir una pasada completa de feedback, no un goteo de fallos individuales en corridas repetidas.
