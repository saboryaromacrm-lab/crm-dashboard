/**
 * ANOTACIONES EN EL DASHBOARD (0219, 5/11/2026, pedido del dueño): «una parte
 * de anotación que pueda ir haciendo algún admin o yo, y que se asiente con
 * fecha, hora y usuario». Solo para admin y superadmin (la API pide lo mismo).
 *
 * Fecha, hora y usuario los pone el servidor. El texto no se edita: la borra
 * quien la escribió o el superadmin (`puedeBorrar` viene de la API).
 *
 * Recordatorio optativo: día y hora + a quién avisarle (cualquier usuario
 * activo). A cada uno le sale el aviso arriba de toda la app
 * (RecordatoriosBanner) hasta que toca «Listo»; acá se ve para quién es y
 * quién ya lo vio. El recordatorio lo cambia, agrega o saca solo quien escribió
 * la anotación (`puedeEditar`, 9/11/2026). Ver crm-api/src/anotaciones.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { httpClient } from '@core/services/httpClient.js';
import { EVENTO_RECORDATORIOS } from '@core/layout/components/RecordatoriosBanner.jsx';
import { errorMsg } from '@modules/ventas/services/ventas.api.js';
import { Btn, fmtFechaHora, s } from '@modules/proveedores/components/ui.jsx';

const MAX = 2000;
/** Una fecha, en el formato del campo de fecha y hora (hora local, sin segundos). */
const aLocal = (fecha) => {
  const d = new Date(fecha);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const alternarEn = (set, id) => {
  const ys = new Set(set);
  if (!ys.delete(id)) ys.add(id);
  return ys;
};

export function Anotaciones() {
  const [filas, setFilas] = useState([]);
  const [hayMas, setHayMas] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [texto, setTexto] = useState('');
  const [conRecordatorio, setConRecordatorio] = useState(false);
  const [recordarEn, setRecordarEn] = useState('');
  const [avisarA, setAvisarA] = useState(() => new Set());
  const [usuarios, setUsuarios] = useState(null);
  const [error, setError] = useState('');
  const [aBorrar, setABorrar] = useState(null);
  const [editando, setEditando] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  /* El doble clic no puede asentar dos veces: el candado va con useRef. */
  const candado = useRef(false);

  const traer = useCallback(async (antes) => {
    const d = await httpClient.get(`/anotaciones${antes ? `?antes=${antes}` : ''}`);
    setFilas((xs) => (antes ? [...xs, ...d.filas] : d.filas));
    setHayMas(d.hayMas);
    setCargado(true);
  }, []);

  useEffect(() => { traer().catch((e) => setError(errorMsg(e))); }, [traer]);

  const conCandado = async (fn) => {
    if (candado.current) return;
    candado.current = true;
    setOcupado(true);
    setError('');
    try { await fn(); } catch (e) { setError(errorMsg(e)); } finally {
      candado.current = false;
      setOcupado(false);
    }
  };

  /** A quién se le puede avisar: se trae la primera vez que hace falta. */
  const traerUsuarios = () => {
    if (!usuarios) httpClient.get('/anotaciones/usuarios').then(setUsuarios).catch((e) => setError(errorMsg(e)));
  };
  /** Al tildar el recordatorio: arranca en «ahora». */
  const alternarRecordatorio = (v) => {
    setConRecordatorio(v);
    if (!v) return;
    if (!recordarEn) setRecordarEn(aLocal(new Date()));
    traerUsuarios();
  };

  const faltaRecordatorio = conRecordatorio && (!recordarEn || !avisarA.size);
  const anotar = () => conCandado(async () => {
    if (!texto.trim() || faltaRecordatorio) return;
    await httpClient.post('/anotaciones', {
      texto,
      ...(conRecordatorio ? { recordarEn: new Date(recordarEn).toISOString(), avisarA: [...avisarA] } : {}),
    });
    setTexto('');
    setConRecordatorio(false);
    setRecordarEn('');
    setAvisarA(new Set());
    /* Si me avisé a mí para ahora, que el banner no espere su próxima vuelta. */
    window.dispatchEvent(new Event(EVENTO_RECORDATORIOS));
    await traer();
  });

  /** Cambiar o sacar el recordatorio (`recordarEn` null = sacarlo). */
  const guardarRecordatorio = (id, cambio) => conCandado(async () => {
    await httpClient.put(`/anotaciones/${id}/recordatorio`, cambio.recordarEn
      ? { recordarEn: new Date(cambio.recordarEn).toISOString(), avisarA: [...cambio.avisarA] }
      : {});
    setEditando(null);
    window.dispatchEvent(new Event(EVENTO_RECORDATORIOS));
    /* Se vuelve a pedir la página que ya se ve: los «visto» pudieron volver a cero. */
    const d = await httpClient.get('/anotaciones');
    setFilas((xs) => xs.map((a) => d.filas.find((n) => n.id === a.id) ?? a));
  });

  const borrar = (id) => conCandado(async () => {
    await httpClient.delete(`/anotaciones/${id}`);
    setABorrar(null);
    setFilas((xs) => xs.filter((a) => a.id !== id));
    window.dispatchEvent(new Event(EVENTO_RECORDATORIOS));
  });

  return (
    <div className={cx(s.card, s.cardPad)}>
      <h3 className={s['card-title']}>Anotaciones</h3>
      <label htmlFor="dash-anotacion" className={s.hint} style={{ display: 'block', margin: '0 0 6px' }}>
        Queda asentada con la fecha, la hora y tu usuario. Solo la ven el admin y el superadmin.
      </label>
      <textarea
        id="dash-anotacion" rows={3} maxLength={MAX} value={texto}
        placeholder="Escribí la anotación…"
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); anotar(); } }}
        style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', font: 'inherit' }}
      />

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '6px 0', cursor: 'pointer', width: 'fit-content' }}>
        <input id="dash-anotacion-rec" type="checkbox" checked={conRecordatorio} onChange={(e) => alternarRecordatorio(e.target.checked)} />
        Con recordatorio
      </label>
      {conRecordatorio && (
        <CamposRecordatorio
          idBase="dash-anotacion" usuarios={usuarios}
          recordarEn={recordarEn} onFecha={setRecordarEn}
          avisarA={avisarA} onUsuario={(id) => setAvisarA((xs) => alternarEn(xs, id))}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0 12px', flexWrap: 'wrap' }}>
        <Btn variant="btn-primary" onClick={anotar} disabled={ocupado || !texto.trim() || faltaRecordatorio}>Anotar</Btn>
        <span className={s.hint} style={{ margin: 0 }}>
          {faltaRecordatorio && texto.trim() ? 'Elegí el día y a quién avisarle · ' : ''}Ctrl + Enter también anota · {texto.length}/{MAX}
        </span>
      </div>
      {error && <div style={{ color: 'var(--crm-color-danger)', marginBottom: 8 }}>{error}</div>}

      {cargado && !filas.length && <div className={s.hint} style={{ margin: 0 }}>Todavía no hay anotaciones.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 420, overflowY: 'auto' }}>
        {filas.map((a) => (
          <div key={a.id} style={{ padding: '8px 0', borderTop: '1px solid var(--crm-color-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className={s.hint} style={{ margin: 0 }}>
                {fmtFechaHora(a.creadoEn)} · <strong>{a.usuarioNombre}</strong>
              </span>
              {a.puedeBorrar && (
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                  {aBorrar === a.id ? (
                    <>
                      <Btn small variant="btn-delete" onClick={() => borrar(a.id)} disabled={ocupado}>Sí, borrar</Btn>
                      <Btn small onClick={() => setABorrar(null)}>No</Btn>
                    </>
                  ) : <Btn small onClick={() => setABorrar(a.id)}>Borrar</Btn>}
                </span>
              )}
            </div>
            <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginTop: 2 }}>{a.texto}</div>
            {editando === a.id ? (
              <EditarRecordatorio
                a={a} usuarios={usuarios} ocupado={ocupado}
                onGuardar={(cambio) => guardarRecordatorio(a.id, cambio)}
                onCancelar={() => setEditando(null)}
              />
            ) : (
              <>
                {a.recordarEn && <Recordatorio a={a} />}
                {a.puedeEditar && (
                  <Btn small style={{ marginTop: 4 }} disabled={ocupado} onClick={() => { traerUsuarios(); setEditando(a.id); }}>
                    {a.recordarEn ? 'Editar recordatorio' : 'Agregar recordatorio'}
                  </Btn>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      {hayMas && (
        <Btn small style={{ marginTop: 8 }} disabled={ocupado} onClick={() => conCandado(() => traer(filas.at(-1)?.id))}>
          Ver más
        </Btn>
      )}
    </div>
  );
}

/** Día y hora + a quién avisarle: lo mismo al anotar y al editar. */
function CamposRecordatorio({ idBase, usuarios, recordarEn, onFecha, avisarA, onUsuario }) {
  return (
    <div style={{ display: 'grid', gap: 8, padding: 10, marginBottom: 6, border: '1px solid var(--crm-color-border)', borderRadius: 8, minWidth: 0 }}>
      <label htmlFor={`${idBase}-cuando`} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        Avisar el
        <input id={`${idBase}-cuando`} type="datetime-local" value={recordarEn} onChange={(e) => onFecha(e.target.value)} style={{ maxWidth: '100%' }} />
        <span className={s.hint} style={{ margin: 0 }}>con la hora de ahora, avisa ya</span>
      </label>
      <div>
        <div style={{ marginBottom: 4 }}>A quién avisarle {avisarA.size > 0 && <span className={s.hint} style={{ margin: 0 }}>· {avisarA.size} elegido(s)</span>}</div>
        {!usuarios ? <span className={s.hint} style={{ margin: 0 }}>Cargando usuarios…</span> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 190px), 1fr))', gap: '2px 12px', maxHeight: 180, overflowY: 'auto' }}>
            {usuarios.map((u) => (
              <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input id={`${idBase}-u${u.id}`} type="checkbox" checked={avisarA.has(u.id)} onChange={() => onUsuario(u.id)} />
                <span>{u.nombre} <span className={s.hint} style={{ margin: 0 }}>· {u.rol}</span></span>
              </label>
            ))}
          </div>
        )}
      </div>
      <span className={s.hint} style={{ margin: 0 }}>
        Desde esa hora le sale un aviso arriba de todo el ERP hasta que toca «Listo».
      </span>
    </div>
  );
}

/** Cambiar el día, a quién, o sacarlo. Solo quien escribió la anotación (la API también lo exige). */
function EditarRecordatorio({ a, usuarios, ocupado, onGuardar, onCancelar }) {
  const [recordarEn, setRecordarEn] = useState(() => aLocal(a.recordarEn ?? new Date()));
  const [avisarA, setAvisarA] = useState(() => new Set(a.avisos.map((u) => u.usuarioId)));
  const cambiaElDia = a.recordarEn && recordarEn !== aLocal(a.recordarEn);
  const algunoLoVio = a.avisos.some((u) => u.vistoEn);
  return (
    <div style={{ marginTop: 6 }}>
      <CamposRecordatorio
        idBase={`anot-${a.id}`} usuarios={usuarios}
        recordarEn={recordarEn} onFecha={setRecordarEn}
        avisarA={avisarA} onUsuario={(id) => setAvisarA((xs) => alternarEn(xs, id))}
      />
      {cambiaElDia && algunoLoVio && (
        <div className={s.hint} style={{ margin: '0 0 6px' }}>
          Con otro día y hora el aviso les vuelve a salir a todos, también a los que ya lo vieron.
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Btn small variant="btn-primary" disabled={ocupado || !recordarEn || !avisarA.size} onClick={() => onGuardar({ recordarEn, avisarA })}>
          Guardar recordatorio
        </Btn>
        {a.recordarEn && <Btn small disabled={ocupado} onClick={() => onGuardar({ recordarEn: null })}>Sacar recordatorio</Btn>}
        <Btn small disabled={ocupado} onClick={onCancelar}>Cancelar</Btn>
      </div>
    </div>
  );
}

/**
 * «⏰ Avisa el 13/11 15:43» y abajo «Para: Lucas (todavía no se le mostró) ·
 * María ✓ visto …»: para quién es va en su renglón, que es lo primero que se busca.
 */
function Recordatorio({ a }) {
  const yaAviso = new Date(a.recordarEn) <= new Date();
  return (
    <div className={s.hint} style={{ margin: '4px 0 0', overflowWrap: 'anywhere' }}>
      <div>⏰ {yaAviso ? 'Avisó' : 'Avisa'} el <strong>{fmtFechaHora(a.recordarEn)}</strong></div>
      <div>
        Para:{' '}
        {a.avisos.map((u, i) => (
          <span key={u.usuarioId}>
            {i > 0 && ' · '}
            <strong>{u.nombre}</strong>{' '}
            {u.vistoEn
              ? <span style={{ color: 'var(--crm-color-success)' }}>✓ visto {fmtFechaHora(u.vistoEn)}</span>
              : <span>{yaAviso ? '(sin ver)' : '(todavía no se le mostró)'}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
