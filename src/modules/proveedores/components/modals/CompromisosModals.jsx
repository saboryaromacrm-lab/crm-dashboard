import { useState } from 'react';
import { useProveedores } from '../../context/ProveedoresContext.jsx';
import { useResource } from '../../hooks/useResource.js';
import { provApi, MEDIOS_PAGO_REAL } from '../../services/proveedores.api.js';
import { Di, ImporteCompromiso, ModalShell, money, fmtFecha, s } from '../ui.jsx';
import { AvisoSegundaConfirmacion, textoBoton, useSegundaConfirmacion } from '@modules/gastos/components/segundaConfirmacion.jsx';
import { CuentaPropiaSelect, cuentaDelPago } from '@shared/components/CuentaPropiaSelect.jsx';
import { PARTE_VACIA } from '../../domain/partesPago.js';
import { PartesPago } from '../PartesPago.jsx';
import { BuscadorProveedor } from '@shared/components/BuscadorProveedor.jsx';

const hoyISO = () => {
  const d = new Date(); const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Alta manual / edición de un compromiso de cuenta corriente. */
export function CompromisoModal({ compromiso, onChange }) {
  const { proveedores, act, closeModal, toast } = useProveedores();
  const editando = !!compromiso;
  const [f, setF] = useState({
    proveedorId: compromiso?.proveedorId ?? '',
    importe: compromiso ? String(compromiso.importe) : '',
    fechaVenc: compromiso?.fechaVenc ? String(compromiso.fechaVenc).slice(0, 10) : '',
    obs: compromiso?.obs ?? '',
  });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const guardar = async () => {
    if (!editando && !f.proveedorId) { toast('Elegí el proveedor.', 'err'); return; }
    if (!(Number(f.importe) > 0)) { toast('El importe tiene que ser mayor a 0.', 'err'); return; }
    if (!f.fechaVenc) { toast('Poné la fecha de vencimiento.', 'err'); return; }
    const res = await act(
      editando
        ? provApi.editarCompromiso(compromiso.id, { importe: r2(f.importe), fechaVenc: f.fechaVenc, obs: f.obs.trim() })
        : provApi.crearCompromiso({ proveedorId: Number(f.proveedorId), importe: r2(f.importe), fechaVenc: f.fechaVenc, obs: f.obs.trim() }),
      editando ? 'Compromiso actualizado.' : 'Compromiso registrado.',
    );
    if (res) onChange?.();
  };

  return (
    <ModalShell
      title={editando ? `Editar compromiso #${compromiso.id}` : 'Nuevo compromiso'}
      subtitle="Una promesa de pago con fecha — el pago real se registra al pagarla"
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Guardar', clase: 'btn-primary', onClick: guardar },
      ]}
    >
      {!editando && (
        <div className={s.field}>
          <label>Proveedor</label>
          <BuscadorProveedor proveedores={proveedores} value={f.proveedorId} onChange={(v) => setF((x) => ({ ...x, proveedorId: v }))} autoFocus />
        </div>
      )}
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Importe</label>
          <input type="number" min="0" step="0.01" value={f.importe} onChange={set('importe')} />
        </div>
        <div className={s.field}>
          <label>Vence el</label>
          <input type="date" value={f.fechaVenc} onChange={set('fechaVenc')} />
        </div>
      </div>
      <div className={s.field}>
        <label>Observaciones</label>
        <input value={f.obs} onChange={set('obs')} placeholder="Opcional" />
      </div>
    </ModalShell>
  );
}

/**
 * PAGAR un compromiso: la promesa decía "cta cte" — acá se dice con qué salió
 * la plata DE VERDAD. Un medio simple, o el split multi-forma ("mitad
 * transferencia, mitad efectivo"). El efectivo puede salir del cajón si hay
 * turno abierto — mismo circuito y mismos candados que todos los pagos.
 */
