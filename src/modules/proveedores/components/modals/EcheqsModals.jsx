import { useRef, useState } from 'react';
import { hoyISO } from '@modules/gastos/domain/constants.js';
import { diasDe, sumarDias } from '@modules/gerencia/panels/metricas/formato.js';
import { useProveedores } from '../../context/ProveedoresContext.jsx';
import { useResource } from '../../hooks/useResource.js';
import { provApi } from '../../services/proveedores.api.js';
import { Btn, ModalShell, Table, fmtFecha, money, s } from '../ui.jsx';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * LA CALCULADORA DE DÍAS (27/10/2026, pedido del dueño): emisión + plazo =
 * fecha de cobro. Cambiar la emisión o el plazo mueve el cobro; tocar el
 * cobro a mano recalcula el plazo. Así los tres siempre dicen lo mismo.
 */
function conPlazo(f, patch) {
  const n = { ...f, ...patch };
  if (!n.fechaEmision) return n;
  if ('fechaVenc' in patch) return { ...n, plazo: n.fechaVenc ? String(diasDe(n.fechaEmision, n.fechaVenc) - 1) : '' };
  return n.plazo !== '' && Number(n.plazo) >= 0 ? { ...n, fechaVenc: sumarDias(n.fechaEmision, Number(n.plazo)) } : n;
}

/** Un dato del proveedor con su botón de copiar (o «sin cargar»). */
function DatoCopiable({ etiqueta, valor }) {
  const { toast } = useProveedores();
  if (!valor) return <span>{etiqueta}: <em>sin cargar</em></span>;
  const copiar = () => navigator.clipboard.writeText(valor)
    .then(() => toast(`${etiqueta} copiado.`, 'ok'), () => toast('No se pudo copiar al portapapeles.', 'err'));
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {etiqueta}: <strong>{valor}</strong> <Btn small onClick={copiar}>Copiar</Btn>
    </span>
  );
}

/**
 * Alta manual / edición de un echeq propio. El que nace de una factura se
 * confirma antes con `ConfirmarEcheqModal`; acá se corrige después. Las
 * facturas que cubre se eligen con «Facturas» (0205): su fecha de cobro mueve
 * también el vencimiento de cada una, y su importe no baja de lo que cubre.
 *
 * A UN NO PROVEEDOR (0201, 26/10/2026, pedido del dueño): el echeq puede ir a
 * cualquiera, con el nombre escrito a mano. Al debitarse solo queda cobrado:
 * no hay cuenta corriente donde imputarlo.
 *
 * Al elegir el proveedor (27/10/2026) se ven su CUIT y su correo para copiar,
 * y su plazo de pago precarga la calculadora de días.
 */
