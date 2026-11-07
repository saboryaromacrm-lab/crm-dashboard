/**
 * GERENCIA › GASTOS FIJOS Y SUELDOS › ADELANTOS (6/11/2026, pedido del dueño:
 * «poneme ahí los adelantos con sus filtros»). Solo lectura: los adelantos se
 * cargan como egreso en el Cash Flow o en la caja de un local, y se anulan allá.
 * Es el mismo listado que toma la app de sueldos; los filtros, en `adelantos.js`.
 */
import { useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { useResource } from '@modules/ventas/hooks/useResource.js';
import { descargarCsv, csvNum } from '@shared/utils/csv.js';
import { money } from '@modules/productos/domain/format.js';
import { Table, Btn, usePaginado, s } from '@modules/productos/components/ui.jsx';
import { PRESETS, rangoDe } from '../metricas/formato.js';
import { Aviso, Bloque, Cargando, Tile, Tiles } from '../metricas/piezas.jsx';
import { fechaHoraSinDia } from '../cashflow/formato.js';
import { Fecha } from '../cashflow/Fecha.jsx';
import { claveEmpleado, claveLugar, detalleSinNombre, filtrar, nombreEmpleado, opciones, porEmpleado } from './adelantos.js';

const marcado = { fontWeight: 700, color: 'var(--crm-color-primary)' };

export function AdelantosPestana() {
  const [preset, setPreset] = useState('mes');
  const [manual, setManual] = useState(() => rangoDe('mes'));
  const [desde, hasta] = preset === 'otro' ? manual : rangoDe(preset);
  /* [clave, nombre]: el elegido sigue en su desplegable aunque el período nuevo no lo traiga. */
  const [empleado, setEmpleado] = useState(null);
  const [lugar, setLugar] = useState(null);
  const [concepto, setConcepto] = useState('');
  const [texto, setTexto] = useState('');
  const [anulados, setAnulados] = useState(false);

  const { data, loading, error, reload } = useResource(`gerencia:adelantos:${desde}:${hasta}`,
    () => httpClient.get(`/externo/adelantos?desde=${desde}&hasta=${hasta}`));
  const todos = data?.adelantos ?? [];
  const filtros = { empleado: empleado?.[0] ?? '', lugar: lugar?.[0] ?? '', concepto, anulados, texto };
  const opcEmpleados = opciones(todos, claveEmpleado, nombreEmpleado, empleado);
  const opcLugares = opciones(todos, claveLugar, (a) => a.lugar, lugar);
  const filas = filtrar(todos, filtros);
  /* El resumen por empleado respeta todos los filtros menos el del empleado: así se ve a quién elegir. */
  const resumen = porEmpleado(filtrar(todos, { ...filtros, empleado: '' }));
  const vigentes = filas.filter((a) => !a.anulado);
  const total = vigentes.reduce((t, a) => t + a.importe, 0);
  const pag = usePaginado(filas, 'gerencia-adelantos', `${desde}|${hasta}|${JSON.stringify(filtros)}`);
  const hayFiltro = filtros.empleado || filtros.lugar || concepto || texto;

  const exportar = () => descargarCsv(`adelantos-${desde}-a-${hasta}${hayFiltro ? '-filtrado' : ''}.csv`,
    ['Fecha', 'Empleado', 'Importe', 'Dónde', 'Concepto', 'Detalle', 'Cargó', 'Anulado', 'Motivo anulación'],
    filas.map((a) => [fechaHoraSinDia(a.fecha), nombreEmpleado(a), csvNum(a.importe), a.lugar, a.concepto, detalleSinNombre(a), a.cargadoPor,
      a.anulado ? 'Sí' : '', a.anuladoMotivo ?? '']));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <div className={s.toolbar} style={{ margin: 0 }}>
        <select className={s['select-inline']} value={preset} aria-label="Período"
          onChange={(e) => { if (e.target.value === 'otro') setManual([desde, hasta]); setPreset(e.target.value); }}>
          {PRESETS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        {preset === 'otro' && (
          <>
            <input type="date" value={manual[0]} max={manual[1]} onChange={(e) => setManual([e.target.value, manual[1]])} aria-label="Desde" />
            <input type="date" value={manual[1]} min={manual[0]} onChange={(e) => setManual([manual[0], e.target.value])} aria-label="Hasta" />
          </>
        )}
        <select className={s['select-inline']} value={filtros.empleado} onChange={(e) => setEmpleado(opcEmpleados.find((o) => o[0] === e.target.value) ?? null)} aria-label="Empleado">
          <option value="">Todos los empleados</option>
          {opcEmpleados.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
        </select>
        <select className={s['select-inline']} value={filtros.lugar} onChange={(e) => setLugar(opcLugares.find((o) => o[0] === e.target.value) ?? null)} aria-label="Dónde se sacó">
          <option value="">Caja central y locales</option>
          {opcLugares.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
        </select>
        {(data?.conceptos?.length ?? 0) > 1 && (
          <select className={s['select-inline']} value={concepto} onChange={(e) => setConcepto(e.target.value)} aria-label="Concepto">
            <option value="">Todos los conceptos</option>
            {data.conceptos.map((c) => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
          </select>
        )}
        <input type="search" value={texto} placeholder="Buscar en el detalle" onChange={(e) => setTexto(e.target.value)} aria-label="Buscar" style={{ width: 200 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={anulados} onChange={(e) => setAnulados(e.target.checked)} /> Ver anulados
        </label>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Btn small onClick={reload} disabled={loading}>{loading ? 'Actualizando…' : 'Actualizar'}</Btn>
          <Btn small onClick={exportar} disabled={!filas.length}>Exportar CSV</Btn>
        </div>
      </div>

      {error && <Aviso tono="warn">{error}</Aviso>}
      {!data ? (loading && <Cargando />) : (
        <>
          <Tiles>
            <Tile label="Total adelantado" valor={money(total)} />
            <Tile label="Adelantos" valor={vigentes.length} detalle={filas.length > vigentes.length ? `${filas.length - vigentes.length} anulado(s) a la vista` : null} />
            <Tile label="Empleados" valor={new Set(vigentes.filter((a) => a.empleado).map(claveEmpleado)).size} />
          </Tiles>

          <Bloque titulo="Por empleado" sub="Tocá un nombre para ver solo los suyos. No cuenta lo anulado.">
            <Table cols={[{ h: 'Empleado' }, { h: 'Adelantos', num: true }, { h: 'Total', num: true }]} empty="Ningún adelanto en el período." movil="tabla">
              {resumen.map((e) => (
                <tr key={e.clave}>
                  <td>
                    <button type="button" onClick={() => setEmpleado(filtros.empleado === e.clave ? null : [e.clave, e.nombre])}
                      style={{ background: 'none', border: 0, padding: 0, fontFamily: 'inherit', fontSize: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left', ...(filtros.empleado === e.clave ? marcado : {}) }}>
                      {e.nombre}
                    </button>
                  </td>
                  <td className={s.num}>{e.cantidad}</td>
                  <td className={s.num}>{money(e.total)}</td>
                </tr>
              ))}
            </Table>
          </Bloque>

          <Table
            cols={[{ h: 'Fecha' }, { h: 'Empleado' }, { h: 'Importe', num: true }, { h: 'Dónde' }, { h: 'Detalle' }, { h: 'Cargó' }]}
            empty="Ningún adelanto con estos filtros." pag={pag}
          >
            {pag.visibles.map((a) => (
              <tr key={a.id} style={a.anulado ? { opacity: 0.55 } : undefined}>
                <td style={{ whiteSpace: 'nowrap' }}><Fecha v={a.fecha} /></td>
                <td>{a.empleado ? a.empleado.nombre : <span className={s.muted}>Sin empleado elegido</span>}</td>
                <td className={s.num} style={a.anulado ? { textDecoration: 'line-through' } : undefined}>{money(a.importe)}</td>
                <td>{a.lugar}{data.conceptos.length > 1 && <div className={s.muted}>{a.concepto}</div>}</td>
                <td>
                  {detalleSinNombre(a) || <span className={s.muted}>—</span>}
                  {a.anulado && <div style={{ color: 'var(--crm-color-danger)', fontSize: 12 }}>Anulado{a.anuladoMotivo ? `: ${a.anuladoMotivo}` : ''}</div>}
                </td>
                <td>{a.cargadoPor || '—'}</td>
              </tr>
            ))}
          </Table>
          <div className={s.hint} style={{ margin: 0 }}>
            Se cargan como egreso con el concepto de adelanto, en el Cash Flow o en la caja de un local, y se anulan desde ahí.
          </div>
        </>
      )}
    </div>
  );
}