export function PagarCompromisoModal({ compromiso, onChange }) {
  const { ctx, act, closeModal, toast } = useProveedores();
  const [modo, setModo] = useState('simple');
  const [medio, setMedio] = useState('transferencia');
  /* De qué cuenta propia sale la transferencia (0207); en partes, cada una dice la suya. */
  const [cuentaId, setCuentaId] = useState('');
  const [formas, setFormas] = useState([PARTE_VACIA]);
  const [fecha, setFecha] = useState(hoyISO());
  const [referencia, setReferencia] = useState('');
  const [desdeCaja, setDesdeCaja] = useState(true);

  const { data: caja } = useResource(
    `caja-prov:${ctx.sucursalId}`,
    () => provApi.cajaActual(ctx.sucursalId),
    { enabled: !!ctx.sucursalId },
  );
  const hayTurno = !!caja?.id && caja.estado === 'abierta';
  const usaEfectivo = modo === 'simple'
    ? medio === 'efectivo'
    : formas.some((x) => x.medio === 'efectivo' && Number(x.importe) > 0);
  const sumaFormas = r2(formas.reduce((a, x) => a + (Number(x.importe) || 0), 0));
  // Lo que de verdad falta (27/10/2026): si la factura ya se pagó en parte, no la promesa entera.
  const aPagar = compromiso.falta;

  /* Sale plata: segunda confirmación + candado del doble clic (27/9/2026). */
  const conf = useSegundaConfirmacion(JSON.stringify([modo, medio, cuentaId, formas, fecha, referencia, desdeCaja]));
  const validar = () => {
    if (modo === 'simple') return true;
    if (!formas.some((x) => Number(x.importe) > 0)) { toast('Cargá al menos una parte del pago.', 'err'); return false; }
    if (Math.abs(sumaFormas - aPagar) > 0.009) {
      toast(`Las partes suman ${money(sumaFormas)} y lo que falta pagar es ${money(aPagar)}.`, 'err');
      return false;
    }
    return true;
  };
  const pagar = () => conf.clic(validar, async () => {
    const body = { fecha, referencia: referencia.trim() || undefined };
    if (modo === 'simple') {
      body.medio = medio;
      Object.assign(body, cuentaDelPago(cuentaId));
    } else {
      body.formas = formas.filter((x) => Number(x.importe) > 0).map((x) => ({
        medio: x.medio, importe: r2(x.importe), fecha: x.fecha || undefined, ...cuentaDelPago(x.cuentaId),
      }));
    }
    if (usaEfectivo && hayTurno && desdeCaja) body.cajaSesionId = caja.id;
    const res = await act(provApi.pagarCompromiso(compromiso.id, body), 'Compromiso pagado.');
    if (res) onChange?.();
  });

  return (
    <ModalShell
      title={`Pagar compromiso #${compromiso.id}`}
      subtitle={`${compromiso.proveedorNombre} · vence ${fmtFecha(compromiso.fechaVenc)}`}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: textoBoton(conf, `Pagar ${money(aPagar)}…`, `Sí, pagar ${money(aPagar)}`), clase: 'btn-primary', onClick: pagar },
      ]}
    >
      <AvisoSegundaConfirmacion confirmando={conf.confirmando} gemelo={null}>
        Sale un pago de <strong>{money(aPagar)}</strong> a <strong>{compromiso.proveedorNombre}</strong>
        {modo === 'simple' ? <> por {medio}</> : <> en partes</>}
        {usaEfectivo && hayTurno && desdeCaja ? <> (el efectivo <strong>sale del cajón</strong>, turno #{caja.id})</> : null}.
        {usaEfectivo && !(hayTurno && desdeCaja) ? <> <strong>Ojo: es efectivo pero NO sale de ningún turno de caja</strong>, así que no va a figurar en ningún arqueo.</> : null}
      </AvisoSegundaConfirmacion>
      <div className={s['form-grid']}>
        <Di label="Importe"><ImporteCompromiso k={compromiso} /></Di>
        {compromiso.comprobanteEtiqueta && <Di label="Factura">{compromiso.comprobanteEtiqueta}</Di>}
        {compromiso.cuota && <Di label="Cuota">{compromiso.cuota}/{compromiso.cuotas}</Di>}
      </div>

      <div className={s.field}>
        <label>¿Cómo salió la plata?</label>
        <select value={modo} onChange={(e) => setModo(e.target.value)}>
          <option value="simple">Un solo medio</option>
          <option value="mixto">Mixto (se partió en varios medios)</option>
        </select>
      </div>

      {modo === 'simple' ? (
        <div className={s['form-grid']}>
          <div className={s.field}>
            <label>Medio real</label>
            <select value={medio} onChange={(e) => setMedio(e.target.value)}>
              {Object.entries(MEDIOS_PAGO_REAL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {medio === 'transferencia' && (
            <div className={s.field}>
              <label>¿De qué cuenta salió?</label>
              <CuentaPropiaSelect value={cuentaId} onChange={setCuentaId} />
            </div>
          )}
          <div className={s.field}>
            <label>Fecha del pago</label>
            <input type="date" max={hoyISO()} value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
        </div>
      ) : (
        <>
          <PartesPago formas={formas} setFormas={setFormas} total={aPagar} />
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
                El egreso queda en el arqueo — solo la parte en efectivo.
              </div>
            </>
          ) : (
            <div className={s.hint} style={{ margin: 0 }}>
              No hay turno de caja abierto en tu sucursal: el pago se registra sin impactar en ningún arqueo.
            </div>
          )}
        </div>
      )}

      <div className={s.field}>
        <label>Referencia</label>
        <input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="N° de transferencia, quién recibió… (opcional)" />
      </div>
    </ModalShell>
  );
}
