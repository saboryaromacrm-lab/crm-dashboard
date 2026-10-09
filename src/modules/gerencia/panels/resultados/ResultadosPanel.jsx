/**
 * GERENCIA › RESULTADOS (0152, 9/10/2026) — el estado de resultados.
 * ============================================================================
 * Pedido del dueño: «la sección Resultados completa, como un experto en
 * administración de empresas». Todo en NETO (el IVA es un resultado aparte,
 * en su pestaña), por mes y por local, con el detalle de cada rubro, los
 * indicadores (márgenes, punto de equilibrio) y los objetivos. Solo el
 * superadmin. La cuenta la hace el servidor; acá se elige qué mirar.
 */
import { useMemo, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useResource } from '@modules/ventas/hooks/useResource.js';
import { Btn, PanelHead, s } from '@modules/productos/components/ui.jsx';
import { Aviso, Cargando } from '../metricas/piezas.jsx';
import { TablaEstado, TarjetasEstado } from './EstadoResultados.jsx';
import { IvaAparte } from './IvaAparte.jsx';
import { ObjetivosResultados } from './ObjetivosResultados.jsx';
import { ConfigResultados } from './ConfigResultados.jsx';
import { exportarCsv, imprimirEstado } from './exportar.js';
import { resultadosApi } from './resultados.api.js';
import { armarColumnas, baldesDe, mesActual, mesesEntre, nombreMes, objetivoDe, sumarMeses } from './resultados.js';
import { useAbiertos } from './useAbiertos.js';

const PESTANAS = [['estado', 'Estado de resultados'], ['iva', 'IVA (aparte)'], ['objetivos', 'Objetivos'], ['config', 'Configuración']];
/** El período más largo que se deja elegir (con la comparación, el servidor calcula hasta 36). */
const MAX_MESES = 24;

