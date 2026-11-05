/**
 * VISTA PROFESIONAL · LAS CUENTAS (5/11/2026). Sin React: arma la serie del
 * local elegido, compara el último período COMPLETO contra el anterior, proyecta
 * el que está en curso y escribe las lecturas en castellano llano.
 *
 * Por qué el último completo y no el en curso: comparar 5 días de noviembre
 * contra octubre entero da una caída que no existe. El en curso se muestra
 * aparte, con su proyección («a este ritmo cerrás en…»).
 */
const N = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const r1 = (n) => Math.round(n * 10) / 10;

/** Variación % de a contra b; null si no hay base (b = 0) para comparar. */
export const variacion = (a, b) => (b == null || Math.abs(b) < 0.005 || a == null ? null : r1(((a - b) / Math.abs(b)) * 100));
export const pct = (parte, total) => (Math.abs(N(total)) > 0.005 ? r1((N(parte) / N(total)) * 100) : null);

const MEDIOS = [
  ['efectivo', 'Efectivo'], ['tarjeta', 'Tarjeta (débito y crédito)'], ['transferencia', 'Transferencia'],
  ['mercadopago', 'QR de Mercado Pago'], ['otros', 'Otros'],
];

/** Un período del local elegido (null = la empresa), con las medidas derivadas. */
function medir(p, sucursalId) {
  const c = sucursalId ? (p.porLocal?.[sucursalId] ?? null) : p.total;
  const x = c ?? {};
  const ventas = N(x.ventas);
  const costo = N(x.costo);
  const tickets = N(x.tickets);
  const margen = ventas - costo;
  const res = x.resultado ?? null;
  return {
    clave: p.clave, etiqueta: p.etiqueta, titulo: p.titulo, enCurso: p.enCurso, dias: p.dias, transcurridos: p.transcurridos,
    ventas, costo, margen,
    margenPct: pct(margen, ventas),
    tickets,
    ticketProm: tickets > 0 ? Math.round(ventas / tickets) : null,
    sinCosto: N(x.sinCosto), ivaSinFactura: N(x.ivaSinFactura), facturado: N(x.facturado),
    totalConIva: N(x.total), ctaCte: N(x.ctaCte),
    medios: x.medios ?? {},
    /* Con un local elegido no hay Ganancias (es de la empresa): queda el antes de Ganancias. */
    resultado: res ? (sucursalId ? res.antesGanancias : res.neto) : null,
    totalFijos: res ? N(res.totalFijos) : null,
    ajustesStock: res ? N(res.ajustesStock) : 0,
    contribucion: res ? N(res.contribucion) : null,
    hayDatos: ventas !== 0 || tickets > 0,
  };
}

/**
 * PUNTO DE EQUILIBRIO: cuánto hay que vender para cubrir los fijos con el
 * margen de contribución de hoy (fijos ÷ (contribución ÷ ventas)). Margen de
 * seguridad: cuánto por encima de eso se vendió.
 */
export function equilibrio(m) {
  /* Sin gastos fijos cargados no hay nada que cubrir: no se muestra un «$0» engañoso. */
  if (!m || !(m.totalFijos > 0) || !(m.ventas > 0)) return null;
  const tasa = m.contribucion / m.ventas;
  if (!(tasa > 0)) return { ventas: null, seguridadPct: null, sinEquilibrio: true };
  const v = m.totalFijos / tasa;
  return { ventas: Math.round(v), seguridadPct: r1(((m.ventas - v) / m.ventas) * 100), sinEquilibrio: false };
}

const plata = (n) => `$${Math.round(n).toLocaleString('es-AR')}`;
const numTxt = (n) => Math.abs(n).toLocaleString('es-AR', { maximumFractionDigits: 1 });
const pctTxt = (n) => `${numTxt(n)} %`;

