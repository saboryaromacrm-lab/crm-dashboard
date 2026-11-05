/**
 * ANOTACIONES EN EL DASHBOARD (0219, 5/11/2026, pedido del dueño): «una parte
 * de anotación que pueda ir haciendo algún admin o yo, y que se asiente con
 * fecha, hora y usuario». Solo para admin y superadmin (la API pide lo mismo).
 *
 * Fecha, hora y usuario los pone el servidor. No se editan: la borra quien la
 * escribió o el superadmin (`puedeBorrar` viene de la API).
 *
 * Recordatorio optativo: día y hora + a quién avisarle (cualquier usuario
 * activo). A cada uno le sale el aviso arriba de toda la app
 * (RecordatoriosBanner) hasta que toca «Listo»; acá se ve quién ya lo vio.
 * Ver crm-api/src/anotaciones.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { httpClient } from '@core/services/httpClient.js';
import { EVENTO_RECORDATORIOS } from '@core/layout/components/RecordatoriosBanner.jsx';
import { errorMsg } from '@modules/ventas/services/ventas.api.js';
import { Btn, fmtFechaHora, s } from '@modules/proveedores/components/ui.jsx';

const MAX = 2000;
/** Ahora, en el formato del campo de fecha y hora (hora local, sin segundos). */
const ahoraLocal = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
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

  /** Al tildar el recordatorio: arranca en «ahora» y trae los usuarios (una vez). */
  const alternarRecordatorio = (v) => {
    setConRecordatorio(v);
    if (!v) return;
    if (!recordarEn) setRecordarEn(ahoraLocal());
    if (!usuarios) httpClient.get('/anotaciones/usuarios').then(setUsuarios).catch((e) => setError(errorMsg(e)));
  };
  const alternarUsuario = (id) => setAvisarA((xs) => {
    const ys = new Set(xs);
    if (!ys.delete(id)) ys.add(id);
    return ys;
  });

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
        <div style={{ display: 'grid', gap: 8, padding: 10, marginBottom: 6, border: '1px solid var(--crm-color-border)', borderRadius: 8 }}>
          <label htmlFor="dash-anotacion-cuando" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            Avisar el
            <input id="dash-anotacion-cuando" type="datetime-local" value={recordarEn} onChange={(e) => setRecordarEn(e.target.value)} />
            <span className={s.hint} style={{ margin: 0 }}>con la hora de ahora, avisa ya</span>
          </label>
          <div>
            <div style={{ marginBottom: 4 }}>A quién avisarle {avisarA.size > 0 && <span className={s.hint} style={{ margin: 0 }}>· {avisarA.size} elegido(s)</span>}</div>
            {!usuarios ? <span className={s.hint} style={{ margin: 0 }}>Cargando usuarios…</span> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 190px), 1fr))', gap: '2px 12px', maxHeight: 180, overflowY: 'auto' }}>
                {usuarios.map((u) => (
                  <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={avisarA.has(u.id)} onChange={() => alternarUsuario(u.id)} />
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
            {a.recordarEn && <Recordatorio a={a} />}
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

/** «⏰ Avisa el 6/11 09:00 a: Agustín ✓ visto 6/11 09:05 · María (sin ver)». */
function Recordatorio({ a }) {
  const yaAviso = new Date(a.recordarEn) <= new Date();
  return (
    <div className={s.hint} style={{ margin: '4px 0 0' }}>
      ⏰ {yaAviso ? 'Avisó' : 'Avisa'} el {fmtFechaHora(a.recordarEn)} a:{' '}
      {a.avisos.map((u, i) => (
        <span key={u.usuarioId}>
          {i > 0 && ' · '}
          <strong>{u.nombre}</strong>{' '}
          {u.vistoEn
            ? <span style={{ color: 'var(--crm-color-success)' }}>✓ visto {fmtFechaHora(u.vistoEn)}</span>
            : <span>{yaAviso ? '(sin ver)' : ''}</span>}
        </span>
      ))}
    </div>
  );
}
