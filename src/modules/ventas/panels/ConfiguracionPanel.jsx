import { useEffect, useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useVentas } from '../context/VentasContext.jsx';
import { ventasApi } from '../services/ventas.api.js';
import { CONDICIONES_IVA, MEDIOS_PAGO, OPCIONES_REDONDEO, OPCIONES_REDONDEO_PRECIO } from '../domain/constants.js';
import { PanelHead, Btn, s } from '../components/ui.jsx';

/* ------------------------------------------------------------------ *
 * Piezas de formulario. Locales a propósito: solo esta pantalla las usa.
 * ------------------------------------------------------------------ */

function Seccion({ titulo, desc, children }) {
  return (
    <div className={cx(s.card, s.cardPad)}>
      <div className={s['card-title']}>{titulo}</div>
      {desc && <div className={s.desc} style={{ marginBottom: 'var(--crm-space-3)' }}>{desc}</div>}
      <div style={{ display: 'grid', gap: 'var(--crm-space-3)' }}>{children}</div>
    </div>
  );
}

/**
 * Interruptor con explicación al lado: la razón de cada opción se lee acá, no
 * en un manual aparte. El checkbox queda FUERA de `.field` porque esa clase
 * estira los inputs al 100%.
 */
function Interruptor({ label, hint, checked, onChange, disabled }) {
  return (
    <div style={{ marginBottom: 14, opacity: disabled ? 0.5 : 1 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer' }}>
        <input type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
      {hint && <div className={s.hint} style={{ margin: '4px 0 0 26px' }}>{hint}</div>}
    </div>
  );
}

function Campo({ label, hint, children }) {
  return (
    <div className={s.field}>
      <label>{label}</label>
      {children}
      {hint && <div className={s.hint} style={{ margin: '6px 0 0' }}>{hint}</div>}
    </div>
  );
}

/** Lista de textos editable (listas de precio, medios de pago habilitados). */
function ListaEditable({ valores, onChange, placeholder }) {
  const [nuevo, setNuevo] = useState('');
  const agregar = () => {
    const v = nuevo.trim();
    if (!v || valores.some((x) => x.toLowerCase() === v.toLowerCase())) { setNuevo(''); return; }
    onChange([...valores, v]);
    setNuevo('');
  };
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {valores.map((v) => (
          <span key={v} className={s.badge} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {v}
            <button
              type="button"
              className={s['pres-remove']}
              aria-label={`Quitar ${v}`}
              onClick={() => onChange(valores.filter((x) => x !== v))}
            >
              ×
            </button>
          </span>
        ))}
        {!valores.length && <span className={s.muted}>Ninguna.</span>}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={nuevo}
          placeholder={placeholder}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregar(); } }}
        />
        <Btn small onClick={agregar}>Agregar</Btn>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function ConfiguracionPanel() {
  const { config, recargar, toast, listasCatalogo } = useVentas();
  const [draft, setDraft] = useState(config);
  const [guardando, setGuardando] = useState(false);

  // La config llega con el bootstrap; al recargarla se rehidrata el borrador.
  useEffect(() => { setDraft(config); }, [config]);

  const set = (campo) => (valor) => setDraft((d) => ({ ...d, [campo]: valor }));
  const setNum = (campo) => (e) => setDraft((d) => ({ ...d, [campo]: Number(e.target.value) || 0 }));
  const setTxt = (campo) => (e) => setDraft((d) => ({ ...d, [campo]: e.target.value }));

  /** Solo se manda lo que cambió: el PUT es un merge parcial en el backend. */
  const cambios = useMemo(() => {
    const out = {};
    for (const [k, v] of Object.entries(draft)) {
      if (JSON.stringify(v) !== JSON.stringify(config[k])) out[k] = v;
    }
    return out;
  }, [draft, config]);
  const sucio = Object.keys(cambios).length > 0;

  const guardar = async () => {
    setGuardando(true);
    try {
      await ventasApi.guardarConfig(cambios);
      await recargar();
      toast('Configuración guardada.', 'ok');
    } catch (e) {
      toast(e?.data?.message || 'No se pudo guardar la configuración.', 'err');
    } finally {
      setGuardando(false);
    }
  };



  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Configuración de Ventas"
        desc="Reglas del circuito comercial. Rigen para la caja, los presupuestos y la cuenta corriente."
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={() => setDraft(config)} disabled={!sucio || guardando}>Descartar</Btn>
            <Btn variant="btn-primary" onClick={guardar} disabled={!sucio || guardando}>
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </Btn>
          </div>
        }
      />

      {sucio && (
        <div className={cx(s.callout, s.warn)}>
          Hay {Object.keys(cambios).length} cambio(s) sin guardar.
        </div>
      )}

      <div className={s['dash-grid']}>
        <Seccion
          titulo="Comprobantes"
          desc="Mientras ARCA esté apagado se emite ticket interno y la venta se confirma sin pedir CAE."
        >
          <Campo label="Punto de venta" hint="Numera tickets, facturas y recibos de cobranza.">
            <input value={draft.puntoVenta ?? ''} onChange={setTxt('puntoVenta')} maxLength={4} />
          </Campo>
          <Campo label="Condición de IVA de la empresa" hint="Junto con la del cliente define la letra (A / B / C).">
            <select value={draft.condicionIvaEmpresa ?? ''} onChange={setTxt('condicionIvaEmpresa')}>
              {Object.entries(CONDICIONES_IVA)
                .filter(([k]) => k !== 'consumidor_final' && k !== 'no_categorizado')
                .map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Campo>
          <Interruptor
            label="Facturación electrónica (ARCA)"
            hint="Al activarla, la venta pide CAE antes de confirmarse. Requiere certificado y punto de venta habilitado."
            checked={draft.arcaHabilitado}
            onChange={set('arcaHabilitado')}
          />
        </Seccion>

        <Seccion titulo="Precios y descuentos">
          <div className={cx(s.callout, s.info)}>
            Las <strong>modalidades, listas y reglas de marca</strong> se administran en su propia
            pantalla (menú <strong>Formato de venta</strong>). El <strong>markup</strong> no está
            ahí ni acá: se carga por producto, en <strong>Compras › Productos › Formato de
            Venta</strong>, porque la misma lista tiene distinto margen en cada artículo.
          </div>
          <Campo
            label="Lista base (piso)"
            hint="El precio que se cobra cuando el ticket no habilita ninguna otra lista. Conviene que sea la de PEOR orden de preferencia: es la red de contención, no una candidata."
          >
            <select value={draft.listaBaseId ?? 0} onChange={setNum('listaBaseId')}>
              <option value={0}>La primera por orden de preferencia</option>
              {listasCatalogo.listas.filter((l) => l.activa).map((l) => (
                <option key={l.id} value={l.id}>{l.etiqueta}</option>
              ))}
            </select>
          </Campo>
          <Interruptor
            label="Solo un administrador puede cambiar la lista a mano"
            hint="El automático por condición sigue funcionando para todos: es una regla. Lo que se limita es el override manual, que esquiva el tope de descuento."
            checked={draft.overrideListaRequiereAdmin}
            onChange={set('overrideListaRequiereAdmin')}
          />
          <Campo label="Descuento máximo del vendedor (%)" hint="Por encima de este tope hace falta un administrador.">
            <input type="number" min="0" max="100" step="0.5" value={draft.descuentoMaxVendedor ?? 0} onChange={setNum('descuentoMaxVendedor')} />
          </Campo>
          <Campo
            label="Redondeo de precio de góndola"
            hint="Se aplica sobre el precio FINAL con IVA, que es el que ve el cliente; el neto se deriva. Afecta a todo el sistema (etiqueta, caja y catálogo muestran el mismo número)."
          >
            <select value={draft.redondeoPrecio ?? 0} onChange={setNum('redondeoPrecio')}>
              {OPCIONES_REDONDEO_PRECIO.map((o) => <option key={o.valor} value={o.valor}>{o.label}</option>)}
            </select>
          </Campo>
          <Campo label="Redondeo de efectivo" hint="Para plazas sin monedas chicas. Solo afecta pagos en efectivo.">
            <select value={draft.redondeoEfectivo ?? 0} onChange={setNum('redondeoEfectivo')}>
              {OPCIONES_REDONDEO.map((o) => <option key={o.valor} value={o.valor}>{o.label}</option>)}
            </select>
          </Campo>
        </Seccion>

        {/*
          Acceso mayorista por monto. Es la única puerta que se mide en pesos, y
          por eso vive en la configuración y no en una lista: no es una propiedad
          de ninguna lista puntual, es una política del negocio.
        */}
        <Seccion titulo="Acceso mayorista por monto de compra">
          <div className={cx(s.callout, s.warn)}>
            A diferencia de las condiciones por cantidad, esta <strong>no se aplica sola</strong>: se
            mide sobre pesos, y aplicar el beneficio baja el total, así que automatizarla podría
            dejar el ticket bajo el umbral y revertirse en un ciclo. La caja lo <strong>sugiere</strong>{' '}
            y el vendedor lo aplica con un clic.
          </div>
          <Campo
            label="Monto mínimo del ticket"
            hint="0 = desactivado. Se mide sobre el total con IVA."
          >
            <input
              type="number" min="0" step="100"
              value={draft.montoMinimoMayorista ?? 0}
              onChange={setNum('montoMinimoMayorista')}
            />
          </Campo>
          <Campo
            label="Mínimo p/ envío con camioneta (sitio web)"
            hint="Piso EXTRA del pedido online si el cliente elige la camioneta de la empresa: el viaje tiene que valer la pena. 0 = sin piso."
          >
            <input
              type="number" min="0" step="1000"
              value={draft.montoMinimoCamioneta ?? 0}
              onChange={setNum('montoMinimoCamioneta')}
            />
          </Campo>
          <Campo
            label="Modalidad que desbloquea"
            hint="Alcanza SOLO a los artículos del ticket que tengan una lista cargada en esa modalidad. El que no tenga ninguna se queda con su precio de siempre."
          >
            <select value={draft.modalidadMontoId ?? 0} onChange={setNum('modalidadMontoId')}>
              <option value={0}>— Ninguna (desactivado) —</option>
              {listasCatalogo.modalidades.map((m) => (
                <option key={m.id} value={m.id}>{m.nombre}</option>
              ))}
            </select>
          </Campo>
          <Campo
            label="Medios de pago con los que vale"
            hint="Sin ninguno tildado, vale con cualquiera. Se verifica AL CONFIRMAR la venta: el medio se elige al cobrar, cuando el precio ya se armó."
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {Object.entries(MEDIOS_PAGO).map(([k, label]) => {
                const sel = draft.mediosPagoMonto ?? [];
                return (
                  <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={sel.includes(k)}
                      onChange={(e) => setDraft((d) => ({
                        ...d,
                        mediosPagoMonto: e.target.checked
                          ? [...(d.mediosPagoMonto ?? []), k]
                          : (d.mediosPagoMonto ?? []).filter((x) => x !== k),
                      }))}
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </Campo>
        </Seccion>

        <Seccion titulo="Cuenta corriente">
          <Interruptor
            label="Permitir venta en cuenta corriente"
            hint="Si se apaga, toda venta se cobra al contado sin importar el cliente."
            checked={draft.ctaCteHabilitada}
            onChange={set('ctaCteHabilitada')}
          />
          <Interruptor
            label="Bloquear al superar el límite de crédito"
            hint="Rechaza la venta si el saldo del cliente supera su límite. Apagado, solo avisa."
            checked={draft.ctaCteBloquearSuperado}
            onChange={set('ctaCteBloquearSuperado')}
            disabled={!draft.ctaCteHabilitada}
          />
          <Campo label="Límite de crédito por defecto" hint="0 = sin tope. Se propone al dar de alta un cliente.">
            <input type="number" min="0" step="1000" value={draft.ctaCteLimiteDefault ?? 0} onChange={setNum('ctaCteLimiteDefault')} disabled={!draft.ctaCteHabilitada} />
          </Campo>
          <Campo label="Plazo de pago por defecto (días)">
            <input type="number" min="0" step="1" value={draft.ctaCteDiasPlazo ?? 0} onChange={setNum('ctaCteDiasPlazo')} disabled={!draft.ctaCteHabilitada} />
          </Campo>
        </Seccion>

        <Seccion titulo="Presupuestos">
          <Campo label="Validez por defecto (días)" hint="Corre desde que se ENVÍA. Un presupuesto vencido no se confirma: se reabre y se re-cotiza.">
            <input type="number" min="1" step="1" value={draft.presupuestoValidezDias ?? 7} onChange={setNum('presupuestoValidezDias')} />
          </Campo>
          <Interruptor
            label="Reservar stock al confirmar un presupuesto"
            hint="Pasa la mercadería de Disponible a Comprometido mientras el vendedor arma el pedido: la caja no la puede vender dos veces. Cerrar la venta o cancelar el presupuesto la libera."
            checked={draft.presupuestoReservaStock}
            onChange={set('presupuestoReservaStock')}
          />
        </Seccion>

        <Seccion titulo="Caja / punto de venta">
          <Interruptor
            label="Exigir turno de caja abierto"
            hint="Sin turno abierto no se puede vender. Es lo que permite arquear al cierre."
            checked={draft.cajaObligatoria}
            onChange={set('cajaObligatoria')}
          />
          <Interruptor
            label="Permitir vender sin stock"
            hint="Dejarlo apagado: el inventario en negativo no se recupera más."
            checked={draft.permitirStockNegativo}
            onChange={set('permitirStockNegativo')}
          />
          <Campo label="Medios de pago habilitados" hint={`Disponibles: ${Object.values(MEDIOS_PAGO).join(', ')}.`}>
            <ListaEditable valores={draft.mediosPago ?? []} onChange={set('mediosPago')} placeholder="efectivo, qr, cheque…" />
          </Campo>
        </Seccion>

        <Seccion titulo="Lector de códigos y balanza">
          <Interruptor
            label="Lector de código de barras"
            hint="El buscador de la caja mantiene el foco para que el lector escriba directo."
            checked={draft.lectorHabilitado}
            onChange={set('lectorHabilitado')}
          />
          <Interruptor
            label="El lector envía Enter al final"
            hint="Casi todos lo hacen. Si el tuyo no, apagalo y el producto se agrega al terminar de leer."
            checked={draft.lectorSufijoEnter}
            onChange={set('lectorSufijoEnter')}
            disabled={!draft.lectorHabilitado}
          />
          <Interruptor
            label="Etiquetas de balanza (peso variable)"
            hint="Códigos EAN-13 que traen el peso o el importe embebido, impresos por la balanza."
            checked={draft.balanzaHabilitada}
            onChange={set('balanzaHabilitada')}
          />
          <Campo label="Prefijo de las etiquetas" hint="Los dos primeros dígitos que identifican una etiqueta de balanza.">
            <input value={draft.balanzaPrefijo ?? ''} onChange={setTxt('balanzaPrefijo')} maxLength={2} disabled={!draft.balanzaHabilitada} />
          </Campo>
          <Campo label="Qué trae el código">
            <select value={draft.balanzaModo ?? 'peso'} onChange={setTxt('balanzaModo')} disabled={!draft.balanzaHabilitada}>
              <option value="peso">Peso (kg)</option>
              <option value="importe">Importe ($)</option>
            </select>
          </Campo>
        </Seccion>
      </div>
    </div>
  );
}
