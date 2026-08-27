/**
 * IMPORTACIÓN DE CATÁLOGOS — el traductor del sistema viejo.
 * ============================================================================
 * Convierte los tres CSV que exporta el sistema de gestión anterior (maestro de
 * productos + formatos de compra + formatos de venta) en el modelo del CRM.
 * Todo pasa acá, en el navegador: así la VISTA PREVIA es instantánea y a la API
 * le llega un plan ya armado para escribir en una sola transacción.
 *
 * LO QUE HAY QUE ENTENDER DEL FORMATO VIEJO (y no es un mapeo directo):
 *
 *  1. `TipoProducto` parte el archivo en dos mundos. `1` = lo que se le COMPRA
 *     al proveedor (trae código de proveedor, descuentos y bulto). `22` = lo que
 *     NO se compra: los "X100G / X250G / X1KG" que salen de fraccionar. Esos no
 *     son productos: son PRESENTACIONES de su producto madre. Sus filas del CSV
 *     de compras son derivadas (el "PrecioNeto" que traen es el del kilo, no el
 *     del paquete), así que leerlas crearía productos fantasma que nadie compra.
 *
 *  2. El costo del maestro viene CON IVA y el sistema guarda NETOS. El costo
 *     real se reconstruye del formato de compra, que es el que tiene la verdad:
 *     lista × los descuentos en cascada × flete ÷ unidades del bulto.
 *
 *  3. El markup del sistema viejo es POR PRESENTACIÓN (el kilo al 48%, el de
 *     250 g al 66%, el de 100 g al 101%). Acá el markup es de la LISTA y cada
 *     presentación lleva su RECARGO por fraccionar, así que se traduce:
 *     recargo = (1 + markup del paquete) / (1 + markup del kilo) − 1.
 *
 *  4. El fraccionado se ata a su madre por NOMBRE, y el sistema viejo escribe
 *     la misma cosa de dos formas ("HARINA DE ALMENDRA" vs "ALMENDRAS",
 *     "SESAMO" vs "SEM DE SESAMO"): sin normalizar sinónimos quedan huérfanos y
 *     se duplican productos base.
 */

const r2 = (x) => Math.round((Number(x) || 0) * 100) / 100;
export const num = (v) => Number(String(v ?? '0').replace(',', '.')) || 0;

/* ============================ 1. LEER EL ARCHIVO ============================ */

/**
 * El sistema viejo exporta en **windows-1252** (por eso "CASTAÑAS" se ve roto),
 * pero un archivo retocado a mano puede venir en UTF-8. Se prueba UTF-8 estricto
 * primero: si el archivo no es UTF-8 válido, el decodificador falla y ahí se sabe
 * que hay que leerlo como windows-1252 — adivinar por la pinta del texto es
 * mucho menos confiable.
 */
export async function leerTexto(file) {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('windows-1252').decode(buf);
  }
}

/** CSV con comillas y comas adentro de los campos. */
export function parseCsv(texto) {
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim());
  if (!lineas.length) return { cols: [], filas: [] };
  const partir = (linea) => {
    const out = [];
    let cur = '';
    let enComillas = false;
    for (const ch of linea) {
      if (ch === '"') enComillas = !enComillas;
      else if (ch === ',' && !enComillas) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  };
  const cols = partir(lineas[0]).map((c) => c.trim());
  const filas = lineas.slice(1).map((l) => {
    const v = partir(l);
    return Object.fromEntries(cols.map((c, i) => [c, (v[i] ?? '').trim()]));
  });
  return { cols, filas };
}

/**
 * El proveedor que DICE el archivo de compras (su columna `Proveedor`): el más
 * frecuente, con el detalle de los demás si el export vino mezclado. Es lo que
 * permite preseleccionar el proveedor en el paso 2 — y preguntar cuando el
 * nombre del archivo no está en el padrón tal cual (27/8, pedido del dueño:
 * el sistema viejo escribe el mismo proveedor con nombres levemente distintos).
 */
export function proveedorDelArchivo(filasCompras) {
  const cuenta = new Map();
  for (const f of filasCompras ?? []) {
    const n = String(f.Proveedor ?? '').trim();
    if (!n) continue;
    cuenta.set(n, (cuenta.get(n) || 0) + 1);
  }
  if (!cuenta.size) return null;
  const orden = [...cuenta.entries()].sort((a, b) => b[1] - a[1]);
  return { nombre: orden[0][0], otros: orden.slice(1) };
}

