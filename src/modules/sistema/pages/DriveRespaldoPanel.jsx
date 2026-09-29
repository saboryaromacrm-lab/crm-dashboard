/**
 * RESPALDO A GOOGLE DRIVE (Sistema › Respaldos, 29/9/2026)
 * ============================================================================
 * Pedido del dueño: que el sistema mande solo, todos los días a la hora que él
 * programe —y también a mano—, una copia de la base a su Drive.
 *
 * Esta pantalla solo MUESTRA el estado que calcula la API y manda las órdenes:
 * conectar (Google pide el permiso en su propia pantalla), programar, respaldar
 * ahora y desconectar. Conectar, programar y desconectar son del superadmin —
 * la copia tiene toda la información del negocio—; el servidor lo revalida.
 *
 * LO QUE FALLA SE VE EN ROJO y arriba de todo: una copia que dejó de subir sin
 * que nadie lo note es peor que no tener copia.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { cx } from '@shared/utils/classNames.js';
import { Btn, Stat, s } from '@modules/productos/components/ui.jsx';
import { fmtFechaHora } from '@modules/productos/domain/format.js';

const mb = (bytes) => `${(Number(bytes) / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
/** Más de esto sin una copia buena, con el respaldo encendido, es una alarma. */
const HORAS_ALARMA = 36;

