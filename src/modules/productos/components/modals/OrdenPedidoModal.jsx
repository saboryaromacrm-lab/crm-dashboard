import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cx } from '@shared/utils/classNames.js';
import { compararFilasPorMarca } from '@core/services/imprimir.js';
import { telefonoWa } from '@modules/ventas/domain/constants.js';
import { abrirWhatsApp } from '@shared/utils/whatsapp.js';
import { useBreakpoint } from '@core/hooks/useBreakpoint.js';
import { useProductos } from '../../context/ProductosContext.jsx';
import { bultoDelProveedor, bultoTexto, estimarPedido, indiceDisponible, unidadPedido } from '../../domain/bulto.js';
import { money } from '../../domain/format.js';
import { norm } from '../CatalogoPicker.jsx';
import { ModalShell } from '../Modal.jsx';
import { sucursalOptions } from '../selectOptions.jsx';
import { Btn, s } from '../ui.jsx';

/**
 * ORDEN DE PEDIDO A UN PROVEEDOR (12/10/2026, pedido del dueño)
 * ============================================================================
 * Desde Almacén › Existencias: los productos del proveedor (todos, o los que
 * tienen menos stock que «X» en la sucursal elegida; filtrables por categoría),
 * con el bulto en que se le compran. Se cargan los
 * bultos a pedir y al costado se va armando el mensaje, renglón por renglón en
 * el orden en que se cargaron, listo para copiar o mandar por WhatsApp al
 * teléfono de la ficha del proveedor. El mensaje se puede retocar a mano (13/10):
 * desde ahí manda lo escrito y la lista ya no lo pisa. Lo copiado o mandado
 * queda como «pedido anterior» de ese proveedor (uno solo, 0165) para verlo la
 * próxima vez. Al copiar o enviar queda anotado en
 * Proveedores › Pedidos (la tarjeta nace en «Pedido» y después se actualiza).
 *
 * RECORDATORIOS DEL PROVEEDOR (0181, 19/10/2026, pedido del dueño): una nota
 * por proveedor («mínimo 3 bultos», «no manda los martes») arriba de todo,
 * apenas se lo elige. Queda guardada en el proveedor para la próxima vez.
 *
 * No toca stock ni deuda: la mercadería entra cuando llega la factura.
 */
const fmtN = (n) => String(Math.round(n * 1000) / 1000).replace('.', ',');
const aNumero = (t) => Number(String(t ?? '').replace(',', '.'));
const hoy = () => new Date().toLocaleDateString('es-AR');
/** El encabezado de la tabla queda fijo arriba al bajar por la lista. */
const TH_FIJO = { position: 'sticky', top: 0, zIndex: 1 };
/* Cómo se presenta el pedido y cómo cierra (12/10/2026, pedido del dueño): quién pide —nombre y CUIT— y la fecha. */
const QUIEN_PIDE = 'Lorenzo Lucas - 23356782429';
const CIERRE = 'Por favor confirmar recibido.';

const fechaHora = (v) => new Date(v).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * Los recordatorios del proveedor: se leen siempre; «Editar» los cambia y
 * «Guardar» los deja en el proveedor (vacío los borra). Con candado (`useRef`).
 */
