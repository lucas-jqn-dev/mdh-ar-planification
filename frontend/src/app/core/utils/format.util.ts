const montoFormatter = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

export function formatMonto(value: number): string {
  return montoFormatter.format(value || 0);
}
