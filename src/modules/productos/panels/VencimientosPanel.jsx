/**
 * VENCIMIENTOS — el vigía de fechas, sin lote.
 * ============================================================================
 * La LÓGICA vino de la app externa de vencimientos; el DATO es 100% de este
 * sistema: catálogo, sucursales, costos y usuarios reales. El registro NO es
 * stock — es una lista de control con el costo congelado del día — y el stock
 * se toca recién al PROCESAR lo vencido (baja real, movimiento 'vencido').
 *
 * Siete pestañas = los siete momentos del circuito:
 *   Panel     las alertas por rango EXCLUYENTE (vencido / 0-7 / 8-15 / 16-30)
 *   Control   caminar la góndola: lector USB o buscador, lista, guardar todo
 *   Registros todo lo anotado: filtros, editar, oferta, exportar
 *   Ofertas   el cruce con Ventas: qué está en oferta y qué se desalineó
 *   Vencidos  cerrar el ciclo: vendidas vs perdidas → pérdida REAL
 *   Mermas    la baja de stock de siempre (se mudó acá: es la misma historia)
 *   Reportes  el análisis: por sucursal, categoría, frecuentes, historial
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import { cx } from '@shared/utils/classNames.js';
import { descargarCsv } from '@shared/utils/csv.js';
/* El motor de ofertas vive en Ventas y es UNO SOLO: de ahí sale también la
 * frase de cada mecánica, para que «3×2» se lea igual en las dos pantallas. */
import { describirOferta } from '@modules/ventas/domain/ofertas.js';
import { useProductos } from '../context/ProductosContext.jsx';
import { useSeccion } from '../hooks/useSeccion.js';
import { money, num, fmtFechaHora, fmtFechaVenc } from '../domain/format.js';
import { RANGOS_VENC, rangoVenc } from '../domain/constants.js';
import { motivoSinCamara } from '../domain/leerCodigoBarras.js';
import { EscanerCamara } from '../components/EscanerCamara.jsx';
import { BuscadorCatalogo } from '../components/modals/CafeteriaModals.jsx';
import { sucursalOptions } from '../components/selectOptions.jsx';
import { Table, PanelHead, Btn, Pill, usePaginado, s } from '../components/ui.jsx';

const PESTANAS = [
  { id: 'panel', label: 'Panel' },
  { id: 'control', label: 'Control' },
  { id: 'registros', label: 'Registros' },
  { id: 'ofertas', label: 'Ofertas' },
  { id: 'vencidos', label: 'Vencidos' },
  { id: 'mermas', label: 'Mermas' },
  { id: 'reportes', label: 'Reportes' },
];

/** Estado de la oferta → color, igual que en Ventas › Ofertas. */
const PILL_OFERTA = {
  vigente: { pill: 'est-recibida', label: 'Vigente' },
  programada: { pill: 'est-pendiente', label: 'Programada' },
  vencida: { pill: 'est-revision', label: 'Terminada' },
  inactiva: { pill: 'est-cancelada', label: 'Apagada' },
};

/** El camino al motor de ofertas con el formulario ya lleno. */
const RUTA_NUEVA_OFERTA = (vencimientoId) => `/ventas?panel=ofertas&nuevaOferta=${vencimientoId}`;

const hoyIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};


function RangoPill({ dias }) {
  const r = RANGOS_VENC[rangoVenc(dias)];
  const detalle = dias < 0 ? `hace ${Math.abs(dias)} d` : dias === 0 ? 'HOY' : `en ${dias} d`;
  return <span style={{ whiteSpace: 'nowrap' }}><Pill pill={r.pill} label={`${r.label} · ${detalle}`} /></span>;
}

/* ============================== PANEL (resumen) ============================== */
function TabPanel({ resumen, irA, cruce, irAOfertas }) {
  const { store } = useProductos();
  if (!resumen) return <div className={s.hint}>Cargando…</div>;
  const graves = cruce?.resumen?.graves ?? 0;
  const T = ({ rango, titulo, sub }) => {
    const d = resumen[rango] || { n: 0, unidades: 0, plata: 0 };
    const r = RANGOS_VENC[rango === 'vencidos' ? 'vencido' : rango] || {};
    return (
      <button
        type="button" className={s.card}
        style={{ padding: '12px 14px', textAlign: 'left', cursor: 'pointer', minWidth: 150, flex: '1 1 150px', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--crm-color-border)' }}
        onClick={() => irA(rango === 'vencidos' ? 'vencido' : rango)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
          <span className={s['mini-label']}>{titulo}</span>
          <Pill pill={r.pill} label={String(d.n)} />
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{money(d.plata)}</div>
        <div className={s.hint}>{num(d.unidades)} unidades · {sub}</div>
      </button>
    );
  };
  const ultimos = (resumen.ultimos || []).map((v) => (
    <tr key={v.id}>
      <td>{v.nombre}</td>
      <td>{store.getSucursal(v.sucursalId)?.nombre ?? '—'}</td>
      <td>{fmtFechaVenc(v.fechaVencimiento)}</td>
      <td><RangoPill dias={v.diasParaVencer} /></td>
      <td className={s.num}>{num(v.cantidad)} {v.unidad}</td>
    </tr>
  ));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Lo más caro que puede estar pasando ahora mismo: descuento puesto
          sobre mercadería que ya venció. Va arriba de todo. */}
      {graves > 0 && (
        <div className={cx(s.callout, s.warn)} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>
            <strong>
              ⚠ {graves === 1 ? 'Una oferta está descontando' : `${graves} ofertas están descontando`} mercadería VENCIDA
            </strong>
            {cruce.resumen.plataGrave > 0 ? <> — {money(cruce.resumen.plataGrave)} en góndola.</> : '.'}{' '}
            Se vende con descuento algo que ya pasó su fecha.
          </span>
          <Btn variant="btn-primary" small onClick={irAOfertas}>Ver el cruce</Btn>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <T rango="vencidos" titulo="VENCIDOS SIN PROCESAR" sub="retirar y procesar" />
        <T rango="d7" titulo="VENCEN EN 0-7 DÍAS" sub="promoción ya" />
        <T rango="d15" titulo="EN 8-15 DÍAS" sub="planificar promo" />
        <T rango="d30" titulo="EN 16-30 DÍAS" sub="monitorear" />
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div className={s.card} style={{ padding: '12px 14px', flex: '1 1 220px' }}>
          <span className={s['mini-label']}>PROCESADOS (HISTÓRICO)</span>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: 'var(--crm-color-danger)' }}>
            {money(resumen.procesados?.perdidaReal)}
          </div>
          <div className={s.hint}>
            pérdida real de {resumen.procesados?.n ?? 0} cierres · {num(resumen.procesados?.vendidas)} vendidas a tiempo · {num(resumen.procesados?.perdidas)} perdidas
          </div>
        </div>
        <div className={s.card} style={{ padding: '12px 14px', flex: '1 1 220px' }}>
          <span className={s['mini-label']}>VIGENTES (+30 DÍAS)</span>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{resumen.vigentes?.n ?? 0}</div>
          <div className={s.hint}>registrados con tiempo de sobra</div>
        </div>
      </div>
      <div>
        <h3 className={s['card-title']}>Últimos registros</h3>
        <Table cols={[{ h: 'Producto' }, { h: 'Sucursal' }, { h: 'Vence' }, { h: 'Estado' }, { h: 'Cantidad', num: true }]}
          empty="Sin registros todavía. La pestaña Control es el punto de partida.">
          {ultimos}
        </Table>
      </div>
    </div>
  );
}

