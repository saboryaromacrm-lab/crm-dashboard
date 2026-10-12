import { useMemo, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { compararFilasPorMarca } from '@core/services/imprimir.js';
import { telefonoWa } from '@modules/ventas/domain/constants.js';
import { useProductos } from '../../context/ProductosContext.jsx';
import { bultoDelProveedor, bultoTexto, indiceDisponible, unidadPedido } from '../../domain/bulto.js';
import { norm } from '../CatalogoPicker.jsx';
import { ModalShell } from '../Modal.jsx';
import { sucursalOptions } from '../selectOptions.jsx';
import { Btn, s } from '../ui.jsx';

/**
 * ORDEN DE PEDIDO A UN PROVEEDOR (12/10/2026, pedido del dueño)
 * ============================================================================
 * Desde Almacén › Existencias: los productos del proveedor con menos stock que
 * «X» en la sucursal elegida, con el bulto en que se le compran. Se cargan los
 * bultos a pedir y al costado se va armando el mensaje, renglón por renglón en
 * el orden en que se cargaron, listo para copiar o mandar por WhatsApp al
 * teléfono de la ficha del proveedor. Al copiar o enviar queda anotado en
 * Proveedores › Pedidos (la tarjeta nace en «Pedido» y después se actualiza).
 *
 * No toca stock ni deuda: la mercadería entra cuando llega la factura.
 */
const CLAVE_UMBRAL = 'ordenPedido.umbral';
const leerUmbral = () => {
  try { const n = Number(localStorage.getItem(CLAVE_UMBRAL)); return n > 0 ? n : 10; } catch { return 10; }
};
const fmtN = (n) => String(Math.round(n * 1000) / 1000).replace('.', ',');
const aNumero = (t) => Number(String(t ?? '').replace(',', '.'));
const hoy = () => new Date().toLocaleDateString('es-AR');
/* Cómo se presenta el pedido y cómo cierra (12/10/2026, pedido del dueño): quién pide —nombre y CUIT— y la fecha. */
const QUIEN_PIDE = 'Lorenzo Lucas - 23356782429';
const CIERRE = 'Por favor confirmar recibido.';

export function OrdenPedidoModal({ proveedorId: provInicial = '', sucursalId: sucInicial = null }) {
  const { store, closeModal, toast, sucOperativa } = useProductos();
  const [provId, setProvId] = useState(provInicial ? String(provInicial) : '');
  const [sucId, setSucId] = useState(String(sucInicial || sucOperativa() || ''));
  const [umbral, setUmbral] = useState(() => String(leerUmbral()));
  const [q, setQ] = useState('');
  /** productoId → lo tecleado; `orden`: los productos en el orden en que se cargaron (así sale el mensaje). */
  const [cant, setCant] = useState({});
  const [orden, setOrden] = useState([]);
  /** La tarjeta de Proveedores › Pedidos de esta orden: { id, provId, notas }. */
  const anotado = useRef(null);
  const [anotadoVisto, setAnotadoVisto] = useState(false);
  const cola = useRef(Promise.resolve());
  const inputs = useRef({});
  const puedeAnotar = store.can('proveedores.pedidos');

  const { productos, stock, proveedores: todosProv, catalogos } = store.state;
  const proveedores = useMemo(
    () => todosProv.filter((p) => p.proveeMercaderia).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [todosProv],
  );
  const proveedor = proveedores.find((p) => String(p.id) === provId) ?? null;
  const telefono = telefonoWa(proveedor?.telefono);
  const sucursal = store.getSucursal(Number(sucId));
  const disponible = useMemo(() => indiceDisponible(stock, productos), [stock, productos]);

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

  const tope = aNumero(umbral);
  const filas = useMemo(() => {
    const t = norm(q.trim());
    return delProveedor
      .map((x) => ({ ...x, stock: disponible(x.id, Number(sucId)) }))
      /* Lo que ya tiene cantidad cargada se queda a la vista aunque cambie el «menor a». */
      .filter((x) => ((tope > 0 ? x.stock < tope : true) || aNumero(cant[x.id]) > 0)
        && (!t || norm(`${x.nombre} ${x.marca}`).includes(t)));
  }, [delProveedor, disponible, sucId, tope, q, cant]);

  const conBulto = (x) => [x.nombre, bultoTexto(x.p, x.bulto)].filter(Boolean).join(' ');
  /** Cuánto haría falta para llegar al «menor a»: en bultos (o en la unidad, sin bulto). */
  const sugerido = (x) => {
    const falta = tope - x.stock;
    if (!(tope > 0) || falta <= 0) return 0;
    return Math.ceil(x.bulto > 1 ? falta / x.bulto : falta);
  };

  const lineas = orden.map((id) => porId.get(id)).filter(Boolean).map((x) => {
    const n = aNumero(cant[x.id]);
    return `${conBulto(x)} — ${fmtN(n)} ${unidadPedido(x.p, x.bulto, n)}`;
  });
  const mensaje = lineas.length ? [`Pedido - ${QUIEN_PIDE} - ${hoy()}`, '', ...lineas, '', CIERRE].join('\n') : '';

  const cambiarProveedor = (v) => { setProvId(v); setCant({}); setOrden([]); setQ(''); };
  const cambiarUmbral = (v) => {
    setUmbral(v);
    const n = aNumero(v);
    if (n > 0) { try { localStorage.setItem(CLAVE_UMBRAL, String(n)); } catch { /* sin almacenamiento: se usa igual */ } }
  };
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

  const copiarPedido = async () => {
    if (await copiar(mensaje, 'el pedido')) anotar('Pedido copiado.');
  };
  const enviarWhatsApp = () => {
    // Se abre en el mismo clic (si no, el navegador lo toma como ventana emergente y la bloquea).
    window.open(`https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`, '_blank', 'noopener');
    anotar('WhatsApp abierto con el pedido.');
  };

  return (
    <ModalShell
      title="Orden de pedido"
      subtitle="Lo que tiene menos stock que el número elegido, en el bulto en que se le compra al proveedor"
      size="xl"
      onClose={closeModal}
      footer={[{ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal }]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, flex: 1, overflow: 'hidden' }}>
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
              id="orden-umbral" inputMode="decimal" value={umbral} onChange={(e) => cambiarUmbral(e.target.value.replace(/[^\d.,]/g, ''))}
              style={{ width: 70, textAlign: 'right' }}
            />
          </label>
          <input id="orden-buscar" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto o marca…" style={{ minWidth: 200 }} />
        </div>

        {!proveedor ? (
          <div className={cx(s.callout, s.info)}>Elegí el proveedor para ver qué le falta pedir.</div>
        ) : (
          <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0, flexWrap: 'wrap' }}>
            <div style={{ flex: '2 1 520px', minHeight: 0, overflow: 'auto' }}>
              <table className={s.table} style={{ width: '100%' }}>
                <thead>
                  <tr><th>Producto</th><th className={s.num}>Stock</th><th className={s.num}>Sugerido</th><th className={s.num}>A pedir</th></tr>
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
                        <td className={cx(s.num, s.mono)} style={{ color: x.stock <= 0 ? 'var(--crm-color-danger)' : undefined }}>
                          {fmtN(x.stock)} {x.p.tipo === 'granel' ? 'kg' : 'u.'}
                        </td>
                        <td className={s.num}>
                          {sug > 0 && (
                            <Btn small onClick={() => cargar(x, String(sug))} title="Usar la sugerencia">{sug} {unidadPedido(x.p, x.bulto, sug)}</Btn>
                          )}
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
                      </tr>
                    );
                  })}
                  {filas.length === 0 && (
                    <tr><td colSpan={4} className={s.hint}>
                      {delProveedor.length ? `Ningún producto de ${proveedor.nombre} tiene menos de ${umbral} en ${sucursal?.nombre ?? 'esa sucursal'}.` : `${proveedor.nombre} no tiene productos activos cargados.`}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
              <div className={s['section-title']} style={{ margin: 0 }}>Pedido ({lineas.length} {lineas.length === 1 ? 'renglón' : 'renglones'})</div>
              <textarea
                id="orden-mensaje" readOnly value={mensaje} placeholder="Cargá cantidades en «A pedir» y el pedido se arma acá, renglón por renglón."
                style={{ flex: 1, minHeight: 220, resize: 'none', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.5 }}
              />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Btn variant="btn-primary" onClick={copiarPedido} disabled={!lineas.length}>📋 Copiar pedido</Btn>
                <Btn onClick={enviarWhatsApp} disabled={!lineas.length || !telefono} title={telefono ? `Abre el chat con ${proveedor.nombre}` : ''}>
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
