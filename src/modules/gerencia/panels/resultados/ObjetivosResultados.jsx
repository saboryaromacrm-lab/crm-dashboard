import { useEffect, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useResource } from '@modules/ventas/hooks/useResource.js';
import { errorMsg } from '@modules/ventas/services/ventas.api.js';
import { Btn, s } from '@modules/productos/components/ui.jsx';
import { Aviso, Bloque, Cargando } from '../metricas/piezas.jsx';
import { resultadosApi } from './resultados.api.js';
import { columna, cumplimiento, mesActual, nombreMes, pct, pesosRedondo, r2 } from './resultados.js';

/**
 * LOS OBJETIVOS (0152): cuánto se espera vender y ganar (antes de Ganancias)
 * cada mes, de la empresa o de un local, al lado de lo real. El estado de
 * resultados los usa para decir «85 % del objetivo».
 */
export function ObjetivosResultados({ alGuardar }) {
  const hoy = mesActual();
  const [anio, setAnio] = useState(Number(hoy.slice(0, 4)));
  const [sucursal, setSucursal] = useState('');
  const [filas, setFilas] = useState({});
  const [msg, setMsg] = useState(null);
  const enVuelo = useRef(false);
  const meses = Array.from({ length: 12 }, (_, i) => `${anio}-${String(i + 1).padStart(2, '0')}`);
  const hastaReal = `${anio}-12` < hoy ? `${anio}-12` : hoy;

  const obj = useResource(`resultados:objetivos:${anio}:${sucursal}`, () => resultadosApi.objetivos(anio, sucursal || null));
  const real = useResource(`resultados:objetivos-real:${anio}`, () => resultadosApi.estado(`${anio}-01`, hastaReal), { enabled: `${anio}-01` <= hoy });
  const conf = useResource('resultados:configuracion', () => resultadosApi.configuracion());

  useEffect(() => {
    const m = {};
    for (const o of obj.data ?? []) m[o.mes] = { venta: o.ventaNeta ?? '', resultado: o.resultado ?? '' };
    setFilas(m);
  }, [obj.data]);

  const balde = sucursal ? Number(sucursal) : null;
  const locales = (conf.data?.sucursales ?? []).filter((x) => x.activa);
  const set = (mes, k) => (e) => { const v = e.target.value; setFilas((f) => ({ ...f, [mes]: { ...f[mes], [k]: v } })); setMsg(null); };
  const valor = (v) => (v === '' || v == null ? null : r2(v));

  const guardar = async () => {
    if (enVuelo.current) return;
    enVuelo.current = true;
    try {
      await resultadosApi.guardarObjetivos({
        sucursalId: balde,
        meses: meses.map((mes) => ({ mes, ventaNeta: valor(filas[mes]?.venta), resultado: valor(filas[mes]?.resultado) })),
      });
      setMsg({ tono: 'ok', texto: 'Objetivos guardados.' });
      obj.reload();
      alGuardar?.();
    } catch (e) {
      setMsg({ tono: 'warn', texto: errorMsg(e) });
    } finally { enVuelo.current = false; }
  };

  const copiarArriba = (k) => {
    const primero = meses.map((m) => filas[m]?.[k]).find((v) => v !== '' && v != null);
    if (primero == null) return;
    setFilas((f) => Object.fromEntries(meses.map((m) => [m, { ...f[m], [k]: f[m]?.[k] === '' || f[m]?.[k] == null ? primero : f[m][k] }])));
  };
  const td = { padding: '6px 10px', textAlign: 'right', whiteSpace: 'nowrap' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className={s.toolbar} style={{ margin: 0 }}>
        <select className={s['select-inline']} value={anio} onChange={(e) => setAnio(Number(e.target.value))} aria-label="Año">
          {[anio - 1, anio, anio + 1].filter((a, i, l) => l.indexOf(a) === i).map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className={s['select-inline']} value={sucursal} onChange={(e) => setSucursal(e.target.value)} aria-label="De quién">
          <option value="">Toda la empresa</option>
          {locales.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
        </select>
        <Btn small onClick={() => copiarArriba('venta')}>Completar ventas vacías con la primera</Btn>
        <Btn small onClick={() => copiarArriba('resultado')}>Completar resultados vacíos con el primero</Btn>
        <Btn small variant="btn-primary" onClick={guardar}>Guardar objetivos</Btn>
      </div>
      {msg && <Aviso tono={msg.tono}>{msg.texto}</Aviso>}
      {obj.loading && !obj.data ? <Cargando /> : (
        <Bloque titulo={`Objetivos ${anio}${balde ? ` · ${locales.find((x) => x.id === balde)?.nombre ?? ''}` : ' · empresa'}`} sub="Ventas netas (sin IVA) y resultado antes de Ganancias. Vacío = sin objetivo ese mes.">
          <div className={cx(s.tblScroll)}>
            <table className={s.table} style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th>Mes</th><th style={td}>Ventas netas · objetivo</th><th style={td}>Real</th><th style={td}>Cumplido</th>
                  <th style={td}>Resultado · objetivo</th><th style={td}>Real</th><th style={td}>Cumplido</th>
                </tr>
              </thead>
              <tbody>
                {meses.map((mes) => {
                  const hay = mes <= hoy && real.data;
                  const c = hay ? columna(real.data, [mes], balde) : null;
                  const ov = valor(filas[mes]?.venta);
                  const or = valor(filas[mes]?.resultado);
                  return (
                    <tr key={mes}>
                      <td>{nombreMes(mes)}</td>
                      <td style={td}><input type="number" step="1000" value={filas[mes]?.venta ?? ''} onChange={set(mes, 'venta')} style={{ width: 150, textAlign: 'right' }} aria-label={`Ventas ${mes}`} /></td>
                      <td style={td}>{c ? pesosRedondo(c.ventasNetas) : '—'}</td>
                      <td style={td}>{c && ov ? pct(cumplimiento(c.ventasNetas, ov), 0) : '—'}</td>
                      <td style={td}><input type="number" step="1000" value={filas[mes]?.resultado ?? ''} onChange={set(mes, 'resultado')} style={{ width: 150, textAlign: 'right' }} aria-label={`Resultado ${mes}`} /></td>
                      <td style={td}>{c ? pesosRedondo(c.antesGanancias) : '—'}</td>
                      <td style={td}>{c && or ? pct(cumplimiento(c.antesGanancias, or), 0) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Bloque>
      )}
    </div>
  );
}
