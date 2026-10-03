/**
 * QUÉ BILLETES QUEDAN EN LA CAJA Y CUÁLES VAN AL SOBRE (0130, pedido del dueño).
 *
 * De lo contado, se apartan billetes que sumen EXACTO lo que tiene que quedar
 * (el fondo); si con esos billetes no se puede exacto, lo más cerca POR ARRIBA
 * (queda un poco más, nunca menos). Entre las formas de llegar, la que deja los
 * billetes MÁS CHICOS en la caja: son los del cambio del turno siguiente. El
 * resto va al sobre. Contó menos que el fondo: queda todo, sobre vacío.
 *
 * Es la misma regla que el servidor (`proponerSeparacion` en caja.module.ts),
 * duplicada porque son proyectos separados. Cuenta en unidades de $10.
 */
export const DENOMINACIONES = [20000, 10000, 2000, 1000, 500, 200, 100, 50, 20];

const soloPositivos = (den, cant) => {
  const o = {};
  den.forEach((d, i) => { if (cant[i] > 0) o[d] = cant[i]; });
  return o;
};

export function sumaBilletes(b) {
  return Object.entries(b ?? {}).reduce((a, [d, n]) => a + Number(d) * (Math.floor(Number(n)) || 0), 0);
}

export function separarEnvio(billetes, objetivoQueda) {
  const den = [...DENOMINACIONES];
  const cant = den.map((d) => Math.max(0, Math.floor(Number(billetes?.[d]) || 0)));
  const total = den.reduce((a, d, i) => a + d * cant[i], 0);
  const objetivo = Math.max(0, Math.min(total, Number(objetivoQueda) || 0));
  const todos = () => ({ queda: soloPositivos(den, cant), envio: {} });
  if (objetivo >= total - 0.009) return todos();
  const U = 10;
  const meta = Math.ceil(objetivo / U - 1e-9);
  const tope = Math.min(Math.round(total / U), meta + 2000);
  // alcanza[i][v]: se puede armar v con los billetes de i en adelante (los más chicos).
  const alcanza = new Array(den.length + 1);
  alcanza[den.length] = new Uint8Array(tope + 1); alcanza[den.length][0] = 1;
  for (let i = den.length - 1; i >= 0; i -= 1) {
    const paso = den[i] / U; const c = cant[i]; const prev = alcanza[i + 1]; const cur = new Uint8Array(tope + 1);
    for (let r = 0; r < paso; r += 1) {
      let ultimo = -Infinity;
      for (let k = 0, v = r; v <= tope; k += 1, v += paso) {
        if (prev[v]) ultimo = k;
        if (k - ultimo <= c) cur[v] = 1;
      }
    }
    alcanza[i] = cur;
  }
  let v = -1;
  for (let x = meta; x <= tope; x += 1) if (alcanza[0][x]) { v = x; break; }
  if (v < 0) return todos();
  const quedaCant = den.map(() => 0);
  for (let i = 0; i < den.length; i += 1) {
    const paso = den[i] / U;
    for (let k = 0; k <= cant[i]; k += 1) {
      if (v - k * paso < 0) break;
      if (alcanza[i + 1][v - k * paso]) { quedaCant[i] = k; v -= k * paso; break; }
    }
  }
  return { queda: soloPositivos(den, quedaCant), envio: soloPositivos(den, cant.map((c, i) => c - quedaCant[i])) };
}