function Recordatorios({ proveedor, nota, onGuardada }) {
  const { store, toast } = useProductos();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const candado = useRef(false);
  const abrir = () => { setTexto(nota?.texto ?? ''); setEditando(true); };
  const guardar = async () => {
    if (candado.current) return;
    candado.current = true; setGuardando(true);
    const r = await store.guardarNotaPedido(proveedor.id, texto);
    candado.current = false; setGuardando(false);
    if (!r.ok) { toast(r.error || 'No se pudo guardar el recordatorio.', 'err'); return; }
    onGuardada(r.data?.nota ?? null);
    setEditando(false);
    toast(texto.trim() ? 'Recordatorio guardado.' : 'Recordatorio borrado.', 'ok');
  };

  if (editando) {
    return (
      <div className={cx(s.callout, s.warn)} style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <strong>Recordatorios de {proveedor.nombre}</strong>
        <textarea
          id="orden-recordatorios" autoFocus rows={3} maxLength={2000} value={texto} onChange={(e) => setTexto(e.target.value)}
          placeholder="Lo que tenés que tener presente al pedirle: mínimo de compra, días de entrega, a quién escribirle, qué no trae…"
          style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.45 }}
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Btn small variant="btn-primary" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</Btn>
          <Btn small onClick={() => setEditando(false)} disabled={guardando}>Cancelar</Btn>
          <span className={s.hint} style={{ margin: 0 }}>Queda guardado en el proveedor y aparece cada vez que le armás un pedido. Vacío lo borra.</span>
        </div>
      </div>
    );
  }
  if (!nota) {
    return (
      <div>
        <Btn small onClick={abrir}>📌 Agregar un recordatorio para {proveedor.nombre}</Btn>
      </div>
    );
  }
  return (
    <div className={cx(s.callout, s.warn)} style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <strong style={{ flex: 1 }}>📌 Recordatorios de {proveedor.nombre}</strong>
        <Btn small onClick={abrir}>Editar</Btn>
      </div>
      <div id="orden-recordatorios-texto" style={{ whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'auto', fontSize: 13.5, lineHeight: 1.45, color: 'var(--crm-color-text)' }}>{nota.texto}</div>
      {nota.fecha && (
        <div className={s.hint} style={{ margin: 0 }}>Actualizado el {fechaHora(nota.fecha)}{nota.usuario ? ` por ${nota.usuario}` : ''}</div>
      )}
    </div>
  );
}

/**
 * `sugeridos`: { productoId: cantidad } — lo que manda Bajos en stock, ya cargado y en ese orden.
 * `volverA`: la sección del ERP de donde vino (Proveedores › Pedidos): al cerrar vuelve ahí.
 */