export function armarVista(datos, { sucursalId = null } = {}) {
  const serie = (datos?.periodos ?? []).map((p) => medir(p, sucursalId));
  const enCurso = serie.find((x) => x.enCurso) ?? null;
  const completos = serie.filter((x) => !x.enCurso);
  const actual = completos[completos.length - 1] ?? null;
  const anterior = completos[completos.length - 2] ?? null;
  const primero = serie.findIndex((x) => x.hayDatos);
  /* Los períodos de antes de que arrancara el sistema no son «cero ventas»: no se dibujan. */
  const visibles = primero >= 0 ? serie.slice(primero) : [];

  const vs = (k) => (actual && anterior?.hayDatos ? variacion(actual[k], anterior[k]) : null);
  const kpis = actual && {
    ventas: actual.ventas, ventasVar: vs('ventas'),
    margenPct: actual.margenPct,
    margenPts: actual.margenPct != null && anterior?.margenPct != null && anterior.hayDatos ? r1(actual.margenPct - anterior.margenPct) : null,
    tickets: actual.tickets, ticketsVar: vs('tickets'),
    ticketProm: actual.ticketProm, ticketPromVar: vs('ticketProm'),
    resultado: actual.resultado, resultadoVar: vs('resultado'),
    resultadoPct: actual.resultado != null ? pct(actual.resultado, actual.ventas) : null,
    equilibrio: equilibrio(actual),
  };

  /* La proyección del período en curso: lineal, por los días que pasaron. */
  const proyeccion = enCurso && enCurso.transcurridos > 0 && enCurso.hayDatos
    ? { ventas: Math.round((enCurso.ventas / enCurso.transcurridos) * enCurso.dias), transcurridos: enCurso.transcurridos, dias: enCurso.dias, llevas: enCurso.ventas }
    : null;

  const medios = actual
    ? MEDIOS.map(([k, nombre]) => ({ clave: k, etiqueta: nombre, valor: Math.round(N(actual.medios[k])) }))
      .filter((x) => x.valor !== 0)
    : [];
  if (actual?.ctaCte) medios.push({ clave: 'ctacte', etiqueta: 'Cuenta corriente (a cobrar)', valor: Math.round(actual.ctaCte) });

  return { serie: visibles, actual, anterior, enCurso, kpis, proyeccion, medios, lecturas: lecturas({ actual, anterior, kpis, proyeccion, foto: datos?.foto, unidad: datos?.unidad, sucursalId }) };
}

