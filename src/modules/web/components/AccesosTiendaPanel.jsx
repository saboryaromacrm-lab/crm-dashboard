/**
 * ACCESOS A LA TIENDA (0155, 10/10/2026) — quién puede comprar mayorista online.
 * ============================================================================
 * La tienda muestra precios solo a los habilitados. Acá llegan los pedidos de
 * ingreso (nombre o comercio, DNI, WhatsApp, localidad, CUIT opcional):
 *
 *   pendiente ── Habilitar y avisar ──► habilitado (entra con su DNI)
 *             └─ Rechazar ────────────► bloqueado (no entra ni puede volver a pedir)
 *   habilitado ── Deshabilitar ───────► bloqueado (se le cierra la sesión al instante)
 *
 * EL WHATSAPP SALE CON UN TOQUE (decisión del dueño): el mismo clic habilita y
 * abre WhatsApp con el mensaje escrito y el número puesto; se toca «Enviar».
 * La ventana se abre ANTES de esperar al servidor, porque abierta después del
 * `await` el navegador la toma como emergente y la bloquea. Rechazar y
 * deshabilitar piden un segundo clic.
 *
 * MINORISTAS (0178): los clientes de la tienda minorista, que entran con su
 * WhatsApp sin aprobación (`CompradoresMinoristas`).
 *
 * LAS DOS TIENDAS, BIEN SEPARADAS (19/10/2026, pedido del dueño): «Minoristas»
 * era una pestaña más al lado de Pendientes / Habilitados / Bloqueados, que son
 * los estados de la MAYORISTA, y se mezclaban. Ahora se elige primero la tienda
 * —verde la mayorista, naranja la minorista, los colores de la portada— y
 * adentro de la mayorista van sus tres estados.
 */
import { useRef, useState, useSyncExternalStore } from 'react';
import { accesosTienda } from '@core/services/accesosTienda.js';
import { httpClient } from '@core/services/httpClient.js';
import { useResource } from '@modules/ventas/hooks/useResource.js';
import { errorMsg } from '@modules/ventas/services/ventas.api.js';
import { telLegible, telefonoWa } from '@modules/ventas/domain/constants.js';
import { abrirWhatsApp } from '@shared/utils/whatsapp.js';
import { fmtFechaHora } from '@modules/productos/domain/format.js';
import { Table, PanelHead, Btn, s } from '@modules/productos/components/ui.jsx';
import { CompradoresMinoristas } from './CompradoresMinoristas.jsx';

/** Donde entra el cliente: va en el mensaje de «ya estás habilitado». */
const TIENDA = 'tiendaonline.saboryaroma.com';

const MENSAJES = {
  recibida: (nombre) => `¡Hola ${nombre}! Recibimos tu solicitud para comprar en la tienda mayorista de Sabor y Aroma. `
    + 'La estamos revisando y te avisamos por acá apenas estés habilitado.',
  habilitado: (nombre) => `¡Hola ${nombre}! Ya estás habilitado para comprar en la tienda mayorista de Sabor y Aroma 🎉 `
    + `Entrá a ${TIENDA}, tocá *Ingresar* y poné tu DNI. ¡Te esperamos!`,
};
const avisarPorWa = (a, tipo) => abrirWhatsApp(telefonoWa(a.whatsapp), MENSAJES[tipo](a.nombre));

const api = {
  listar: (estado) => httpClient.get(`/tienda-accesos?estado=${estado}`),
  habilitar: (id) => httpClient.post(`/tienda-accesos/${id}/habilitar`, {}),
  bloquear: (id) => httpClient.post(`/tienda-accesos/${id}/bloquear`, {}),
  avisoRecibida: (id) => httpClient.post(`/tienda-accesos/${id}/avisado-recibida`, {}),
};

/** Los estados de un pedido de ingreso a la MAYORISTA. */
const VISTAS = [
  { id: 'pendiente', label: 'Pendientes' },
  { id: 'habilitado', label: 'Habilitados' },
  { id: 'bloqueado', label: 'Bloqueados' },
];

/** Las dos tiendas, cada una con su color (tokens del tema: andan en claro y en oscuro). */
const TIENDAS = {
  mayorista: { titulo: 'Tienda mayorista', como: 'Entran con su DNI · los habilitás vos', color: 'var(--crm-color-primary)', suave: 'var(--crm-color-primary-soft)' },
  minorista: { titulo: 'Tienda minorista', como: 'Entran con su WhatsApp · sin aprobación', color: 'var(--crm-color-accent-2)', suave: 'var(--crm-color-accent-2-soft)' },
};

