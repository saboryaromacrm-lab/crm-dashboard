import { useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../../context/ProductosContext.jsx';
import { money, num } from '../../domain/format.js';
import { TIPOS_MOV } from '../../domain/constants.js';
import { ModalShell } from '../Modal.jsx';
import { sucursalOptions, presentacionOptions } from '../selectOptions.jsx';
import { s } from '../ui.jsx';
import { SelectorOperador, useOperadoresFraccion } from '../OperadorFraccion.jsx';
import { AvisoMomento, CamposMomento, useMomentoFraccion } from '../MomentoFraccion.jsx';

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
    /* Misma trampa que en Fraccionar: `cant` es el texto del input y el DTO
     * pide `@IsNumber()`. Acá NO se redondea —un granel se vende por peso y
     * 0,5 kg es una venta válida— y el vacío queda en 0, que el servidor
     * rechaza por el mínimo con un mensaje que sí se entiende. */
    const cantidad = Number(cant) || 0;
    const res = await store.opVenta({ productoId: prod.id, sucursalId: parseInt(sucId, 10), presId: presNum, cantidad });
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
  const { store, act, closeModal, toast, sucOperativa } = useProductos();
  const prod = store.getProducto(prodId);
  const pres = prod ? (prod.presentaciones || []).find((x) => x.id === presId) : null;

  /* La sucursal en la que se VA A CORREGIR: la del que entró (el servidor usa
   * esa). Antes arrancaba en la distribuidora y, entrando desde otra sucursal,
   * se miraban los números de una y se corregía la otra. */
  const [sucId, setSucId] = useState(String(sucInit || sucOperativa() || ''));
  const suc = parseInt(sucId, 10);
  const actual = store.cant(prodId, suc, presId, 'disponible');
  const [real, setReal] = useState(String(Math.round(actual)));
  const [motivo, setMotivo] = useState('');
  /* Al BAJAR, qué pasó con los paquetes que faltan (25/9/2026): 'conteo' los
   * devuelve al granel, 'faltante' los da de baja como merma. Sin elegir no se
   * guarda: bajar a 0 devolvía los kilos al granel sin preguntar. */
  const [causa, setCausa] = useState('');
  const ops = useOperadoresFraccion(suc);
  const [operadorId, setOperadorId] = useState(null);
  const momento = useMomentoFraccion();
  const [guardando, setGuardando] = useState(false);

  // Al cambiar de sucursal, el "hay" es otro: el campo lo sigue.
  const cambiarSuc = (v) => {
    setSucId(v);
    setReal(String(Math.round(store.cant(prodId, parseInt(v, 10), presId, 'disponible'))));
  };

  if (!prod || !pres) return null;

  const comprometido = store.cant(prodId, suc, presId, 'comprometido');
  const granel = store.cant(prodId, suc, null, 'disponible');
  const n = Math.round(Number(real));
  const valido = real !== '' && Number.isFinite(n) && n >= 0;
  const delta = valido ? n - Math.round(actual) : 0;
  const kg = Math.abs(delta) * (pres.tamKg || 0);
  const faltaGranel = delta > 0 && kg > granel + 1e-9;
  const baja = delta < 0;
  const esMerma = baja && causa === 'faltante';
  /* Subir es fraccionar más: el operador se pide igual que al registrar. */
  const pideOperador = delta > 0 && ops.disponibles.length > 0;

  const problema = !valido ? 'Poné cuántos paquetes hay (0 o más).'
    : delta === 0 ? 'Ya están cargados esos paquetes: no hay nada que corregir.'
      : faltaGranel ? 'No alcanza el granel para llegar a esa cantidad.'
        : baja && !causa ? 'Elegí qué pasó con los paquetes que faltan.'
          : baja && !motivo.trim() ? 'Contá en una línea qué pasó: queda en el historial.'
            : pideOperador && !operadorId ? 'Elegí quién fraccionó.'
              : !esMerma && momento.fechaMal ? 'Revisá el día y el turno.'
                : null;

  const guardar = async () => {
    if (problema) { toast(problema, 'err'); return; }
    if (guardando) return;
    setGuardando(true);
    try {
      await act(
        store.opCorregirFraccionado({
          productoId: prodId, presId, sucursalId: suc, cantidadReal: n, motivo: motivo.trim(),
          ...(baja ? { causa } : {}),
          ...(esMerma ? {} : momento.payload),
          ...(operadorId && !esMerma ? { operadorId } : {}),
        }),
        esMerma ? `${-delta} paquete(s) dados de baja como merma.` : 'Corrección registrada.',
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ModalShell
      title={`Corregir fraccionado — ${prod.nombre} · ${store.presLabel(prod, presId)}`}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        {
          texto: guardando ? 'Guardando…' : esMerma ? 'Dar de baja como merma' : 'Corregir',
          clase: problema ? 'btn-ghost' : (esMerma ? 'btn-delete' : 'btn-primary'),
          onClick: guardar,
          disabled: guardando,
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

      {baja && (
        <div className={s.field}>
          <label>¿Qué pasó con los {num(-delta, 0)} paquete(s) que faltan? <span className={s.req}>*</span></label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontWeight: 400 }}>
            <input type="radio" name="corr-causa" checked={causa === 'conteo'} onChange={() => setCausa('conteo')} />
            <span>Se cargaron de más: <strong>nunca se envasaron</strong>, los {num(kg, 3)} kg siguen en el granel.</span>
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontWeight: 400 }}>
            <input type="radio" name="corr-causa" checked={causa === 'faltante'} onChange={() => setCausa('faltante')} />
            <span>Se rompieron, se perdieron o faltan: <strong>van a merma</strong>, con su costo.</span>
          </label>
        </div>
      )}

      <div className={s.field}>
        <label>Motivo {baja && <span className={s.req}>*</span>}</label>
        <input
          value={motivo}
          maxLength={300}
          placeholder={esMerma ? 'se cayó una caja, no aparecen en el depósito…' : 'se cargó de más, salieron 19 y no 20…'}
          onChange={(e) => setMotivo(e.target.value)}
        />
      </div>

      {!esMerma && (
        <div className={s['form-grid']}>
          <CamposMomento m={momento} id="corr" />
        </div>
      )}
      {!esMerma && <AvisoMomento m={momento} style={{ marginTop: 8 }} />}
      {!esMerma && (
        pideOperador
          ? <SelectorOperador ops={ops} value={operadorId} onChange={setOperadorId} />
          : <SelectorOperador ops={ops} value={operadorId} onChange={setOperadorId} opcional label="¿De quién era la tanda?" />
      )}

      {/* La ecuación, en vivo: es lo que evita que esto se sienta magia. */}
      <div className={cx(s.callout, faltaGranel || esMerma ? s.warn : delta === 0 ? s.info : s.ok)}>
        {!valido && 'Poné cuántos paquetes hay (0 o más).'}
        {valido && delta === 0 && <>Ya están cargados <strong>{num(actual, 0)}</strong>: no hay nada que corregir.</>}
        {valido && baja && !causa && <>Se bajan <strong>{num(-delta, 0)} paquete(s)</strong>. Elegí arriba qué pasó con ellos.</>}
        {valido && baja && causa === 'conteo' && (
          <>
            Se dan de baja <strong>{num(-delta, 0)} paquete(s)</strong> y{' '}
            <strong>{num(kg, 3)} kg</strong> vuelven al granel — que quedaría en{' '}
            <strong>{num(granel + kg, 3)} kg</strong>. Los kilos totales del producto no cambian.
          </>
        )}
        {valido && esMerma && (
          <>
            Se dan de baja <strong>{num(-delta, 0)} paquete(s)</strong> como <strong>merma</strong>. El granel
            no cambia (<strong>{num(granel, 3)} kg</strong>): esa mercadería se perdió y queda con su costo.
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
    </ModalShell>
  );
}

/* ============================== MOVIMIENTO SIMPLE ============================== */
export function MovimientoModal({ prodId, sucId: sucInit, pre = {} }) {
  const { store, act, closeModal, toast, sucOperativa } = useProductos();
  const prod = store.getProducto(prodId);
  const tipos = store.tiposMovPermitidos();

  // `pre.tipo` viene de quien abre (el "Ajustar" de Existencias preselecciona
  // el ajuste); si el rol no tiene ese tipo, cae al primero permitido.
  const [tipo, setTipo] = useState(pre.tipo && tipos.includes(pre.tipo) ? pre.tipo : (tipos[0] || ''));
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

  const registrar = () => {
    /* El ajuste EXIGE el motivo (la API también lo rechaza sin él): un número
     * corregido sin porqué es el que nadie puede explicar en el historial. */
    if (tipo === 'ajuste' && !motivo.trim()) {
      toast('Contá en una línea por qué se ajusta: es lo que queda en el historial.', 'err');
      return;
    }
    /* NÚMEROS, no el texto del input: el DTO del servidor valida estricto
     * (@IsNumber/@IsInt) y un "2" en string rebota con un error que habla de
     * constraints. Este modal quedó sin puerta de entrada un tiempo y el
     * desajuste no se vio hasta reabrirla (19/8/2026). */
    return act(
      store.opSimple({
        tipo, productoId: prod.id, sucursalId: parseInt(sucId, 10), presId: presNum,
        cantidad: Number(cant), signo: Number(dir), motivo: motivo.trim(),
      }),
      'Movimiento registrado.',
    );
  };

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
        <label>Motivo / referencia {tipo === 'ajuste' && <span className={s.req}>*</span>}</label>
        <input
          value={motivo}
          placeholder={tipo === 'ajuste' ? 'Obligatorio: por qué se corrige este número' : 'Ej: cliente, N° remito, observación…'}
          onChange={(e) => setMotivo(e.target.value)}
        />
      </div>
      <div className={cx(s.callout, bad ? s.warn : c > 0 ? s.ok : undefined)}>
        {bad
          ? `⚠ Stock disponible insuficiente (${store.fmtCant(prod, presNum, disp)}).`
          : <>Disponible: <strong>{store.fmtCant(prod, presNum, disp)}</strong>{c > 0 && <> → resultante <strong>{store.fmtCant(prod, presNum, Math.max(0, resultante))}</strong></>}</>}
      </div>
    </ModalShell>
  );
}
