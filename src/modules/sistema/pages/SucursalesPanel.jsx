/**
 * SISTEMA › SUCURSALES (9/11/2026, 0225; antes una pestaña de Gerencia ›
 * Usuarios y roles). Los locales: punto de venta y domicilio del comprobante,
 * factura electrónica, venta mayorista, fondo y días de cierre de caja, y
 * desactivar el que cerró. Llave `sistema.sucursales`; leer las sucursales es
 * de cualquier sesión, cambiarlas pide la llave (la API también).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { cx } from '@shared/utils/classNames.js';
import { Table, PanelHead, Btn, s } from '@modules/productos/components/ui.jsx';
import { DIAS_CIERRE, textoDiasCierre } from '@shared/utils/plazoCaja.js';
import { mutarConAviso } from './mutarConAviso.js';

/**
 * FACTURA ELECTRÓNICA DE UNA SUCURSAL (0124, 30/9/2026). Se enciende de a
 * una: la que está apagada emite comprobantes internos, sin CAE, y nunca usa
 * el punto de venta de otro local.
 *
 * Encender es plata y papeles fiscales reales, así que pide una SEGUNDA
 * confirmación en la misma fila, con el punto de venta y el domicilio a la
 * vista, y lleva candado contra el doble clic. Apagar también se confirma.
 */
function FacturaElectronica({ su, pendiente, onCambiar }) {
  const [preguntando, setPreguntando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const enVuelo = useRef(false);
  const prendida = !!su.facturaElectronica;
  const sinPv = !String(su.puntoVenta ?? '').trim();
  const sinDir = !String(su.direccion ?? '').trim();

  const confirmar = async () => {
    if (enVuelo.current) return;
    enVuelo.current = true; setOcupado(true);
    try {
      await onCambiar(!prendida);
    } finally {
      enVuelo.current = false; setOcupado(false); setPreguntando(false);
    }
  };

  if (preguntando) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 260 }}>
        <span style={{ fontSize: 12.5 }}>
          {prendida
            ? <>¿Apagar la factura electrónica de <strong>{su.nombre}</strong>? Va a emitir comprobantes internos, sin CAE.</>
            : <>¿Encender la factura electrónica de <strong>{su.nombre}</strong>? Sus facturas salen con CAE real por el punto de venta <strong>{su.puntoVenta}</strong> ({su.direccion}).</>}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <Btn small variant={prendida ? 'btn-danger' : 'btn-primary'} disabled={ocupado} onClick={confirmar}>
            {ocupado ? 'Guardando…' : prendida ? 'Sí, apagar' : 'Sí, encender'}
          </Btn>
          <Btn small disabled={ocupado} onClick={() => setPreguntando(false)}>No</Btn>
        </div>
      </div>
    );
  }

  const bloqueo = pendiente ? 'Guardá primero los cambios de la fila.'
    : !prendida && sinPv ? 'Falta el punto de venta de ARCA de este local.'
      : !prendida && sinDir ? 'Falta el domicilio declarado para ese punto de venta.' : '';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: bloqueo ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }} title={bloqueo || undefined}>
        <input type="checkbox" checked={prendida} disabled={!!bloqueo || ocupado} onChange={() => setPreguntando(true)} />
        <strong style={{ color: prendida ? 'var(--crm-color-success)' : 'var(--crm-color-text-secondary)' }}>
          {prendida ? 'Factura con ARCA' : 'Solo comprobante interno'}
        </strong>
      </label>
      {bloqueo && <span className={s.hint} style={{ margin: 0 }}>{bloqueo}</span>}
    </div>
  );
}

/**
 * LOS DÍAS DE CIERRE DE CAJA (0214): un botón por día, se guarda al tocarlo y
 * rige desde la próxima apertura. Siempre queda al menos uno: el último
 * encendido no se puede apagar.
 */
