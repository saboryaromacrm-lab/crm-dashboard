import { useEffect, useMemo, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../../context/ProductosContext.jsx';
import { money, num, fmtFecha, isoDate } from '../../domain/format.js';
import { TIPOS_COMPROBANTE, ESTADOS_COMPROBANTE, LETRAS_COMPROBANTE, CONDICIONES_PAGO } from '../../domain/constants.js';
import { ModalShell } from '../Modal.jsx';
import { sucursalOptions } from '../selectOptions.jsx';
import { Table, Btn, s } from '../ui.jsx';

const norm = (v) => (v || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
/** Tres decimales: los kg de una bolsa vienen con coma (22,68 kg). */
const r3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
/** Dos decimales: los importes de dinero. */
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Con qué se le paga a un proveedor. Mismas claves que el enum `medio_pago` de
 * la base — el que se elige acá viaja al pago que se registra.
 */
const MEDIOS_PAGO_COMPRA = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  cheque: 'Cheque',
  tarjeta_debito: 'Débito',
  tarjeta_credito: 'Crédito',
  otro: 'Otro',
};
/** En qué habla el bulto de este producto: kilos (granel) o unidades (entero). */
const unidadDe = (prod) => (prod?.tipo === 'granel' ? 'kg' : 'u.');

export function ComprobanteTag({ tipo }) {
  const m = TIPOS_COMPROBANTE[tipo] || { label: tipo, tag: 'tag-ajuste' };
  return <span className={cx(s['mov-tag'], s[m.tag])}>{m.label}</span>;
}
export function ComprobanteEstadoPill({ estado }) {
  const m = ESTADOS_COMPROBANTE[estado] || {};
  return <span className={cx(s.pill, s[m.pill])}>{m.label || estado}</span>;
}
/** Nº legible: A 0001-00001024. */
export function comprobanteNro(c) {
  return `${c.letra} ${c.puntoVenta}-${String(c.numero || c.id).padStart(8, '0')}`;
}

/* ==================================================================== *
 * Buscador de producto del renglón
 * ==================================================================== *
 * Reemplaza al <select>: busca por nombre, código interno o código de barras
 * SOLO entre los productos del proveedor de la factura. La compra siempre
 * ingresa el producto BASE (granel en kg, entero en unidades): las
 * presentaciones son producción propia del fraccionamiento y acá no existen.
 */
function BuscadorProducto({ candidatos, proveedorNombre, onElegir, autoFocus }) {
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const blurTimer = useRef(null);

  const matches = useMemo(() => {
    const ql = norm(texto);
    const digitos = texto.replace(/\D/g, '');
    if (!ql) return candidatos.slice(0, 12);
    return candidatos.filter((c) =>
      norm(c.prod.nombre).includes(ql)
      || (c.prod.codigoPropio && norm(c.prod.codigoPropio).includes(ql))
      || (digitos.length >= 4 && c.prod.codigoBarras && c.prod.codigoBarras.includes(digitos)),
    ).slice(0, 12);
  }, [candidatos, texto]);

  const elegir = (c) => {
    clearTimeout(blurTimer.current);
    setTexto('');
    setAbierto(false);
    onElegir(c.prod);
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="search"
        autoFocus={autoFocus}
        placeholder="Nombre, código o barras…"
        value={texto}
        onChange={(e) => { setTexto(e.target.value); setAbierto(true); }}
        onFocus={() => setAbierto(true)}
        // El blur se demora un tick: sin esto, el click en la lista muere
        // porque el desplegable se desmonta antes de que llegue el click.
        onBlur={() => { blurTimer.current = setTimeout(() => setAbierto(false), 150); }}
        // 'Enter' es el nombre estándar; 'Return' aparece en algunos drivers de
        // teclado. Aceptar los dos no cuesta nada y el escáner de barras
        // termina cada lectura justamente con esa tecla.
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === 'Return') && matches.length) { e.preventDefault(); elegir(matches[0]); }
        }}
      />
      {abierto && (
        <div
          style={{
            position: 'absolute', zIndex: 30, top: '100%', left: 0, minWidth: '130%',
            maxHeight: 300, overflowY: 'auto',
            background: 'var(--crm-color-surface)', border: '1px solid var(--crm-color-border)',
            borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.18)',
          }}
        >
          {matches.length === 0 ? (
            <div className={s.hint} style={{ margin: 0, padding: '10px 12px' }}>
              Sin coincidencias entre los productos de <strong>{proveedorNombre}</strong>. Si es la
              primera vez que viene con él, sumale el proveedor en el Formato de Compra del
              producto — o creá el producto con su proveedor.
            </div>
          ) : matches.map((c) => (
            <button
              key={c.prod.id}
              type="button"
              // mousedown gana la carrera contra el blur del input; click queda
              // de respaldo (elegir es idempotente: dos veces no hace nada raro).
              onMouseDown={(e) => { e.preventDefault(); elegir(c); }}
              onClick={() => elegir(c)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                padding: '7px 12px', border: 'none', background: 'none', cursor: 'pointer',
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                {c.prod.nombre}
                <span className={s.hint} style={{ margin: 0, display: 'block' }}>
                  {c.prod.codigoPropio ? `#${c.prod.codigoPropio}` : ''}
                  {c.entry?.costo > 0
                    ? ` · bulto ${num(c.entry.cantidad || 1, 3)} ${unidadDe(c.prod)} · ${money(c.entry.costo)} (${money(c.entry.costo / (c.entry.cantidad || 1))}/${unidadDe(c.prod)})`
                    : ' · sin costo cargado'}
                </span>
              </span>
              {c.esActivo
                ? <span className={cx(s.badge, s['badge-entero'])}>activo</span>
                : <span className={s.hint} style={{ margin: 0 }}>activo: {c.activoNombre}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================== NUEVO COMPROBANTE ============================== */

const PASOS_WIZARD = ['Datos del comprobante', 'Ítems', 'Pago y confirmación'];

/**
 * Indicador de pasos del asistente. Solo los pasos YA RECORRIDOS son
 * clickeables: avanzar por acá saltearía las validaciones de "Continuar".
 */
function PasosWizard({ paso, irA }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
      {PASOS_WIZARD.map((label, i) => {
        const n = i + 1;
        const activo = n === paso;
        const hecho = n < paso;
        return (
          <button
            key={n}
            type="button"
            disabled={!hecho}
            onClick={hecho ? () => irA(n) : undefined}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
              border: '1px solid ' + (activo ? 'var(--crm-color-primary)' : 'var(--crm-color-border)'),
              borderRadius: 8, background: activo ? 'var(--crm-color-primary-soft)' : 'var(--crm-color-surface)',
              cursor: hecho ? 'pointer' : 'default', textAlign: 'left', minWidth: 0,
            }}
          >
            <span
              style={{
                width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 12, fontWeight: 700, flex: 'none',
                background: activo || hecho ? 'var(--crm-color-primary)' : 'var(--crm-color-border)',
                color: activo || hecho ? 'var(--crm-color-primary-contrast)' : 'var(--crm-color-text-secondary)',
              }}
            >
              {hecho ? '✓' : n}
            </span>
            <span
              style={{
                fontSize: 12.5, fontWeight: activo ? 700 : 500, minWidth: 0,
                color: activo ? 'var(--crm-color-text)' : 'var(--crm-color-text-secondary)',
              }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * @param lectura  Factura que viene de la bandeja "Por procesar". Trae el
 *   encabezado ya resuelto desde el QR del papel —tipo, letra, punto de venta,
 *   número, fecha, CAE— y sobre todo **el total que dice la factura**, que es el
 *   número contra el que se valida que los renglones cargados cierren.
 */
export function ComprobanteFormModal({ proveedorId, tipo: tipoInit, lectura }) {
  const { store, closeModal, toast, sucOperativa, can } = useProductos();

  /*
   * LA LIQUIDACIÓN SOLO APARECE CON SU PERMISO. Es la mitad que el proveedor
   * entrega sin factura: un documento no fiscal, y quién lo carga es decisión
   * del dueño. Sin el permiso `liquidaciones` el tipo no está ni en la lista.
   *
   * Ojo: esto esconde la opción, no la prohíbe — la API no valida quién llama
   * (no puede, no hay autenticación todavía).
   */
  /*
   * A propósito SIN el `isAdmin ||` que usan los otros permisos del sistema.
   * Con él, un admin vería las liquidaciones aunque se le revocara el permiso —
   * y todo el punto de este permiso es que la visibilidad se pueda decidir. El
   * superadmin queda cubierto igual porque su rol tiene el comodín `*`.
   */
  const puedeNoFiscal = can('liquidaciones');
  const tiposDisponibles = Object.keys(TIPOS_COMPROBANTE)
    .filter((k) => puedeNoFiscal || !TIPOS_COMPROBANTE[k].noFiscal);

  /**
   * El alta es un asistente de TRES pasos: datos del comprobante → ítems →
   * pago. El proveedor se elige solo en el paso 1: al pasar a los ítems ya es
   * un hecho de la factura. Antes se podía cambiar con renglones cargados y
   * los productos del proveedor anterior quedaban colgados en la factura del
   * nuevo.
   */
  const [paso, setPaso] = useState(1);
  // Abierto desde la ficha del proveedor (Operaciones): el comprobante ES de
  // ese proveedor — se muestra, pero no se puede cambiar.
  const provFijo = !!proveedorId;

  /*
   * EL ENCABEZADO NO SE TIPEA CUANDO VIENE DE LA BANDEJA. Todo esto salió del QR
   * del papel (RG 4892), que es un JSON: es exacto, no una interpretación de la
   * imagen. Igual queda editable — una factura hecha a mano no tiene QR.
   */
  const [tipo, setTipo] = useState(lectura?.tipo || tipoInit || 'factura');
  const [letra, setLetra] = useState(lectura?.letra || 'A');
  const [puntoVenta, setPuntoVenta] = useState(lectura?.puntoVenta || '0001');
  const [numero, setNumero] = useState(lectura?.numero != null ? String(lectura.numero) : '');
  const [fecha, setFecha] = useState(lectura?.fecha ? String(lectura.fecha).slice(0, 10) : isoDate(new Date()));
  const [fechaCarga, setFechaCarga] = useState(isoDate(new Date()));
  const [provId, setProvId] = useState(proveedorId || store.state.proveedores[0]?.id || '');
  const [sucId, setSucId] = useState(lectura?.sucursalId ?? sucOperativa() ?? '');
  /*
   * Desde la bandeja arranca tildado: si alguien fotografió la factura en el
   * mostrador es porque el camión llegó con la mercadería. Sigue siendo un
   * tilde visible, porque el caso contrario existe — la mercadería ya entró por
   * remito y esta factura solo la documenta; ahí ingresarla otra vez duplicaría
   * el stock.
   */
  // LISTA DE TIPOS · el tilde de recepción arranca puesto cuando viene de la
  // bandeja. La liquidación va acá: su mercadería entró como cualquier otra.
  const [recepcion, setRecepcion] = useState(
    !!lectura && (lectura.tipo === 'factura' || lectura.tipo === 'liquidacion'
      || lectura.tipo === 'remito' || !lectura.tipo),
  );
  const [venc, setVenc] = useState('');
  const [obs, setObs] = useState('');
  // El renglón nace VACÍO: preseleccionar el primer producto del catálogo era
  // una bomba silenciosa (un "+ ítem" distraído registraba harina en la
  // factura de gaseosas). El ítem sin producto no viaja al guardar.
  const [items, setItems] = useState(() => [nuevoItem()]);
  const [busquedaLote, setBusquedaLote] = useState(false);

  /* ---- Lectura de renglones desde el PDF digital ----
   * Si el papel de la bandeja es un PDF con capa de texto, el backend lo lee
   * (receta por proveedor) y devuelve una PROPUESTA: renglones, pie y
   * encabezado. Acá solo se precarga — la persona confirma. Las fotos no
   * tienen capa de texto: para esas el endpoint contesta 400. */
  const [propuestaPdf, setPropuestaPdf] = useState(null);
  const [leyendoPdf, setLeyendoPdf] = useState(false);
  /** CAE leído del PDF (cuando el QR no se leyó y la lectura no lo trae). */
  const [caePdf, setCaePdf] = useState('');
  const tienePdf = !!lectura?.archivos?.some((a) => a.mime === 'application/pdf');

  /*
   * LISTA DE TIPOS · qué comprobantes pueden ingresar mercadería.
   *
   * La liquidación FALTABA acá, y era el agujero de la función: sin este tipo en
   * la lista, el tilde de recepción no se dibujaba y el payload mandaba siempre
   * `recepcion: false`, así que la mitad no facturada generaba la deuda pero
   * **la mercadería no entraba al depósito** — en silencio, porque no había
   * ningún tilde sin marcar a la vista. Justo el caso que motivó el tipo nuevo.
   *
   * Tiene que coincidir con `ingresaStock` de la API (comprobantes.module.ts).
   */
  const permiteRecepcion = tipo === 'factura' || tipo === 'liquidacion' || tipo === 'remito';
  const provElegido = store.getProveedor(parseInt(provId, 10));

  /**
   * Pagos A CUENTA del proveedor (los que la cajera hizo desde la sucursal
   * cuando llegó el pedido). Se avisan acá, mientras se carga la factura, y al
   * registrarla se ofrece tomarlos — sin este puente, la plata queda esperando
   * en la bandeja hasta que alguien se acuerde.
   */
  const [pagosACuenta, setPagosACuenta] = useState([]);
  useEffect(() => {
    let vivo = true;
    const pid = parseInt(provId, 10);
    if (!pid) { setPagosACuenta([]); return undefined; }
    store.pagosDisponibles(pid)
      .then((r) => { if (vivo) setPagosACuenta(Array.isArray(r) ? r : []); })
      .catch(() => { if (vivo) setPagosACuenta([]); });
    return () => { vivo = false; };
  }, [store, provId]);
  const aCuenta = pagosACuenta.reduce((a, x) => a + x.saldo, 0);

  /* ---------------- La factura que ajusta una nota ---------------- */

  /**
   * UNA NC O ND NACE DE UNA FACTURA: la mercadería que se devolvió de esa
   * entrega, el flete que no se cobró en ese remito. Atarla es lo que hace que
   * el saldo de esa factura diga la verdad — sin la referencia, la nota restaba
   * (o sumaba) en la deuda total del proveedor y la factura seguía ofreciendo su
   * importe entero para pagar.
   *
   * `''` = todavía no eligió · `'0'` = eligió explícitamente "no corresponde".
   */
  const esNota = tipo === 'nota_credito' || tipo === 'nota_debito';
  /** Liquidación: sin IVA, sin percepciones, letra X fija (lo fuerza la API). */
  const esNoFiscal = !!TIPOS_COMPROBANTE[tipo]?.noFiscal;
  const [refId, setRefId] = useState('');
  const [facturasRef, setFacturasRef] = useState([]);
  useEffect(() => {
    let vivo = true;
    const pid = parseInt(provId, 10);
    if (!esNota || !pid) { setFacturasRef([]); return undefined; }
    store.facturasReferenciables(pid)
      .then((r) => { if (vivo) setFacturasRef(Array.isArray(r) ? r : []); })
      .catch(() => { if (vivo) setFacturasRef([]); });
    return () => { vivo = false; };
  }, [store, provId, esNota]);
  // Cambiar de proveedor o de tipo invalida la factura elegida: era de otro padrón.
  useEffect(() => { setRefId(''); }, [provId, tipo]);

  const facturaRef = facturasRef.find((f) => String(f.id) === refId) || null;

  /* ---------------- Cómo se paga ---------------- */

  /** Cuánto se toma de cada pago de sucursal: { [pagoId]: '16575' } */
  const [tomados, setTomados] = useState({});
  /** El resto que se paga en el acto: '' = nada, queda en cuenta corriente. */
  const [pagarAhora, setPagarAhora] = useState('');
  const [medioPago, setMedioPago] = useState('efectivo');
  /** '' = plata de administración (sin caja); si no, el id del turno abierto. */
  const [origenPago, setOrigenPago] = useState('');
  const [refPago, setRefPago] = useState('');

  /** Turno abierto en la sucursal de recepción: la única caja de la que puede salir. */
  const [turno, setTurno] = useState(null);
  useEffect(() => {
    let vivo = true;
    const sid = parseInt(sucId, 10);
    if (!sid) { setTurno(null); return undefined; }
    store.cajaAbierta(sid)
      .then((r) => { if (vivo) setTurno(r && r.estado === 'abierta' ? r : null); })
      .catch(() => { if (vivo) setTurno(null); });
    return () => { vivo = false; };
  }, [store, sucId]);
  // Si la caja elegida deja de existir (cambió la sucursal), no queda apuntando
  // a un turno de otra sucursal.
  useEffect(() => {
    if (origenPago && (!turno || String(turno.id) !== origenPago)) setOrigenPago('');
  }, [turno, origenPago]);

  /**
   * El universo del buscador: los productos RELACIONADOS con el proveedor de
   * la factura (tienen formato de compra con él), sin importar quién esté
   * activo — que el activo sea otro no significa que este no entregue más.
   * Cada candidato lleva su entrada (para precargar el costo DE ESTE
   * proveedor) y su activo actual (para mostrarlo y poder cambiarlo).
   */
  const candidatos = useMemo(() => {
    const pid = parseInt(provId, 10);
    if (!pid) return [];
    return store.state.productos
      .filter((p) => (p.formatosCompra || []).some((e) => e.proveedorId === pid))
      .map((p) => {
        const activo = store.formatoActivo(p);
        return {
          prod: p,
          entry: (p.formatosCompra || []).find((e) => e.proveedorId === pid),
          esActivo: activo?.proveedorId === pid,
          activoNombre: store.getProveedor(activo?.proveedorId)?.nombre || '—',
        };
      })
      .sort((a, b) => a.prod.nombre.localeCompare(b.prod.nombre));
  }, [store, provId]);

  /**
   * Cambiar el proveedor invalida todo lo cargado PARA el anterior: renglones,
   * costos a actualizar y pagos tomados hablaban de otro padrón. Se vuelve a
   * empezar con ítems vacíos — por eso el campo vive en el paso 1: para cuando
   * se cargan productos, el proveedor ya es un hecho.
   */
  const onProveedor = (valor) => {
    if (valor === provId) return;
    setProvId(valor);
    setItems([nuevoItem()]);
    setTomados({});
    setPagarAhora('');
    setCostosOmitidos(new Set());
    setActivarIds(new Set());
  };

  /** Cuánto se demoró en cargarse el comprobante. Null si alguna fecha falta. */
  const diasAtraso = fecha && fechaCarga
    ? Math.round((new Date(fechaCarga) - new Date(fecha)) / 86400000)
    : null;

  const setItem = (i, patch) => setItems((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const delItem = (i) => setItems((r) => r.filter((_, j) => j !== i));
  const addItem = () => setItems((r) => [...r, nuevoItem()]);

  // Al elegir el producto: precarga IVA, el costo DE ESTE proveedor (no el del
  // activo) y el tamaño de su bulto. Se carga en BULTOS: "llegaron 2 bolsas".
  const onProducto = (i, prod) => {
    const entry = (prod.formatosCompra || []).find((e) => e.proveedorId === parseInt(provId, 10));
    setItem(i, {
      productoId: String(prod.id),
      iva: String(prod.iva ?? 21),
      costoBulto: entry ? String(entry.costo) : '',
      porBulto: entry ? String(entry.cantidad || 1) : (prod.tipo === 'entero' ? String(prod.unidadesPorBulto || 1) : '1'),
      costoAuto: true,
    });
  };

  /** Ingreso en lote desde el buscador masivo: un renglón por producto tildado. */
  const agregarLote = (elegidos) => {
    setItems((rows) => {
      const vivos = rows.filter((r) => r.productoId);
      const nuevos = elegidos.map((c) => ({
        productoId: String(c.prod.id),
        bultos: '1',
        porBulto: c.entry ? String(c.entry.cantidad || 1) : '1',
        costoBulto: c.entry ? String(c.entry.costo) : '',
        descuento: '0',
        iva: String(c.prod.iva ?? 21),
        costoAuto: true,
      }));
      return [...vivos, ...nuevos];
    });
    setBusquedaLote(false);
    toast(`${elegidos.length} producto(s) agregados a la factura.`, 'ok');
  };

  /**
   * La cuenta del renglón. Todo sale de tres números que hablan como la
   * factura: bultos × tamaño del bulto × costo del bulto. De ahí derivan los
   * kg (o unidades) totales que entran al stock y el costo unitario ($/kg)
   * que alimenta el catálogo.
   */
  const calcRow = (it) => {
    const bultos = Number(it.bultos) || 0;
    const porBulto = Number(it.porBulto) || 0;
    const costoBulto = Number(it.costoBulto) || 0;
    const desc = Number(it.descuento) || 0;
    const cantidadTotal = r3(bultos * porBulto);
    const costoUnitario = porBulto > 0 ? costoBulto / porBulto : 0;
    const neto = bultos * costoBulto * (1 - desc / 100);
    return { cantidadTotal, costoUnitario, neto, iva: neto * (Number(it.iva) || 0) / 100 };
  };
  /* ------------------------- EL PIE DE LA FACTURA -------------------------
   * Se replica el papel, en su orden: los renglones dan el bruto, la
   * BONIFICACIÓN general lo baja, el IVA se calcula sobre el neto ya bonificado
   * y las PERCEPCIONES se suman al final (no son IVA: son pago a cuenta de otro
   * impuesto). Sin esto el total del sistema no cerraba con el del proveedor.
   */
  const bruto = items.reduce((a, it) => a + calcRow(it).neto, 0);

  /** % del papel; el importe se puede corregir porque el proveedor redondea a su modo. */
  const [bonifPct, setBonifPct] = useState('');
  const [bonifManual, setBonifManual] = useState(null);
  const bonifCalc = r2(bruto * (Number(bonifPct) || 0) / 100);
  const bonifImporte = Math.min(bonifManual != null ? bonifManual : bonifCalc, r2(bruto));
  /*
   * ¿Hay bonificación CARGADA? No es lo mismo que "el importe da más de cero":
   * si se carga el % antes de los ítems, el importe es 0 y la línea quedaba
   * invisible — el usuario no la veía ni podía quitarla, y después aparecía
   * sola al cargar el primer renglón.
   */
  const hayBonif = (Number(bonifPct) || 0) > 0 || (bonifManual ?? 0) > 0;
  const factorBonif = bruto > 0 ? 1 - bonifImporte / bruto : 1;

  // El IVA se recalcula renglón por renglón sobre el neto bonificado: con dos
  // alícuotas distintas (21 y 10,5) no alcanza con prorratear el IVA total.
  /* En una liquidación el IVA es 0 acá TAMBIÉN, no solo en la API: si la pantalla
   * sumara el 21% del renglón, el total del formulario no coincidiría con el que
   * devuelve el backend y el usuario vería cambiar el número al guardar. */
  const tot = items.reduce((acc, it) => {
    const r = calcRow(it);
    const neto = r.neto * factorBonif;
    acc.neto += neto;
    acc.iva += esNoFiscal ? 0 : neto * (Number(it.iva) || 0) / 100;
    return acc;
  }, { neto: 0, iva: 0 });

  /** Percepciones del proveedor: se tildan las que trajo la factura. */
  const [percepciones, setPercepciones] = useState([]);
  useEffect(() => {
    let vivo = true;
    const pid = parseInt(provId, 10);
    if (!pid) { setPercepciones([]); return undefined; }
    store.percepcionesProveedor(pid)
      .then((r) => {
        if (!vivo) return;
        setPercepciones((r ?? [])
          .filter((x) => x.activa !== false)
          .map((x) => ({ ...x, aplicar: false, importeManual: null })));
      })
      .catch(() => { if (vivo) setPercepciones([]); });
    return () => { vivo = false; };
  }, [store, provId]);

  const conIva = tot.neto + tot.iva;
  const percCalculadas = percepciones.map((p) => {
    const base = p.base === 'total' ? conIva : tot.neto;
    const calc = r2(base * (Number(p.alicuota) || 0) / 100);
    return { ...p, calc, importe: p.importeManual != null ? p.importeManual : calc };
  });
  // Idem el IVA: una liquidación no lleva percepciones, y la API las descarta.
  const percTotal = esNoFiscal ? 0 : percCalculadas.reduce((a, p) => a + (p.aplicar ? p.importe : 0), 0);
  const percAplicadas = percCalculadas.filter((p) => p.aplicar).length;
  /** Toca UNA percepción por su índice real (lo usa la × del pie). */
  const setPerc = (i, patch) => setPercepciones((r) => r.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  /* ---- Leer el PDF: pedir la propuesta y precargar el formulario ---- */

  /** Aplica el encabezado leído del PDF a los campos del paso 1. Es un botón
   * aparte y no automático: si el QR ya llenó el encabezado (o alguien lo
   * tipeó), pisarlo sin aviso sería decidir por la persona. */
  const usarEncabezadoPdf = () => {
    const e = propuestaPdf?.encabezado;
    if (!e) return;
    if (e.tipo) setTipo(e.tipo);
    if (e.letra) setLetra(e.letra);
    if (e.puntoVenta) setPuntoVenta(e.puntoVenta);
    if (e.numero) setNumero(String(e.numero));
    if (e.fecha) setFecha(e.fecha);
    if (e.vencimiento) setVenc(e.vencimiento);
    if (e.cae) setCaePdf(e.cae);
    toast('Encabezado tomado del PDF.', 'ok');
  };

  const leerPdf = async () => {
    if (leyendoPdf || !lectura) return;
    // Releer pisa lo cargado: si ya hay renglones armados a mano, se pregunta.
    if (items.some((it) => it.productoId)
      && !window.confirm('Leer el PDF reemplaza los renglones ya cargados. ¿Seguir?')) return;
    setLeyendoPdf(true);
    try {
      const d = await store.leerRenglonesLectura(lectura.id);
      setPropuestaPdf(d);
      if (!d?.receta) {
        toast(d?.avisos?.[0] || 'No se pudo leer el PDF.', 'err');
        return;
      }
      const filas = (d.renglones || []).filter((x) => x.productoId).map((x) => ({
        productoId: String(x.productoId),
        bultos: String(x.cantidad),
        porBulto: String(x.porBulto || 1),
        costoBulto: x.costoBulto != null ? String(x.costoBulto) : '',
        // El costo vino del papel: que el catálogo no lo pise al re-elegir.
        descuento: String(x.dto || 0),
        iva: String(x.iva ?? 21),
        costoAuto: false,
      }));
      if (filas.length) setItems(filas);
      if (d.pie?.bonifImporte > 0) {
        setBonifPct(d.pie.bonifPct != null ? String(d.pie.bonifPct) : '');
        setBonifManual(d.pie.bonifImporte);
      }
      if (d.pie?.percepciones?.length) {
        // Tildar las configuradas del proveedor que el papel trajo: por nombre
        // parecido o por la misma alícuota. El importe del papel manda.
        const k = (v) => String(v || '').normalize('NFD').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        setPercepciones((prev) => prev.map((p) => {
          const m = d.pie.percepciones.find((x) => {
            const a = k(x.nombre); const b = k(p.nombre);
            return (a && b && (a.includes(b) || b.includes(a)))
              || (x.alicuota != null && Number(p.alicuota) === Number(x.alicuota));
          });
          return m ? { ...p, aplicar: true, importeManual: m.importe } : p;
        }));
      }
      const conProd = filas.length;
      toast(`${d.renglones.length} renglones leídos del PDF (${conProd} con producto).`, 'ok');
    } catch (err) {
      setPropuestaPdf(null);
      toast(err?.message || 'No se pudo leer el PDF.', 'err');
    } finally {
      setLeyendoPdf(false);
    }
  };
  /** Cuál de los dos modales chicos del pie está abierto: null | 'bonificacion' | 'percepciones'. */
  const [modalPie, setModalPie] = useState(null);

  const total = tot.neto + tot.iva + percTotal;

  /**
   * ¿CIERRA CON EL PAPEL?
   *
   * El total del QR es el dato más útil que trae la factura: si la suma de los
   * renglones, menos la bonificación, más el IVA, más las percepciones da ese
   * número, la carga está DEMOSTRADA — no "parece bien", cierra.
   *
   * La tolerancia no es cero a propósito: el proveedor redondea cada renglón y
   * el sistema calcula con más precisión, así que en facturas grandes queda un
   * centavo de diferencia que no es un error. Lo que sí es un error se mide en
   * pesos, no en centavos.
   *
   * OJO con lo que esto NO verifica: la plata, no las cantidades. `1 × $12.000`
   * y `12 × $1.000` cierran igual, y el segundo mete el stock 12 veces mal.
   */
  const totalPapel = Number(lectura?.total) || 0;
  const difPapel = totalPapel > 0 ? r2(total - totalPapel) : 0;
  const tolerancia = Math.max(1, items.length * 0.05);
  const cierraConPapel = totalPapel > 0 && Math.abs(difPapel) <= tolerancia;

  /* ---------------- Cuánto queda debiéndose ---------------- */

  /**
   * LISTA DE TIPOS · genera deuda (tiene que coincidir con `generaDeuda` de la
   * API). La factura, la LIQUIDACIÓN y la nota de débito; el remito y la orden
   * de compra no se pagan, y la nota de crédito RESTA deuda.
   *
   * Sin la liquidación acá, el alta no ofrecía el paso de pago para la mitad no
   * facturada: la deuda quedaba creada y sin forma de saldarla desde el alta.
   */
  const generaDeuda = tipo === 'factura' || tipo === 'liquidacion' || tipo === 'nota_debito';
  const totalTomado = useMemo(
    () => Object.values(tomados).reduce((a, v) => a + (Number(v) || 0), 0),
    [tomados],
  );
  const ahora = Number(pagarAhora) || 0;
  const saldoFinal = r2(total - totalTomado - ahora);
  /**
   * La condición de pago se DERIVA del saldo en vez de ser un selector aparte:
   * antes se podía marcar "contado" sin registrar un solo peso y la factura
   * figuraba como deuda igual. Un dato que puede contradecir a los otros
   * termina mintiendo.
   */
  const condicionPago = generaDeuda && saldoFinal > 0.009 ? 'cuenta_corriente' : 'contado';

  /**
   * Solo se ofrecen los pagos de LA SUCURSAL DE RECEPCIÓN de esta factura: la
   * plata que salió de la caja de Express 2 explica mercadería que entró en
   * Express 2 — mezclar las bandejas de todas las sucursales invitaba a aplicar
   * el pago equivocado. Los de otras sucursales se avisan aparte: se toman
   * cargando la factura que corresponde a esa sucursal.
   */
  const pagosOfrecidos = useMemo(() => {
    const sid = parseInt(sucId, 10);
    const lista = sid ? pagosACuenta.filter((p) => p.sucursalId === sid) : pagosACuenta;
    return [...lista].sort((a, b) => new Date(a.fecha) - new Date(b.fecha) || a.id - b.id);
  }, [pagosACuenta, sucId]);
  const aCuentaSuc = pagosOfrecidos.reduce((a, x) => a + x.saldo, 0);
  const aCuentaOtras = r2(aCuenta - aCuentaSuc);

  /**
   * Tomar un pago es una DECISIÓN, no un default: a veces la factura que se
   * está cargando se pagó por otro lado (transferencia del jueves) y el pago
   * de caja que espera es de OTRA factura (la del martes). Al tildar se
   * sugiere el importe que falta cubrir; se puede corregir a mano.
   */
  const toggleTomar = (p) => setTomados((m) => {
    if (m[p.id] != null) {
      const { [p.id]: _, ...resto } = m;
      return resto;
    }
    const yaTomado = Object.values(m).reduce((a, v) => a + (Number(v) || 0), 0);
    const falta = Math.max(0, r2(total - yaTomado - (Number(pagarAhora) || 0)));
    return { ...m, [p.id]: String(r2(Math.min(falta, p.saldo))) };
  });

  /**
   * DIFERENCIAS DE COSTO
   * ------------------------------------------------------------------
   * La factura ES la lista de precios nueva del proveedor. Si lo facturado no
   * coincide con el costo cargado y nadie lo actualiza, el catálogo se queda
   * viejo en silencio y se vende con el margen equivocado. Se compara acá
   * mismo, en memoria, y se ofrece actualizar en la misma operación.
   *
   * La comparación es POR UNIDAD ($/kg o $/u.), no por bulto: comparar bolsas
   * de distinto tamaño por precio de bolsa miente — $50.000 la de 25 kg contra
   * $42.000 la de 20 kg parece una baja, pero es $2.000/kg vs $2.100/kg.
   */
  const impacto = useMemo(() => {
    const pid = parseInt(provId, 10);
    if (!pid) return [];
    const vistos = new Set();
    const out = [];
    for (const it of items) {
      const prodId = parseInt(it.productoId, 10);
      const porBulto = Number(it.porBulto) || 0;
      const costoBulto = Number(it.costoBulto) || 0;
      const costo = porBulto > 0 ? costoBulto / porBulto : 0; // $/kg o $/u.
      if (!prodId || vistos.has(prodId)) continue;
      const prod = store.getProducto(prodId);
      if (!prod) continue;
      vistos.add(prodId);

      const entry = (prod.formatosCompra || []).find((e) => e.proveedorId === pid) || null;
      const costoCargado = entry ? entry.costo / Math.max(entry.cantidad || 1, 1e-9) : null;
      const dif = costoCargado != null && costo > 0 ? costo - costoCargado : 0;
      // Medio punto de tolerancia: no vale molestar por un redondeo.
      const difRelevante = costoCargado != null && costo > 0
        && Math.abs(dif) >= 0.005
        && (costoCargado <= 0 || Math.abs(dif / costoCargado) >= 0.005);
      // El bulto también cambió: viaja junto con el costo aunque el $/kg dé igual.
      const bultoCambio = !!entry && porBulto > 0
        && Math.abs(porBulto - (entry.cantidad || 1)) > 0.0005;
      const variacion = difRelevante && costoCargado > 0 ? (costo / costoCargado - 1) * 100 : null;

      // Heurística: si la diferencia es casi exactamente una alícuota de IVA, lo
      // más probable es que el costo cargado tenga el IVA adentro.
      const pareceIva = variacion != null
        && [21, 10.5].some((a) => Math.abs(Math.abs(variacion) - a) < 0.6);

      out.push({
        productoId: prodId,
        nombre: prod.nombre,
        prod,
        entry,
        iva: prod.iva,
        unidad: unidadDe(prod),
        costoCargado,
        costoFacturado: costo,
        bultoFacturado: porBulto,
        costoBultoFacturado: costoBulto,
        bultoCambio,
        difRelevante: difRelevante || bultoCambio,
        variacion,
        pareceIva,
        esActivo: store.formatoActivo(prod)?.proveedorId === pid,
        activoNombre: store.getProveedor(store.formatoActivo(prod)?.proveedorId)?.nombre || '—',
      });
    }
    return out;
  }, [items, provId, store]);

  const diferencias = impacto.filter((d) => d.difRelevante);
  const cambiablesActivo = impacto.filter((d) => !d.esActivo && (d.entry || d.costoFacturado > 0));

  // El costo se tilda por defecto: olvidarse de actualizarlo es el error que
  // esto evita. El proveedor activo NO: cambia el precio de góndola y esa
  // decisión tiene que ser deliberada.
  const [costosOmitidos, setCostosOmitidos] = useState(() => new Set());
  const [activarIds, setActivarIds] = useState(() => new Set());
  const toggleEnSet = (setter) => (prodId) => setter((prev) => {
    const next = new Set(prev);
    if (next.has(prodId)) next.delete(prodId); else next.add(prodId);
    return next;
  });
  const toggleCosto = toggleEnSet(setCostosOmitidos);
  const toggleActivar = toggleEnSet(setActivarIds);

  const costosAActualizar = diferencias.filter((d) => !costosOmitidos.has(d.productoId));
  const aActivar = cambiablesActivo.filter((d) => activarIds.has(d.productoId));
  const hayAvisoIva = diferencias.some((d) => d.pareceIva && !costosOmitidos.has(d.productoId));

  /**
   * Precio de góndola que quedaría. Solo cambia si ese proveedor manda el
   * precio (ya es el activo, o el usuario tildó que pase a serlo).
   */
  const precioProyectado = (d) => {
    const seraActivo = d.esActivo || activarIds.has(d.productoId);
    if (!seraActivo) return null;
    const usaCosto = d.difRelevante && !costosOmitidos.has(d.productoId);
    const base = d.entry || { costo: 0, descuento: 0, flete: 0, cantidad: 1 };
    // Costo y tamaño del bulto van JUNTOS: proyectar el precio de la bolsa
    // nueva con los kilos de la vieja daría un $/kg — y una góndola — falsos.
    const cn = store.costoNetoEntry(usaCosto || !d.entry
      ? { ...base, costo: d.costoBultoFacturado, cantidad: d.bultoFacturado || 1 }
      : base);
    // Markup equivalente del piso: proyecta la góndola con el costo facturado.
    const cnHoy = store.costoNeto(d.prod);
    const ganancia = cnHoy > 0 ? (store.precioBaseVenta(d.prod) / cnHoy - 1) * 100 : 0;
    return store.precioFinal(cn * (1 + ganancia / 100), d.iva);
  };

  const guardar = async () => {
    const parsed = items
      .filter((it) => it.productoId && Number(it.bultos) > 0 && Number(it.porBulto) > 0)
      .map((it) => {
        const r = calcRow(it);
        return {
          // La compra ingresa siempre el producto BASE: las presentaciones son
          // producción del fraccionamiento, no algo que un proveedor entregue.
          // El stock recibe los kg (o unidades) TOTALES; el costo viaja unitario.
          productoId: parseInt(it.productoId, 10), presentacionId: null,
          cantidad: r.cantidadTotal, costoUnitario: r.costoUnitario, descuento: it.descuento, iva: it.iva,
        };
      });
    if (!parsed.length) { toast('Agregá al menos un ítem con bultos y tamaño de bulto.', 'err'); return; }

    /*
     * La nota tiene que decir a qué factura pertenece. No se elige sola: si
     * quedara vacío por defecto, la nota volvería a flotar en la cuenta del
     * proveedor y la factura seguiría ofreciendo su importe entero. Que no
     * corresponda a ninguna es una decisión válida, pero explícita.
     */
    if (esNota && !refId) {
      toast(`Elegí a qué factura ajusta esta ${tipo === 'nota_credito' ? 'nota de crédito' : 'nota de débito'}.`, 'err');
      setPaso(3);
      return;
    }

    // No se puede pagar más de lo que dice la factura: sería inventar plata.
    if (generaDeuda && saldoFinal < -0.009) {
      toast(`Estás pagando ${money(Math.abs(saldoFinal))} más de lo que dice el comprobante.`, 'err');
      return;
    }
    const tomarPagos = generaDeuda
      ? Object.entries(tomados)
        .map(([pagoId, v]) => ({ pagoId: Number(pagoId), importe: r2(v) }))
        .filter((x) => x.importe > 0.009)
      : [];

    const res = await store.crearComprobante({
      tipo, letra, puntoVenta, numero, fecha, fechaCarga, proveedorId: parseInt(provId, 10),
      sucursalId: sucId ? parseInt(sucId, 10) : null, condicionPago, recepcion: permiteRecepcion && recepcion,
      vencimientoPago: venc || null, observaciones: obs.trim(), items: parsed,
      // De la bandeja: el CAE del QR (o el leído del PDF, si el QR no se pudo)
      // y la lectura que este comprobante cierra en la misma transacción.
      cae: lectura?.cae || caePdf || undefined,
      lecturaId: lectura?.id,
      // La factura que esta nota ajusta ('0' = el usuario dijo que no corresponde).
      refComprobanteId: esNota && refId && refId !== '0' ? Number(refId) : undefined,
      // El pie del papel: el descuento general y las percepciones que vinieron.
      bonificacion: Number(bonifPct) || 0,
      bonificacionImporte: bonifImporte,
      percepciones: percCalculadas
        .filter((p) => p.aplicar && p.importe > 0.009)
        .map((p) => ({ nombre: p.nombre, alicuota: Number(p.alicuota) || 0, base: p.base, importe: r2(p.importe) })),
      // Costo del bulto y tamaño del bulto viajan JUNTOS: son un solo hecho
      // ("la bolsa de 20 kg sale $40.000") y por separado el $/kg mentiría.
      actualizarCostos: costosAActualizar.map((d) => ({
        productoId: d.productoId, costo: d.costoBultoFacturado, cantidad: d.bultoFacturado,
      })),
      activarProveedor: aActivar.map((d) => d.productoId),
      /*
       * El pago viaja CON el comprobante: aplicar un pago de sucursal es parte
       * de cargar la factura, no una acción suelta en otra pantalla.
       */
      tomarPagos,
      pagoContado: generaDeuda && ahora > 0
        ? {
          importe: r2(ahora),
          medio: medioPago,
          cajaSesionId: origenPago ? Number(origenPago) : undefined,
          referencia: refPago.trim() || undefined,
        }
        : undefined,
    });
    if (!res.ok) { toast(res.error || 'No se pudo registrar el comprobante.', 'err'); return; }

    const partes = [];
    if (costosAActualizar.length) partes.push(`${costosAActualizar.length} costo(s)`);
    if (aActivar.length) partes.push(`${aActivar.length} activo(s)`);
    if (tomarPagos.length) partes.push(`${tomarPagos.length} pago(s) de sucursal aplicado(s)`);
    if (ahora > 0) partes.push(`${money(ahora)} pagados`);
    toast(partes.length ? `Comprobante registrado · ${partes.join(' · ')}.` : 'Comprobante registrado.', 'ok');
    closeModal();
  };

  /** Renglones completos: con producto, bultos y tamaño de bulto. */
  const itemsValidos = items.filter((it) => it.productoId && Number(it.bultos) > 0 && Number(it.porBulto) > 0).length;

  const continuar = () => {
    if (paso === 1) {
      if (!parseInt(provId, 10)) { toast('Elegí el proveedor del comprobante.', 'err'); return; }
      setPaso(2);
    } else if (paso === 2) {
      if (!itemsValidos) { toast('Agregá al menos un ítem con bultos y tamaño de bulto.', 'err'); return; }
      setPaso(3);
    }
  };

  const footer = paso < 3
    ? [
      paso === 1
        ? { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal }
        : { texto: 'Volver', clase: 'btn-ghost', onClick: () => setPaso(paso - 1) },
      { texto: 'Continuar', clase: 'btn-primary', onClick: continuar },
    ]
    : [
      { texto: 'Volver', clase: 'btn-ghost', onClick: () => setPaso(2) },
      { texto: 'Registrar', clase: 'btn-primary', onClick: guardar },
    ];

  return (
    <>
      <ModalShell
        title="Nuevo comprobante de compra"
        subtitle={`Paso ${paso} de 3 · ${PASOS_WIZARD[paso - 1]}`}
        wide
        onClose={closeModal}
        footer={footer}
      >
      <PasosWizard paso={paso} irA={setPaso} />

      {/* EL PAPEL, A MANO EN LOS TRES PASOS. Es lo que se mira mientras se
          tipean los renglones, así que el link tiene que estar siempre visible y
          abrir en otra pestaña — no dentro del modal, donde taparía el
          formulario que se está llenando. */}
      {lectura?.archivos?.length > 0 && (
        <div className={cx(s.callout)} style={{ marginBottom: 'var(--crm-space-3)' }}>
          <strong>Esta factura vino de la bandeja.</strong> El encabezado salió del QR del papel
          {lectura.cae && <> · CAE <span className={s.mono}>{lectura.cae}</span></>}.{' '}
          {lectura.archivos.map((a, i) => (
            <a
              key={a.id}
              href={store.urlPapelFactura(a.id)}
              target="_blank"
              rel="noreferrer"
              style={{ marginRight: 10 }}
            >
              Ver el papel{lectura.archivos.length > 1 ? ` (${i + 1})` : ''}
            </a>
          ))}
        </div>
      )}

      {/* ==================== PASO 1 · DATOS DEL COMPROBANTE ==================== */}
      {paso === 1 && (
      <>
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Tipo <span className={s.req}>*</span></label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {tiposDisponibles.map((k) => <option key={k} value={k}>{TIPOS_COMPROBANTE[k].label}</option>)}
          </select>
          {esNoFiscal && (
            <div className={s.hint} style={{ margin: '6px 0 0' }}>
              Sin IVA, sin percepciones y sin CAE. Suma stock y deuda igual que una
              factura, pero <strong>no va a ningún libro</strong>.
            </div>
          )}
        </div>
        <div className={s.field}>
          <label>Proveedor <span className={s.req}>*</span></label>
          {provFijo ? (
            <>
              <input value={provElegido?.nombre || '—'} readOnly tabIndex={-1} />
              <div className={s.hint} style={{ margin: '6px 0 0' }}>
                Abierto desde la ficha del proveedor: el comprobante es de él.
              </div>
            </>
          ) : (
            <select value={provId} onChange={(e) => onProveedor(e.target.value)}>{productoProveedorOptions(store)}</select>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1.2fr 1fr', gap: 8 }}>
        <div className={s.field}>
          <label>Letra</label>
          {/* La liquidación es letra X y no se elige: la A significa "discrimina
              IVA" y este comprobante no discrimina nada. */}
          {esNoFiscal ? (
            <input value="X" readOnly tabIndex={-1} />
          ) : (
            <select value={letra} onChange={(e) => setLetra(e.target.value)}>
              {LETRAS_COMPROBANTE.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          )}
        </div>
        <div className={s.field}>
          <label>Punto de venta</label>
          <input value={puntoVenta} onChange={(e) => setPuntoVenta(e.target.value)} placeholder="0001" />
        </div>
        <div className={s.field}>
          <label>Número</label>
          <input type="number" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="auto" />
        </div>
        <div className={s.field}>
          <label>Fecha del comprobante</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
      </div>

      {/* Dos fechas distintas y las dos importan: la del papel define el
          período fiscal; la de carga dice cuándo entró de verdad al sistema. */}
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Fecha de carga</label>
          <input type="date" value={fechaCarga} onChange={(e) => setFechaCarga(e.target.value)} />
          <div className={s.hint} style={{ margin: '6px 0 0' }}>
            Cuándo se registra en el sistema. Por defecto hoy; cambiala si estás cargando algo atrasado.
          </div>
        </div>
        <div className={s.field}>
          <label>Días de atraso</label>
          <input value={diasAtraso === null ? '—' : `${diasAtraso} día(s)`} readOnly tabIndex={-1} />
          <div className={s.hint} style={{ margin: '6px 0 0' }}>
            Diferencia entre la fecha del comprobante y la de carga.
          </div>
        </div>
      </div>


      {permiteRecepcion && (
        <div className={s['form-grid']}>
          <div className={s.field}>
            <label>Sucursal de recepción</label>
            {/* Cambia la sucursal → cambia la bandeja de pagos que se ofrece
                en el paso 3: lo tildado hablaba de otra sucursal. */}
            <select value={sucId} onChange={(e) => { setSucId(e.target.value); setTomados({}); }}>
              {sucursalOptions(store, false)}
            </select>
          </div>
          <label className={s['granel-toggle']} style={{ alignSelf: 'end' }}>
            <input type="checkbox" checked={recepcion} onChange={(e) => setRecepcion(e.target.checked)} />
            <span>
              <span className={s['t-title']}>Ingresa stock (recepción)</span><br />
              <span className={s['t-sub']}>Suma al inventario la mercadería de los ítems.</span>
            </span>
          </label>
        </div>
      )}

      {aCuenta > 0.009 && (
        <div className={cx(s.callout, s.ok)}>
          <strong>{provElegido?.nombre || 'Este proveedor'}</strong> tiene{' '}
          <strong>{money(aCuenta)}</strong> pagados desde sucursal esperando factura
          ({pagosACuenta.length} pago{pagosACuenta.length === 1 ? '' : 's'}).
          {/* Mismo criterio que `generaDeuda`: si el documento genera deuda, el
              paso de pago existe y los pagos a cuenta se pueden tomar ahí. */}
          {generaDeuda
            ? ' En el paso de pago vas a poder tomarlos.'
            : ' Al registrar una factura vas a poder tomarlos.'}
        </div>
      )}
      </>
      )}

      {/* ==================== PASO 2 · ÍTEMS ==================== */}
      {paso === 2 && (
      <>
      <div className={s['section-title']}>Ítems</div>

      {/* El papel es un PDF digital: los renglones se LEEN, no se tipean. */}
      {tienePdf && (
        <div className={cx(s.callout, s.info)} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span>
              Este papel es un <strong>PDF digital</strong>: los renglones se pueden leer directo del archivo.
            </span>
            <Btn small variant="btn-primary" onClick={leerPdf} disabled={leyendoPdf}>
              {leyendoPdf ? 'Leyendo…' : propuestaPdf ? 'Releer el PDF' : 'Leer renglones del PDF'}
            </Btn>
          </div>

          {propuestaPdf?.receta && (
            <div style={{ marginTop: 8 }}>
              <div>
                <strong>{propuestaPdf.renglones.length} renglones leídos</strong>
                {' '}· {propuestaPdf.renglones.filter((x) => x.productoId).length} con producto propuesto
                {propuestaPdf.cierra && <> · <strong>el total cierra con el papel</strong></>}
              </div>

              {propuestaPdf.encabezado?.numero && (
                <div style={{ marginTop: 4 }}>
                  El PDF dice: <strong>
                    {TIPOS_COMPROBANTE[propuestaPdf.encabezado.tipo]?.label || propuestaPdf.encabezado.tipo}{' '}
                    {propuestaPdf.encabezado.letra} {propuestaPdf.encabezado.puntoVenta}-{propuestaPdf.encabezado.numero}
                  </strong>{' '}· {fmtFecha(propuestaPdf.encabezado.fecha)}
                  {propuestaPdf.encabezado.cae && <> · CAE <span className={s.mono}>{propuestaPdf.encabezado.cae}</span></>}
                  <button type="button" className={s.linkBtn} style={{ marginLeft: 8 }} onClick={usarEncabezadoPdf}>
                    usar este encabezado
                  </button>
                </div>
              )}

              {propuestaPdf.renglones.some((x) => !x.productoId) && (
                <div style={{ marginTop: 6 }}>
                  <strong>Sin producto reconocido</strong> (¿artículos nuevos del proveedor?) — se agregan a mano:
                  <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                    {propuestaPdf.renglones.filter((x) => !x.productoId).map((x) => (
                      <li key={x.codigo}>
                        <span className={s.mono}>{x.codigo}</span> {x.descripcion} — {money(x.importe)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {propuestaPdf.avisos?.length > 0 && (
                <div style={{ marginTop: 6, color: 'var(--crm-color-warning)' }}>
                  {propuestaPdf.avisos.map((a, i) => <div key={i}>· {a}</div>)}
                </div>
              )}

              <details style={{ marginTop: 6 }}>
                <summary className={s.hint} style={{ cursor: 'pointer', margin: 0 }}>Ver el texto extraído del PDF</summary>
                <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', maxHeight: 220, overflow: 'auto', margin: '6px 0 0' }}>
                  {propuestaPdf.texto}
                </pre>
              </details>
            </div>
          )}
          {propuestaPdf && !propuestaPdf.receta && (
            <div style={{ marginTop: 8, color: 'var(--crm-color-warning)' }}>
              {propuestaPdf.avisos?.map((a, i) => <div key={i}>· {a}</div>)}
              {propuestaPdf.texto && (
                <details style={{ marginTop: 6 }}>
                  <summary className={s.hint} style={{ cursor: 'pointer', margin: 0 }}>Ver el texto extraído</summary>
                  <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', maxHeight: 220, overflow: 'auto', margin: '6px 0 0' }}>
                    {propuestaPdf.texto}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>
      )}
      <div className={s.hint} style={{ marginTop: 0 }}>
        El buscador ofrece los productos de <strong>{provElegido?.nombre || 'este proveedor'}</strong> por
        nombre, código interno o código de barras. Se carga <strong>en bultos</strong>, como habla la
        factura: llegaron 2 bolsas de 25 kg → Bultos 2, y el sistema ingresa los 50 kg. El tamaño
        del bulto viene precargado y se corrige solo si esta entrega vino distinta.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr .6fr .8fr .9fr .6fr .6fr 1fr auto', gap: 8, marginBottom: 6 }}>
        {['Producto', 'Bultos', 'Por bulto', 'Costo bulto', 'Desc%', 'IVA%', 'Subtotal', ''].map((h, i) => (
          <div key={i} className={s['mini-label']}>{h}</div>
        ))}
      </div>
      {items.map((it, i) => {
        const prod = it.productoId ? store.getProducto(parseInt(it.productoId, 10)) : null;
        const r = calcRow(it);
        const activo = prod ? store.formatoActivo(prod) : null;
        const pid = parseInt(provId, 10);
        const u = unidadDe(prod);
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr .6fr .8fr .9fr .6fr .6fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'start' }}>
            {prod ? (
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ flex: 1, minWidth: 0, fontWeight: 600 }}>{prod.nombre}</span>
                  <button
                    type="button" className={s['pres-remove']} title="Cambiar producto"
                    onClick={() => setItem(i, { productoId: '', costoBulto: '', costoAuto: true })}
                  >×</button>
                </div>
                <div className={s.hint} style={{ margin: 0 }}>
                  {activo?.proveedorId === pid
                    ? 'activo con este proveedor'
                    : `activo: ${store.getProveedor(activo?.proveedorId)?.nombre || 'sin activo'}`}
                </div>
                {/* La cuenta a la vista: total que entra al stock y $/kg real. */}
                {r.cantidadTotal > 0 && (
                  <div className={s.hint} style={{ margin: 0 }}>
                    <strong>{num(r.cantidadTotal, 3)} {u}</strong>
                    {r.costoUnitario > 0 && <> · <strong>{money(r.costoUnitario)}/{u.replace('.', '')}</strong></>}
                  </div>
                )}
              </div>
            ) : (
              <BuscadorProducto
                candidatos={candidatos}
                proveedorNombre={provElegido?.nombre || 'este proveedor'}
                onElegir={(p) => onProducto(i, p)}
                autoFocus={i > 0}
              />
            )}
            <input
              type="number" min="0" step="any" value={it.bultos}
              title="Cuántos bultos llegaron"
              onChange={(e) => setItem(i, { bultos: e.target.value })}
            />
            <div>
              <input
                type="number" min="0" step="any" value={it.porBulto}
                title={prod ? `${u === 'kg' ? 'Kg' : 'Unidades'} por bulto de esta entrega` : 'Kg o unidades por bulto'}
                onChange={(e) => setItem(i, { porBulto: e.target.value })}
              />
              {prod && <div className={s.hint} style={{ margin: 0, textAlign: 'center' }}>{u}/bulto</div>}
            </div>
            <input
              type="number" min="0" step="any" value={it.costoBulto}
              title="Costo del bulto, como figura en la factura"
              onChange={(e) => setItem(i, { costoBulto: e.target.value, costoAuto: false })}
            />
            <input type="number" min="0" step="any" value={it.descuento} onChange={(e) => setItem(i, { descuento: e.target.value })} />
            <input type="number" min="0" step="any" value={it.iva} onChange={(e) => setItem(i, { iva: e.target.value })} />
            <div className={cx(s.mono, s.num)} style={{ fontWeight: 700, alignSelf: 'center' }}>{money(r.neto)}</div>
            <button type="button" className={s['pres-remove']} onClick={() => delItem(i)}>×</button>
          </div>
        );
      })}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className={cx(s.btn, s['btn-ghost'], s['btn-sm'])} onClick={addItem}>+ Agregar ítem</button>
        <button type="button" className={cx(s.btn, s['btn-ghost'], s['btn-sm'])} onClick={() => setBusquedaLote(true)}>
          Buscar en lote (marca / categoría)
        </button>
      </div>

      {/*
        IMPACTO EN PRECIOS. Las dos decisiones que mueven la góndola, juntas y
        mostrando el número que importa: el precio final que va a quedar.
      */}
      {(diferencias.length > 0 || cambiablesActivo.length > 0) && (
        <>
          <div className={s['section-title']}>Impacto en precios</div>
          <div className={cx(s.callout, s.warn)}>
            La factura es la lista nueva del proveedor. Si el costo no se actualiza, el catálogo
            queda viejo y se sigue vendiendo con el margen anterior. <strong>Pasar el proveedor a
            activo</strong> hace que su costo sea el que define el precio de venta — por eso no es
            automático.
          </div>

          {hayAvisoIva && (
            <div className={cx(s.callout, s.danger)}>
              La diferencia coincide casi exactamente con una alícuota de IVA. Puede que el costo
              cargado tenga el IVA incluido: los costos se guardan <strong>netos, sin IVA</strong>.
              Verificá antes de actualizar.
            </div>
          )}

          <Table
            cols={[
              { h: 'Actualizar costo' }, { h: 'Producto' },
              { h: 'Cargado (unit.)', num: true }, { h: 'Facturado (unit.)', num: true }, { h: 'Var.', num: true },
              { h: 'Proveedor activo' }, { h: 'Precio góndola', num: true },
            ]}
          >
            {impacto.map((d) => {
              const incluirCosto = d.difRelevante && !costosOmitidos.has(d.productoId);
              const activar = activarIds.has(d.productoId);
              const subio = d.variacion != null && d.variacion > 0;
              const proy = precioProyectado(d);
              const actual = store.precioFinal(store.precioBaseVenta(d.prod), d.iva);
              const cambia = proy != null && Math.abs(proy - actual) > 0.005;
              return (
                <tr key={d.productoId}>
                  <td style={{ width: 120 }}>
                    {d.difRelevante ? (
                      <input
                        type="checkbox"
                        checked={incluirCosto}
                        aria-label={`Actualizar el costo de ${d.nombre}`}
                        onChange={() => toggleCosto(d.productoId)}
                      />
                    ) : <span className={s.muted}>sin cambio</span>}
                  </td>
                  <td>
                    {d.nombre}
                    {/* El bulto cambió de tamaño: el dato viaja junto al costo. */}
                    {d.bultoCambio && (
                      <div className={s.hint} style={{ margin: 0 }}>
                        bulto: {num(d.entry?.cantidad || 1, 3)} → {num(d.bultoFacturado, 3)} {d.unidad}
                      </div>
                    )}
                  </td>
                  <td className={s.num}>
                    {d.costoCargado == null
                      ? <span className={s.muted}>nuevo</span>
                      : <>{money(d.costoCargado)}<span className={s.muted}>/{d.unidad.replace('.', '')}</span></>}
                  </td>
                  <td className={s.num}>
                    <strong>{money(d.costoFacturado)}</strong><span className={s.muted}>/{d.unidad.replace('.', '')}</span>
                  </td>
                  <td className={s.num}>
                    {d.variacion == null ? '—' : (
                      <strong style={{ color: subio ? 'var(--crm-color-danger)' : 'var(--crm-color-success)' }}>
                        {d.variacion > 0 ? '+' : ''}{num(d.variacion, 1)}%
                      </strong>
                    )}
                  </td>
                  <td>
                    {d.esActivo ? (
                      <span className={cx(s.badge, s['badge-entero'])}>Ya es el activo</span>
                    ) : (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input type="checkbox" checked={activar} onChange={() => toggleActivar(d.productoId)} />
                        <span className={s.hint} style={{ margin: 0 }}>hoy: {d.activoNombre}</span>
                      </label>
                    )}
                  </td>
                  <td className={s.num}>
                    {proy == null ? (
                      <span className={s.muted} title="Este proveedor no define el precio">sin efecto</span>
                    ) : cambia ? (
                      <>
                        <span className={s.muted}>{money(actual)}</span>{' → '}
                        <strong style={{ color: proy > actual ? 'var(--crm-color-danger)' : 'var(--crm-color-success)' }}>
                          {money(proy)}
                        </strong>
                      </>
                    ) : money(actual)}
                  </td>
                </tr>
              );
            })}
          </Table>
          <div className={s.toolbar} style={{ marginBottom: 10 }}>
            <span className={s.hint} style={{ margin: 0, flex: 1 }}>
              {costosAActualizar.length} costo(s) y {aActivar.length} cambio(s) de proveedor activo.
              Todo queda en el historial y se puede deshacer.
            </span>
            {diferencias.length > 0 && (
              <>
                <Btn small onClick={() => setCostosOmitidos(new Set(diferencias.map((d) => d.productoId)))}>Ningún costo</Btn>
                <Btn small onClick={() => setCostosOmitidos(new Set())}>Todos los costos</Btn>
              </>
            )}
          </div>
        </>
      )}

      {/* ==================== EL PIE DE LA FACTURA ====================
          Mismo orden que el papel, para poder cuadrar mirando de reojo:
          subtotal → bonificación → neto → IVA → percepciones → TOTAL. */}
      {/* El pie muestra SOLO lo que la factura trajo; el resto se agrega con
          los botones de abajo. La mayoría de las facturas no traen ninguna de
          las dos cosas y no tienen por qué ocupar el formulario. */}
      <div className={cx(s.callout, s.ok)}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Subtotal de los ítems</span><strong>{money(bruto)}</strong>
        </div>
        {hayBonif && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--crm-color-success)' }}>
            <span>
              Bonificación {bonifPct ? `${num(Number(bonifPct), 2)}%` : ''}
              <button
                type="button" className={s.linkBtn} tabIndex={-1} style={{ marginLeft: 8 }}
                onClick={() => setModalPie('bonificacion')}
              >
                cambiar
              </button>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <strong>− {money(bonifImporte)}</strong>
              <button
                type="button" className={s['pres-remove']} title="Quitar la bonificación"
                onClick={() => { setBonifPct(''); setBonifManual(null); }}
              >×</button>
            </span>
          </div>
        )}
        {/* "Neto gravado" e "IVA" no van en una liquidación: no hay nada gravado
            que mostrar, y una fila "IVA $0" invita a preguntarse si falta cargarlo. */}
        {!esNoFiscal && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Neto gravado</span><strong>{money(tot.neto)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>IVA</span><strong>{money(tot.iva)}</strong>
            </div>
          </>
        )}
        {/* Se recorre TODO el array (no el filtrado) para que el índice de la
            × sea el real: con el filtrado, quitar una borraba a la de al lado. */}
        {!esNoFiscal && percCalculadas.map((p, i) => (p.aplicar ? (
          <div key={p.id ?? i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>
              {p.nombre} <span className={s.muted}>· {num(p.alicuota, 2)}%</span>
              <button
                type="button" className={s.linkBtn} tabIndex={-1} style={{ marginLeft: 8 }}
                onClick={() => setModalPie('percepciones')}
              >
                cambiar
              </button>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <strong>{money(p.importe)}</strong>
              <button
                type="button" className={s['pres-remove']} title={`Quitar ${p.nombre}`}
                onClick={() => setPerc(i, { aplicar: false, importeManual: null })}
              >×</button>
            </span>
          </div>
        ) : null))}
        <div
          style={{
            display: 'flex', justifyContent: 'space-between', marginTop: 6, paddingTop: 6,
            borderTop: '1px solid var(--crm-color-border)', fontSize: 16,
          }}
        >
          <strong>TOTAL</strong><strong>{money(total)}</strong>
        </div>

        {/* EL CONTROL QUE HACE QUE ESTO VALGA LA PENA: el total del QR contra el
            total de lo cargado. Si cierra, los renglones están BIEN — no
            "parecen bien". Si no cierra, falta o sobra algo y se ve cuánto. */}
        {totalPapel > 0 && (
          <div
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginTop: 6, paddingTop: 6, borderTop: '1px dashed var(--crm-color-border)',
              color: cierraConPapel ? 'var(--crm-color-success, #15803d)' : 'var(--crm-color-danger, #b91c1c)',
            }}
          >
            <span>
              {cierraConPapel ? '✓ Coincide con el papel' : 'Total que dice el papel'}
              <span className={s.muted} style={{ marginLeft: 6 }}>{money(totalPapel)}</span>
            </span>
            <strong>
              {cierraConPapel
                ? 'cierra'
                : `${difPapel > 0 ? 'sobran' : 'faltan'} ${money(Math.abs(difPapel))}`}
            </strong>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className={cx(s.btn, s['btn-ghost'], s['btn-sm'])}
          onClick={() => setModalPie('bonificacion')}
        >
          {hayBonif ? 'Editar bonificación' : '+ Bonificación'}
        </button>
        {/* Sin percepciones en una liquidación: son pago a cuenta de un impuesto,
            y en un comprobante que no existe para ARCA no hay nada a cuenta de qué.
            La API las descarta igual — el botón se esconde para no prometerlas. */}
        {!esNoFiscal && (
          <button
            type="button"
            className={cx(s.btn, s['btn-ghost'], s['btn-sm'])}
            disabled={!percepciones.length}
            title={percepciones.length
              ? 'Tildar las percepciones que trajo esta factura'
              : `${provElegido?.nombre || 'Este proveedor'} no tiene percepciones configuradas (se cargan en su ficha)`}
            onClick={() => setModalPie('percepciones')}
          >
            {percAplicadas > 0 ? `Percepciones (${percAplicadas})` : '+ Percepciones'}
          </button>
        )}
        {!esNoFiscal && !percepciones.length && (
          <span className={s.hint} style={{ margin: 0, alignSelf: 'center' }}>
            Las percepciones de un proveedor se cargan una vez en su ficha (Proveedores › abrirlo ›
            Percepciones) y desde ahí aparecen acá.
          </span>
        )}
      </div>
      </>
      )}

      {/* ==================== PASO 3 · PAGO Y CONFIRMACIÓN ==================== */}
      {paso === 3 && (
      <>
      {/* La foto de lo que se está por registrar: el pago se decide contra
          este total — tenerlo a la vista evita volver a los ítems. */}
      <div
        className={cx(s.callout, s.ok)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}
      >
        <span>
          <strong>{TIPOS_COMPROBANTE[tipo]?.label || tipo} {letra} {puntoVenta}-{numero || 'auto'}</strong>
          {' · '}{provElegido?.nombre || '—'} · {itemsValidos} ítem{itemsValidos === 1 ? '' : 's'}
        </span>
        <span style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          {bonifImporte > 0.009 && <span>Bonif.: <strong>−{money(bonifImporte)}</strong></span>}
          <span>Neto: <strong>{money(tot.neto)}</strong></span>
          <span>IVA: <strong>{money(tot.iva)}</strong></span>
          {percTotal > 0.009 && <span>Percep.: <strong>{money(percTotal)}</strong></span>}
          <span>Total: <strong style={{ fontSize: 16 }}>{money(total)}</strong></span>
        </span>
      </div>

      {/* ============ QUÉ FACTURA AJUSTA (solo NC y ND) ============
          Una nota nace de UNA factura. Elegirla es lo que hace que el saldo de
          esa factura diga la verdad: la NC lo baja, la ND lo sube, y la bandeja
          de pago deja de ofrecer un importe que ya no se debe. */}
      {esNota && (
        <>
          <div className={s['section-title']}>
            {tipo === 'nota_credito' ? '¿Qué factura descuenta?' : '¿Qué factura recarga?'}
          </div>

          {facturasRef.length === 0 ? (
            <div className={cx(s.callout, s.warn)}>
              {provElegido?.nombre || 'Este proveedor'} no tiene ninguna factura confirmada cargada,
              así que no hay nada que ajustar. La nota se puede registrar igual: va a mover la cuenta
              del proveedor sin tocar el saldo de ninguna factura.
            </div>
          ) : (
            <Table
              cols={[
                { h: '' }, { h: 'Factura' }, { h: 'Fecha' },
                { h: 'Total', num: true }, { h: 'Pagado', num: true }, { h: 'Saldo hoy', num: true },
                { h: tipo === 'nota_credito' ? 'Queda en' : 'Pasa a', num: true },
              ]}
            >
              {facturasRef.map((f) => {
                const elegida = String(f.id) === refId;
                const despues = r2(f.saldo + (tipo === 'nota_debito' ? total : -total));
                return (
                  <tr
                    key={f.id}
                    className={s.clickable}
                    style={elegida ? { background: 'var(--crm-color-surface-2, rgba(0,0,0,.03))' } : undefined}
                    onClick={() => setRefId(String(f.id))}
                  >
                    <td>
                      <input
                        type="radio"
                        name="refFactura"
                        checked={elegida}
                        onChange={() => setRefId(String(f.id))}
                      />
                    </td>
                    <td>
                      {f.etiqueta}
                      {f.notas > 0 && (
                        <div className={s.hint} style={{ margin: 0 }}>
                          ya tiene {f.notas} nota{f.notas === 1 ? '' : 's'} ({money(f.ajuste)})
                        </div>
                      )}
                    </td>
                    <td>{fmtFecha(f.fecha)}</td>
                    <td className={cx(s.num, s.mono)}>{money(f.total)}</td>
                    <td className={cx(s.num, s.mono)}>{f.pagado > 0.009 ? money(f.pagado) : '—'}</td>
                    <td className={cx(s.num, s.mono)}>{money(f.saldo)}</td>
                    <td className={cx(s.num, s.mono)}>
                      {elegida ? (
                        <strong style={{ color: despues < -0.009 ? 'var(--crm-color-danger, #b91c1c)' : undefined }}>
                          {money(despues)}
                        </strong>
                      ) : <span className={s.muted}>—</span>}
                    </td>
                  </tr>
                );
              })}
              <tr
                className={s.clickable}
                style={refId === '0' ? { background: 'var(--crm-color-surface-2, rgba(0,0,0,.03))' } : undefined}
                onClick={() => setRefId('0')}
              >
                <td>
                  <input type="radio" name="refFactura" checked={refId === '0'} onChange={() => setRefId('0')} />
                </td>
                <td colSpan={6}>
                  <span className={s.muted}>
                    No corresponde a una factura en particular — ajusta la cuenta del proveedor
                  </span>
                </td>
              </tr>
            </Table>
          )}

          {facturaRef && r2(facturaRef.saldo - total) < -0.009 && tipo === 'nota_credito' && (
            <div className={cx(s.callout, s.warn)}>
              La nota ({money(total)}) es mayor que el saldo de {facturaRef.etiqueta}
              {' '}({money(facturaRef.saldo)}). Se puede registrar —pasa cuando la factura ya estaba
              pagada y la mercadería se devolvió después— y el excedente queda a tu favor en la
              cuenta del proveedor.
            </div>
          )}

          {refId === '0' && (
            <div className={s.hint}>
              Sin factura, esta nota mueve la cuenta corriente del proveedor pero <strong>no</strong>
              {' '}cambia el saldo de ningún documento: al pagar factura por factura no va a aparecer
              descontada. Es lo correcto para un ajuste general — una bonificación de fin de año, un
              recargo financiero sobre varias facturas.
            </div>
          )}
        </>
      )}

      {!generaDeuda && (
        <div className={cx(s.callout, s.info)}>
          {TIPOS_COMPROBANTE[tipo]?.label || 'Este comprobante'} no genera deuda: no hay nada que
          pagar
          {tipo === 'nota_credito' && facturaRef && <> — descuenta {money(total)} de {facturaRef.etiqueta}</>}.
          {' '}Revisá el resumen y registrá.
        </div>
      )}

      {/* ==================== CÓMO SE PAGA ==================== */}
      {generaDeuda && total > 0 && (
        <>
          <div className={s['section-title']}>Cómo se paga</div>

          {pagosOfrecidos.length > 0 && (
            <>
              <div className={cx(s.callout, s.info)}>
                {provElegido?.nombre || 'Este proveedor'} tiene <strong>{money(aCuentaSuc)}</strong> pagados
                desde <strong>{store.getSucursal(parseInt(sucId, 10))?.nombre || 'esta sucursal'}</strong> y
                sin aplicar. Tildá los que esta factura explica: tomarlos es lo que los{' '}
                <strong>aplica</strong> — no vuelve a mover plata. Si esta factura se pagó por otro
                lado, no tildes nada y usá "Se paga ahora".
              </div>
              <Table
                cols={[
                  { h: 'Tomar' }, { h: 'Pago en sucursal' }, { h: 'Origen' },
                  { h: 'Disponible', num: true }, { h: 'Importe a tomar', num: true },
                ]}
              >
                {pagosOfrecidos.map((p) => {
                  const tomado = tomados[p.id] != null;
                  return (
                    <tr key={p.id}>
                      <td style={{ width: 60 }}>
                        <input
                          type="checkbox"
                          checked={tomado}
                          aria-label={`Tomar el pago del ${fmtFecha(p.fecha)}`}
                          onChange={() => toggleTomar(p)}
                        />
                      </td>
                      <td>
                        {fmtFecha(p.fecha)}
                        {p.concepto && <div className={s.hint} style={{ margin: 0 }}>{p.concepto}</div>}
                      </td>
                      <td>
                        {p.sucursalNombre || <span className={s.muted}>—</span>}
                        {p.cajaSesionId && (
                          <div className={s.hint} style={{ margin: 0 }}>
                            turno #{p.cajaSesionId}{p.usuarioNombre ? ` · ${p.usuarioNombre}` : ''}
                          </div>
                        )}
                      </td>
                      <td className={s.num}>{money(p.saldo)}</td>
                      <td className={s.num}>
                        {tomado ? (
                          <input
                            type="number" min="0" step="any" style={{ maxWidth: 130 }}
                            placeholder="0,00"
                            value={tomados[p.id]}
                            onChange={(e) => setTomados((m) => ({ ...m, [p.id]: e.target.value }))}
                          />
                        ) : (
                          <span className={s.muted}>sin tomar</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </Table>
            </>
          )}

          {/* Pagos que esperan en OTRAS sucursales: se avisan, no se ofrecen —
              cada uno se toma cargando la factura de SU sucursal. */}
          {aCuentaOtras > 0.009 && (
            <div className={s.hint}>
              {provElegido?.nombre || 'El proveedor'} tiene además <strong>{money(aCuentaOtras)}</strong> pagados
              desde otras sucursales. Acá no se ofrecen: se toman cargando la factura cuya
              sucursal de recepción sea la que pagó.
            </div>
          )}

          {/* La cuenta a la vista: total − tomado − lo que se paga ahora. */}
          <div className={s['form-grid']}>
            <div className={s.field}>
              <label>Se paga ahora</label>
              <input
                type="number" min="0" step="any"
                placeholder="0,00 = queda en cuenta corriente"
                value={pagarAhora}
                onChange={(e) => setPagarAhora(e.target.value)}
              />
              {saldoFinal > 0.009 && totalTomado <= 0.009 && (
                <button
                  type="button" className={s.linkBtn} tabIndex={-1}
                  onClick={() => setPagarAhora(String(r2(total)))}
                >
                  Pagar el total
                </button>
              )}
            </div>
            {ahora > 0 && (
              <>
                <div className={s.field}>
                  <label>Medio</label>
                  <select value={medioPago} onChange={(e) => setMedioPago(e.target.value)}>
                    {Object.entries(MEDIOS_PAGO_COMPRA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className={s.field}>
                  <label>¿De dónde sale?</label>
                  <select value={origenPago} onChange={(e) => setOrigenPago(e.target.value)}>
                    <option value="">Administración (sin caja)</option>
                    {turno && <option value={String(turno.id)}>Caja de la sucursal · turno #{turno.id}</option>}
                  </select>
                  <div className={s.hint} style={{ margin: '6px 0 0' }}>
                    {turno
                      ? 'Con la caja elegida, el egreso queda en ese turno y el arqueo lo muestra.'
                      : 'No hay turno abierto en esa sucursal: sale de administración y no impacta en ningún arqueo.'}
                  </div>
                </div>
                {medioPago !== 'efectivo' && (
                  <div className={s.field}>
                    <label>Referencia</label>
                    <input
                      value={refPago}
                      placeholder="Nº de transferencia, cheque…"
                      onChange={(e) => setRefPago(e.target.value)}
                    />
                  </div>
                )}
              </>
            )}
          </div>

          <div
            className={cx(s.callout, saldoFinal < -0.009 ? s.danger : saldoFinal > 0.009 ? s.warn : s.ok)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}
          >
            <span>
              Total {money(total)} − tomado {money(totalTomado)} − ahora {money(ahora)}
            </span>
            <strong style={{ fontSize: 18 }}>
              {saldoFinal < -0.009
                ? `Te pasaste por ${money(Math.abs(saldoFinal))}`
                : saldoFinal > 0.009
                  ? `Queda debiendo ${money(saldoFinal)}`
                  : 'Queda saldada'}
            </strong>
          </div>
        </>
      )}

      {/* El vencimiento solo tiene sentido si algo queda debiéndose. */}
      {generaDeuda && saldoFinal > 0.009 && (
        <div className={s['form-grid']}>
          <div className={s.field}>
            <label>Vencimiento de pago</label>
            <input type="date" value={venc} onChange={(e) => setVenc(e.target.value)} />
            <div className={s.hint} style={{ margin: '6px 0 0' }}>
              Para el saldo que queda en cuenta corriente.
            </div>
          </div>
        </div>
      )}

      <div className={s.field} style={{ marginTop: 14 }}>
        <label>Observaciones</label>
        <textarea rows="2" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Referencia, remito asociado, etc." />
      </div>
      </>
      )}
      </ModalShell>

      {/* Montado ENCIMA del formulario, que sigue vivo con lo ya cargado. */}
      {busquedaLote && (
        <BusquedaLoteModal
          candidatos={candidatos}
          proveedorNombre={provElegido?.nombre || 'este proveedor'}
          yaCargados={new Set(items.map((it) => parseInt(it.productoId, 10)).filter(Boolean))}
          onAgregar={agregarLote}
          onClose={() => setBusquedaLote(false)}
        />
      )}

      {/* Los dos del pie, encima del formulario, que sigue vivo con lo cargado. */}
      {modalPie === 'bonificacion' && (
        <BonificacionModal
          bruto={bruto}
          pct={bonifPct}
          importeManual={bonifManual}
          onAplicar={(p, imp) => {
            setBonifPct(p);
            setBonifManual(imp === null || imp === '' ? null : Number(imp) || 0);
            setModalPie(null);
          }}
          onQuitar={() => { setBonifPct(''); setBonifManual(null); setModalPie(null); }}
          onClose={() => setModalPie(null)}
        />
      )}
      {modalPie === 'percepciones' && (
        <PercepcionesModal
          proveedorNombre={provElegido?.nombre || 'este proveedor'}
          filas={percCalculadas}
          onAplicar={(filas) => {
            setPercepciones(filas.map((p) => ({
              ...p,
              importeManual: p.importeManual === null || p.importeManual === ''
                ? null
                : Number(p.importeManual) || 0,
            })));
            setModalPie(null);
          }}
          onClose={() => setModalPie(null)}
        />
      )}
    </>
  );
}

function nuevoItem() {
  return { productoId: '', bultos: '1', porBulto: '', costoBulto: '', descuento: '0', iva: '21', costoAuto: true };
}

/* ==================================================================== *
 * Pie de la factura: los dos modales chicos
 * ==================================================================== *
 * La bonificación y las percepciones son la EXCEPCIÓN, no la regla: la mayoría
 * de las facturas no traen ninguna. Por eso no viven ocupando el formulario —
 * se agregan con un botón y el pie muestra solo lo que de verdad vino.
 */

/** El descuento general del pie. El % es lo que dice el papel; el importe manda. */
function BonificacionModal({ bruto, pct, importeManual, onAplicar, onQuitar, onClose }) {
  const [p, setP] = useState(pct ?? '');
  const [imp, setImp] = useState(importeManual);
  const calc = r2(bruto * (Number(p) || 0) / 100);
  const importe = Math.min(imp != null ? Number(imp) || 0 : calc, r2(bruto));
  const hay = (Number(pct) || 0) > 0 || (importeManual ?? 0) > 0;

  return (
    <ModalShell
      title="Bonificación de la factura"
      subtitle="El descuento general del pie, aparte de los de cada renglón"
      onClose={onClose}
      footer={[
        ...(hay ? [{ texto: 'Quitar', clase: 'btn-delete', onClick: onQuitar }] : []),
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: onClose },
        { texto: 'Aplicar', clase: 'btn-primary', onClick: () => onAplicar(p, imp) },
      ]}
    >
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Bonificación %</label>
          <input
            type="number" min="0" max="99.99" step="any" autoFocus
            placeholder="0"
            value={p}
            onChange={(e) => { setP(e.target.value); setImp(null); }}
          />
        </div>
        <div className={s.field}>
          <label>Importe</label>
          <input
            type="number" min="0" step="any"
            placeholder={money(calc)}
            value={imp != null ? imp : (p ? r2(calc) : '')}
            onChange={(e) => setImp(e.target.value === '' ? null : e.target.value)}
          />
          <div className={s.hint} style={{ margin: '6px 0 0' }}>
            Se calcula solo; corregilo si el papel dice otro número — el proveedor
            redondea a su modo y el total tiene que dar igual.
          </div>
        </div>
      </div>
      <div className={cx(s.callout, s.ok)} style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Subtotal {money(bruto)} − bonificación</span>
        <strong>{money(r2(bruto) - importe)}</strong>
      </div>
    </ModalShell>
  );
}

/**
 * Las percepciones del proveedor, para tildar las que trajo ESTA factura. Acá
 * el check tiene sentido: son una lista corta y conocida, y la pregunta es
 * "¿cuál de estas vino?".
 */
function PercepcionesModal({ proveedorNombre, filas, onAplicar, onClose }) {
  const [borrador, setBorrador] = useState(filas);
  const set = (i, patch) => setBorrador((r) => r.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const total = borrador.reduce(
    (a, p) => a + (p.aplicar ? (p.importeManual != null ? Number(p.importeManual) || 0 : p.calc) : 0),
    0,
  );

  return (
    <ModalShell
      title="Percepciones de la factura"
      subtitle={`Las que ${proveedorNombre} tiene configuradas — tildá la que vino`}
      wide
      onClose={onClose}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: onClose },
        { texto: 'Aplicar', clase: 'btn-primary', onClick: () => onAplicar(borrador) },
      ]}
    >
      <Table cols={[{ h: 'Vino' }, { h: 'Percepción' }, { h: 'Alícuota', num: true }, { h: 'Importe', num: true }]}>
        {borrador.map((p, i) => (
          <tr key={p.id ?? i}>
            <td style={{ width: 60 }}>
              <input
                type="checkbox"
                checked={p.aplicar}
                aria-label={`Aplicar ${p.nombre}`}
                onChange={(e) => set(i, { aplicar: e.target.checked })}
              />
            </td>
            <td>
              {p.nombre}
              <div className={s.hint} style={{ margin: 0 }}>
                sobre {p.base === 'total' ? 'el total con IVA' : 'el neto gravado'}
              </div>
            </td>
            <td className={s.num}>{num(p.alicuota, 2)}%</td>
            <td className={s.num}>
              {p.aplicar ? (
                <input
                  type="number" min="0" step="any" style={{ maxWidth: 140 }}
                  value={p.importeManual != null ? p.importeManual : r2(p.calc)}
                  onChange={(e) => set(i, { importeManual: e.target.value === '' ? null : e.target.value })}
                />
              ) : <span className={s.muted}>{money(p.calc)}</span>}
            </td>
          </tr>
        ))}
      </Table>
      <div className={cx(s.callout, s.ok)} style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Percepciones a sumar al total</span><strong>{money(total)}</strong>
      </div>
      <div className={s.hint}>
        El importe se calcula con la alícuota; corregilo si el papel dice otro. No son IVA: son
        pago a cuenta de otro impuesto y se declaran por separado.
      </div>
    </ModalShell>
  );
}

/* ==================================================================== *
 * Búsqueda en lote
 * ==================================================================== *
 * El Shift+Ins de la caja, versión compras: los productos del proveedor con
 * filtros por texto, marca y categoría, tildado manual y entrada de todos
 * juntos a la factura — cada uno con el costo de este proveedor precargado.
 */
function BusquedaLoteModal({ candidatos, proveedorNombre, yaCargados, onAgregar, onClose }) {
  const [texto, setTexto] = useState('');
  const [marca, setMarca] = useState('');
  const [categoria, setCategoria] = useState('');
  const [checks, setChecks] = useState(() => new Set());

  // Los filtros se arman con lo que este proveedor realmente trae, no con el
  // catálogo entero: ofrecer marcas que él no vende sería ruido.
  const marcas = useMemo(
    () => [...new Set(candidatos.map((c) => c.prod.marca).filter(Boolean))].sort(),
    [candidatos],
  );
  const categorias = useMemo(
    () => [...new Set(candidatos.map((c) => c.prod.categoria).filter(Boolean))].sort(),
    [candidatos],
  );

  const resultados = useMemo(() => {
    const ql = norm(texto);
    const digitos = texto.replace(/\D/g, '');
    return candidatos.filter((c) => {
      if (marca && c.prod.marca !== marca) return false;
      if (categoria && c.prod.categoria !== categoria) return false;
      if (!ql) return true;
      return norm(c.prod.nombre).includes(ql)
        || (c.prod.codigoPropio && norm(c.prod.codigoPropio).includes(ql))
        || (digitos.length >= 4 && c.prod.codigoBarras && c.prod.codigoBarras.includes(digitos));
    }).slice(0, 200);
  }, [candidatos, texto, marca, categoria]);

  const toggle = (id) => setChecks((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const confirmar = () => {
    onAgregar(candidatos.filter((c) => checks.has(c.prod.id)));
  };

  return (
    <ModalShell
      title={`Productos de ${proveedorNombre}`}
      subtitle="Tildá lo que vino y entra todo junto a la factura"
      size="lg"
      onClose={onClose}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: onClose },
        { texto: checks.size ? `Agregar ${checks.size} ítem(s)` : 'Agregar', clase: 'btn-primary', onClick: confirmar },
      ]}
    >
      <div className={s.toolbar}>
        <input
          type="search" autoFocus style={{ flex: 1, minWidth: 180 }}
          placeholder="Nombre, código interno o código de barras…"
          value={texto} onChange={(e) => setTexto(e.target.value)}
        />
        <select className={s['select-inline']} value={marca} onChange={(e) => setMarca(e.target.value)}>
          <option value="">Todas las marcas</option>
          {marcas.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select className={s['select-inline']} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <Table
        cols={[{ h: '' }, { h: 'Producto' }, { h: 'Marca' }, { h: 'Proveedor activo' }, { h: 'Costo de este prov.', num: true }]}
        empty={candidatos.length
          ? 'Sin coincidencias con esos filtros.'
          : `${proveedorNombre} todavía no tiene productos relacionados. Se suman desde el Formato de Compra de cada producto, o creando el producto con su proveedor.`}
      >
        {resultados.map((c) => {
          const ya = yaCargados.has(c.prod.id);
          return (
            <tr
              key={c.prod.id}
              className={ya ? undefined : s.clickable}
              onClick={ya ? undefined : () => toggle(c.prod.id)}
              style={ya ? { opacity: 0.55 } : undefined}
            >
              <td style={{ width: 36 }}>
                {/* En una factura, el mismo producto dos veces es casi siempre un
                    error de carga: el ya cargado no se puede volver a tildar.
                    stopPropagation: sin él, el click en el checkbox dispara
                    también el onClick de la fila y los dos toggles se anulan. */}
                <input
                  type="checkbox"
                  disabled={ya}
                  checked={ya || checks.has(c.prod.id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggle(c.prod.id)}
                />
              </td>
              <td>
                {c.prod.nombre}
                <div className={s.hint} style={{ margin: 0 }}>
                  {c.prod.codigoPropio ? `#${c.prod.codigoPropio}` : ''}
                  {ya ? ' · ya en la factura' : ''}
                </div>
              </td>
              <td>{c.prod.marca || '—'}</td>
              <td>
                {c.esActivo
                  ? <span className={cx(s.badge, s['badge-entero'])}>este proveedor</span>
                  : c.activoNombre}
              </td>
              <td className={s.num}>
                {c.entry?.costo > 0 ? (
                  <>
                    {money(c.entry.costo)}
                    <div className={s.hint} style={{ margin: 0 }}>
                      bulto {num(c.entry.cantidad || 1, 3)} {unidadDe(c.prod)} · {money(c.entry.costo / (c.entry.cantidad || 1))}/{unidadDe(c.prod).replace('.', '')}
                    </div>
                  </>
                ) : <span className={s.muted}>sin costo</span>}
              </td>
            </tr>
          );
        })}
      </Table>
    </ModalShell>
  );
}
function productoProveedorOptions(store) {
  // El padrón es UNO, pero acá solo tienen sentido los que traen mercadería:
  // al plomero no se le compra stock (sus facturas van por el módulo Gastos).
  return store.state.proveedores
    .filter((p) => p.proveeMercaderia !== false)
    .map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>);
}

/* ============================== DETALLE DE COMPROBANTE ============================== */
export function ComprobanteDetalleModal({ id }) {
  const { store, closeModal, openModal } = useProductos();
  const c = store.getComprobante(id);
  if (!c) return null;
  const prov = store.getProveedor(c.proveedorId);
  const suc = c.sucursalId ? store.getSucursal(c.sucursalId) : null;
  const saldo = c.saldo ?? Math.round((c.total - (c.pagado ?? 0)) * 100) / 100;
  // Solo la factura y la ND generan deuda: son las únicas que se pagan.
  /* LISTA DE TIPOS · se puede pagar desde el detalle. Sin la liquidación acá, la
   * deuda de la mitad no facturada no tenía botón Pagar en ningún lado. */
  const puedePagar = c.estado === 'confirmado'
    && (c.tipo === 'factura' || c.tipo === 'liquidacion' || c.tipo === 'nota_debito');

  const Di = ({ label, children }) => <div className={s.di}><div className={s.l}>{label}</div><div className={s.v}>{children}</div></div>;

  const filas = c.items.map((it, i) => {
    const p = store.getProducto(it.productoId);
    return (
      <tr key={i}>
        <td>{p ? p.nombre : '—'}</td>
        <td>{p ? store.presLabel(p, it.presentacionId) : '—'}</td>
        <td className={s.num}>{num(it.cantidad, 3)}</td>
        <td className={s.num}>{money(it.costoUnitario)}</td>
        <td className={s.num}>{num(it.descuento, 1)}%</td>
        <td className={s.num}>{num(it.iva, 1)}%</td>
        <td className={cx(s.num, s.mono)}>{money(it.subtotal)}</td>
      </tr>
    );
  });

  return (
    <ModalShell title={'Comprobante ' + comprobanteNro(c)} wide onClose={closeModal} footer={[{ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal }]}>
      <div className={s['detalle-grid']}>
        <Di label="Tipo"><ComprobanteTag tipo={c.tipo} /></Di>
        <Di label="Estado"><ComprobanteEstadoPill estado={c.estado} /></Di>
        <Di label="Proveedor">{prov ? prov.nombre : '—'}</Di>
        <Di label="Fecha del comprobante">{fmtFecha(c.fecha)}</Di>
        <Di label="Fecha de carga">{c.fechaCarga ? fmtFecha(c.fechaCarga) : '—'}</Di>
        <Di label="Condición">{CONDICIONES_PAGO[c.condicionPago] || c.condicionPago}</Di>
        <Di label="Recepción">{c.recepcion ? 'Sí (ingresó stock)' : 'No'}</Di>
        <Di label="Sucursal">{suc ? suc.nombre : '—'}</Di>
        <Di label="Vencimiento">{c.vencimientoPago ? fmtFecha(c.vencimientoPago) : '—'}</Di>
        <Di label="Total">{money(c.total)}</Di>
      </div>
      {c.observaciones && <div className={s.callout}>{c.observaciones}</div>}

      {/* ---- De dónde salió la plata ---- */}
      {(c.pagos?.length > 0 || saldo > 0.009) && (
        <>
          <h3 className={s['card-title']}>Pagos</h3>
          <Table
            cols={[{ h: 'Fecha' }, { h: 'Medio' }, { h: 'Origen' }, { h: 'Importe', num: true }]}
            empty="Todavía no se pagó nada de este comprobante."
          >
            {(c.pagos ?? []).map((p) => (
              <tr key={p.pagoId}>
                <td>{fmtFecha(p.fecha)}</td>
                <td>{p.medio}</td>
                <td>
                  {p.cajaSesionId
                    ? `${p.sucursalNombre || 'sucursal'} · turno #${p.cajaSesionId}${p.usuarioNombre ? ` · ${p.usuarioNombre}` : ''}`
                    : 'Administración (sin caja)'}
                </td>
                <td className={s.num}>{money(p.importe)}</td>
              </tr>
            ))}
          </Table>
          {saldo > 0.009 && (
            <div className={cx(s.callout, s.warn)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Queda debiendo <strong>{money(saldo)}</strong></span>
              {/*
                La puerta para el caso inverso: la factura ya estaba cargada y el
                pago llegó después. Aplicar SIEMPRE se hace desde el documento —
                acá o en el alta—, nunca desde la bandeja de pagos.
              */}
              {puedePagar && (
                <Btn
                  variant="btn-primary"
                  small
                  onClick={() => openModal('tomarPagosComprobante', { comprobanteId: c.id, proveedorId: c.proveedorId })}
                >
                  Tomar un pago de sucursal
                </Btn>
              )}
            </div>
          )}
        </>
      )}

      <h3 className={s['card-title']}>Ítems</h3>
      <Table cols={[{ h: 'Producto' }, { h: 'Present.' }, { h: 'Cant.', num: true }, { h: 'Costo u.', num: true }, { h: 'Desc.', num: true }, { h: 'IVA', num: true }, { h: 'Subtotal', num: true }]}>
        {filas}
      </Table>
      {/* El pie, como lo lee el papel: así se puede cuadrar contra la factura. */}
      <div className={cx(s.callout, s.ok)} style={{ marginTop: 12 }}>
        {c.bonificacionImporte > 0.009 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Subtotal de los ítems</span>
              <strong>{money(c.subtotalNeto + c.bonificacionImporte)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--crm-color-success)' }}>
              <span>Bonificación {c.bonificacion > 0 ? `${num(c.bonificacion, 2)}%` : ''}</span>
              <strong>− {money(c.bonificacionImporte)}</strong>
            </div>
          </>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Neto gravado</span><strong>{money(c.subtotalNeto)}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>IVA</span><strong>{money(c.ivaTotal)}</strong>
        </div>
        {(c.percepciones ?? []).map((p) => (
          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>
              {p.nombre}
              <span className={s.muted}> · {num(p.alicuota, 2)}% sobre {p.base === 'total' ? 'el total' : 'el neto'}</span>
            </span>
            <strong>{money(p.importe)}</strong>
          </div>
        ))}
        <div
          style={{
            display: 'flex', justifyContent: 'space-between', marginTop: 6, paddingTop: 6,
            borderTop: '1px solid var(--crm-color-border)', fontSize: 16,
          }}
        >
          <strong>TOTAL</strong><strong>{money(c.total)}</strong>
        </div>
      </div>
      {c.percepcionesTotal > 0.009 && (
        <div className={s.hint}>
          Las percepciones <strong>no son IVA</strong>: son pago a cuenta de otro impuesto y se
          declaran por separado. Están en el total porque hay que pagárselas al proveedor, pero no
          entran en el crédito fiscal de IVA.
        </div>
      )}

      {/* LAS DOS PUNTAS DEL VÍNCULO CON LAS NOTAS. El total del papel no cambia
          nunca; lo que cambia es cuánto queda debiéndose por ese documento, y eso
          hay que poder leerlo acá sin cruzar a otra pantalla. */}
      {c.refEtiqueta && (
        <div className={cx(s.callout, s.info)}>
          {c.tipo === 'nota_credito' ? 'Descuenta' : 'Recarga'} <strong>{money(c.total)}</strong>
          {' '}{c.tipo === 'nota_credito' ? 'de' : 'a'} <strong>{c.refEtiqueta}</strong>.
        </div>
      )}

      {(c.notas || []).length > 0 && (
        <>
          <div className={s['section-title']}>Notas que ajustan esta factura</div>
          <Table cols={[{ h: 'Nota' }, { h: 'Fecha' }, { h: 'Importe', num: true }]}>
            {c.notas.map((n) => (
              <tr key={n.id}>
                <td>
                  {n.tipo === 'nota_credito' ? 'NC' : 'ND'} {n.letra} {n.puntoVenta}-{n.numero ?? n.id}
                  {n.observaciones && <div className={s.hint} style={{ margin: 0 }}>{n.observaciones}</div>}
                </td>
                <td>{fmtFecha(n.fecha)}</td>
                <td className={cx(s.num, s.mono)}>
                  <strong>{n.signo > 0 ? '+' : '−'}{money(n.total)}</strong>
                </td>
              </tr>
            ))}
          </Table>
          <div
            style={{
              display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 8,
              borderTop: '1px solid var(--crm-color-border)',
            }}
          >
            <span>Total del papel {money(c.total)} · ajuste de las notas {money(c.ajuste)} · pagado {money(c.pagado)}</span>
            <strong style={{ fontSize: 16 }}>Queda debiéndose {money(c.saldo)}</strong>
          </div>
          <div className={s.hint}>
            El total del papel no cambia nunca — la factura sigue diciendo {money(c.total)}. Lo que
            cambia es cuánto queda debiéndose por ella, y es lo que la bandeja de pago ofrece.
          </div>
        </>
      )}
    </ModalShell>
  );
}
