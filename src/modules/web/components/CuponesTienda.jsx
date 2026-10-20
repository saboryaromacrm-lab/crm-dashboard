/**
 * TIENDA MINORISTA › CUPONES DE DESCUENTO (0190, 20/10/2026, pedido del dueño)
 * ============================================================================
 * Un código que el cliente escribe en el checkout de la tienda minorista. Se
 * configura qué da (% con tope, monto fijo o envío gratis) y cuándo y cómo
 * vale: fechas, días, horario, medio de pago, entrega, compra mínima, marcas y
 * categorías, usos totales y por cliente, solo primera compra.
 *
 * Y se MIDE con las ventas reales: los pedidos que lo usaron, los que se
 * cerraron en la caja, lo que descontó, la ganancia que dejaron (con y sin el
 * cupón, y después del envío regalado) y el ticket promedio contra el de los
 * pedidos sin cupón. Cada cambio guarda solo (no usa el «Guardar cambios» de arriba).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { httpClient } from '@core/services/httpClient.js';
import { ModalShell } from '@modules/productos/components/Modal.jsx';
import { Btn, Pill, Table, s } from '@modules/productos/components/ui.jsx';

const pesos = (n) => `$${Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
const plata = (n) => (n < -0.5 ? `−${pesos(-n)}` : pesos(n));
const pct = (n) => (n == null ? '—' : `${Number(n).toLocaleString('es-AR', { maximumFractionDigits: 1 })} %`);
const SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const TIPOS = { porcentaje: '% de descuento', monto: 'Monto fijo ($)', envio_gratis: 'Envío gratis' };
const MEDIOS = { efectivo: 'Efectivo', transferencia: 'Transferencia' };
const ENTREGAS = { '': 'Retiro o envío', retiro: 'Solo retirando en el local', envio: 'Solo con envío a domicilio' };
const ZONA = 'America/Argentina/Buenos_Aires';
/** La fecha de un instante, en Argentina, como la pide el input (AAAA-MM-DD). */
const fechaInput = (iso) => (iso ? new Date(iso).toLocaleDateString('sv-SE', { timeZone: ZONA }) : '');
const fechaCorta = (iso) => new Date(iso).toLocaleDateString('es-AR', { timeZone: ZONA, day: 'numeric', month: 'numeric', year: '2-digit' });
const csvIds = (s) => String(s || '').split(',').map(Number).filter(Boolean);

const NUEVO = {
  codigo: '', descripcion: '', activo: true, tipo: 'porcentaje', valor: 10, tope: 0, montoMinimo: 0, desde: '', hasta: '',
  dias: '', horaDesde: '', horaHasta: '', mediosPago: '', entrega: '', marcas: '', categorias: '',
  usosMax: 0, usosPorCliente: 1, soloPrimeraCompra: false,
};

/** Qué da el cupón, en una línea. */
function queDa(c) {
  if (c.tipo === 'envio_gratis') return 'Envío gratis';
  if (c.tipo === 'monto') return `−${pesos(c.valor)}`;
  return `−${c.valor} %${c.tope > 0 ? ` (hasta ${pesos(c.tope)})` : ''}`;
}

/** Cuándo y cómo vale, en una línea: lo que no se configuró no se dice. */
function condiciones(c, nombres) {
  const partes = [];
  if (c.desde || c.hasta) partes.push(`${c.desde ? `desde ${fechaCorta(c.desde)}` : ''}${c.desde && c.hasta ? ' ' : ''}${c.hasta ? `hasta ${fechaCorta(c.hasta)}` : ''}`);
  if (c.dias) partes.push(SEMANA.filter((_, i) => c.dias[i] === '1').join(', '));
  if (c.horaDesde || c.horaHasta) partes.push(`${c.horaDesde || '00:00'} a ${c.horaHasta || '23:59'} h`);
  if (c.montoMinimo > 0) partes.push(`compra desde ${pesos(c.montoMinimo)}`);
  if (c.mediosPago) partes.push(c.mediosPago.split(',').map((m) => MEDIOS[m]?.toLowerCase() ?? m).join(' o '));
  if (c.entrega) partes.push(c.entrega === 'envio' ? 'con envío' : 'retirando');
  const ms = csvIds(c.marcas).map((id) => nombres.marcas.get(id)).filter(Boolean);
  const cs = csvIds(c.categorias).map((id) => nombres.categorias.get(id)).filter(Boolean);
  if (ms.length) partes.push(`marcas: ${ms.join(', ')}`);
  if (cs.length) partes.push(`categorías: ${cs.join(', ')}`);
  if (c.soloPrimeraCompra) partes.push('solo primera compra');
  partes.push(c.usosPorCliente ? `${c.usosPorCliente} por cliente` : 'sin tope por cliente');
  if (c.usosMax) partes.push(`máximo ${c.usosMax} usos`);
  return partes.join(' · ');
}

