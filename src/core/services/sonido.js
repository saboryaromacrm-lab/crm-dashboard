/**
 * LAS CAMPANITAS DE LOS AVISOS — una sola forma de sonar.
 * ============================================================================
 * Cada aviso vivo (órdenes web, Coffit, precios, pedidos a fraccionado) tiene
 * su melodía para que el oído lo distinga sin mirar; cómo se toca es lo mismo.
 * Sin audio disponible no pasa nada: el aviso visual alcanza.
 *
 * `notas`: [frecuencia Hz, arranque s, duración s] de cada nota.
 */
export function tocarNotas(notas, { onda = 'sine', volumen = 0.18 } = {}) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    for (const [freq, t0, dur] of notas) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = onda;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + t0);
      gain.gain.exponentialRampToValueAtTime(volumen, ctx.currentTime + t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t0 + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + t0);
      osc.stop(ctx.currentTime + t0 + dur + 0.05);
    }
    const fin = Math.max(...notas.map(([, t0, dur]) => t0 + dur));
    setTimeout(() => ctx.close(), (fin + 0.6) * 1000);
  } catch { /* sin audio disponible: el aviso visual alcanza */ }
}
