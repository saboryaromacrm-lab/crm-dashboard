/**
 * IMPORTACIÓN DEL PADRÓN DE PROVEEDORES — el traductor del sistema viejo (26/8).
 * ============================================================================
 * Convierte el export "proveedores-ficha" de la app vieja en el plan que la API
 * escribe en una transacción. Todo acá, en el navegador: la vista previa es
 * instantánea y obligatoria — el administrativo VE qué se crea, qué se completa
 * y qué está en duda antes de tocar la base.
 *
 * LO QUE HAY QUE ENTENDER DEL ARCHIVO (y no es un mapeo directo):
 *
 *  1. La mitad derecha es CONTABLE (saldos, facturado, vencimientos) y NO se
 *     importa: el saldo del CRM nace de los comprobantes. Los saldos iniciales
 *     son un paso propio el día del corte. De esa mitad solo se rescata
 *     "Productos asociados", que alimenta el avance de migración ("35 de 64").
 *
 *  2. `Emite` es la condición de compra: Factura → factura, Remito →
 *     liquidación (Sin factura 100), Mixto → mixto. El % real del mixto no
 *     viene en el archivo — queda en 0 y marcado para cargarlo a mano.
 *
 *  3. El padrón viejo mezcla proveedores con rubros de gasto ("GASTOS NAFTA",
 *     "GASTOS LIBRERIA"): se clasifican como proveedores de GASTOS. Y trae
 *     filas de prueba ("PRUEBA PROVEEDOR", "PROVEEDOR GENERICO") que vienen
 *     destildadas — entran solo si alguien las tilda a propósito.
 *
 *  4. Los CUITs vienen sucios (un "1" suelto): solo se toma el de 11 dígitos;
 *     el resto se descarta con aviso en la fila.
 */

const norm = (v) => String(v ?? '').toLowerCase().normalize('NFD')
  .replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, ' ').trim();
const soloDigitos = (v) => String(v ?? '').replace(/\D/g, '');

/** ¿Son el mismo nombre, más allá de mayúsculas, acentos y puntuación? */
export const mismoNombreProveedor = (a, b) => norm(a) === norm(b);

/**
 * Los proveedores que se PARECEN a un nombre: mismo arranque (≥8 letras de
 * prefijo común normalizado) o todas las palabras de un lado contenidas en el
 * otro. Atrapa "NUEVO COSMOS S.A" vs "Nuevo Cosmo S.A. - Lucfel" sin emparejar
 * por una sola palabra. Compartido entre el plan del padrón y el detector del
 * importador de catálogos (27/8) — una sola definición de "parecido".
 */
export function proveedoresParecidos(nombre, existentes) {
  const nf = norm(nombre);
  return existentes.filter((p) => {
    const pn = norm(p.nombre);
    if (!pn || pn === nf) return false;
    let comun = 0;
    while (comun < Math.min(pn.length, nf.length) && pn[comun] === nf[comun]) comun += 1;
    if (comun >= 8) return true;
    const palabras = (a) => a.split(' ').filter((w) => w.length >= 3);
    return (palabras(nf).length && palabras(nf).every((w) => pn.includes(w)))
      || (palabras(pn).length && palabras(pn).every((w) => nf.includes(w)));
  });
}

/** Reconoce el archivo por sus columnas (mismo criterio que los tres del catálogo). */
export function esArchivoProveedores(cols) {
  const set = new Set(cols);
  return set.has('Nombre') && set.has('Emite') && set.has('Modo de cuenta') && set.has('Productos asociados');
}

const EMITE = { factura: 'factura', remito: 'liquidacion', mixto: 'mixto' };
const MEDIO = {
  'cta cte': 'cta_cte', echeq: 'echeq', transferencia: 'transferencia',
  efectivo: 'efectivo', deposito: 'deposito',
};

/**
 * Cada fila del archivo, resuelta contra el padrón que YA está en el CRM:
 *   'nuevo'     no existe: se crea.
 *   'completar' existe (mismo CUIT o mismo nombre): se le completan los campos
 *               vacíos, nunca se pisa lo cargado a mano.
 *   'dudoso'    se PARECE a uno existente ("NUEVO COSMOS S.A" vs "Nuevo Cosmo
 *               S.A. - Lucfel"): viene con el candidato precargado para
 *               confirmar MIRANDO — sin confirmación humana sería adivinar.
 */
export function armarPlanProveedores(filas, existentes) {
  const porCuit = new Map(existentes
    .filter((p) => soloDigitos(p.cuit).length === 11)
    .map((p) => [soloDigitos(p.cuit), p]));
  const porNombre = new Map(existentes.map((p) => [norm(p.nombre), p]));

  const out = [];
  for (const f of filas) {
    const nombre = String(f.Nombre ?? '').trim();
    if (!nombre || /^TOTALES/i.test(nombre)) continue; // la fila de totales del pie

    const cuitCrudo = String(f.CUIT ?? '').trim();
    const cuitValido = soloDigitos(cuitCrudo).length === 11;
    const condicionCompra = EMITE[norm(f.Emite)] ?? 'factura';
    const nf = norm(nombre);

    let estado = 'nuevo';
    let proveedorId = null;
    const existente = (cuitValido && porCuit.get(soloDigitos(cuitCrudo))) || porNombre.get(nf) || null;
    if (existente) {
      estado = 'completar';
      proveedorId = existente.id;
    } else {
      const candidatos = proveedoresParecidos(nombre, existentes);
      if (candidatos.length) {
        estado = 'dudoso';
        proveedorId = candidatos[0].id;
      }
    }

    const esGastos = /^GASTOS\b/i.test(nombre);
    const esPrueba = /PRUEBA PROVEEDOR|PROVEEDOR GENERICO/i.test(nombre);

    out.push({
      clave: `${f.ID || nombre}`,
      nombre,
      cuit: cuitValido ? cuitCrudo : '',
      cuitDescartado: cuitCrudo && !cuitValido ? cuitCrudo : '',
      email: String(f.Email ?? '').trim(),
      telefono: String(f.WhatsApp ?? '').trim(),
      condicionCompra,
      medioHabitual: MEDIO[norm(f['Forma de pago habitual'])] ?? '',
      diasPago: Number(f['Dias de pago']) || 0,
      modoCuenta: /libre/i.test(String(f['Modo de cuenta'] ?? '')) ? 'libre' : 'facturas',
      porcSinFactura: condicionCompra === 'liquidacion' ? 100 : 0,
      productosEsperados: Number(f['Productos asociados']) || 0,
      cuentas: [1, 2]
        .map((n) => ({
          cbuAlias: String(f[`Cuenta ${n} - CBU/Alias`] ?? '').trim(),
          descripcion: String(f[`Cuenta ${n} - Descripcion`] ?? '').trim(),
        }))
        .filter((c) => c.cbuAlias),
      esGastos,
      esPrueba,
      incluir: !esPrueba,
      estado,
      proveedorId,
    });
  }
  return out;
}
