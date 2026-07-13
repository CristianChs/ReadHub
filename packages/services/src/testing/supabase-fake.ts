import type { TypedSupabaseClient } from "@readhub/database";

// ============================================================================
// Cliente de Supabase FALSO para las pruebas de los services.
//
// No es una librería de mocks ni un doble "inteligente": es el mínimo capaz de
// imitar la interfaz encadenable de PostgREST
// (`from().select().eq().order()` … y los terminales `single`/`maybeSingle`).
//
// Existe porque los services reciben el cliente como PARÁMETRO: basta con
// pasarles otro objeto. No hay que interceptar módulos, ni tocar el entorno, ni
// levantar una base de datos. La arquitectura ya lo permitía; esto solo lo
// aprovecha.
//
// Este fichero NO es lógica de producción: solo lo importan los `*.test.ts`
// (queda fuera del bundle, que se construye desde `index.ts`, y fuera de la
// cobertura, que excluye lo que no es código de producción).
// ============================================================================

export interface FakeResult {
  data: unknown;
  error: unknown;
}

export interface RecordedCall {
  table: string;
  op: string;
  args: unknown[];
}

/** Operaciones encadenables: devuelven el propio builder. */
const CHAINABLE = [
  "select",
  "eq",
  "in",
  "or",
  "order",
  "limit",
  "insert",
  "update",
  "delete",
] as const;

/**
 * Construye un cliente falso.
 *
 * `byTable` asocia cada tabla a la respuesta que debe devolver. Si se pasa un
 * array con varias respuestas, se consumen en orden (útil cuando un service
 * consulta la misma tabla dos veces); con una sola, se reutiliza siempre.
 */
export function createSupabaseFake(byTable: Record<string, FakeResult | FakeResult[]>) {
  const calls: RecordedCall[] = [];
  const queues = new Map<string, FakeResult[]>(
    Object.entries(byTable).map(([table, value]) => [
      table,
      Array.isArray(value) ? [...value] : [value],
    ]),
  );

  const nextResult = (table: string): FakeResult => {
    const queue = queues.get(table);
    if (!queue || queue.length === 0) {
      // Falla ruidosamente: un service que consulta una tabla inesperada es un
      // bug que el test debe delatar, no algo que deba resolverse con `null`.
      throw new Error(
        `supabase-fake: no hay respuesta preparada para la tabla "${table}".`,
      );
    }
    return queue.length === 1 ? queue[0] : queue.shift()!;
  };

  const builder = (table: string) => {
    const chain: Record<string, unknown> = {};

    for (const op of CHAINABLE) {
      chain[op] = (...args: unknown[]) => {
        calls.push({ table, op, args });
        return chain;
      };
    }

    const resolve = () => Promise.resolve(nextResult(table));
    chain.maybeSingle = resolve;
    chain.single = resolve;
    // Hace el builder "awaitable": `await supabase.from(t).select()` resuelve.
    chain.then = (onOk: unknown, onErr: unknown) =>
      resolve().then(onOk as never, onErr as never);

    return chain;
  };

  return {
    client: {
      from: (table: string) => builder(table),
    } as unknown as TypedSupabaseClient,

    /** Todas las operaciones ejecutadas, en orden. Para asertar el QUÉ se pidió. */
    calls,

    /** Argumentos de la primera llamada a una operación concreta. */
    argsOf(op: string): unknown[] | undefined {
      return calls.find((call) => call.op === op)?.args;
    },
  };
}