/** Reconoce cuál de los tres archivos es cada uno por sus columnas. */
export function tipoDeArchivo(cols) {
  const set = new Set(cols);
  if (set.has('CostoLista') && set.has('IVAP1') && set.has('TipoProducto')) return 'maestro';
  if (set.has('PrecioLista') && set.has('CostoFlete') && set.has('Proveedor')) return 'compras';
  if (set.has('NroLista') && (set.has('VPrecioFinal') || set.has('MarkUp'))) return 'ventas';
  return null;
}

/* ======================= 2. NOMBRES: LIMPIAR Y ATAR ======================= */

const SIGLAS = new Set(['CUMANA', 'DOYP', 'S/TACC', 'TACC', 'IQF']);
const CONECTORES = new Set(['DE', 'DEL', 'EN', 'Y', 'CON', 'SIN', 'A', 'AL', 'LA', 'EL', 'LOS', 'LAS', 'PARA']);
/** Abreviaturas que hay que abrir o el cajero no encuentra el producto al buscarlo. */
const ABREVIATURAS = [[/\bSEM DE\b/gi, 'SEMILLAS DE'], [/\bDESM\b/gi, 'DESMENUZADO'], [/\bS\/TACC\b/gi, 'SIN TACC']];
/** Sinónimos del sistema viejo: sin esto el fraccionado no encuentra su madre. */
const SINONIMOS = [[/\bALMENDRA\b/g, 'ALMENDRAS'], [/^SESAMO /, 'SEM DE SESAMO ']];

