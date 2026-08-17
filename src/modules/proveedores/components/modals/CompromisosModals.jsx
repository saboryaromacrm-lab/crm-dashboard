import { useState } from 'react';
import { useProveedores } from '../../context/ProveedoresContext.jsx';
import { useResource } from '../../hooks/useResource.js';
import { provApi, MEDIOS_PAGO_REAL } from '../../services/proveedores.api.js';
import { Btn, Di, ModalShell, money, fmtFecha, s } from '../ui.jsx';

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
          <select value={f.proveedorId} onChange={set('proveedorId')} autoFocus>
            <option value="">Elegí el proveedor</option>
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
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
  const [formas, setFormas] = useState([{ medio: 'transferencia', importe: '', fecha: '' }]);
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
  const setForma = (i, k) => (e) => setFormas((xs) => xs.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)));
  const sumaFormas = r2(formas.reduce((a, x) => a + (Number(x.importe) || 0), 0));

  const pagar = async () => {
    const body = { fecha, referencia: referencia.trim() || undefined };
    if (modo === 'simple') {
      body.medio = medio;
    } else {
      const filas = formas.filter((x) => Number(x.importe) > 0);
      if (!filas.length) { toast('Cargá al menos una parte del pago.', 'err'); return; }
      if (Math.abs(sumaFormas - compromiso.importe) > 0.009) {
        toast(`Las partes suman ${money(sumaFormas)} y el compromiso dice ${money(compromiso.importe)}.`, 'err');
        return;
      }
      body.formas = filas.map((x) => ({ medio: x.medio, importe: r2(x.importe), fecha: x.fecha || undefined }));
    }
    if (usaEfectivo && hayTurno && desdeCaja) body.cajaSesionId = caja.id;
    const res = await act(provApi.pagarCompromiso(compromiso.id, body), 'Compromiso pagado.');
    if (res) onChange?.();
  };

  return (
    <ModalShell
      title={`Pagar compromiso #${compromiso.id}`}
      subtitle={`${compromiso.proveedorNombre} · vence ${fmtFecha(compromiso.fechaVenc)}`}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: `Pagar ${money(compromiso.importe)}`, clase: 'btn-primary', onClick: pagar },
      ]}
    >
      <div className={s['form-grid']}>
        <Di label="Importe">{money(compromiso.importe)}</Di>
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
          <div className={s.field}>
            <label>Fecha del pago</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
        </div>
      ) : (
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
              {/* Fecha propia de la parte: "transferí una parte hace 10 días". */}
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
            <span className={s.hint}>Suman {money(sumaFormas)} de {money(compromiso.importe)}</span>
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
