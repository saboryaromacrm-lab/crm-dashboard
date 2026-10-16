/**
 * EFECTIVO POR TRANSFERENCIA (0175) — el resumen del reporte: cuánto se cambió
 * y con quién. El nombre se escribe a mano cada vez (decisión del dueño), así
 * que «Juan» y «juan » son la misma persona: se agrupa sin mayúsculas, tildes
 * ni espacios de más, y se muestra como se escribió la primera vez.
 */
const clave = (nombre) => String(nombre ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();

export function resumenCambios(pagos) {
  const porPersona = new Map();
  let total = 0;
  for (const p of pagos ?? []) {
    total += p.importe;
    const k = clave(p.cambioPor);
    const x = porPersona.get(k) ?? { persona: String(p.cambioPor).trim(), cantidad: 0, total: 0 };
    x.cantidad += 1;
    x.total += p.importe;
    porPersona.set(k, x);
  }
  const r2 = (n) => Math.round(n * 100) / 100;
  return {
    total: r2(total),
    cantidad: (pagos ?? []).length,
    porPersona: [...porPersona.values()].map((x) => ({ ...x, total: r2(x.total) })).sort((a, b) => b.total - a.total),
  };
}
