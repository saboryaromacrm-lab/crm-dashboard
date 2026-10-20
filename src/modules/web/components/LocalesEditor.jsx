/**
 * LOS LOCALES Y SUS HORARIOS (20/10/2026, pedido del dueño): dirección,
 * teléfono y el horario de cada día. Salen en el pie de la tienda y en la
 * ficha de comercio que lee Google («abierto ahora», el mapa). Se guarda con
 * su propio botón, como el cartel de bienvenida.
 *
 * En la config cada día es un texto «08:00-13:00, 17:00-21:00» (vacío =
 * cerrado); acá se edita con relojes: abierto o no, y uno o dos turnos.
 */
import { useRef, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { Btn, s } from '@modules/productos/components/ui.jsx';

/* Las claves del servidor (DIAS_SEMANA en configuracion.module.ts). */
const DIAS = [['lun', 'Lunes'], ['mar', 'Martes'], ['mie', 'Miércoles'], ['jue', 'Jueves'], ['vie', 'Viernes'], ['sab', 'Sábado'], ['dom', 'Domingo']];
const HABILES = ['mar', 'mie', 'jue', 'vie'];
const MAX_LOCALES = 6;
const TOPE = 120;
const TURNO_VACIO = ['', ''];
const LOCAL_NUEVO = { nombre: '', direccion: '', localidad: 'Formosa', telefono: '', ...Object.fromEntries(DIAS.map(([d]) => [d, ''])) };

/** «08:00-13:00, 17:00-21:00» → dos turnos [desde, hasta] (el segundo puede venir vacío). */
const turnosDe = (texto) => {
  const t = String(texto ?? '').split(',').map((x) => x.trim().split('-')).filter((x) => x.length === 2);
  return [t[0] ?? TURNO_VACIO, t[1] ?? TURNO_VACIO];
};
/** Los turnos, de vuelta a texto. Uno a medias queda («17:00-») hasta completarlo: guardar lo frena (`problemaDe`). */
const textoDe = (turnos) => turnos.filter(([a, b]) => a || b).map(([a, b]) => `${a}-${b}`).join(', ');

function Dia({ id, nombre, valor, onChange }) {
  const abierto = Boolean(valor);
  const [t1, t2] = turnosDe(valor);
  const cambiar = (i, j) => (e) => {
    const turnos = [[...t1], [...t2]];
    turnos[i][j] = e.target.value;
    onChange(textoDe(turnos));
  };
  const reloj = (i, j, etiqueta) => (
    <input
      type="time" id={`${id}-${i}${j}`} aria-label={`${nombre}: ${etiqueta}`} value={[t1, t2][i][j]}
      onChange={cambiar(i, j)} style={{ width: 'auto' }}
    />
  );
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '4px 0', borderTop: '1px solid var(--crm-color-border)' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, width: 130, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
        <input type="checkbox" checked={abierto} onChange={(e) => onChange(e.target.checked ? '08:00-13:00' : '')} />
        {nombre}
      </label>
      {abierto ? (
        <>
          {reloj(0, 0, 'abre')} <span className={s.hint} style={{ margin: 0 }}>a</span> {reloj(0, 1, 'cierra')}
          <span className={s.hint} style={{ margin: '0 4px' }}>y</span>
          {reloj(1, 0, 'abre a la tarde')} <span className={s.hint} style={{ margin: 0 }}>a</span> {reloj(1, 1, 'cierra a la tarde')}
          {(t2[0] || t2[1]) && <Btn small onClick={() => onChange(textoDe([t1]))} title="Sin turno de la tarde">×</Btn>}
        </>
      ) : <span className={s.hint} style={{ margin: 0 }}>Cerrado</span>}
    </div>
  );
}

