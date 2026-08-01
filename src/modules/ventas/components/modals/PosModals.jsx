import { useMemo, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useVentas } from '../../context/VentasContext.jsx';
import { ventasApi } from '../../services/ventas.api.js';
import { norm } from '../../domain/constants.js';
import { buscarEnCatalogo, parseEtiquetaBalanza, r2 } from '../../domain/pos.js';
import { Btn, ModalShell, money, num, s } from '../ui.jsx';
import p from '../../styles/Pos.module.css';

/* ==================================================================== *
 * Carga tradicional (Ins)
 * ==================================================================== */

/**
 * Un solo campo: se escanea o se escribe. Es el modal de siempre del cajero —
 * abre, carga, cierra, y el foco vuelve al ticket. Se queda abierto entre
 * cargas para poder pasar varios artículos seguidos sin reabrirlo.
 */
export function CargaRapidaModal({ catalogo, config, onAgregar }) {
  const { closeModal, toast } = useVentas();
  const [q, setQ] = useState('');
  const [activo, setActivo] = useState(0);
  const [ultimo, setUltimo] = useState(null);
  const inputRef = useRef(null);

  const resultados = useMemo(() => buscarEnCatalogo(catalogo, q, 6), [catalogo, q]);

  const agregar = (item, cantidad = 1) => {
    if (item.precio <= 0) { toast(`${item.nombre} no tiene precio cargado.`, 'err'); return; }
    onAgregar(item, cantidad);
    setUltimo({ nombre: `${item.nombre} · ${item.detalle}`, cantidad, precio: item.precio });
    setQ('');
    setActivo(0);
    inputRef.current?.focus();
  };

  const onEnter = () => {
    const etiqueta = parseEtiquetaBalanza(q, config);
    if (etiqueta) {
      const item = catalogo.find((i) => i.codigoBarras && i.codigoBarras.endsWith(etiqueta.codigoItem));
      if (item) {
        const cantidad = etiqueta.cantidad ?? (item.precio > 0 ? r2(etiqueta.importe / item.precio) : 0);
        if (cantidad > 0) { agregar(item, cantidad); return; }
      }
    }
    if (resultados[activo]) agregar(resultados[activo]);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); onEnter(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActivo((i) => Math.min(i + 1, resultados.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo((i) => Math.max(i - 1, 0)); }
  };

  return (
    <ModalShell
      title="Cargar producto"
      onClose={closeModal}
      footer={[{ texto: 'Listo', clase: 'btn-primary', onClick: closeModal }]}
    >
      <input
        ref={inputRef}
        className={p.buscadorInput}
        placeholder="Escaneá el código o escribí el nombre…"
        value={q}
        onChange={(e) => { setQ(e.target.value); setActivo(0); }}
        onKeyDown={onKeyDown}
        autoFocus
        autoComplete="off"
      />

      {q && (
        <div style={{ marginTop: 10, border: '1px solid var(--crm-color-border)', borderRadius: 'var(--crm-radius-md)', overflow: 'hidden' }}>
          {resultados.length === 0 && <div className={p.resultado}><span className={p.resultadoMeta}>Nada coincide con «{q}».</span></div>}
          {resultados.map((item, i) => (
            <button
              key={item.key}
              type="button"
              className={cx(p.resultado, i === activo && p.resultadoActivo)}
              onMouseEnter={() => setActivo(i)}
              onClick={() => agregar(item)}
            >
              <span>
                <span className={p.resultadoNombre}>{item.nombre}</span>
                <span className={p.resultadoMeta}>
                  {' · '}{item.detalle}
                  {' · '}<span className={item.stock <= 0 ? p.sinStock : undefined}>{num(item.stock)} {item.unidad}</span>
                </span>
              </span>
              <span className={p.resultadoPrecio}>{money(item.precio)}</span>
            </button>
          ))}
        </div>
      )}

      {ultimo && (
        <div className={s.callout} style={{ marginTop: 12 }}>
          Agregado: <strong>{ultimo.nombre}</strong> × {num(ultimo.cantidad)} · {money(ultimo.precio)}
        </div>
      )}
      <div className={s.hint} style={{ marginTop: 10 }}>
        El modal queda abierto para cargar varios seguidos. <kbd>↑↓</kbd> elegir · <kbd>Enter</kbd> agregar.
      </div>
    </ModalShell>
  );
}

/* ==================================================================== *
 * Búsqueda masiva (Shift + Ins)
 * ==================================================================== */

/**
 * Para cuando el cajero no sabe el código: filtra por categoría, marca y
 * nombre, y muestra la ficha completa de cada artículo — el stock repartido
 * por sucursal y las tres listas de precio— para poder responderle al cliente
 * sin salir de la pantalla.
 */
export function BusquedaMasivaModal({ catalogo, onAgregar }) {
  const { closeModal, toast } = useVentas();
  const [categoria, setCategoria] = useState('');
  const [marca, setMarca] = useState('');
  const [texto, setTexto] = useState('');

  const categorias = useMemo(
    () => [...new Set(catalogo.map((i) => i.categoria).filter(Boolean))].sort(),
    [catalogo],
  );
  const marcas = useMemo(
    () => [...new Set(catalogo.map((i) => i.marca).filter(Boolean))].sort(),
    [catalogo],
  );

  const resultados = useMemo(() => {
    const ql = norm(texto);
    const digitos = texto.replace(/\D/g, '');
    return catalogo.filter((i) => {
      if (categoria && i.categoria !== categoria) return false;
      if (marca && i.marca !== marca) return false;
      if (!ql) return true;
      // El campo busca por nombre O por código de barras, sin cambiar de modo.
      return norm(i.nombre).includes(ql)
        || (digitos && i.codigoBarras && i.codigoBarras.includes(digitos));
    }).slice(0, 200);
  }, [catalogo, categoria, marca, texto]);

  const agregar = (item) => {
    if (item.precio <= 0) { toast(`${item.nombre} no tiene precio cargado.`, 'err'); return; }
    onAgregar(item, 1);
    toast(`${item.nombre} · ${item.detalle} agregado.`, 'ok');
  };

  const limpiar = () => { setCategoria(''); setMarca(''); setTexto(''); };

  return (
    <ModalShell
      title="Búsqueda de productos"
      wide
      onClose={closeModal}
      footer={[{ texto: 'Listo', clase: 'btn-primary', onClick: closeModal }]}
    >
      <div className={p.filtrosMasiva}>
        <div className={s.field} style={{ marginBottom: 0 }}>
          <label>Categoría</label>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">Todas</option>
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className={s.field} style={{ marginBottom: 0 }}>
          <label>Marca</label>
          <select value={marca} onChange={(e) => setMarca(e.target.value)}>
            <option value="">Todas</option>
            {marcas.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className={s.field} style={{ marginBottom: 0 }}>
          <label>Producto</label>
          <input
            autoFocus
            placeholder="Nombre o código de barras…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>
        <Btn small onClick={limpiar} disabled={!categoria && !marca && !texto}>Limpiar</Btn>
      </div>

      <div className={p.masivaScroll}>
        <table className={p.masivaTabla}>
          <thead>
            <tr>
              <th>Código</th>
              <th>Producto</th>
              <th>Unidad</th>
              <th>Stock</th>
              <th style={{ textAlign: 'right' }}>Precio</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {resultados.length === 0 && (
              <tr><td colSpan={6} className={p.vacio}>Ningún producto coincide con esos filtros.</td></tr>
            )}
            {resultados.map((i) => {
              const conStock = i.stockSucursales.filter((x) => x.cantidad > 0);
              return (
                <tr key={i.key}>
                  <td className={s.mono}>{i.codigoBarras || <span className={s.muted}>—</span>}</td>
                  <td>
                    <div className={p.nombreCol}>{i.nombre}</div>
                    <div className={p.detalleCol}>
                      {i.detalle}{i.marca ? ` · ${i.marca}` : ''}{i.categoria ? ` · ${i.categoria}` : ''}
                    </div>
                  </td>
                  <td>{i.unidad}</td>
                  <td>
                    <div className={cx(p.nombreCol, i.stock <= 0 && p.sinStock)}>
                      {num(i.stock)} {i.unidad}
                    </div>
                    <div className={p.subLista}>
                      {conStock.length === 0
                        ? <span className={s.muted}>sin stock en ninguna sucursal</span>
                        : conStock.map((x) => (
                          <span key={x.sucursalId}>{x.nombre}: <strong>{num(x.cantidad)}</strong></span>
                        ))}
                    </div>
                  </td>
                  <td className={p.num}>
                    <div className={p.nombreCol}>{i.precio > 0 ? money(i.precio) : <span className={p.sinStock}>sin precio</span>}</div>
                    <div className={p.subLista} style={{ justifyContent: 'flex-end' }}>
                      {i.precios.map((x) => (
                        <span key={x.nombre}>{x.nombre}: <strong>{money(x.precio)}</strong></span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <Btn variant="btn-primary" small onClick={() => agregar(i)}>Agregar</Btn>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className={s.hint} style={{ marginTop: 10 }}>
        {resultados.length} resultado(s). El stock se muestra desglosado por sucursal y el precio por cada lista.
      </div>
    </ModalShell>
  );
}

/* ==================================================================== *
 * Carga extra
 * ==================================================================== */

/** Cargos que no son mercadería: envío, packaging, un ajuste puntual. */
export function CargaExtraModal({ onAgregar }) {
  const { closeModal, toast } = useVentas();
  const [concepto, setConcepto] = useState('');
  const [importe, setImporte] = useState('');
  const [iva, setIva] = useState(21);

  const SUGERENCIAS = ['Envío Uber', 'Envío cadete', 'Packaging', 'Recargo por envase'];

  const agregar = () => {
    if (!concepto.trim()) { toast('Indicá el concepto.', 'err'); return; }
    if (!(Number(importe) > 0)) { toast('El importe tiene que ser mayor a 0.', 'err'); return; }
    onAgregar({ concepto: concepto.trim(), importe: r2(importe), iva: Number(iva) || 0 });
    closeModal();
  };

  return (
    <ModalShell
      title="Cargo extra"
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Agregar', clase: 'btn-primary', onClick: agregar },
      ]}
    >
      <div className={s.hint}>
        Se suma al ticket como un renglón propio, con su alícuota. Sirve para envíos,
        packaging o cualquier cargo que no sea mercadería.
      </div>

      <div className={s.field}>
        <label>Concepto <span className={s.req}>*</span></label>
        <input autoFocus value={concepto} placeholder="Ej: Envío Uber" onChange={(e) => setConcepto(e.target.value)} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {SUGERENCIAS.map((x) => (
            <Btn key={x} small onClick={() => setConcepto(x)}>{x}</Btn>
          ))}
        </div>
      </div>

      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Importe (neto)</label>
          <input type="number" min="0" step="100" value={importe} onChange={(e) => setImporte(e.target.value)} />
        </div>
        <div className={s.field}>
          <label>IVA</label>
          <select value={iva} onChange={(e) => setIva(Number(e.target.value))}>
            <option value={21}>21%</option>
            <option value={10.5}>10,5%</option>
            <option value={0}>Exento (0%)</option>
          </select>
        </div>
      </div>

      {Number(importe) > 0 && (
        <div className={s.callout}>
          Suma al ticket: <strong>{money(r2(Number(importe) * (1 + (Number(iva) || 0) / 100)))}</strong> con IVA.
        </div>
      )}
    </ModalShell>
  );
}

/* ==================================================================== *
 * Delegar venta
 * ==================================================================== */

/** Pasa la venta abierta a otro vendedor (cambio de turno, mostrador ocupado). */
export function DelegarVentaModal({ ventaId, actualId, onChange }) {
  const { usuarios, act, closeModal, toast } = useVentas();
  const [usuarioId, setUsuarioId] = useState('');

  const candidatos = usuarios.filter((u) => u.id !== actualId);
  const actual = usuarios.find((u) => u.id === actualId);

  const delegar = async () => {
    if (!usuarioId) { toast('Elegí a quién se le pasa la venta.', 'err'); return; }
    const ok = await act(
      ventasApi.delegarVenta(ventaId, Number(usuarioId)),
      'Venta delegada.',
      { recargar: false },
    );
    if (ok) onChange?.();
  };

  return (
    <ModalShell
      title="Delegar venta"
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Delegar', clase: 'btn-primary', onClick: delegar },
      ]}
    >
      <div className={s.hint}>
        La venta queda abierta a nombre del otro vendedor, que la ve en su lista y la
        continúa desde donde quedó. Solo se puede delegar una venta sin emitir.
      </div>

      <div className={s.field}>
        <label>Vendedor actual</label>
        <input value={actual?.nombre || '—'} readOnly tabIndex={-1} />
      </div>

      <div className={s.field}>
        <label>Pasar a <span className={s.req}>*</span></label>
        <select autoFocus value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
          <option value="">Elegí un vendedor…</option>
          {candidatos.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
        </select>
      </div>
    </ModalShell>
  );
}

/* ==================================================================== *
 * Descartar venta abierta
 * ==================================================================== */

export function DescartarVentaModal({ ventaId, etiqueta, onChange }) {
  const { act, closeModal } = useVentas();

  const descartar = async () => {
    const ok = await act(ventasApi.descartarVenta(ventaId), 'Venta descartada.', { recargar: false });
    if (ok) onChange?.();
  };

  return (
    <ModalShell
      title="Descartar venta"
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Descartar', clase: 'btn-delete', onClick: descartar },
      ]}
    >
      <div className={cx(s.callout, s.warn)}>
        Se elimina la venta abierta {etiqueta ? <strong>de {etiqueta}</strong> : null} con todo su ticket.
        No dejó rastro en el stock ni consumió numeración, así que no queda nada por revertir.
      </div>
    </ModalShell>
  );
}