function DiasCierre({ su, disabled, onCambiar }) {
  const dias = su.diasCierre?.length ? su.diasCierre : DIAS_CIERRE.map(([d]) => d);
  const tocar = (d) => onCambiar(dias.includes(d) ? dias.filter((x) => x !== d) : [...dias, d].sort((a, b) => a - b));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div role="group" aria-label={`Días de cierre de caja de ${su.nombre}`} style={{ display: 'flex', gap: 3 }}>
        {DIAS_CIERRE.map(([d, letra, nombre]) => {
          const on = dias.includes(d);
          return (
            <button
              key={d} type="button" aria-pressed={on} title={nombre}
              disabled={disabled || (on && dias.length === 1)}
              onClick={() => tocar(d)}
              style={{
                width: 26, height: 26, padding: 0, borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: '1px solid var(--crm-color-border)',
                background: on ? 'var(--crm-color-primary)' : 'transparent',
                color: on ? 'var(--crm-color-primary-contrast)' : 'var(--crm-color-text-secondary)',
              }}
            >{letra}</button>
          );
        })}
      </div>
      <span className={s.hint} style={{ margin: 0, whiteSpace: 'nowrap' }}>{textoDiasCierre(dias)}</span>
    </div>
  );
}

/**
 * VENDE MAYORISTA (0150, 8/10/2026, pedido del dueño): no todas las sucursales
 * trabajan la venta mayorista. Apagado, esa caja cobra todo a precio minorista
 * (sin aviso, sin bulto, sin lista mayorista del cliente) y el servidor lo
 * exige. Cambia lo que se le cobra al cliente, así que se confirma en la fila.
 * La Distribuidora no se apaga: surte la tienda online, que es mayorista.
 */
function VendeMayorista({ su, onCambiar }) {
  const [preguntando, setPreguntando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const enVuelo = useRef(false);
  const vende = su.vendeMayorista !== false;
  const fija = su.tipo === 'distribuidora';

  const confirmar = async () => {
    if (enVuelo.current) return;
    enVuelo.current = true; setOcupado(true);
    try {
      await onCambiar(!vende);
    } finally {
      enVuelo.current = false; setOcupado(false); setPreguntando(false);
    }
  };

  if (preguntando) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 240 }}>
        <span style={{ fontSize: 12.5 }}>
          {vende
            ? <>¿<strong>{su.nombre}</strong> deja de vender mayorista? Su caja va a cobrar todo a precio minorista.</>
            : <>¿<strong>{su.nombre}</strong> vende mayorista? Su caja vuelve a ofrecer el precio mayorista cuando se cumple.</>}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <Btn small variant={vende ? 'btn-danger' : 'btn-primary'} disabled={ocupado} onClick={confirmar}>
            {ocupado ? 'Guardando…' : vende ? 'Sí, solo minorista' : 'Sí, vende mayorista'}
          </Btn>
          <Btn small disabled={ocupado} onClick={() => setPreguntando(false)}>No</Btn>
        </div>
      </div>
    );
  }

  const bloqueo = fija ? 'La Distribuidora vende mayorista: surte la tienda online.' : su.activa === false ? 'Sucursal desactivada.' : '';
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: bloqueo ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }} title={bloqueo || undefined}>
      <input type="checkbox" checked={vende} disabled={!!bloqueo || ocupado} onChange={() => setPreguntando(true)} />
      <strong style={{ color: vende ? 'var(--crm-color-success)' : 'var(--crm-color-text-secondary)' }}>
        {vende ? 'Vende mayorista' : 'Solo minorista'}
      </strong>
    </label>
  );
}