/** El primer problema de un local, o null: un turno a medias o que cierra antes de abrir. */
function problemaDe(local, n) {
  if (!String(local.nombre ?? '').trim() && !String(local.direccion ?? '').trim()) return `El local ${n} necesita nombre o dirección.`;
  for (const [d, nombre] of DIAS) {
    if (!local[d]) continue;
    for (const [a, b] of turnosDe(local[d])) {
      if ((a && !b) || (!a && b)) return `${local.nombre || `Local ${n}`}: completá el horario del ${nombre.toLowerCase()}.`;
      if (a && b && a >= b) return `${local.nombre || `Local ${n}`}: el ${nombre.toLowerCase()} cierra antes de abrir (${a} a ${b}).`;
    }
  }
  return null;
}

export function LocalesEditor({ web, setWeb, avisar }) {
  const [guardando, setGuardando] = useState(false);
  const enVuelo = useRef(false);
  const locales = web.locales ?? [];
  const setLocales = (l) => setWeb((w) => ({ ...w, locales: l }));
  const setCampo = (i, k) => (v) => setLocales(locales.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const copiarLunes = (i) => setLocales(locales.map((l, j) => (j === i ? { ...l, ...Object.fromEntries(HABILES.map((d) => [d, l.lun])) } : l)));

  const guardar = async () => {
    if (enVuelo.current) return;
    const problema = locales.map(problemaDe).find(Boolean);
    if (problema) { avisar('err', problema); return; }
    enVuelo.current = true; setGuardando(true);
    try {
      const r = await httpClient.put('/configuracion/web', { locales });
      if (r && typeof r === 'object') setLocales(r.locales);
      avisar('ok', locales.length ? 'Locales y horarios guardados: se ven al recargar la tienda.' : 'Sin locales: la tienda ya no muestra direcciones ni horarios.');
    } catch (e) {
      avisar('err', e?.data?.message || 'No se pudieron guardar los locales.');
    } finally {
      enVuelo.current = false; setGuardando(false);
    }
  };

  const texto = (i, k, label, placeholder) => (
    <div className={s.field}>
      <label htmlFor={`local-${i}-${k}`}>{label}</label>
      <input id={`local-${i}-${k}`} value={locales[i][k] ?? ''} maxLength={TOPE} placeholder={placeholder} onChange={(e) => setCampo(i, k)(e.target.value)} />
    </div>
  );

  return (
    <>
      <div className={s['section-title']}>Locales y horarios</div>
      <div className={s.hint} style={{ margin: 0 }}>
        Los locales donde se puede retirar o comprar, con su horario. Aparecen en el pie de la tienda y Google los usa para mostrar
        la dirección, el mapa y si está abierto. Sin locales cargados, no se muestra nada.
      </div>
      {locales.map((l, i) => (
        <div key={i} className={s.card} style={{ padding: '12px 14px', display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <strong style={{ fontSize: 13.5 }}>{l.nombre || `Local ${i + 1}`}</strong>
            <Btn variant="btn-delete" small onClick={() => setLocales(locales.filter((_, j) => j !== i))}>Quitar local</Btn>
          </div>
          <div className={s['form-grid']}>
            {texto(i, 'nombre', 'Nombre', 'Ej: Sabor y Aroma Centro')}
            {texto(i, 'telefono', 'Teléfono (opcional)', 'Ej: 370 4123456')}
          </div>
          <div className={s['form-grid']}>
            {texto(i, 'direccion', 'Dirección', 'Ej: Av. 25 de Mayo 450')}
            {texto(i, 'localidad', 'Ciudad', 'Formosa')}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>Horario</span>
              {l.lun && <Btn small onClick={() => copiarLunes(i)}>Copiar el lunes de martes a viernes</Btn>}
            </div>
            {DIAS.map(([d, nombre]) => <Dia key={d} id={`local-${i}-${d}`} nombre={nombre} valor={l[d]} onChange={setCampo(i, d)} />)}
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {locales.length < MAX_LOCALES && <Btn small onClick={() => setLocales([...locales, { ...LOCAL_NUEVO }])}>+ Agregar local</Btn>}
        <Btn variant="btn-primary" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar locales y horarios'}</Btn>
      </div>
    </>
  );
}
