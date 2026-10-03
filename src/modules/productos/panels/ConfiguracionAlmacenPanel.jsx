import { useEffect, useMemo, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { httpClient } from '@core/services/httpClient.js';
import { useProductos } from '../context/ProductosContext.jsx';
import { PanelHead, Btn, s } from '../components/ui.jsx';

/*
 * ALMACÉN › CONFIGURACIÓN (3/10/2026, pedido del dueño): las llaves de STOCK
 * se mudaron de Ventas › Configuración › Caja y cobro a acá, que es donde se
 * piensa el stock. Siguen guardándose en la config de ventas (la lee la caja,
 * la tienda y todo lo que mueve stock); el servidor deja guardarlas con
 * «Configuración de almacén» o con «Configuración de ventas».
 *
 * Cambiarlas cambia cómo se mueve el stock de todo el negocio: se guarda con
 * una segunda confirmación y con candado de doble clic.
 */
const LLAVES = ['permitirStockNegativo', 'controlStockGranel', 'controlStockEnteros'];

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

/**
 * EL AVISO DEL CONTROL DE STOCK (1/10/2026, mudado de Ventas). Con el control
 * apagado se vende sin mirar y el número puede quedar en negativo; al
 * prenderlo, esos negativos frenan la caja. Se dice cuántos hay ANTES de
 * guardar. `prendido` = cómo queda en el borrador; `antes` = cómo está guardado.
 */
function AvisoControl({ prendido, antes, tipo = 'granel' }) {
  const [neg, setNeg] = useState(null);
  const esGranel = tipo === 'granel';
  useEffect(() => {
    let vivo = true;
    httpClient.get(esGranel ? '/stock/granel-negativo' : '/stock/enteros-negativo')
      .then((r) => { if (vivo) setNeg(r); }).catch(() => { if (vivo) setNeg(null); });
    return () => { vivo = false; };
  }, [esGranel]);

  const propios = neg?.propios ?? { controlan: 0, libres: 0 };
  const nPropios = propios.controlan + propios.libres;
  const quienes = esGranel ? 'a granel' : 'enteros';
  const lineaPropios = nPropios > 0 ? (
    <div style={{ marginTop: 6 }}>
      <strong>{nPropios} producto{nPropios === 1 ? '' : 's'} {quienes} tiene{nPropios === 1 ? '' : 'n'} control propio</strong>
      {' '}({[propios.controlan && `${propios.controlan} se controla${propios.controlan === 1 ? '' : 'n'} siempre`, propios.libres && `${propios.libres} sin control`].filter(Boolean).join(', ')}):
      esta llave no los mueve. Se ven en Compras › Productos, filtro «Con control propio».
    </div>
  ) : null;

  if (prendido && antes) return lineaPropios ? <div className={cx(s.callout, s.info)}>{lineaPropios}</div> : null;
  if (!prendido && antes) {
    return (
      <div className={cx(s.callout, s.warn)}>
        Al guardar, <strong>{esGranel ? 'todo lo que es a granel (la madre en kg y sus paquetes)' : 'todos los productos enteros'}</strong>{nPropios > 0 ? ' que siguen la configuración general' : ''} se
        vende{esGranel ? ', se fracciona' : ''}, se transfiere y se da de baja <strong>sin mirar el stock</strong>. El stock se sigue
        registrando y puede quedar en negativo; no se generan incidencias de venta sin stock para {esGranel ? 'el granel' : 'los enteros'}.
        {lineaPropios}
      </div>
    );
  }
  const n = neg?.productos ?? 0;
  return (
    <div className={cx(s.callout, n > 0 ? s.warn : s.info)}>
      {prendido ? 'Al guardar vuelve el control: lo que no hay deja de venderse y moverse.' : `El control está apagado: ${esGranel ? 'el granel' : 'los enteros'} se opera${esGranel ? '' : 'n'} sin mirar el stock.`}
      {neg && (n > 0 ? (
        <div style={{ marginTop: 6 }}>
          Hoy hay <strong>{n} producto{n === 1 ? '' : 's'} {quienes} con stock en negativo</strong>
          {neg.ejemplos?.length > 0 && <> (por ejemplo: {neg.ejemplos.slice(0, 3).map((e) => `${e.nombre} en ${e.sucursal}`).join('; ')})</>}.
          {' '}Contalos en <strong>Almacén › Control de stock</strong> antes de prenderlo: si no, la caja va a frenar esas ventas.
        </div>
      ) : (
        <div style={{ marginTop: 6 }}>Ningún producto {esGranel ? 'a granel' : 'entero'} que siga esta llave quedó en negativo.</div>
      ))}
      {lineaPropios}
    </div>
  );
}

export function ConfiguracionAlmacenPanel() {
  const { toast } = useProductos();
  const [guardado, setGuardado] = useState(null);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [confirma, setConfirma] = useState(false);
  const enVuelo = useRef(false);

  const cargar = async () => {
    setError('');
    try {
      const c = await httpClient.get('/configuracion/ventas');
      const solo = Object.fromEntries(LLAVES.map((k) => [k, c?.[k]]));
      setGuardado(solo);
      setDraft(solo);
    } catch (e) {
      setError(e?.data?.message || 'No se pudo leer la configuración.');
    }
  };
  useEffect(() => { cargar(); }, []);

  const cambios = useMemo(() => {
    if (!draft || !guardado) return {};
    return Object.fromEntries(LLAVES.filter((k) => draft[k] !== guardado[k]).map((k) => [k, draft[k]]));
  }, [draft, guardado]);
  const sucio = Object.keys(cambios).length > 0;
  useEffect(() => { setConfirma(false); }, [cambios]);
  const set = (k) => (v) => setDraft((d) => ({ ...d, [k]: v }));

  const guardar = async () => {
    if (!sucio) return;
    if (!confirma) {
      setConfirma(true);
      const que = [
        'permitirStockNegativo' in cambios && `${cambios.permitirStockNegativo ? 'PERMITIR' : 'NO PERMITIR'} vender sin stock`,
        'controlStockGranel' in cambios && `${cambios.controlStockGranel === false ? 'APAGAR' : 'PRENDER'} el control de stock a granel`,
        'controlStockEnteros' in cambios && `${cambios.controlStockEnteros === false ? 'APAGAR' : 'PRENDER'} el control de stock de los enteros`,
      ].filter(Boolean).join(' y ');
      toast(`Vas a ${que}. Tocá «Sí, guardar» para confirmar.`, 'ok');
      return;
    }
    if (enVuelo.current) return;
    enVuelo.current = true;
    setGuardando(true);
    try {
      await httpClient.put('/configuracion/ventas', cambios);
      await cargar();
      toast('Configuración de almacén guardada. La caja la toma al recargar.', 'ok');
    } catch (e) {
      toast(e?.data?.message || 'No se pudo guardar la configuración.', 'err');
    } finally {
      enVuelo.current = false;
      setGuardando(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Configuración de Almacén"
        desc="Cómo se controla el stock en todo el negocio: la caja, la tienda online, el fraccionado, las transferencias y las bajas."
        actions={draft ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={() => setDraft(guardado)} disabled={!sucio || guardando}>Descartar</Btn>
            <Btn variant="btn-primary" onClick={guardar} disabled={!sucio || guardando}>
              {guardando ? 'Guardando…' : confirma ? 'Sí, guardar' : 'Guardar cambios'}
            </Btn>
          </div>
        ) : null}
      />
      {error && (
        <div className={cx(s.callout, s.warn)}>
          {error} <Btn small onClick={cargar}>Reintentar</Btn>
        </div>
      )}
      {!draft && !error && <div className={s.hint}>Cargando…</div>}
      {draft && (
        <div className={cx(s.card, s.cardPad)}>
          <div className={s['card-title']}>Control de stock</div>
          <div style={{ display: 'grid', gap: 'var(--crm-space-3)', marginTop: 'var(--crm-space-3)' }}>
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
            <AvisoControl prendido={draft.controlStockGranel !== false} antes={guardado.controlStockGranel !== false} />
            <Interruptor
              label="Controlar el stock de los enteros"
              hint="Lo mismo que el de arriba, para los productos enteros (por unidad). Prendido (como siempre): no se vende, transfiere ni da de baja lo que no hay. Apagado: se venden, se mueven y se cargan sin mirar el stock; los movimientos se siguen registrando y el stock puede quedar en negativo. Es independiente del granel."
              checked={draft.controlStockEnteros !== false}
              onChange={set('controlStockEnteros')}
            />
            <AvisoControl tipo="entero" prendido={draft.controlStockEnteros !== false} antes={guardado.controlStockEnteros !== false} />
            <div className={s.hint} style={{ margin: 0 }}>
              Un producto puede tener su <strong>control propio</strong>, que manda sobre estas llaves: se elige en su ficha (Compras › Productos).
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
