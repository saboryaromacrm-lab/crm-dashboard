import { useEffect, useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { coincideNumero } from '@modules/gastos/domain/fletes.js';
import { useProductos } from '../../context/ProductosContext.jsx';
import { money, fmtFecha } from '../../domain/format.js';
import { Table, s } from '../ui.jsx';

/**
 * EL FLETE DE ESTA MERCADERÍA (0244). El transporte facturó antes y dejó dicho de qué
 * proveedor trajo (y, si lo sabía, el número de su factura o remito). Al cargar ese
 * papel se ofrecen sus fletes sin papel: el que tiene ESTE número viene tildado; el
 * resto se tilda a mano si corresponde. Tildar solo los vincula: no mueve plata.
 *
 * `onChange` recibe los ids de los renglones tildados (van en el alta como `fletes`).
 */
export function FletesSinPapel({ proveedorId, puntoVenta, numero, onChange }) {
  const { store } = useProductos();
  const [lista, setLista] = useState([]);
  /** Lo que se tildó o destildó a mano; lo demás sigue al número. */
  const [aMano, setAMano] = useState({});

  useEffect(() => {
    let vivo = true;
    setAMano({});
    if (!proveedorId) { setLista([]); return undefined; }
    store.fletesSinPapel(proveedorId)
      .then((r) => { if (vivo) setLista(Array.isArray(r) ? r : []); })
      .catch(() => { if (vivo) setLista([]); });
    return () => { vivo = false; };
  }, [store, proveedorId]);

  const tildado = (f) => aMano[f.id] ?? coincideNumero(f.referencia, puntoVenta, numero);
  const ids = useMemo(() => lista.filter(tildado).map((f) => f.id), [lista, aMano, puntoVenta, numero]); // eslint-disable-line react-hooks/exhaustive-deps
  const clave = ids.join(',');
  useEffect(() => { onChange(ids); }, [clave]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!lista.length) return null;
  return (
    <>
      <div className={s['section-title']}>El flete de esta mercadería</div>
      <div className={cx(s.callout, s.info)}>
        Un transporte ya facturó el viaje de mercadería de este proveedor y todavía no tiene su factura o remito.
        Tildá el que trajo <strong>esta</strong> mercadería: queda vinculado y se ve lo que costó traerla.
        {lista.some((f) => coincideNumero(f.referencia, puntoVenta, numero)) && ' El que tiene este número ya viene tildado.'}
      </div>
      <Table cols={[{ h: 'Es este' }, { h: 'Transporte' }, { h: 'Renglón' }, { h: 'Número que dejó' }, { h: 'Sin IVA', num: true }]}>
        {lista.map((f) => (
          <tr key={f.id}>
            <td style={{ width: 60 }}>
              <input
                type="checkbox" checked={tildado(f)} aria-label={`Vincular ${f.concepto}`}
                onChange={(e) => setAMano((m) => ({ ...m, [f.id]: e.target.checked }))}
              />
            </td>
            <td>
              {f.transporte}
              <div className={s.hint} style={{ margin: 0 }}>{fmtFecha(f.fecha)}{f.numero ? ` · ${f.letra} ${f.numero}` : ''}</div>
            </td>
            <td>{f.concepto}</td>
            <td>{f.referencia || <span className={s.muted}>—</span>}</td>
            <td className={s.num}>{money(f.neto)}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}

/**
 * EL FLETE DE UN COMPROBANTE YA CARGADO (0244), en su detalle: lo que costó traer esa
 * entrega. El % va contra la entrega entera (este papel y los otros del proveedor de ese
 * día): el mitad y mitad manda la factura A y la liquidación juntas, y el flete trae las dos.
 */
export function FleteDelComprobante({ id }) {
  const { store } = useProductos();
  const [datos, setDatos] = useState(null);
  useEffect(() => {
    let vivo = true;
    store.fletesDelComprobante(id)
      .then((r) => { if (vivo) setDatos(r); })
      .catch(() => { if (vivo) setDatos(null); });
    return () => { vivo = false; };
  }, [store, id]);

  const fletes = datos?.fletes ?? [];
  if (!fletes.length) return null;
  const total = fletes.reduce((a, f) => a + f.neto, 0);
  const neto = datos.netoEntrega;
  const pct = (n) => (neto > 0 ? `${(n / neto * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })} %` : '—');
  const deQue = datos.papelesEntrega > 1 ? `la entrega (${datos.papelesEntrega} papeles del día, neto ${money(neto)})` : 'este papel';
  return (
    <>
      <h3 className={s['card-title']}>Flete · {money(total)} sin IVA ({pct(total)} de {deQue})</h3>
      <Table cols={[{ h: 'Transporte' }, { h: 'Renglón' }, { h: 'Sin IVA', num: true }, { h: '%', num: true }]}>
        {fletes.map((f) => (
          <tr key={f.id}>
            <td>
              {f.transporte}
              <div className={s.hint} style={{ margin: 0 }}>{fmtFecha(f.fecha)}{f.numero ? ` · ${f.letra} ${f.numero}` : ''}</div>
            </td>
            <td>{f.concepto}</td>
            <td className={s.num}>{money(f.neto)}</td>
            <td className={s.num}>{pct(f.neto)}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
