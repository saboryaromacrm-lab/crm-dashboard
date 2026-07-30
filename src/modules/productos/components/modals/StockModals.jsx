import { useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../../context/ProductosContext.jsx';
import { money, num } from '../../domain/format.js';
import { TIPOS_MOV } from '../../domain/constants.js';
import { ModalShell } from '../Modal.jsx';
import { sucursalOptions, productoOptions, presentacionOptions, proveedorOptions } from '../selectOptions.jsx';
import { s } from '../ui.jsx';

/* ============================== COMPRA ============================== */
export function CompraModal({ prodId }) {
  const { store, act, closeModal, sucOperativa } = useProductos();
  const [pid, setPid] = useState(prodId ?? store.state.productos[0]?.id ?? '');
  const [sucId, setSucId] = useState(sucOperativa() ?? '');
  const [cant, setCant] = useState('');
  const [venc, setVenc] = useState('');
  const [provId, setProvId] = useState('');

  const prod = store.getProducto(parseInt(pid, 10));
  const unidad = prod && prod.tipo === 'granel' ? 'kg' : 'u.';

  const registrar = () =>
    act(
      store.opCompra({
        productoId: parseInt(pid, 10),
        sucursalId: parseInt(sucId, 10),
        cantidad: cant,
        fechaVencimiento: venc || null,
        proveedorId: provId ? parseInt(provId, 10) : null,
      }),
      'Compra registrada.',
    );

  return (
    <ModalShell
      title="Compra / ingreso de mercadería"
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Registrar compra', clase: 'btn-primary', onClick: registrar },
      ]}
    >
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Producto <span className={s.req}>*</span></label>
          <select value={pid} onChange={(e) => setPid(e.target.value)}>{productoOptions(store, false)}</select>
        </div>
        <div className={s.field}>
          <label>Sucursal de ingreso <span className={s.req}>*</span></label>
          <select value={sucId} onChange={(e) => setSucId(e.target.value)}>{sucursalOptions(store, false)}</select>
          <div className={s.hint}>La mercadería ingresa normalmente por la Distribuidora.</div>
        </div>
      </div>
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Cantidad ({unidad}) <span className={s.req}>*</span></label>
          <input type="number" min="0" step="0.001" value={cant} placeholder="Ej: 25" onChange={(e) => setCant(e.target.value)} />
        </div>
        <div className={s.field}>
          <label>Proveedor</label>
          <select value={provId} onChange={(e) => setProvId(e.target.value)}>{proveedorOptions(store)}</select>
        </div>
      </div>
      <div className={s.field}>
        <label>Vencimiento (informativo)</label>
        <input type="date" value={venc} onChange={(e) => setVenc(e.target.value)} />
        <div className={s.hint}>Se registra en el historial del movimiento.</div>
      </div>
    </ModalShell>
  );
}

/* ============================== VENDER ============================== */
export function VenderModal({ prodId, sucId: sucInit, pre = {} }) {
  const { store, closeModal, toast, sucOperativa } = useProductos();
  const prod = store.getProducto(prodId);
  const granel = prod.tipo === 'granel';
  const [sucId, setSucId] = useState(sucInit || sucOperativa());
  const [presId, setPresId] = useState(pre.presId != null ? String(pre.presId) : '');
  const [cant, setCant] = useState('');

  const presNum = granel && presId ? parseInt(presId, 10) : null;
  const disp = store.cant(prod.id, parseInt(sucId, 10), presNum, 'disponible');
  const unidad = store.unidadDe(prod, presNum);
  const unitLabel = unidad === 'kg' ? 'kg' : presNum ? 'paquetes' : 'unidades';
  const precio = presNum ? store.precioPresentacion(prod, presNum) : store.precioBaseVenta(prod);
  const importe = (parseFloat(cant) || 0) * precio;

  const registrar = () => {
    const res = store.opVenta({ productoId: prod.id, sucursalId: parseInt(sucId, 10), presId: presNum, cantidad: cant });
    if (res.ok) { toast('Venta registrada · ' + money(res.importe), 'ok'); closeModal(); }
    else toast(res.error, 'err');
  };

  return (
    <ModalShell
      title={'Registrar venta — ' + prod.nombre}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Registrar venta', clase: 'btn-primary', onClick: registrar },
      ]}
    >
      <div className={s.field}>
        <label>Sucursal</label>
        <select value={sucId} onChange={(e) => setSucId(e.target.value)}>{sucursalOptions(store, false)}</select>
      </div>
      {granel && (
        <div className={s.field}>
          <label>Presentación</label>
          <select value={presId} onChange={(e) => setPresId(e.target.value)}>{presentacionOptions(prod, true)}</select>
          <div className={s.hint}>“Granel (kg)” = venta suelta por peso.</div>
        </div>
      )}
      <div className={s.field}>
        <label>Cantidad ({unitLabel}) <span className={s.req}>*</span></label>
        <input type="number" min="0" step={unidad === 'kg' ? '0.001' : '1'} value={cant} placeholder="0" onChange={(e) => setCant(e.target.value)} />
      </div>
      <div className={cx(s.callout, s.ok)}>
        Disponible: <strong>{store.fmtCant(prod, presNum, disp)}</strong> · Importe: <strong>{money(importe)}</strong>
      </div>
    </ModalShell>
  );
}

