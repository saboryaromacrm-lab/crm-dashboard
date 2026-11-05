import { useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useGastos } from '../context/GastosContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { gastosApi } from '../services/gastos.api.js';
import { diaLegible, hoyISO, mesLargo } from '../domain/constants.js';
import { costoMensual, detalleCosto } from '../domain/sueldos.js';
import { Table, PanelHead, Stat, Btn, Pill, money, s } from '../components/ui.jsx';
import { textoReparto } from '../domain/reparto.js';

/**
 * SUELDOS POR EMPLEADO (0152, solo superadmin). No son gastos: es la planilla
 * con la que Resultados calcula el costo de cada mes —sueldo bruto, cargas del
 * empleador y 1/12 de aguinaldo— en el local de cada uno. Los pagos de sueldos
 * cargados en Gastos no se suman encima (serían dos veces lo mismo).
 */
export function SueldosTab() {
  const { openModal } = useGastos();
  const { data, loading, error, reload } = useResource('resultados-empleados', () => gastosApi.empleados());
  const [filtro, setFiltro] = useState('');
  const todos = data?.empleados ?? [];
  const hoy = hoyISO();
  const activo = (e) => e.alta <= hoy && (!e.baja || e.baja >= hoy);
  const costoDe = (e) => (e.vigente ? costoMensual(e.vigente.bruto, e.vigente.cargas, e.aguinaldo !== false) : { total: 0, aguinaldo: 0 });
  const nombreSuc = (id) => (id ? data?.sucursales?.find((x) => x.id === id)?.nombre ?? `#${id}` : null);
  const reparte = data?.rubroSueldos?.reparte ?? true;

  /*
   * FILTRO POR LOCAL (4/11/2026, pedido del dueño). Con un local elegido entran
   * los que trabajan ahí y los repartidos que lo incluyen, y los totales suman
   * solo lo que le toca a ese local (el % del reparto), como en Resultados.
   * El que no tiene local va con los repartidos (o a Administración).
   */
  const sinLocal = (e) => !e.reparto?.length && !e.sucursalId;
  const esRepartido = (e) => e.reparto?.length > 0 || (sinLocal(e) && reparte);
  const sucId = /^\d+$/.test(filtro) ? Number(filtro) : null;
  const pctEn = (e, id) => (e.sucursalId === id ? 100 : Number(e.reparto?.find((x) => x.sucursalId === id)?.pct) || 0);
  const parte = (e) => (sucId ? pctEn(e, sucId) / 100 : 1);
  const locales = useMemo(() => {
    const ids = new Set(todos.flatMap((e) => [e.sucursalId, ...(e.reparto ?? []).map((x) => x.sucursalId)]).filter(Boolean));
    return [...ids].map((id) => ({ id, nombre: nombreSuc(id) })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [todos, data?.sucursales]); // eslint-disable-line react-hooks/exhaustive-deps
  const hayAdministracion = !reparte && todos.some(sinLocal);
  const lista = todos.filter((e) => {
    if (filtro === 'repartidos') return esRepartido(e);
    if (filtro === 'administracion') return sinLocal(e) && !reparte;
    if (sucId) return pctEn(e, sucId) > 0;
    return true;
  });
  const activos = lista.filter(activo);
  const total = activos.reduce((a, e) => a + costoDe(e).total * parte(e), 0);
  const aguinaldo = activos.reduce((a, e) => a + costoDe(e).aguinaldo * parte(e), 0);
  const enLocal = sucId ? ` en ${nombreSuc(sucId)}` : '';
  const abrir = (e) => openModal('empleadoForm', { empleado: e ?? null, sucursales: data?.sucursales ?? [], onChange: reload });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Sueldos"
        desc="Cada empleado con su sueldo bruto y las cargas del empleador. Resultados suma cada mes el sueldo, las cargas y 1/12 del aguinaldo (salvo al que no le corresponde), en el local de cada uno."
        actions={<Btn variant="btn-primary" onClick={() => abrir(null)}>+ Nuevo empleado</Btn>}
      />
      <div className={s.toolbar}>
        <select className={s['select-inline']} value={filtro} onChange={(ev) => setFiltro(ev.target.value)} aria-label="Filtrar por local">
          <option value="">Todos los locales</option>
          <option value="repartidos">Repartidos entre locales</option>
          {hayAdministracion && <option value="administracion">Administración</option>}
          {locales.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
        </select>
        {filtro && <Btn small onClick={() => setFiltro('')}>Ver todos</Btn>}
      </div>
      <div className={s.stats}>
        <Stat label={`Empleados activos${enLocal}`} value={activos.length} />
        <Stat label={sucId ? `Costo de un mes${enLocal} (su parte)` : 'Costo de un mes (con aguinaldo)'} value={money(total)} />
        <Stat label={`Aguinaldo que se aparta por mes${enLocal}`} value={money(aguinaldo)} />
      </div>
      {error && <div className={cx(s.callout, s.warn)}>No se pudo cargar la planilla: {error}</div>}
      <Table
        cols={[
          { h: 'Empleado' }, { h: 'Local' }, { h: 'Desde' }, { h: 'Sueldo bruto', num: true },
          { h: 'Cargas', num: true }, { h: 'Costo del mes', num: true }, { h: 'Estado' }, { h: 'Acciones', cls: 'actions-col' },
        ]}
        empty={loading ? 'Cargando…' : filtro ? 'No hay empleados con ese filtro.' : 'Todavía no hay empleados cargados.'}
      >
        {lista.map((e) => {
          const c = costoDe(e);
          return (
            <tr key={e.id} className={s.clickable} onClick={() => abrir(e)}>
              <td>
                <div>{e.nombre}</div>
                {e.cuil && <div className={s.hint} style={{ margin: 0 }}>CUIL {e.cuil}</div>}
                {e.aguinaldo === false && <div className={s.hint} style={{ margin: 0 }}>sin aguinaldo</div>}
              </td>
              <td>
                {e.reparto?.length
                  ? <span>{textoReparto(e.reparto, nombreSuc)}</span>
                  : nombreSuc(e.sucursalId) ?? <span className={s.muted}>{reparte ? 'Varios locales (se reparte)' : 'Administración'}</span>}
              </td>
              <td>{diaLegible(e.alta)}</td>
              <td className={s.num}>{e.vigente ? money(e.vigente.bruto) : '—'}</td>
              <td className={s.num}>{e.vigente ? `${e.vigente.cargas} %` : '—'}</td>
              <td className={s.num}>
                {e.vigente ? money(c.total) : '—'}
                {e.vigente && <div className={s.hint} style={{ margin: 0 }}>{detalleCosto(c, e.aguinaldo !== false)}</div>}
                {e.vigente && sucId && pctEn(e, sucId) < 100 && (
                  <div className={s.hint} style={{ margin: 0 }}>
                    <strong>{`a ${nombreSuc(sucId)} le toca ${pctEn(e, sucId).toLocaleString('es-AR', { maximumFractionDigits: 2 })} %: ${money(c.total * parte(e))}`}</strong>
                  </div>
                )}
              </td>
              <td>
                {e.baja && e.baja < hoy
                  ? <Pill pill="est-cancelada" label={`Baja ${diaLegible(e.baja)}`} />
                  : e.alta > hoy
                    ? <Pill pill="est-pendiente" label="Entra más adelante" />
                    : <Pill pill="est-recibida" label={e.baja ? `Activo hasta ${diaLegible(e.baja)}` : 'Activo'} />}
              </td>
              <td className={s['actions-col']}>
                <div className={s['row-actions']} onClick={(ev) => ev.stopPropagation()}>
                  <Btn variant="btn-edit" small onClick={() => abrir(e)}>Editar</Btn>
                </div>
              </td>
            </tr>
          );
        })}
      </Table>
      <div className={s.hint}>
        Un aumento se carga como un sueldo nuevo «vigente desde» su mes: los meses anteriores siguen con el sueldo viejo.
        La baja se pone con la fecha en que dejó de trabajar (el último mes cuenta por los días).
        {` El que no tiene local ${reparte ? 'se reparte entre los locales por lo que vende cada uno' : 'queda en «Administración»'}`}
        {' '}(se cambia en Ventas › Configuración › Impuestos, rubros y Ganancias, rubro «Sueldos y cargas sociales»).
        {data?.empleados?.some((e) => e.sueldos.some((x) => x.desde > hoy.slice(0, 7))) && ` Hay aumentos cargados para meses que vienen (${mesLargo(hoy.slice(0, 7))} en adelante).`}
      </div>
    </div>
  );
}
