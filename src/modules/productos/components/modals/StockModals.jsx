import { useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../../context/ProductosContext.jsx';
import { money, num } from '../../domain/format.js';
import { TIPOS_MOV } from '../../domain/constants.js';
import { ModalShell } from '../Modal.jsx';
import { sucursalOptions, presentacionOptions } from '../selectOptions.jsx';
import { s } from '../ui.jsx';

/*
 * SIN modal de compra (18/8/2026, pedido del dueño): la mercadería entra por la
 * FACTURA en Compras, que es la que trae el costo, el proveedor y la deuda. El
 * ingreso a mano sumaba stock sin papel detrás y el costo quedaba viejo.
 */

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
  /* El precio de un paquete es SUYO y lo trae la API; `null` = sin formato de
   * venta cargado, y entonces no se puede vender (la API también lo rechaza). */
  const precio = presNum ? store.precioPaquete(prod, presNum) : store.precioBaseVenta(prod);
  const sinPrecio = presNum != null && precio == null;
  const importe = (parseFloat(cant) || 0) * (precio || 0);

  const registrar = async () => {
    const res = await store.opVenta({ productoId: prod.id, sucursalId: parseInt(sucId, 10), presId: presNum, cantidad: cant });
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
      <div className={cx(s.callout, sinPrecio ? s.warn : s.ok)}>
        Disponible: <strong>{store.fmtCant(prod, presNum, disp)}</strong>
        {sinPrecio
          ? <> · ⚠ Este paquete <strong>no tiene precio cargado</strong>: cargale el formato de venta en su ficha antes de venderlo.</>
          : <> · Importe: <strong>{money(importe)}</strong></>}
      </div>
    </ModalShell>
  );
}

/* ============================== FRACCIONAR ============================== */
export function FraccionarModal({ prodId, sucId: sucInit }) {
  const { store, act, closeModal } = useProductos();
  const prod = store.getProducto(prodId);
  // Todo se fracciona en la DISTRIBUIDORA (ahí llega la mercadería a granel):
  // no se elige sucursal. Si la fila que abrió el modal trae otra, se respeta.
  const sucId = sucInit || store.distribuidora()?.id || store.state.ctx.sucursalId;
  const [cants, setCants] = useState(() => Object.fromEntries(prod.presentaciones.map((pr) => [pr.id, '0'])));

  if (prod.tipo !== 'granel') return null;

  let total = 0;
  prod.presentaciones.forEach((pr) => { const q = Math.round(Number(cants[pr.id]) || 0); if (q > 0) total += q * pr.tamKg; });
  const disp = store.cant(prod.id, parseInt(sucId, 10), null, 'disponible');
  const rest = disp - total;
  const excede = rest < -1e-9;
  /*
   * UN GRANEL PUEDE NO TENER NINGÚN TAMAÑO DEFINIDO, y es lo más común de lo
   * que parece: son 62 de los 164 granel activos. Sin esto, el modal abría con
   * la sección "Paquetes a armar" VACÍA y un botón Fraccionar que no podía
   * hacer nada — se lee como "me pide el tamaño y no me da las opciones", que
   * es exactamente lo que pasa. La pantalla ahora dice qué falta y dónde se
   * carga, en vez de dejar al usuario adivinando.
   */
  const sinTamanos = !prod.presentaciones.length;

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
        {
          texto: 'Fraccionar',
          clase: 'btn-primary',
          onClick: fraccionar,
          // Sin tamaños no hay nada que armar; con el total en 0 tampoco, y
          // excediendo el granel el servidor lo rechaza igual.
          disabled: sinTamanos || excede || !(total > 0),
        },
      ]}
    >
      <div className={s.field}>
        <label>Se fracciona en</label>
        <strong style={{ fontSize: 14 }}>{store.getSucursal(parseInt(sucId, 10))?.nombre ?? '—'}</strong>
      </div>

      {sinTamanos && (
        <div className={cx(s.callout, s.warn)}>
          <strong>{prod.nombre} no tiene tamaños de paquete definidos</strong>, así que todavía no
          se puede fraccionar: el sistema no sabe de cuántos kilos es cada paquete.
          <div className={s.hint} style={{ margin: '6px 0 0' }}>
            Se cargan en <strong>Compras › Productos</strong>, abriendo este producto, en la
            pestaña <strong>Presentaciones</strong>: ahí se define cada tamaño (500 g, 1 kg…) con
            su código de barras. Después el paquete se precia en su propia ficha.
          </div>
        </div>
      )}

      {!sinTamanos && <div className={s['mini-label']}>Paquetes a armar por presentación</div>}
      <div className={s['pres-list']}>
        {prod.presentaciones.map((pr) => (
          <div key={pr.id} className={s['pres-row']} style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <div className={s['mini-label']}>
                {pr.precioFinal != null
                  ? money(pr.precioFinal)
                  : <span style={{ color: 'var(--crm-color-danger)' }}>sin precio</span>}
                {' · '}{num(pr.tamKg, 3)} kg
              </div>
            </div>
            <div><input type="number" min="0" step="1" value={cants[pr.id]} onChange={(e) => setCants((c) => ({ ...c, [pr.id]: e.target.value }))} /></div>
          </div>
        ))}
      </div>
      {/* El resumen de kilos no tiene nada que resumir sin tamaños: repetir
          "total 0 kg" al lado del aviso solo agrega ruido. */}
      {!sinTamanos && (
        <div className={cx(s.callout, excede ? s.warn : total > 0 ? s.ok : undefined)}>
          Granel disponible: <strong>{num(disp, 3)} kg</strong> · Total a fraccionar: <strong>{num(total, 3)} kg</strong> ·{' '}
          {excede
            ? '⚠ Excede el granel disponible.'
            : <>Quedarían <strong>{num(rest, 3)} kg</strong> a granel.</>}
        </div>
      )}
    </ModalShell>
  );
}

