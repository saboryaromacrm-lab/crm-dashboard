/**
 * EL AVISO DE FRACCIONADO (0170, pedido del dueño): la caja de la Distribuidora
 * pide «un paquete de avena de 400 g» y fraccionado lo ve acá, arriba de
 * cualquier pantalla del ERP, con sonido.
 *
 * · Solo quien fracciona, con sesión en la Distribuidora (el servidor contesta
 *   `aplica: false` en otra sucursal y se deja de preguntar), y no el superadmin.
 * · Suena al llegar un pedido y cada 30 s mientras haya alguno sin tomar.
 *   «Plegar» lo achica; un pedido nuevo lo vuelve a abrir.
 * · «Lo armo» (con el operador, que la PC recuerda) → «Listo» registra el
 *   fraccionado, con segunda confirmación porque mueve stock. «No se puede»
 *   pide el motivo, que el cajero lee.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@core/auth/AuthContext.jsx';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { tocarNotas } from '@core/services/sonido.js';
import { cx } from '@shared/utils/classNames.js';
import { errorMsg } from '@modules/ventas/services/ventas.api.js';
import { num } from '../domain/format.js';
import { operadorRecordado, recordarOperador } from '../domain/operadorRecordado.js';
import { CADA_MS, MOTIVOS_NO_SE_PUEDE, haceCuanto, textoRenglon } from '../domain/pedidosCaja.js';
import { pedidosCajaApi } from '../services/pedidosCaja.js';
import a from './AvisoPedidosCaja.module.css';

const REPETIR_MS = 30_000;
/** Sol5 → Si5 → Mi6, tres notas que suben: distinto de los otros avisos. */
const sonar = () => tocarNotas([[783.99, 0, 0.22], [987.77, 0.14, 0.22], [1318.51, 0.28, 0.4]], { onda: 'triangle', volumen: 0.22 });

export function AvisoPedidosCaja() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const activo = !!user && can('fraccionar') && !(user.roles ?? []).includes('superadmin');
  const [pedidos, setPedidos] = useState([]);
  const [ops, setOps] = useState([]);
  const [plegado, setPlegado] = useState(false);
  const [hecho, setHecho] = useState('');
  const anunciados = useRef(new Set());
  const ultimoSonido = useRef(0);
  const refrescar = useRef(() => {});

  const recibir = useCallback((lista) => {
    const pendientes = lista.filter((p) => p.estado === 'pendiente');
    const nuevo = pendientes.some((p) => !anunciados.current.has(p.id));
    pendientes.forEach((p) => anunciados.current.add(p.id));
    if (nuevo) {
      setPlegado(false);
      // Los operadores se releen con cada pedido nuevo: uno dado de alta en otra PC aparece solo.
      pedidosCajaApi.operadores().then((o) => setOps(o.filter((x) => x.activo && (x.sucursalId == null || x.sucursalId === user?.sucursalId)))).catch(() => {});
    }
    if (pendientes.length && (nuevo || Date.now() - ultimoSonido.current >= REPETIR_MS)) {
      ultimoSonido.current = Date.now();
      sonar();
    }
    setPedidos(lista);
  }, [user?.sucursalId]);

  useEffect(() => {
    if (!activo) return undefined;
    let vivo = true;
    let timer = null;
    const tick = async () => {
      try {
        const r = await pedidosCajaApi.abiertos();
        if (!vivo) return;
        if (!r.aplica) { clearInterval(timer); setPedidos([]); return; }
        recibir(r.pedidos);
      } catch { /* API caída: el próximo tick reintenta */ }
    };
    refrescar.current = tick;
    tick();
    timer = setInterval(tick, CADA_MS);
    return () => { vivo = false; clearInterval(timer); };
  }, [activo, recibir]);

  useEffect(() => {
    if (!hecho) return undefined;
    const t = setTimeout(() => setHecho(''), 6000);
    return () => clearTimeout(t);
  }, [hecho]);

  if (!activo || (!pedidos.length && !hecho)) return null;
  const sinTomar = pedidos.filter((p) => p.estado === 'pendiente').length;
  const terminado = (msg) => { setHecho(msg); refrescar.current(); };

  return (
    <section className={cx(a.aviso, sinTomar > 0 && a.urgente)} role="alert" aria-live="assertive">
      <div className={a.cabecera}>
        <span>🔔 {pedidos.length ? `Pedidos de la caja (${pedidos.length})` : 'Pedidos de la caja'}</span>
        {pedidos.length > 0 && (
          <button type="button" onClick={() => setPlegado((v) => !v)}>{plegado ? 'Ver' : 'Plegar'}</button>
        )}
      </div>
      {hecho && <div className={a.ok}>✓ {hecho}</div>}
      {!plegado && (
        <div className={a.lista}>
          {pedidos.map((p) => <Tarjeta key={p.id} p={p} ops={ops} onCambio={refrescar.current} onTerminado={terminado} />)}
        </div>
      )}
    </section>
  );
}