/* ============================== FRACCIONAR ============================== */
export function FraccionarModal({ prodId, sucId: sucInit }) {
  const { store, act, closeModal, sucOperativa } = useProductos();
  const prod = store.getProducto(prodId);
  const [sucId, setSucId] = useState(sucInit || sucOperativa());
  const [cants, setCants] = useState(() => Object.fromEntries(prod.presentaciones.map((pr) => [pr.id, '0'])));

  if (prod.tipo !== 'granel') return null;

  let total = 0;
  prod.presentaciones.forEach((pr) => { const q = Math.round(Number(cants[pr.id]) || 0); if (q > 0) total += q * pr.tamKg; });
  const disp = store.cant(prod.id, parseInt(sucId, 10), null, 'disponible');
  const rest = disp - total;
  const excede = rest < -1e-9;

  const fraccionar = () => {
    const asignaciones = prod.presentaciones.map((pr) => ({ presId: pr.id, cant: cants[pr.id] }));
    act(store.opFraccionar({ productoId: prod.id, sucursalId: parseInt(sucId, 10), asignaciones }), 'Fraccionamiento registrado.');
  };

  return (
    <ModalShell
      title={'Fraccionar — ' + prod.nombre}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Fraccionar', clase: 'btn-primary', onClick: fraccionar },
      ]}
    >
      <div className={s.field}>
        <label>Sucursal</label>
        <select value={sucId} onChange={(e) => setSucId(e.target.value)}>{sucursalOptions(store, false)}</select>
      </div>
      <div className={s['mini-label']}>Paquetes a armar por presentación</div>
      <div className={s['pres-list']}>
        {prod.presentaciones.map((pr) => (
          <div key={pr.id} className={s['pres-row']} style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div><div className={s['mini-label']}>{money(store.precioPresentacion(prod, pr))} · {num(pr.tamKg, 3)} kg</div></div>
            <div><input type="number" min="0" step="1" value={cants[pr.id]} onChange={(e) => setCants((c) => ({ ...c, [pr.id]: e.target.value }))} /></div>
          </div>
        ))}
      </div>
      <div className={cx(s.callout, excede ? s.warn : total > 0 ? s.ok : undefined)}>
        Granel disponible: <strong>{num(disp, 3)} kg</strong> · Total a fraccionar: <strong>{num(total, 3)} kg</strong> ·{' '}
        {excede
          ? '⚠ Excede el granel disponible.'
          : <>Quedarían <strong>{num(rest, 3)} kg</strong> a granel.</>}
      </div>
    </ModalShell>
  );
}

/* ============================== MOVIMIENTO SIMPLE ============================== */
export function MovimientoModal({ prodId, sucId: sucInit, pre = {} }) {
  const { store, act, closeModal, sucOperativa } = useProductos();
  const prod = store.getProducto(prodId);
  const tipos = store.tiposMovPermitidos();

  const [tipo, setTipo] = useState(tipos[0] || '');
  const [dir, setDir] = useState('-1');
  const [sucId, setSucId] = useState(sucInit || sucOperativa());
  const [presId, setPresId] = useState(pre.presId != null ? String(pre.presId) : '');
  const [cant, setCant] = useState('');
  const [motivo, setMotivo] = useState('');

  if (!tipos.length) return null;

  const granel = prod.tipo === 'granel';
  const presNum = granel && presId ? parseInt(presId, 10) : null;
  const dirLibre = TIPOS_MOV[tipo].dir === 0;
  const unidad = store.unidadDe(prod, presNum);
  const unitLabel = unidad === 'kg' ? 'kg' : presNum ? 'paquetes' : 'unidades';

  let signo = TIPOS_MOV[tipo].dir; if (signo === 0) signo = Number(dir);
  const disp = store.cant(prod.id, parseInt(sucId, 10), presNum, 'disponible');
  const c = Number(cant) || 0;
  const resultante = disp + signo * c;
  const bad = resultante < -1e-9 && signo < 0;

  const registrar = () =>
    act(
      store.opSimple({
        tipo, productoId: prod.id, sucursalId: parseInt(sucId, 10), presId: presNum,
        cantidad: cant, signo: dir, motivo: motivo.trim(),
      }),
      'Movimiento registrado.',
    );

  return (
    <ModalShell
      title={'Registrar movimiento — ' + prod.nombre}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Registrar', clase: 'btn-primary', onClick: registrar },
      ]}
    >
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Tipo <span className={s.req}>*</span></label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {tipos.map((t) => <option key={t} value={t}>{TIPOS_MOV[t].label}</option>)}
          </select>
        </div>
        {dirLibre && (
          <div className={s.field}>
            <label>Dirección</label>
            <select value={dir} onChange={(e) => setDir(e.target.value)}>
              <option value="-1">Salida (−)</option>
              <option value="1">Entrada (+)</option>
            </select>
          </div>
        )}
      </div>
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Sucursal</label>
          <select value={sucId} onChange={(e) => setSucId(e.target.value)}>{sucursalOptions(store, false)}</select>
        </div>
        {granel && (
          <div className={s.field}>
            <label>Presentación</label>
            <select value={presId} onChange={(e) => setPresId(e.target.value)}>{presentacionOptions(prod, true)}</select>
          </div>
        )}
      </div>
      <div className={s.field}>
        <label>Cantidad ({unitLabel}) <span className={s.req}>*</span></label>
        <input type="number" min="0" step={unidad === 'kg' ? '0.001' : '1'} value={cant} placeholder="0" onChange={(e) => setCant(e.target.value)} />
      </div>
      <div className={s.field}>
        <label>Motivo / referencia</label>
        <input value={motivo} placeholder="Ej: cliente, N° remito, observación…" onChange={(e) => setMotivo(e.target.value)} />
      </div>
      <div className={cx(s.callout, bad ? s.warn : c > 0 ? s.ok : undefined)}>
        {bad
          ? `⚠ Stock disponible insuficiente (${store.fmtCant(prod, presNum, disp)}).`
          : <>Disponible: <strong>{store.fmtCant(prod, presNum, disp)}</strong>{c > 0 && <> → resultante <strong>{store.fmtCant(prod, presNum, Math.max(0, resultante))}</strong></>}</>}
      </div>
    </ModalShell>
  );
}