export function EcheqModal({ echeq, onChange }) {
  const { proveedores, act, closeModal, toast } = useProveedores();
  const editando = !!echeq;
  /* Lo que ya cubre de sus facturas (0205): el importe no puede bajar de eso. */
  const cubre = editando ? r2(echeq.importe - echeq.sinFactura) : 0;
  const [aProveedor, setAProveedor] = useState(!echeq || !!echeq.proveedorId);
  const [f, setF] = useState(() => conPlazo({
    proveedorId: echeq?.proveedorId ?? '',
    destinatario: echeq && !echeq.proveedorId ? echeq.aNombreDe : '',
    numero: echeq?.numero?.startsWith('PEND-') ? '' : (echeq?.numero ?? ''),
    banco: echeq?.banco === 'A definir' ? '' : (echeq?.banco ?? ''),
    importe: echeq ? String(echeq.importe) : '',
    fechaEmision: echeq?.fechaEmision ? String(echeq.fechaEmision).slice(0, 10) : hoyISO(),
    obs: echeq?.obs ?? '',
    plazo: '',
  }, { fechaVenc: echeq?.fechaVenc ? String(echeq.fechaVenc).slice(0, 10) : '' }));
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const setFecha = (k) => (e) => setF((x) => conPlazo(x, { [k]: e.target.value }));
  const prov = !editando && aProveedor ? proveedores.find((p) => p.id === Number(f.proveedorId)) : null;
  const elegirProveedor = (e) => {
    const p = proveedores.find((x) => x.id === Number(e.target.value));
    setF((x) => conPlazo({ ...x, proveedorId: e.target.value }, p?.diasPago > 0 ? { plazo: String(p.diasPago) } : {}));
  };

  const guardar = async () => {
    if (!editando && aProveedor && !f.proveedorId) { toast('Elegí el proveedor.', 'err'); return; }
    if (!aProveedor && !f.destinatario.trim()) { toast('Escribí a nombre de quién va el echeq.', 'err'); return; }
    if (!editando && !(Number(f.importe) > 0)) { toast('El importe tiene que ser mayor a 0.', 'err'); return; }
    if (!editando && !f.fechaVenc) { toast('El echeq necesita su fecha de cobro.', 'err'); return; }
    const body = {
      numero: f.numero.trim(), banco: f.banco.trim(),
      fechaEmision: f.fechaEmision || undefined, fechaVenc: f.fechaVenc || undefined,
      obs: f.obs.trim(),
    };
    if (f.importe !== '') body.importe = r2(f.importe);
    if (!aProveedor) body.destinatario = f.destinatario.trim();
    else if (!editando) body.proveedorId = Number(f.proveedorId);
    const res = await act(
      editando ? provApi.editarEcheq(echeq.id, body) : provApi.crearEcheq(body),
      editando ? 'Echeq actualizado.' : 'Echeq registrado.',
    );
    if (res) onChange?.();
  };

  return (
    <ModalShell
      title={editando ? `Echeq ${echeq.numero}` : 'Nuevo echeq'}
      subtitle={aProveedor
        ? 'Echeq propio — con «Facturas» se imputa a una o varias; lo que no cubra va a cuenta al cobrarse'
        : 'Echeq a quien no es proveedor — al cobrarse solo queda como cobrado'}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Guardar', clase: 'btn-primary', onClick: guardar },
      ]}
    >
      {!editando && (
        <div className={s.field}>
          <label>¿A quién va?</label>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[[true, 'A un proveedor'], [false, 'A otra persona o empresa']].map(([v, l]) => (
              <label key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                <input type="radio" name="echeq-a-quien" checked={aProveedor === v} onChange={() => setAProveedor(v)} /> {l}
              </label>
            ))}
          </div>
        </div>
      )}
      {!editando && aProveedor && (
        <div className={s.field}>
          <label>Proveedor</label>
          <select value={f.proveedorId} onChange={elegirProveedor} autoFocus>
            <option value="">Elegí el proveedor</option>
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          {prov && (
            <div className={s.hint} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 16px', margin: '8px 0 0' }}>
              <DatoCopiable etiqueta="CUIT" valor={prov.cuit} />
              <DatoCopiable etiqueta="Correo" valor={prov.email} />
              <span>Plazo de pago: {prov.diasPago > 0 ? `${prov.diasPago} días` : <em>sin cargar</em>}</span>
            </div>
          )}
        </div>
      )}
      {!aProveedor && (
        <div className={s.field}>
          <label>A nombre de</label>
          <input value={f.destinatario} onChange={set('destinatario')} maxLength={120} placeholder="Ej.: Juan Pérez (alquiler)" autoFocus />
        </div>
      )}
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Número</label>
          <input value={f.numero} onChange={set('numero')} placeholder="Del papel emitido" />
        </div>
        <div className={s.field}>
          <label>Banco</label>
          <input value={f.banco} onChange={set('banco')} placeholder="Galicia, Nación…" />
        </div>
        <div className={s.field}>
          <label>Importe</label>
          <input type="number" min="0" step="0.01" value={f.importe} onChange={set('importe')} />
          {cubre > 0.009 && (
            <div className={s.hint} style={{ margin: '6px 0 0' }}>
              Cubre {money(cubre)} de sus facturas: no puede ser de menos.
            </div>
          )}
        </div>
      </div>
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Emisión</label>
          <input type="date" value={f.fechaEmision} onChange={setFecha('fechaEmision')} />
        </div>
        <div className={s.field}>
          <label>Plazo (días)</label>
          <input type="number" min="0" step="1" value={f.plazo} onChange={setFecha('plazo')} placeholder="Ej.: 15" />
        </div>
        <div className={s.field}>
          <label>Fecha de cobro</label>
          <input type="date" value={f.fechaVenc} onChange={setFecha('fechaVenc')} />
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
 * CONFIRMAR EL ECHEQ AUTOMÁTICO (0204, pedido del dueño). El que nace con la
 * factura espera pendiente: no cuenta como hecho hasta que se cargan acá los
 * datos del papel que se hizo de verdad. Si se hizo por menos, el resto de la
 * deuda vuelve a Cuentas corrientes; por más no se puede (paga su factura).
 */
