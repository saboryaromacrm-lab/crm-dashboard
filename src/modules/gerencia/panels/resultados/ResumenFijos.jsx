import { useState } from 'react';
import { useResource } from '@modules/ventas/hooks/useResource.js';
import { Table, s } from '@modules/productos/components/ui.jsx';
import { Aviso, Bloque, Cargando } from '../metricas/piezas.jsx';
import { resultadosApi } from './resultados.api.js';
import { baldesDe, columna, mesActual, nombreMes, pct, pesosRedondo, r2, sumarMeses } from './resultados.js';

/**
 * LO FIJO DE CADA LOCAL Y CUÁNTO TIENE QUE VENDER (3/11/2026, pedido del dueño).
 * Sale del mismo estado de resultados (con los gastos fijos sin cargar ya
 * estimados y los repartos por %), así que nunca dice otra cosa que Resultados.
 *
 *   Lo fijo        sueldos + gastos fijos + amortizaciones del mes.
 *   Contribución   de cada $100 vendidos, lo que queda después de la mercadería,
 *                  las mermas y los gastos variables. Se toma del MES ANTERIOR
 *                  (el mes en curso todavía no vendió todo y la daría torcida) y
 *                  SIN las diferencias de inventario: un mes de controles de
 *                  stock la inflaba (Express 1 en octubre daba 136 %).
 *   Venta necesaria  lo fijo ÷ la contribución: lo que hay que vender para no
 *                  perder (el punto de equilibrio).
 */
export function ResumenFijos() {
  const [mes, setMes] = useState(mesActual());
  const anterior = sumarMeses(mes, -1);
  const { data, loading, error } = useResource(`resultados:fijos:${mes}`, () => resultadosApi.estado(anterior, mes, mes));

  const filas = data ? baldesDe(data, [mes]).map((b) => fila(data, mes, anterior, b.id, b.nombre)) : [];
  const empresa = data ? fila(data, mes, anterior, null, 'Toda la empresa') : null;
  const avisoEstimados = (data?.avisos ?? []).find((a) => a.texto.includes('gastos fijos que todavía no se cargaron'));

  return (
    <Bloque
      titulo={`Lo fijo de cada local · ${nombreMes(mes)}`}
      sub="Sueldos, gastos fijos y amortizaciones del mes, y cuánto tiene que vender cada local para cubrirlos con lo que le deja cada venta."
      acciones={<input type="month" value={mes} max={mesActual()} onChange={(e) => e.target.value && setMes(e.target.value)} aria-label="Mes" />}
    >
      {loading && !data ? <Cargando /> : error ? <Aviso tono="warn">{error}</Aviso> : data && (
        <>
          {avisoEstimados && <Aviso tono="info">{avisoEstimados.texto}</Aviso>}
          <Table
            cols={[
              { h: 'Local' }, { h: 'Sueldos', num: true }, { h: 'Gastos fijos', num: true }, { h: 'Amortizaciones', num: true },
              { h: 'Total fijo', num: true }, { h: `Contribución (${nombreMes(anterior, true)})`, num: true }, { h: 'Venta necesaria', num: true },
            ]}
            empty="Sin sueldos ni gastos fijos este mes."
          >
            {[...filas, empresa].filter((f) => f && (f.total > 0.004 || f.esEmpresa)).map((f) => (
              <tr key={f.clave} style={f.esEmpresa ? { fontWeight: 700 } : undefined}>
                <td>{f.nombre}</td>
                <td className={s.num}>{pesosRedondo(f.sueldos)}</td>
                <td className={s.num}>{pesosRedondo(f.fijos)}</td>
                <td className={s.num}>{f.amortizaciones ? pesosRedondo(f.amortizaciones) : '—'}</td>
                <td className={s.num}><strong>{pesosRedondo(f.total)}</strong></td>
                <td className={s.num}>{f.contribucion == null ? '—' : pct(f.contribucion)}</td>
                <td className={s.num}>
                  {f.necesaria != null ? pesosRedondo(f.necesaria)
                    : <span className={s.muted}>{f.administracion ? 'la cubren los locales' : f.contribucion != null ? 'no se cubre' : 'sin ventas'}</span>}
                  {f.necesaria != null && f.vendido > 0 && (
                    <div className={s.hint} style={{ margin: 0 }}>vendió {pesosRedondo(f.vendido)} ({pct((f.vendido / f.necesaria) * 100, 0)})</div>
                  )}
                </td>
              </tr>
            ))}
          </Table>
          <div className={s.hint} style={{ margin: 0 }}>
            Todo neto, sin IVA. «Contribución» es lo que queda de cada $100 vendidos después de la mercadería, las mermas y los
            gastos variables (Ingresos Brutos, tasa municipal, comisiones, packing y demás), tomada del mes anterior porque el mes
            en curso todavía no vendió todo, y sin las diferencias de inventario de los controles de stock. «Venta necesaria» = total fijo ÷ contribución: vendiendo eso, el local no pierde.
            Lo que queda en «Administración» (gastos sin local que no se reparten) lo tienen que cubrir los locales entre todos:
            por eso está en la fila de toda la empresa.
          </div>
        </>
      )}
    </Bloque>
  );
}

/** Lo fijo del mes, la contribución del anterior y la venta necesaria de un balde (o de la empresa, `null`). */
function fila(datos, mes, anterior, balde, nombre) {
  const v = columna(datos, [mes], balde);
  const previo = columna(datos, [anterior], balde);
  const sueldos = r2(v.sueldos);
  const fijos = r2(v.otrosFijos);
  const amortizaciones = r2(v.amortizaciones);
  const total = r2(sueldos + fijos + amortizaciones);
  const contribucion = previo.ventasNetas > 0 ? r2(((previo.contribucion - previo.ajustesStock) / previo.ventasNetas) * 100) : null;
  const administracion = balde === -1;
  return {
    clave: balde ?? 'empresa', nombre, esEmpresa: balde == null, administracion,
    sueldos, fijos, amortizaciones, total, contribucion, vendido: r2(v.ventasNetas),
    necesaria: !administracion && contribucion > 0 ? r2(total / (contribucion / 100)) : null,
  };
}