/* ============================== CONTROL (la sesión) ============================== */
/**
 * El orden de los campos sigue el ORDEN FÍSICO del acto: primero agarrás el
 * paquete y lo identificás (escaneo con la cámara, con el lector USB, o lo
 * buscás), después leés la fecha impresa y la tipeás, después contás cuántos
 * hay. Producto → fecha → cantidad → Agregar.
 *
 * Fecha y cantidad se CONSERVAN al agregar: cuando toda una tanda vence igual,
 * el segundo producto es solo escanear y agregar.
 */
function TabControl({ sesion, setSesion, alGuardar }) {
  const { store, toast, sucOperativa } = useProductos();
  const [sucElegida, setSucElegida] = useState(() => String(sucOperativa() || ''));
  const [elegido, setElegido] = useState(null); // el paquete en la mano
  const [fecha, setFecha] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [obs, setObs] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [camara, setCamara] = useState(false);
  const fechaRef = useRef(null);

  const activa = !!sesion.sucursalId;
  const sinCamara = motivoSinCamara();

  /** Paso 1: identificar el paquete. No agrega nada todavía. */
  const elegirProducto = useCallback((prod, presId) => {
    const pres = presId ? (prod.presentaciones || []).find((x) => x.id === presId) : null;
    const nombre = pres
      ? `${prod.nombre} · ${pres.tamKg < 1 ? `${Math.round(pres.tamKg * 1000)} g` : `${pres.tamKg} kg`}`
      : prod.nombre;
    setElegido({
      productoId: prod.id,
      presentacionId: presId ?? null,
      nombre,
      unidad: pres ? 'paq.' : (prod.tipo === 'granel' ? 'kg' : 'u.'),
      codigoBarras: pres?.codigoBarras || prod.codigoBarras || '',
    });
    // El foco va a la fecha: es lo próximo que hay que mirar en el paquete.
    setTimeout(() => fechaRef.current?.focus(), 0);
    return true;
  }, []);

  /** Busca un código EXACTO en el catálogo (producto o presentación). */
  const porCodigo = useCallback((codigo) => {
    for (const p of store.state.productos) {
      if (p.codigoBarras === codigo) return { prod: p, presId: null };
      const pres = (p.presentaciones || []).find((x) => x.codigoBarras === codigo);
      if (pres) return { prod: p, presId: pres.id };
    }
    return null;
  }, [store]);

  const desdeCodigo = useCallback((codigo) => {
    const hit = porCodigo(codigo);
    if (hit) { elegirProducto(hit.prod, hit.presId); return true; }
    toast(`El código ${codigo} no está en el catálogo.`, 'err');
    return false;
  }, [porCodigo, elegirProducto, toast]);

  /** Paso 3: sumar el renglón a la lista del control. */
  const agregarALista = useCallback(() => {
    if (!elegido) { toast('Primero elegí el producto (escaneá o buscá).', 'err'); return; }
    if (!fecha) { toast('Falta la fecha de vencimiento del paquete.', 'err'); fechaRef.current?.focus(); return; }
    const c = Number(cantidad) || 0;
    if (!(c > 0)) { toast('La cantidad debe ser mayor a 0.', 'err'); return; }
    setSesion((sn) => {
      const filas = [...sn.filas];
      const i = filas.findIndex((f) => f.productoId === elegido.productoId
        && (f.presentacionId ?? null) === elegido.presentacionId && f.fechaVencimiento === fecha);
      if (i >= 0) filas[i] = { ...filas[i], cantidad: filas[i].cantidad + c };
      else filas.push({ ...elegido, cantidad: c, fechaVencimiento: fecha, observaciones: obs.trim() });
      return { ...sn, filas };
    });
    toast(`${elegido.nombre} anotado (${num(c)} ${elegido.unidad}).`, 'ok');
    // Se limpia el producto y las observaciones; la FECHA y la cantidad quedan
    // (la tanda que vence igual se anota escaneando y agregando, nada más).
    setElegido(null); setObs('');
  }, [elegido, fecha, cantidad, obs, setSesion, toast]);

  /* Lector USB (teclado cuña): escribe rápido y termina con Enter. El buffer
   * junta lo tecleado cuando el foco NO está en un input; con Enter y 6+
   * caracteres se busca el código EXACTO y queda elegido. */
  useEffect(() => {
    if (!activa) return undefined;
    let buffer = ''; let timer = null;
    const onKey = (e) => {
      const enInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
      if (enInput) return;
      clearTimeout(timer);
      if (e.key === 'Enter') {
        if (buffer.length >= 6) desdeCodigo(buffer);
        buffer = '';
      } else if (e.key.length === 1) {
        buffer += e.key;
        timer = setTimeout(() => { buffer = ''; }, 120);
      }
    };
    document.addEventListener('keypress', onKey);
    return () => { document.removeEventListener('keypress', onKey); clearTimeout(timer); };
  }, [activa, desdeCodigo]);

  const totalU = sesion.filas.reduce((a, f) => a + f.cantidad, 0);

  const guardar = async () => {
    if (!sesion.filas.length || guardando) return;
    setGuardando(true);
    const r = await store.crearSesionVencimientos({
      sucursalId: Number(sesion.sucursalId),
      items: sesion.filas.map((f) => ({
        productoId: f.productoId, presentacionId: f.presentacionId ?? undefined,
        cantidad: f.cantidad, fechaVencimiento: f.fechaVencimiento,
        observaciones: f.observaciones || undefined,
      })),
    });
    setGuardando(false);
    if (!r.ok) { toast(r.error, 'err'); return; }
    toast(`Control guardado: ${r.registros} renglones, ${num(r.unidades)} unidades.`, 'ok');
    setSesion({ sucursalId: null, filas: [] });
    alGuardar();
  };

  if (!activa) {
    return (
      <div className={s.card} style={{ padding: 24, textAlign: 'center', maxWidth: 460, margin: '0 auto' }}>
        <div style={{ fontSize: 40 }}>📅</div>
        <h3 className={s['card-title']}>Nuevo control de vencimientos</h3>
        <p className={s.hint} style={{ margin: '6px 0 14px' }}>
          Elegí la sucursal que vas a caminar. Después, por cada paquete: lo identificás
          (cámara del celular, lector USB o buscándolo), leés la fecha impresa y contás
          cuántos hay — todo se junta en una lista y se guarda de un saque.
        </p>
        <div className={s.field} style={{ maxWidth: 260, margin: '0 auto' }}>
          <label>Sucursal del control</label>
          <select value={sucElegida} onChange={(e) => setSucElegida(e.target.value)}>
            <option value="">Elegir…</option>
            {sucursalOptions(store, false)}
          </select>
        </div>
        <div style={{ marginTop: 14 }}>
          <Btn
            variant="btn-primary"
            disabled={!sucElegida}
            onClick={() => sucElegida && setSesion((sn) => ({ ...sn, sucursalId: Number(sucElegida) }))}
          >
            Iniciar control
          </Btn>
        </div>
      </div>
    );
  }

  const filas = sesion.filas.map((f, i) => (
    <tr key={`${f.productoId}-${f.presentacionId ?? 0}-${f.fechaVencimiento}`}>
      <td>{f.nombre}{f.observaciones ? <div className={s.hint}>{f.observaciones}</div> : null}</td>
      <td>{fmtFechaVenc(f.fechaVencimiento)}</td>
      <td className={s.num} style={{ width: 90 }}>
        <input
          type="number" min="0" step={f.unidad === 'kg' ? '0.001' : '1'} value={f.cantidad}
          style={{ width: 80 }}
          onChange={(e) => {
            const v = Number(e.target.value) || 0;
            setSesion((sn) => ({ ...sn, filas: sn.filas.map((x, j) => (j === i ? { ...x, cantidad: v } : x)) }));
          }}
        />
      </td>
      <td>{f.unidad}</td>
      <td>
        <Btn variant="btn-delete" small onClick={() => setSesion((sn) => ({ ...sn, filas: sn.filas.filter((_, j) => j !== i) }))}>Quitar</Btn>
      </td>
    </tr>
  ));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className={cx(s.callout, s.info)} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>📍 Controlando <strong>{store.getSucursal(Number(sesion.sucursalId))?.nombre}</strong> · {sesion.filas.length} renglones · {num(totalU)} unidades</span>
        <Btn small onClick={() => setSesion({ sucursalId: null, filas: [] })}>Cambiar / cancelar</Btn>
      </div>

      <div className={s.card} style={{ padding: '12px 14px' }}>
        <div className={s['mini-label']} style={{ marginBottom: 6 }}>
          1· EL PRODUCTO (cámara, lector USB o buscándolo) → 2· LA FECHA DEL PAQUETE → 3· CUÁNTOS
        </div>

        {/* Paso 1: identificar el paquete que tenés en la mano. */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className={s.field} style={{ flex: '3 1 240px', minWidth: 200 }}>
            <label>Producto (nombre, código o barras)</label>
            <BuscadorCatalogo store={store} onElegir={elegirProducto} />
          </div>
          <div style={{ flex: '0 0 auto', paddingBottom: 2 }}>
            <Btn
              variant="btn-primary"
              onClick={() => (sinCamara ? toast(sinCamara, 'err') : setCamara(true))}
              title={sinCamara || 'Escanear el código con la cámara'}
            >
              <PhotoCameraIcon style={{ fontSize: 18, marginRight: 6, verticalAlign: '-4px' }} />
              Escanear
            </Btn>
          </div>
        </div>

        {elegido ? (
          <div className={cx(s.callout, s.ok)} style={{ marginTop: 8, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>
              📦 <strong>{elegido.nombre}</strong> · se anota en {elegido.unidad}
              {elegido.codigoBarras ? <span className={s.hint}> · {elegido.codigoBarras}</span> : null}
            </span>
            <Btn small onClick={() => setElegido(null)}>Cambiar producto</Btn>
          </div>
        ) : (
          <div className={s.hint} style={{ marginTop: 8 }}>
            Ningún producto elegido todavía. Escaneá el código o buscalo por nombre.
          </div>
        )}

        {/* Pasos 2 y 3: la fecha impresa y cuántos hay. */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 10 }}>
          <div className={s.field} style={{ flex: '1 1 150px', minWidth: 140 }}>
            <label>Fecha de vencimiento {elegido && !fecha && <span className={s.req}>*</span>}</label>
            <input
              type="date" ref={fechaRef} value={fecha} min="2000-01-01"
              onChange={(e) => setFecha(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') agregarALista(); }}
            />
          </div>
          <div className={s.field} style={{ flex: '0 1 100px', minWidth: 90 }}>
            <label>Cantidad ({elegido?.unidad ?? 'u.'})</label>
            <input
              type="number" min="0" step={elegido?.unidad === 'kg' ? '0.001' : '1'} value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') agregarALista(); }}
            />
          </div>
          <div className={s.field} style={{ flex: '1 1 160px', minWidth: 150 }}>
            <label>Observaciones</label>
            <input
              value={obs} placeholder="Góndola, detalle…"
              onChange={(e) => setObs(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') agregarALista(); }}
            />
          </div>
          <div style={{ flex: '0 0 auto', paddingBottom: 2 }}>
            <Btn variant={elegido && fecha ? 'btn-ingreso' : 'btn-ghost'} onClick={agregarALista}>
              + Agregar a la lista
            </Btn>
          </div>
        </div>

        {fecha && new Date(`${fecha}T00:00:00`) < new Date(new Date().setHours(0, 0, 0, 0)) && (
          <div className={cx(s.callout, s.warn)} style={{ marginTop: 8 }}>
            ⚠ Esa fecha ya pasó: lo que anotes entra directo como VENCIDO (vale — es la forma de asentar lo encontrado tarde).
          </div>
        )}
        {sinCamara && (
          <div className={s.hint} style={{ marginTop: 8 }}>
            📷 La cámara no está disponible acá: {sinCamara}
          </div>
        )}
      </div>

      {camara && (
        <EscanerCamara
          titulo="Escanear el paquete"
          onCerrar={() => setCamara(false)}
          onLeido={(codigo) => { setCamara(false); desdeCodigo(codigo); }}
        />
      )}

      <Table
        cols={[{ h: 'Producto' }, { h: 'Vence' }, { h: 'Cantidad', num: true }, { h: 'Unidad' }, { h: '' }]}
        empty="Lista vacía. Escaneá o buscá el primer producto."
      >
        {filas}
      </Table>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Btn
          variant="btn-primary"
          onClick={guardar}
          disabled={!sesion.filas.length || guardando}
        >
          {guardando ? 'Guardando…' : `Guardar control (${sesion.filas.length} renglones, ${num(totalU)} u.)`}
        </Btn>
      </div>
    </div>
  );
}

/* ============================== REGISTROS ============================== */
function TabRegistros({ registros, filtroRango, setFiltroRango }) {
  const { store, openModal, act, can } = useProductos();
  const navigate = useNavigate();
  /* Sin la sección de ofertas de Ventas el botón llevaría a una pantalla que el
   * rol no puede ver: mejor no ofrecerlo. */
  const puedeOfertar = can('ventas.ofertas');
  const [buscar, setBuscar] = useState('');
  const [sucF, setSucF] = useState('');
  const [soloOferta, setSoloOferta] = useState(false);

  const q = buscar.trim().toLowerCase();
  const visibles = registros.filter((v) => {
    if (filtroRango === 'abiertos' && v.procesado) return false;
    if (filtroRango && filtroRango !== 'abiertos' && rangoVenc(v.diasParaVencer) !== filtroRango) return false;
    if (sucF && v.sucursalId !== Number(sucF)) return false;
    if (soloOferta && !v.ofertaId) return false;
    if (q && !(`${v.nombre} ${v.codigoBarras} ${v.observaciones}`.toLowerCase().includes(q))) return false;
    return true;
  });
  const pag = usePaginado(visibles, 'vencimientos', `${filtroRango}|${sucF}|${q}|${soloOferta}`);

  const exportar = () => descargarCsv(
    `vencimientos-${hoyIso()}.csv`,
    ['Producto', 'Código', 'Sucursal', 'Vence', 'Días', 'Cantidad', 'Unidad', 'Costo congelado', 'Pérdida potencial', 'Oferta', 'Procesado', 'Vendidas', 'Pérdida real', 'Observaciones'],
    visibles.map((v) => [
      v.nombre, v.codigoBarras, store.getSucursal(v.sucursalId)?.nombre ?? '', fmtFechaVenc(v.fechaVencimiento),
      v.diasParaVencer, String(v.cantidad).replace('.', ','), v.unidad,
      String(v.costoUnitario.toFixed(2)).replace('.', ','), String((v.cantidad * v.costoUnitario).toFixed(2)).replace('.', ','),
      v.ofertaId ? 'sí' : '', v.procesado ? 'sí' : '', String(v.unidadesVendidas).replace('.', ','),
      v.procesado ? String(((v.cantidad - v.unidadesVendidas) * v.costoUnitario).toFixed(2)).replace('.', ',') : '',
      v.observaciones,
    ]),
  );

  const filas = pag.visibles.map((v) => {
    const abierto = !v.procesado;
    const vencido = v.diasParaVencer < 0;
    return (
      <tr key={v.id}>
        <td>
          {v.nombre}
          {v.observaciones ? <div className={s.hint}>{v.observaciones}</div> : null}
        </td>
        <td className={s.mono}>{v.codigoBarras || '—'}</td>
        <td>{store.getSucursal(v.sucursalId)?.nombre ?? '—'}</td>
        <td>{fmtFechaVenc(v.fechaVencimiento)}</td>
        <td>{v.procesado ? <Pill pill="est-recibida" label="Procesado" /> : <RangoPill dias={v.diasParaVencer} />}</td>
        <td className={s.num}>{num(v.cantidad)} {v.unidad}</td>
        <td className={s.num}>{money(v.cantidad * v.costoUnitario)}</td>
        <td>{v.ofertaId ? <Pill pill="est-preparada" label="🏷 En oferta" /> : '—'}</td>
        <td>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {abierto && !vencido && !v.ofertaId && puedeOfertar && (
              <Btn small onClick={() => navigate(RUTA_NUEVA_OFERTA(v.id))} title="Abre el motor de ofertas con este producto ya cargado">
                Oferta
              </Btn>
            )}
            {abierto && vencido && (
              <Btn variant="btn-primary" small onClick={() => openModal('vencimientoProcesar', { registro: v })}>Procesar</Btn>
            )}
            {abierto && <Btn variant="btn-edit" small onClick={() => openModal('vencimientoEditar', { registro: v })}>Editar</Btn>}
            {abierto && (
              <Btn variant="btn-delete" small onClick={() => {
                act(store.eliminarVencimiento(v.id), 'Registro eliminado.');
              }}>Borrar</Btn>
            )}
          </div>
        </td>
      </tr>
    );
  });

  const CHIPS = [
    ['', 'Todos'], ['abiertos', 'Abiertos'], ['vencido', 'Vencidos'], ['d7', '0-7'], ['d15', '8-15'], ['d30', '16-30'], ['vigente', '+30'],
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="search" placeholder="Buscar producto, código, observación…"
          value={buscar} onChange={(e) => setBuscar(e.target.value)}
          style={{ flex: '2 1 200px', minWidth: 180 }}
        />
        <select value={sucF} onChange={(e) => setSucF(e.target.value)} style={{ flex: '1 1 150px' }}>
          {sucursalOptions(store, true)}
        </select>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
          <input type="checkbox" checked={soloOferta} onChange={(e) => setSoloOferta(e.target.checked)} />
          Con oferta
        </label>
        <Btn small onClick={exportar}>Exportar CSV</Btn>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {CHIPS.map(([id, label]) => (
          <button
            key={id || 'todos'} type="button" className={s.badge}
            style={{
              cursor: 'pointer', padding: '5px 12px', fontSize: 12, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--crm-color-border)',
              ...(filtroRango === id ? { background: 'var(--crm-color-primary)', color: 'var(--crm-color-primary-contrast)', borderColor: 'var(--crm-color-primary)' } : {}),
            }}
            onClick={() => setFiltroRango(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <Table
        cols={[
          { h: 'Producto' }, { h: 'Código' }, { h: 'Sucursal' }, { h: 'Vence' }, { h: 'Estado' },
          { h: 'Cantidad', num: true }, { h: 'Pérdida potencial', num: true }, { h: 'Oferta' }, { h: 'Acciones' },
        ]}
        empty="Nada con esos filtros."
        pag={pag}
      >
        {filas}
      </Table>
      <div className={s.hint}>
        La pérdida potencial usa el costo CONGELADO al registrar. «Oferta» abre el motor de
        ofertas de Ventas con el producto, la fecha y la sucursal ya cargados — se crea ahí,
        como cualquier oferta, y queda atada a este registro. «Procesar» aparece cuando ya
        venció: ahí se define la pérdida real.
      </div>
    </div>
  );
}

/* ============================== OFERTAS (el cruce con Ventas) ============================== */
/**
 * Qué mercadería vigilada está —o debería estar— en oferta.
 *
 * No mira solo las ofertas nacidas acá: la API resuelve el alcance REAL de cada
 * oferta (producto, marca, categoría, etiqueta, componentes de combo) contra los
 * registros abiertos. Así aparece también la oferta que alguien armó en Ventas
 * sobre algo que además está por vencer, que es justo lo que uno quiere saber.
 *
 * El aviso que importa es uno: mercadería VENCIDA con la oferta corriendo — la
 * caja vendiendo con descuento algo que ya venció.
 */
function TabOfertas({ cruce, registros, recargar }) {
  const { store, openModal, can } = useProductos();
  const navigate = useNavigate();
  const [filtro, setFiltro] = useState('');
  const [sucF, setSucF] = useState('');

  const filas = cruce?.filas ?? [];
  const r = cruce?.resumen;

  const visibles = useMemo(() => filas.filter((f) => {
    if (filtro === 'aviso' && !f.alarma) return false;
    if (filtro === 'grave' && f.alarma?.severidad !== 'grave') return false;
    if (filtro === 'corriendo' && !f.corriendo) return false;
    if (sucF && f.sucursalId !== Number(sucF)) return false;
    return true;
  }), [filas, filtro, sucF]);

  const graves = filas.filter((f) => f.alarma?.severidad === 'grave');

  const exportar = () => descargarCsv(
    `productos-en-oferta-${hoyIso()}.csv`,
    ['Producto', 'Sucursal', 'Vence', 'Días', 'Cantidad', 'Unidad', 'En juego', 'Oferta', 'Mecánica', 'Estado oferta', 'Corriendo', 'Atada al registro', 'Aviso'],
    visibles.map((f) => [
      f.nombre, store.getSucursal(f.sucursalId)?.nombre ?? '', fmtFechaVenc(f.fechaVencimiento),
      f.diasParaVencer, String(f.cantidad).replace('.', ','), f.unidad,
      String(f.enJuego.toFixed(2)).replace('.', ','),
      f.ofertaNombre, describirOferta(ofertaDe(f)), PILL_OFERTA[f.ofertaEstado]?.label ?? f.ofertaEstado,
      f.corriendo ? 'sí' : '', f.vinculada ? 'sí' : '', f.alarma?.texto ?? '',
    ]),
  );

  if (!cruce) return <div className={s.hint}>Cargando…</div>;

  const CHIPS = [['', 'Todos'], ['aviso', 'Con aviso'], ['grave', 'Urgentes'], ['corriendo', 'Corriendo ahora']];

  const cuerpo = visibles.map((f) => {
    const reg = registros.find((x) => x.id === f.vencimientoId);
    const est = PILL_OFERTA[f.ofertaEstado] ?? { label: f.ofertaEstado };
    const sev = f.alarma?.severidad;
    return (
      <tr key={`${f.vencimientoId}-${f.ofertaId}`} style={sev === 'grave' ? { background: 'color-mix(in srgb, var(--crm-color-danger) 8%, transparent)' } : undefined}>
        <td>
          {f.nombre}
          <div className={s.hint}>{store.getSucursal(f.sucursalId)?.nombre ?? '—'}</div>
        </td>
        <td>
          {f.ofertaNombre}
          <div className={s.hint}>
            {describirOferta(ofertaDe(f))}
            {f.vinculada ? ' · atada a este registro' : ' · la alcanza por su alcance'}
          </div>
        </td>
        <td><Pill pill={est.pill} label={est.label} />{!f.corriendo && f.ofertaEstado === 'vigente' ? <div className={s.hint}>no llega a este lote</div> : null}</td>
        <td>{fmtFechaVenc(f.fechaVencimiento)}</td>
        <td><RangoPill dias={f.diasParaVencer} /></td>
        <td className={s.num}>{num(f.cantidad)} {f.unidad}</td>
        <td className={s.num}>{money(f.enJuego)}</td>
        <td style={{ maxWidth: 300 }}>
          {f.alarma
            ? <span style={sev === 'grave' ? { color: 'var(--crm-color-danger)', fontWeight: 600 } : undefined}>{f.alarma.texto}</span>
            : <span className={s.muted}>Todo en orden</span>}
        </td>
        <td>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {can('ventas.ofertas') && (
              <Btn small onClick={() => navigate('/ventas?panel=ofertas')}>Ver la oferta</Btn>
            )}
            {reg && f.diasParaVencer < 0 && (
              <Btn variant="btn-primary" small onClick={() => openModal('vencimientoProcesar', { registro: reg })}>
                Procesar
              </Btn>
            )}
          </div>
        </td>
      </tr>
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {graves.length > 0 && (
        <div className={cx(s.callout, s.warn)}>
          <strong>
            ⚠ {graves.length === 1
              ? 'Hay una oferta corriendo sobre mercadería que YA venció'
              : `Hay ${graves.length} ofertas corriendo sobre mercadería que YA venció`}
            {r.plataGrave > 0 ? ` — ${money(r.plataGrave)} en góndola` : ''}
          </strong>
          <div className={s.hint} style={{ marginTop: 4 }}>
            Es lo más urgente de esta pantalla: se está vendiendo con descuento algo vencido.
            Apagá la oferta en Ventas › Ofertas y procesá el registro acá.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div className={s.card} style={{ padding: '10px 14px', flex: '1 1 160px' }}>
          <span className={s['mini-label']}>PRODUCTOS EN OFERTA</span>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{r.productos}</div>
          <div className={s.hint}>{r.ofertas} oferta{r.ofertas === 1 ? '' : 's'} involucrada{r.ofertas === 1 ? '' : 's'}</div>
        </div>
        <div className={s.card} style={{ padding: '10px 14px', flex: '1 1 160px' }}>
          <span className={s['mini-label']}>DESCONTANDO AHORA</span>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--crm-color-success)' }}>{r.corriendo}</div>
          <div className={s.hint}>cruces con la oferta vigente y en la sucursal del lote</div>
        </div>
        <div className={s.card} style={{ padding: '10px 14px', flex: '1 1 160px' }}>
          <span className={s['mini-label']}>AVISOS</span>
          <div style={{ fontSize: 18, fontWeight: 700, color: r.graves ? 'var(--crm-color-danger)' : undefined }}>
            {r.graves + r.medias + r.bajas}
          </div>
          <div className={s.hint}>{r.graves} urgente{r.graves === 1 ? '' : 's'} · {r.medias} para revisar · {r.bajas} menor{r.bajas === 1 ? '' : 'es'}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {CHIPS.map(([id, label]) => (
          <button
            key={id || 'todos'} type="button" className={s.badge}
            style={{
              cursor: 'pointer', padding: '5px 12px', fontSize: 12, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--crm-color-border)',
              ...(filtro === id ? { background: 'var(--crm-color-primary)', color: 'var(--crm-color-primary-contrast)', borderColor: 'var(--crm-color-primary)' } : {}),
            }}
            onClick={() => setFiltro(id)}
          >
            {label}
          </button>
        ))}
        <select value={sucF} onChange={(e) => setSucF(e.target.value)} style={{ flex: '0 1 180px' }}>
          {sucursalOptions(store, true)}
        </select>
        <span style={{ flex: 1 }} />
        <Btn small onClick={recargar}>Actualizar</Btn>
        <Btn small onClick={exportar}>Exportar CSV</Btn>
      </div>

      <Table
        cols={[
          { h: 'Producto' }, { h: 'Oferta' }, { h: 'Estado oferta' }, { h: 'Vence' }, { h: 'Mercadería' },
          { h: 'Cantidad', num: true }, { h: 'En juego', num: true }, { h: 'Aviso' }, { h: 'Acciones' },
        ]}
        empty={filas.length
          ? 'Nada con esos filtros.'
          : 'Ninguna mercadería vigilada está en oferta. Desde Registros, «Oferta» abre el motor con todo cargado.'}
      >
        {cuerpo}
      </Table>

      <div className={s.hint}>
        Se listan los registros ABIERTOS que alguna oferta alcanza — por producto, marca, categoría,
        etiqueta o como componente de un combo — y también las ofertas atadas a un registro aunque
        hoy ya no lo alcancen (ese desajuste es justamente el aviso). Los procesados salen de la
        lista: ya son historia.
      </div>
    </div>
  );
}

/** La oferta como la espera `describirOferta`, armada con lo que manda la API. */
function ofertaDe(f) {
  return {
    tipo: f.ofertaTipo, porcentaje: f.porcentaje, precio: f.precio,
    lleva: f.lleva, paga: f.paga, montoMinimo: f.montoMinimo,
  };
}

/* ============================== VENCIDOS ============================== */
function TabVencidos({ registros }) {
  const { store, openModal } = useProductos();
  const [sucF, setSucF] = useState('');
  const [mesF, setMesF] = useState('');

  const vencidos = registros.filter((v) => v.diasParaVencer < 0
    && (!sucF || v.sucursalId === Number(sucF))
    && (!mesF || v.fechaVencimiento.slice(0, 7) === mesF));
  const abiertos = vencidos.filter((v) => !v.procesado);
  const cerrados = vencidos.filter((v) => v.procesado);
  const perdidaEstimada = abiertos.reduce((a, v) => a + v.cantidad * v.costoUnitario, 0);
  const perdidaReal = cerrados.reduce((a, v) => a + (v.cantidad - v.unidadesVendidas) * v.costoUnitario, 0);
  const vendidas = cerrados.reduce((a, v) => a + v.unidadesVendidas, 0);

  const exportar = () => descargarCsv(
    `vencidos-${hoyIso()}.csv`,
    ['Producto', 'Sucursal', 'Venció', 'Cantidad', 'Vendidas antes', 'Perdidas', 'Costo congelado', 'Pérdida real', 'Estado'],
    vencidos.map((v) => [
      v.nombre, store.getSucursal(v.sucursalId)?.nombre ?? '', fmtFechaVenc(v.fechaVencimiento),
      String(v.cantidad).replace('.', ','), String(v.unidadesVendidas).replace('.', ','),
      v.procesado ? String(v.cantidad - v.unidadesVendidas).replace('.', ',') : '',
      String(v.costoUnitario.toFixed(2)).replace('.', ','),
      v.procesado ? String(((v.cantidad - v.unidadesVendidas) * v.costoUnitario).toFixed(2)).replace('.', ',') : '',
      v.procesado ? 'procesado' : 'sin procesar',
    ]),
  );

  const fila = (v) => (
    <tr key={v.id}>
      <td>{v.nombre}</td>
      <td>{store.getSucursal(v.sucursalId)?.nombre ?? '—'}</td>
      <td>{fmtFechaVenc(v.fechaVencimiento)} <span className={s.hint}>hace {Math.abs(v.diasParaVencer)} d</span></td>
      <td className={s.num}>{num(v.cantidad)} {v.unidad}</td>
      {v.procesado ? (
        <>
          <td className={s.num}>{num(v.unidadesVendidas)}</td>
          <td className={s.num}>{num(v.cantidad - v.unidadesVendidas)}</td>
          <td className={s.num} style={{ color: 'var(--crm-color-danger)', fontWeight: 600 }}>
            {money((v.cantidad - v.unidadesVendidas) * v.costoUnitario)}
          </td>
          <td>{v.mermaMovimientoId ? <Pill pill="tag-baja" label="Stock bajado" /> : <Pill pill="est-recibida" label="Solo registro" />}</td>
        </>
      ) : (
        <>
          <td className={s.num} colSpan={2}>—</td>
          <td className={s.num}>{money(v.cantidad * v.costoUnitario)} <span className={s.hint}>estimada</span></td>
          <td><Btn variant="btn-primary" small onClick={() => openModal('vencimientoProcesar', { registro: v })}>Procesar</Btn></td>
        </>
      )}
    </tr>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div className={s.card} style={{ padding: '10px 14px', flex: '1 1 160px' }}>
          <span className={s['mini-label']}>SIN PROCESAR</span>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{abiertos.length} · {money(perdidaEstimada)}</div>
          <div className={s.hint}>pérdida estimada a cerrar</div>
        </div>
        <div className={s.card} style={{ padding: '10px 14px', flex: '1 1 160px' }}>
          <span className={s['mini-label']}>PÉRDIDA REAL (PROCESADOS)</span>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--crm-color-danger)' }}>{money(perdidaReal)}</div>
          <div className={s.hint}>{cerrados.length} cierres</div>
        </div>
        <div className={s.card} style={{ padding: '10px 14px', flex: '1 1 160px' }}>
          <span className={s['mini-label']}>SE SALVARON VENDIÉNDOSE</span>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--crm-color-success)' }}>{num(vendidas)}</div>
          <div className={s.hint}>unidades vendidas antes de vencer</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={sucF} onChange={(e) => setSucF(e.target.value)} style={{ flex: '1 1 150px', maxWidth: 220 }}>
          {sucursalOptions(store, true)}
        </select>
        <input type="month" value={mesF} onChange={(e) => setMesF(e.target.value)} title="Mes del vencimiento" />
        <Btn small onClick={exportar}>Exportar CSV</Btn>
      </div>
      <Table
        cols={[
          { h: 'Producto' }, { h: 'Sucursal' }, { h: 'Venció' }, { h: 'Registrado', num: true },
          { h: 'Vendidas', num: true }, { h: 'Perdidas', num: true }, { h: 'Pérdida', num: true }, { h: '' },
        ]}
        empty="Sin vencidos con esos filtros. Ojalá siga así."
      >
        {[...abiertos, ...cerrados].map(fila)}
      </Table>
      <div className={s.hint}>
        Procesar = contar la verdad: cuántas se vendieron antes de vencer y cuántas se tiran.
        Con «bajar del stock» tildado, lo perdido sale del disponible como movimiento «vencido» en el mismo acto.
      </div>
    </div>
  );
}

/* ============================== MERMAS (la baja de siempre, mudada acá) ============================== */
function TabMermas() {
  const { store, openModal, can } = useProductos();
  useSeccion('movimientos');
  const [sucF, setSucF] = useState('');
  const [tipoF, setTipoF] = useState('');
  const [buscar, setBuscar] = useState('');

  const TIPOS = { merma: 'Merma', vencido: 'Vencido', defectuoso: 'Defectuoso' };
  const puedeRegistrar = can('merma') || can('defectuoso') || can('inventario');

  const q = buscar.trim().toLowerCase();
  const movs = store.state.movimientos
    .filter((m) => TIPOS[m.tipo])
    .filter((m) => (!sucF || m.sucursalId === Number(sucF)) && (!tipoF || m.tipo === tipoF))
    .filter((m) => {
      if (!q) return true;
      const p = store.getProducto(m.productoId);
      return `${p?.nombre ?? ''} ${m.motivo} ${m.descripcion}`.toLowerCase().includes(q);
    })
    .sort((a, b) => b.id - a.id);
  const pag = usePaginado(movs, 'vencimientos-mermas', `${sucF}|${tipoF}|${q}`);

  /* Mes LOCAL, no UTC: a la noche del 31 toISOString ya está en el mes que viene. */
  const mesActual = hoyIso().slice(0, 7);
  const mesDe = (f) => { const d = new Date(f); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const delMes = movs.filter((m) => mesDe(m.fecha) === mesActual);
  const plataMes = delMes.reduce((a, m) => a + (Number(m.costoUnitario) || 0) * m.cantidad, 0);

  /* De dónde nació la baja. Las dos que vienen de un circuito se muestran como
   * chip (con el código en el tooltip) en vez de repetir el texto crudo: una
   * baja de incidencia aparecía como una merma anónima, aunque el vínculo
   * estuviera guardado. */
  const origenDe = (motivo) => {
    if (/^Vencimiento #/.test(motivo)) return { pill: 'est-transito', label: 'De vencimiento' };
    if (/^Incidencia /.test(motivo)) return { pill: 'est-revision', label: 'De incidencia' };
    return null;
  };

  const filas = pag.visibles.map((m) => {
    const p = store.getProducto(m.productoId);
    const motivo = m.motivo || '';
    const origen = origenDe(motivo);
    return (
      <tr key={m.id}>
        <td>{fmtFechaHora(m.fecha)}</td>
        <td><Pill pill="tag-baja" label={TIPOS[m.tipo]} /></td>
        <td>{p?.nombre ?? '—'}{m.presLabel ? <span className={s.hint}> · {m.presLabel}</span> : null}</td>
        <td>{store.getSucursal(m.sucursalId)?.nombre ?? '—'}</td>
        <td className={s.num}>{num(m.cantidad)} {m.unidad}</td>
        <td className={s.num}>{Number(m.costoUnitario) > 0 ? money(m.costoUnitario * m.cantidad) : '—'}</td>
        <td>
          {origen
            ? <span title={motivo}><Pill pill={origen.pill} label={origen.label} /></span>
            : (motivo || '—')}
        </td>
      </tr>
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className={cx(s.callout, s.info)}>
        La merma de siempre vive acá ahora: la baja REAL de stock por rotura, daño o vencimiento
        encontrado. Genera el movimiento y congela el costo del día — el reporte de pérdidas suma
        vencimientos y mermas sin contar dos veces.
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className={s.card} style={{ padding: '10px 14px', flex: '0 1 220px' }}>
          <span className={s['mini-label']}>PÉRDIDA POR MERMAS — ESTE MES</span>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--crm-color-danger)' }}>{money(plataMes)}</div>
          <div className={s.hint}>{delMes.length} bajas</div>
        </div>
        {puedeRegistrar && (
          <div className={s.field} style={{ flex: '1 1 240px', maxWidth: 340 }}>
            <label>Registrar una baja: buscá el producto</label>
            <BuscadorCatalogo
              store={store}
              onElegir={(prod, presId) => openModal('movimiento', { prodId: prod.id, pre: { presId } })}
            />
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="search" placeholder="Buscar producto o motivo…" value={buscar}
          onChange={(e) => setBuscar(e.target.value)} style={{ flex: '2 1 180px', minWidth: 160 }}
        />
        <select value={tipoF} onChange={(e) => setTipoF(e.target.value)}>
          <option value="">Todos los tipos</option>
          {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={sucF} onChange={(e) => setSucF(e.target.value)}>
          {sucursalOptions(store, true)}
        </select>
      </div>
      <Table
        cols={[
          { h: 'Fecha' }, { h: 'Tipo' }, { h: 'Producto' }, { h: 'Sucursal' },
          { h: 'Cantidad', num: true }, { h: 'Pérdida', num: true }, { h: 'Motivo / origen' },
        ]}
        empty="Sin bajas registradas."
        pag={pag}
      >
        {filas}
      </Table>
    </div>
  );
}

/* ============================== REPORTES ============================== */
function TabReportes() {
  const { store } = useProductos();
  const [periodo, setPeriodo] = useState('mes');
  const [rep, setRep] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    store.reportesVencimientos(periodo)
      .then((r) => { if (vivo) setRep(r); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [periodo, store]);

  if (cargando && !rep) return <div className={s.hint}>Cargando…</div>;
  if (!rep) return <div className={s.hint}>No se pudo cargar el reporte.</div>;

  const totalPeriodo = rep.general.estimada + rep.mermas.plata;
  const maxSuc = Math.max(1, ...rep.porSucursal.map((x) => x.total));
  const maxCat = Math.max(1, ...rep.porCategoria.map((x) => x.estimada));

  const exportar = () => descargarCsv(
    `reporte-vencimientos-${periodo}-${hoyIso()}.csv`,
    ['Sección', 'Nombre', 'Registros', 'Unidades', 'Pérdida'],
    [
      ['General', 'Vencimientos registrados', rep.general.registros, String(rep.general.unidades).replace('.', ','), String(rep.general.estimada).replace('.', ',')],
      ['General', 'Pérdida real (procesados)', rep.general.procesados, '', String(rep.general.real).replace('.', ',')],
      ['General', 'Mermas sueltas', rep.mermas.registros, String(rep.mermas.unidades).replace('.', ','), String(rep.mermas.plata).replace('.', ',')],
      ...rep.porSucursal.map((x) => ['Por sucursal', store.getSucursal(x.sucursalId)?.nombre ?? x.sucursalId, x.registros, String(x.unidades).replace('.', ','), String(x.total).replace('.', ',')]),
      ...rep.porCategoria.map((x) => ['Por categoría', x.categoria, x.registros, String(x.unidades).replace('.', ','), String(x.estimada).replace('.', ',')]),
      ...rep.frecuentes.map((x) => ['Frecuentes', x.nombre, x.veces, String(x.unidades).replace('.', ','), String(x.plata).replace('.', ',')]),
    ],
  );

  const Barra = ({ v, max }) => (
    <div style={{ background: 'color-mix(in srgb, var(--crm-color-danger) 20%, transparent)', height: 8, borderRadius: 4, width: `${Math.max(2, Math.round((v / max) * 100))}%`, minWidth: 2 }} />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {[['semana', 'Semana'], ['mes', 'Mes'], ['trimestre', 'Trimestre'], ['anio', 'Año']].map(([k, l]) => (
          <button
            key={k} type="button" className={s.badge}
            style={{
              cursor: 'pointer', padding: '5px 12px', fontSize: 12, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--crm-color-border)',
              ...(periodo === k ? { background: 'var(--crm-color-primary)', color: 'var(--crm-color-primary-contrast)', borderColor: 'var(--crm-color-primary)' } : {}),
            }}
            onClick={() => setPeriodo(k)}
          >
            {l}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <Btn small onClick={exportar}>Exportar CSV</Btn>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[
          ['REGISTRADO EN EL PERÍODO', money(rep.general.estimada), `${rep.general.registros} registros · ${num(rep.general.unidades)} u.`],
          ['PÉRDIDA REAL (PROCESADOS)', money(rep.general.real), `${rep.general.procesados} cierres · ${num(rep.general.vendidas)} vendidas a tiempo`],
          ['MERMAS SUELTAS', money(rep.mermas.plata), `${rep.mermas.registros} bajas directas`],
          ['PÉRDIDA TOTAL DEL PERÍODO', money(totalPeriodo), 'vencimientos registrados + mermas'],
        ].map(([t, v, h]) => (
          <div key={t} className={s.card} style={{ padding: '12px 14px', flex: '1 1 170px' }}>
            <span className={s['mini-label']}>{t}</span>
            <div style={{ fontSize: 19, fontWeight: 700, marginTop: 4 }}>{v}</div>
            <div className={s.hint}>{h}</div>
          </div>
        ))}
      </div>

      <div className={s['dos-cols']} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
        <div>
          <h3 className={s['card-title']}>Por sucursal</h3>
          <Table cols={[{ h: 'Sucursal' }, { h: '' }, { h: 'Reg.', num: true }, { h: 'Total', num: true }]} empty="Sin datos en el período.">
            {rep.porSucursal.map((x) => (
              <tr key={x.sucursalId}>
                <td>{store.getSucursal(x.sucursalId)?.nombre ?? x.sucursalId}</td>
                <td style={{ width: '30%' }}><Barra v={x.total} max={maxSuc} /></td>
                <td className={s.num}>{x.registros}</td>
                <td className={s.num}>{money(x.total)}</td>
              </tr>
            ))}
          </Table>
        </div>
        <div>
          <h3 className={s['card-title']}>Por categoría</h3>
          <Table cols={[{ h: 'Categoría' }, { h: '' }, { h: 'Reg.', num: true }, { h: 'Pérdida', num: true }]} empty="Sin datos en el período.">
            {rep.porCategoria.map((x) => (
              <tr key={x.categoria}>
                <td>{x.categoria}</td>
                <td style={{ width: '30%' }}><Barra v={x.estimada} max={maxCat} /></td>
                <td className={s.num}>{x.registros}</td>
                <td className={s.num}>{money(x.estimada)}</td>
              </tr>
            ))}
          </Table>
        </div>
      </div>

      <div>
        <h3 className={s['card-title']}>Los que MÁS vencen (histórico) — la señal para comprar distinto</h3>
        <Table cols={[{ h: 'Producto' }, { h: 'Veces', num: true }, { h: 'Unidades', num: true }, { h: 'Pérdida', num: true }]} empty="Sin historia todavía.">
          {rep.frecuentes.map((x) => (
            <tr key={`${x.productoId}-${x.presentacionId ?? 0}`}>
              <td>{x.nombre}</td>
              <td className={s.num}>{x.veces}</td>
              <td className={s.num}>{num(x.unidades)}</td>
              <td className={s.num}>{money(x.plata)}</td>
            </tr>
          ))}
        </Table>
      </div>

      <div className={s['dos-cols']} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
        <div>
          <h3 className={s['card-title']}>Historial mensual</h3>
          <Table cols={[{ h: 'Mes' }, { h: 'Reg.', num: true }, { h: 'Estimada', num: true }, { h: 'Real', num: true }]} empty="Sin meses cerrados.">
            {rep.historial.map((x) => (
              <tr key={x.mes}>
                <td className={s.mono}>{x.mes}</td>
                <td className={s.num}>{x.registros}</td>
                <td className={s.num}>{money(x.estimada)}</td>
                <td className={s.num}>{money(x.real)}</td>
              </tr>
            ))}
          </Table>
        </div>
        <div>
          <h3 className={s['card-title']}>Controles hechos ({rep.sesiones.stats.sesiones} en el período)</h3>
          <Table cols={[{ h: 'Fecha' }, { h: 'Sucursal' }, { h: 'Quién' }, { h: 'Renglones', num: true }]} empty="Nadie caminó la góndola todavía.">
            {rep.sesiones.ultimas.map((x) => (
              <tr key={x.id}>
                <td>{fmtFechaHora(x.fecha)}</td>
                <td>{x.sucursalNombre}</td>
                <td>{x.usuarioNombre}</td>
                <td className={s.num}>{x.totalItems}</td>
              </tr>
            ))}
          </Table>
        </div>
      </div>
    </div>
  );
}

/* ============================== EL PANEL ============================== */
export function VencimientosPanel() {
  const { store } = useProductos();
  const [pestana, setPestana] = useState('panel');
  const [registros, setRegistros] = useState([]);
  const [resumen, setResumen] = useState(null);
  /** El cruce con las ofertas de Ventas (lista + avisos). */
  const [cruce, setCruce] = useState(null);
  const [filtroRango, setFiltroRango] = useState('');
  // La sesión de control vive ACÁ para sobrevivir el cambio de pestaña: una
  // lista a medio armar no se pierde por ir a mirar los registros.
  const [sesion, setSesion] = useState({ sucursalId: null, filas: [] });

  const cargar = useCallback(async () => {
    try {
      const [regs, res, cru] = await Promise.all([
        store.vencimientos(), store.resumenVencimientos(), store.ofertasVencimientos(),
      ]);
      setRegistros(Array.isArray(regs) ? regs : []);
      setResumen(res);
      setCruce(cru);
    } catch { /* el shell ya muestra el error de conexión general */ }
  }, [store]);

  useEffect(() => { cargar(); }, [cargar]);
  // Los registros viven fuera del bootstrap: se re-piden cuando el store
  // versiona (después de cada mutación — procesar puede tocar stock).
  const version = store.getVersion?.() ?? 0;
  useEffect(() => { cargar(); }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  const irA = (rango) => { setFiltroRango(rango); setPestana('registros'); };
  const abiertosVencidos = registros.filter((v) => !v.procesado && v.diasParaVencer < 0).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Vencimientos"
        desc="El vigía de fechas: se anota lo que vence, el sistema avisa a tiempo (7/15/30 días), la oferta sale antes y lo vencido se procesa con la pérdida REAL. No es stock: la baja llega recién al procesar."
      />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {PESTANAS.map((v) => {
          const globo = v.id === 'vencidos' ? abiertosVencidos
            : v.id === 'ofertas' ? (cruce?.resumen?.graves ?? 0)
              : 0;
          return (
            <button
              key={v.id}
              type="button"
              className={cx(s.badge)}
              style={{
                cursor: 'pointer', padding: '7px 14px', fontSize: 13, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--crm-color-border)',
                ...(pestana === v.id
                  ? { background: 'var(--crm-color-primary)', color: 'var(--crm-color-primary-contrast)', borderColor: 'var(--crm-color-primary)' }
                  : {}),
              }}
              onClick={() => setPestana(v.id)}
            >
              {v.label}
              {globo > 0 && (
                <span style={{ marginLeft: 6, background: 'var(--crm-color-danger)', color: '#fff', borderRadius: 10, padding: '0 7px', fontSize: 11, fontWeight: 700 }}>
                  {globo}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {pestana === 'panel' && <TabPanel resumen={resumen} irA={irA} cruce={cruce} irAOfertas={() => setPestana('ofertas')} />}
      {pestana === 'control' && <TabControl sesion={sesion} setSesion={setSesion} alGuardar={() => { setFiltroRango(''); setPestana('registros'); }} />}
      {pestana === 'registros' && <TabRegistros registros={registros} filtroRango={filtroRango} setFiltroRango={setFiltroRango} />}
      {pestana === 'ofertas' && <TabOfertas cruce={cruce} registros={registros} recargar={cargar} />}
      {pestana === 'vencidos' && <TabVencidos registros={registros} />}
      {pestana === 'mermas' && <TabMermas />}
      {pestana === 'reportes' && <TabReportes />}
    </div>
  );
}
