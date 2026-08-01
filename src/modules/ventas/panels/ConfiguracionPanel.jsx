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
  const { config, recargar, toast } = useVentas();
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

  const listas = draft.listasPrecio ?? [];

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
          <Campo label="Listas de precio" hint="Se asignan al cliente y definen el % de ganancia con el que se vende.">
            <ListaEditable valores={listas} onChange={set('listasPrecio')} placeholder="Nombre de la lista…" />
          </Campo>
          <Campo label="Lista por defecto" hint="La que usa un cliente sin lista propia.">
            <select value={draft.listaPrecioDefault ?? ''} onChange={setTxt('listaPrecioDefault')}>
              {listas.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </Campo>
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
          <Campo label="Validez por defecto (días)" hint="Vencido el plazo, el presupuesto deja de poder convertirse en venta.">
            <input type="number" min="1" step="1" value={draft.presupuestoValidezDias ?? 15} onChange={setNum('presupuestoValidezDias')} />
          </Campo>
          <Interruptor
            label="Reservar stock al aceptar un presupuesto"
            hint="Pasa la mercadería de Disponible a Comprometido para no venderla dos veces. Se libera sola si el presupuesto vence."
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
