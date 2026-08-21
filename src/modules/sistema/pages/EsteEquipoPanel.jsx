/**
 * SISTEMA › ESTE EQUIPO — registrar la máquina para que el login no pregunte
 * ============================================================================
 * La sucursal se elegía a mano al entrar, de un desplegable que venía
 * precargado con la primera de la lista: la cajera que no lo tocaba entraba en
 * la Distribuidora sin haber decidido nada, y vendía descontando stock del
 * local equivocado. **Ni el cierre de caja lo detecta** — el arqueo da cero
 * igual, porque es coherente consigo mismo.
 *
 * Registrando el equipo, el login de esta máquina deja de preguntar: muestra
 * "Caja 2 · Distribuidora" y la cajera solo pone quién es y su clave. No es un
 * aviso mejor, es **una decisión menos** — y una decisión que no se toma no se
 * puede errar.
 *
 * Se registra desde el propio equipo a propósito: el token queda en el
 * navegador de ESTA máquina, así que registrar la Caja 2 desde la oficina no
 * tendría ningún efecto en la Caja 2.
 */
import { useCallback, useEffect, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { cx } from '@shared/utils/classNames.js';
import { PanelHead, Btn, Table, s } from '@modules/productos/components/ui.jsx';
import { fmtFechaHora } from '@modules/productos/domain/format.js';
import { guardarTokenTerminal, leerTokenTerminal, olvidarTerminal } from '@core/auth/terminal.js';

export function EsteEquipoPanel({ onAviso }) {
  const [sucursales, setSucursales] = useState([]);
  const [lista, setLista] = useState(null);
  /** `null` = averiguando; `false` = este navegador no está registrado. */
  const [propia, setPropia] = useState(null);
  const [nombre, setNombre] = useState('');
  const [sucursalId, setSucursalId] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const avisar = useCallback((tipo, texto) => onAviso?.({ tipo, texto }), [onAviso]);

  /** Quién es ESTE navegador, según el token que tenga guardado. */
  const mirarPropia = useCallback(async () => {
    const token = leerTokenTerminal();
    if (!token) { setPropia(false); return; }
    try {
      const r = await httpClient.post('/terminales/actual', { token });
      setPropia(r?.terminal ?? false);
    } catch { setPropia(false); }
  }, []);

  const cargar = useCallback(async () => {
    try {
      const [sucs, terms] = await Promise.all([
        httpClient.get('/sucursales'),
        httpClient.get('/terminales'),
      ]);
      setSucursales(sucs);
      setLista(terms);
    } catch (e) {
      avisar('err', e?.data?.message || 'No se pudieron leer los equipos.');
      setLista([]);
    }
  }, [avisar]);

  useEffect(() => { mirarPropia(); cargar(); }, [mirarPropia, cargar]);

  const registrar = async () => {
    if (!nombre.trim()) { avisar('err', 'Ponele un nombre al equipo.'); return; }
    if (!sucursalId) { avisar('err', 'Elegí en qué sucursal está este equipo.'); return; }
    setOcupado(true);
    try {
      const r = await httpClient.post('/terminales', {
        nombre: nombre.trim(), sucursalId: Number(sucursalId),
      });
      /* El token se guarda EN ESTE navegador y no vuelve a viajar en claro
       * nunca más: del lado del servidor queda solo su hash. */
      guardarTokenTerminal(r.token);
      setNombre(''); setSucursalId('');
      await mirarPropia(); await cargar();
      avisar('ok', 'Equipo registrado. El próximo login de esta máquina ya no va a preguntar la sucursal.');
    } catch (e) {
      avisar('err', e?.data?.message || 'No se pudo registrar el equipo.');
    } finally { setOcupado(false); }
  };

  const desvincular = async () => {
    olvidarTerminal();
    await mirarPropia();
    avisar('ok', 'Este navegador quedó desvinculado. El registro sigue en la lista: si era el equipo equivocado, borralo también.');
  };

  const cambiar = async (t, patch, okMsg) => {
    setOcupado(true);
    try {
      await httpClient.patch(`/terminales/${t.id}`, patch);
      await cargar(); await mirarPropia();
      avisar('ok', okMsg);
    } catch (e) {
      avisar('err', e?.data?.message || 'No se pudo actualizar el equipo.');
    } finally { setOcupado(false); }
  };

  const borrar = async (t) => {
    setOcupado(true);
    try {
      await httpClient.delete(`/terminales/${t.id}`);
      /* Si el borrado era el de ESTE navegador, su token quedó muerto: se
       * limpia para que el login no siga preguntando por una terminal que ya
       * no existe. */
      if (propia && propia.id === t.id) olvidarTerminal();
      await cargar(); await mirarPropia();
      avisar('ok', `"${t.nombre}" ya no está registrado: ese equipo vuelve a preguntar la sucursal al entrar.`);
    } catch (e) {
      avisar('err', e?.data?.message || 'No se pudo borrar el equipo.');
    } finally { setOcupado(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Este equipo"
        desc="Registrá la máquina y el login deja de preguntar la sucursal: la pone el equipo."
      />

      {/* ---- Qué es ESTE navegador ---- */}
      {propia === null && <div className={cx(s.callout, s.info)}>Averiguando si este equipo está registrado…</div>}

      {propia === false && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3)' }}>
          <div className={cx(s.callout, s.warn)}>
            <strong>Este equipo todavía no está registrado.</strong> Mientras no lo esté, el que entre acá
            tiene que elegir la sucursal a mano — que es de donde salen las ventas cargadas en el local
            equivocado.
          </div>
          <div style={{ display: 'flex', gap: 'var(--crm-space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className={s.field} style={{ marginBottom: 0, minWidth: 220 }}>
              <label htmlFor="term-nombre">Cómo se llama este puesto</label>
              <input
                id="term-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)}
                placeholder="Caja 1" maxLength={60}
              />
            </div>
            <div className={s.field} style={{ marginBottom: 0, minWidth: 220 }}>
              <label htmlFor="term-sucursal">En qué sucursal está</label>
              <select id="term-sucursal" value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
                <option value="">Elegí…</option>
                {sucursales.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
              </select>
            </div>
            <Btn variant="btn-primary" disabled={ocupado} onClick={registrar}>Registrar este equipo</Btn>
          </div>
          <div className={s.hint}>
            Se registra <strong>una sola vez por máquina</strong>. Hay que hacerlo desde el propio equipo:
            la marca queda en este navegador.
          </div>
        </div>
      )}

      {propia && (
        <div className={cx(s.callout, s.ok)}>
          <strong>Este equipo es {propia.nombre} · {propia.sucursal.nombre}.</strong> El login de esta
          máquina ya no pregunta la sucursal.
          <div style={{ marginTop: 8 }}>
            <Btn small disabled={ocupado} onClick={desvincular}>Desvincular este navegador</Btn>
          </div>
        </div>
      )}

      {/* ---- Todos los equipos registrados ---- */}
      <div>
        <PanelHead
          title="Equipos registrados"
          desc="Todos los puestos del sistema. El que dejó de usarse hace mucho probablemente ya no exista."
        />
        <Table
          cols={['Equipo', 'Sucursal', 'Último uso', 'Estado', '']}
          empty="Todavía no hay ningún equipo registrado."
        >
          {(lista ?? []).map((t) => (
            <tr key={t.id}>
              <td>
                <strong>{t.nombre}</strong>
                {propia && propia.id === t.id && (
                  <span className={s.hint} style={{ marginLeft: 8 }}>— es este</span>
                )}
              </td>
              <td>
                <select
                  className={s['select-inline']} value={t.sucursalId} disabled={ocupado}
                  onChange={(e) => cambiar(
                    t,
                    { sucursalId: Number(e.target.value) },
                    `"${t.nombre}" pasó a ${sucursales.find((x) => x.id === Number(e.target.value))?.nombre ?? 'otra sucursal'}.`,
                  )}
                >
                  {sucursales.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                </select>
              </td>
              <td>{t.ultimoUso ? fmtFechaHora(t.ultimoUso) : <span className={s.hint}>nunca</span>}</td>
              <td>{t.activa ? 'Activo' : <span className={s.hint}>Dado de baja</span>}</td>
              <td style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <Btn
                  small disabled={ocupado}
                  onClick={() => cambiar(
                    t,
                    { activa: !t.activa },
                    t.activa
                      ? `"${t.nombre}" quedó dado de baja: ese equipo vuelve a preguntar la sucursal.`
                      : `"${t.nombre}" volvió a estar activo.`,
                  )}
                >
                  {t.activa ? 'Dar de baja' : 'Reactivar'}
                </Btn>
                <Btn small variant="btn-danger" disabled={ocupado} onClick={() => borrar(t)}>Borrar</Btn>
              </td>
            </tr>
          ))}
        </Table>
        <div className={s.hint}>
          <strong>Dar de baja</strong> deja el registro pero invalida el equipo (para una notebook que se
          extravió). <strong>Borrar</strong> lo elimina: en los dos casos esa máquina vuelve a preguntar la
          sucursal al entrar. Las ventas no se tocan — guardan la sucursal, no la terminal.
        </div>
      </div>
    </div>
  );
}
