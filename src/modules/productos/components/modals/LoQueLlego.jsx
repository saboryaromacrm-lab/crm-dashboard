/**
 * LO QUE LLEGÓ (0248, 26/11/2026, pedido del dueño: «cuando me mandan
 * productos de más o de menos, que lo pueda hacer desde la misma factura y que
 * quede registrado… que todo concuerde»).
 *
 *   · `LoQueLlego`: en un papel que ingresa mercadería, «¿Llegó todo lo que
 *     dice el papel?». Si no, se cuenta lo que vino distinto (y lo que vino sin
 *     estar en el papel); arriba, lo que antes vino de más y este papel cobra.
 *   · `FaltantesDeLaNota`: en una nota de crédito, «¿es por algo que faltó?».
 *
 * El stock sigue a lo que llegó, la deuda al papel y la diferencia queda
 * pendiente con el proveedor (Proveedores › Cambios de mercadería). La cuenta
 * está en domain/llegada.js; la API la repite y es la que manda.
 */
import { useEffect, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { BuscadorOpcion } from '@shared/components/BuscadorOpcion.jsx';
import { useProductos } from '../../context/ProductosContext.jsx';
import { money, fmtFecha } from '../../domain/format.js';
import { cantTxt } from '../../domain/llegada.js';
import { s } from '../ui.jsx';

/** Las diferencias pendientes del proveedor de un tipo (se piden al elegirlo). */
export function usePendientes(proveedorId, tipo, activo) {
  const { store } = useProductos();
  const [lista, setLista] = useState([]);
  useEffect(() => {
    if (!activo || !proveedorId) { setLista([]); return undefined; }
    let vigente = true;
    store.diferenciasPendientes(proveedorId, tipo).then((r) => { if (vigente) setLista(r || []); }).catch(() => { if (vigente) setLista([]); });
    return () => { vigente = false; };
  }, [store, proveedorId, tipo, activo]);
  return lista;
}

/** Una diferencia pendiente para tildar: «Esta factura lo cobra» / «Esta nota es por esto». */
function Pendiente({ d, cubre, onCubre, texto }) {
  const elegida = cubre[d.id] != null;
  return (
    <label style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <input type="checkbox" checked={elegida} onChange={(e) => onCubre(d.id, e.target.checked ? String(d.pendiente) : null)} />
      <span style={{ flex: 1, minWidth: 220 }}>
        <strong>{d.producto}</strong>: {cantTxt(d.pendiente, d.tipoProducto === 'granel' ? 'kg' : 'u')} con {d.papel} del {fmtFecha(d.fechaPapel)}
        <span className={s.muted}> · {money(d.valorPendiente)} a costo</span>
      </span>
      {elegida && (
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          {texto}
          <input
            type="number" min="0" step="any" style={{ width: 90 }} value={cubre[d.id]}
            onChange={(e) => onCubre(d.id, e.target.value)} aria-label={`Cantidad de ${d.producto}`}
          />
        </span>
      )}
    </label>
  );
}

/**
 * @param filas     `porProducto(...)` de los renglones del papel.
 * @param otraMitad { etiqueta, porProducto: Map } lo que trajo la otra mitad, o null.
 * @param sobrantes lo que antes vino de más de este proveedor (pendiente).
 * @param candidatos los productos del proveedor (para lo que vino sin estar en el papel).
 * @param valor     { hay, conteo, extras, cubre } — vive en el formulario.
 * @param resultado `armarLlegada(...)` con ese valor.
 */
export function LoQueLlego({ filas, otraMitad, sobrantes, candidatos, valor, onChange, resultado }) {
  const set = (cambios) => onChange({ ...valor, ...cambios });
  const conteo = (id, v) => set({ conteo: { ...valor.conteo, [id]: v } });
  const cubre = (id, v) => {
    const c = { ...valor.cubre };
    if (v == null) delete c[id]; else c[id] = v;
    set({ cubre: c });
  };
  const suyos = sobrantes.filter((d) => filas.some((f) => f.productoId === d.productoId));
  const opcionesExtra = candidatos
    .filter((c) => !filas.some((f) => f.productoId === c.prod.id) && !valor.extras.some((x) => x.productoId === c.prod.id))
    .map((c) => ({ id: c.prod.id, nombre: c.prod.nombre }));
  const [extraId, setExtraId] = useState('');
  const agregarExtra = (id) => {
    const c = candidatos.find((x) => String(x.prod.id) === String(id));
    if (!c) return;
    set({ extras: [...valor.extras, { productoId: c.prod.id, nombre: c.prod.nombre, unidad: c.prod.tipo === 'granel' ? 'kg' : 'u', cantidad: '' }] });
    setExtraId('');
  };
  const cobra = (id) => suyos.filter((d) => d.productoId === id).reduce((a, d) => a + (Number(valor.cubre[d.id]) || 0), 0);
  const esperado = (f) => f.facturado + (otraMitad?.porProducto.get(f.productoId) ?? 0) - cobra(f.productoId);
  const difDe = (id) => resultado?.diferencias.find((d) => d.productoId === id);

  return (
    <>
      <div className={s['section-title']}>Lo que llegó</div>
      {suyos.length > 0 && (
        <div className={cx(s.callout, s.info)} style={{ display: 'grid', gap: 6 }}>
          <span>
            <strong>Antes te mandó de más y todavía no lo cobró.</strong> Si esta factura lo cobra, tildalo: esas unidades ya
            entraron y no vuelven a sumar stock.
          </span>
          {suyos.map((d) => <Pendiente key={d.id} d={d} cubre={valor.cubre} onCubre={cubre} texto="Lo cobra:" />)}
        </div>
      )}
      <div role="group" aria-label="¿Llegó todo?" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span>¿Llegó todo lo que dice el papel?</span>
        {[[false, 'Sí, llegó todo'], [true, 'No, hay diferencias']].map(([v, t]) => (
          <button
            key={t} type="button" aria-pressed={valor.hay === v}
            className={cx(s.btn, s['btn-sm'], valor.hay === v ? s['btn-primary'] : s['btn-ghost'])}
            onClick={() => set({ hay: v })}
          >
            {t}
          </button>
        ))}
      </div>
      {valor.hay && (
        <div style={{ display: 'grid', gap: 8 }}>
          <div className={s.hint} style={{ margin: 0 }}>
            Escribí cuánto llegó <strong>solo de lo que vino distinto</strong> (en unidades o kg, lo que entra al stock); lo que dejes
            vacío llegó como dice el papel. El stock entra con lo que llegó, la deuda queda por el papel y la diferencia queda
            pendiente con el proveedor.
            {otraMitad && <> Se compara contra <strong>las dos mitades juntas</strong>: suma lo que trajo {otraMitad.etiqueta}.</>}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className={s.table} style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className={s.num}>Este papel</th>
                  {otraMitad && <th className={s.num}>Otra mitad</th>}
                  <th className={s.num}>Llegó</th>
                  <th>Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => {
                  const d = difDe(f.productoId);
                  return (
                    <tr key={f.productoId}>
                      <td>{f.nombre}</td>
                      <td className={s.num}>{cantTxt(f.facturado, f.unidad)}</td>
                      {otraMitad && <td className={s.num}>{cantTxt(otraMitad.porProducto.get(f.productoId) ?? 0, f.unidad)}</td>}
                      <td className={s.num}>
                        <input
                          type="number" min="0" step="any" style={{ width: 90 }} placeholder={String(esperado(f))}
                          value={valor.conteo[f.productoId] ?? ''} onChange={(e) => conteo(f.productoId, e.target.value)}
                          aria-label={`Llegó de ${f.nombre}`}
                        />
                      </td>
                      <td>
                        {d && (
                          <strong style={{ color: d.tipo === 'faltante' ? 'var(--crm-color-danger)' : 'var(--crm-color-warning, #b45309)' }}>
                            {d.tipo === 'faltante' ? `Faltan ${cantTxt(d.cantidad, f.unidad)}` : `Vinieron ${cantTxt(d.cantidad, f.unidad)} de más`}
                          </strong>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {valor.extras.map((x, i) => (
                  <tr key={x.productoId}>
                    <td>{x.nombre} <span className={s.muted}>· no está en el papel</span></td>
                    <td className={s.num}>—</td>
                    {otraMitad && <td className={s.num}>{cantTxt(otraMitad.porProducto.get(x.productoId) ?? 0, x.unidad)}</td>}
                    <td className={s.num}>
                      <input
                        type="number" min="0" step="any" style={{ width: 90 }} value={x.cantidad} aria-label={`Llegó de ${x.nombre}`}
                        onChange={(e) => set({ extras: valor.extras.map((y, j) => (j === i ? { ...y, cantidad: e.target.value } : y)) })}
                      />
                    </td>
                    <td style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {difDe(x.productoId) && <strong style={{ color: 'var(--crm-color-warning, #b45309)' }}>Vinieron {cantTxt(difDe(x.productoId).cantidad, x.unidad)} de más</strong>}
                      <button type="button" className={cx(s.btn, s['btn-ghost'], s['btn-sm'])} onClick={() => set({ extras: valor.extras.filter((_, j) => j !== i) })}>Quitar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {opcionesExtra.length > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className={s.hint} style={{ margin: 0 }}>¿Vino algo que no está facturado?</span>
              <BuscadorOpcion
                ariaLabel="Producto que vino sin facturar" opciones={opcionesExtra} value={extraId}
                onChange={(id) => (id ? agregarExtra(id) : setExtraId(''))} todos="Elegí el producto…" placeholder="Escribí el producto…"
              />
            </div>
          )}
          {resultado?.errores.map((e) => <div key={e} className={cx(s.callout, s.warn)}>{e}</div>)}
          {resultado && !resultado.errores.length && (
            <div className={cx(s.callout, resultado.diferencias.length ? s.warn : s.info)}>
              {resultado.diferencias.length
                ? <>
                  <strong>Al registrar quedan pendientes con el proveedor:</strong>{' '}
                  {resultado.diferencias.map((d) => `${d.tipo === 'faltante' ? 'faltan' : 'vinieron de más'} ${cantTxt(d.cantidad, d.unidad)} de ${d.nombre}`).join(' · ')}.
                  {' '}Se resuelven en Proveedores › Cambios de mercadería.
                </>
                : 'Con lo que contaste, llegó todo lo que dice el papel.'}
            </div>
          )}
        </div>
      )}
    </>
  );
}

/** En una nota de crédito: «¿es por algo que faltó?». La nota no saca stock: lo que faltó nunca entró. */
export function FaltantesDeLaNota({ faltantes, cubre, onChange }) {
  if (!faltantes.length) return null;
  const set = (id, v) => {
    const c = { ...cubre };
    if (v == null) delete c[id]; else c[id] = v;
    onChange(c);
  };
  return (
    <div className={cx(s.callout, s.info)} style={{ display: 'grid', gap: 6 }}>
      <span>
        <strong>¿Esta nota es por algo que faltó en una entrega?</strong> Tildalo y queda resuelto. La nota no saca stock:
        lo que faltó nunca entró.
      </span>
      {faltantes.map((d) => <Pendiente key={d.id} d={d} cubre={cubre} onCubre={set} texto="Cubre:" />)}
    </div>
  );
}

/** En el detalle de un papel: lo que faltó o vino de más con él, y las diferencias de otros que cubrió. */
export function DiferenciasDelPapel({ id }) {
  const { store } = useProductos();
  const [datos, setDatos] = useState(null);
  useEffect(() => {
    let vigente = true;
    store.diferenciasDelComprobante(id).then((r) => { if (vigente) setDatos(r); }).catch(() => { if (vigente) setDatos(null); });
    return () => { vigente = false; };
  }, [store, id]);
  const vivas = (datos?.diferencias ?? []).filter((d) => d.estado !== 'anulada');
  const cubiertas = (datos?.cubre ?? []).filter((x) => !x.anulada);
  if (!vivas.length && !cubiertas.length) return null;
  const unidad = (d) => (d.tipoProducto === 'granel' ? 'kg' : 'u');
  return (
    <div className={cx(s.callout, vivas.some((d) => d.estado === 'pendiente') ? s.warn : s.info)} style={{ display: 'grid', gap: 4 }}>
      {vivas.length > 0 && <strong>Lo que llegó distinto del papel</strong>}
      {vivas.map((d) => (
        <span key={d.id}>
          {d.tipo === 'faltante' ? 'Faltaron' : 'Vinieron de más'} {cantTxt(d.cantidad, unidad(d))} de <strong>{d.producto}</strong>
          {d.estado === 'pendiente'
            ? <> · <strong>pendiente {cantTxt(d.pendiente, unidad(d))}</strong> ({money(d.valorPendiente)} a costo)</>
            : ' · resuelta'}
          {d.resoluciones?.filter((r) => !r.anulada).map((r) => ` · ${r.texto} ${cantTxt(r.cantidad, unidad(d))}${r.papel ? ` (${r.papel})` : ''}`).join('')}
        </span>
      ))}
      {cubiertas.map((x) => (
        <span key={x.id}>
          Cubre lo que {x.tipo === 'faltante' ? 'faltó' : 'vino de más'} de <strong>{x.producto}</strong> con {x.papel}: {cantTxt(x.cantidad, 'u')}
          {x.tipo === 'sobrante' ? ' (ya había entrado: no sumó stock)' : ' (nunca entró: no sacó stock)'}
        </span>
      ))}
    </div>
  );
}
