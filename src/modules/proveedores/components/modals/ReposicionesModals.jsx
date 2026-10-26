import { useEffect, useRef, useState } from 'react';
import { useProveedores } from '../../context/ProveedoresContext.jsx';
import { errorMsg, provApi } from '../../services/proveedores.api.js';
import { Btn, ModalShell, Table, fmtFechaHora, money, num, s } from '../ui.jsx';

/**
 * CAMBIOS DE MERCADERÍA CON EL PROVEEDOR (0202, 26/10/2026, pedido del dueño):
 * mandarle lo que reconoce (vencidos, fallados), recibir lo que repone —otro
 * producto o sabor, todo o una parte— y ver el detalle. Se mide a COSTO: lo
 * mandado suma lo que te debe y lo repuesto lo descuenta, sea lo que sea.
 */

const ESPERA_BUSCAR_MS = 300;
const cant = (n, unidad) => `${num(n)} ${unidad}`;

/**
 * Los renglones de un envío o de una entrega: buscar entre los productos del
 * proveedor (o todos), sumar con un clic y poner la cantidad. Al mandar más de
 * lo que figura en el local avisa en rojo; corta solo si el control de stock
 * está prendido (lo decide la API, la misma regla que la caja).
 */
function Renglones({ proveedorId, renglones, setRenglones, paraMandar }) {
  const [buscar, setBuscar] = useState('');
  const [todos, setTodos] = useState(false);
  const [opciones, setOpciones] = useState([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!proveedorId) { setOpciones([]); return undefined; }
    let vigente = true;
    setCargando(true);
    const t = setTimeout(() => {
      provApi.productosReposicion({ proveedorId, buscar: buscar.trim() || undefined, todos: todos ? 1 : undefined })
        .then((r) => { if (vigente) setOpciones(r); })
        .catch(() => { if (vigente) setOpciones([]); })
        .finally(() => { if (vigente) setCargando(false); });
    }, ESPERA_BUSCAR_MS);
    return () => { vigente = false; clearTimeout(t); };
  }, [proveedorId, buscar, todos]);

  const clave = (o) => `${o.productoId}:${o.presentacionId ?? ''}`;
  const sumar = (o) => setRenglones((rs) => (rs.some((r) => clave(r) === clave(o)) ? rs : [...rs, { ...o, cantidad: '1' }]));
  const poner = (k, v) => setRenglones((rs) => rs.map((r) => (clave(r) === k ? { ...r, cantidad: v } : r)));
  const sacar = (k) => setRenglones((rs) => rs.filter((r) => clave(r) !== k));
  const total = renglones.reduce((a, r) => a + (Number(r.cantidad) || 0) * r.costoUnitario, 0);

  return (
    <>
      <div className={s.field}>
        <label htmlFor="repos-buscar">Productos</label>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            id="repos-buscar" type="search" value={buscar} onChange={(e) => setBuscar(e.target.value)} style={{ flex: '1 1 220px' }}
            placeholder={proveedorId ? 'Buscar por nombre…' : 'Elegí primero el proveedor'} disabled={!proveedorId}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} /> Buscar en todos los productos
          </label>
        </div>
        {proveedorId && (
          <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--crm-color-border)', borderRadius: 6, marginTop: 6 }}>
            {cargando && !opciones.length && <div className={s.hint} style={{ padding: 8, margin: 0 }}>Buscando…</div>}
            {!cargando && !opciones.length && (
              <div className={s.hint} style={{ padding: 8, margin: 0 }}>
                {buscar.trim() ? 'Sin resultados.' : 'Este proveedor no tiene productos cargados: tildá «Buscar en todos los productos».'}
              </div>
            )}
            {opciones.map((o) => (
              <button
                key={clave(o)} type="button" onClick={() => sumar(o)}
                style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: 8, padding: '6px 10px', border: 'none', borderBottom: '1px solid var(--crm-color-border)', background: 'none', cursor: 'pointer', textAlign: 'left', font: 'inherit', fontSize: 13 }}
              >
                <span>{o.nombre}</span>
                <span className={s.hint} style={{ margin: 0, whiteSpace: 'nowrap' }}>hay {cant(o.disponible, o.unidad)} · {money(o.costoUnitario)} c/u</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {renglones.length > 0 && (
        <Table cols={[{ h: 'Producto' }, { h: 'Cantidad' }, { h: 'Costo', num: true }, { h: '' }]}>
          {renglones.map((r) => {
            const k = clave(r);
            const pasa = paraMandar && (Number(r.cantidad) || 0) > r.disponible + 1e-9;
            return (
              <tr key={k}>
                <td>{r.nombre}{pasa && <div className={s.hint} style={{ margin: 0, color: 'var(--crm-color-danger)' }}>hay {cant(r.disponible, r.unidad)}</div>}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <input
                    type="number" min="0" step={r.unidad === 'kg' ? '0.001' : '1'} value={r.cantidad} style={{ width: 90 }}
                    onChange={(e) => poner(k, e.target.value)} onWheel={(e) => e.currentTarget.blur()} aria-label={`Cantidad de ${r.nombre}`}
                  /> {r.unidad}
                </td>
                <td className={s.num}>{money((Number(r.cantidad) || 0) * r.costoUnitario)}</td>
                <td><Btn small onClick={() => sacar(k)}>×</Btn></td>
              </tr>
            );
          })}
        </Table>
      )}
      {renglones.length > 0 && <div style={{ textAlign: 'right', fontWeight: 700 }}>Total a costo: {money(total)}</div>}
    </>
  );
}

