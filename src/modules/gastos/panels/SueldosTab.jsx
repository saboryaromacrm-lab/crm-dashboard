import { cx } from '@shared/utils/classNames.js';
import { useGastos } from '../context/GastosContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { gastosApi } from '../services/gastos.api.js';
import { diaLegible, hoyISO, mesLargo } from '../domain/constants.js';
import { costoMensual } from '../domain/sueldos.js';
import { Table, PanelHead, Stat, Btn, Pill, money, s } from '../components/ui.jsx';

/**
 * SUELDOS POR EMPLEADO (0152, solo superadmin). No son gastos: es la planilla
 * con la que Resultados calcula el costo de cada mes —sueldo bruto, cargas del
 * empleador y 1/12 de aguinaldo— en el local de cada uno. Los pagos de sueldos
 * cargados en Gastos no se suman encima (serían dos veces lo mismo).
 */
export function SueldosTab() {
  const { openModal } = useGastos();
  const { data, loading, error, reload } = useResource('resultados-empleados', () => gastosApi.empleados());
  const lista = data?.empleados ?? [];
  const hoy = hoyISO();
  const activo = (e) => e.alta <= hoy && (!e.baja || e.baja >= hoy);
  const activos = lista.filter(activo);
  const costoDe = (e) => (e.vigente ? costoMensual(e.vigente.bruto, e.vigente.cargas) : { total: 0, aguinaldo: 0 });
  const total = activos.reduce((a, e) => a + costoDe(e).total, 0);
  const aguinaldo = activos.reduce((a, e) => a + costoDe(e).aguinaldo, 0);
  const nombreSuc = (id) => (id ? data?.sucursales?.find((x) => x.id === id)?.nombre ?? `#${id}` : null);
  const reparte = data?.rubroSueldos?.reparte ?? true;
  const abrir = (e) => openModal('empleadoForm', { empleado: e ?? null, sucursales: data?.sucursales ?? [], onChange: reload });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Sueldos"
        desc="Cada empleado con su sueldo bruto y las cargas del empleador. Resultados suma cada mes el sueldo, las cargas y 1/12 del aguinaldo, en el local de cada uno."
        actions={<Btn variant="btn-primary" onClick={() => abrir(null)}>+ Nuevo empleado</Btn>}
      />
      <div className={s.stats}>
        <Stat label="Empleados activos" value={activos.length} />
        <Stat label="Costo de un mes (con aguinaldo)" value={money(total)} />
        <Stat label="Aguinaldo que se aparta por mes" value={money(aguinaldo)} />
      </div>
      {error && <div className={cx(s.callout, s.warn)}>No se pudo cargar la planilla: {error}</div>}
      <Table
        cols={[
          { h: 'Empleado' }, { h: 'Local' }, { h: 'Desde' }, { h: 'Sueldo bruto', num: true },
          { h: 'Cargas', num: true }, { h: 'Costo del mes', num: true }, { h: 'Estado' }, { h: 'Acciones', cls: 'actions-col' },
        ]}
        empty={loading ? 'Cargando…' : 'Todavía no hay empleados cargados.'}
      >
        {lista.map((e) => {
          const c = costoDe(e);
          return (
            <tr key={e.id} className={s.clickable} onClick={() => abrir(e)}>
              <td>
                <div>{e.nombre}</div>
                {e.cuil && <div className={s.hint} style={{ margin: 0 }}>CUIL {e.cuil}</div>}
              </td>
              <td>{nombreSuc(e.sucursalId) ?? <span className={s.muted}>{reparte ? 'Varios locales (se reparte)' : 'Administración'}</span>}</td>
              <td>{diaLegible(e.alta)}</td>
              <td className={s.num}>{e.vigente ? money(e.vigente.bruto) : '—'}</td>
              <td className={s.num}>{e.vigente ? `${e.vigente.cargas} %` : '—'}</td>
              <td className={s.num}>{e.vigente ? money(c.total) : '—'}</td>
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
        {' '}(se cambia en Gerencia › Resultados › Configuración, rubro «Sueldos y cargas sociales»).
        {data?.empleados?.some((e) => e.sueldos.some((x) => x.desde > hoy.slice(0, 7))) && ` Hay aumentos cargados para meses que vienen (${mesLargo(hoy.slice(0, 7))} en adelante).`}
      </div>
    </div>
  );
}
