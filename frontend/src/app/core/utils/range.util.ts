/** Array `[0, 1, ..., n-1]`, para iterar un número fijo de veces con `@for` (ej. filas de un skeleton). */
export function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}