export function ResultadosPanel() {
  const hoy = mesActual();
  const [pestana, setPestana] = useState('estado');
  const [modo, setModo] = useState('mes');
  const [mes, setMes] = useState(hoy);
  const [rango, setRango] = useState([`${hoy.slice(0, 4)}-01`, hoy]);
  const [vista, setVista] = useState('meses');
  const [sucursal, setSucursal] = useState('');
  const [version, setVersion] = useState(0);
  const [abiertos, alternar] = useAbiertos();
  const enVuelo = useRef(false);

  const [desde, hasta] = modo === 'mes' ? [sumarMeses(mes, -12), mes] : rango;
  const largo = mesesEntre(rango[0], rango[1]).length;
  const rangoMal = modo === 'rango' && (rango[1] < rango[0] || largo > MAX_MESES);
  const { data, loading, error } = useResource(
    `resultados:${desde}:${hasta}:${version}`,
    () => resultadosApi.estado(desde, hasta, modo === 'mes' ? mes : null),
    { enabled: !rangoMal },
  );
  const balde = vista === 'meses' && sucursal ? Number(sucursal) : null;
  const vistaArmada = useMemo(
    () => (data ? armarColumnas(data, { modo, mes, desde: rango[0], hasta: rango[1], vista, balde }) : null),
    [data, modo, mes, rango, vista, balde],
  );
  const objetivo = vistaArmada ? objetivoDe(data?.objetivos, vistaArmada.meses, balde) : null;
  const locales = (data?.sucursales ?? []).filter((x) => x.activa || baldesDe(data, vistaArmada?.meses ?? []).some((b) => b.id === x.id));
  const nombreLocal = balde ? locales.find((x) => x.id === balde)?.nombre : '';
  const titulo = `Estado de resultados · ${modo === 'mes' ? nombreMes(mes) : `${nombreMes(rango[0])} a ${nombreMes(rango[1])}`}${nombreLocal ? ` · ${nombreLocal}` : ''}`;

  const atajo = (k) => {
    if (k === 'mes') { setModo('mes'); setMes(hoy); }
    if (k === 'pasado') { setModo('mes'); setMes(sumarMeses(hoy, -1)); }
    if (k === 'anio') { setModo('rango'); setRango([`${hoy.slice(0, 4)}-01`, hoy]); }
    if (k === '12') { setModo('rango'); setRango([sumarMeses(hoy, -11), hoy]); }
  };
  const actualizar = () => { if (!enVuelo.current) { enVuelo.current = true; setVersion((v) => v + 1); setTimeout(() => { enVuelo.current = false; }, 800); } };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
      <PanelHead
        title="Resultados"
        desc="El estado de resultados del negocio, todo en neto (sin IVA): cuánto se vende, cuánto cuesta y cuánto queda, por mes y por local. El IVA va aparte, en su pestaña."
        actions={pestana === 'estado' && vistaArmada ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn small onClick={() => exportarCsv(`resultados-${modo === 'mes' ? mes : `${rango[0]}-a-${rango[1]}`}${nombreLocal ? `-${nombreLocal}` : ''}.csv`, data, vistaArmada.columnas)}>Excel</Btn>
            <Btn small onClick={() => imprimirEstado({ titulo, subtitulo: data?.mesEnCurso ? 'El último mes está en curso: números hasta hoy.' : '', datos: data, columnas: vistaArmada.columnas, avisos: data?.avisos })}>PDF / Imprimir</Btn>
          </div>
        ) : null}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="tablist">
        {PESTANAS.map(([id, label]) => (
          <button
            key={id} type="button" role="tab" aria-selected={pestana === id} className={s.badge} onClick={() => setPestana(id)}
            style={{
              cursor: 'pointer', padding: '7px 14px', fontSize: 13, border: '1px solid var(--crm-color-border)',
              ...(pestana === id ? { background: 'var(--crm-color-primary)', color: 'var(--crm-color-primary-contrast)', borderColor: 'var(--crm-color-primary)' } : {}),
            }}
          >{label}</button>
        ))}
      </div>

      {(pestana === 'estado' || pestana === 'iva') && (
        <div className={s.toolbar} style={{ margin: 0 }}>
          <select className={s['select-inline']} value={modo} onChange={(e) => setModo(e.target.value)} aria-label="Período">
            <option value="mes">Un mes</option>
            <option value="rango">Varios meses</option>
          </select>
          {modo === 'mes' ? (
            <input type="month" value={mes} max={hoy} onChange={(e) => e.target.value && setMes(e.target.value)} aria-label="Mes" />
          ) : (
            <>
              <input type="month" value={rango[0]} max={rango[1]} onChange={(e) => e.target.value && setRango([e.target.value, rango[1]])} aria-label="Desde" />
              <input type="month" value={rango[1]} min={rango[0]} max={hoy} onChange={(e) => e.target.value && setRango([rango[0], e.target.value])} aria-label="Hasta" />
            </>
          )}
          {pestana === 'estado' && (
            <select className={s['select-inline']} value={vista} onChange={(e) => setVista(e.target.value)} aria-label="Columnas">
              <option value="meses">Columnas por mes</option>
              <option value="locales">Columnas por local</option>
            </select>
          )}
          {pestana === 'estado' && vista === 'meses' && (
            <select className={s['select-inline']} value={sucursal} onChange={(e) => setSucursal(e.target.value)} aria-label="Local">
              <option value="">Toda la empresa</option>
              {locales.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
            </select>
          )}
          <Btn small onClick={() => atajo('mes')}>Este mes</Btn>
          <Btn small onClick={() => atajo('pasado')}>Mes pasado</Btn>
          <Btn small onClick={() => atajo('anio')}>Este año</Btn>
          <Btn small onClick={() => atajo('12')}>12 meses</Btn>
          <Btn small onClick={actualizar} title="Volver a calcular con lo último cargado">Actualizar</Btn>
        </div>
      )}

      {pestana === 'estado' && (
        rangoMal ? <Aviso tono="warn">Elegí un período de hasta {MAX_MESES} meses, con «desde» antes de «hasta».</Aviso>
          : loading && !data ? <Cargando />
            : error ? <Aviso tono="warn">{error}</Aviso>
              : vistaArmada && (
                <>
                  <TarjetasEstado col={vistaArmada.principal} contra={vistaArmada.contra} contraTxt={vistaArmada.contraTxt} objetivo={objetivo} esEmpresa={vistaArmada.empresa} />
                  {(data.avisos ?? []).map((a, i) => <Aviso key={i} tono={a.tono}>{a.texto}</Aviso>)}
                  <TablaEstado datos={data} columnas={vistaArmada.columnas} mesesOrigen={vistaArmada.meses} abiertos={abiertos} alternar={alternar} />
                  <div className={cx(s.hint)} style={{ margin: 0 }}>
                    Todo en neto, sin IVA. Los costos van en negativo y abajo de cada importe, su % sobre las ventas netas. Tocá los grupos con ▸ para ver cada rubro.
                    {balde ? ' Por local: los gastos sin local se reparten por lo que vende cada uno (o quedan en «Administración», según el rubro); Ganancias es de la empresa entera.' : ''}
                    {' '}Ganancias es un estimado por lo acumulado del año con la escala de ARCA; el impuesto real lo determina la contadora.
                  </div>
                </>
              )
      )}
      {pestana === 'iva' && (
        rangoMal ? <Aviso tono="warn">Elegí un período de hasta {MAX_MESES} meses.</Aviso>
          : loading && !data ? <Cargando /> : error ? <Aviso tono="warn">{error}</Aviso>
            : data && <IvaAparte datos={data} meses={modo === 'mes' ? [mes] : mesesEntre(rango[0], rango[1])} />
      )}
      {pestana === 'objetivos' && <ObjetivosResultados alGuardar={() => setVersion((v) => v + 1)} />}
      {pestana === 'config' && <ConfigResultados alGuardar={() => setVersion((v) => v + 1)} />}
    </div>
  );
}