export function DriveRespaldoPanel({ esSuper, onAviso }) {
  const [e, setE] = useState(null);
  const [error, setError] = useState('');
  /* Lo que se está editando en el formulario (null = sin cambios). */
  const [borrador, setBorrador] = useState(null);
  const [guardando, setGuardando] = useState(false);
  /* Desde cuándo se espera el resultado de «Respaldar ahora». */
  const [esperandoDesde, setEsperandoDesde] = useState(null);
  const [confirmaDesconectar, setConfirmaDesconectar] = useState(false);
  const enVuelo = useRef(false);

  const cargar = useCallback(async () => {
    try {
      setE(await httpClient.get('/sistema/respaldos/drive/estado'));
      setError('');
    } catch (err) {
      setError(err?.data?.message || 'No se pudo consultar el respaldo a Drive.');
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  /* Mientras hay una copia en marcha (o se espera el resultado), se mira cada 3 s. */
  const enMarcha = !!e?.corriendo || esperandoDesde != null;
  useEffect(() => {
    if (!enMarcha) return undefined;
    const t = setInterval(cargar, 3000);
    return () => clearInterval(t);
  }, [enMarcha, cargar]);

  /* Terminó la copia que se esperaba: se cuenta cómo salió. */
  useEffect(() => {
    if (esperandoDesde == null || !e || e.corriendo) return;
    if (!e.ultimoIntento || new Date(e.ultimoIntento).getTime() < esperandoDesde - 2000) return;
    setEsperandoDesde(null);
    if (e.ultimoError && !e.ultimoOk) onAviso?.({ tipo: 'err', texto: e.ultimoError });
    else if (e.ultimoError && new Date(e.ultimoOk).getTime() < new Date(e.ultimoIntento).getTime()) onAviso?.({ tipo: 'err', texto: e.ultimoError });
    else onAviso?.({ tipo: 'ok', texto: `Copia subida a Drive: ${e.ultimoArchivo} (${mb(e.ultimoTamano)}).` });
  }, [e, esperandoDesde, onAviso]);

  const conectar = async () => {
    if (enVuelo.current) return;
    enVuelo.current = true;
    try {
      const r = await httpClient.post('/sistema/respaldos/drive/conectar', {});
      window.location.assign(r.url);
    } catch (err) {
      enVuelo.current = false;
      onAviso?.({ tipo: 'err', texto: err?.data?.message || 'No se pudo iniciar la conexión con Google.' });
    }
  };

  const respaldarAhora = async () => {
    if (enVuelo.current || enMarcha) return;
    enVuelo.current = true;
    try {
      await httpClient.post('/sistema/respaldos/drive/ahora', {});
      setEsperandoDesde(Date.now());
      onAviso?.({ tipo: 'ok', texto: 'Generando la copia y subiéndola a Drive… tarda un momento.' });
      cargar();
    } catch (err) {
      onAviso?.({ tipo: 'err', texto: err?.data?.message || 'No se pudo iniciar la copia.' });
    } finally {
      enVuelo.current = false;
    }
  };

  const guardar = async () => {
    if (!borrador || guardando) return;
    setGuardando(true);
    try {
      setE(await httpClient.post('/sistema/respaldos/drive/configurar', {
        activo: borrador.activo, hora: borrador.hora, dias: Number(borrador.dias), cifrar: borrador.cifrar,
      }));
      setBorrador(null);
      onAviso?.({ tipo: 'ok', texto: 'Configuración del respaldo guardada.' });
    } catch (err) {
      onAviso?.({ tipo: 'err', texto: err?.data?.message?.[0] || err?.data?.message || 'No se pudo guardar.' });
    } finally {
      setGuardando(false);
    }
  };

  const desconectar = async () => {
    if (enVuelo.current) return;
    if (!confirmaDesconectar) { setConfirmaDesconectar(true); return; }
    enVuelo.current = true;
    try {
      await httpClient.post('/sistema/respaldos/drive/desconectar', {});
      setConfirmaDesconectar(false);
      onAviso?.({ tipo: 'ok', texto: 'Drive desconectado. Las copias que ya estaban en tu Drive no se tocaron.' });
      await cargar();
    } catch (err) {
      onAviso?.({ tipo: 'err', texto: err?.data?.message || 'No se pudo desconectar.' });
    } finally {
      enVuelo.current = false;
    }
  };

  if (error) return <div className={cx(s.callout, s.warn)}>{error}</div>;
  if (!e) return <div className={s.hint}>Cargando el respaldo a Drive…</div>;

  const f = borrador ?? { activo: e.activo, hora: e.hora, dias: e.dias, cifrar: e.cifrar };
  const cambiar = (parche) => setBorrador({ ...f, ...parche });
  const horasSinCopia = e.ultimoOk ? (Date.now() - new Date(e.ultimoOk).getTime()) / 3600000 : null;
  const alarma = e.conectado && e.activo && (horasSinCopia == null || horasSinCopia > HORAS_ALARMA);

  return (
    <div>
      <div className={s['section-title']}>Copia automática a Google Drive</div>

      {!e.disponible && (
        <div className={cx(s.callout, s.warn)}>
          <strong>Falta configurar Google en el servidor.</strong> En Dokploy, en las variables del backend, cargá{' '}
          <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code> y <code>GOOGLE_REDIRECT_URI</code>, y
          reiniciá. Después vas a poder conectar tu Drive desde acá.
        </div>
      )}

      {e.ultimoError && (
        <div className={cx(s.callout, s.warn)} style={{ borderLeft: '4px solid var(--crm-color-danger)' }}>
          <strong>La última copia a Drive falló{e.ultimoIntento ? ` (${fmtFechaHora(e.ultimoIntento)})` : ''}.</strong>{' '}
          {e.ultimoError}
        </div>
      )}

      {alarma && !e.ultimoError && (
        <div className={cx(s.callout, s.warn)}>
          {horasSinCopia == null
            ? 'Todavía no se subió ninguna copia. Apretá «Respaldar ahora» para hacer la primera.'
            : `Hace ${Math.floor(horasSinCopia)} horas que no sube una copia a Drive. Revisá que el servidor esté andando o apretá «Respaldar ahora».`}
        </div>
      )}

      {!e.conectado ? (
        <div className={cx(s.callout, s.info)} style={{ margin: 0 }}>
          <p style={{ margin: '0 0 8px' }}>
            <strong>Drive todavía no está conectado.</strong> Al conectarlo, el sistema guarda una copia completa de la
            base todos los días a la hora que elijas, en una carpeta propia de tu Drive. Solo puede ver esa carpeta:{' '}
            <strong>no toca ningún otro archivo tuyo</strong>.
          </p>
          {esSuper ? (
            <Btn variant="btn-primary" disabled={!e.disponible} onClick={conectar}>Conectar Google Drive</Btn>
          ) : (
            <span className={s.hint} style={{ margin: 0 }}>Lo conecta el superadmin.</span>
          )}
        </div>
      ) : (
        <>
          <div className={s.stats}>
            <Stat label="Cuenta conectada" value={e.email || 'Google Drive'} />
            <Stat
              label="Última copia"
              value={e.ultimoOk ? fmtFechaHora(e.ultimoOk) : 'Ninguna todavía'}
              accent={alarma ? 'accent-amber' : undefined}
            />
            <Stat label="Tamaño" value={e.ultimoOk ? mb(e.ultimoTamano) : '—'} />
            <Stat
              label="Próxima copia"
              value={e.activo ? (e.proxima ? fmtFechaHora(e.proxima) : '—') : 'Apagada'}
            />
          </div>

          {e.ultimoOk && (
            <div className={s.hint} style={{ marginTop: 0 }}>
              Último archivo: <code>{e.ultimoArchivo}</code> ({e.ultimoOrigen === 'programado' ? 'programada' : 'a mano'}).
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '10px 0' }}>
            <Btn variant="btn-primary" disabled={enMarcha} onClick={respaldarAhora}>
              {enMarcha ? 'Subiendo la copia…' : 'Respaldar ahora'}
            </Btn>
            {e.carpetaUrl && (
              <a className={cx(s.btn, s['btn-ghost'])} href={e.carpetaUrl} target="_blank" rel="noopener noreferrer">
                Abrir la carpeta en Drive
              </a>
            )}
          </div>

          {esSuper && (
            <div className={s['form-grid']} style={{ alignItems: 'end' }}>
              <label className={s['granel-toggle']} style={{ gridColumn: '1 / -1' }}>
                <input type="checkbox" checked={f.activo} onChange={(ev) => cambiar({ activo: ev.target.checked })} />
                <span>
                  <span className={s['t-title']}>Copia automática todos los días</span><br />
                  <span className={s['t-sub']}>Si el servidor estaba apagado a esa hora, la hace apenas vuelve.</span>
                </span>
              </label>
              <div className={s.field}>
                <label htmlFor="drive-hora">Hora (Argentina)</label>
                <input id="drive-hora" type="time" value={f.hora} onChange={(ev) => cambiar({ hora: ev.target.value })} />
              </div>
              <div className={s.field}>
                <label htmlFor="drive-dias">Guardar las copias de los últimos (días)</label>
                <input
                  id="drive-dias" type="number" min="3" max="365" value={f.dias}
                  onChange={(ev) => cambiar({ dias: ev.target.value })}
                />
                <div className={s.hint} style={{ margin: 0 }}>Las más viejas se borran de Drive solas. Siempre quedan al menos 3.</div>
              </div>
              <label className={s['granel-toggle']} style={{ gridColumn: '1 / -1' }}>
                <input
                  type="checkbox" checked={f.cifrar} disabled={!e.tieneClave && !f.cifrar}
                  onChange={(ev) => cambiar({ cifrar: ev.target.checked })}
                />
                <span>
                  <span className={s['t-title']}>Cifrar la copia con contraseña (recomendado)</span><br />
                  <span className={s['t-sub']}>
                    La copia lleva los datos de tus clientes y usuarios. Cifrada, nadie puede leerla aunque entre a tu
                    Drive. {e.tieneClave
                      ? <><strong>Guardá la contraseña (BACKUP_CLAVE) en un lugar seguro, aparte del servidor:</strong> sin ella la copia no se puede abrir, y no hay forma de recuperarla.</>
                      : <strong>Falta cargar BACKUP_CLAVE en Dokploy para poder cifrar.</strong>}
                  </span>
                </span>
              </label>
              {borrador && (
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
                  <Btn variant="btn-primary" disabled={guardando} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar cambios'}</Btn>
                  <Btn onClick={() => setBorrador(null)}>Descartar</Btn>
                </div>
              )}
            </div>
          )}

          {esSuper && (
            <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Btn variant={confirmaDesconectar ? 'btn-delete' : 'btn-ghost'} onClick={desconectar}>
                {confirmaDesconectar ? 'Sí, desconectar Drive' : 'Desconectar Drive'}
              </Btn>
              {confirmaDesconectar && (
                <>
                  <Btn onClick={() => setConfirmaDesconectar(false)}>Cancelar</Btn>
                  <span className={s.hint} style={{ margin: 0 }}>
                    Se dejan de subir copias. Las que ya están en tu Drive no se borran.
                  </span>
                </>
              )}
            </div>
          )}
        </>
      )}

      <div className={s.hint}>
        <strong>Para abrir una copia cifrada</strong> (bajada de Drive): en cualquier computadora con Node.js,{' '}
        <code>node descifrar-respaldo.mjs respaldo-crm-….sql.gz.enc</code> pide la contraseña y deja el <code>.sql</code>{' '}
        listo para restaurar. El programa está en la carpeta <code>scripts</code> del sistema.
      </div>
    </div>
  );
}
