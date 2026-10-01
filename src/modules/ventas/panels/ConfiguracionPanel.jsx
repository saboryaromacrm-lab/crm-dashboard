import { useEffect, useMemo, useRef, useState } from 'react';
import { Tabs, Tab } from '@mui/material';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { cx } from '@shared/utils/classNames.js';
import { useVentas } from '../context/VentasContext.jsx';
import { ventasApi } from '../services/ventas.api.js';
import { CONDICIONES_IVA, MEDIOS_PAGO, OPCIONES_REDONDEO_PRECIO } from '../domain/constants.js';
import { PanelHead, Btn, s } from '../components/ui.jsx';
import { PanelArca } from '../components/PanelArca.jsx';
import { MercadoPagoPanel } from '../components/MercadoPagoPanel.jsx';
import { ListasPanel } from './ListasPanel.jsx';

/*
 * CONFIGURACIÓN EN PESTAÑAS (28/9/2026, pedido del dueño): "quedaron todas las
 * configuraciones sueltas y uno entra ahí y se pierde". Se agrupan por tema, y
 * el Formato de venta —que antes era una entrada aparte del menú— vive acá
 * como primera pestaña, porque es configurar cómo se vende.
 *
 * Cada pestaña pide su llave: el Formato de venta la suya (`ventas.listas`,
 * la misma que exige la API), el resto `ventas.configuracion`.
 */
const PESTANAS = [
  { id: 'formato', label: 'Formato de venta', permiso: 'ventas.listas' },
  { id: 'precios', label: 'Precios y descuentos', permiso: 'ventas.configuracion' },
  { id: 'caja', label: 'Caja y cobro', permiso: 'ventas.configuracion' },
  { id: 'facturacion', label: 'Facturación', permiso: 'ventas.configuracion' },
  { id: 'clientes', label: 'Cuenta corriente y presupuestos', permiso: 'ventas.configuracion' },
  // Cobro con QR de Mercado Pago (0126): conexión y cajas con su QR.
  { id: 'mercadopago', label: 'Mercado Pago', permiso: 'ventas.configuracion' },
];
const TAB_KEY = 'crm.ventas.configuracion.tab';

/** En qué pestaña vive cada campo de la config: para marcar dónde hay cambios. */
const tabDeCampo = (k) => {
  if (['puntoVenta', 'condicionIvaEmpresa', 'arcaHabilitado', 'topeSinIdentificar'].includes(k)) return 'facturacion';
  if (/^(ctaCte|presupuesto)/.test(k)) return 'clientes';
  if (/^(caja|permitirStock|controlStock|mediosPago$|mediosFacturar|recargoCuotas|lector|balanza)/.test(k)) return 'caja';
  return 'precios';
};

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

/* ==================================================================== *
 * DESCUENTOS CON NOMBRE
 * ==================================================================== */

/**
 * El `<input type="date">` habla 'AAAA-MM-DD' y el servidor guarda un instante:
 * el FINAL del día de vencimiento en hora argentina (23:59:59.999 de −03).
 *
 * Traducirlo con `toISOString()` sería el bug de siempre al revés: ese instante
 * en UTC ya es el día siguiente, así que el campo mostraría el 15 para un
 * descuento que vence el 14. Se formatea con la zona horaria explícita, que es
 * la única forma de que el número del input sea el día que el dueño eligió.
 */
const fechaInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
};

const estaVencido = (iso) => !!iso && new Date(iso).getTime() < Date.now();

const FILA_VACIA = {
  nombre: '', porcentaje: '', vence: '', medioPago: '', listaId: '', sucursalId: '', requiereAdmin: false,
};

/**
 * Una fila del listado. Guarda su propio borrador y su propio botón: son
 * registros independientes, no un formulario único como el resto del panel.
 */