function Tarjeta({ p, ops, onCambio, onTerminado }) {
  const [operadorId, setOperadorId] = useState(null);
  const [modo, setModo] = useState(null); // null | 'listo' | 'rechazar'
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const candado = useRef(false);

  /* Se propone el operador que esta PC recuerda (o el único). */
  useEffect(() => {
    if (operadorId && ops.some((o) => o.id === operadorId)) return;
    const previo = operadorRecordado();
    setOperadorId((ops.find((o) => o.id === previo) ?? (ops.length === 1 ? ops[0] : null))?.id ?? null);
  }, [ops, operadorId]);

  const hacer = async (fn, alTerminar) => {
    if (candado.current) return;
    candado.current = true;
    setOcupado(true);
    setError('');
    try {
      await fn();
      if (alTerminar) alTerminar(); else onCambio();
    } catch (e) {
      setError(errorMsg(e));
      onCambio();   // p. ej. otro ya lo tomó: la tarjeta pasa a mostrarlo
    } finally {
      candado.current = false;
      setOcupado(false);
    }
  };

  const tomar = () => hacer(async () => {
    await pedidosCajaApi.tomar(p.id, operadorId ?? undefined);
    recordarOperador(operadorId);
  });
  const listo = () => hacer(() => pedidosCajaApi.listo(p.id), () => onTerminado(`${p.codigo} listo: el fraccionado quedó registrado.`));
  const rechazar = () => hacer(() => pedidosCajaApi.rechazar(p.id, motivo), () => onTerminado(`${p.codigo}: se le avisó a la caja que no se puede.`));

  const faltaOperador = ops.length > 0 && !operadorId;

  return (
    <article className={cx(a.tarjeta, p.estado === 'pendiente' && a.pendiente)}>
      <div className={a.quien}>
        <strong>{p.codigo}</strong> · pide <strong>{p.usuario || 'la caja'}</strong> · {haceCuanto(p.creadoEn)}
      </div>
      <ul className={a.renglones}>
        {p.items.map((it) => <li key={it.id}>{textoRenglon(it)}</li>)}
      </ul>
      {p.observaciones && <div className={a.nota}>«{p.observaciones}»</div>}
      {p.estado === 'armando' && (
        <div className={a.estado}>En preparación{p.operador ? `: ${p.operador}` : ''} · tomado {haceCuanto(p.tomadoEn)}</div>
      )}

      {modo === null && (
        <div className={a.acciones}>
          {p.estado === 'pendiente' ? (
            <>
              {ops.length > 0 && (
                <select value={operadorId ?? ''} onChange={(e) => setOperadorId(Number(e.target.value) || null)} aria-label="¿Quién lo arma?">
                  <option value="">¿Quién lo arma?</option>
                  {ops.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                </select>
              )}
              <button type="button" className={cx(a.boton, a.principal)} disabled={ocupado || faltaOperador} onClick={tomar}>
                Lo armo
              </button>
            </>
          ) : (
            <button type="button" className={cx(a.boton, a.principal)} disabled={ocupado} onClick={() => setModo('listo')}>
              Listo
            </button>
          )}
          <button type="button" className={cx(a.boton, a.peligro)} disabled={ocupado} onClick={() => setModo('rechazar')}>
            No se puede
          </button>
        </div>
      )}

      {modo === 'listo' && (
        <div className={a.acciones}>
          <span>¿Está armado? Se registra el fraccionado: baja {num(p.kg, 3)} kg de granel.</span>
          <button type="button" className={cx(a.boton, a.principal)} disabled={ocupado} onClick={listo}>
            {ocupado ? 'Registrando…' : 'Sí, está listo'}
          </button>
          <button type="button" className={a.boton} disabled={ocupado} onClick={() => setModo(null)}>Volver</button>
        </div>
      )}

      {modo === 'rechazar' && (
        <>
          <div className={a.acciones}>
            {MOTIVOS_NO_SE_PUEDE.map((m) => (
              <button key={m} type="button" className={cx(a.motivo, motivo === m && a.motivoActivo)} onClick={() => setMotivo(m)}>{m}</button>
            ))}
            <input
              value={MOTIVOS_NO_SE_PUEDE.includes(motivo) ? '' : motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Otro motivo…" maxLength={120} aria-label="Otro motivo"
            />
          </div>
          <div className={a.acciones}>
            <button type="button" className={cx(a.boton, a.peligro)} disabled={ocupado || !motivo.trim()} onClick={rechazar}>
              Avisar a la caja que no se puede
            </button>
            <button type="button" className={a.boton} disabled={ocupado} onClick={() => { setModo(null); setMotivo(''); }}>Volver</button>
          </div>
        </>
      )}
      {error && <div className={a.error}>{error}</div>}
    </article>
  );
}
