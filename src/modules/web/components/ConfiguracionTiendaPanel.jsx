/**
 * TIENDA ONLINE › CONFIGURACIÓN (16/10/2026, pedido del dueño: «lo que es
 * configuración de la tienda online, que esté concentrado todo ahí, aparte para
 * la mayorista y la minorista»). Antes vivía en Ventas › Configuración.
 *
 * Tres pestañas: General (cómo se ven los productos y los datos del sitio),
 * Tienda mayorista y Tienda minorista. Las llaves de la tienda viven en la
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

/** Las llaves de la tienda y la pestaña donde se cambia cada una. */
const LLAVES = {
  tiendaVistaLista: 'general',
  envioCamionetaActivo: 'mayorista',
  montoMinimoCamioneta: 'mayorista',
  tiendaMinoristaActiva: 'minorista',
  tiendaMinoristaEnvioGratisDesde: 'minorista',
};
const PESTANAS = [
  { id: 'general', label: 'General' },
  { id: 'mayorista', label: 'Tienda mayorista' },
  { id: 'minorista', label: 'Tienda minorista' },
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
    ['Cada pedido', `Entra como presupuesto en Ventas › Órdenes web, válido ${config.presupuestoValidezDias ?? 7} días`],
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
          <Seccion titulo="Cómo se ven los productos" desc="La forma del catálogo, en los dos modos.">
            <Interruptor
              label="Catálogo sin fotos (vista de lista)"
              hint="Encendido, la tienda muestra los productos como renglones de una lista, sin imagen: marca, nombre, etiquetas, oferta, precio y el botón de agregar en un solo renglón. Para cuando los productos no tienen fotos cargadas. Apagado, las tarjetas con foto de siempre. La portada no cambia."
              checked={draft.tiendaVistaLista === true}
              onChange={set('tiendaVistaLista')}
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
        <Seccion titulo="Tienda minorista" desc="La misma tienda, en modo Minorista: precio de mostrador (la lista base de la caja), sin compra mínima ni registro; el comprador es su WhatsApp.">
          <Interruptor
            label="Modo minorista encendido"
            hint="Encendido, al entrar a la tienda se elige Minorista o Mayorista y se puede cambiar desde el cartel de arriba. Apagado, la tienda queda solo mayorista y el servidor rechaza los pedidos minoristas."
            checked={draft.tiendaMinoristaActiva !== false}
            onChange={set('tiendaMinoristaActiva')}
          />
          <Monto
            id="cfg-tienda-envio-gratis" label="Envío a domicilio gratis desde"
            hint="0 = nunca es gratis: el costo del envío se coordina por WhatsApp. Con un monto, el pedido que lo supera queda marcado «gratis» en Órdenes web. Retiro en el local se ofrece siempre."
            value={draft.tiendaMinoristaEnvioGratisDesde} disabled={draft.tiendaMinoristaActiva === false} onChange={set('tiendaMinoristaEnvioGratisDesde')}
          />
          <div className={s.hint} style={{ margin: 0 }}>
            Se publica todo producto con precio en la lista base y stock en la Distribuidora. El granel va por paquetes fraccionados y, como bolsa cerrada, solo el que en la lista base vende «por N kg».
          </div>
        </Seccion>
        {/* Los textos de la portada (17/10/2026): guardan con su propio botón, como los datos del sitio. */}
        <PortadaMinoristaEditor avisar={avisar} />
      </>)}
    </div>
  );
}
