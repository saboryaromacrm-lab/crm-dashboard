import { useMemo, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useVentas } from '../../context/VentasContext.jsx';
import { ventasApi } from '../../services/ventas.api.js';
import { norm } from '../../domain/constants.js';
import { buscarEnCatalogo, motivoBloqueo, parseEtiquetaBalanza, r2 } from '../../domain/pos.js';
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
    // El "solo Cafetería" primero: su mensaje explica el porqué; el de
    // "sin precio" mandaría al cajero a cargar un precio que no va a existir.
    const bloqueo = motivoBloqueo(item);
    if (bloqueo) { toast(bloqueo, 'err'); return; }
    if (item.precio <= 0) { toast(`${item.nombre} no tiene precio cargado.`, 'err'); return; }
    onAgregar(item, cantidad);
    // El "Agregado" muestra el FINAL con IVA: es lo que el cliente paga por
    // unidad. El neto viaja al renglón por onAgregar, como siempre.
    setUltimo({ nombre: `${item.nombre} · ${item.detalle}`, cantidad, precio: item.precioFinal });
    setQ('');
    setActivo(0);
    inputRef.current?.focus();
  };

  const onEnter = () => {
    const etiqueta = parseEtiquetaBalanza(q, config);
    if (etiqueta) {
      const item = catalogo.find((i) => i.codigoBarras && i.codigoBarras.endsWith(etiqueta.codigoItem));
      if (item) {
        /* El importe de la etiqueta de balanza es el precio AL PÚBLICO (con
         * IVA impreso): se divide por el precio FINAL. Dividirlo por el neto
         * inflaba la cantidad un 21% — el error que nadie ve porque el peso
         * casi siempre viene en la etiqueta y este es solo el fallback. */
        const cantidad = etiqueta.cantidad ?? (item.precioFinal > 0 ? r2(etiqueta.importe / item.precioFinal) : 0);
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
                  {item.soloCafeteria && <span className={p.sinStock}>{' · '}solo Cafetería</span>}
                </span>
              </span>
              <span className={p.resultadoPrecio}>{money(item.precioFinal)}</span>
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
 * nombre, y muestra la ficha del artículo —el stock y las listas de precio—
 * para poder responderle al cliente sin salir de la pantalla.
 *
 * EL STOCK ES EL DE SU SUCURSAL Y NADA MÁS (18/8/2026, pedido del dueño). El
 * cajero de Fontana vende lo que tiene Fontana: las otras cinco columnas eran
 * ruido en la fila —empujaban el precio fuera de la pantalla— y encima invitan
 * a prometer mercadería que está en otro local.
 */
export function BusquedaMasivaModal({ catalogo, listas, onAgregar }) {
  const { closeModal, toast, ctx } = useVentas();
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
  const sucursalesCols = useMemo(() => {
    const todas = catalogo[0]?.stockSucursales?.map((x) => ({ sucursalId: x.sucursalId, nombre: x.nombre })) ?? [];
    // Solo la sucursal de la sesión. Si no está en el desglose (sesión rara,
    // catálogo viejo) se muestran todas: mejor de más que una tabla sin stock.
    const mia = todas.filter((x) => x.sucursalId === ctx.sucursalId);
    return mia.length ? mia : todas;
  }, [catalogo, ctx.sucursalId]);

  /**
   * Listas que aparecen como columna, **agrupadas por modalidad**: primero
   * todo Minorista, después Mayorista (pedido del dueño). El orden sale de la
   * configuración —`modalidadOrden`, el mismo que ordena las modalidades en
   * Formato de Venta—, no de una lista escrita a mano acá: si mañana se agrega
   * una modalidad, entra sola en el lugar que le corresponde. Adentro de cada
   * modalidad manda el NÚMERO de la lista (Minorista 1, Minorista 2…), que es
   * como se las nombra en el mostrador.
   */
  const listasCols = useMemo(() => {
    const presentes = new Set();
    for (const i of catalogo) for (const x of i.precios || []) presentes.add(x.listaId);
    return (listas ?? [])
      .filter((l) => presentes.has(l.listaId))
      .slice()
      .sort((a, b) => (a.modalidadOrden ?? 0) - (b.modalidadOrden ?? 0)
        || (a.numero ?? 0) - (b.numero ?? 0)
        || a.listaId - b.listaId);
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
    const bloqueo = motivoBloqueo(item);
    if (bloqueo) { toast(bloqueo, 'err'); return; }
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
              // El FINAL con IVA: esta pantalla existe para contestarle el
              // precio al cliente, y el cliente paga el de la etiqueta.
              const precioPorLista = new Map(i.precios.map((x) => [x.listaId, x.precioFinal]));
              return (
                <tr key={i.key}>
                  {/* CÓDIGO INTERNO (el "código" del negocio), no el de barras. */}
                  <td className={s.mono}>{i.codigoPropio || <span className={s.muted}>—</span>}</td>
                  {/* Solo el nombre: la presentación tiene su columna y marca/categoría son los filtros de arriba. */}
                  <td>
                    <div className={p.nombreCol}>
                      {i.nombre}
                      {i.soloCafeteria && <span className={p.sinStock}>{' · '}solo Cafetería</span>}
                    </div>
                  </td>
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
        {resultados.length} resultado(s). El stock es el de <strong>tu sucursal</strong>
        {sucursalesCols.length === 1 ? ` (${sucursalesCols[0].nombre})` : ''} y el precio se abre
        por lista (finales, <strong>IVA incluido</strong>); un <strong>—</strong> en una lista
        significa que ese producto no la tiene.
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