/** TODO EN MAYÚSCULAS → legible, sin tocar siglas ni capitalizar conectores. */
export function titulo(s) {
  return String(s).split(/\s+/).map((w, i) => {
    const U = w.toUpperCase();
    if (SIGLAS.has(U)) return U;
    if (i > 0 && CONECTORES.has(U)) return w.toLowerCase();
    if (/^X\s?[\d.,]+/i.test(w)) return w.toLowerCase();
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ').replace(/\s+/g, ' ').trim();
}

/** El nombre del producto sin la muletilla "MADRE / SOLO STOCK" del sistema viejo. */
export function limpiarNombre(s) {
  let t = String(s)
    .replace(/\s*MADRE\s*-?\s*SOLO STOCK\s*-?/gi, '')
    .replace(/\s*-\s*SOLO STOCK\s*-\s*/gi, ' ')
    .replace(/\s*MADRE\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  for (const [re, rep] of ABREVIATURAS) t = t.replace(re, rep);
  return titulo(t);
}

/** Clave para comparar nombres: sin acentos, sin muletillas y con sinónimos resueltos. */
function claveNombre(s) {
  let t = String(s).toUpperCase()
    .replace(/MADRE|-\s*SOLO STOCK\s*-|SOLO STOCK/gi, '')
    .replace(/[^A-ZÑ0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (const [re, rep] of SINONIMOS) t = t.replace(re, rep);
  return t;
}

/** "AJO EN POLVO X250G" → { base: 'AJO EN POLVO', kg: 0.25 } */
const RE_TAMANO = /^(.*?)\s*X\s?([\d.,]+)\s?(KG|K|GRS|GS|G)\b/i;
export function partirTamano(nombre) {
  const m = RE_TAMANO.exec(nombre);
  if (!m) return null;
  const valor = num(m[2]);
  return { base: m[1].trim(), kg: /^K/i.test(m[3]) ? valor : valor / 1000 };
}

/* ============================ 3. RUBROS ============================ */

/**
 * El archivo trae los rubros como IDs internos sin nombre, así que se clasifica
 * por lo que dice el nombre del producto. El ORDEN manda: "harina de almendras"
 * es Harinas, no Frutos secos.
 */
const REGLAS_RUBRO = [
  [/\bHARINA\b/i, 'Harinas'],
  [/ATUN|LOMITO|CHAMPI|ESPARRAGO|MORRON|ALCAPARRA/i, 'Conservas'],
  [/GARBANZO|ARVEJA|LENTEJ|POROTO/i, 'Legumbres'],
  [/AJO|ALBAHACA|ANIS|CANELA|CLAVO|HINOJO|JENGIBRE|LAUREL|OREGANO|PEREJIL|PIMIENTA|ROMERO|TOMILLO|CEBOLLA|COMINO|CURRY|PIMENTON/i, 'Especias y condimentos'],
  [/ALMENDRA|AVELLANA|CASTA|NUEZ|PISTACHO|MANI\b/i, 'Frutos secos'],
  [/ARANDANO|BANANA|COCO|DATIL|PASAS|TOMATES DESHID|CIRUELA/i, 'Frutas deshidratadas'],
  [/SESAMO|LINO|CHIA|GIRASOL|ZAPALLO|AMAPOLA|MIX SEMILLAS/i, 'Semillas'],
  [/AVENA|QUINOA|AMARANTO|COPOS/i, 'Cereales'],
  [/MIX/i, 'Snacks'],
];
export function rubroDe(nombre, porDefecto = 'Sin clasificar') {
  const r = REGLAS_RUBRO.find(([re]) => re.test(nombre));
  return r ? r[1] : porDefecto;
}

/** Marcas que no son marcas: describen la modalidad, no al fabricante. */
const NO_MARCAS = new Set(['GRANEL', 'VARIOS', 'SIN MARCA', '']);

/* ============================ 4. EL PLAN ============================ */

/**
 * Arma el plan de importación y su reporte.
 *
 * `opciones`:
 *   listaMinorista / listaMayorista  ids de las listas del CRM a las que van
 *                                    las listas 1 y 2 del sistema viejo
 *   publicarConMayorista             publicar en la tienda solo lo que tenga
 *                                    precio mayorista
 *   redondeo                         el de la configuración de ventas
 *   ivaPorDefecto                    si el archivo no lo trae
 */
export function armarPlan({ maestro = [], compras = [], ventas = [] }, opciones = {}) {
  const {
    listaMinorista = null, listaMayorista = null,
    publicarConMayorista = true, redondeo = 1, ivaPorDefecto = 21,
  } = opciones;

  const redondear = (x) => (redondeo > 0 ? Math.round(x / redondeo) * redondeo : r2(x));
  const comprasPorCodigo = new Map(compras.map((c) => [c.Codigo, c]));

  // Markup y precio actual por (código, lista vieja). Solo las listas 1 y 2:
  // las demás del sistema viejo son espejos o datos que quedaron sin actualizar.
  const ventaPorClave = new Map();
  for (const v of ventas) {
    if (!['1', '2'].includes(String(v.NroLista))) continue;
    ventaPorClave.set(`${v.Codigo}|${v.NroLista}`, { markup: num(v.MarkUp), precio: num(v.VPrecioFinal) });
  }

  const base = maestro.filter((p) => String(p.TipoProducto) === '1');
  const fraccionados = maestro.filter((p) => String(p.TipoProducto) === '22');

  /* --- Atar cada fraccionado a su madre --- */
  const madrePorNombre = new Map(base.map((m) => [claveNombre(m.Concepto), m]));
  const presPorMadre = new Map();
  const huerfanos = new Map();
  for (const f of fraccionados) {
    const t = partirTamano(f.Concepto);
    if (!t) continue;
    const clave = claveNombre(t.base);
    const madre = madrePorNombre.get(clave)
      || [...madrePorNombre.entries()].find(([k]) => k === clave || k.startsWith(`${clave} `) || clave.startsWith(`${k} `))?.[1];
    const fila = { kg: t.kg, codigoBarras: f.CodBar, csv: f, nombre: f.Concepto };
    if (madre) {
      if (!presPorMadre.has(madre.Codigo)) presPorMadre.set(madre.Codigo, []);
      presPorMadre.get(madre.Codigo).push(fila);
    } else {
      const k = t.base.toUpperCase();
      if (!huerfanos.has(k)) huerfanos.set(k, []);
      huerfanos.get(k).push(fila);
    }
  }

  /** Costo NETO unitario reconstruido del formato de compra (la fuente confiable). */
  const costoDe = (p) => {
    const c = comprasPorCodigo.get(p.Codigo);
    if (!c) return null;
    const cantidad = num(c.Cantidad) || 1;
    const lista = num(c.PrecioLista);
    const descs = [num(c.PorcDesc), num(c.PorcDesc2), num(c.PorcDesc3), num(c.PorcDesc4)];
    const flete = num(c.CostoFlete);
    const factor = descs.reduce((a, d) => a * (1 - d / 100), 1);
    return {
      cantidad, lista, descs, flete,
      netoUnit: (lista * factor * (1 + flete / 100)) / cantidad,
      codigoProveedor: c.CodigoPrv || '',
    };
  };

  const items = [];
  const avisos = [];
  const cambios = [];

  /** Filas de formato de venta para las listas elegidas. */
  const listasDe = (codigo) => {
    const out = [];
    const min = ventaPorClave.get(`${codigo}|1`);
    const may = ventaPorClave.get(`${codigo}|2`);
    if (min && listaMinorista) out.push({ listaId: listaMinorista, modoPrecio: 'markup', markup: min.markup, unidades: 1 });
    if (may && listaMayorista) out.push({ listaId: listaMayorista, modoPrecio: 'markup', markup: may.markup, unidades: 1 });
    return { filas: out, min, may };
  };

  /** Presentaciones con su recargo derivado y el precio que va a quedar. */
  const armarPresentaciones = (lista, markupBase, netoUnit, iva) => lista
    .slice()
    .sort((a, b) => b.kg - a.kg)
    .map((x) => {
      const mk = ventaPorClave.get(`${x.csv.Codigo}|1`);
      const recargo = (mk && markupBase > 0)
        ? r2(((1 + mk.markup / 100) / (1 + markupBase / 100) - 1) * 100)
        : 0;
      return {
        tamKg: x.kg,
        recargo,
        codigoBarras: x.codigoBarras || '',
        nombre: x.nombre,
        precioViejo: mk ? mk.precio : 0,
        precioNuevo: redondear(netoUnit * (1 + markupBase / 100) * x.kg * (1 + recargo / 100) * (1 + iva / 100)),
      };
    });

  /* --- Los productos que se compran --- */
  for (const p of base) {
    const nombre = limpiarNombre(p.Concepto);
    const presentaciones = presPorMadre.get(p.Codigo) || [];
    /*
     * Granel = se fracciona para vender. Tres señales y basta una: tiene
     * presentaciones, su medida de stock es el kilo, o el nombre dice
     * "MADRE / SOLO STOCK" — que en el sistema viejo significa exactamente
     * "esto no se vende así". Hay bolsas de 25 kg marcadas como "Unidad/es"
     * que sin esa última señal entrarían como producto entero.
     */
    const esGranel = presentaciones.length > 0
      || /kilo/i.test(p.MedidaStock || '')
      || /MADRE|SOLO STOCK/i.test(p.Concepto);

    const costo = costoDe(p);
    if (!costo || costo.netoUnit <= 0) {
      avisos.push({ tono: 'warn', texto: `${nombre}: no se importa porque el archivo no le trae costo.` });
      continue;
    }

    const iva = num(p.IVAP1) || ivaPorDefecto;
    // El markup de referencia es el del paquete MÁS GRANDE (el kilo); en un
    // producto entero, el suyo.
    const codigoRef = presentaciones.length
      ? presentaciones.slice().sort((a, b) => b.kg - a.kg)[0].csv.Codigo
      : p.Codigo;
    const { filas, min, may } = listasDe(codigoRef);
    const markupBase = min ? min.markup : 0;
    const pres = esGranel ? armarPresentaciones(presentaciones, markupBase, costo.netoUnit, iva) : [];

    // Un producto entero también puede tener su precio cambiado.
    if (!pres.length && min && min.precio > 0) {
      const nuevo = redondear(costo.netoUnit * (1 + min.markup / 100) * (1 + iva / 100));
      if (Math.abs(nuevo - min.precio) / min.precio > 0.01) {
        cambios.push({ nombre, viejo: min.precio, nuevo });
      }
    }
    for (const x of pres) {
      if (x.precioViejo > 0 && Math.abs(x.precioNuevo - x.precioViejo) / x.precioViejo > 0.01) {
        cambios.push({ nombre: x.nombre, viejo: x.precioViejo, nuevo: x.precioNuevo });
      }
    }

    const marca = String(p.Marca || '').trim().toUpperCase();
    items.push({
      producto: {
        nombre,
        descripcion: `Importado · ${p.Concepto}`,
        codigoPropio: p.Codigo,
        // El granel suelto no se escanea: el código vive en cada presentación.
        codigoBarras: esGranel ? '' : (p.CodBar || ''),
        unidadesPorBulto: esGranel ? 1 : Math.max(1, Math.round(num(p.Bulto) || costo.cantidad || 1)),
        marcaNombre: NO_MARCAS.has(marca) ? '' : marca,
        categoriaNombre: 'Alimentos',
        subcategoriaNombre: rubroDe(p.Concepto),
        iva,
        esGranel,
        publicado: publicarConMayorista ? !!may : String(p.Publicado) === '1',
        idExterno: String(p.numint || ''),
      },
      formatoCompra: {
        cantidad: costo.cantidad, costo: costo.lista,
        descuento: costo.descs[0], descuento2: costo.descs[1],
        descuento3: costo.descs[2], descuento4: costo.descs[3],
        flete: costo.flete, modoCosto: 'lista', codigoProveedor: costo.codigoProveedor,
      },
      presentaciones: pres,
      listas: filas,
      netoUnit: costo.netoUnit,
      costoEstimado: false,
    });
  }

  /* --- Los fraccionados sin madre: se crea el producto base --- */
  for (const [nombreBase, filasHuerfanas] of huerfanos) {
    const ref = filasHuerfanas.find((f) => f.kg === 1) || filasHuerfanas.slice().sort((a, b) => b.kg - a.kg)[0];
    const iva = num(ref.csv.IVAP1) || ivaPorDefecto;
    // El CostoFinal del fraccionado viene CON IVA y es por su tamaño.
    const netoUnit = (num(ref.csv.CostoFinal) / (1 + iva / 100)) / ref.kg;
    const nombre = titulo(nombreBase);
    if (!(netoUnit > 0)) {
      avisos.push({ tono: 'warn', texto: `${nombre}: sus paquetes no tienen madre en el archivo y tampoco costo, no se importa.` });
      continue;
    }
    const { filas, min, may } = listasDe(ref.csv.Codigo);
    const markupBase = min ? min.markup : 0;
    const pres = armarPresentaciones(filasHuerfanas, markupBase, netoUnit, iva);
    for (const x of pres) {
      if (x.precioViejo > 0 && Math.abs(x.precioNuevo - x.precioViejo) / x.precioViejo > 0.01) {
        cambios.push({ nombre: x.nombre, viejo: x.precioViejo, nuevo: x.precioNuevo });
      }
    }
    avisos.push({
      tono: 'info',
      texto: `${nombre}: se crea el producto base (el archivo solo trae sus paquetes: ${filasHuerfanas.map((f) => f.nombre).join(', ')}). Costo ${netoUnit.toFixed(2)}/kg derivado — conviene verificarlo con la factura.`,
    });
    items.push({
      producto: {
        nombre,
        descripcion: `Producto base creado en la importación (el archivo traía solo los fraccionados: ${filasHuerfanas.map((f) => f.nombre).join(', ')}). Costo derivado — verificar con la factura.`,
        codigoPropio: `IMP-${claveNombre(nombreBase).replace(/\s+/g, '-').slice(0, 20)}`,
        codigoBarras: '', unidadesPorBulto: 1,
        marcaNombre: '', categoriaNombre: 'Alimentos', subcategoriaNombre: rubroDe(nombreBase),
        iva, esGranel: true,
        publicado: publicarConMayorista ? !!may : false,
        idExterno: '',
      },
      // Sin fila en el CSV de compras: el costo entra como lista por kilo.
      formatoCompra: {
        cantidad: 1, costo: r2(netoUnit),
        descuento: 0, descuento2: 0, descuento3: 0, descuento4: 0,
        flete: 0, modoCosto: 'lista', codigoProveedor: '',
      },
      presentaciones: pres, listas: filas, netoUnit, costoEstimado: true,
    });
  }

  /* --- El reporte --- */
  const UMBRAL = 0.15;
  const porRubro = new Map();
  for (const it of items) {
    const k = it.producto.subcategoriaNombre;
    porRubro.set(k, (porRubro.get(k) || 0) + 1);
  }

  return {
    items,
    avisos,
    resumen: {
      productos: items.length,
      granel: items.filter((x) => x.producto.esGranel).length,
      enteros: items.filter((x) => !x.producto.esGranel).length,
      presentaciones: items.reduce((a, x) => a + x.presentaciones.length, 0),
      formatosVenta: items.reduce((a, x) => a + x.listas.length, 0),
      publicados: items.filter((x) => x.producto.publicado).length,
      conIvaReducido: items.filter((x) => x.producto.iva !== 21).length,
      rubros: [...porRubro.entries()].sort((a, b) => b[1] - a[1]),
      marcas: [...new Set(items.map((x) => x.producto.marcaNombre).filter(Boolean))],
      sinMarca: items.filter((x) => !x.producto.marcaNombre).length,
      preciosIguales: items.reduce((a, x) => a + x.listas.length, 0) - cambios.length,
    },
    /*
     * Los precios que se mueven, partidos en dos porque NO son lo mismo: hasta
     * 15% es el costo que se actualizó y el precio que venía atrasado; más que
     * eso casi siempre significa que en el sistema viejo el costo de la madre y
     * el del fraccionado están desincronizados, así que uno de los dos está mal
     * y hay que mirar la factura antes de vender.
     */
    cambiosGrandes: cambios.filter((c) => Math.abs(c.nuevo / c.viejo - 1) > UMBRAL)
      .sort((a, b) => Math.abs(b.nuevo / b.viejo - 1) - Math.abs(a.nuevo / a.viejo - 1)),
    cambiosChicos: cambios.filter((c) => Math.abs(c.nuevo / c.viejo - 1) <= UMBRAL)
      .sort((a, b) => Math.abs(b.nuevo / b.viejo - 1) - Math.abs(a.nuevo / a.viejo - 1)),
  };
}
