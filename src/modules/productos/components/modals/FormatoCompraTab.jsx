/**
 * FORMATO DE COMPRA — cómo entra el producto
 * ============================================================================
 * Simétrico al Formato de Venta: allá se define cómo SALE (lista y markup),
 * acá cómo ENTRA (bulto, costo, escala de descuentos y flete). Se tocan en un
 * solo punto: el **costo neto unitario** del formato marcado alimenta el
 * markup, y de ahí sale el precio.
 *
 * Un producto puede tener varios formatos, incluso del mismo proveedor (caja
 * x12 y caja x24), y **uno solo** fija el precio.
 *
 * Tres decisiones de esta pantalla:
 *
 *   · El **descuento efectivo** se muestra calculado. La escala es en cascada:
 *     "30 y 10" es 37%, no 40%. Sumarlos de cabeza es el error caro y silencioso
 *     que este número existe para evitar.
 *   · El modo de carga es un **interruptor visible**. El sistema viejo cambiaba
 *     de modo cuando el costo de lista quedaba en 0: alguien lo borraba para
 *     corregir un tipeo y cambiaba el cálculo entero sin enterarse.
 *   · El **Costo Final lleva IVA y es informativo** — sirve para conciliar
 *     contra la factura. El precio se calcula desde el neto; usar el final
 *     contaría el IVA dos veces y el número resultante sería plausible.
 *   · El **% sin factura** (0072) parte el costo en dos: el REAL (valúa stock
 *     y pérdidas) y la BASE DEL PRECIO, con la parte sin factura despojada del
 *     IVA que el negocio absorbe al vender. Es el "descuento del 17,36%" del
 *     sistema viejo hecho cuenta — por alícuota, sin tipear nada. Se precarga
 *     del proveedor (su ficha declara qué emite) y acá se ajusta por producto.
 */
import { useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../../context/ProductosContext.jsx';
import { money, num } from '../../domain/format.js';
import { Btn, s } from '../ui.jsx';

/** Fila de la cadena derivada. `fuerte` marca los dos números que importan. */
function Paso({ label, valor, fuerte, tenue }) {
  return (
    <div className={cx(s.pasoFila, fuerte && s.pasoFuerte)}>
      <span className={tenue ? s.muted : undefined}>{label}</span>
      <span className={s.mono}>{valor}</span>
    </div>
  );
}

function FormatoCard({ prod, fila, i, onChange, onQuitar, onActivar, proveedores, esAdmin }) {
  const { store } = useProductos();
  const c = store.costosFormato(fila, prod.iva);
  const porLista = fila.modoCosto !== 'final';
  const unidad = prod.tipo === 'granel' ? '/kg' : '/u';
  const sinFactura = c.porcSinFactura > 0;
  const set = (patch) => onChange(i, patch);

  /*
   * Cambiar el proveedor precarga SU % sin factura (la ficha declara qué
   * emite: liquidación pura = 100 aunque nadie haya tipeado el número). Solo
   * al cambiar — un guardado no puede pisar lo que se ajustó a mano.
   */
  const setProveedor = (proveedorId) => {
    const pv = proveedores.find((x) => x.id === proveedorId);
    const porc = Number(pv?.porcSinFactura) || (pv?.condicionCompra === 'liquidacion' ? 100 : 0);
    set({ proveedorId, porcSinFactura: porc ? String(porc) : '' });
  };

  return (
    <div className={cx(s.card, s.cardPad, fila.usarParaPrecio && s.formatoActivo)}>
      {/* Cabecera: quién, con qué código, y si es el que manda. */}
      <div className={s.formatoHead}>
        <label className={s.formatoRadio} title="Este formato define el costo con el que se calcula el precio">
          <input
            type="radio"
            name="formato-precio"
            checked={!!fila.usarParaPrecio}
            onChange={() => onActivar(i)}
            disabled={!esAdmin}
          />
          <span>Fija el precio</span>
        </label>

        <select
          value={fila.proveedorId}
          disabled={!esAdmin}
          onChange={(e) => setProveedor(Number(e.target.value))}
        >
          {proveedores.map((pv) => <option key={pv.id} value={pv.id}>{pv.nombre}</option>)}
        </select>

        <input
          value={fila.codigoProveedor}
          disabled={!esAdmin}
          placeholder="Código del proveedor"
          onChange={(e) => set({ codigoProveedor: e.target.value })}
        />

        <div className={s.formatoNeto}>
          {/* Con % sin factura los dos costos difieren: el fuerte es la BASE
              del precio (lo que multiplica el markup) y el real queda al lado
              — mostrarlos juntos es lo que hace visible el IVA absorbido. */}
          <div className={s['mini-label']}>{sinFactura ? 'Base del precio' : 'Costo neto unitario'}</div>
          <strong className={s.mono}>{money(c.costoPrecioUnitario)} {unidad}</strong>
          {sinFactura && (
            <div className={s.hint} style={{ margin: 0 }}>real {money(c.costoNetoUnitario)} {unidad}</div>
          )}
        </div>

        {esAdmin && (
          <button type="button" className={s['pres-remove']} onClick={() => onQuitar(i)} title="Quitar formato">×</button>
        )}
      </div>

      <div className={s.formatoBody}>
        {/* --- Entrada --- */}
        <div>
          <div className={s['form-grid']}>
            <div className={s.field}>
              {/* El bulto de un granel se mide en kilos; el de un entero, en
                  unidades. La etiqueta lo dice para que nadie cargue 25 bolsas
                  donde van 25 kg. */}
              <label>
                {prod.tipo === 'granel' ? 'Kg por bulto' : 'Unidades por bulto'} <span className={s.req}>*</span>
              </label>
              <input
                type="number" min="0" step="any" value={fila.cantidad} disabled={!esAdmin}
                onChange={(e) => set({ cantidad: e.target.value })}
              />
              <div className={s.hint} style={{ margin: '6px 0 0' }}>
                {prod.tipo === 'granel'
                  ? 'Kilos que trae la bolsa o el bulto (admite decimales: 22,68). Es la referencia — si una entrega viene distinta, se corrige en la factura.'
                  : 'Unidades que trae. Es lo que hace comparables dos proveedores con bultos distintos.'}
              </div>
            </div>
            <div className={s.field}>
              <label>Cómo se carga el costo</label>
              <select
                value={fila.modoCosto} disabled={!esAdmin}
                onChange={(e) => set({ modoCosto: e.target.value })}
              >
                <option value="lista">Costo de lista — el sistema calcula</option>
                <option value="final">Costo final con IVA — cargado directo</option>
              </select>
            </div>
          </div>

          {porLista ? (
            <>
              <div className={s.field}>
                <label>Costo de lista del bulto</label>
                <input
                  type="number" min="0" step="0.001" value={fila.costo} placeholder="0" disabled={!esAdmin}
                  onChange={(e) => set({ costo: e.target.value })}
                />
              </div>
              <div className={s['mini-label']} style={{ marginBottom: 6 }}>
                Escala de descuentos (se aplican en cascada)
              </div>
              <div className={s.escalaGrid}>
                {['descuento', 'descuento2', 'descuento3', 'descuento4'].map((k, n) => (
                  <input
                    key={k} type="number" min="0" max="100" step="0.01" disabled={!esAdmin}
                    value={fila[k]} placeholder={`% ${n + 1}`}
                    onChange={(e) => set({ [k]: e.target.value })}
                  />
                ))}
              </div>
              <div className={s['form-grid']} style={{ marginTop: 12 }}>
                <div className={s.field}>
                  <label>Flete %</label>
                  <input
                    type="number" min="0" step="0.01" value={fila.flete} placeholder="0" disabled={!esAdmin}
                    onChange={(e) => set({ flete: e.target.value })}
                  />
                </div>
                <div className={s.field}>
                  <label>Sin factura %</label>
                  <input
                    type="number" min="0" max="100" step="0.01" value={fila.porcSinFactura} placeholder="0" disabled={!esAdmin}
                    onChange={(e) => set({ porcSinFactura: e.target.value })}
                  />
                  <div className={s.hint} style={{ margin: '6px 0 0' }}>
                    Qué parte de la <strong>mercadería</strong> viene en liquidación: 100 = todo, 50 = mitad y mitad.
                    A esa parte el sistema le quita el IVA que vas a absorber al vender — el
                    "{prod.iva === 21 ? '17,36' : 'X'}%" de antes, calculado. El flete no entra: es tuyo.
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className={s.field}>
                <label>{sinFactura ? 'Lo que pagás por el bulto (papeles sumados)' : 'Costo final del bulto (con IVA)'}</label>
                <input
                  type="number" min="0" step="0.001" value={fila.costoFinal} placeholder="0" disabled={!esAdmin}
                  onChange={(e) => set({ costoFinal: e.target.value })}
                />
              </div>
              <div className={s.field}>
                <label>Sin factura %</label>
                <input
                  type="number" min="0" max="100" step="0.01" value={fila.porcSinFactura} placeholder="0" disabled={!esAdmin}
                  onChange={(e) => set({ porcSinFactura: e.target.value })}
                />
                <div className={s.hint} style={{ margin: '6px 0 0' }}>
                  Qué parte viene en liquidación. Solo la parte facturada trae IVA adentro del número.
                </div>
              </div>
              <div className={cx(s.callout, s.warn)}>
                En este modo <strong>los descuentos y el flete no se aplican</strong>: se toma el
                número tal como viene y el neto se deriva sacándole el IVA de la parte facturada.
              </div>
            </>
          )}
        </div>

        {/* --- Cadena derivada --- */}
        <div className={s.cadena}>
          <div className={s['mini-label']} style={{ marginBottom: 8 }}>Cadena de costos</div>
          {porLista ? (
            <>
              <Paso label="Costo de lista" valor={money(c.costoLista)} />
              <Paso label="Costo de lista unitario" valor={money(c.costoListaUnitario)} tenue />
              <Paso
                label={`Descuento efectivo (${num(c.descuentoEfectivo, 2)}%)`}
                valor={`− ${money(c.costoLista - c.costoBruto)}`}
              />
              <Paso label="Costo bruto (sin flete)" valor={money(c.costoBruto)} />
              <Paso label={`Flete (${num(fila.flete || 0, 2)}%)`} valor={`+ ${money(c.costoNeto - c.costoBruto)}`} />
            </>
          ) : (
            <Paso label="Costo final cargado" valor={money(c.costoFinal)} />
          )}

          <Paso label="Costo neto (con flete)" valor={money(c.costoNeto)} fuerte />
          {sinFactura ? (
            <>
              {/* El desglose del truco: el costo real, lo que se le paga al
                  proveedor, y la base que queda para el markup. El % corre
                  SOLO sobre la mercadería — el flete es tuyo y entra entero. */}
              <Paso label={`Sin factura (${num(c.porcSinFactura, 2)}%${c.costoNeto - c.costoBruto > 0.005 ? ', solo mercadería' : ''})`} valor={`− ${money(c.ivaAbsorbido)}`} />
              <Paso label="Base del precio (bulto)" valor={money(c.costoPrecio)} fuerte />
              <Paso label="Le pagás al proveedor" valor={money(c.desembolso)} tenue />
              {c.costoNeto - c.costoBruto > 0.005 && (
                <Paso label="Y el flete lo pagás vos, aparte" valor={money(c.costoNeto - c.costoBruto)} tenue />
              )}
            </>
          ) : (
            <>
              <Paso label={`IVA (${num(prod.iva, 1)}%)`} valor={`+ ${money(c.costoFinal - c.costoNeto)}`} tenue />
              <Paso label="Costo final" valor={money(c.costoFinal)} tenue />
              <Paso label="Costo final unitario" valor={money(c.costoFinalUnitario)} tenue />
            </>
          )}

          <div className={s.cadenaCierre}>
            <div className={s['mini-label']}>{sinFactura ? 'Base del precio (unitaria)' : 'Costo neto unitario'}</div>
            <strong className={s.mono}>{money(c.costoPrecioUnitario)} {unidad}</strong>
            <div className={s.hint} style={{ margin: '4px 0 0' }}>
              {sinFactura
                ? <>La única que alimenta el markup. El costo real es {money(c.costoNetoUnitario)} {unidad}:
                  la diferencia ({money(c.ivaAbsorbidoUnitario)} {unidad}) es IVA que absorbés al vender.</>
                : 'El único que alimenta el precio de venta.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FormatoCompraTab({ prod: p }) {
  const { store, isAdmin, toast } = useProductos();
  const proveedores = store.state.proveedores;

  // Los números se editan como texto: forzarlos a Number en cada tecla impide
  // borrar el campo o escribir "0," mientras se tipea.
  const [rows, setRows] = useState(() =>
    (p.formatosCompra || []).map((e) => ({
      id: e.id,
      proveedorId: e.proveedorId,
      codigoProveedor: e.codigoProveedor ?? '',
      cantidad: String(e.cantidad ?? 1),
      costo: String(e.costo ?? ''),
      descuento: String(e.descuento ?? ''),
      descuento2: String(e.descuento2 ?? ''),
      descuento3: String(e.descuento3 ?? ''),
      descuento4: String(e.descuento4 ?? ''),
      flete: String(e.flete ?? ''),
      modoCosto: e.modoCosto ?? 'lista',
      costoFinal: String(e.costoFinal ?? ''),
      porcSinFactura: e.porcSinFactura ? String(e.porcSinFactura) : '',
      usarParaPrecio: !!e.usarParaPrecio,
    })),
  );

  const onChange = (i, patch) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  /** Al quitar el que fijaba el precio, el primero que queda toma la posta. */
  const onQuitar = (i) => setRows((r) => {
    const next = r.filter((_, j) => j !== i);
    if (next.length && !next.some((x) => x.usarParaPrecio)) next[0] = { ...next[0], usarParaPrecio: true };
    return next;
  });

  const onActivar = (i) => setRows((r) => r.map((row, j) => ({ ...row, usarParaPrecio: j === i })));

  const agregar = () => {
    if (!proveedores.length) { toast('Primero creá proveedores en el menú Proveedores.', 'err'); return; }
    // El % sin factura arranca con el del proveedor: su ficha declara qué emite.
    const pv = proveedores[0];
    const porc = Number(pv?.porcSinFactura) || (pv?.condicionCompra === 'liquidacion' ? 100 : 0);
    setRows((r) => [...r, {
      proveedorId: pv.id, codigoProveedor: '', cantidad: '1',
      costo: '', descuento: '', descuento2: '', descuento3: '', descuento4: '', flete: '',
      modoCosto: 'lista', costoFinal: '', porcSinFactura: porc ? String(porc) : '',
      usarParaPrecio: r.length === 0,
    }]);
  };

  const guardar = async () => {
    if (rows.some((r) => !(Number(r.cantidad) > 0))) {
      toast('La cantidad por bulto tiene que ser mayor a cero.', 'err');
      return;
    }
    const res = await store.guardarFormatosCompra(p.id, rows);
    toast(res.ok ? 'Formato de compra guardado.' : res.error, res.ok ? 'ok' : 'err');
  };

  return (
    <div className={s.form}>
      <div className={cx(s.callout, s.info)}>
        Cómo <strong>entra</strong> el producto. Puede haber varios formatos —incluso del mismo
        proveedor, como caja x12 y caja x24— y <strong>uno solo fija el precio</strong>: su costo
        neto unitario es el que multiplica el markup del Formato de Venta.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3)' }}>
        {rows.map((fila, i) => (
          <FormatoCard
            key={fila.id ?? `nuevo-${i}`}
            prod={p} fila={fila} i={i}
            onChange={onChange} onQuitar={onQuitar} onActivar={onActivar}
            proveedores={proveedores} esAdmin={isAdmin}
          />
        ))}
        {!rows.length && (
          <div className={s['empty-state']}>
            Sin formatos de compra. Sin al menos uno, el producto no tiene costo y no se le puede
            calcular precio.
          </div>
        )}
      </div>

      {isAdmin && (
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <Btn variant="btn-ghost" small onClick={agregar}>+ Agregar formato</Btn>
          <Btn variant="btn-primary" small onClick={guardar}>Guardar</Btn>
        </div>
      )}
    </div>
  );
}