/** Elegir varias marcas o categorías, con buscador. */
function ElegirVarios({ id, label, opciones, elegidos, onCambiar }) {
  const [q, setQ] = useState('');
  const set = new Set(elegidos);
  const visibles = opciones.filter((o) => set.has(o.id) || o.nombre.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 200);
  const alternar = (oid) => onCambiar(set.has(oid) ? elegidos.filter((x) => x !== oid) : [...elegidos, oid]);
  return (
    <div className={s.field}>
      <label htmlFor={id}>{label} <span className={s.hint} style={{ display: 'inline', margin: 0 }}>{elegidos.length ? `${elegidos.length} elegida(s)` : 'ninguna = todas'}</span></label>
      <input id={id} type="search" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div style={{ maxHeight: 140, overflowY: 'auto', border: '1px solid var(--crm-color-border)', borderRadius: 6, padding: '4px 8px', display: 'grid', gap: 2 }}>
        {visibles.map((o) => (
          <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={set.has(o.id)} onChange={() => alternar(o.id)} /> {o.nombre}
          </label>
        ))}
        {!visibles.length && <span className={s.hint}>Sin resultados.</span>}
      </div>
    </div>
  );
}

function CuponModal({ cupon, catalogo, onGuardar, onBorrar, onCerrar }) {
  const [d, setD] = useState(() => (cupon
    ? { ...NUEVO, ...cupon, desde: fechaInput(cupon.desde), hasta: fechaInput(cupon.hasta) }
    : NUEVO));
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const enVuelo = useRef(false);
  const set = (k) => (v) => setD((x) => ({ ...x, [k]: v }));
  const dias = d.dias || '0000000';
  const alternarDia = (i) => {
    const m = (d.dias || '1111111').split('');
    m[i] = m[i] === '1' ? '0' : '1';
    const nueva = m.join('');
    set('dias')(nueva === '1111111' ? '' : nueva);
  };
  const medios = d.mediosPago ? d.mediosPago.split(',') : [];
  const alternarMedio = (m) => set('mediosPago')((medios.includes(m) ? medios.filter((x) => x !== m) : [...medios, m]).join(','));

  const enviar = async (fn) => {
    if (enVuelo.current) return;
    enVuelo.current = true;
    setEnviando(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e?.data?.message || 'No se pudo guardar el cupón.');
    } finally {
      enVuelo.current = false;
      setEnviando(false);
    }
  };
  const guardar = () => enviar(() => onGuardar({
    codigo: d.codigo.trim().toUpperCase(), descripcion: d.descripcion.trim(), activo: d.activo, tipo: d.tipo,
    valor: d.tipo === 'envio_gratis' ? 0 : Number(d.valor) || 0, tope: d.tipo === 'porcentaje' ? Number(d.tope) || 0 : 0,
    montoMinimo: Number(d.montoMinimo) || 0, desde: d.desde || '', hasta: d.hasta || '', dias: d.dias,
    horaDesde: d.horaDesde, horaHasta: d.horaHasta, mediosPago: d.mediosPago, entrega: d.tipo === 'envio_gratis' ? 'envio' : d.entrega,
    marcas: d.marcas, categorias: d.categorias, usosMax: Number(d.usosMax) || 0,
    usosPorCliente: Number(d.usosPorCliente) || 0, soloPrimeraCompra: d.soloPrimeraCompra,
  }));
  const borrar = () => (borrando ? enviar(onBorrar) : setBorrando(true));
  const usado = (cupon?.usos?.total ?? 0) + (cupon?.usos?.rechazados ?? 0) > 0;

  return (
    <ModalShell
      title={cupon ? `Cupón ${cupon.codigo}` : 'Nuevo cupón'}
      wide
      onClose={onCerrar}
      footer={[
        ...(cupon ? [{ texto: borrando ? (usado ? 'Sí, desactivarlo' : 'Sí, borrarlo') : (usado ? 'Desactivar' : 'Borrar'), clase: 'btn-delete', onClick: borrar, disabled: enviando }] : []),
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: onCerrar },
        { texto: enviando ? 'Guardando…' : 'Guardar cupón', clase: 'btn-primary', onClick: guardar, disabled: enviando },
      ]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <div className={s.field}>
          <label htmlFor="cup-codigo">Código</label>
          <input id="cup-codigo" value={d.codigo} maxLength={30} placeholder="BIENVENIDA10" autoComplete="off" spellCheck={false}
            onChange={(e) => set('codigo')(e.target.value.toUpperCase().replace(/\s/g, ''))} />
          <div className={s.hint} style={{ margin: '4px 0 0' }}>Letras, números, guiones. El cliente lo escribe tal cual.</div>
        </div>
        <div className={s.field}>
          <label htmlFor="cup-desc">Descripción (la ve el cliente)</label>
          <input id="cup-desc" value={d.descripcion} maxLength={200} placeholder="10 % en tu primera compra" onChange={(e) => set('descripcion')(e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        <div className={s.field}>
          <label htmlFor="cup-tipo">Qué da</label>
          <select id="cup-tipo" value={d.tipo} onChange={(e) => set('tipo')(e.target.value)}>
            {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        {d.tipo !== 'envio_gratis' && (
          <div className={s.field}>
            <label htmlFor="cup-valor">{d.tipo === 'porcentaje' ? 'Descuento (%)' : 'Descuento ($)'}</label>
            <input id="cup-valor" type="number" min="0" max={d.tipo === 'porcentaje' ? 95 : undefined} step={d.tipo === 'porcentaje' ? 1 : 100}
              value={d.valor} onChange={(e) => set('valor')(e.target.value)} onWheel={(e) => e.currentTarget.blur()} />
          </div>
        )}
        {d.tipo === 'porcentaje' && (
          <div className={s.field}>
            <label htmlFor="cup-tope">Tope del descuento ($)</label>
            <input id="cup-tope" type="number" min="0" step="500" value={d.tope} onChange={(e) => set('tope')(e.target.value)} onWheel={(e) => e.currentTarget.blur()} />
            <div className={s.hint} style={{ margin: '4px 0 0' }}>0 = sin tope.</div>
          </div>
        )}
        <div className={s.field}>
          <label htmlFor="cup-minimo">Compra mínima ($)</label>
          <input id="cup-minimo" type="number" min="0" step="1000" value={d.montoMinimo} onChange={(e) => set('montoMinimo')(e.target.value)} onWheel={(e) => e.currentTarget.blur()} />
          <div className={s.hint} style={{ margin: '4px 0 0' }}>En productos, con el descuento del barrio. 0 = sin mínimo.</div>
        </div>
      </div>
      {d.tipo !== 'envio_gratis' && (
        <div className={s.hint} style={{ margin: 0 }}>
          Se descuenta de los productos que no están en oferta (una oferta ya tiene su descuento y no se suman), después del descuento
          del barrio. Un monto fijo se reparte entre esos productos. Nunca más del 95 % de lo que entra.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        <div className={s.field}>
          <label htmlFor="cup-desde">Desde</label>
          <input id="cup-desde" type="date" value={d.desde} onChange={(e) => set('desde')(e.target.value)} />
        </div>
        <div className={s.field}>
          <label htmlFor="cup-hasta">Hasta (todo ese día)</label>
          <input id="cup-hasta" type="date" value={d.hasta} min={d.desde || undefined} onChange={(e) => set('hasta')(e.target.value)} />
        </div>
        <div className={s.field}>
          <label htmlFor="cup-hdesde">Desde la hora</label>
          <input id="cup-hdesde" type="time" value={d.horaDesde} onChange={(e) => set('horaDesde')(e.target.value)} />
        </div>
        <div className={s.field}>
          <label htmlFor="cup-hhasta">Hasta la hora</label>
          <input id="cup-hhasta" type="time" value={d.horaHasta} onChange={(e) => set('horaHasta')(e.target.value)} />
        </div>
      </div>
      <div className={s.hint} style={{ margin: 0 }}>Fechas y horas vacías = siempre. Un horario puede cruzar la medianoche (22:00 a 02:00).</div>

      <div className={s.field}>
        <label>Qué días</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {SEMANA.map((corto, i) => {
            const on = !d.dias || dias[i] === '1';
            return <Btn key={corto} small variant={on ? 'btn-primary' : 'btn-ghost'} onClick={() => alternarDia(i)} aria-pressed={on}>{corto}</Btn>;
          })}
        </div>
        <div className={s.hint} style={{ margin: '6px 0 0' }}>Todos marcados = todos los días.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <div className={s.field}>
          <label>Medio de pago</label>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {Object.entries(MEDIOS).map(([m, l]) => (
              <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={medios.includes(m)} onChange={() => alternarMedio(m)} /> {l}
              </label>
            ))}
          </div>
          <div className={s.hint} style={{ margin: '4px 0 0' }}>Ninguno = cualquiera. Si pide uno, el cliente lo elige en el checkout y la caja lo exige al cobrar.</div>
        </div>
        <div className={s.field}>
          <label htmlFor="cup-entrega">Entrega</label>
          <select id="cup-entrega" value={d.tipo === 'envio_gratis' ? 'envio' : d.entrega} disabled={d.tipo === 'envio_gratis'} onChange={(e) => set('entrega')(e.target.value)}>
            {Object.entries(ENTREGAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <ElegirVarios id="cup-marcas" label="Solo estas marcas" opciones={catalogo.marcas} elegidos={csvIds(d.marcas)} onCambiar={(ids) => set('marcas')(ids.join(','))} />
        <ElegirVarios id="cup-categorias" label="Solo estas categorías" opciones={catalogo.categorias} elegidos={csvIds(d.categorias)} onCambiar={(ids) => set('categorias')(ids.join(','))} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        <div className={s.field}>
          <label htmlFor="cup-usos">Usos en total</label>
          <input id="cup-usos" type="number" min="0" step="1" value={d.usosMax} onChange={(e) => set('usosMax')(e.target.value)} onWheel={(e) => e.currentTarget.blur()} />
          <div className={s.hint} style={{ margin: '4px 0 0' }}>0 = sin tope. Un pedido rechazado devuelve su uso.</div>
        </div>
        <div className={s.field}>
          <label htmlFor="cup-cliente">Usos por cliente</label>
          <input id="cup-cliente" type="number" min="0" step="1" value={d.usosPorCliente} onChange={(e) => set('usosPorCliente')(e.target.value)} onWheel={(e) => e.currentTarget.blur()} />
          <div className={s.hint} style={{ margin: '4px 0 0' }}>Por WhatsApp. 0 = sin tope.</div>
        </div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
        <input type="checkbox" checked={d.soloPrimeraCompra} onChange={(e) => set('soloPrimeraCompra')(e.target.checked)} />
        Solo en la primera compra del cliente
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
        <input type="checkbox" checked={d.activo} onChange={(e) => set('activo')(e.target.checked)} />
        Activo (la tienda lo acepta)
      </label>
      {cupon && usado && <div className={s.hint} style={{ margin: 0 }}>Ya se usó: los cambios valen para los pedidos nuevos; los hechos conservan su descuento.</div>}
      {borrando && (
        <div className={cx(s.callout, s.warn)} style={{ margin: 0 }}>
          {usado ? 'Ya se usó en pedidos: no se borra, se desactiva (los pedidos y las ventas lo siguen nombrando).' : 'Se borra el cupón.'} Tocá de nuevo para confirmar.
        </div>
      )}
      {error && <div className={cx(s.callout, s.warn)} style={{ margin: 0 }}>{error}</div>}
    </ModalShell>
  );
}

export function CuponesTienda({ avisar }) {
  const [datos, setDatos] = useState(null);
  const [catalogo, setCatalogo] = useState({ marcas: [], categorias: [] });
  const [abierto, setAbierto] = useState(null); // { cupon } (cupon null = nuevo)
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [verInactivos, setVerInactivos] = useState(false);

  const cargar = useCallback(
    () => httpClient.get(`/cupones?desde=${desde}&hasta=${hasta}`).then(setDatos),
    [desde, hasta],
  );
  useEffect(() => {
    cargar().catch((e) => avisar('err', e?.data?.message || 'No se pudieron leer los cupones.'));
  }, [cargar, avisar]);
  useEffect(() => {
    httpClient.get('/catalogos').then((c) => setCatalogo({ marcas: c.marcas ?? [], categorias: c.categorias ?? [] })).catch(() => {});
  }, []);
  const nombres = useMemo(() => ({
    marcas: new Map(catalogo.marcas.map((m) => [m.id, m.nombre])),
    categorias: new Map(catalogo.categorias.map((c) => [c.id, c.nombre])),
  }), [catalogo]);

  /** Después de guardar o borrar: recarga, cierra y avisa. Si falla, la ventana queda abierta con el error. */
  const tras = async (promesa, msg) => {
    const r = await promesa;
    await cargar();
    setAbierto(null);
    avisar('ok', typeof msg === 'function' ? msg(r) : msg);
  };

  if (!datos) return <div className={s['empty-state']}>Cargando los cupones…</div>;
  const lista = datos.cupones.filter((c) => verInactivos || c.activo || c.usos.total > 0);
  const tot = datos.cupones.reduce((a, c) => ({
    pedidos: a.pedidos + c.usos.total, cerrados: a.cerrados + c.usos.cerrados, descuento: a.descuento + c.ventas.descuentoCupon,
    neta: a.neta + c.ventas.ventaNeta, ganancia: a.ganancia + c.ventas.gananciaFinal, tickets: a.tickets + c.ventas.tickets,
    nuevos: a.nuevos + c.usos.clientesNuevos,
  }), { pedidos: 0, cerrados: 0, descuento: 0, neta: 0, ganancia: 0, tickets: 0, nuevos: 0 });
  const ref = datos.referencia;

  return (
    <div className={cx(s.card, s.cardPad)} style={{ display: 'grid', gap: 'var(--crm-space-3)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 320px' }}>
          <div className={s['section-title']} style={{ margin: 0 }}>Cupones de descuento</div>
          <div className={s.hint} style={{ margin: '4px 0 0' }}>
            Un código que el cliente escribe en el checkout de la tienda minorista. El descuento queda en el pedido y, al cerrarlo
            en la caja, en la venta: lo de abajo se mide con las ventas reales, todo neto (sin IVA).
          </div>
        </div>
        <Btn variant="btn-primary" onClick={() => setAbierto({ cupon: null })}>+ Nuevo cupón</Btn>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className={s.hint} style={{ margin: 0 }}>Pedidos del</span>
        <input type="date" aria-label="Desde" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} />
        <span className={s.hint} style={{ margin: 0 }}>al</span>
        <input type="date" aria-label="Hasta" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} />
        {(desde || hasta) && <Btn small onClick={() => { setDesde(''); setHasta(''); }}>Toda la historia</Btn>}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginLeft: 'auto' }}>
          <input type="checkbox" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} /> Ver los inactivos sin uso
        </label>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[
          ['PEDIDOS CON CUPÓN', String(tot.pedidos), `${tot.cerrados} cerrados en venta · ${tot.nuevos} de clientes nuevos`],
          ['DESCUENTO DADO', pesos(tot.descuento), 'neto, en las ventas cerradas'],
          ['GANANCIA DE ESAS VENTAS', plata(tot.ganancia), 'después del cupón y del envío regalado'],
          ['TICKET PROMEDIO', tot.tickets ? pesos(tot.neta / tot.tickets) : '—', `sin cupón: ${ref.ticketsSinCupon ? pesos(ref.ticketPromedioSinCupon) : '—'}`],
        ].map(([t, v, h]) => (
          <div key={t} className={s.card} style={{ padding: '10px 14px', flex: '1 1 180px' }}>
            <span className={s['mini-label']}>{t}</span>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{v}</div>
            <div className={s.hint} style={{ margin: 0 }}>{h}</div>
          </div>
        ))}
      </div>

      <Table
        cols={[
          { h: 'Cupón' }, { h: 'Da' }, { h: 'Usos' }, { h: 'Ventas cerradas', num: true }, { h: 'Descuento dado', num: true },
          { h: 'Ganancia', num: true }, { h: 'Sin el cupón', num: true }, { h: 'Ticket promedio', num: true }, { h: '' },
        ]}
        empty={datos.cupones.length ? 'No hay cupones activos: «Ver los inactivos sin uso» muestra el resto.' : 'Todavía no hay cupones. Creá el primero.'}
      >
        {lista.map((c) => {
          const u = c.usos;
          const v = c.ventas;
          return (
            <tr key={c.id} style={{ opacity: c.activo ? 1 : 0.6 }}>
              <td style={{ minWidth: 220 }}>
                <strong style={{ fontFamily: 'monospace', letterSpacing: '0.04em' }}>{c.codigo}</strong>{' '}
                <Pill pill={c.activo ? 'est-recibida' : 'est-cancelada'} label={c.activo ? 'Activo' : 'Inactivo'} />
                {c.descripcion && <div style={{ fontSize: 13 }}>{c.descripcion}</div>}
                <div className={s.hint} style={{ margin: 0 }}>{condiciones(c, nombres)}</div>
              </td>
              <td style={{ whiteSpace: 'nowrap' }}>{queDa(c)}</td>
              <td style={{ minWidth: 130 }}>
                <strong>{u.total}{c.usosMax ? ` / ${c.usosMax}` : ''}</strong>
                <div className={s.hint} style={{ margin: 0 }}>
                  {u.pendientes} sin revisar · {u.enCurso} en curso · {u.cerrados} cerrados{u.rechazados ? ` · ${u.rechazados} rechazados` : ''}
                </div>
                {u.clientesNuevos > 0 && <div className={s.hint} style={{ margin: 0 }}>{u.clientesNuevos} cliente(s) nuevo(s)</div>}
              </td>
              <td className={s.num}>
                {pesos(v.ventaNeta)}
                <div className={s.hint} style={{ margin: 0 }}>{v.tickets} ticket(s)</div>
              </td>
              <td className={s.num}>
                {pesos(v.descuentoCupon)}
                {v.envioRegalado > 0 && <div className={s.hint} style={{ margin: 0 }}>+ {pesos(v.envioRegalado)} de envío</div>}
                {u.descuentoPrometido > 0 && <div className={s.hint} style={{ margin: 0 }}>prometido: {pesos(u.descuentoPrometido)} c/IVA</div>}
              </td>
              <td className={s.num}>
                <strong style={{ color: v.gananciaFinal < -0.5 ? 'var(--crm-color-danger)' : undefined }}>{plata(v.gananciaFinal)}</strong>
                <div className={s.hint} style={{ margin: 0 }}>margen {pct(v.margen)}</div>
                {v.sinCosto > 0 && <div className={s.hint} style={{ margin: 0, color: 'var(--crm-color-danger)' }}>{v.sinCosto} renglón(es) sin costo, afuera</div>}
              </td>
              <td className={s.num}>{plata(v.gananciaSinCupon)}</td>
              <td className={s.num}>
                {v.ticketPromedio == null ? '—' : pesos(v.ticketPromedio)}
                {v.ticketPromedio != null && ref.ticketsSinCupon > 0 && (
                  <div className={s.hint} style={{ margin: 0 }}>
                    {v.ticketPromedio >= ref.ticketPromedioSinCupon ? '▲' : '▼'} vs {pesos(ref.ticketPromedioSinCupon)} sin cupón
                  </div>
                )}
              </td>
              <td><Btn small onClick={() => setAbierto({ cupon: c })}>Editar</Btn></td>
            </tr>
          );
        })}
      </Table>

      <div className={s.hint} style={{ margin: 0 }}>
        <strong>Cómo se mide:</strong> un uso es un pedido que lo trajo (el rechazado lo devuelve). Las ventas son las que se cerraron
        en la caja desde esos pedidos, menos sus notas de crédito. <strong>Ganancia</strong>: venta neta menos el costo congelado (solo lo
        que tiene costo), menos el envío que regaló el cupón. <strong>Sin el cupón</strong>: lo que habrían dejado esas mismas ventas sin
        su descuento. El ticket promedio se compara con el de los pedidos minoristas sin cupón del mismo período.
      </div>

      {abierto && (
        <CuponModal
          cupon={abierto.cupon}
          catalogo={catalogo}
          onCerrar={() => setAbierto(null)}
          onGuardar={(dto) => tras(
            abierto.cupon ? httpClient.put(`/cupones/${abierto.cupon.id}`, dto) : httpClient.post('/cupones', dto),
            abierto.cupon ? 'Cupón guardado.' : `Cupón ${dto.codigo} creado: ya se puede usar en la tienda.`,
          )}
          onBorrar={() => tras(httpClient.delete(`/cupones/${abierto.cupon.id}`), (r) => (r?.desactivado ? 'Cupón desactivado.' : 'Cupón borrado.'))}
        />
      )}
    </div>
  );
}