export function ConfirmarEcheqModal({ echeq, onChange }) {
  const { act, closeModal, toast } = useProveedores();
  const enviando = useRef(false);
  const [f, setF] = useState({
    numero: '', banco: '',
    importe: String(echeq.importe),
    // La de la factura: nunca queda después de la fecha de cobro, aunque se confirme tarde.
    fechaEmision: String(echeq.fechaEmision).slice(0, 10),
    fechaVenc: String(echeq.fechaVenc).slice(0, 10),
    obs: '',
  });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const importe = r2(f.importe);
  const resto = r2(echeq.importe - importe);

  const confirmar = async () => {
    if (enviando.current) return;
    if (!f.numero.trim()) { toast('Escribí el número del echeq.', 'err'); return; }
    if (!f.banco.trim()) { toast('Escribí el banco del echeq.', 'err'); return; }
    if (!(importe > 0)) { toast('El importe tiene que ser mayor a 0.', 'err'); return; }
    if (resto < -0.009) { toast(`El echeq paga esta factura: puede ser de hasta ${money(echeq.importe)}.`, 'err'); return; }
    if (!f.fechaVenc) { toast('Poné la fecha de cobro.', 'err'); return; }
    enviando.current = true;
    const res = await act(provApi.confirmarEcheq(echeq.id, {
      numero: f.numero.trim(), banco: f.banco.trim(), importe,
      fechaEmision: f.fechaEmision || undefined, fechaVenc: f.fechaVenc, obs: f.obs.trim(),
    }), resto > 0.009 ? 'Echeq confirmado. El resto quedó en Cuentas corrientes.' : 'Echeq confirmado.');
    enviando.current = false;
    if (res) onChange?.();
  };

  return (
    <ModalShell
      title="Confirmar el echeq"
      subtitle={`${echeq.aNombreDe} · nació de la factura por ${money(echeq.importe)}`}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Sí, lo hice: confirmar', clase: 'btn-primary', onClick: confirmar },
      ]}
    >
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Número</label>
          <input value={f.numero} onChange={set('numero')} placeholder="Del echeq que hiciste" autoFocus />
        </div>
        <div className={s.field}>
          <label>Banco</label>
          <input value={f.banco} onChange={set('banco')} placeholder="Galicia, Nación…" />
        </div>
        <div className={s.field}>
          <label>Importe</label>
          <input type="number" min="0" step="0.01" value={f.importe} onChange={set('importe')} />
        </div>
      </div>
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Emisión</label>
          <input type="date" value={f.fechaEmision} onChange={set('fechaEmision')} />
        </div>
        <div className={s.field}>
          <label>Fecha de cobro</label>
          <input type="date" value={f.fechaVenc} onChange={set('fechaVenc')} />
        </div>
      </div>
      <div className={s.field}>
        <label>Observaciones</label>
        <input value={f.obs} onChange={set('obs')} placeholder="Opcional" />
      </div>
      <div className={s.hint} style={{ margin: 0 }}>
        Queda en la cartera como <strong>emitido</strong>
        {importe > 0 && <> por <strong>{money(importe)}</strong></>}
        {f.fechaVenc && <>, se cobra el <strong>{fmtFecha(`${f.fechaVenc}T00:00:00`)}</strong></>}.
        {resto > 0.009 && (
          <> Como es por menos, los <strong>{money(resto)}</strong> que faltan quedan como deuda en Cuentas corrientes.</>
        )}
      </div>
    </ModalShell>
  );
}

