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
export function BusquedaMasivaModal({ catalogo, listas, onAgregar }) {
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

  /**
   * Columnas de las cabeceras agrupadas. Se calculan una vez por catálogo (que
   * se pide una sola vez al abrir la caja), no por fila ni por tecla.
   */
  const sucursalesCols = useMemo(
    () => catalogo[0]?.stockSucursales?.map((x) => ({ sucursalId: x.sucursalId, nombre: x.nombre })) ?? [],
    [catalogo],
  );
  /** Listas que aparecen como columna, en su orden de preferencia. */
  const listasCols = useMemo(() => {
    const presentes = new Set();
    for (const i of catalogo) for (const x of i.precios || []) presentes.add(x.listaId);
    return (listas ?? []).filter((l) => presentes.has(l.listaId));
  }, [catalogo, listas]);
  const totalCols = 4 + sucursalesCols.length + listasCols.length;

  const resultados = useMemo(() => {
    const ql = norm(texto);
    const digitos = texto.replace(/\D/g, '');
    return catalogo.filter((i) => {
      if (categoria && i.categoria !== categoria) return false;
      if (marca && i.marca !== marca) return false;
      if (!ql) return true;
      // El campo busca por nombre, código interno o código de barras.
      return norm(i.nombre).includes(ql)
        || (i.codigoPropio && norm(i.codigoPropio).includes(ql))
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
            placeholder="Nombre, código interno o código de barras…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>
        <Btn small onClick={limpiar} disabled={!categoria && !marca && !texto}>Limpiar</Btn>
      </div>

      <div className={p.masivaScroll}>
        <table className={p.masivaTabla}>
          {/*
            Cabecera de dos filas: `stock` y `precio` son grupos que se abren en
            una columna por sucursal y una por lista. Así se compara de un
            vistazo dónde hay mercadería y cuánto sale en cada lista, sin abrir
            el producto.
          */}
          <thead>
            <tr>
              <th rowSpan={2}>Código</th>
              <th rowSpan={2}>Producto</th>
              <th rowSpan={2}>Present.</th>
              <th colSpan={sucursalesCols.length} className={p.grupoCol}>Stock</th>
              <th colSpan={listasCols.length} className={p.grupoCol}>Precio</th>
              <th rowSpan={2} />
            </tr>
            <tr>
              {sucursalesCols.map((su) => (
                <th key={su.sucursalId} className={p.subCol}>{su.nombre}</th>
              ))}
              {listasCols.map((l) => (
                <th key={l.listaId} className={cx(p.subCol, p.num)} title={l.etiqueta}>
                  {l.modalidad} {l.numero}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resultados.length === 0 && (
              <tr><td colSpan={totalCols} className={p.vacio}>Ningún producto coincide con esos filtros.</td></tr>
            )}
            {resultados.map((i) => {
              const stockPorSuc = new Map(i.stockSucursales.map((x) => [x.sucursalId, x.cantidad]));
              const precioPorLista = new Map(i.precios.map((x) => [x.listaId, x.precio]));
              return (
                <tr key={i.key}>
                  {/* CÓDIGO INTERNO (el "código" del negocio), no el de barras. */}
                  <td className={s.mono}>{i.codigoPropio || <span className={s.muted}>—</span>}</td>
                  {/* Solo el nombre: la presentación tiene su columna y marca/categoría son los filtros de arriba. */}
                  <td><div className={p.nombreCol}>{i.nombre}</div></td>
                  <td>{i.detalle}</td>

                  {sucursalesCols.map((su) => {
                    const c = stockPorSuc.get(su.sucursalId) ?? 0;
                    return (
                      <td key={su.sucursalId} className={cx(p.num, c <= 0 && p.sinStock)}>
                        {c > 0 ? num(c) : '—'}
                      </td>
                    );
                  })}

                  {listasCols.map((l) => {
                    const precio = precioPorLista.get(l.listaId);
                    // Un producto sin esa lista muestra un guion: es justamente
                    // el dato que el vendedor necesita ver antes de ofrecerla.
                    return (
                      <td key={l.listaId} className={p.num}>
                        {precio == null ? <span className={s.muted}>—</span> : <strong>{money(precio)}</strong>}
                      </td>
                    );
                  })}

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
        {resultados.length} resultado(s). El stock se abre por sucursal y el precio por lista;
        un <strong>—</strong> en una lista significa que ese producto no la tiene.
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

  // Sin los dados de baja: la API rechaza delegarle el ticket a alguien
  // inactivo, así que ofrecerlo era ofrecer un error.
  const candidatos = usuarios.filter((u) => u.id !== actualId && u.activo !== false);
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
