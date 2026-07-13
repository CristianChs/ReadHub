import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// ============================================================================
// Setup de los tests de la app web. Se ejecuta ANTES de cada fichero de test.
//
// Tres cosas, ninguna de ellas específica de un test concreto:
//
//   1. Matchers de DOM (`toBeInTheDocument`, `toBeDisabled`, …) sobre el
//      `expect` de Vitest.
//   2. Desmontaje del árbol de React entre tests. Sin esto, un componente
//      montado en un test seguiría en el DOM del siguiente y las consultas de
//      Testing Library encontrarían dos coincidencias.
//   3. Credenciales de Supabase de mentira: `lib/supabase/client.ts` las lee al
//      construir el cliente y reventaría con `undefined`. En los tests ese
//      cliente se fakea, pero el módulo debe poder importarse.
// ============================================================================

afterEach(() => {
  cleanup();
});

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
