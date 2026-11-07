import { useRef, useState } from 'react';
import { hoyISO } from '@modules/gastos/domain/constants.js';
import { diasDe, sumarDias } from '@modules/gerencia/panels/metricas/formato.js';
import { useProveedores } from '../../context/ProveedoresContext.jsx';
import { useResource } from '../../hooks/useResource.js';
import { provApi } from '../../services/proveedores.api.js';
import {
  Btn, EcheqsDeFactura, FilaTilde, ModalShell, Table, cajaTildes, echeqsDeFactura, fmtFecha, money, s,
} from '../ui.jsx';

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

/** Lo que el echeq cubre de cada factura tildada, en orden, hasta su importe y lo que le queda libre. */
const repartir = (facturas, importe) => {
  let queda = r2(importe);
  return facturas.map((x) => {
    const cubre = r2(Math.min(x.libre, Math.max(0, queda)));
    queda = r2(queda - cubre);
    return { ...x, cubre };
  }).filter((x) => x.cubre > 0.009);
};

/** Un dato del proveedor con su botón de copiar (o «sin cargar»). `copiar`: lo que va al portapapeles, si no es lo que se ve. */
export function DatoCopiable({ etiqueta, valor, copiar = valor }) {
  const { toast } = useProveedores();
  if (!valor) return <span>{etiqueta}: <em>sin cargar</em></span>;
  const alPortapapeles = () => navigator.clipboard.writeText(copiar)
    .then(() => toast(`${etiqueta} copiado: ${copiar}`, 'ok'), () => toast('No se pudo copiar al portapapeles.', 'err'));
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {etiqueta}: <strong>{valor}</strong> <Btn small onClick={alPortapapeles}>Copiar</Btn>
    </span>
  );
}

/**
 * LO QUE PIDE EL HOME BANKING PARA HACER EL ECHEQ (27/10 y 7/11/2026, pedido
 * del dueño): el CUIT —se copia sin guiones— y el correo del proveedor, a
 * mano donde se elige pagar con echeq, donde se hace y donde se confirma.
 */
export function DatosParaElBanco({ prov }) {
  if (!prov) return null;
  return (
    <div className={s.hint} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 16px', margin: '8px 0 0' }}>
      <DatoCopiable etiqueta="CUIT" valor={prov.cuit} copiar={String(prov.cuit ?? '').replace(/\D/g, '')} />
      <DatoCopiable etiqueta="Correo" valor={prov.email} />
      <span>Plazo de pago: {prov.diasPago > 0 ? `${prov.diasPago} días` : <em>sin cargar</em>}</span>
    </div>
  );
}

/**
 * Alta manual / edición de un echeq propio. El que nace de una factura se
 * confirma antes con `ConfirmarEcheqModal`; acá se corrige después. Las
 * facturas de uno ya hecho se cambian con «Facturas» (0205): su fecha de cobro
 * mueve también el vencimiento de cada una, y su importe no baja de lo que cubre.
 *
 * A UN NO PROVEEDOR (0201, 26/10/2026, pedido del dueño): el echeq puede ir a
 * cualquiera, con el nombre escrito a mano. Al debitarse solo queda cobrado:
 * no hay cuenta corriente donde imputarlo.
 *
 * PAGAR CON ECHEQ (28/10 y 7/11/2026, pedido del dueño: «la opción directa
 * para crear el echeq y el pago a la vez»): al elegir el proveedor se ven su
 * CUIT y su correo para copiar, su plazo precarga la calculadora de días y se
 * tildan las facturas que paga; el importe es lo que suman (se puede cambiar:
 * de más va a cuenta al cobrarse, de menos cubre las más viejas primero). Una
 * factura con echeq pendiente de hacer: este lo reemplaza. Lo que ya cubre un
 * echeq hecho no se vuelve a cubrir. Desde «Pagarle» (`pagoDe`) viene con el
 * proveedor y las facturas ya tildadas. No es un pago todavía: la plata sale
 * cuando el banco lo debita y se lo cobra.
 */
