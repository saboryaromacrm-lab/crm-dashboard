import { cx } from '@shared/utils/classNames.js';
import { s } from '@modules/productos/components/ui.jsx';
import { Tile, Tiles } from '../metricas/piezas.jsx';
import {
  cumplimiento, indicadores, origenDe, pct, pesos, pesosRedondo, renglones, sobreVentas, textoOrigen, variacion,
} from './resultados.js';

/**
 * LA TABLA DEL ESTADO DE RESULTADOS: un renglón por concepto, una columna
 * por mes o por local. Los costos van en negativo (la columna se lee
 * sumando) y abajo de cada importe, su % sobre las ventas netas. Los grupos
 * de gastos se abren por rubro.
 *
 * `columnas`: [{ key, titulo, sub, col }] — `col` es lo que arma `columna()`.
 */
export function TablaEstado({ datos, columnas, mesesOrigen, abiertos, alternar }) {
  const filas = renglones(columnas.map((c) => c.col), datos?.rubros ?? [], abiertos);
  const retiros = columnas.map((c) => c.col.retiros);
  const hayRetiros = retiros.some((v) => Math.abs(v) > 0.004);
  const celda = { padding: '6px 10px', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'top' };
  const primera = {
    padding: '6px 10px', position: 'sticky', left: 0, zIndex: 1, background: 'var(--crm-color-surface, #fff)',
    minWidth: 220, maxWidth: 320,
  };
  return (
    <div className={cx(s.card, s.tableCard, s.tblScroll)}>
      <table className={s.table} style={{ minWidth: 360 + columnas.length * 130 }}>
        <thead>
          <tr>
            <th style={{ ...primera, zIndex: 2 }}>Concepto</th>
            {columnas.map((c) => (
              <th key={c.key} style={{ ...celda, textAlign: 'right' }}>
                <div>{c.titulo}</div>
                {c.sub && <div className={s.hint} style={{ margin: 0, fontWeight: 400 }}>{c.sub}</div>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => {
            const origen = f.origen ? textoOrigen(origenDe(datos, mesesOrigen, f.origen), f.origen) : '';
            const fuerte = f.sub ? { fontWeight: 700, borderTop: '2px solid var(--crm-color-border)' } : {};
            const fondo = f.final ? { background: 'var(--crm-color-primary-soft, rgba(22,101,52,0.08))' } : {};
            return (
              <tr key={f.id} style={{ ...fuerte, ...fondo }}>
                <td style={{ ...primera, ...fondo, ...(f.detalle ? { paddingLeft: 30, color: 'var(--crm-color-text-secondary)' } : {}) }}>
                  {f.abrible ? (
                    <button
                      type="button" onClick={() => alternar(f.id)} aria-expanded={f.abierto}
                      style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit', textAlign: 'left' }}
                    >
                      {f.abierto ? '▾' : '▸'} {f.texto}
                    </button>
                  ) : f.texto}
                  {origen && <div className={s.hint} style={{ margin: 0, fontWeight: 400 }}>{origen}</div>}
                </td>
                {f.valores.map((v, i) => {
                  const p = sobreVentas(v, columnas[i].col);
                  return (
                    <td key={columnas[i].key} style={{ ...celda, color: v < -0.004 && !f.sub ? 'var(--crm-color-text)' : undefined }}>
                      <div style={{ fontVariantNumeric: 'tabular-nums', color: f.sub && v < -0.004 ? 'var(--crm-color-danger)' : undefined }}>{pesos(v)}</div>
                      {p != null && Math.abs(v) >= 0.005 && f.id !== 'ventasNetas' && f.id !== 'ventasLista' && (
                        <div className={s.hint} style={{ margin: 0, fontWeight: 400 }}>{pct(p)}</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {hayRetiros && (
            <tr>
              <td style={{ ...primera, color: 'var(--crm-color-text-secondary)' }}>
                Retiros de los socios
                <div className={s.hint} style={{ margin: 0 }}>Mercadería a costo · aparte: no es gasto del negocio</div>
              </td>
              {retiros.map((v, i) => (
                <td key={columnas[i].key} style={{ ...celda, color: 'var(--crm-color-text-secondary)' }}>{pesos(v)}</td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * LAS TARJETAS DE ARRIBA: ventas, márgenes, resultado, punto de equilibrio y
 * objetivo. `col` es la columna principal; `contra`, la de comparación.
 */
export function TarjetasEstado({ col, contra, contraTxt, objetivo, esEmpresa }) {
  const ind = indicadores(col);
  const resultado = esEmpresa ? col.neto : col.antesGanancias;
  const resultadoContra = contra ? (esEmpresa ? contra.neto : contra.antesGanancias) : null;
  const cumpleVenta = cumplimiento(col.ventasNetas, objetivo?.ventaNeta);
  const cumpleRes = cumplimiento(col.antesGanancias, objetivo?.resultado);
  return (
    <Tiles>
      <Tile
        label="Ventas netas" valor={pesosRedondo(col.ventasNetas)}
        variacion={contra ? variacion(col.ventasNetas, contra.ventasNetas) : null} contra={contraTxt}
        detalle={cumpleVenta != null ? `${pct(cumpleVenta, 0)} del objetivo (${pesosRedondo(objetivo.ventaNeta)})` : undefined}
      />
      <Tile
        label="Margen bruto" valor={pct(ind.margenBrutoPct)}
        detalle={`${pesosRedondo(col.margenBruto)} después del costo de la mercadería`}
      />
      <Tile
        label="Contribución marginal" valor={pct(ind.contribucionPct)}
        detalle={`${pesosRedondo(col.contribucion)} para cubrir los gastos fijos`}
      />
      <Tile
        label={esEmpresa ? 'Resultado neto' : 'Resultado antes de Ganancias'} valor={pesosRedondo(resultado)} alerta={resultado < 0}
        variacion={contra ? variacion(resultado, resultadoContra) : null} contra={contraTxt}
        detalle={objetivo?.resultado == null ? undefined
          : col.antesGanancias >= 0 && cumpleRes != null
            ? `Antes de Ganancias: ${pct(cumpleRes, 0)} del objetivo (${pesosRedondo(objetivo.resultado)})`
            : `Objetivo antes de Ganancias ${pesosRedondo(objetivo.resultado)}: faltan ${pesosRedondo(objetivo.resultado - col.antesGanancias)}`}
      />
      <Tile
        label="Punto de equilibrio"
        valor={ind.sinEquilibrio ? 'No se alcanza' : ind.equilibrio == null ? '—' : pesosRedondo(ind.equilibrio)}
        alerta={ind.sinEquilibrio || (ind.margenSeguridadPct != null && ind.margenSeguridadPct < 0)}
        detalle={ind.sinEquilibrio
          ? 'La contribución no es positiva: vender más no cubre los fijos.'
          : ind.margenSeguridadPct == null ? 'Las ventas que cubren los gastos fijos.'
            : ind.margenSeguridadPct >= 0
              ? `Se vende ${pct(ind.margenSeguridadPct, 0)} por encima: ese es el margen de seguridad.`
              : `Hoy se vende ${pesosRedondo(col.ventasNetas)}: faltan ${pesosRedondo(ind.equilibrio - col.ventasNetas)} para cubrir los fijos.`}
      />
      <Tile label="Gastos fijos sobre ventas" valor={pct(ind.fijosPct)} detalle={`${pesosRedondo(col.totalFijos)} de sueldos, fijos y amortizaciones`} />
    </Tiles>
  );
}