/** Los renglones válidos para mandar a la API, o el motivo por el que no. */
function validar(renglones) {
  if (!renglones.length) return { error: 'Sumá al menos un producto.' };
  const malo = renglones.find((r) => !(Number(r.cantidad) > 0));
  if (malo) return { error: `Poné la cantidad de ${malo.nombre}.` };
  return { items: renglones.map((r) => ({ productoId: r.productoId, presentacionId: r.presentacionId, cantidad: Number(r.cantidad) })) };
}

/** «Mandar al proveedor»: sale del stock y queda lo que te debe. */
export function MandarReposicionModal({ proveedorId: inicial, onChange }) {
  const { proveedores, closeModal, toast } = useProveedores();
  const [proveedorId, setProveedorId] = useState(inicial ? String(inicial) : '');
  const [nota, setNota] = useState('');
  const [renglones, setRenglones] = useState([]);
  const enVuelo = useRef(false);

  const guardar = async () => {
    if (!proveedorId) { toast('Elegí el proveedor.', 'err'); return; }
    const v = validar(renglones);
    if (v.error) { toast(v.error, 'err'); return; }
    if (enVuelo.current) return;
    enVuelo.current = true;
    try {
      await provApi.mandarReposicion({ proveedorId: Number(proveedorId), nota: nota.trim(), items: v.items });
      toast('Listo: salió del stock y quedó pendiente lo que te debe.', 'ok');
      closeModal();
      onChange?.();
    } catch (e) { toast(errorMsg(e), 'err'); } finally { enVuelo.current = false; }
  };

  return (
    <ModalShell
      title="Mandar al proveedor"
      subtitle="Lo que le entregás para que te lo reponga (vencidos, fallados): sale del stock y queda lo que te debe, a costo."
      wide
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Mandar', clase: 'btn-primary', onClick: guardar },
      ]}
    >
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label htmlFor="repos-prov">Proveedor</label>
          <select id="repos-prov" value={proveedorId} onChange={(e) => { setProveedorId(e.target.value); setRenglones([]); }} autoFocus>
            <option value="">Elegí el proveedor</option>
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <div className={s.field}>
          <label htmlFor="repos-nota">Nota</label>
          <input id="repos-nota" value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} placeholder="Opcional (ej.: vencidos de octubre)" />
        </div>
      </div>
      <Renglones proveedorId={proveedorId} renglones={renglones} setRenglones={setRenglones} paraMandar />
    </ModalShell>
  );
}

