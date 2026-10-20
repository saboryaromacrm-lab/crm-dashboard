/**
 * DIBUJAR UN BARRIO (0185): clic en el mapa marca las esquinas en orden; los
 * puntos se arrastran para ajustar y del medio de cada lado sale uno nuevo.
 * Los otros barrios se ven en gris, para no superponerlos (un punto que cae
 * en dos queda en el primero que se cargó). El polígono de Google es el que
 * se edita; acá se copia su contorno cada vez que cambia.
 */
import { useEffect, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { ModalShell } from '@modules/productos/components/Modal.jsx';
import { Btn, s } from '@modules/productos/components/ui.jsx';
import { FORMOSA, cargarGoogleMaps } from '../services/googleMaps.js';

const VERDE = '#086633';
const contornoDe = (path) => path.getArray().map((p) => [Number(p.lat().toFixed(6)), Number(p.lng().toFixed(6))]);

export function BarrioMapaModal({ barrio, otros, mapsKey, onGuardar, onBorrar, onCerrar }) {
  const [nombre, setNombre] = useState(barrio?.nombre ?? '');
  const [costo, setCosto] = useState(barrio?.costoEnvio ?? '');
  const [activo, setActivo] = useState(barrio?.activo ?? true);
  const [puntos, setPuntos] = useState(barrio?.poligono ?? []);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const enVuelo = useRef(false);
  const mapaRef = useRef(null);
  const poligono = useRef(null);

  /* El mapa se arma una vez: los otros barrios en gris y el que se edita en verde. */
  useEffect(() => {
    let vivo = true;
    const limpiar = [];
    cargarGoogleMaps(mapsKey).then(async (maps) => {
      const [{ Map, Polygon }, { LatLngBounds }] = await Promise.all([maps.importLibrary('maps'), maps.importLibrary('core')]);
      if (!vivo || !mapaRef.current) return;
      const mapa = new Map(mapaRef.current, { center: FORMOSA, zoom: 14, clickableIcons: false, streetViewControl: false, mapTypeControl: false });
      for (const o of otros) {
        const p = new Polygon({ map: mapa, paths: o.poligono.map(([lat, lng]) => ({ lat, lng })), clickable: false, strokeColor: '#6b7280', strokeWeight: 1, fillColor: '#9ca3af', fillOpacity: 0.25 });
        limpiar.push(() => p.setMap(null));
      }
      const pol = new Polygon({ map: mapa, editable: true, strokeColor: VERDE, strokeWeight: 2, fillColor: VERDE, fillOpacity: 0.2 });
      /* El contorno va con `setPath`, no en `paths`: un polígono que nace sin puntos no tiene camino (getPath() da undefined) y los clics no tendrían dónde ir. */
      pol.setPath((barrio?.poligono ?? []).map(([lat, lng]) => ({ lat, lng })));
      poligono.current = pol;
      const path = pol.getPath();
      const copiar = () => setPuntos(contornoDe(path));
      const escuchas = ['insert_at', 'set_at', 'remove_at'].map((ev) => path.addListener(ev, copiar));
      const clic = mapa.addListener('click', (e) => path.push(e.latLng));
      limpiar.push(() => { escuchas.forEach((x) => x.remove()); clic.remove(); pol.setMap(null); });
      /* Editando, el mapa arranca encuadrado en el barrio. */
      if (path.getLength()) {
        const caja = new LatLngBounds();
        path.forEach((p) => caja.extend(p));
        mapa.fitBounds(caja, 40);
      }
    }).catch((e) => { if (vivo) setError(e.message); });
    return () => { vivo = false; limpiar.forEach((f) => f()); };
    // El mapa se arma una sola vez por ventana: lo que cambia después vive en el polígono.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const path = () => poligono.current?.getPath();
  /** Una cosa por vez (candado), y el error queda en la ventana. */
  const enviar = async (fn) => {
    if (enVuelo.current) return;
    enVuelo.current = true;
    setGuardando(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e?.data?.message || 'No se pudo guardar el barrio.');
    } finally {
      enVuelo.current = false;
      setGuardando(false);
    }
  };
  const guardar = () => {
    if (!nombre.trim()) { setError('Poné el nombre del barrio.'); return; }
    if (puntos.length < 3) { setError('Marcá al menos 3 esquinas en el mapa.'); return; }
    enviar(() => onGuardar({ nombre: nombre.trim(), poligono: puntos, costoEnvio: costo === '' ? null : Number(costo), activo }));
  };
  /* Borrar pide un segundo clic. */
  const borrar = () => (borrando ? enviar(onBorrar) : setBorrando(true));

  return (
    <ModalShell
      title={barrio ? `Barrio ${barrio.nombre}` : 'Nuevo barrio'}
      subtitle="Clic en el mapa marca las esquinas, en orden. Los puntos se arrastran; del medio de cada lado sale uno nuevo."
      size="lg"
      onClose={onCerrar}
      footer={[
        ...(barrio ? [{ texto: borrando ? 'Sí, borrarlo' : 'Borrar', clase: 'btn-delete', onClick: borrar, disabled: guardando }] : []),
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: onCerrar },
        { texto: guardando ? 'Guardando…' : 'Guardar barrio', clase: 'btn-primary', onClick: guardar, disabled: guardando },
      ]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 12 }}>
        <div className={s.field}>
          <label htmlFor="barrio-nombre">Nombre</label>
          <input id="barrio-nombre" value={nombre} maxLength={60} placeholder="Ej: Independencia" onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className={s.field}>
          <label htmlFor="barrio-costo">Costo del envío ($)</label>
          <input id="barrio-costo" type="number" min="0" step="100" value={costo} placeholder="Se coordina" onChange={(e) => setCosto(e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0))} />
        </div>
      </div>
      <div className={s.hint} style={{ margin: 0 }}>
        Vacío = sin costo propio: se coordina por WhatsApp (o gratis si el pedido llega al «envío gratis desde»). 0 = siempre gratis.
      </div>
      <div ref={mapaRef} style={{ height: 420, borderRadius: 8, border: '1px solid var(--crm-color-border)', background: 'var(--crm-color-bg)' }} />
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <span className={s.hint} style={{ margin: 0, flex: 1 }}>{puntos.length} {puntos.length === 1 ? 'esquina' : 'esquinas'} marcadas{otros.length > 0 ? ' · en gris, los otros barrios' : ''}</span>
        <Btn small onClick={() => path()?.pop()} disabled={!puntos.length}>Deshacer última</Btn>
        <Btn small onClick={() => path()?.clear()} disabled={!puntos.length}>Borrar dibujo</Btn>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
        <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
        Activo (desactivado, la tienda no lo usa ni anuncia sus promos)
      </label>
      {borrando && <div className={cx(s.callout, s.warn)} style={{ margin: 0 }}>Se borra el barrio: los pedidos que ya entraron conservan su nombre. Tocá «Sí, borrarlo» para confirmar.</div>}
      {error && <div className={cx(s.callout, s.warn)} style={{ margin: 0 }}>{error}</div>}
    </ModalShell>
  );
}