function FilaDescuento({ d, listas, sucursales, onGuardar, onBorrar, ocupado }) {
  const nuevo = !d;
  const [f, setF] = useState(nuevo ? FILA_VACIA : {
    nombre: d.nombre, porcentaje: d.porcentaje, vence: fechaInput(d.vence),
    medioPago: d.medioPago ?? '', listaId: d.listaId ?? '', sucursalId: d.sucursalId ?? '',
    requiereAdmin: !!d.requiereAdmin,
  });
  useEffect(() => {
    if (!nuevo) {
      setF({
        nombre: d.nombre, porcentaje: d.porcentaje, vence: fechaInput(d.vence),
        medioPago: d.medioPago ?? '', listaId: d.listaId ?? '', sucursalId: d.sucursalId ?? '',
        requiereAdmin: !!d.requiereAdmin,
      });
    }
  }, [d, nuevo]);

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const guardar = () => onGuardar({
    nombre: f.nombre.trim(),
    porcentaje: Number(f.porcentaje) || 0,
    vence: f.vence || '',
    medioPago: f.medioPago || '',
    listaId: Number(f.listaId) || 0,
    sucursalId: f.sucursalId === '' ? null : Number(f.sucursalId),
    requiereAdmin: !!f.requiereAdmin,
  }, () => nuevo && setF(FILA_VACIA));

  const vencido = !nuevo && estaVencido(d.vence);
  const apagado = !nuevo && !d.activo;

  return (
    <div style={{ borderTop: '1px solid var(--crm-border)', padding: '12px 0', opacity: apagado ? 0.55 : 1 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
        <div className={s.field} style={{ flex: '2 1 170px', margin: 0 }}>
          {nuevo && <label>Nombre</label>}
          <input value={f.nombre} onChange={set('nombre')} placeholder="Nuevo descuento (ej.: Empleados)" />
        </div>
        <div className={s.field} style={{ flex: '0 1 90px', margin: 0 }}>
          {nuevo && <label>%</label>}
          <input type="number" min="0" max="100" step="0.5" value={f.porcentaje} onChange={set('porcentaje')} placeholder="%" />
        </div>
        <div className={s.field} style={{ flex: '1 1 150px', margin: 0 }}>
          <label>Vence</label>
          <input type="date" value={f.vence} onChange={set('vence')} />
        </div>
        <div className={s.field} style={{ flex: '1 1 160px', margin: 0 }}>
          <label>Solo con</label>
          <select value={f.medioPago} onChange={set('medioPago')}>
            <option value="">Cualquier forma</option>
            {Object.entries(MEDIOS_PAGO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        {/* La LISTA es obligatoria: es sobre qué renglones cae el descuento. */}
        <div className={s.field} style={{ flex: '1 1 180px', margin: 0 }}>
          <label>Lista de precios *</label>
          <select value={f.listaId} onChange={set('listaId')}>
            <option value="">Elegí una…</option>
            {listas.filter((l) => l.activa).map((l) => (
              <option key={l.id} value={l.id}>{l.etiqueta || l.nombre}</option>
            ))}
          </select>
        </div>
        <div className={s.field} style={{ flex: '1 1 150px', margin: 0 }}>
          <label>Sucursal</label>
          <select value={f.sucursalId} onChange={set('sucursalId')}>
            <option value="">Todas</option>
            {sucursales.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </select>
        </div>
        <Btn variant="btn-primary" small disabled={ocupado} onClick={guardar}>
          {nuevo ? '+ Agregar' : 'Guardar'}
        </Btn>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
          <input
            type="checkbox"
            checked={!!f.requiereAdmin}
            onChange={(e) => setF((x) => ({ ...x, requiereAdmin: e.target.checked }))}
          />
          Lo aplica solo un administrador
        </label>
        {!nuevo && (
          <>
            <Btn small disabled={ocupado} onClick={() => onGuardar({ activo: !d.activo })}>
              {d.activo ? 'Desactivar' : 'Activar'}
            </Btn>
            <Btn small variant="btn-danger" disabled={ocupado} onClick={onBorrar}>×</Btn>
            {vencido && <span className={cx(s.pill, s['est-anulada'])}>Vencido</span>}
            {apagado && <span className={s.muted} style={{ fontSize: 12 }}>desactivado</span>}
          </>
        )}
      </div>
    </div>
  );
}

function SeccionDescuentos({ listas, sucursales, toast }) {
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);

  const cargar = async () => {
    try { setFilas(await ventasApi.descuentos()); } catch { setFilas([]); } finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);

  const accion = async (fn, exito, despues) => {
    setOcupado(true);
    try {
      await fn();
      await cargar();
      toast(exito, 'ok');
      despues?.();
    } catch (e) {
      toast(e?.data?.message || 'No se pudo guardar el descuento.', 'err');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Seccion
      titulo="Descuentos"
      desc={'Los crea el administrador y la cajera los elige en el punto de venta, sin tipear el número. '
        + 'Cada uno cae SOLO sobre los renglones de su lista de precios, nunca sobre el total: si el ticket '
        + 'mezcla listas, el resto se cobra entero. Se puede aplicar uno por lista, gana el mayor contra el '
        + 'descuento que el renglón ya tenga, y no toca los renglones que están en oferta.'}
    >
      {cargando ? (
        <span className={s.muted}>Cargando descuentos…</span>
      ) : (
        <>
          {filas.map((d) => (
            <FilaDescuento
              key={d.id}
              d={d}
              listas={listas}
              sucursales={sucursales}
              ocupado={ocupado}
              onGuardar={(datos) => accion(
                () => ventasApi.editarDescuento(d.id, datos), `"${d.nombre}" actualizado.`,
              )}
              onBorrar={() => accion(() => ventasApi.borrarDescuento(d.id), `"${d.nombre}" eliminado.`)}
            />
          ))}
          {!filas.length && (
            <div className={s.muted} style={{ padding: '8px 0' }}>
              Todavía no hay descuentos. Creá el primero abajo.
            </div>
          )}
          <FilaDescuento
            listas={listas}
            sucursales={sucursales}
            ocupado={ocupado}
            onGuardar={(datos, limpiar) => accion(
              () => ventasApi.crearDescuento(datos), 'Descuento creado.', limpiar,
            )}
          />
        </>
      )}
    </Seccion>
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

/**
 * MEDIOS DE PAGO, uno por uno (19/8/2026, pedido del dueño).
 *
 * Antes era una lista de texto libre, pero todos los consumidores (cobro,
 * cobranzas, filtros) filtran contra el catálogo de medios conocidos: un
 * "chequecito" tipeado no aparecía en ninguna pantalla. Ahora es la tabla del
 * catálogo real, y cada medio se trabaja individualmente:
 *
 *   Habilitado      aparece en el cobro y en las cobranzas.
 *   Exige factura   un peso cobrado con este medio bloquea "Liquidar": la
 *                   venta sale facturada sí o sí (la API lo revalida).
 */
function MediosPagoEditor({ habilitados, exigenFactura, onChange }) {
  const setHabilitado = (medio, on) => {
    const hab = on ? [...habilitados, medio] : habilitados.filter((x) => x !== medio);
    // Un medio deshabilitado no puede seguir exigiendo nada.
    const exi = on ? exigenFactura : exigenFactura.filter((x) => x !== medio);
    onChange(hab, exi);
  };
  const setExige = (medio, on) => {
    onChange(habilitados, on ? [...exigenFactura, medio] : exigenFactura.filter((x) => x !== medio));
  };
  return (
    <table className={s.tabla} style={{ maxWidth: 560 }}>
      <thead>
        <tr>
          <th>Medio</th>
          <th style={{ width: 110, textAlign: 'center' }}>Habilitado</th>
          <th style={{ width: 130, textAlign: 'center' }}>Exige factura</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(MEDIOS_PAGO).map(([k, label]) => {
          const hab = habilitados.includes(k);
          return (
            <tr key={k}>
              <td>{label}</td>
              <td style={{ textAlign: 'center' }}>
                <input
                  type="checkbox"
                  aria-label={`${label} habilitado`}
                  checked={hab}
                  onChange={(e) => setHabilitado(k, e.target.checked)}
                />
              </td>
              <td style={{ textAlign: 'center' }}>
                <input
                  type="checkbox"
                  aria-label={`${label} exige factura`}
                  checked={exigenFactura.includes(k)}
                  disabled={!hab}
                  title={hab ? 'Cobrado con este medio, la venta se factura sí o sí' : 'Primero habilitalo'}
                  onChange={(e) => setExige(k, e.target.checked)}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * EL AVISO DEL CONTROL DE STOCK A GRANEL (1/10/2026). Con el control apagado
 * el granel se vende sin mirar y el número puede quedar en negativo; al
 * prenderlo, esos negativos frenan la caja. Se dice cuántos hay ANTES de
 * guardar, para contarlos primero. `prendido` = cómo queda en el borrador;
 * `antes` = cómo está guardado.
 */
function AvisoGranel({ prendido, antes }) {
  const [neg, setNeg] = useState(null);
  const mirar = !antes || prendido !== antes;
  useEffect(() => {
    if (!mirar) return undefined;
    let vivo = true;
    ventasApi.granelNegativo().then((r) => { if (vivo) setNeg(r); }).catch(() => { if (vivo) setNeg(null); });
    return () => { vivo = false; };
  }, [mirar]);

  if (prendido && antes) return null;
  if (!prendido && antes) {
    return (
      <div className={cx(s.callout, s.warn)}>
        Al guardar, <strong>todo lo que es a granel</strong> (la madre en kg y sus paquetes) se vende, se
        fracciona, se transfiere y se da de baja <strong>sin mirar el stock</strong>. El stock se sigue registrando
        y puede quedar en negativo; no se generan incidencias de venta sin stock para el granel.
      </div>
    );
  }
  const n = neg?.productos ?? 0;
  return (
    <div className={cx(s.callout, n > 0 ? s.warn : s.info)}>
      {prendido ? 'Al guardar vuelve el control: lo que no hay deja de venderse y moverse.' : 'El control está apagado: el granel se opera sin mirar el stock.'}
      {neg && (n > 0 ? (
        <div style={{ marginTop: 6 }}>
          Hoy hay <strong>{n} producto{n === 1 ? '' : 's'} a granel con stock en negativo</strong>
          {neg.ejemplos?.length > 0 && <> (por ejemplo: {neg.ejemplos.slice(0, 3).map((e) => `${e.nombre} en ${e.sucursal}`).join('; ')})</>}.
          {' '}Contalos en <strong>Almacén › Control de inventario</strong> antes de prenderlo: si no, la caja va a frenar esas ventas.
        </div>
      ) : (
        <div style={{ marginTop: 6 }}>Ningún producto a granel quedó en negativo.</div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function ConfiguracionPanel() {
  const { config, recargar, toast, listasCatalogo, sucursales } = useVentas();
  const { can } = usePermissions();
  const [tab, setTab] = useState(() => {
    try { return sessionStorage.getItem(TAB_KEY) || 'formato'; } catch { return 'formato'; }
  });
  const elegirTab = (v) => {
    setTab(v);
    try { sessionStorage.setItem(TAB_KEY, v); } catch { /* sin storage: arranca en la primera */ }
  };
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

  /* El control de stock a granel cambia cómo se mueve el stock de todo el
   * granel: se guarda con una segunda confirmación y con candado de doble clic. */
  const tocaGranel = 'controlStockGranel' in cambios;
  const [confirmaGranel, setConfirmaGranel] = useState(false);
  useEffect(() => { setConfirmaGranel(false); }, [cambios]);
  const enVuelo = useRef(false);

  const guardar = async () => {
    if (tocaGranel && !confirmaGranel) {
      setConfirmaGranel(true);
      toast(draft.controlStockGranel === false
        ? 'Vas a APAGAR el control de stock a granel. Tocá «Sí, guardar» para confirmar.'
        : 'Vas a PRENDER el control de stock a granel. Tocá «Sí, guardar» para confirmar.', 'ok');
      return;
    }
    if (enVuelo.current) return;
    enVuelo.current = true;
    setGuardando(true);
    try {
      await ventasApi.guardarConfig(cambios);
      await recargar();
      toast('Configuración guardada.', 'ok');
    } catch (e) {
      toast(e?.data?.message || 'No se pudo guardar la configuración.', 'err');
    } finally {
      enVuelo.current = false;
      setGuardando(false);
    }
  };

  const tabsVisibles = PESTANAS.filter((t) => can(t.permiso));
  const tabActiva = tabsVisibles.some((t) => t.id === tab) ? tab : tabsVisibles[0]?.id;
  const esConfig = tabActiva !== 'formato';
  /* Qué pestañas tienen algo sin guardar: el borrador es uno solo para todas,
     así que se avisa DÓNDE quedó el cambio y no solo cuántos hay. */
  const tabsSucias = new Set(Object.keys(cambios).map(tabDeCampo));
  const nombresSucias = PESTANAS.filter((t) => tabsSucias.has(t.id)).map((t) => t.label);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Configuración de Ventas"
        desc="Reglas del circuito comercial, agrupadas por tema. Rigen para la caja, los presupuestos y la cuenta corriente."
        actions={esConfig && can('ventas.configuracion') ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={() => setDraft(config)} disabled={!sucio || guardando}>Descartar</Btn>
            <Btn variant="btn-primary" onClick={guardar} disabled={!sucio || guardando}>
              {guardando ? 'Guardando…' : tocaGranel && confirmaGranel ? 'Sí, guardar' : 'Guardar cambios'}
            </Btn>
          </div>
        ) : null}
      />

      <Tabs
        value={tabActiva}
        onChange={(e, v) => elegirTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40 }}
      >
        {tabsVisibles.map((t) => (
          <Tab
            key={t.id}
            value={t.id}
            label={tabsSucias.has(t.id) ? `${t.label} •` : t.label}
            sx={{ minHeight: 40, textTransform: 'none', fontWeight: 600 }}
          />
        ))}
      </Tabs>

      {sucio && (
        <div className={cx(s.callout, s.warn)}>
          Hay {Object.keys(cambios).length} cambio(s) sin guardar en <strong>{nombresSucias.join(', ')}</strong>
          {esConfig ? '.' : ': volvé a esa pestaña para guardarlos.'}
        </div>
      )}

      {tabActiva === 'formato' && <ListasPanel />}

      {tabActiva === 'precios' && (
        <div className={s['dash-grid']}>
        <Seccion titulo="Precios y descuentos">
          <div className={cx(s.callout, s.info)}>
            Las <strong>modalidades, listas y reglas de marca</strong> se administran en su propia
            pestaña (<strong>Formato de venta</strong>, acá al lado). El <strong>markup</strong> no está
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
        </Seccion>

        {/*
          EL PRECIO MAYORISTA (1/10/2026, pedido del dueño). La caja cobra
          minorista por defecto y AVISA cuando el ticket cumple alguna puerta;
          acá se define qué modalidad es "mayorista", con qué se paga (vale para
          todo renglón a ese precio, llegue como llegue), si el bulto cerrado la
          sugiere y el monto mínimo. Las reglas por marca y los mínimos por
          artículo viven en Listas de precios.
        */}
        <Seccion titulo="Precio mayorista">
          <div className={cx(s.callout, s.info)}>
            La caja cobra <strong>minorista por defecto</strong>. Cuando el ticket cumple alguna
            condición —bulto cerrado, regla de marca, mínimo del artículo, lista del cliente o monto
            de compra— aparece un <strong>aviso</strong> con los renglones que cumplen y el cajero lo
            aplica con un clic.
          </div>
          <Campo
            label="Modalidad mayorista"
            hint="La que sugieren el bulto cerrado y el monto, y la que se cobra solo con los medios de abajo."
          >
            <select value={draft.modalidadMontoId ?? 0} onChange={setNum('modalidadMontoId')}>
              <option value={0}>— Ninguna (desactivado) —</option>
              {listasCatalogo.modalidades.map((m) => (
                <option key={m.id} value={m.id}>{m.nombre}</option>
              ))}
            </select>
          </Campo>
          <Campo
            label="Medios de pago del precio mayorista"
            hint="Valen para TODO renglón a precio mayorista (bulto, marca, monto, cliente o elegido a mano), y siempre al contado. Sin ninguno tildado, vale con cualquiera. El cobro ofrece solo estos y el servidor lo vuelve a controlar."
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
          <Interruptor
            label="El bulto cerrado sugiere mayorista"
            hint="Si el ticket lleva la caja entera de un producto (12 Coca-Cola de un bulto de 12), se sugiere su primera lista mayorista aunque no llegue al monto. El bulto sale de la ficha (DUN) o, si no está, de la caja del proveedor que define el costo."
            checked={draft.mayoristaPorBulto !== false}
            onChange={(v) => setDraft((d) => ({ ...d, mayoristaPorBulto: v }))}
          />
          <Campo
            label="Monto mínimo de compra"
            hint="0 = desactivado. Se mide sobre el total a precio de mostrador, con IVA. Alcanza a todo el ticket."
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
        </Seccion>

        <div style={{ gridColumn: '1 / -1' }}>
          <SeccionDescuentos
            listas={listasCatalogo.listas}
            sucursales={sucursales}
            toast={toast}
          />
        </div>
        </div>
      )}

      {tabActiva === 'caja' && (
        <div className={s['dash-grid']}>
        <Seccion titulo="Caja / punto de venta">
          <Interruptor
            label="Exigir turno de caja abierto"
            hint="Sin turno abierto no se puede vender. Es lo que permite arquear al cierre."
            checked={draft.cajaObligatoria}
            onChange={set('cajaObligatoria')}
          />
          <Interruptor
            label="Permitir vender sin stock"
            hint="Prendido, la caja no se frena: vende igual y cada renglón que se va a negativo deja una incidencia en Almacén › Incidencias › Ventas sin stock, con el comprobante y el cajero, para ir a contar la góndola. Apagado, el cajero no puede cobrar hasta que alguien cargue el stock."
            checked={draft.permitirStockNegativo}
            onChange={set('permitirStockNegativo')}
          />
          <Interruptor
            label="Controlar el stock a granel"
            hint="Prendido (como siempre): no se vende, fracciona, transfiere ni da de baja granel que no hay. Apagado: todo lo que es a granel —la madre en kg y sus paquetes— se vende, se fracciona, se mueve y se carga sin mirar el stock. Los movimientos se siguen registrando, así que el stock puede quedar en negativo. Los productos enteros no cambian: siguen con el control de siempre."
            checked={draft.controlStockGranel !== false}
            onChange={set('controlStockGranel')}
          />
          <AvisoGranel prendido={draft.controlStockGranel !== false} antes={config.controlStockGranel !== false} />
          <Campo
            label="Medios de pago"
            hint="Exige factura: un peso cobrado con ese medio bloquea Liquidar — la venta sale facturada sí o sí (típico: lo bancarizado, que deja rastro)."
          >
            <MediosPagoEditor
              habilitados={draft.mediosPago ?? []}
              exigenFactura={draft.mediosFacturar ?? []}
              onChange={(mediosPago, mediosFacturar) => setDraft((d) => ({ ...d, mediosPago, mediosFacturar }))}
            />
          </Campo>
          <Campo
            label="Recargo por cuotas — tarjeta de crédito (%)"
            hint="Lo que cobra la tarjeta por financiar, trasladado al cliente: en la caja, elegir un plan SUBE el total y el recargo va como un renglón propio del comprobante. Corre solo sobre la parte que se paga con la tarjeta. En cero no recarga nada, y el plan se sigue pudiendo elegir."
          >
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[1, 3, 6].map((n) => (
                <label key={n} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 96 }}>
                  <span className={s.hint} style={{ margin: 0 }}>{n} cuota{n === 1 ? '' : 's'}</span>
                  <input
                    type="number" min="0" max="100" step="0.5"
                    value={draft[`recargoCuotas${n}`] ?? 0}
                    onChange={setNum(`recargoCuotas${n}`)}
                  />
                </label>
              ))}
            </div>
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
      )}

      {tabActiva === 'facturacion' && (
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
          <Campo
            label="Tope para facturar sin identificar al comprador ($)"
            hint="Por encima de este total, ARCA exige el DNI o CUIT del consumidor final en la Factura B y rechaza la que no lo trae. Con la facturación prendida, la caja frena ANTES de cobrar y pide elegir el cliente. ARCA lo actualiza seguido: confirmá el valor vigente con tu contador. 0 = sin control."
          >
            <input type="number" min="0" step="1000" value={draft.topeSinIdentificar ?? 0} onChange={setNum('topeSinIdentificar')} />
          </Campo>
          <Interruptor
            label="Facturación electrónica (ARCA)"
            hint="Prendida, cada factura pide CAE — y si ARCA no contesta, la venta sale igual como ticket provisorio y queda en Ventas › Sin facturar para reintentar. Este interruptor es la INTENCIÓN; si además se puede o no, lo dice el diagnóstico de abajo."
            checked={draft.arcaHabilitado}
            onChange={set('arcaHabilitado')}
          />
        </Seccion>

        {/* A LO ANCHO: lleva tablas (los pasos de la prueba y las ventas
            trabadas con su motivo), y media pantalla las parte. Es
            diagnóstico, no configuración: acá no se toca nada, se mira si lo
            de arriba puede funcionar. */}
        <div style={{ gridColumn: '1 / -1' }}>
          <Seccion
            titulo="Facturación electrónica — diagnóstico"
            desc="El interruptor de arriba es la intención; esto es la capacidad. Lo que ARCA necesita (CUIT, punto de venta y certificado) se configura en el servidor, no acá."
          >
            <PanelArca habilitado={!!draft.arcaHabilitado} />
          </Seccion>
        </div>
        </div>
      )}

      {tabActiva === 'mercadopago' && <MercadoPagoPanel />}

      {tabActiva === 'clientes' && (
        <div className={s['dash-grid']}>
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
        </div>
      )}
    </div>
  );
}
