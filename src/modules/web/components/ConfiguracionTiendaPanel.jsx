/**
 * TIENDA ONLINE › CONFIGURACIÓN (16/10/2026, pedido del dueño: «lo que es
 * configuración de la tienda online, que esté concentrado todo ahí, aparte para
 * la mayorista y la minorista»). Antes vivía en Ventas › Configuración.
 *
 * Cuatro pestañas: General (cómo se ven los productos y los datos del sitio),
 * Tienda mayorista, Tienda minorista y Cupones (0190, los de la minorista). Las llaves de la tienda viven en la
 * config de ventas (las lee la tienda) y las guarda quien tiene «Configuración
 * de la tienda online» (`permisosParaGuardar` en la API). La compra mínima y la
 * modalidad mayorista se comparten con la caja: acá se muestran, se cambian en
 * Ventas › Configuración. Los datos del sitio guardan con sus propios botones.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Tabs, Tab } from '@mui/material';
import { httpClient } from '@core/services/httpClient.js';
import { cx } from '@shared/utils/classNames.js';
import { PanelHead, Btn, s } from '@modules/productos/components/ui.jsx';
import { PortadaMinoristaEditor } from './PortadaMinoristaEditor.jsx';
import { BarriosEnvio } from './BarriosEnvio.jsx';
import { VistaPreviaTienda } from './VistaPreviaTienda.jsx';
import { CuponesTienda } from './CuponesTienda.jsx';
import { telLegible, telefonoWa } from '@modules/ventas/domain/constants.js';

/** Las llaves de la tienda y la pestaña donde se cambia cada una. */
const LLAVES = {
  tiendaVistaLista: 'general',
  tiendaSoloConStock: 'general',
  tiendaMayoristaPublica: 'general',
  tiendaMinoristaPublica: 'general',
  tiendaMinoristaActiva: 'general',
  envioCamionetaActivo: 'mayorista',
  montoMinimoCamioneta: 'mayorista',
  tiendaMinoristaEnvioGratisDesde: 'minorista',
  tiendaMinoristaMapsKey: 'minorista',
  tiendaMinoristaLocalEnvios: 'minorista',
  tiendaCadeteWhatsapp: 'general',
};
const PESTANAS = [
  { id: 'general', label: 'General' },
  { id: 'mayorista', label: 'Tienda mayorista' },
  { id: 'minorista', label: 'Tienda minorista' },
  { id: 'cupones', label: 'Cupones' },
];
const TAB_KEY = 'crm.web.configuracion.tab';
const pesos = (n) => `$${Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;

function Seccion({ titulo, desc, children }) {
  return (
    <div className={cx(s.card, s.cardPad)} style={{ display: 'grid', gap: 'var(--crm-space-3)' }}>
      <div>
        <div className={s['section-title']} style={{ margin: 0 }}>{titulo}</div>
        {desc && <div className={s.hint} style={{ margin: '4px 0 0' }}>{desc}</div>}
      </div>
      {children}
    </div>
  );
}

function Interruptor({ label, hint, checked, onChange }) {
  return (
    <div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
        <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
      {hint && <div className={s.hint} style={{ margin: '4px 0 0 26px' }}>{hint}</div>}
    </div>
  );
}

/** Los días como los guardan los locales (General › Locales). */
const DIAS_LOCAL = [['lun', 'Lun'], ['mar', 'Mar'], ['mie', 'Mié'], ['jue', 'Jue'], ['vie', 'Vie'], ['sab', 'Sáb'], ['dom', 'Dom']];

/**
 * EL HORARIO DE LOS ENVÍOS (23/10/2026): de qué local es. Con él, el checkout
 * minorista ofrece «lo antes posible» solo abierto y las franjas de 20 minutos.
 * Vacío = el primer local con horario. Los locales se cargan en General.
 */
function LocalEnvios({ value, onChange, disabled }) {
  const [locales, setLocales] = useState(null);
  useEffect(() => {
    httpClient.get('/configuracion/web').then((w) => setLocales(w.locales ?? [])).catch(() => setLocales([]));
  }, []);
  if (!locales) return null;
  const conHorario = locales.filter((l) => DIAS_LOCAL.some(([d]) => l[d]));
  const elegido = value ? locales.find((l) => l.nombre === value) : conHorario[0];
  return (
    <div className={s.field} style={{ maxWidth: 520 }}>
      <label htmlFor="cfg-tienda-local-envios">Horario de los envíos a domicilio</label>
      {conHorario.length ? (
        <select id="cfg-tienda-local-envios" value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
          <option value="">El del primer local con horario ({conHorario[0].nombre || conHorario[0].direccion})</option>
          {conHorario.map((l) => <option key={l.nombre} value={l.nombre}>El de {l.nombre || l.direccion}</option>)}
        </select>
      ) : (
        <div className={cx(s.callout, s.warn)} style={{ margin: 0 }}>
          Todavía no hay locales con horario: cargalo en <strong>General › Locales y horarios</strong>. Mientras tanto el cliente
          solo puede pedir «lo antes posible» (sin saber si está abierto) o coordinarlo por WhatsApp.
        </div>
      )}
      {elegido && (
        <div className={s.hint} style={{ margin: '6px 0 0' }}>
          {DIAS_LOCAL.map(([d, n]) => `${n} ${elegido[d] || 'cerrado'}`).join(' · ')}.
          {' '}Al final del checkout el cliente elige: lo antes posible (20 a 40 min, solo con el local abierto), un horario de 20 minutos o coordinarlo por WhatsApp.
          Un feriado cargado en Sistema › Feriados para la Distribuidora manda sobre este horario.
        </div>
      )}
      {value && !elegido && <div className={s.hint} style={{ margin: '6px 0 0', color: 'var(--crm-color-danger)' }}>El local «{value}» ya no existe: elegí otro.</div>}
    </div>
  );
}

/**
 * PUBLICACIÓN DE CADA TIENDA (20/10/2026): abierta, en preparación (solo con
 * la vista previa) y, la minorista, también apagada. En la config son dos
 * llaves por tienda (si existe y si es pública); acá, un solo selector.
 */
const ESTADOS = {
  abierta: 'Abierta al público',
  preparacion: 'En preparación (solo con la vista previa)',
  apagada: 'Apagada (no existe, ni en vista previa)',
};
const estadoMinorista = (d) => (d.tiendaMinoristaActiva === false ? 'apagada' : d.tiendaMinoristaPublica === false ? 'preparacion' : 'abierta');

function Estado({ id, label, value, opciones, onChange }) {
  return (
    <div className={s.field} style={{ maxWidth: 420, margin: 0 }}>
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {opciones.map((o) => <option key={o} value={o}>{ESTADOS[o]}</option>)}
      </select>
    </div>
  );
}

function Monto({ id, label, hint, value, disabled, onChange }) {
  return (
    <div className={s.field} style={{ maxWidth: 320, opacity: disabled ? 0.55 : 1 }}>
      <label htmlFor={id}>{label}</label>
      <input id={id} type="number" min="0" step="1000" value={value ?? 0} disabled={disabled} onChange={(e) => onChange(Number(e.target.value) || 0)} />
      {hint && <div className={s.hint} style={{ margin: '6px 0 0' }}>{hint}</div>}
    </div>
  );
}

export function ConfiguracionTiendaPanel({ avisar, sitio }) {
  const [tab, setTab] = useState(() => {
    try { return sessionStorage.getItem(TAB_KEY) || 'general'; } catch { return 'general'; }
  });
  const elegirTab = (v) => {
    setTab(v);
    try { sessionStorage.setItem(TAB_KEY, v); } catch { /* sin storage: arranca en General */ }
  };
  const [config, setConfig] = useState(null);
  const [modalidades, setModalidades] = useState([]);
  const [draft, setDraft] = useState({});
  const [guardando, setGuardando] = useState(false);
  const enVuelo = useRef(false);

  const cargar = useCallback(async () => {
    const [c, l] = await Promise.all([httpClient.get('/configuracion/ventas'), httpClient.get('/listas').catch(() => null)]);
    setConfig(c);
    setDraft(Object.fromEntries(Object.keys(LLAVES).map((k) => [k, c[k]])));
    if (l) setModalidades(l.modalidades ?? []);
  }, []);
  useEffect(() => {
    cargar().catch((e) => avisar('err', e?.data?.message || 'No se pudo leer la configuración de la tienda.'));
  }, [cargar, avisar]);

  const set = (k) => (v) => setDraft((d) => ({ ...d, [k]: v }));
  const cambios = useMemo(() => (config
    ? Object.fromEntries(Object.keys(LLAVES).filter((k) => draft[k] !== config[k]).map((k) => [k, draft[k]]))
    : {}), [draft, config]);
  const sucias = new Set(Object.keys(cambios).map((k) => LLAVES[k]));

  const guardar = async () => {
    if (enVuelo.current) return;
    enVuelo.current = true;
    setGuardando(true);
    try {
      await httpClient.put('/configuracion/ventas', cambios);
      await cargar();
      avisar('ok', 'Configuración de la tienda guardada: el cliente la ve al recargar la tienda.');
    } catch (e) {
      avisar('err', e?.data?.message || 'No se pudo guardar la configuración de la tienda.');
    } finally {
      enVuelo.current = false;
      setGuardando(false);
    }
  };

  if (!config) return <div className={s['empty-state']}>Cargando la configuración de la tienda…</div>;
  const activa = PESTANAS.some((t) => t.id === tab) ? tab : 'general';
  const mod = modalidades.find((m) => m.id === config.modalidadMontoId) ?? modalidades.find((m) => /mayorista/i.test(m.nombre));
  const compra = [
    ['Precios', mod ? `Modalidad ${mod.nombre}, con todas sus listas` : 'Sin modalidad mayorista: la tienda mayorista no muestra productos'],
    ['Compra mínima', Number(config.montoMinimoMayorista) > 0 ? `${pesos(config.montoMinimoMayorista)} en total (o cumplir las reglas de marca y los mínimos por artículo)` : 'Sin mínimo por monto'],
    ['Cada pedido', `Entra en Tienda online › Pedidos online y, aceptado, es un presupuesto válido ${config.presupuestoValidezDias ?? 7} días`],
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Configuración de la tienda"
        desc="Todo lo de la tienda online en un lugar: lo general, la tienda mayorista y la minorista."
        actions={(
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={() => setDraft(Object.fromEntries(Object.keys(LLAVES).map((k) => [k, config[k]])))} disabled={!sucias.size || guardando}>Descartar</Btn>
            <Btn variant="btn-primary" onClick={guardar} disabled={!sucias.size || guardando}>{guardando ? 'Guardando…' : 'Guardar cambios'}</Btn>
          </div>
        )}
      />

      <Tabs value={activa} onChange={(e, v) => elegirTab(v)} variant="scrollable" scrollButtons="auto" sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40 }}>
        {PESTANAS.map((t) => (
          <Tab key={t.id} value={t.id} label={sucias.has(t.id) ? `${t.label} •` : t.label} sx={{ minHeight: 40, textTransform: 'none', fontWeight: 600 }} />
        ))}
      </Tabs>

      {sucias.size > 0 && (
        <div className={cx(s.callout, s.warn)} style={{ margin: 0 }}>
          Hay cambios sin guardar en <strong>{PESTANAS.filter((t) => sucias.has(t.id)).map((t) => t.label).join(', ')}</strong>.
        </div>
      )}

      {activa === 'general' && (
        <>
          <Seccion
            titulo="Publicación"
            desc="Cada tienda abierta al público o en preparación. En preparación no la ve nadie salvo con el link de vista previa: ahí se ve entera, con el cartel «Vista previa», y lo que se compre entra a Pedidos online marcado PRUEBA. Con las dos en preparación, el sitio muestra «Muy pronto»."
          >
            <Estado
              id="cfg-pub-mayorista" label="Tienda mayorista" opciones={['abierta', 'preparacion']}
              value={draft.tiendaMayoristaPublica === false ? 'preparacion' : 'abierta'}
              onChange={(v) => set('tiendaMayoristaPublica')(v === 'abierta')}
            />
            <Estado
              id="cfg-pub-minorista" label="Tienda minorista" opciones={['abierta', 'preparacion', 'apagada']}
              value={estadoMinorista(draft)}
              onChange={(v) => setDraft((d) => ({ ...d, tiendaMinoristaActiva: v !== 'apagada', ...(v === 'apagada' ? {} : { tiendaMinoristaPublica: v === 'abierta' }) }))}
            />
            <VistaPreviaTienda avisar={avisar} />
          </Seccion>
          <Seccion
            titulo="Cadete"
            desc="Para los pedidos con envío: en Tienda online › Pedidos online (y en Presupuestos, ya aceptados) el botón «Pedir cadete» abre WhatsApp en este chat con el pedido escrito: cliente, teléfono, dirección, ubicación y cantidad de artículos."
          >
            <div className={s.field} style={{ maxWidth: 320 }}>
              <label htmlFor="cfg-cadete-wa">WhatsApp del cadete</label>
              <input
                id="cfg-cadete-wa" inputMode="tel" autoComplete="off" placeholder="Ej: 3704621563"
                value={draft.tiendaCadeteWhatsapp ?? ''} onChange={(e) => set('tiendaCadeteWhatsapp')(e.target.value.replace(/\D/g, ''))}
              />
              <div className={s.hint} style={{ margin: '6px 0 0', ...(draft.tiendaCadeteWhatsapp && !telefonoWa(draft.tiendaCadeteWhatsapp) ? { color: 'var(--crm-color-danger)' } : {}) }}>
                {!draft.tiendaCadeteWhatsapp
                  ? 'Característica y número, por ejemplo 3704621563. Vacío = el botón avisa que falta.'
                  : telefonoWa(draft.tiendaCadeteWhatsapp)
                    ? `Se abre el chat con el ${telLegible(telefonoWa(draft.tiendaCadeteWhatsapp).slice(3))}.`
                    : 'No llega a un celular completo: característica y número (10 dígitos).'}
              </div>
            </div>
          </Seccion>
          <Seccion titulo="Cómo se ven los productos" desc="La forma del catálogo, en los dos modos.">
            <Interruptor
              label="Catálogo sin fotos (vista de lista)"
              hint="Encendido, la tienda muestra los productos como renglones de una lista, sin imagen: marca, nombre, etiquetas, oferta, precio y el botón de agregar en un solo renglón. Para cuando los productos no tienen fotos cargadas. Apagado, las tarjetas con foto de siempre. La portada no cambia."
              checked={draft.tiendaVistaLista === true}
              onChange={set('tiendaVistaLista')}
            />
          </Seccion>
          <Seccion titulo="Stock" desc="Qué se puede comprar en la tienda, en los dos modos.">
            <Interruptor
              label="La tienda solo vende lo que tiene stock"
              hint="Encendido, la tienda respeta el stock de la Distribuidora aunque el control de stock general (Almacén › Configuración) esté apagado: lo que está en 0 se ve con «Sin stock», al final del listado, y no se puede pedir. La caja no cambia. Los productos marcados «nunca controlar» en su ficha se siguen vendiendo sin tope."
              checked={draft.tiendaSoloConStock === true}
              onChange={set('tiendaSoloConStock')}
            />
          </Seccion>
          <div className={cx(s.card, s.cardPad)}>{sitio}</div>
        </>
      )}

      {activa === 'mayorista' && (
        <>
          <Seccion titulo="Entregas" desc="Cómo puede recibir su pedido el cliente mayorista.">
            <div className={cx(s.callout, s.info)} style={{ margin: 0 }}>
              <strong>Retiro en el local</strong> y <strong>envío por cadete</strong> se ofrecen siempre.
            </div>
            <Interruptor
              label="Envío sin costo"
              hint="Encendido, la tienda lo ofrece como «Envío sin costo». Apagado, no aparece y el servidor rechaza el pedido que lo pida; los pedidos que ya entraron no cambian."
              checked={draft.envioCamionetaActivo !== false}
              onChange={set('envioCamionetaActivo')}
            />
            <Monto
              id="cfg-tienda-min-envio" label="Pedido mínimo para el envío sin costo"
              hint="0 = sin mínimo. Si el pedido no llega, la opción aparece deshabilitada con cuánto le falta. Es aparte de la compra mínima de la tienda."
              value={draft.montoMinimoCamioneta} disabled={draft.envioCamionetaActivo === false} onChange={set('montoMinimoCamioneta')}
            />
          </Seccion>
          <Seccion titulo="Compra en la tienda mayorista" desc="Se comparten con la caja: se cambian en Ventas › Configuración (Precios y descuentos, y Cuenta corriente y presupuestos).">
            <div style={{ display: 'grid', gap: 8 }}>
              {compra.map(([k, v]) => (
                <div key={k} style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 30%) 1fr', gap: 10, fontSize: 13 }}>
                  <span className={s.hint} style={{ margin: 0 }}>{k}</span>
                  <strong>{v}</strong>
                </div>
              ))}
            </div>
          </Seccion>
        </>
      )}

      {activa === 'minorista' && (<>
        <Seccion titulo="Tienda minorista" desc="La misma tienda, en modo Minorista: precio de mostrador (la lista base de la caja), sin compra mínima. Para ver los precios y comprar, el cliente ingresa con su WhatsApp: la primera vez se registra (nombre, apellido y dirección) y entra en el momento. Los ves y los bloqueás en Tienda online › Accesos › Minoristas. Si está abierta, en preparación o apagada se elige en General › Publicación.">
          <Monto
            id="cfg-tienda-envio-gratis" label="Envío a domicilio gratis desde"
            hint="0 = nunca es gratis: el costo del envío se coordina por WhatsApp. Con un monto, el pedido que lo supera queda marcado «gratis» en Pedidos online. Retiro en el local se ofrece siempre."
            value={draft.tiendaMinoristaEnvioGratisDesde} disabled={draft.tiendaMinoristaActiva === false} onChange={set('tiendaMinoristaEnvioGratisDesde')}
          />
          <div className={s.hint} style={{ margin: 0 }}>
            Se publica todo producto con precio en la lista base y stock en la Distribuidora. El granel va por paquetes fraccionados y, como bolsa cerrada, solo el que en la lista base vende «por N kg».
          </div>
          <div className={s.field} style={{ maxWidth: 520 }}>
            <label htmlFor="cfg-tienda-maps">Clave de Google Maps</label>
            <input id="cfg-tienda-maps" value={draft.tiendaMinoristaMapsKey ?? ''} maxLength={100} placeholder="AIza…" autoComplete="off" spellCheck={false} onChange={(e) => set('tiendaMinoristaMapsKey')(e.target.value.trim())} />
            <div className={s.hint} style={{ margin: '6px 0 0' }}>
              Con la clave, el cliente marca en el mapa dónde recibe y la tienda sabe su barrio. Se crea en Google Cloud (Credenciales › Crear clave de API)
              con <strong>Maps JavaScript API</strong> y <strong>Places API (New)</strong> habilitadas, y se restringe a los sitios web
              {' '}<code>tiendaonline.saboryaroma.com/*</code> y <code>erp.saboryaroma.com/*</code>. Vacía = el checkout sin mapa, como antes.
            </div>
          </div>
          <LocalEnvios value={draft.tiendaMinoristaLocalEnvios} disabled={draft.tiendaMinoristaActiva === false} onChange={set('tiendaMinoristaLocalEnvios')} />
        </Seccion>
        <BarriosEnvio mapsKey={config.tiendaMinoristaMapsKey} avisar={avisar} />
        {/* Los textos de la portada (17/10/2026): guardan con su propio botón, como los datos del sitio. */}
        <PortadaMinoristaEditor avisar={avisar} />
      </>)}

      {/* Los cupones de la tienda minorista (0190): guardan con sus propios botones. */}
      {activa === 'cupones' && <CuponesTienda avisar={avisar} />}
    </div>
  );
}