/** La tarjeta para elegir la tienda: elegida, con su color de fondo y de borde. */
function ElegirTienda({ id, elegida, extra, onElegir }) {
  const t = TIENDAS[id];
  return (
    <button
      type="button"
      aria-pressed={elegida}
      onClick={onElegir}
      style={{
        flex: '1 1 240px', textAlign: 'left', cursor: 'pointer', font: 'inherit',
        padding: '12px 16px', borderRadius: 12,
        border: `2px solid ${elegida ? t.color : 'var(--crm-color-border)'}`,
        background: elegida ? t.suave : 'var(--crm-color-surface)',
        color: 'var(--crm-color-text)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: t.color, flex: 'none' }} />
        <strong style={{ fontSize: 16, color: elegida ? t.color : 'var(--crm-color-text)' }}>{t.titulo}</strong>
        {extra}
      </div>
      <div className={s.hint} style={{ margin: '2px 0 0 18px' }}>{t.como}</div>
    </button>
  );
}


/** `avisar(tipo, texto)`: el aviso de la página de Tienda online ('ok' | 'err'). */
export function AccesosTiendaPanel({ avisar }) {
  const [tienda, setTienda] = useState('mayorista');
  const [vista, setVista] = useState('pendiente');
  const pendientes = useSyncExternalStore(accesosTienda.subscribe, accesosTienda.count, accesosTienda.count);
  const minoristas = tienda === 'minorista';
  const { data, loading, error, reload } = useResource(`accesos:${vista}`, () => api.listar(vista), { enabled: !minoristas });
  /* Rechazar / deshabilitar: el primer clic arma la confirmación de ESA fila, el segundo ejecuta. */
  const [armado, setArmado] = useState(null);
  const enVuelo = useRef(false);

  /**
   * Una acción del servidor, de a una. `tipoWa`: abre WhatsApp con ese mensaje
   * recién cuando el servidor la asentó (si falla, no se avisa nada).
   */
  const accion = async (fn, ok, a, tipoWa) => {
    if (enVuelo.current) return;
    enVuelo.current = true;
    try {
      await fn();
      if (tipoWa) avisarPorWa(a, tipoWa);
      avisar('ok', ok);
      setArmado(null);
      reload();
      accesosTienda.refrescar();
    } catch (e) {
      avisar('err', errorMsg(e));
    } finally {
      enVuelo.current = false;
    }
  };

  const habilitar = (a) => accion(() => api.habilitar(a.id), `${a.nombre} quedó habilitado: mandale el WhatsApp que se abrió.`, a, 'habilitado');
  const avisarRecibida = (a) => accion(() => api.avisoRecibida(a.id), 'Anotado: se abrió WhatsApp con el aviso.', a, 'recibida');
  const bloquear = (a) => {
    if (armado !== a.id) { setArmado(a.id); return; }
    accion(() => api.bloquear(a.id), `${a.nombre} quedó bloqueado: no puede entrar ni volver a pedir.`, a);
  };

  const filas = data ?? [];
  const sinWa = (a) => !telefonoWa(a.whatsapp);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Accesos a la tienda online"
        desc="Los precios de la tienda online los ven solo los que ingresaron. Elegí la tienda: cada una tiene sus clientes y su forma de entrar."
        actions={!minoristas && <Btn onClick={reload}>Actualizar</Btn>}
      />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <ElegirTienda
          id="mayorista"
          elegida={!minoristas}
          onElegir={() => { setTienda('mayorista'); setArmado(null); }}
          extra={pendientes > 0 && (
            <span className={s.pill} style={{ background: 'var(--crm-color-danger)', color: '#fff' }}>
              {pendientes} pendiente{pendientes === 1 ? '' : 's'}
            </span>
          )}
        />
        <ElegirTienda id="minorista" elegida={minoristas} onElegir={() => { setTienda('minorista'); setArmado(null); }} />
      </div>

      {minoristas ? <CompradoresMinoristas avisar={avisar} /> : (<>
        <div className={s.toolbar}>
          {VISTAS.map((v) => (
            <Btn key={v.id} small variant={vista === v.id ? 'btn-primary' : 'btn-ghost'} onClick={() => { setVista(v.id); setArmado(null); }}>
              {v.label}{v.id === 'pendiente' && pendientes > 0 ? ` (${pendientes})` : ''}
            </Btn>
          ))}
        </div>
        <div className={s.hint} style={{ margin: 0 }}>
          Llegan los pedidos de ingreso; al habilitar se abre WhatsApp con el aviso listo para enviar, y desde ahí entran con su DNI.
        </div>

        {error && <div className={s.hint} style={{ color: 'var(--crm-color-danger)' }}>{error}</div>}

        <Table
          cols={[
            { h: vista === 'pendiente' ? 'Pidió' : 'Resuelto' }, { h: 'Nombre o comercio' }, { h: 'DNI' }, { h: 'WhatsApp' },
            { h: 'Localidad' }, { h: 'En el ERP' }, { h: '', cls: 'actions-col' },
          ]}
          empty={loading ? 'Cargando…' : vista === 'pendiente' ? 'No hay pedidos de ingreso esperando.' : 'Nada por acá.'}
        >
          {filas.map((a) => (
            <tr key={a.id}>
              <td>
                {fmtFechaHora(vista === 'pendiente' ? a.creadoEn : (a.resueltoEn ?? a.creadoEn))}
                {vista !== 'pendiente' && a.resueltoPor && <div className={s.hint} style={{ margin: 0 }}>por {a.resueltoPor}</div>}
              </td>
              <td>
                <strong>{a.nombre}</strong>
                {a.cuit && <div className={s.hint} style={{ margin: 0 }}>CUIT <span className={s.mono}>{a.cuit}</span></div>}
              </td>
              <td className={s.mono}>{a.dni}</td>
              <td>
                <span className={s.mono}>{telLegible(a.whatsapp)}</span>
                {vista === 'pendiente' && (
                  <div className={s.hint} style={{ margin: 0 }}>
                    {a.avisadoRecibidaEn ? `«Recibimos» avisado ${fmtFechaHora(a.avisadoRecibidaEn)}` : 'Sin avisar que se recibió'}
                  </div>
                )}
                {vista === 'habilitado' && (
                  <div className={s.hint} style={{ margin: 0 }}>
                    {a.ultimoIngreso ? `Entró por última vez ${fmtFechaHora(a.ultimoIngreso)}` : 'Todavía no entró'}
                  </div>
                )}
              </td>
              <td>{a.localidad || '—'}</td>
              <td>
                {a.clienteId
                  ? <>{a.clienteNombre ?? `Cliente #${a.clienteId}`}{vista === 'pendiente' && <div className={s.hint} style={{ margin: 0 }}>Ya es cliente</div>}</>
                  : <span className={s.muted}>Nuevo: la ficha se crea al habilitar</span>}
              </td>
              <td className={s['actions-col']}>
                <div className={s['row-actions']}>
                  {vista === 'pendiente' && !a.avisadoRecibidaEn && (
                    <Btn small onClick={() => avisarRecibida(a)} disabled={sinWa(a)} title="Abre WhatsApp con «recibimos tu solicitud»">Avisar que la recibimos</Btn>
                  )}
                  {vista !== 'habilitado' && (
                    <Btn small variant="btn-primary" onClick={() => habilitar(a)} disabled={sinWa(a)}>
                      {vista === 'bloqueado' ? 'Desbloquear y habilitar' : 'Habilitar y avisar'}
                    </Btn>
                  )}
                  {vista === 'habilitado' && (
                    <Btn small onClick={() => avisarPorWa(a, 'habilitado')} disabled={sinWa(a)}>Reenviar WhatsApp</Btn>
                  )}
                  {vista !== 'bloqueado' && (
                    armado === a.id ? (
                      <>
                        <Btn small onClick={() => setArmado(null)}>No</Btn>
                        <Btn small variant="btn-delete" onClick={() => bloquear(a)}>
                          {vista === 'pendiente' ? 'Sí, rechazar y bloquear' : 'Sí, deshabilitar'}
                        </Btn>
                      </>
                    ) : (
                      <Btn small onClick={() => bloquear(a)}>{vista === 'pendiente' ? 'Rechazar' : 'Deshabilitar'}</Btn>
                    )
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>

        <div className={s.hint}>
          Rechazar o deshabilitar deja ese DNI <strong>bloqueado</strong>: no entra ni puede volver a pedir ingreso, y si estaba
          adentro se le cierra la sesión al instante. Desde «Bloqueados» se puede volver a habilitar.
        </div>
      </>)}
    </div>
  );
}
