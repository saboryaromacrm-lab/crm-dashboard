import { useRef } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useGastos } from '../context/GastosContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { gastosApi } from '../services/gastos.api.js';
import { diaLegible, mesLargo } from '../domain/constants.js';
import { Table, PanelHead, Stat, Btn, money, s } from '../components/ui.jsx';

/**
 * BIENES DE USO (0152, solo superadmin): heladeras, balanzas, reformas. Lo
 * que se compró para usar años no es gasto del mes en que se pagó: se reparte
 * en su vida útil (amortización). Es opcional: Resultados solo los resta con
 * las amortizaciones encendidas.
 */
export function BienesTab() {
  const { openModal, act } = useGastos();
  const { data, loading, error, reload } = useResource('resultados-bienes', () => gastosApi.bienes());
  const enVuelo = useRef(false);
  const lista = data?.bienes ?? [];
  const activas = !!data?.activas;
  const cuotaMes = lista.filter((b) => !b.baja && b.amortizado < b.valor).reduce((a, b) => a + b.cuota, 0);
  const nombreSuc = (id) => (id ? data?.sucursales?.find((x) => x.id === id)?.nombre ?? `#${id}` : null);
  const abrir = (b) => openModal('bienForm', { bien: b ?? null, sucursales: data?.sucursales ?? [], onChange: reload });
  const alternar = async () => {
    if (enVuelo.current) return;
    enVuelo.current = true;
    try {
      if (await act(gastosApi.encenderAmortizaciones(!activas), activas ? 'Amortizaciones apagadas.' : 'Amortizaciones encendidas.')) reload();
    } finally { enVuelo.current = false; }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Bienes de uso"
        desc="Lo que se compró para usar años (heladeras, balanzas, reformas). En Resultados resta una cuota por mes durante su vida útil, no todo el mes en que se pagó."
        actions={<Btn variant="btn-primary" onClick={() => abrir(null)}>+ Nuevo bien</Btn>}
      />
      <div className={cx(s.callout, activas ? s.ok : s.info)} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ flex: 1, minWidth: 220 }}>
          {activas
            ? 'Las amortizaciones están ENCENDIDAS: Resultados resta la cuota de cada mes.'
            : 'Las amortizaciones están APAGADAS: los bienes se guardan, pero Resultados no los resta.'}
        </span>
        <Btn small variant={activas ? 'btn-ghost' : 'btn-primary'} onClick={alternar}>{activas ? 'Apagar' : 'Encender'}</Btn>
      </div>
      <div className={s.stats}>
        <Stat label="Bienes cargados" value={lista.length} />
        <Stat label="Amortización de un mes" value={money(cuotaMes)} />
      </div>
      {error && <div className={cx(s.callout, s.warn)}>No se pudieron cargar los bienes: {error}</div>}
      <Table
        cols={[
          { h: 'Bien' }, { h: 'Local' }, { h: 'Valor', num: true }, { h: 'Desde' }, { h: 'Hasta' },
          { h: 'Cuota mensual', num: true }, { h: 'Amortizado a hoy', num: true }, { h: 'Acciones', cls: 'actions-col' },
        ]}
        empty={loading ? 'Cargando…' : 'Todavía no hay bienes de uso cargados.'}
      >
        {lista.map((b) => (
          <tr key={b.id} className={s.clickable} onClick={() => abrir(b)}>
            <td>
              <div>{b.nombre}</div>
              {b.baja && <div className={s.hint} style={{ margin: 0 }}>Baja {diaLegible(b.baja)}</div>}
            </td>
            <td>{nombreSuc(b.sucursalId) ?? <span className={s.muted}>Toda la empresa</span>}</td>
            <td className={s.num}>{money(b.valor)}</td>
            <td>{mesLargo(b.alta.slice(0, 7))}</td>
            <td>{mesLargo(b.hasta)}</td>
            <td className={s.num}>{money(b.cuota)}</td>
            <td className={s.num}>{money(b.amortizado)}</td>
            <td className={s['actions-col']}>
              <div className={s['row-actions']} onClick={(ev) => ev.stopPropagation()}>
                <Btn variant="btn-edit" small onClick={() => abrir(b)}>Editar</Btn>
              </div>
            </td>
          </tr>
        ))}
      </Table>
      <div className={s.hint}>
        El valor va sin IVA (el de la factura A se recupera). Lo que no es de un local se reparte entre los locales por lo que vende cada uno.
      </div>
    </div>
  );
}