export function EcheqModal({ echeq, pagoDe, onChange }) {
  const { proveedores, act, closeModal, toast } = useProveedores();
  const editando = !!echeq;
  const provPago = pagoDe ? proveedores.find((p) => p.id === pagoDe.proveedorId) : null;
  /* Lo que ya cubre de sus facturas (0205): el importe no puede bajar de eso. */
  const cubre = editando ? r2(echeq.importe - echeq.sinFactura) : 0;
  const [aProveedor, setAProveedor] = useState(!echeq || !!echeq.proveedorId);
  const [f, setF] = useState(() => conPlazo({
    proveedorId: echeq?.proveedorId ?? pagoDe?.proveedorId ?? '',
    destinatario: echeq && !echeq.proveedorId ? echeq.aNombreDe : '',
    numero: echeq?.numero?.startsWith('PEND-') ? '' : (echeq?.numero ?? ''),
    banco: echeq?.banco === 'A definir' ? '' : (echeq?.banco ?? ''),
    importe: echeq ? String(echeq.importe) : pagoDe?.importe > 0 ? String(pagoDe.importe) : '',
    fechaEmision: echeq?.fechaEmision ? String(echeq.fechaEmision).slice(0, 10) : hoyISO(),
    obs: echeq?.obs ?? '',
    plazo: '',
  }, provPago?.diasPago > 0
    ? { plazo: String(provPago.diasPago) }
    : { fechaVenc: echeq?.fechaVenc ? String(echeq.fechaVenc).slice(0, 10) : '' }));
  const [tildadas, setTildadas] = useState(() => new Set(pagoDe?.comprobanteIds ?? []));
  /* Mientras no se escriba, el importe es lo que suman las facturas tildadas (el de «Pagarle» sin facturas, ya viene escrito). */
  const [importeAMano, setImporteAMano] = useState(pagoDe?.importe > 0);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const setFecha = (k) => (e) => setF((x) => conPlazo(x, { [k]: e.target.value }));
  const prov = !editando && aProveedor ? proveedores.find((p) => p.id === Number(f.proveedorId)) : null;
  const elegirProveedor = (e) => {
    const p = proveedores.find((x) => x.id === Number(e.target.value));
    setF((x) => conPlazo({ ...x, proveedorId: e.target.value }, p?.diasPago > 0 ? { plazo: String(p.diasPago) } : {}));
    setTildadas(new Set());
    setImporteAMano(false);
  };

  const { data, loading, error } = useResource(`facturas-impagas:${prov?.id}`, () => provApi.facturasImpagas(prov.id), { enabled: !!prov });
  /* Mientras carga las de otro proveedor no se muestran las del anterior: se tildarían facturas ajenas. */
  const docs = loading ? null : data;
  /* Lo que el echeq todavía puede cubrir de cada una: lo que debe menos lo que ya cubren echeqs hechos. */
  const facturas = (docs ?? []).filter((d) => d.tipo === 'comprobante')
    .map((d) => ({ ...d, libre: Math.max(0, r2(d.saldo - echeqsDeFactura(d).cubreHechos)) }));
  const elegidas = facturas.filter((d) => tildadas.has(d.docId));
  const sumaLibre = r2(elegidas.reduce((a, d) => a + d.libre, 0));
  const importe = editando || importeAMano ? r2(f.importe) : sumaLibre;
  const reparto = repartir(elegidas.map((d) => ({ comprobanteId: d.docId, etiqueta: d.etiqueta, libre: d.libre })), importe);
  const sinFactura = r2(importe - reparto.reduce((a, x) => a + x.cubre, 0));
  const alternar = (d) => setTildadas((xs) => {
    const ys = new Set(xs);
    if (!ys.delete(d.docId)) ys.add(d.docId);
    return ys;
  });

  const guardar = async () => {
    if (!editando && aProveedor && !f.proveedorId) { toast('Elegí el proveedor.', 'err'); return; }
    if (!aProveedor && !f.destinatario.trim()) { toast('Escribí a nombre de quién va el echeq.', 'err'); return; }
    if (!editando && !(importe > 0)) { toast(prov ? 'Tildá las facturas que paga o escribí el importe.' : 'El importe tiene que ser mayor a 0.', 'err'); return; }
    if (!editando && !f.fechaVenc) { toast('El echeq necesita su fecha de cobro.', 'err'); return; }
    const body = {
      numero: f.numero.trim(), banco: f.banco.trim(),
      fechaEmision: f.fechaEmision || undefined, fechaVenc: f.fechaVenc || undefined,
      obs: f.obs.trim(),
    };
    if (!editando || f.importe !== '') body.importe = importe;
    if (!aProveedor) body.destinatario = f.destinatario.trim();
    else if (!editando) body.proveedorId = Number(f.proveedorId);
    if (reparto.length) body.facturas = reparto.map((x) => ({ comprobanteId: x.comprobanteId, importe: x.cubre }));
    const res = await act(
      editando ? provApi.editarEcheq(echeq.id, body) : provApi.crearEcheq(body),
      editando ? 'Echeq actualizado.'
        : reparto.length ? `Echeq registrado: cubre ${reparto.length} factura(s) y el pago se registra al cobrarlo.` : 'Echeq registrado.',
    );
    if (res) onChange?.();
  };

  return (
    <ModalShell
      title={editando ? `Echeq ${echeq.numero}` : pagoDe ? `Pagarle con un echeq a ${provPago?.nombre ?? ''}` : 'Pagar con echeq'}
      subtitle={!aProveedor
        ? 'Echeq a quien no es proveedor — al cobrarse solo queda como cobrado'
        : editando
          ? 'Sus facturas se cambian con «Facturas»'
          : 'Tildá las facturas que paga: quedan cubiertas, y el pago se registra cuando el banco lo debita'}
      wide={!editando && aProveedor}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Guardar', clase: 'btn-primary', onClick: guardar },
      ]}
    >
      {!editando && !pagoDe && (
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
          <select value={f.proveedorId} onChange={elegirProveedor} disabled={!!pagoDe} autoFocus={!pagoDe}>
            <option value="">Elegí el proveedor</option>
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <DatosParaElBanco prov={prov} />
        </div>
      )}
      {!aProveedor && (
        <div className={s.field}>
          <label>A nombre de</label>
          <input value={f.destinatario} onChange={set('destinatario')} maxLength={120} placeholder="Ej.: Juan Pérez (alquiler)" autoFocus />
        </div>
      )}
      {prov && (
        <div className={s.field}>
          <label>¿Qué facturas paga?</label>
          {error ? <div className={s.hint} style={{ margin: 0 }}>No se pudieron traer sus facturas: {error}</div>
            : !docs ? <div className={s.hint} style={{ margin: 0 }}>Cargando sus facturas…</div>
            : !facturas.length ? <div className={s.hint} style={{ margin: 0 }}>No le debés ninguna factura: el echeq queda a cuenta y se imputa después con «Facturas».</div>
              : (
                <div style={cajaTildes(220)}>
                  {facturas.map((d) => {
                    const marcada = tildadas.has(d.docId);
                    return (
                      <FilaTilde
                        key={d.docId} marcado={marcada} onClick={() => alternar(d)}
                        disabled={d.libre <= 0.009 && !marcada} valor={money(d.libre)}
                      >
                        <span style={{ fontWeight: marcada ? 600 : 400 }}>{d.etiqueta}</span>
                        <span style={{ opacity: 0.65 }}>{' · '}{fmtFecha(d.fecha)}{d.libre < d.saldo - 0.009 ? ` · debe ${money(d.saldo)}` : ''}</span>
                        <EcheqsDeFactura d={d} />
                      </FilaTilde>
                    );
                  })}
                </div>
              )}
          {elegidas.some((d) => echeqsDeFactura(d).pendientes.length) && (
            <div className={s.hint} style={{ margin: 0 }}>
              Las que tienen un echeq pendiente de hacer: este lo reemplaza (el pendiente se da de baja solo).
            </div>
          )}
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
          <input
            type="number" min="0" step="0.01"
            value={editando || importeAMano ? f.importe : (sumaLibre > 0 ? String(sumaLibre) : '')}
            onChange={(e) => { setImporteAMano(true); setF((x) => ({ ...x, importe: e.target.value })); }}
            placeholder={prov ? 'Lo que suman las tildadas' : ''}
          />
          {cubre > 0.009 && (
            <div className={s.hint} style={{ margin: '6px 0 0' }}>
              Cubre {money(cubre)} de sus facturas: no puede ser de menos.
            </div>
          )}
          {!editando && importeAMano && sumaLibre > 0 && Math.abs(importe - sumaLibre) > 0.009 && (
            <Btn small onClick={() => setImporteAMano(false)} style={{ marginTop: 6 }}>Usar lo tildado ({money(sumaLibre)})</Btn>
          )}
          {!editando && prov && (reparto.length > 0 || sinFactura > 0.009) && (
            <div className={s.hint} style={{ margin: '6px 0 0' }}>
              {reparto.map((x) => <div key={x.comprobanteId}>Cubre {x.etiqueta} · {money(x.cubre)}</div>)}
              {sinFactura > 0.009 && <div>Sin factura: {money(sinFactura)} (al cobrarse va a cuenta)</div>}
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
 * Es donde se HACE (7/11/2026): arriba, el CUIT y el correo que pide el home
 * banking, para copiarlos. Si su factura se pagó en parte por otro medio, el
 * pendiente ya viene por lo que falta.
 */
export function ConfirmarEcheqModal({ echeq, onChange }) {
  const { proveedores, act, closeModal, toast } = useProveedores();
  const prov = proveedores.find((p) => p.id === echeq.proveedorId);
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
      title={`Hacer el echeq a ${echeq.aNombreDe}`}
      subtitle={`Pendiente por ${money(echeq.importe)}: hacelo en el home banking y cargá acá sus datos`}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Sí, lo hice: confirmar', clase: 'btn-primary', onClick: confirmar },
      ]}
    >
      <div className={s.field}>
        <label>Para el home banking</label>
        <DatosParaElBanco prov={prov} />
      </div>
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
