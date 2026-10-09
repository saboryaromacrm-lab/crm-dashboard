import { cx } from '@shared/utils/classNames.js';
import { s } from '@modules/productos/components/ui.jsx';
import { Aviso, Bloque, Tile, Tiles } from '../metricas/piezas.jsx';
import { columna, nombreMes, pesos, pesosRedondo } from './resultados.js';

/**
 * EL IVA, COMO UN RESULTADO APARTE (decisión del dueño, 9/10/2026). El estado
 * de resultados va todo en neto; acá se ve qué pasó con el IVA, con dos vistas:
 *
 *   DECLARADO   débito (lo facturado) − crédito (compras y gastos A) −
 *               percepciones = la posición del mes; con el saldo a favor que
 *               viene arrastrado, lo que toca pagar a ARCA. Misma cuenta que
 *               Métricas › Resultados IVA.
 *   DE GESTIÓN  el IVA de lo vendido SIN factura: se cobró dentro del precio y
 *               no se le paga a nadie, así que queda en la casa. Sumado al
 *               resultado neto da lo que de verdad dejó el negocio.
 */
export function IvaAparte({ datos, meses }) {
  const filas = (datos?.meses ?? []).filter((m) => meses.includes(m.mes));
  const suma = (k) => filas.reduce((a, m) => a + (m.iva?.[k] ?? 0), 0);
  const ultimo = filas[filas.length - 1]?.iva;
  const empresa = columna(datos, meses, null);
  const gestion = suma('sinFactura');
  const td = { padding: '6px 10px', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Tiles>
        <Tile label="A pagar a ARCA (declarado)" valor={pesosRedondo(suma('aPagar'))} detalle="Lo que toca pagar en el período, con el saldo a favor descontado." />
        <Tile label="Saldo a favor al cierre" valor={pesosRedondo(ultimo?.saldoAFavor ?? 0)} detalle="Crédito que pasa al mes siguiente." />
        <Tile label="IVA de gestión" valor={pesosRedondo(gestion)} detalle="El IVA de lo vendido sin factura: se cobró y queda en la casa." />
        <Tile
          label="Resultado neto + IVA de gestión" valor={pesosRedondo(empresa.neto + gestion)} alerta={empresa.neto + gestion < 0}
          detalle={`Resultado neto ${pesosRedondo(empresa.neto)} + IVA de gestión ${pesosRedondo(gestion)}.`}
        />
      </Tiles>
      <Bloque titulo="Mes a mes" sub="El IVA se declara por mes completo y por CUIT: con todos los locales juntos.">
        <div className={cx(s.tblScroll)}>
          <table className={s.table} style={{ minWidth: 980 }}>
            <thead>
              <tr>
                <th>Mes</th>
                <th style={td}>Débito</th><th style={td}>Crédito</th><th style={td}>Percepciones</th>
                <th style={td}>Posición del mes</th><th style={td}>Saldo a favor que venía</th>
                <th style={td}>A pagar</th><th style={td}>Saldo a favor que queda</th>
                <th style={td}>IVA de gestión</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((m) => (
                <tr key={m.mes}>
                  <td>{nombreMes(m.mes)}</td>
                  <td style={td}>{pesos(m.iva.debito)}</td>
                  <td style={td}>{pesos(-m.iva.credito)}</td>
                  <td style={td}>{pesos(-m.iva.percepciones)}</td>
                  <td style={td}>{pesos(m.iva.posicion)}</td>
                  <td style={td}>{pesos(-m.iva.saldoAnterior)}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{pesos(m.iva.aPagar)}</td>
                  <td style={td}>{pesos(m.iva.saldoAFavor)}</td>
                  <td style={td}>{pesos(m.iva.sinFactura)}</td>
                </tr>
              ))}
              {filas.length > 1 && (
                <tr style={{ fontWeight: 700, borderTop: '2px solid var(--crm-color-border)' }}>
                  <td>Total</td>
                  <td style={td}>{pesos(suma('debito'))}</td>
                  <td style={td}>{pesos(-suma('credito'))}</td>
                  <td style={td}>{pesos(-suma('percepciones'))}</td>
                  <td style={td}>{pesos(suma('posicion'))}</td>
                  <td style={td} />
                  <td style={td}>{pesos(suma('aPagar'))}</td>
                  <td style={td}>{pesos(ultimo?.saldoAFavor ?? 0)}</td>
                  <td style={td}>{pesos(gestion)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Bloque>
      <Aviso>
        <strong>Declarado:</strong> débito de lo facturado − crédito de las compras y gastos con factura A − percepciones de IVA, con el saldo
        a favor arrastrado (cargá el saldo inicial en Métricas › Resultados IVA). Es una cuenta de gestión: la declaración la hace la contadora.
        {' '}<strong>De gestión:</strong> en lo vendido sin factura el precio ya trae el IVA, pero no se le paga a nadie: esa plata queda en la casa
        y por eso el estado de resultados (en neto) no la muestra.
      </Aviso>
    </div>
  );
}
