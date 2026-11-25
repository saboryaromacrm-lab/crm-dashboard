/**
 * LA TRANSFERENCIA QUE FUE DIRECTO A UN PROVEEDOR (0246, 25/11/2026, pedido
 * del dueño: «me mandó ese pago a otro proveedor y quiero poder aplicárselo,
 * eligiendo una factura o remito, o como plata libre»).
 * ============================================================================
 * El cliente le transfirió a un proveedor que NO tenía cuenta disponible y la
 * caja lo cargó como «Transferencia»: esa plata nunca entra a Mercado Pago.
 * Desde la Conciliación MP o el detalle de la venta, el superadmin dice a qué
 * proveedor fue y, si quiere, a qué documentos se aplica:
 *
 *   · el importe es el del renglón: no se elige ni se parte;
 *   · se ofrece lo mismo que en «Pagarle» (facturas, liquidaciones, ND,
 *     gastos), sin lo que ya cubre la plata a favor del proveedor;
 *   · se reparte con la regla de «Aplicar a facturas» (`planTransferencia`):
 *     cada documento por su saldo entero, el último con lo que quede; lo que
 *     sobra queda a cuenta;
 *   · segunda confirmación, motivo obligatorio y auditoría.
 *
 * `DeshacerTransferenciaDirecta`: «No fue a este proveedor» desde el detalle
 * de la venta. El renglón vuelve a «Transferencia» y se anula el pago.
 */
import { useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { BuscadorOpcion } from '@shared/components/BuscadorOpcion.jsx';
import { AvisoSegundaConfirmacion, textoBoton, useSegundaConfirmacion } from '@modules/gastos/components/segundaConfirmacion.jsx';
import { cubiertoALaCuenta } from '@modules/proveedores/domain/pagosSinAplicar.js';
import { EcheqsDeFactura, FilaTilde, cajaTildes, echeqsDeFactura } from '@modules/proveedores/components/ui.jsx';
import { useVentas } from '../../context/VentasContext.jsx';
import { useResource } from '../../hooks/useResource.js';
import { ventasApi, errorMsg } from '../../services/ventas.api.js';
import { planTransferencia } from '../../domain/transferenciaDirecta.js';
import { Btn, ModalShell, fmtFecha, money, s } from '../ui.jsx';

/** Llave fuera del catálogo: solo el superadmin (`*`). La misma que exige la API. */
export const PERMISO_CORREGIR_TRANSFERENCIA = 'ventas.corregir-transferencia';

const EPS = 0.009;
const clave = (d) => `${d.tipo}-${d.docId}`;
const masNuevaPrimero = (a, b) => new Date(b.fecha) - new Date(a.fecha);

/** `pago`: el renglón «Transferencia» de la venta (`id`, `importe`). */
export function TransferenciaAProveedor({ pago, onHecho, onCancelar }) {
  const { toast } = useVentas();
  const importe = Number(pago.importe) || 0;
  const { data: padron, loading: cargandoPadron } = useResource('proveedores-padron', () => ventasApi.proveedoresPadron());
  const opciones = useMemo(() => (padron ?? []).map((p) => ({ id: p.id, nombre: p.nombre })), [padron]);
  const [proveedorId, setProveedorId] = useState('');
  const prov = (padron ?? []).find((p) => String(p.id) === proveedorId) ?? null;
  const { data: cuenta, loading, error: errorCuenta } = useResource(
    `transferencia-directa:${proveedorId}`,
    () => Promise.all([ventasApi.pendientesProveedor(proveedorId), ventasApi.cuentaProveedor(proveedorId)]),
    { enabled: !!proveedorId },
  );
  /* Mientras cargan los de otro proveedor no se muestran los del anterior: se tildarían documentos ajenos. */
  const [todos, saldo] = loading || !cuenta ? [[], null] : [cuenta[0], cuenta[1]?.saldo ?? null];
  const aFavor = useMemo(() => cubiertoALaCuenta(todos, saldo, clave), [todos, saldo]);
  const docs = useMemo(
    () => todos.filter((d) => (aFavor.porDoc.get(clave(d)) ?? 0) < d.saldo - EPS).sort(masNuevaPrimero),
    [todos, aFavor],
  );
  const ocultos = todos.length - docs.length;
  const [tildados, setTildados] = useState(() => new Set());
  const elegidos = docs.filter((d) => tildados.has(clave(d)));
  const plan = planTransferencia(importe, elegidos);
  const aplicaA = new Map(plan.lineas.map((l) => [clave(l.doc), l.importe]));
  const conEcheqHecho = elegidos.filter((d) => echeqsDeFactura(d).hechos.length);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');

  const elegirProveedor = (id) => { setProveedorId(id); setTildados(new Set()); };
  const alternar = (d) => setTildados((xs) => {
    const ys = new Set(xs);
    if (!ys.delete(clave(d))) ys.add(clave(d));
    return ys;
  });

  const sc = useSegundaConfirmacion(`${proveedorId}|${[...tildados].join(',')}|${motivo}`);
  const confirmar = () => sc.clic(
    () => {
      setError('');
      if (!prov) { setError('Elegí a qué proveedor fue la transferencia.'); return false; }
      if (plan.mezcla) { setError('Un pago va a facturas de mercadería o a gastos, no a los dos: destildá unos u otros.'); return false; }
      if (plan.sinAlcanzar.length) {
        setError(`La transferencia no alcanza para ${plan.sinAlcanzar.map((d) => d.etiqueta).join(', ')}: destildala.`);
        return false;
      }
      if (motivo.trim().length < 10) { setError('Escribí el motivo: qué pasó y cómo lo sabés.'); return false; }
      return true;
    },
    async () => {
      try {
        const r = await ventasApi.transferenciaDirecta({
          ventaPagoId: pago.id, proveedorId: prov.id, imputaciones: plan.imputaciones, motivo: motivo.trim(), confirmado: true,
        });
        toast(`Listo: ${money(importe)} quedaron pagados a ${r.proveedor}${r.aCuenta > EPS ? ` (${money(r.aCuenta)} a cuenta)` : ''}.`, 'ok');
        onHecho();
      } catch (e) { setError(errorMsg(e)); }
    },
  );

  const libre = prov?.modoCuenta === 'libre';
  return (
    <div className={cx(s.callout, s.info)} style={{ display: 'grid', gap: 10, marginTop: 'var(--crm-space-2)' }}>
      <strong>La transferencia de {money(importe)} fue directo a un proveedor</strong>
      <span className={s.hint} style={{ margin: 0 }}>
        Para cuando el cliente le transfirió a un proveedor sin cuenta disponible y se cargó como «Transferencia»: esa plata
        nunca entra a tu Mercado Pago. El renglón pasa a «Transf. a proveedor» y el proveedor la tiene pagada con la fecha
        de la venta. No toca tu caja ni tus cuentas. Queda firmado por vos, con el motivo, en la auditoría; si te equivocás
        de proveedor, se deshace desde el detalle de la venta.
      </span>

      <div className={s.field}>
        <label htmlFor="transf-directa-prov">¿A qué proveedor fue? <span className={s.req}>*</span></label>
        <BuscadorOpcion
          id="transf-directa-prov" opciones={opciones} value={proveedorId} onChange={elegirProveedor}
          todos="Elegí el proveedor…" placeholder={cargandoPadron ? 'Cargando proveedores…' : 'Escribí para buscar…'}
        />
      </div>

      {prov && (
        <div className={s.field}>
          <label>¿A qué se aplica?</label>
          {errorCuenta && <div className={cx(s.callout, s.warn)} style={{ margin: 0 }}>No se pudo traer su cuenta: {errorCuenta}</div>}
          {loading ? <div className={s.hint} style={{ margin: 0 }}>Buscando lo que se le debe…</div> : !errorCuenta && (
            <>
              <div className={s.hint} style={{ margin: '0 0 6px' }}>
                {libre ? 'Cuenta libre' : 'Cuenta por facturas'} ·{' '}
                {saldo > EPS ? <>se le deben <strong>{money(saldo)}</strong></> : saldo < -EPS ? <>tiene <strong>{money(-saldo)}</strong> a favor nuestro</> : 'no se le debe nada'}.
                {' '}Tildá las facturas o remitos que paga; sin tildar nada, queda a cuenta.
                {aFavor.total > EPS && ocultos > 0 && <> {ocultos === 1 ? 'Una ya la cubre' : `${ocultos} ya las cubre`} la plata a favor que tiene sin aplicar: no se {ocultos === 1 ? 'ofrece' : 'ofrecen'}.</>}
              </div>
              {docs.length ? (
                <div style={{ ...cajaTildes(220), background: 'var(--crm-color-surface)' }}>
                  {docs.map((d) => {
                    const marcado = tildados.has(clave(d));
                    const va = aplicaA.get(clave(d));
                    return (
                      <FilaTilde key={clave(d)} marcado={marcado} onClick={() => alternar(d)} valor={money(d.saldo)}>
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: marcado ? 600 : 400 }}>{d.etiqueta}</span>
                          <span style={{ opacity: 0.65 }}>{' · '}{fmtFecha(d.fecha)}</span>
                        </span>
                        <EcheqsDeFactura d={d} />
                        {marcado && va != null && va < d.saldo - EPS && (
                          <span className={s.hint} style={{ display: 'block', margin: 0 }}>
                            Se aplican {money(va)}: queda debiendo {money(d.saldo - va)}.
                          </span>
                        )}
                        {marcado && va == null && (
                          <span style={{ display: 'block', fontSize: 12, color: 'var(--crm-color-danger)' }}>No le llega nada: destildala.</span>
                        )}
                      </FilaTilde>
                    );
                  })}
                </div>
              ) : (
                <div className={s.hint} style={{ margin: 0 }}>No tiene facturas ni gastos impagos: queda a cuenta.</div>
              )}
              <div>
                {plan.lineas.length > 0 && <>Se aplican <strong>{money(importe - plan.aCuenta)}</strong> a {plan.lineas.length} documento(s). </>}
                {plan.aCuenta > EPS && (
                  <>
                    Quedan <strong>{money(plan.aCuenta)}</strong> a cuenta
                    {libre ? ': es cuenta libre, va sola a lo más viejo que se le debe.' : ': plata libre del proveedor, se aplica después desde su estado de cuenta.'}
                  </>
                )}
              </div>
              {plan.mezcla && (
                <div className={cx(s.callout, s.warn)} style={{ margin: 0 }}>
                  Tildaste una <strong>factura de mercadería</strong> y un <strong>gasto</strong>: un pago vive en una sola bandeja. Destildá unos u otros.
                </div>
              )}
              {conEcheqHecho.length > 0 && (
                <div className={cx(s.callout, s.warn)} style={{ margin: 0 }}>
                  <strong>Ojo, pagarías dos veces:</strong> {conEcheqHecho.map((d) => d.etiqueta).join(', ')} ya {conEcheqHecho.length === 1 ? 'la cubre' : 'las cubre'} un
                  echeq hecho. Cuando el banco lo debite, esa plata queda a cuenta del proveedor.
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className={s.field}>
        <label htmlFor="transf-directa-motivo">Motivo <span className={s.req}>*</span></label>
        <input
          id="transf-directa-motivo" value={motivo} maxLength={300}
          placeholder="Ej: el cliente le transfirió a Aldana; me mandó el comprobante por WhatsApp"
          onChange={(e) => setMotivo(e.target.value)}
        />
      </div>
      <AvisoSegundaConfirmacion {...sc}>
        Los {money(importe)} pasan a «Transf. a proveedor» y quedan pagados a <strong>{prov?.nombre ?? '—'}</strong>
        {plan.lineas.length ? <>, aplicados a {plan.lineas.map((l) => l.doc.etiqueta).join(', ')}</> : null}
        {plan.aCuenta > EPS ? <>{plan.lineas.length ? ' y' : ','} {money(plan.aCuenta)} a cuenta</> : null}.
      </AvisoSegundaConfirmacion>
      {error && <div className={cx(s.callout, s.warn)} style={{ margin: 0 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn small onClick={onCancelar}>Cancelar</Btn>
        <Btn small variant="btn-primary" onClick={confirmar} disabled={loading}>{textoBoton(sc, 'Registrar', 'Sí, registrar')}</Btn>
      </div>
    </div>
  );
}

/** Desde la Conciliación MP: la misma pieza, en su ventana. `documento`: «Factura B 00034-00002430». */
export function TransferenciaAProveedorModal({ pago, documento, onListo }) {
  const { closeModal } = useVentas();
  return (
    <ModalShell title={`${documento}: fue a un proveedor`} subtitle="La transferencia del cliente no entró a tu Mercado Pago" wide onClose={closeModal}>
      <TransferenciaAProveedor pago={pago} onCancelar={closeModal} onHecho={() => { closeModal(); onListo?.(); }} />
    </ModalShell>
  );
}

/** «No fue a este proveedor»: el renglón vuelve a «Transferencia» y se anula su pago. `pago.directoA`: a quién fue. */
export function DeshacerTransferenciaDirecta({ pago, onHecho, onCancelar }) {
  const { toast } = useVentas();
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const sc = useSegundaConfirmacion(motivo);
  const deshacer = () => sc.clic(
    () => {
      setError('');
      if (motivo.trim().length < 10) { setError('Escribí el motivo: qué pasó y cómo lo sabés.'); return false; }
      return true;
    },
    async () => {
      try {
        await ventasApi.deshacerTransferenciaDirecta({ ventaPagoId: pago.id, motivo: motivo.trim(), confirmado: true });
        toast(`Listo: se anuló el pago a ${pago.directoA} y el renglón volvió a «Transferencia».`, 'ok');
        onHecho();
      } catch (e) { setError(errorMsg(e)); }
    },
  );
  return (
    <div className={cx(s.callout, s.warn)} style={{ display: 'grid', gap: 10, marginTop: 'var(--crm-space-2)' }}>
      <strong>La transferencia de {money(pago.importe)} no fue a {pago.directoA}</strong>
      <span className={s.hint} style={{ margin: 0 }}>
        Se anula el pago a {pago.directoA} y el renglón vuelve a «Transferencia»: se vuelve a esperar en la Conciliación MP.
        Si ese pago ya está aplicado a una factura, primero desaplicalo en Proveedores (en cuenta libre se desaplica solo).
      </span>
      <div className={s.field}>
        <label htmlFor="deshacer-directa-motivo">Motivo <span className={s.req}>*</span></label>
        <input
          id="deshacer-directa-motivo" value={motivo} maxLength={300}
          placeholder="Ej: me equivoqué de proveedor, fue a Bracema"
          onChange={(e) => setMotivo(e.target.value)}
        />
      </div>
      <AvisoSegundaConfirmacion {...sc}>Se anula el pago de {money(pago.importe)} a {pago.directoA}.</AvisoSegundaConfirmacion>
      {error && <div className={cx(s.callout, s.warn)} style={{ margin: 0 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn small onClick={onCancelar}>Cancelar</Btn>
        <Btn small variant="btn-delete" onClick={deshacer}>{textoBoton(sc, 'Deshacer', 'Sí, deshacer')}</Btn>
      </div>
    </div>
  );
}