/* ========================= CORREGIR UN FRACCIONADO ========================= *
 *
 * "Puse 20 paquetes de 500 g y son 19." La corrección mueve las DOS puntas —los
 * paquetes y el granel del que salieron— porque el fraccionamiento no crea ni
 * destruye mercadería: la convierte. Si solo se editaran los paquetes, los kilos
 * totales del producto cambiarían de la nada y el inventario mentiría.
 *
 * Es para el ERROR DE CARGA. Un paquete roto o perdido es una merma: ahí la
 * mercadería no volvió al granel y tiene que quedar registrada como pérdida.
 */
export function CorregirFraccionadoModal({ prodId, presId, sucId: sucInit }) {
  const { store, act, closeModal } = useProductos();
  const prod = store.getProducto(prodId);
  const pres = prod ? (prod.presentaciones || []).find((x) => x.id === presId) : null;

  const [sucId, setSucId] = useState(String(sucInit || store.distribuidora()?.id || ''));
  const suc = parseInt(sucId, 10);
  const actual = store.cant(prodId, suc, presId, 'disponible');
  const [real, setReal] = useState(String(Math.round(actual)));
  const [motivo, setMotivo] = useState('');

  // Al cambiar de sucursal, el "hay" es otro: el campo lo sigue.
  const cambiarSuc = (v) => {
    setSucId(v);
    setReal(String(Math.round(store.cant(prodId, parseInt(v, 10), presId, 'disponible'))));
  };

  if (!prod || !pres) return null;

  const comprometido = store.cant(prodId, suc, presId, 'comprometido');
  const granel = store.cant(prodId, suc, null, 'disponible');
  const n = Math.round(Number(real));
  const valido = Number.isFinite(n) && n >= 0;
  const delta = valido ? n - Math.round(actual) : 0;
  const kg = Math.abs(delta) * (pres.tamKg || 0);
  const faltaGranel = delta > 0 && kg > granel + 1e-9;

  const guardar = () => {
    act(
      store.opCorregirFraccionado({ productoId: prodId, presId, sucursalId: suc, cantidadReal: n, motivo }),
      delta === 0 ? 'No había nada que corregir.' : 'Corrección registrada.',
    );
  };

  return (
    <ModalShell
      title={`Corregir fraccionado — ${prod.nombre} · ${store.presLabel(prod, presId)}`}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        {
          texto: 'Corregir',
          clase: valido && !faltaGranel && delta !== 0 ? 'btn-primary' : 'btn-ghost',
          onClick: guardar,
        },
      ]}
    >
      <div className={s.field}>
        <label>Sucursal</label>
        <select value={sucId} onChange={(e) => cambiarSuc(e.target.value)}>{sucursalOptions(store, false)}</select>
      </div>
      <div className={s.field}>
        <label>Paquetes que hay de verdad <span className={s.req}>*</span></label>
        <input type="number" min="0" step="1" value={real} onChange={(e) => setReal(e.target.value)} />
        <div className={s.hint}>
          El sistema tiene <strong>{num(actual, 0)}</strong> disponibles
          {comprometido > 0 && <> (y {num(comprometido, 0)} comprometidos en un envío, que no se tocan)</>}.
        </div>
      </div>
      <div className={s.field}>
        <label>Motivo</label>
        <input value={motivo} placeholder="se cargó de más, salieron 19 y no 20…" onChange={(e) => setMotivo(e.target.value)} />
      </div>

      {/* La ecuación, en vivo: es lo que evita que esto se sienta magia. */}
      <div className={cx(s.callout, faltaGranel ? s.warn : delta === 0 ? s.info : s.ok)}>
        {!valido && 'Poné cuántos paquetes hay (0 o más).'}
        {valido && delta === 0 && <>Ya están cargados <strong>{num(actual, 0)}</strong>: no hay nada que corregir.</>}
        {valido && delta < 0 && (
          <>
            Se dan de baja <strong>{num(-delta, 0)} paquete(s)</strong> y{' '}
            <strong>{num(kg, 3)} kg</strong> vuelven al granel — que quedaría en{' '}
            <strong>{num(granel + kg, 3)} kg</strong>. Los kilos totales del producto no cambian.
          </>
        )}
        {valido && delta > 0 && !faltaGranel && (
          <>
            Se agregan <strong>{num(delta, 0)} paquete(s)</strong> y se descuentan{' '}
            <strong>{num(kg, 3)} kg</strong> del granel — que quedaría en{' '}
            <strong>{num(granel - kg, 3)} kg</strong>.
          </>
        )}
        {faltaGranel && (
          <>
            ⚠ Para llegar a {num(n, 0)} paquetes hacen falta <strong>{num(kg, 3)} kg</strong> de granel y
            hay <strong>{num(granel, 3)} kg</strong>.
          </>
        )}
      </div>
      <div className={s.hint}>
        Esto es para un <strong>error de carga</strong>. Si el paquete se rompió o se perdió, cargalo como
        <strong> merma</strong> (Almacén › Operaciones) o abrí una <strong>incidencia</strong>: ahí la
        mercadería no volvió al granel y la pérdida tiene que quedar con su costo.
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