export function OrdenPedidoModal({ proveedorId: provInicial = '', sucursalId: sucInicial = null, sugeridos = null, volverA = '' }) {
  const { store, closeModal, toast, sucOperativa } = useProductos();
  const navigate = useNavigate();
  const cerrar = () => { closeModal(); if (volverA) navigate(volverA); };
  const { isDesktop } = useBreakpoint();
  const [provId, setProvId] = useState(provInicial ? String(provInicial) : '');
  const [sucId, setSucId] = useState(String(sucInicial || sucOperativa() || ''));
  /* Vacío por defecto (13/10/2026, pedido del dueño): se ven todos los productos del proveedor. */
  const [umbral, setUmbral] = useState('');
  const [categoria, setCategoria] = useState('');
  /** El orden por stock: null = el de la góndola, 'desc' = de mayor a menor, 'asc' = de menor a mayor. */
  const [ordenStock, setOrdenStock] = useState(null);
  const [q, setQ] = useState('');
  /** productoId → lo tecleado; `orden`: los productos en el orden en que se cargaron (así sale el mensaje). */
  const [cant, setCant] = useState(() => Object.fromEntries(Object.entries(sugeridos ?? {}).map(([id, n]) => [id, String(n)])));
  const [orden, setOrden] = useState(() => Object.keys(sugeridos ?? {}).map(Number));
  /** El mensaje retocado a mano: `{ texto, base }` (`base` = cómo lo armaba la lista al empezar a editar), o null = se arma solo. */
  const [editado, setEditado] = useState(null);
  /** Al elegir el proveedor: su pedido anterior como estaba al abrir (lo de esta vez se ve la próxima) y sus recordatorios: { provId, pedido, nota }. */
  const [anterior, setAnterior] = useState(null);
  const [verAnterior, setVerAnterior] = useState(false);
  /** La tarjeta de Proveedores › Pedidos de esta orden: { id, provId, notas }. */
  const anotado = useRef(null);
  const [anotadoVisto, setAnotadoVisto] = useState(false);
  const cola = useRef(Promise.resolve());
  /** Lo último que se guardó como «pedido anterior» en esta ventana: copiar dos veces lo mismo no repite el envío. */
  const guardado = useRef('');
  const inputs = useRef({});
  const puedeAnotar = store.can('proveedores.pedidos');
  /* Los costos los ve el mismo que los ve en la carga inicial (`verCostos` del servidor). */
  const verCostos = store.can('precios') || store.can('compras.productos');

  const { productos, stock, proveedores: todosProv, catalogos } = store.state;
  const proveedores = useMemo(
    () => todosProv.filter((p) => p.proveeMercaderia).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [todosProv],
  );
  const proveedor = proveedores.find((p) => String(p.id) === provId) ?? null;
  const telefono = telefonoWa(proveedor?.telefono);
  const sucursal = store.getSucursal(Number(sucId));
  const disponible = useMemo(() => indiceDisponible(stock, productos), [stock, productos]);

  useEffect(() => {
    setVerAnterior(false);
    if (!provId) return undefined;
    let vivo = true;
    store.ultimoPedido(provId).then((r) => { if (vivo) setAnterior({ provId, pedido: r.ok ? r.data?.pedido ?? null : null, nota: r.ok ? r.data?.nota ?? null : null }); });
    return () => { vivo = false; };
  }, [provId, store]);
  const delElegido = anterior?.provId === provId ? anterior : null;
  const pedidoAnterior = delElegido?.pedido ?? null;

  /* Los productos activos del proveedor, con su bulto y en el orden de la góndola (marca → nombre). */
  const delProveedor = useMemo(() => {
    if (!provId) return [];
    const marca = new Map((catalogos?.marcas ?? []).map((m) => [m.id, m.nombre]));
    return productos
      .filter((p) => p.estado === 'activo' && (p.formatosCompra || []).some((e) => String(e.proveedorId) === provId))
      .map((p) => ({ p, id: p.id, nombre: p.nombre, marca: marca.get(p.marcaId) ?? '', bulto: bultoDelProveedor(p, provId) }))
      .sort(compararFilasPorMarca);
  }, [productos, catalogos, provId]);
  const porId = useMemo(() => new Map(delProveedor.map((x) => [x.id, x])), [delProveedor]);
  const categorias = useMemo(
    () => [...new Set(delProveedor.map((x) => x.p.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    [delProveedor],
  );

  const tope = aNumero(umbral);
  const filas = useMemo(() => {
    const t = norm(q.trim());
    const lista = delProveedor
      .map((x) => ({ ...x, stock: disponible(x.id, Number(sucId)) }))
      /* Lo que ya tiene cantidad cargada se queda a la vista aunque cambie el «menor a». */
      .filter((x) => ((tope > 0 ? x.stock < tope : true) || aNumero(cant[x.id]) > 0)
        && (!categoria || x.p.categoria === categoria)
        && (!t || norm(`${x.nombre} ${x.marca}`).includes(t)));
    /* Tocar «Stock» ordena de mayor a menor, otra vez de menor a mayor, y otra vuelve al orden de la góndola. */
    return ordenStock ? lista.sort((a, b) => (a.stock - b.stock) * (ordenStock === 'asc' ? 1 : -1)) : lista;
  }, [delProveedor, disponible, sucId, tope, categoria, q, cant, ordenStock]);

  const conBulto = (x) => [x.nombre, bultoTexto(x.p, x.bulto)].filter(Boolean).join(' ');
  /** Cuánto haría falta para llegar al «menor a»: en bultos (o en la unidad, sin bulto). */
  const sugerido = (x) => {
    const falta = tope - x.stock;
    if (!(tope > 0) || falta <= 0) return 0;
    return Math.ceil(x.bulto > 1 ? falta / x.bulto : falta);
  };

  const pedidos = orden.map((id) => porId.get(id)).filter(Boolean).map((x) => ({ x, n: aNumero(cant[x.id]) }));
  const lineas = pedidos.map(({ x, n }) => `${conBulto(x)} — ${fmtN(n)} ${unidadPedido(x.p, x.bulto, n)}`);
  /* Cuánto suma, a costo (13/10/2026): solo para mirar, no va en el mensaje. Solo quien ve costos. */
  const estimado = verCostos && proveedor
    ? estimarPedido(pedidos.map(({ x, n }) => ({ p: x.p, bulto: x.bulto, cantidad: n })), proveedor.id, store.costosFormato)
    : null;
  const armado = lineas.length ? [`Pedido - ${QUIEN_PIDE} - ${hoy()}`, '', ...lineas, '', CIERRE].join('\n') : '';
  /** Lo que se ve, se copia, se manda y se anota. */
  const mensaje = editado ? editado.texto : armado;
  const listaCambio = !!editado && editado.base !== armado;

  const cambiarProveedor = (v) => { setProvId(v); setCant({}); setOrden([]); setQ(''); setCategoria(''); setEditado(null); };
  const editar = (texto) => setEditado((e) => ({ texto, base: e?.base ?? armado }));
  /** Enteros (bultos, unidades, bolsas); kg con coma solo en el granel sin bolsa. */
  const cargar = (x, texto) => {
    const decimales = x.p.tipo === 'granel' && !(x.bulto > 1);
    const limpio = String(texto).replace(decimales ? /[^\d.,]/g : /\D/g, '');
    setCant((m) => ({ ...m, [x.id]: limpio }));
    const hay = aNumero(limpio) > 0;
    setOrden((o) => (hay ? (o.includes(x.id) ? o : [...o, x.id]) : o.filter((id) => id !== x.id)));
  };
  /** Enter o ↓ pasan al renglón de abajo; ↑ al de arriba (en el acto, como en el conteo). */
  const mover = (x, paso) => {
    const i = filas.findIndex((f) => f.id === x.id);
    const el = inputs.current[filas[i + paso]?.id];
    if (el?.isConnected) { el.focus(); el.select(); }
  };

  const copiar = async (texto, aviso) => {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch {
      toast(`No se pudo copiar${aviso ? ` ${aviso}` : ''}: el navegador no dio permiso.`, 'err');
      return false;
    }
  };

  /*
   * ANOTAR EN PROVEEDORES › PEDIDOS, una vez por orden: la primera copia o
   * envío crea la tarjeta; las siguientes, si el pedido cambió, le actualizan
   * la nota. En fila, para que dos clics seguidos no creen dos tarjetas.
   */
  const anotar = (aviso) => {
    if (!puedeAnotar || !proveedor) { toast(aviso, 'ok'); return; }
    const texto = mensaje;
    const pid = proveedor.id;
    cola.current = cola.current.then(async () => {
      const previo = anotado.current?.provId === pid ? anotado.current : null;
      if (previo?.notas === texto) { toast(aviso, 'ok'); return; }
      const r = await store.anotarPedidoProveedor(previo?.id ?? null, pid, texto);
      if (!r.ok) { toast(`${aviso} Pero no quedó anotado en Proveedores › Pedidos: ${r.error}`, 'err'); return; }
      anotado.current = { id: r.data?.id ?? previo?.id, provId: pid, notas: texto };
      setAnotadoVisto(true);
      toast(`${aviso} ${previo ? 'Se actualizó' : 'Quedó anotado'} en Proveedores › Pedidos.`, 'ok');
    });
  };

  /** Lo copiado o mandado pasa a ser el «pedido anterior» de este proveedor (pisa al que había). */
  const guardarComoUltimo = () => {
    const clave = `${proveedor.id}:${mensaje}`;
    if (guardado.current === clave) return;
    guardado.current = clave;
    store.guardarUltimoPedido(proveedor.id, mensaje).then((r) => {
      if (r.ok) return;
      guardado.current = '';
      toast(`No se guardó como último pedido: ${r.error}`, 'err');
    });
  };
  const copiarPedido = async () => {
    if (await copiar(mensaje, 'el pedido')) { guardarComoUltimo(); anotar('Pedido copiado.'); }
  };
  const enviarWhatsApp = () => {
    abrirWhatsApp(telefono, mensaje);
    guardarComoUltimo();
    anotar('WhatsApp abierto con el pedido.');
  };

  return (
    <ModalShell
      title="Orden de pedido"
      subtitle="Los productos del proveedor (o los que tienen menos stock que el número elegido), en el bulto en que se le compran"
      size="xl"
      onClose={cerrar}
      footer={[{ texto: volverA ? 'Cerrar y volver' : 'Cerrar', clase: 'btn-ghost', onClick: cerrar }]}
    >
      {/* En pantalla grande la lista scrollea sola y el pedido queda al costado; en una chica va todo junto, uno abajo del otro. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, flex: 1, minHeight: 0, overflow: isDesktop ? 'hidden' : 'auto' }}>
        <div className={s.toolbar}>
          <select id="orden-proveedor" className={s['select-inline']} value={provId} onChange={(e) => cambiarProveedor(e.target.value)} aria-label="Proveedor">
            <option value="">Elegí el proveedor…</option>
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <select id="orden-sucursal" className={s['select-inline']} value={sucId} onChange={(e) => setSucId(e.target.value)} aria-label="Sucursal">
            {sucursalOptions(store, false)}
          </select>
          <label className={s.hint} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            Stock menor a
            <input
              id="orden-umbral" inputMode="decimal" value={umbral} onChange={(e) => setUmbral(e.target.value.replace(/[^\d.,]/g, ''))}
              placeholder="Todos" style={{ width: 70, textAlign: 'right' }}
            />
          </label>
          <select id="orden-categoria" className={s['select-inline']} value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Categoría" disabled={!categorias.length}>
            <option value="">Todas las categorías</option>
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input id="orden-buscar" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto o marca…" style={{ minWidth: 200 }} />
        </div>

        {proveedor && delElegido && (
          <Recordatorios
            key={proveedor.id} proveedor={proveedor} nota={delElegido.nota}
            onGuardada={(nota) => setAnterior((a) => (a?.provId === provId ? { ...a, nota } : a))}
          />
        )}
        {!proveedor ? (
          <div className={cx(s.callout, s.info)}>Elegí el proveedor para ver qué le falta pedir.</div>
        ) : (
          <div style={isDesktop
            ? { display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gridTemplateRows: 'minmax(0, 1fr)', gap: 16, flex: 1, minHeight: 0 }
            : { display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            <div style={isDesktop ? { overflow: 'auto', minHeight: 0 } : undefined}>
              <table className={s.table} style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={TH_FIJO}>Producto</th><th className={s.num} style={TH_FIJO}>A pedir</th>
                    <th className={s.num} style={TH_FIJO} aria-sort={ordenStock === 'asc' ? 'ascending' : ordenStock === 'desc' ? 'descending' : 'none'}>
                      <button
                        type="button" id="orden-ordenar-stock" title="Ordenar por stock"
                        onClick={() => setOrdenStock((o) => (o === 'desc' ? 'asc' : o === 'asc' ? null : 'desc'))}
                        style={{ all: 'unset', cursor: 'pointer', textDecoration: 'underline dotted' }}
                      >
                        Stock{ordenStock === 'desc' ? ' ▼' : ordenStock === 'asc' ? ' ▲' : ' ⇅'}
                      </button>
                    </th>
                    <th className={s.num} style={TH_FIJO}>Sugerido</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((x) => {
                    const sug = sugerido(x);
                    const uni = unidadPedido(x.p, x.bulto, 2);
                    return (
                      <tr key={x.id}>
                        <td>
                          <strong>{x.nombre}</strong>
                          <div className={s.hint} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {x.marca && <span>{x.marca} ·</span>}
                            <span>{x.bulto > 1 ? (x.p.tipo === 'granel' ? `Bolsa de ${x.bulto} kg` : `Bulto de ${x.bulto} u.`) : 'Sin bulto: por unidad'}</span>
                            <Btn small onClick={() => copiar(conBulto(x)).then((ok) => ok && toast(`Copiado: ${conBulto(x)}`, 'ok'))} title="Copiar nombre y bulto">📋</Btn>
                          </div>
                        </td>
                        <td className={s.num} style={{ whiteSpace: 'nowrap' }}>
                          <input
                            ref={(el) => { inputs.current[x.id] = el; }}
                            inputMode="decimal" autoComplete="off" aria-label={`A pedir: ${x.nombre}`}
                            value={cant[x.id] ?? ''} placeholder="0"
                            onChange={(e) => cargar(x, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); mover(x, 1); }
                              else if (e.key === 'ArrowUp') { e.preventDefault(); mover(x, -1); }
                            }}
                            style={{ width: 64, textAlign: 'right' }}
                          />
                          <span className={s.hint} style={{ margin: '0 0 0 4px' }}>{uni}</span>
                        </td>
                        <td className={cx(s.num, s.mono)} style={{ color: x.stock <= 0 ? 'var(--crm-color-danger)' : undefined }}>
                          {fmtN(x.stock)} {x.p.tipo === 'granel' ? 'kg' : 'u.'}
                        </td>
                        <td className={s.num}>
                          {sug > 0 && (
                            <Btn small onClick={() => cargar(x, String(sug))} title="Usar la sugerencia">{sug} {unidadPedido(x.p, x.bulto, sug)}</Btn>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filas.length === 0 && (
                    <tr><td colSpan={4} className={s.hint}>
                      {!delProveedor.length
                        ? `${proveedor.nombre} no tiene productos activos cargados.`
                        : tope > 0
                          ? `Ningún producto de ${proveedor.nombre} con esos filtros tiene menos de ${umbral} en ${sucursal?.nombre ?? 'esa sucursal'}.`
                          : 'Ningún producto con esos filtros.'}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div className={s['section-title']} style={{ margin: 0, flex: 1 }}>Pedido ({lineas.length} {lineas.length === 1 ? 'renglón' : 'renglones'})</div>
                {pedidoAnterior && (
                  <Btn small variant={verAnterior ? 'btn-primary' : undefined} onClick={() => setVerAnterior((v) => !v)}>
                    {verAnterior ? 'Ocultar pedido anterior' : 'Ver pedido anterior'}
                  </Btn>
                )}
              </div>
              {pedidoAnterior && verAnterior && (
                <div className={cx(s.callout, s.info)} style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong style={{ flex: 1 }}>
                      Pedido anterior · {fechaHora(pedidoAnterior.fecha)}
                      {pedidoAnterior.usuario ? ` · ${pedidoAnterior.usuario}` : ''}
                    </strong>
                    <Btn small onClick={() => copiar(pedidoAnterior.texto, 'el pedido anterior').then((ok) => ok && toast('Pedido anterior copiado.', 'ok'))}>📋 Copiar</Btn>
                  </div>
                  <pre id="orden-anterior" style={{ margin: 0, maxHeight: 180, overflow: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 12.5, lineHeight: 1.45, color: 'var(--crm-color-text)' }}>
                    {pedidoAnterior.texto}
                  </pre>
                </div>
              )}
              <textarea
                id="orden-mensaje" value={mensaje} onChange={(e) => editar(e.target.value)}
                placeholder="Cargá cantidades en «A pedir» y el pedido se arma acá, renglón por renglón. También lo podés escribir o retocar a mano."
                style={{ flex: 1, minHeight: 220, resize: 'none', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.5 }}
              />
              {editado && (
                <div className={cx(s.callout, listaCambio ? s.warn : s.info)} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ flex: 1, minWidth: 180 }}>
                    {listaCambio
                      ? 'Cambiaste cantidades después de editar el mensaje: lo editado no las tiene.'
                      : 'Mensaje editado a mano: se copia y se manda así.'}
                  </span>
                  <Btn small onClick={() => setEditado(null)}>Volver a armarlo desde la lista</Btn>
                </div>
              )}
              {estimado && lineas.length > 0 && (
                <div id="orden-estimado" className={cx(s.callout, s.ok)} style={{ margin: 0 }}>
                  <div>Estimado a costo: <strong>{money(estimado.aPagar)}</strong> a pagar</div>
                  <div className={s.hint} style={{ margin: '2px 0 0' }}>
                    {money(estimado.neto)} sin IVA · con el costo cargado para este proveedor. Solo para vos: no va en el mensaje.
                    {estimado.sinCosto > 0 && ` ${estimado.sinCosto} renglón(es) sin costo cargado no suman.`}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Btn variant="btn-primary" onClick={copiarPedido} disabled={!mensaje.trim()}>📋 Copiar pedido</Btn>
                <Btn onClick={enviarWhatsApp} disabled={!mensaje.trim() || !telefono} title={telefono ? `Abre el chat con ${proveedor.nombre}` : ''}>
                  Enviar por WhatsApp
                </Btn>
              </div>
              {!telefono && (
                <div className={s.hint} style={{ margin: 0 }}>
                  {proveedor.nombre} no tiene un celular válido en su ficha (Teléfono): cargalo en Proveedores para enviarle directo.
                </div>
              )}
              <div className={s.hint} style={{ margin: 0 }}>
                {!puedeAnotar
                  ? 'Tu rol no tiene Proveedores › Pedidos: el pedido no queda anotado ahí.'
                  : anotadoVisto
                    ? '✓ Anotado en Proveedores › Pedidos. Si lo cambiás y lo volvés a copiar o enviar, se actualiza.'
                    : 'Al copiar o enviar, queda anotado en Proveedores › Pedidos (columna Pedido).'}
              </div>
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