/**
 * LAS FACTURAS QUE CUBRE UN ECHEQ (0205, pedido del dueño: el echeq se hace
 * antes y la factura llega días después, y muchas veces uno cubre varias). Se
 * reparte su importe entre las facturas impagas del proveedor; lo que no cubra
 * ninguna va a cuenta cuando el banco lo debite. En cada factura el echeq toma
 * el lugar de su cuenta corriente o de su echeq automático sin confirmar.
 */
export function FacturasEcheqModal({ echeq, onChange }) {
  const { act, closeModal, toast } = useProveedores();
  const enviando = useRef(false);
  const { data: docs } = useResource(`facturas-impagas:${echeq.proveedorId}`, () => provApi.facturasImpagas(echeq.proveedorId));
  const [montos, setMontos] = useState(() => Object.fromEntries(echeq.facturas.map((x) => [x.comprobanteId, String(x.importe)])));
  const facturas = (docs ?? []).filter((d) => d.tipo === 'comprobante');
  const suma = r2(Object.values(montos).reduce((a, v) => a + (Number(v) || 0), 0));
  const queda = r2(echeq.importe - suma);
  const poner = (id, v) => setMontos((m) => ({ ...m, [id]: v }));
  // «Todo»: lo que la factura debe, hasta donde le alcance al echeq.
  const todo = (d) => poner(d.docId, String(r2(Math.min(d.saldo, (Number(montos[d.docId]) || 0) + Math.max(0, queda)))));

  const guardar = async () => {
    if (enviando.current) return;
    if (queda < -0.009) { toast(`Las facturas suman ${money(suma)} y el echeq es de ${money(echeq.importe)}.`, 'err'); return; }
    enviando.current = true;
    const lista = Object.entries(montos)
      .map(([id, v]) => ({ comprobanteId: Number(id), importe: r2(v) }))
      .filter((x) => x.importe > 0.009);
    const res = await act(provApi.facturasEcheq(echeq.id, lista), 'Listo: el echeq quedó imputado.');
    enviando.current = false;
    if (res) onChange?.();
  };

  return (
    <ModalShell
      title={`Facturas del echeq ${echeq.numero}`}
      subtitle={`${echeq.aNombreDe} · ${money(echeq.importe)} · se cobra el ${fmtFecha(echeq.fechaVenc)}`}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Guardar', clase: 'btn-primary', onClick: guardar },
      ]}
    >
      {!docs && <div className={s.hint}>Cargando las facturas…</div>}
      {docs && !facturas.length && (
        <div className={s['empty-state']}>No le debés ninguna factura. Cuando la cargues, el echeq se ofrece ahí mismo.</div>
      )}
      {facturas.length > 0 && (
        <Table cols={[{ h: 'Factura' }, { h: 'Fecha' }, { h: 'Debe', num: true }, { h: 'Cubre el echeq', num: true }]}>
          {facturas.map((d) => (
            <tr key={d.docId}>
              <td>{d.etiqueta}</td>
              <td>{fmtFecha(d.fecha)}</td>
              <td className={s.num}>{money(d.saldo)}</td>
              <td className={s.num}>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <input
                    type="number" min="0" step="0.01" value={montos[d.docId] ?? ''}
                    onChange={(ev) => poner(d.docId, ev.target.value)} style={{ width: 130, textAlign: 'right' }}
                  />
                  <Btn small onClick={() => todo(d)}>Todo</Btn>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}
      <div className={s.hint} style={{ margin: '10px 0 0' }}>
        Cubre <strong>{money(suma)}</strong> de {money(echeq.importe)}.{' '}
        {queda > 0.009 && <>Los <strong>{money(queda)}</strong> que no cubren ninguna factura van a cuenta del proveedor cuando el banco lo debite.</>}
        {queda < -0.009 && <>Te pasaste por <strong>{money(-queda)}</strong>.</>}
        {Math.abs(queda) <= 0.009 && 'Cubre el echeq entero.'}
        {' '}En cada factura el echeq toma el lugar de su cuenta corriente o de su echeq automático sin confirmar.
      </div>
    </ModalShell>
  );
}