/** «Recibir»: lo que trajo (lo que sea): entra al stock y descuenta lo que debe. */
export function RecibirReposicionModal({ reposicion, onChange }) {
  const { closeModal, toast } = useProveedores();
  const [renglones, setRenglones] = useState([]);
  const enVuelo = useRef(false);
  const trae = renglones.reduce((a, r) => a + (Number(r.cantidad) || 0) * r.costoUnitario, 0);
  const queda = reposicion.debe - trae;

  const guardar = async () => {
    const v = validar(renglones);
    if (v.error) { toast(v.error, 'err'); return; }
    if (enVuelo.current) return;
    enVuelo.current = true;
    try {
      const r = await provApi.recibirReposicion(reposicion.id, { items: v.items });
      toast(r.estado === 'completo' ? 'Recibido: el cambio quedó completo.' : `Recibido: todavía te debe ${money(r.debe)}.`, 'ok');
      closeModal();
      onChange?.();
    } catch (e) { toast(errorMsg(e), 'err'); } finally { enVuelo.current = false; }
  };

  return (
    <ModalShell
      title={`Recibir de ${reposicion.proveedorNombre}`}
      subtitle={`Te debe ${money(reposicion.debe)} a costo. Cargá lo que trajo: el mismo producto, otro sabor u otro producto, todo o una parte.`}
      wide
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Recibir', clase: 'btn-primary', onClick: guardar },
      ]}
    >
      <Renglones proveedorId={reposicion.proveedorId} renglones={renglones} setRenglones={setRenglones} paraMandar={false} />
      {renglones.length > 0 && (
        <div className={s.hint} style={{ margin: 0, textAlign: 'right' }}>
          {queda > 0.009 ? `Con esto todavía te debe ${money(queda)}: el cambio sigue pendiente.` : 'Con esto el cambio queda completo.'}
        </div>
      )}
    </ModalShell>
  );
}

/** El detalle: lo que se mandó y cada entrega que repuso, con su costo. */
export function DetalleReposicionModal({ id }) {
  const { closeModal, toast } = useProveedores();
  const [d, setD] = useState(null);
  useEffect(() => { provApi.reposicion(id).then(setD).catch((e) => { toast(errorMsg(e), 'err'); closeModal(); }); }, [id, toast, closeModal]);
  if (!d) return null;
  const nombre = (it) => `${it.nombre}${it.tamKg ? ` · ${it.tamKg >= 1 ? `${it.tamKg} kg` : `${Math.round(it.tamKg * 1000)} g`}` : ''}`;
  const unidad = (it) => (it.tipo === 'granel' && !it.presentacionId ? 'kg' : 'u');
  const fila = (it) => (
    <tr key={it.id}>
      <td>{nombre(it)}</td>
      <td>{cant(it.cantidad, unidad(it))}</td>
      <td className={s.num}>{money(it.subtotal)}</td>
    </tr>
  );
  const recepciones = d.items.filter((it) => it.sentido === 'recepcion');
  return (
    <ModalShell
      title={`Cambio #${d.id} · ${d.proveedorNombre}`}
      subtitle={`Mandado el ${fmtFechaHora(d.creadoEn)} desde ${d.sucursalNombre}${d.nota ? ` · ${d.nota}` : ''}`}
      wide
      onClose={closeModal}
      footer={[{ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal }]}
    >
      <div className={s['section-title']} style={{ margin: 0 }}>Lo que se le mandó · {money(d.mandado)}</div>
      <Table cols={[{ h: 'Producto' }, { h: 'Cantidad' }, { h: 'Costo', num: true }]}>
        {d.items.filter((it) => it.sentido === 'envio').map(fila)}
      </Table>
      <div className={s['section-title']} style={{ margin: 0 }}>Lo que repuso · {money(d.repuesto)}</div>
      {recepciones.length
        ? <Table cols={[{ h: 'Producto' }, { h: 'Cantidad' }, { h: 'Costo', num: true }]}>{recepciones.map(fila)}</Table>
        : <div className={s.hint} style={{ margin: 0 }}>Todavía no repuso nada.</div>}
      {recepciones.length > 0 && (
        <div className={s.hint} style={{ margin: 0 }}>Entregas: {[...new Set(recepciones.map((it) => fmtFechaHora(it.fecha)))].join(' · ')}</div>
      )}
      <div style={{ fontWeight: 700 }}>
        {d.estado === 'completo' ? `Completo: repuso todo (${fmtFechaHora(d.completadoEn)}).` : `Te debe ${money(d.debe)} a costo.`}
      </div>
    </ModalShell>
  );
}