export function SucursalesPanel({ onAviso }) {
  const [sucursales, setSucursales] = useState([]);
  /** Ediciones sin guardar de la tabla: { [id]: {puntoVenta, direccion, fondoCaja} }. */
  const [edits, setEdits] = useState({});
  /** La sucursal que se está por desactivar: la segunda confirmación (0143). */
  const [aDesactivar, setADesactivar] = useState(null);
  const enVuelo = useRef(false);

  const cargar = useCallback(async () => {
    try {
      // Todas, también las desactivadas (0143): acá es donde se reactivan.
      setSucursales(await httpClient.get('/sucursales?todas=1'));
      setEdits({});
    } catch (e) {
      onAviso({ tipo: 'err', texto: e?.data?.message || 'No se pudo conectar con la API.' });
    }
  }, [onAviso]);
  useEffect(() => { cargar(); }, [cargar]);
  const mutar = useCallback((fn, okMsg) => mutarConAviso(fn, okMsg, { onAviso, cargar }), [onAviso, cargar]);

  const cambiarEstadoSucursal = async (su, activar) => {
    if (enVuelo.current) return;
    enVuelo.current = true;
    try {
      const r = await httpClient.post(`/sucursales/${su.id}/${activar ? 'reactivar' : 'desactivar'}`);
      const extra = activar ? '' : [
        r.equipos ? `${r.equipos} equipo${r.equipos === 1 ? '' : 's'} registrado${r.equipos === 1 ? '' : 's'} ahí quedaron dados de baja` : '',
        r.sesiones ? `se cerraron ${r.sesiones} sesión${r.sesiones === 1 ? '' : 'es'} abiertas en ese local` : '',
        r.usuariosSinLocal?.length ? `OJO: ${r.usuariosSinLocal.join(', ')} trabajaba${r.usuariosSinLocal.length === 1 ? '' : 'n'} solo ahí — asignale${r.usuariosSinLocal.length === 1 ? '' : 's'} otra sucursal en Sistema › Usuarios y roles` : '',
        r.gastosFijos?.length ? `OJO: tiene gastos fijos activos (${r.gastosFijos.join(', ')}) que se siguen generando — dalos de baja en Gastos si ya no corren` : '',
      ].filter(Boolean).join('; ');
      onAviso({
        tipo: r.usuariosSinLocal?.length || r.gastosFijos?.length ? 'err' : 'ok',
        texto: activar ? `${su.nombre} reactivada: vuelve a aparecer en todo el sistema.` : `${su.nombre} desactivada: ya no aparece para elegir en ninguna parte; su historial queda.${extra ? ` ${extra}.` : ''}`,
      });
      setADesactivar(null);
      await cargar();
    } catch (e) {
      onAviso({ tipo: 'err', texto: e?.data?.message || 'No se pudo cambiar el estado de la sucursal.' });
    } finally {
      enVuelo.current = false;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Sucursales"
        desc="Los locales: punto de venta de ARCA, factura electrónica, venta mayorista, fondo y días de cierre de caja. Las sucursales no se crean desde acá: son estructura de la empresa y se editan las que hay."
      />
      <div className={cx(s.callout, s.info)}>
        Cada local factura con <strong>su propio punto de venta de ARCA</strong>, declarado contra su
        domicilio y con su numeración correlativa aparte. El <strong>domicilio</strong> de acá
        es el que sale impreso en la factura de ese local — no el de la empresa. La
        columna <strong>Factura electrónica</strong> enciende la facturación de a una sucursal: la que
        no la tiene prendida emite solo comprobantes internos, sin CAE, y nunca factura con el punto de
        venta de otro local.
      </div>
      {aDesactivar && (
        <div className={cx(s.callout, s.warn)} style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <strong>¿Desactivar {aDesactivar.nombre}?</strong> Es para un local que <strong>cerró</strong>:
            deja de aparecer para elegir en <strong>todo</strong> el sistema (el ingreso, el selector de arriba,
            Almacén, Compras, Ventas, Gastos, Métricas, Cash Flow) y nadie puede entrar ni operar ahí. Los equipos
            registrados en ese local quedan dados de baja y se cierran las sesiones abiertas ahí.
            <strong> Su historial no se borra</strong>: ventas, cajas y facturas viejas lo siguen nombrando.
            Se puede reactivar cuando quieras.
          </div>
          <div className={s.hint} style={{ margin: 0 }}>
            Antes tiene que estar vacío y sin nada pendiente: stock en cero, caja cerrada, sin pases ni envíos de Coffit
            en curso, sin tickets, presupuestos ni controles de stock abiertos, sin vencimientos por procesar, sin ventas
            esperando CAE y sin incidencias. Si falta algo, el sistema te dice todo lo que falta.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="btn-delete" onClick={() => cambiarEstadoSucursal(aDesactivar, false)}>Sí, desactivar {aDesactivar.nombre}</Btn>
            <Btn onClick={() => setADesactivar(null)}>Cancelar</Btn>
          </div>
        </div>
      )}
      <Table
        cols={[
          { h: 'Sucursal' }, { h: 'Tipo' }, { h: 'Punto de venta' },
          { h: 'Domicilio del comprobante' }, { h: 'Factura electrónica' }, { h: 'Mayorista' }, { h: 'Fondo de caja', num: true }, { h: 'Días de cierre de caja' }, { h: 'Estado' }, { h: 'Acciones', cls: 'actions-col' },
        ]}
        empty="Sin sucursales."
      >
        {sucursales.map((su) => {
          const ed = edits[su.id] ?? {};
          const pv = ed.puntoVenta ?? su.puntoVenta ?? '';
          const dir = ed.direccion ?? su.direccion ?? '';
          /* El FONDO FIJO de caja (0111): con cuánto abre la caja y cuánto
           * queda apartado al cerrar. Vacío = se fija en la primera apertura. */
          const fondo = ed.fondoCaja ?? (su.fondoCaja != null ? String(su.fondoCaja) : '');
          const fondoCambio = fondo !== (su.fondoCaja != null ? String(su.fondoCaja) : '');
          const sucio = pv !== (su.puntoVenta ?? '') || dir !== (su.direccion ?? '') || fondoCambio;
          const set = (campo) => (e) => setEdits((p) => ({
            ...p, [su.id]: { ...(p[su.id] ?? {}), [campo]: e.target.value },
          }));
          const apagada = su.activa === false;
          return (
            <tr key={su.id} style={apagada ? { opacity: 0.55 } : undefined}>
              <td><strong>{su.nombre}</strong></td>
              <td className={s.muted}>{su.tipo === 'distribuidora' ? 'Distribuidora' : 'Express'}</td>
              <td>
                <input
                  value={pv}
                  onChange={set('puntoVenta')}
                  maxLength={5}
                  disabled={apagada}
                  placeholder="00028"
                  style={{ width: 90, fontFamily: 'var(--crm-font-mono, monospace)' }}
                />
              </td>
              <td>
                <input
                  value={dir}
                  onChange={set('direccion')}
                  maxLength={200}
                  disabled={apagada}
                  placeholder="Calle 123, Formosa"
                  style={{ width: '100%', minWidth: 220 }}
                />
              </td>
              <td>
                <FacturaElectronica
                  su={su}
                  pendiente={sucio}
                  onCambiar={(prender) => mutar(
                    /* Con los datos GUARDADOS (no lo que se esté tipeando en la fila):
                     * encender la factura no guarda de rebote un punto de venta a medio escribir. */
                    () => httpClient.patch(`/sucursales/${su.id}`, {
                      nombre: su.nombre, tipo: su.tipo, puntoVenta: su.puntoVenta ?? '', direccion: su.direccion ?? '',
                      facturaElectronica: prender,
                    }),
                    prender
                      ? `${su.nombre}: factura electrónica ENCENDIDA con el punto de venta ${su.puntoVenta}.`
                      : `${su.nombre}: factura electrónica apagada. Desde ahora emite comprobantes internos.`,
                  )}
                />
              </td>
              <td>
                <VendeMayorista
                  su={su}
                  onCambiar={(vende) => mutar(
                    () => httpClient.patch(`/sucursales/${su.id}`, { nombre: su.nombre, tipo: su.tipo, vendeMayorista: vende }),
                    vende
                      ? `${su.nombre}: vende mayorista. Su caja ofrece el precio mayorista cuando se cumple.`
                      : `${su.nombre}: solo minorista. Su caja cobra todo a precio minorista.`,
                  )}
                />
              </td>
              <td className={s.num}>
                <input
                  type="number" min="0" step="1000"
                  value={fondo}
                  onChange={set('fondoCaja')}
                  disabled={apagada}
                  placeholder="50000"
                  title="Con cuánto abre la caja y cuánto queda apartado al cerrar"
                  style={{ width: 110, textAlign: 'right' }}
                />
              </td>
              <td>
                <DiasCierre
                  su={su}
                  disabled={apagada}
                  onCambiar={(dias) => mutar(
                    () => httpClient.patch(`/sucursales/${su.id}`, { nombre: su.nombre, tipo: su.tipo, diasCierre: dias }),
                    `${su.nombre}: la caja se cierra ${textoDiasCierre(dias).toLowerCase()}. Rige desde la próxima apertura.`,
                  )}
                />
              </td>
              <td>
                <span className={cx(s.pill, apagada ? s['est-cancelada'] : s['st-disponible'])}>{apagada ? 'Desactivada' : 'Activa'}</span>
                {apagada && su.desactivadaEn && <div className={s.hint} style={{ margin: '2px 0 0' }}>desde el {new Date(su.desactivadaEn).toLocaleDateString('es-AR')}</div>}
              </td>
              <td className={s['actions-col']}>
                <div className={s['row-actions']}>
                <Btn
                  variant="btn-primary"
                  small
                  disabled={apagada || !sucio || (fondoCambio && fondo !== '' && !(Number(fondo) >= 0))}
                  onClick={() => mutar(
                    /* Se manda el nombre y el tipo porque el DTO los exige:
                     * esta pantalla edita dos campos, no la sucursal entera. */
                    () => httpClient.patch(`/sucursales/${su.id}`, {
                      nombre: su.nombre, tipo: su.tipo, puntoVenta: pv, direccion: dir,
                      ...(fondoCambio && fondo !== '' ? { fondoCaja: Number(fondo) } : {}),
                    }),
                    `${su.nombre}: datos guardados.`,
                  )}
                >
                  Guardar
                </Btn>
                {apagada
                  ? <Btn small variant="btn-ingreso" onClick={() => cambiarEstadoSucursal(su, true)}>Reactivar</Btn>
                  : su.tipo !== 'distribuidora' && <Btn small variant="btn-delete" onClick={() => setADesactivar(su)}>Desactivar</Btn>}
                </div>
              </td>
            </tr>
          );
        })}
      </Table>
      <div className={s.hint}>
        <strong>Mayorista</strong>: la sucursal en «Solo minorista» cobra todo a precio minorista — su caja no
        ofrece el aviso mayorista, el bulto ni la lista mayorista de un cliente, y el sistema no deja cobrar ahí
        un renglón mayorista. La Distribuidora vende mayorista siempre: surte la tienda online.
      </div>
      <div className={s.hint}>
        <strong>Días de cierre de caja</strong>: los días en que el local cuenta la caja y arma el sobre, al terminar
        el día. Con los siete encendidos cierra todos los días, como siempre. Ejemplo: si pasás a buscar la plata el
        martes y el jueves, encendé <strong>lunes y miércoles</strong>: el sobre trae lo de los días anteriores, y lo
        que se vende el día que pasás va en la caja siguiente. Cada caja queda abierta hasta el <strong>próximo día de
        cierre</strong>; si no se cierra ese día, al día siguiente <strong>no deja vender ni cobrar</strong> hasta que la
        cierren (alcanza con cerrarla a primera hora, antes de vender). El cambio rige desde la próxima apertura: una
        caja ya abierta mantiene su día.
      </div>
      <div className={s.hint}>
        El <strong>fondo de caja</strong> es con cuánto abre la caja de cada local y cuánto queda
        apartado al cerrar para el turno siguiente; si está vacío, lo fija la primera apertura.
        Para encender la <strong>factura electrónica</strong> de un local: dá de alta su punto de venta
        (tipo Web Services) en ARCA, cargalo acá con el domicilio, guardá, y probalo en{' '}
        <strong>Ventas › Configuración › Facturación › Probar conexión</strong> (tiene que figurar autorizado).
        Recién ahí tildá la casilla. Dos locales no pueden compartir el punto de venta.
      </div>
    </div>
  );
}