/** LO QUE DICEN LOS NÚMEROS: frases cortas, de la más importante a la menos. */
export function lecturas({ actual, anterior, kpis, proyeccion, foto, unidad, sucursalId }) {
  const out = [];
  if (!actual || !actual.hayDatos) return ['Todavía no hay un período completo con ventas para analizar.'];
  const per = unidad === 'semana' ? 'de la semana' : 'del mes';
  /* «en oct 2026» / «en la semana del 19/10 al 25/10». */
  const en = (p) => (unidad === 'semana' ? `la ${p.titulo}` : p.titulo);

  if (kpis.ventasVar == null) {
    out.push({ tono: 'info', texto: `En ${en(actual)} vendiste ${plata(actual.ventas)}. Es el primer período completo con datos: la comparación aparece desde el próximo.` });
  } else {
    const sube = kpis.ventasVar >= 0;
    let porque = '';
    if (kpis.ticketsVar != null && kpis.ticketPromVar != null) {
      const clientes = kpis.ticketsVar; const gasto = kpis.ticketPromVar;
      porque = Math.abs(clientes) >= Math.abs(gasto)
        ? ` Lo explica sobre todo la cantidad de ventas (${clientes >= 0 ? '+' : '−'}${pctTxt(clientes)} tickets).`
        : ` Lo explica sobre todo cuánto gastó cada cliente (ticket promedio ${gasto >= 0 ? '+' : '−'}${pctTxt(gasto)}).`;
    }
    out.push({ tono: sube ? 'ok' : 'warn', texto: `En ${en(actual)} vendiste ${plata(actual.ventas)}, un ${pctTxt(kpis.ventasVar)} ${sube ? 'más' : 'menos'} que en ${en(anterior)}.${porque}` });
  }

  if (kpis.margenPts != null && Math.abs(kpis.margenPts) >= 1) {
    out.push(kpis.margenPts < 0
      ? { tono: 'warn', texto: `El margen comercial bajó ${numTxt(kpis.margenPts)} puntos (de ${pctTxt(anterior.margenPct)} a ${pctTxt(actual.margenPct)}): subieron costos sin pasar a precios, hubo más descuentos u ofertas, o se vendió más de lo que deja menos.` }
      : { tono: 'ok', texto: `El margen comercial subió ${numTxt(kpis.margenPts)} puntos (a ${pctTxt(actual.margenPct)}): de cada $100 vendidos te quedan $${Math.round(actual.margenPct)} después de la mercadería.` });
  } else if (actual.margenPct != null) {
    out.push({ tono: 'info', texto: `Margen comercial: de cada $100 vendidos te quedan $${Math.round(actual.margenPct)} después de pagar la mercadería (sin contar gastos).` });
  }

  if (proyeccion) {
    const vsAct = variacion(proyeccion.ventas, actual.ventas);
    out.push({ tono: 'info', texto: `Llevás ${plata(proyeccion.llevas)} en ${proyeccion.transcurridos} de ${proyeccion.dias} días ${per} en curso: a este ritmo cerrás en ${plata(proyeccion.ventas)}${vsAct != null ? ` (${vsAct >= 0 ? '+' : '−'}${pctTxt(vsAct)} contra ${en(actual)})` : ''}.` });
  }

  if (unidad === 'mes' && actual.resultado != null) {
    const eq = kpis.equilibrio;
    const que = sucursalId ? 'antes de Ganancias' : 'después de todo';
    out.push({ tono: actual.resultado >= 0 ? 'ok' : 'warn', texto: `${actual.resultado >= 0 ? 'Te quedaron' : 'Perdiste'} ${plata(Math.abs(actual.resultado))} ${que} (${pctTxt(kpis.resultadoPct ?? 0)} de lo vendido).` });
    /* Las diferencias de inventario grandes (los primeros controles corrigen el stock inicial) inflan o hunden el resultado. */
    if (Math.abs(actual.ajustesStock) > actual.ventas * 0.05) {
      out.push({ tono: 'warn', texto: `${actual.ajustesStock > 0 ? 'Sobrantes' : 'Faltantes'} de inventario por ${plata(Math.abs(actual.ajustesStock))} entran en este resultado. Si son correcciones del stock con el que arrancó el sistema, no son ${actual.ajustesStock > 0 ? 'ganancia' : 'pérdida'} del mes: apagá «Diferencias de inventario» en Gerencia › Resultados.` });
    }
    if (!actual.totalFijos) {
      out.push({ tono: 'warn', texto: 'No hay gastos fijos ni sueldos cargados para este mes: el resultado sale mejor de lo que es. Cargalos en Gerencia › Gastos fijos y sueldos.' });
    } else if (eq?.sinEquilibrio) {
      out.push({ tono: 'warn', texto: 'Con el margen de este mes no hay venta que alcance a cubrir los gastos fijos: la contribución es negativa. Hay que subir precios o bajar costos variables.' });
    } else if (eq) {
      out.push({ tono: eq.seguridadPct >= 0 ? 'ok' : 'warn', texto: `Para cubrir los gastos fijos (${plata(actual.totalFijos)}) tenés que vender ${plata(eq.ventas)}. ${eq.seguridadPct >= 0 ? `Vendiste un ${pctTxt(eq.seguridadPct)} por encima: ese es tu margen de seguridad.` : `Te faltaron ${plata(eq.ventas - actual.ventas)}.`}` });
    }
  }

  if (actual.ventas > 0 && actual.sinCosto / actual.ventas > 0.01) {
    out.push({ tono: 'warn', texto: `${pctTxt((actual.sinCosto / actual.ventas) * 100)} de lo vendido (${plata(actual.sinCosto)}) no tiene costo cargado: el margen se ve mejor de lo que es. Revisalo en Compras › Productos con el filtro «Sin costo».` });
  }

  if (!sucursalId && foto?.cicloCaja != null) {
    const c = foto.cicloCaja;
    out.push({ tono: c > 45 ? 'warn' : 'info', texto: c >= 0
      ? `Tu plata da una vuelta en ${c} días: la mercadería dura ${foto.diasStock}, cobrás en ${foto.diasCobro} y le pagás a los proveedores en ${foto.diasPago}. Esos ${c} días los financiás vos.`
      : `Los proveedores te financian ${Math.abs(c)} días: les pagás después de vender y cobrar la mercadería. Cuidá no atrasarte.` });
  }
  return out;
}
