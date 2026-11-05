/**
 * VENTAS › CARGADOS A MANO (5/11/2026, pedido del dueño): lo que se cobró con
 * «Cargo extra» escribiendo el nombre en vez de elegir el producto. No
 * descuenta stock ni tiene costo, así que conviene verlo y cortarlo: uno por
 * uno (quién, dónde, en qué venta y a cuánto) o agrupado por lo que
 * escribieron (qué productos faltan dar de alta). Ver crm-api/src/ventas/a-mano.module.ts.
 */
import { useDeferredValue, useMemo, useState } from 'react';
import { csvNum, descargarCsv } from '@shared/utils/csv.js';
import { useVentas } from '../context/VentasContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { ventasApi } from '../services/ventas.api.js';
import { agruparAMano } from '../domain/aMano.js';
import { Btn, PanelHead, Stat, Table, fmtFecha, fmtFechaHora, isoDate, money, s, usePaginado } from '../components/ui.jsx';

const primeroDelMes = () => { const d = new Date(); return isoDate(new Date(d.getFullYear(), d.getMonth(), 1)); };

export function AManoPanel() {
  const { sucursales = [], usuarios = [], esJefe } = useVentas();
  const [desde, setDesde] = useState(primeroDelMes);
  const [hasta, setHasta] = useState(() => isoDate(new Date()));
  const [sucursalId, setSucursalId] = useState('');
  const [usuarioId, setUsuarioId] = useState('');
  const [buscar, setBuscar] = useState('');
  const q = useDeferredValue(buscar.trim());
  const [vista, setVista] = useState('agrupado');

  const filtros = { desde, hasta, sucursalId: sucursalId || undefined, usuarioId: usuarioId || undefined, q: q || undefined };
  const fechasOk = desde && hasta && hasta >= desde;
  const { data, loading, error } = useResource(
    `ventas-a-mano:${JSON.stringify(filtros)}`,
    () => (fechasOk ? ventasApi.aMano(filtros) : Promise.resolve(null)),
  );
  const filas = data?.filas ?? [];
  const grupos = useMemo(() => agruparAMano(filas), [filas]);
  const lista = vista === 'agrupado' ? grupos : filas;
  const pag = usePaginado(lista, 'ventas-a-mano', `${vista}|${JSON.stringify(filtros)}`);
  const t = data?.total;

  const exportar = () => (vista === 'agrupado'
    ? descargarCsv(`cargados-a-mano-agrupado-${desde}-a-${hasta}.csv`,
      ['Lo que escribieron', 'Veces', 'Cobrado total', 'Precio más bajo', 'Precio más alto', 'Cajeros', 'Locales', 'Última vez'],
      grupos.map((g) => [g.texto, g.veces, csvNum(g.cobrado), csvNum(g.min ?? 0), csvNum(g.max ?? 0), g.cajeros.join(', '), g.locales.join(', '), fmtFecha(g.ultima)]))
    : descargarCsv(`cargados-a-mano-${desde}-a-${hasta}.csv`,
      ['Fecha', 'Local', 'Cajero', 'Venta', 'Lo que escribieron', 'IVA %', 'Neto', 'Cobrado'],
      filas.map((x) => [fmtFechaHora(x.fecha), x.sucursal, x.cajero, x.venta, x.concepto, csvNum(x.iva, 1), csvNum(x.neto), csvNum(x.cobrado)])));

  return (
    <div>
      <PanelHead
        title="Cargados a mano"
        desc="Lo que se cobró con «Cargo extra» escribiendo el nombre en vez de elegir el producto. No descuenta stock ni tiene costo: lo que es mercadería conviene darlo de alta y que se elija de la lista. No incluye el recargo por cuotas ni el envío de la tienda (los pone el sistema)."
        actions={filas.length > 0 && <Btn onClick={exportar}>Exportar CSV</Btn>}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <label htmlFor="amano-desde" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          Desde <input id="amano-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label htmlFor="amano-hasta" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          Hasta <input id="amano-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
        {esJefe && (
          <select className={s['select-inline']} value={sucursalId} onChange={(e) => setSucursalId(e.target.value)} aria-label="Local">
            <option value="">Todos los locales</option>
            {sucursales.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </select>
        )}
        <select className={s['select-inline']} value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)} aria-label="Cajero">
          <option value="">Todos los cajeros</option>
          {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
        </select>
        <input type="search" placeholder="Buscar lo que escribieron…" value={buscar} onChange={(e) => setBuscar(e.target.value)} style={{ width: 220 }} />
        <select className={s['select-inline']} value={vista} onChange={(e) => setVista(e.target.value)} aria-label="Ver">
          <option value="agrupado">Agrupado por lo que escribieron</option>
          <option value="detalle">Uno por uno</option>
        </select>
      </div>

      {!fechasOk && <div className={s.hint}>Elegí un período válido: «hasta» no puede ser antes que «desde».</div>}
      {error && <div className={s.hint} style={{ color: 'var(--crm-color-danger)' }}>{String(error.message || error)}</div>}

      {t && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <Stat label="Cobrado a mano" value={money(t.cobrado)} />
          <Stat label="Renglones" value={String(t.renglones)} />
          <Stat label="Textos distintos" value={String(grupos.length)} />
          {t.sinIva > 0 && <Stat label="Cargados como exentos (IVA 0 %)" value={String(t.sinIva)} accent="accent-amber" />}
        </div>
      )}
      {data?.recortado && <div className={s.hint}>Se muestran los 5.000 más recientes: acotá las fechas para ver todo.</div>}

      {vista === 'agrupado' ? (
        <Table
          cols={[{ h: 'Lo que escribieron' }, { h: 'Veces', num: true }, { h: 'Cobrado', num: true }, { h: 'Precio', num: true }, { h: 'Quiénes y dónde' }, { h: 'Última vez' }]}
          empty={loading ? 'Cargando…' : 'Nada cargado a mano en este período.'}
          pag={pag}
        >
          {pag.visibles.map((g) => (
            <tr key={g.clave}>
              <td><strong>{g.texto}</strong></td>
              <td className={s.num}>{g.veces}</td>
              <td className={s.num}><strong>{money(g.cobrado)}</strong></td>
              <td className={s.num}>{g.min == null ? '—' : g.min === g.max ? money(g.min) : `${money(g.min)} a ${money(g.max)}`}</td>
              <td>
                {g.cajeros.join(', ') || '—'}
                <div className={s.hint} style={{ margin: 0 }}>{g.locales.join(', ')}</div>
              </td>
              <td style={{ whiteSpace: 'nowrap' }}>{fmtFecha(g.ultima)}</td>
            </tr>
          ))}
        </Table>
      ) : (
        <Table
          cols={[{ h: 'Fecha' }, { h: 'Local' }, { h: 'Cajero' }, { h: 'Venta' }, { h: 'Lo que escribieron' }, { h: 'IVA', num: true }, { h: 'Cobrado', num: true }]}
          empty={loading ? 'Cargando…' : 'Nada cargado a mano en este período.'}
          pag={pag}
        >
          {pag.visibles.map((x) => (
            <tr key={x.id}>
              <td style={{ whiteSpace: 'nowrap' }}>{fmtFechaHora(x.fecha)}</td>
              <td>{x.sucursal || '—'}</td>
              <td>{x.cajero || '—'}</td>
              <td style={{ whiteSpace: 'nowrap' }}>{x.venta}</td>
              <td><strong>{x.concepto}</strong></td>
              <td className={s.num}>{x.iva > 0 ? `${String(x.iva).replace('.', ',')} %` : 'exento'}</td>
              <td className={s.num}>
                <strong>{money(x.cobrado)}</strong>
                {x.iva > 0 && <div className={s.hint} style={{ margin: 0 }}>{money(x.neto)} sin IVA</div>}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
