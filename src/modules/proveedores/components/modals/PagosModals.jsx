import { useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProveedores } from '../../context/ProveedoresContext.jsx';
import { useResource } from '../../hooks/useResource.js';
import { provApi, MEDIOS_PAGO_REAL } from '../../services/proveedores.api.js';
import { Btn, ModalShell, money, fmtFecha, s } from '../ui.jsx';

const hoyISO = () => {
  const d = new Date(); const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const EPS = 0.009;
const claveDoc = (d) => `${d.tipo}-${d.docId}`;

/**
 * PAGARLE AL PROVEEDOR, desde su estado de cuenta.
 * ============================================================================
 * Es el pago de siempre del sistema (`/pagos-proveedor`): el mismo candado de
 * caja, el mismo arqueo, el mismo puente que cierra compromisos. Lo que agrega
 * esta pantalla es elegir CONTRA QUÉ se paga sin salir de la cuenta.
 *
 * La regla del importe, a propósito rígida: si se tildan documentos, el importe
 * es la SUMA EXACTA de sus saldos y no se edita. Así el pago siempre pasa el
 * candado del modo "por facturas" (saldo completo o cuota pactada) y nunca
 * puede sobrepasar lo que el documento debe. Para entregar una cifra suelta
 * —una entrega a cuenta— no se tilda nada: el pago baja el saldo del proveedor
 * y se imputa después desde la factura.
 *
 * Y ACÁ SE DESCUENTAN LOS FLETES (0069, 18/8). La factura de mercadería se
 * cargó tal cual dice el papel; el flete que la cajera le adelantó al fletero
 * por cuenta del proveedor se resta en ESTE momento, que es cuando se decide
 * cuánto transferir. Tildás la factura de $100.000 y el flete de $20.000, y lo
 * que sale de la cuenta son $80.000 — la factura igual queda saldada, porque
 * el flete se imputa contra ella en el mismo acto (y primero, para que el pago
 * caiga por el saldo exacto que queda).
 */
export function PagoProveedorModal({ proveedor, docs = [], preseleccion = [], onChange }) {
  const { ctx, act, closeModal, toast } = useProveedores();
  const [tildados, setTildados] = useState(
    () => Object.fromEntries((preseleccion ?? []).map((k) => [k, true])),
  );
  const [fletesTildados, setFletesTildados] = useState({});
  const [importeLibre, setImporteLibre] = useState('');
  const [modo, setModo] = useState('simple');
  const [medio, setMedio] = useState('transferencia');
  const [formas, setFormas] = useState([{ medio: 'transferencia', importe: '', fecha: '' }]);
  const [fecha, setFecha] = useState(hoyISO());
  const [concepto, setConcepto] = useState('');
  const [referencia, setReferencia] = useState('');
  const [desdeCaja, setDesdeCaja] = useState(true);

  const { data: caja } = useResource(
    `caja-prov:${ctx.sucursalId}`,
    () => provApi.cajaActual(ctx.sucursalId),
    { enabled: !!ctx.sucursalId },
  );
  const hayTurno = !!caja?.id && caja.estado === 'abierta';

  /* Los fletes que este proveedor todavía no descontó. Se piden siempre: si no
   * tiene, la sección no se dibuja y nadie se entera de que existe. */
  const { data: fletesData } = useResource(
    `fletes-prov:${proveedor.id}`,
    () => provApi.fletesPendientes(proveedor.id),
  );
  const fletes = useMemo(
    () => (fletesData ?? []).filter((f) => f.saldo > EPS)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha) || a.id - b.id),
    [fletesData],
  );

  const elegidos = useMemo(() => docs.filter((d) => tildados[claveDoc(d)]), [docs, tildados]);
  const sumaElegidos = r2(elegidos.reduce((a, d) => a + d.saldo, 0));
  const fletesElegidos = useMemo(() => fletes.filter((f) => fletesTildados[f.id]), [fletes, fletesTildados]);
  const sumaFletes = r2(fletesElegidos.reduce((a, f) => a + f.saldo, 0));

  /*
   * EL REPARTO DE LOS FLETES entre los documentos tildados, del más viejo al
   * más nuevo hasta cubrir cada uno. Se calcula acá y viaja explícito: dejar
   * que el servidor "adivine" contra qué documento va cada flete sería la clase
   * de decisión silenciosa que después nadie puede explicar mirando el mayor.
   */
  const repartoFletes = useMemo(() => {
    const restante = new Map(elegidos.map((d) => [claveDoc(d), d.saldo]));
    const out = [];
    for (const f of fletesElegidos) {
      let falta = f.saldo;
      for (const d of elegidos) {
        if (falta <= EPS) break;
        const queda = restante.get(claveDoc(d)) ?? 0;
        if (queda <= EPS) continue;
        const toma = r2(Math.min(falta, queda));
        out.push({
          pagoId: f.id,
          ...(d.tipo === 'gasto' ? { gastoId: d.docId } : { comprobanteId: d.docId }),
          importe: toma,
        });
        restante.set(claveDoc(d), r2(queda - toma));
        falta = r2(falta - toma);
      }
    }
    return { lineas: out, restantePorDoc: restante };
  }, [elegidos, fletesElegidos]);

  /** Lo que de verdad sale de la cuenta: lo tildado menos los fletes ya pagados. */
  const importe = elegidos.length ? r2(sumaElegidos - sumaFletes) : r2(importeLibre);
  /* Los fletes no pueden superar lo tildado: sobraría flete sin documento
   * contra el cual imputarse y el pago quedaría en cero o negativo. */
  const fleteExcedido = elegidos.length > 0 && sumaFletes - sumaElegidos > EPS;
  /* Un pago vive en UNA bandeja (mercadería o gastos) y solo se aplica a
   * documentos de esa bandeja: mezclar los dos termina en un rechazo de la API
   * a mitad de camino, así que se corta acá con una explicación. */
  const mezcla = elegidos.some((d) => d.tipo === 'gasto') && elegidos.some((d) => d.tipo !== 'gasto');
  const destino = elegidos.length && elegidos[0].tipo === 'gasto' ? 'gastos' : 'mercaderia';

  const usaEfectivo = modo === 'simple'
    ? medio === 'efectivo'
    : formas.some((x) => x.medio === 'efectivo' && Number(x.importe) > 0);
  const sumaFormas = r2(formas.reduce((a, x) => a + (Number(x.importe) || 0), 0));
  const setForma = (i, k) => (e) => setFormas((xs) => xs.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)));
  const alternar = (d) => setTildados((m) => {
    const k = claveDoc(d);
    return { ...m, [k]: !m[k] };
  });

  const pagar = async () => {
    if (mezcla) {
      toast('Un pago va a facturas de mercadería O a gastos, no a los dos: son bandejas distintas. Hacé un pago para cada uno.', 'err');
      return;
    }
    if (fleteExcedido) {
      toast('Los fletes tildados superan lo que se está pagando: destildá alguno o sumá otra factura.', 'err');
      return;
    }
    /*
     * LOS FLETES SOLOS, sin plata nueva. Pasa cuando lo adelantado alcanza para
     * cubrir todo lo tildado (la factura es de $20.000 y el flete fue de
     * $20.000): no hay nada que transferir, pero la factura tiene que quedar
     * saldada igual. Va por su endpoint, que hace la misma transacción.
     */
    if (elegidos.length && importe <= EPS && repartoFletes.lineas.length) {
      const res = await act(
        provApi.descontarFletes({
          proveedorId: proveedor.id,
          fletes: repartoFletes.lineas,
          usuarioId: ctx.usuarioId ?? undefined,
        }),
        `Se descontó el flete: ${money(sumaFletes)} aplicados. No hubo plata que transferir.`,
      );
      if (res) onChange?.();
      return;
    }
    if (!(importe > 0)) {
      toast(elegidos.length ? 'Los documentos tildados no suman nada.' : 'Poné el importe del pago.', 'err');
      return;
    }
    const body = {
      proveedorId: proveedor.id,
      destino,
      importe,
      fecha,
      concepto: concepto.trim() || (elegidos.length ? elegidos.map((d) => d.etiqueta).join(' · ') : 'Pago a cuenta'),
      referencia: referencia.trim() || undefined,
      sucursalId: ctx.sucursalId ?? undefined,
      usuarioId: ctx.usuarioId ?? undefined,
      /* Lo que cubre el pago nuevo es lo que queda de cada documento DESPUÉS de
       * los fletes: si el flete ya tapó un renglón entero, ese renglón no entra
       * (imputar 0 sería un error de la API, y con razón). */
      imputaciones: elegidos.length
        ? elegidos
          .map((d) => ({ d, importe: r2(repartoFletes.restantePorDoc.get(claveDoc(d)) ?? d.saldo) }))
          .filter((x) => x.importe > EPS)
          .map(({ d, importe: imp }) => (d.tipo === 'gasto'
            ? { gastoId: d.docId, importe: imp }
            : { comprobanteId: d.docId, importe: imp }))
        : undefined,
      fletes: repartoFletes.lineas.length ? repartoFletes.lineas : undefined,
    };
    if (modo === 'simple') {
      body.medio = medio;
    } else {
      const filas = formas.filter((x) => Number(x.importe) > 0);
      if (!filas.length) { toast('Cargá al menos una parte del pago.', 'err'); return; }
      if (Math.abs(sumaFormas - importe) > EPS) {
        toast(`Las partes suman ${money(sumaFormas)} y el pago es de ${money(importe)}: tienen que coincidir.`, 'err');
        return;
      }
      body.formas = filas.map((x) => ({ medio: x.medio, importe: r2(x.importe), fecha: x.fecha || undefined }));
    }
    if (usaEfectivo && hayTurno && desdeCaja) body.cajaSesionId = caja.id;

    const res = await act(
      provApi.crearPago(body),
      elegidos.length
        ? `Pago registrado y aplicado a ${elegidos.length} documento(s).`
        : 'Pago registrado. Queda a cuenta: se aplica desde la factura.',
    );
    if (res) onChange?.();
  };

  return (
    <ModalShell
      title={`Pagarle a ${proveedor.nombre}`}
      subtitle={proveedor.modoCuenta === 'libre'
        ? 'Cuenta libre: se le puede entregar plata a cuenta sin atarla a una factura'
        : 'Cuenta por facturas: se pagan completas — tildá cuáles'}
      wide
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        {
          texto: elegidos.length && importe <= EPS && sumaFletes > EPS
            ? `Descontar ${money(sumaFletes)} de flete`
            : importe > 0 ? `Pagar ${money(importe)}` : 'Pagar',
          clase: 'btn-primary',
          onClick: pagar,
          disabled: mezcla || fleteExcedido,
        },
      ]}
    >
      <div className={s['section-title']}>¿Qué se le paga?</div>
      {docs.length ? (
        <>
          {/* Filas-botón, no checkboxes: el CSS global de formularios le pone
              ancho completo a todo `input` y un tilde nativo suelto se estira a
              240 px (misma trampa que la lista de Solicitar pedidos). */}
          <div
            style={{
              maxHeight: 210, overflowY: 'auto', overflowX: 'hidden',
              border: '1px solid var(--crm-color-border)', borderRadius: 8, marginBottom: 8,
            }}
          >
            {docs.map((d) => {
              const marcado = !!tildados[claveDoc(d)];
              return (
                <button
                  key={claveDoc(d)}
                  type="button"
                  onClick={() => alternar(d)}
                  style={{
                    all: 'unset', boxSizing: 'border-box', display: 'flex', alignItems: 'center',
                    gap: 10, width: '100%', padding: '7px 10px', cursor: 'pointer',
                    font: 'inherit', fontSize: 13, lineHeight: 1.3, textAlign: 'left',
                    borderBottom: '1px solid var(--crm-color-border)',
                    background: marcado ? 'var(--crm-color-primary-soft)' : 'transparent',
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 16, height: 16, flex: 'none', borderRadius: 4,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700,
                      border: marcado ? '1.5px solid var(--crm-color-primary)' : '1.5px solid var(--crm-color-border)',
                      background: marcado ? 'var(--crm-color-primary)' : 'transparent',
                      color: 'var(--crm-color-primary-contrast)',
                    }}
                  >
                    {marcado ? '✓' : ''}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: marcado ? 600 : 400 }}>{d.etiqueta}</span>
                    <span style={{ opacity: 0.65 }}>{' · '}{fmtFecha(d.fecha)}</span>
                  </span>
                  <span style={{ flex: 'none', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                    {money(d.saldo)}
                  </span>
                </button>
              );
            })}
          </div>
          {mezcla && (
            <div className={cx(s.callout, s.warn)}>
              Tildaste una <strong>factura de mercadería</strong> y un <strong>gasto</strong> a la vez.
              Un pago vive en una sola bandeja: destildá uno de los dos y hacé un pago para cada uno.
            </div>
          )}
        </>
      ) : (
        <div className={s.hint} style={{ marginTop: 0 }}>
          No tiene facturas ni gastos impagos: lo que se registre queda <strong>a cuenta</strong>.
        </div>
      )}

      {/* ============ FLETES YA PAGADOS, a descontar de lo que se transfiere ==== */}
      {fletes.length > 0 && (
        <>
          <div className={s['section-title']}>Fletes ya pagados de caja</div>
          <div className={s.hint} style={{ marginTop: 0 }}>
            Plata que la cajera le adelantó al fletero <strong>por cuenta de este proveedor</strong>.
            Tildalos para restarlos de lo que hay que transferir: la factura igual queda saldada.
          </div>
          <div
            style={{
              maxHeight: 150, overflowY: 'auto', overflowX: 'hidden',
              border: '1px solid var(--crm-color-border)', borderRadius: 8, marginBottom: 8,
            }}
          >
            {fletes.map((f) => {
              const marcado = !!fletesTildados[f.id];
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFletesTildados((m) => ({ ...m, [f.id]: !m[f.id] }))}
                  disabled={!elegidos.length}
                  style={{
                    all: 'unset', boxSizing: 'border-box', display: 'flex', alignItems: 'center',
                    gap: 10, width: '100%', padding: '7px 10px',
                    cursor: elegidos.length ? 'pointer' : 'not-allowed',
                    opacity: elegidos.length ? 1 : 0.5,
                    font: 'inherit', fontSize: 13, lineHeight: 1.3, textAlign: 'left',
                    borderBottom: '1px solid var(--crm-color-border)',
                    background: marcado ? 'var(--crm-color-primary-soft)' : 'transparent',
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 16, height: 16, flex: 'none', borderRadius: 4,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700,
                      border: marcado ? '1.5px solid var(--crm-color-primary)' : '1.5px solid var(--crm-color-border)',
                      background: marcado ? 'var(--crm-color-primary)' : 'transparent',
                      color: 'var(--crm-color-primary-contrast)',
                    }}
                  >
                    {marcado ? '✓' : ''}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: marcado ? 600 : 400 }}>Flete</span>
                    <span style={{ opacity: 0.65 }}>
                      {' · '}{fmtFecha(f.fecha)}
                      {f.referencia ? ` · ${f.referencia}` : ''}
                      {f.sucursalNombre ? ` · ${f.sucursalNombre}` : ''}
                    </span>
                  </span>
                  <span style={{ flex: 'none', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                    − {money(f.saldo)}
                  </span>
                </button>
              );
            })}
          </div>
          {!elegidos.length && (
            <div className={s.hint}>
              Primero tildá contra qué factura se descuenta: un flete se resta de un documento,
              no del aire.
            </div>
          )}
          {fleteExcedido && (
            <div className={cx(s.callout, s.warn)}>
              Los fletes tildados suman <strong>{money(sumaFletes)}</strong> y lo que se está
              pagando es <strong>{money(sumaElegidos)}</strong>. Destildá alguno, o sumá otra
              factura para descontarlo entero.
            </div>
          )}
        </>
      )}

      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>{sumaFletes > EPS ? 'A transferir (ya con el flete descontado)' : 'Importe'}</label>
          {elegidos.length ? (
            <>
              <input value={money(importe)} disabled />
              <div className={s.hint} style={{ margin: '6px 0 0' }}>
                {sumaFletes > EPS ? (
                  <>
                    {money(sumaElegidos)} de documentos − {money(sumaFletes)} de flete ya pagado.
                    Los documentos quedan saldados igual.
                  </>
                ) : (
                  <>Es la suma exacta de lo tildado. Para entregar otra cifra, destildá todo y queda a cuenta.</>
                )}
              </div>
            </>
          ) : (
            <input
              type="number" min="0" step="0.01" autoFocus
              value={importeLibre} onChange={(e) => setImporteLibre(e.target.value)}
              placeholder="Lo que se le entrega"
            />
          )}
        </div>
        <div className={s.field}>
          <label>¿Cómo salió la plata?</label>
          <select value={modo} onChange={(e) => setModo(e.target.value)}>
            <option value="simple">Un solo medio</option>
            <option value="mixto">Mixto (se partió en varios medios)</option>
          </select>
        </div>
        {modo === 'simple' && (
          <>
            <div className={s.field}>
              <label>Medio real</label>
              <select value={medio} onChange={(e) => setMedio(e.target.value)}>
                {Object.entries(MEDIOS_PAGO_REAL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className={s.field}>
              <label>Fecha del pago</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
          </>
        )}
      </div>

      {modo === 'mixto' && (
        <>
          {formas.map((x, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <select value={x.medio} onChange={setForma(i, 'medio')} style={{ width: 160 }}>
                {Object.entries(MEDIOS_PAGO_REAL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input
                type="number" min="0" step="0.01" placeholder="Importe"
                value={x.importe} onChange={setForma(i, 'importe')} style={{ width: 130, textAlign: 'right' }}
              />
              {/* Fecha propia de la parte: "una parte la transferí hace 10 días". */}
              <input type="date" value={x.fecha} onChange={setForma(i, 'fecha')} />
              {formas.length > 1 && (
                <Btn small onClick={() => setFormas((xs) => xs.filter((_, j) => j !== i))}>×</Btn>
              )}
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Btn small onClick={() => setFormas((xs) => [...xs, { medio: 'transferencia', importe: '', fecha: '' }])}>
              + Agregar parte
            </Btn>
            <span className={s.hint} style={{ margin: 0 }}>
              Suman {money(sumaFormas)} de {money(importe)}
            </span>
          </div>
        </>
      )}

      {usaEfectivo && (
        <div className={s.field}>
          <label>Caja</label>
          {hayTurno ? (
            <>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={desdeCaja} onChange={(e) => setDesdeCaja(e.target.checked)} />
                El efectivo sale del turno #{caja.id}
              </label>
              <div className={s.hint} style={{ margin: '6px 0 0' }}>
                El egreso queda en el arqueo de ese turno, con hora y nombre — solo la parte en efectivo.
              </div>
            </>
          ) : (
            <div className={s.hint} style={{ margin: 0 }}>
              No hay turno de caja abierto en tu sucursal: el pago se registra igual, sin impactar ningún arqueo.
            </div>
          )}
        </div>
      )}

      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Concepto</label>
          <input
            value={concepto} onChange={(e) => setConcepto(e.target.value)}
            placeholder={elegidos.length ? elegidos.map((d) => d.etiqueta).join(' · ') : 'Entrega a cuenta'}
          />
        </div>
        <div className={s.field}>
          <label>Referencia</label>
          <input
            value={referencia} onChange={(e) => setReferencia(e.target.value)}
            placeholder="N° de transferencia, quién recibió… (opcional)"
          />
        </div>
      </div>
    </ModalShell>
  );
}

/** Anular un pago: solo si no tiene nada aplicado, y con motivo escrito. */
export function AnularPagoModal({ pagoId, importe, onChange }) {
  const { act, closeModal, toast } = useProveedores();
  const [motivo, setMotivo] = useState('');

  const anular = async () => {
    if (!motivo.trim()) { toast('Escribí por qué se anula.', 'err'); return; }
    const ok = await act(provApi.anularPago(pagoId, motivo.trim()), 'Pago anulado.');
    if (ok) onChange?.();
  };

  return (
    <ModalShell
      title={`Anular el pago #${pagoId}${importe ? ` de ${money(importe)}` : ''}`}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Anular', clase: 'btn-delete', onClick: anular },
      ]}
    >
      <div className={cx(s.callout, s.warn)}>
        Si el pago salió de un turno de caja <strong>todavía abierto</strong>, se elimina también ese
        egreso y la caja vuelve a cuadrar sola. Si el turno ya se cerró, la anulación se rechaza:
        el arqueo se firmó con ese egreso adentro y la corrección va como ingreso del turno actual.
      </div>
      <div className={s.field}>
        <label>Motivo <span className={s.req}>*</span></label>
        <input autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: se cargó dos veces" />
      </div>
    </ModalShell>
  );
}
