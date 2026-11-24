import { BuscadorOpcion } from '@shared/components/BuscadorOpcion.jsx';
import { TIPOS_COMPROBANTE } from '@modules/productos/domain/constants.js';
import { useResource } from '../../hooks/useResource.js';
import { gastosApi } from '../../services/gastos.api.js';
import { OTRA_COSA, UNIDADES_FLETE, conceptoDeFila, etiquetaPapel } from '../../domain/fletes.js';
import { Btn, money, fmtFecha, s } from '../ui.jsx';

const OPCION_OTRA = [{ id: OTRA_COSA, nombre: 'Otra cosa (no es de un proveedor)' }];

/**
 * UN RENGLÓN DE LA FACTURA DE UN TRANSPORTE (0244): de quién trajo, cuánto y de qué
 * factura o remito suyo. El papel del proveedor muchas veces llega después: entonces
 * se deja el número (si se sabe) y se vincula solo al cargarlo en Compras.
 *
 * `soloOrigen` es la corrección desde el detalle del gasto: el importe y la cantidad
 * ya están (puede tener pagos), solo se cambia de dónde vino.
 */
export function FleteRenglon({
  n, fila, cambiar, quitar, proveedores, nombreDe, ivaAparte, disabled = false, soloOrigen = false,
}) {
  const provId = fila.fleteOrigen === 'proveedor' ? Number(fila.fleteProveedorId) || 0 : 0;
  const { data: papeles, loading } = useResource(
    `papeles-flete:${provId}`,
    () => gastosApi.papelesParaFlete(provId),
    { enabled: !!provId },
  );
  const lista = papeles ?? [];
  const vinculadoFuera = fila.fleteComprobanteId && !lista.some((p) => String(p.id) === fila.fleteComprobanteId);

  const elegirOrigen = (v) => cambiar(v === OTRA_COSA
    ? { fleteOrigen: OTRA_COSA, fleteProveedorId: '', fleteComprobanteId: '', fleteReferencia: '' }
    : { fleteOrigen: v ? 'proveedor' : '', fleteProveedorId: v, fleteComprobanteId: '', fleteReferencia: '' });
  const valor = (k) => (e) => cambiar({ [k]: e.target.value });

  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid var(--crm-color-border)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <BuscadorOpcion
          opciones={proveedores}
          extras={OPCION_OTRA}
          value={fila.fleteOrigen === OTRA_COSA ? OTRA_COSA : fila.fleteProveedorId}
          onChange={elegirOrigen}
          todos="¿De quién trajo?"
          placeholder="Escribí el proveedor…"
          ariaLabel="De quién trajo"
          disabled={disabled}
          style={{ flex: '1 1 240px', minWidth: 0 }}
        />
        {soloOrigen ? (
          <span className={s.num} style={{ minWidth: 110 }}><strong>{money(fila.monto)}</strong></span>
        ) : (
          <>
            <input
              type="number" min="0" step="any" value={fila.cantidad} placeholder="Cant." aria-label="Cantidad"
              onChange={valor('cantidad')} disabled={disabled} style={{ width: 72, textAlign: 'right' }}
            />
            {fila.fleteOrigen === 'proveedor' && (
              <select value={fila.unidad} onChange={valor('unidad')} disabled={disabled} aria-label="Unidad" style={{ width: 96 }}>
                {Object.entries(UNIDADES_FLETE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            )}
            <input
              type="number" min="0" step="0.01" value={fila.monto} placeholder={ivaAparte ? 'Sin IVA' : 'Monto'} aria-label="Monto"
              onChange={valor('monto')} disabled={disabled} style={{ width: 130, textAlign: 'right' }}
            />
            {quitar && !disabled && <Btn small onClick={quitar}>×</Btn>}
          </>
        )}
      </div>

      {fila.fleteOrigen === 'proveedor' && provId > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 6 }}>
          <label className={s.hint} style={{ margin: 0 }} htmlFor={`flete-papel-${n}`}>Su factura o remito</label>
          <select
            id={`flete-papel-${n}`}
            value={fila.fleteComprobanteId}
            onChange={valor('fleteComprobanteId')}
            disabled={disabled}
            style={{ flex: '1 1 280px', minWidth: 0 }}
          >
            <option value="">{loading ? 'Buscando sus papeles…' : 'Todavía no está cargado'}</option>
            {vinculadoFuera && <option value={fila.fleteComprobanteId}>El vinculado (más de 6 meses)</option>}
            {lista.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {etiquetaPapel(p, TIPOS_COMPROBANTE)} · {fmtFecha(p.fecha)} · neto {money(p.neto)}{p.fletes && String(p.id) !== fila.fleteComprobanteId ? ' · ya tiene flete' : ''}
              </option>
            ))}
          </select>
          {!fila.fleteComprobanteId && (
            <input
              value={fila.fleteReferencia} onChange={valor('fleteReferencia')} disabled={disabled} maxLength={40}
              placeholder="Número, si lo sabés (0003-00001234)" aria-label="Número de la factura o el remito del proveedor"
              style={{ flex: '0 1 240px', minWidth: 0 }}
            />
          )}
        </div>
      )}
      {fila.fleteOrigen === 'proveedor' && provId > 0 && !fila.fleteComprobanteId && (
        <div className={s.hint} style={{ margin: '4px 0 0' }}>
          Cuando se cargue su factura o remito en Compras, este flete aparece para vincularlo
          {fila.fleteReferencia ? ' (y con este número se ofrece ya tildado)' : ''}.
        </div>
      )}

      {fila.fleteOrigen === OTRA_COSA && !soloOrigen && (
        <input
          value={fila.concepto} onChange={valor('concepto')} disabled={disabled} maxLength={200}
          placeholder="¿Qué fue? Ej: envío de Fontana a Express 2" aria-label="Qué fue"
          style={{ width: '100%', marginTop: 6 }}
        />
      )}
      {(soloOrigen || fila.fleteOrigen === 'proveedor') && (
        <div className={s.hint} style={{ margin: '4px 0 0' }}>
          {soloOrigen ? fila.concepto : <>Queda como: <strong>{conceptoDeFila(fila, nombreDe)}</strong></>}
        </div>
      )}
    </div>
  );
}
