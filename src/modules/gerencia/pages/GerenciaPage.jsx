/**
 * GERENCIA — Usuarios y roles
 * ============================================================================
 * La administración del superadmin: acá se crean los usuarios con su
 * contraseña y se definen los ROLES con sus permisos (checkboxes sobre el
 * catálogo que sirve la API — agregar un permiso nuevo al catálogo lo hace
 * aparecer acá solo, sin tocar esta pantalla).
 *
 * Reglas espejadas del backend (la API las valida igual):
 *   - superadmin: no se edita ni se borra; siempre queda uno activo.
 *   - roles de sistema: editables, no borrables.
 *   - usuarios: se desactivan, nunca se borran (viven en los historiales).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { useAuth } from '@core/auth/AuthContext.jsx';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { cx } from '@shared/utils/classNames.js';
import { ModalShell } from '@modules/productos/components/Modal.jsx';
import { Table, PanelHead, Btn, usePaginado, s } from '@modules/productos/components/ui.jsx';
import { GERENCIA_SECCIONES } from '../config/gerencia.config.js';
import { RentabilidadPanel } from '../panels/RentabilidadPanel.jsx';
import { MetricasPanel } from '../panels/metricas/MetricasPanel.jsx';
import { CashFlowPanel } from '../panels/cashflow/CashFlowPanel.jsx';
import { AuditoriaPanel } from '../panels/AuditoriaPanel.jsx';

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

/* ---------------- Modal de usuario (alta / edición) ---------------- */

/** Lo que dice la tabla y la ventana sobre el descuento a mano (0147). */
const sinTope = (permisos = []) => permisos.includes('*') || permisos.includes('precio_manual');
const textoDescuento = (u) => (sinTope(u.permisos) ? 'Sin tope (su rol pisa precios)' : u.descuentoManualMax > 0 ? `Hasta ${u.descuentoManualMax} %` : 'No');

function UsuarioModal({ usuario, roles, sucursales = [], onGuardar, onCerrar }) {
  const esAlta = !usuario;
  /*
   * DESCUENTO A MANO (0147): por usuario, y por defecto NO. Solo el dueño lo
   * cambia (llave fuera del catálogo). Lo automático —ofertas, mayorista
   * ganado, descuento del cliente, descuentos con nombre— no depende de esto.
   */
  const { can } = usePermissions();
  const puedeFijarDescuento = can('usuarios.descuento_manual');
  const [descManual, setDescManual] = useState((usuario?.descuentoManualMax ?? 0) > 0);
  const [descTope, setDescTope] = useState(String(usuario?.descuentoManualMax || ''));
  const [nombre, setNombre] = useState(usuario?.nombre ?? '');
  const [rolId, setRolId] = useState(usuario?.rolId ?? roles.find((r) => r.clave === 'cajero')?.id ?? roles[0]?.id);
  const [activo, setActivo] = useState(usuario?.activo ?? true);
  const [password, setPassword] = useState('');
  /* El relevo de caja (0088): la marca + su PIN. El PIN nunca vuelve del
   * servidor — el campo siempre arranca vacío y vacío = no cambiarlo. */
  const [relevoCaja, setRelevoCaja] = useState(usuario?.relevoCaja ?? false);
  const [pin, setPin] = useState('');
  /* EN QUÉ SUCURSALES ENTRA (0105). Ninguna tildada = todas, lo de siempre. */
  const [sucs, setSucs] = useState(() => new Set(usuario?.sucursales ?? []));
  const rolElegido = roles.find((r) => r.id === Number(rolId));
  const cruza = rolElegido?.clave === 'admin' || rolElegido?.clave === 'superadmin' || (rolElegido?.permisos ?? []).includes('*');
  const tildar = (id) => setSucs((prev) => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    const tope = descManual ? Number(descTope) || 0 : 0;
    const ok = await onGuardar({
      nombre, rolId: Number(rolId), activo,
      relevoCaja,
      ...(puedeFijarDescuento ? { descuentoManualMax: tope } : {}),
      sucursales: [...sucs],
      ...(password ? { password } : {}),
      ...(pin ? { pin } : {}),
    });
    setGuardando(false);
    if (ok) onCerrar();
  };

  return (
    <ModalShell
      title={esAlta ? 'Nuevo usuario' : `Editar a ${usuario.nombre}`}
      onClose={onCerrar}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: onCerrar },
        { texto: guardando ? 'Guardando…' : 'Guardar', clase: 'btn-primary', onClick: guardar },
      ]}
    >
      <div className={s.field}>
        <label>Nombre <span className={s.req}>*</span></label>
        <input autoFocus value={nombre} placeholder="Nombre y apellido" onChange={(e) => setNombre(e.target.value)} />
      </div>
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Rol <span className={s.req}>*</span></label>
          <select value={rolId} onChange={(e) => setRolId(e.target.value)}>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
        </div>
        <div className={s.field}>
          <label>Contraseña {esAlta ? <span className={s.req}>*</span> : ''}</label>
          <input
            type="password"
            value={password}
            placeholder={esAlta ? 'Mínimo 4 — puede ser un PIN' : 'Dejar vacío para no cambiarla'}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      </div>
      {!esAlta && (
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
          Usuario activo (desactivado no puede operar)
        </label>
      )}

      {/* EN QUÉ SUCURSALES PUEDE ENTRAR (0105): al entrar solo se le ofrecen esas
          y el servidor rechaza las demás. La administración cruza igual. */}
      <div className={s.field} style={{ marginTop: 12 }}>
        <label>Sucursales donde trabaja</label>
        {cruza ? (
          <div className={s.hint} style={{ margin: 0 }}>
            La administración entra a todas y cambia de sucursal desde el encabezado.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
              {sucursales.map((su) => (
                <label key={su.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', fontWeight: 400 }}>
                  <input type="checkbox" checked={sucs.has(su.id)} onChange={() => tildar(su.id)} />
                  {su.nombre}
                </label>
              ))}
            </div>
            <div className={s.hint} style={{ margin: '4px 0 0' }}>
              {sucs.size
                ? 'Al entrar solo puede elegir estas. Si ya tiene una sesión abierta, se cierra al guardar.'
                : 'Ninguna tildada: puede entrar en cualquier sucursal.'}
            </div>
          </>
        )}
      </div>

      {/* EL RELEVO DE CAJA (0088): "la cajera se ausenta, cobra el repositor".
          El relevo toma la registradora de una sesión ajena con su PIN y firma
          lo que hace — sin cambiar de usuario ni ganar permisos. */}
      <div className={s.field} style={{ marginTop: 12 }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={relevoCaja} onChange={(e) => setRelevoCaja(e.target.checked)} />
          Puede relevar en caja
        </label>
        <div className={s.hint} style={{ margin: '4px 0 0' }}>
          Aparece en el POS para tomar la caja de otra sesión con su PIN: las ventas y los
          movimientos quedan firmados con su nombre. No cambia sus permisos.
        </div>
      </div>
      <div className={s.field} style={{ marginTop: 12 }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: puedeFijarDescuento ? 'pointer' : 'default' }}>
          <input type="checkbox" checked={descManual} disabled={!puedeFijarDescuento} onChange={(e) => setDescManual(e.target.checked)} />
          Puede poner descuentos a mano
        </label>
        {descManual && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 13 }}>Hasta</span>
            <input type="number" min="0.5" max="100" step="0.5" value={descTope} disabled={!puedeFijarDescuento}
              onChange={(e) => setDescTope(e.target.value)} aria-label="Tope del descuento a mano (%)" style={{ width: 90 }} />
            <span style={{ fontSize: 13 }}>%</span>
          </div>
        )}
        <div className={s.hint} style={{ margin: '4px 0 0' }}>
          {sinTope(rolElegido?.permisos)
            ? 'Su rol puede pisar precios: no tiene tope.'
            : 'Las ofertas, el mayorista ganado, el descuento del cliente y los descuentos con nombre se aplican igual. Esto es solo para el descuento que se escribe a mano en el POS.'}
          {!puedeFijarDescuento && ' Lo cambia el dueño.'}
        </div>
      </div>
      {relevoCaja && (
        <div className={s.field}>
          <label>PIN del relevo {usuario?.tienePin ? '' : <span className={s.req}>*</span>}</label>
          <input
            type="password" inputMode="numeric" maxLength={6}
            value={pin}
            placeholder={usuario?.tienePin ? 'Ya tiene PIN — dejar vacío para no cambiarlo' : '4 a 6 dígitos'}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          />
        </div>
      )}
    </ModalShell>
  );
}

/* ---------------- Modal de rol (alta / permisos) ---------------- */

/**
 * Master checkbox de un grupo: marca/desmarca todas sus claves de una, y en
 * el medio (algunas sí, otras no) se muestra indeterminado.
 */
function CheckTodo({ claves, permisos, onSet, label }) {
  const marcadas = claves.filter((c) => permisos.has(c)).length;
  const todas = claves.length > 0 && marcadas === claves.length;
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={todas}
        ref={(el) => { if (el) el.indeterminate = marcadas > 0 && !todas; }}
        onChange={() => onSet(claves, !todas)}
      />
      {label}
    </label>
  );
}

function ListaPermisos({ titulo, items, permisos, toggle }) {
  if (!items.length) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--crm-color-text-muted)', marginBottom: 4 }}>
        {titulo}
      </div>
      {items.map((p) => (
        /*
         * Los de FÁBRICA (`p.base`, ver `permisos-base.ts` en la API) van
         * tildados y bloqueados: los tiene todo rol, con o sin esta pantalla.
         * Mostrarlos como una casilla vacía haría pensar que están apagados, y
         * tildarlos "para arreglarlo" solo guardaría en la base algo que ya rige.
         */
        <label
          key={p.clave}
          title={p.base ? 'Viene activado de fábrica en todas las sucursales: no se puede apagar desde acá.' : undefined}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '3px 0',
            cursor: p.base ? 'default' : 'pointer', opacity: p.base ? 0.8 : 1,
          }}
        >
          <input
            type="checkbox"
            checked={p.base || permisos.has(p.clave)}
            disabled={p.base}
            onChange={() => !p.base && toggle(p.clave)}
          />
          {p.nombre}
          {p.base && (
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--crm-color-text-muted)', border: '1px solid var(--crm-color-border)', borderRadius: 4, padding: '0 4px' }}>
              siempre
            </span>
          )}
        </label>
      ))}
    </div>
  );
}

/**
 * Editor FINO de permisos: una tarjeta por módulo, adentro sus SECCIONES (qué
 * pantallas ve — sin ninguna, el módulo desaparece entero para ese rol) y sus
 * ACCIONES (qué operaciones puede hacer dentro de lo que ve). El checkbox del
 * título marca/desmarca el módulo completo.
 */
function RolModal({ rol, catalogo, onGuardar, onCerrar }) {
  const esAlta = !rol;
  const [nombre, setNombre] = useState(rol?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(rol?.descripcion ?? '');
  const [permisos, setPermisos] = useState(() => new Set(rol?.permisos ?? []));
  const [guardando, setGuardando] = useState(false);

  const toggle = (clave) => setPermisos((prev) => {
    const n = new Set(prev);
    if (n.has(clave)) n.delete(clave); else n.add(clave);
    return n;
  });

  /** Marca o desmarca un lote entero (el "todo" de un módulo). */
  const setLote = (claves, valor) => setPermisos((prev) => {
    const n = new Set(prev);
    for (const c of claves) { if (valor) n.add(c); else n.delete(c); }
    return n;
  });

  const totalSecciones = catalogo.reduce(
    (a, g) => a + g.secciones.filter((p) => permisos.has(p.clave)).length, 0,
  );

  const guardar = async () => {
    setGuardando(true);
    const ok = await onGuardar({ nombre, descripcion, permisos: [...permisos] });
    setGuardando(false);
    if (ok) onCerrar();
  };

  return (
    <ModalShell
      title={esAlta ? 'Nuevo rol' : `Permisos de ${rol.nombre}`}
      size="lg"
      onClose={onCerrar}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: onCerrar },
        { texto: guardando ? 'Guardando…' : `Guardar (${permisos.size} permisos)`, clase: 'btn-primary', onClick: guardar },
      ]}
    >
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Nombre <span className={s.req}>*</span></label>
          <input autoFocus={esAlta} value={nombre} placeholder="Ej: Encargado de depósito" onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className={s.field}>
          <label>Descripción</label>
          <input value={descripcion} placeholder="Qué hace este rol en el día a día" onChange={(e) => setDescripcion(e.target.value)} />
        </div>
      </div>

      <div className={cx(s.callout, totalSecciones === 0 ? s.warn : s.info)} style={{ margin: '4px 0 10px' }}>
        {totalSecciones === 0
          ? <>Sin <strong>ninguna sección</strong> marcada, este rol entra al sistema y no ve nada de nada.</>
          : <><strong>Secciones</strong> = qué pantallas ve · <strong>Acciones</strong> = qué operaciones puede hacer dentro de lo que ve. Un módulo sin secciones desaparece entero del menú.</>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 'var(--crm-space-4)' }}>
        {catalogo.map((g) => {
          const clavesGrupo = [...g.secciones, ...g.acciones].map((p) => p.clave);
          return (
            <div key={g.grupo} className={s.card} style={{ padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <CheckTodo claves={clavesGrupo} permisos={permisos} onSet={setLote} label={g.grupo} />
                <span className={s.muted} style={{ fontSize: 11.5 }}>
                  {g.secciones.filter((p) => permisos.has(p.clave)).length}/{g.secciones.length} secc.
                </span>
              </div>
              <ListaPermisos titulo="Secciones" items={g.secciones} permisos={permisos} toggle={toggle} />
              <ListaPermisos titulo="Acciones" items={g.acciones} permisos={permisos} toggle={toggle} />
            </div>
          );
        })}
      </div>
      <div className={s.hint}>
        Los cambios llegan a los usuarios con este rol al recargar la pantalla (F5) —
        sin volver a iniciar sesión.
      </div>
    </ModalShell>
  );
}

/* ---------------- Página ---------------- */

export function GerenciaPage() {
  const { user } = useAuth();
  const { can } = usePermissions();
  // Solo las secciones del rol: lo no asignado no existe en el menú.
  const secciones = useMemo(() => GERENCIA_SECCIONES.filter((x) => can(x.permiso)), [can]);
  /* `?seccion=cashflow` abre directo esa sección (lo usa el banner de cajas abiertas, 4/10/2026). */
  const [seccion, setSeccion] = useState(() => {
    try {
      const pedida = new URLSearchParams(window.location.search).get('seccion');
      if (pedida && secciones.some((x) => x.id === pedida)) return pedida;
    } catch { /* sin window */ }
    return secciones[0]?.id;
  });
  const [tab, setTab] = useState('usuarios');
  const [usuarios, setUsuarios] = useState(null);
  const [roles, setRoles] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  /** Ediciones sin guardar de la tabla de sucursales: { [id]: {puntoVenta, direccion} }. */
  const [edits, setEdits] = useState({});
  /** La sucursal que se está por desactivar: la segunda confirmación (0143). */
  const [aDesactivar, setADesactivar] = useState(null);
  const enVuelo = useRef(false);
  const cambiarEstadoSucursal = async (su, activar) => {
    if (enVuelo.current) return;
    enVuelo.current = true;
    try {
      const r = await httpClient.post(`/sucursales/${su.id}/${activar ? 'reactivar' : 'desactivar'}`);
      const extra = activar ? '' : [
        r.equipos ? `${r.equipos} equipo${r.equipos === 1 ? '' : 's'} registrado${r.equipos === 1 ? '' : 's'} ahí quedaron dados de baja` : '',
        r.sesiones ? `se cerraron ${r.sesiones} sesión${r.sesiones === 1 ? '' : 'es'} abiertas en ese local` : '',
        r.usuariosSinLocal?.length ? `OJO: ${r.usuariosSinLocal.join(', ')} trabajaba${r.usuariosSinLocal.length === 1 ? '' : 'n'} solo ahí — asignale${r.usuariosSinLocal.length === 1 ? '' : 's'} otra sucursal en Usuarios` : '',
        r.gastosFijos?.length ? `OJO: tiene gastos fijos activos (${r.gastosFijos.join(', ')}) que se siguen generando — dalos de baja en Gastos si ya no corren` : '',
      ].filter(Boolean).join('; ');
      setAviso({
        tipo: r.usuariosSinLocal?.length || r.gastosFijos?.length ? 'err' : 'ok',
        texto: activar ? `${su.nombre} reactivada: vuelve a aparecer en todo el sistema.` : `${su.nombre} desactivada: ya no aparece para elegir en ninguna parte; su historial queda.${extra ? ` ${extra}.` : ''}`,
      });
      setADesactivar(null);
      await cargar();
    } catch (e) {
      setAviso({ tipo: 'err', texto: e?.data?.message || 'No se pudo cambiar el estado de la sucursal.' });
    } finally {
      enVuelo.current = false;
    }
  };
  const [aviso, setAviso] = useState(null);
  const [modal, setModal] = useState(null); // {tipo:'usuario'|'rol', datos}

  /*
   * Solo se pide si el rol PUEDE ver Usuarios y roles. Antes se pedía siempre,
   * y como los tres endpoints exigen `gerencia.usuarios`, el rol Administrador
   * —que tiene las otras cinco secciones de Gerencia pero no esta— se comía
   * TRES 403 cada vez que entraba, con un aviso de error que ni siquiera se ve
   * (vive dentro del panel de usuarios, que ese rol no abre).
   */
  const cargar = useCallback(async () => {
    if (!can('gerencia.usuarios')) { setUsuarios([]); return; }
    try {
      const [us, rs, sc] = await Promise.all([
        httpClient.get('/usuarios'),
        httpClient.get('/roles'),
        // Todas, también las desactivadas (0143): acá es donde se reactivan.
        httpClient.get('/sucursales?todas=1'),
      ]);
      setUsuarios(us); setRoles(rs); setSucursales(sc);
      setEdits({});
    } catch (e) {
      setAviso({ tipo: 'err', texto: e?.data?.message || 'No se pudo conectar con la API.' });
      setUsuarios([]);
    }
  }, [can]);
  useEffect(() => { cargar(); }, [cargar]);

  /*
   * El catálogo de permisos va APARTE y una sola vez: es una constante del
   * servidor (8 grupos, 71 claves, ~5 KB). Estaba adentro de `cargar()`, que
   * corre después de cada guardado, así que desactivar cinco usuarios se
   * bajaba cinco veces la misma tabla que nunca cambia.
   */
  useEffect(() => {
    if (!can('gerencia.usuarios')) return;
    httpClient.get('/roles/permisos').then(setCatalogo).catch(() => setCatalogo([]));
  }, [can]);

  // El aviso se va solo: es una confirmación, no un estado permanente.
  useEffect(() => {
    if (!aviso) return undefined;
    // Un error dice qué falta resolver (por ejemplo, al desactivar una sucursal): se deja leer.
    const t = setTimeout(() => setAviso(null), aviso.tipo === 'err' ? 15000 : 4000);
    return () => clearTimeout(t);
  }, [aviso]);

  const mutar = useCallback(async (fn, okMsg) => {
    try {
      await fn();
      setAviso({ tipo: 'ok', texto: okMsg });
      await cargar();
      return true;
    } catch (e) {
      setAviso({ tipo: 'err', texto: e?.data?.message || 'No se pudo guardar.' });
      return false;
    }
  }, [cargar]);

  const nombreRol = useMemo(() => new Map(roles.map((r) => [r.id, r.nombre])), [roles]);

  const pagUsuarios = usePaginado(usuarios ?? [], 'gerenciaUsuarios');

  if (!secciones.length) {
    return (
      <div style={{ padding: 'var(--crm-space-6)' }}>
        <PanelHead title="Gerencia" desc="Usuarios, roles y permisos del sistema." />
        <div className={cx(s.callout, s.warn)}>
          Tu rol no tiene ninguna sección de <strong>Gerencia</strong> asignada.
        </div>
      </div>
    );
  }

  // Si el permiso de la sección activa se fue (rol editado), cae a la primera visible.
  const activa = secciones.find((x) => x.id === seccion) ?? secciones[0];

  const panelUsuarios = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Usuarios y roles"
        desc={`Sesión de ${user?.name ?? '—'} (superadmin). Los usuarios entran con su contraseña; cada rol define qué puede hacer cada uno.`}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Las sucursales no se crean desde acá: son estructura de la
                empresa y se editan las que hay. Sin este `null`, la pestaña
                ofrecía "+ Nuevo rol", que no es lo que se está mirando. */}
            {tab === 'usuarios' && (
              <Btn variant="btn-primary" onClick={() => setModal({ tipo: 'usuario', datos: null })}>+ Nuevo usuario</Btn>
            )}
            {tab === 'roles' && (
              <Btn variant="btn-primary" onClick={() => setModal({ tipo: 'rol', datos: null })}>+ Nuevo rol</Btn>
            )}
          </div>
        }
      />

      <div style={{ display: 'flex', gap: 8 }}>
        {[['usuarios', 'Usuarios'], ['roles', 'Roles y permisos'], ['sucursales', 'Sucursales']].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={cx(s.badge)}
            style={{
              cursor: 'pointer', padding: '7px 16px', fontSize: 13, border: '1px solid var(--crm-color-border)',
              ...(tab === id
                ? { background: 'var(--crm-color-primary)', color: 'var(--crm-color-primary-contrast)', borderColor: 'var(--crm-color-primary)' }
                : {}),
            }}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {aviso && (
        <div className={cx(s.callout, aviso.tipo === 'ok' ? s.info : s.warn)} style={{ margin: 0 }}>
          {aviso.texto}
        </div>
      )}

      {tab === 'usuarios' && (
        <Table
          cols={[
            { h: 'Usuario' }, { h: 'Rol' }, { h: 'Sucursales' }, { h: 'Descuento a mano' }, { h: 'Estado' }, { h: 'Contraseña' },
            { h: 'Acciones', cls: 'actions-col' },
          ]}
          empty={usuarios === null ? 'Cargando…' : 'Sin usuarios.'}
          pag={pagUsuarios}
        >
          {pagUsuarios.visibles.map((u) => {
            const esSuper = u.rolClave === 'superadmin';
            return (
              <tr key={u.id} style={u.activo ? undefined : { opacity: 0.55 }}>
                <td>
                  <strong>{u.nombre}</strong>
                  {esSuper && <span className={cx(s.pill, s['st-disponible'])} style={{ marginLeft: 6 }}>Superadmin</span>}
                </td>
                <td>{nombreRol.get(u.rolId) ?? u.rolNombre}</td>
                <td>
                  {u.sucursales?.length && !['admin', 'superadmin'].includes(u.rolClave)
                    ? u.sucursales.map((id) => sucursales.find((x) => x.id === id)?.nombre ?? `#${id}`).join(', ')
                    : <span className={s.muted}>Todas</span>}
                </td>
                <td>{u.descuentoManualMax > 0 || sinTope(u.permisos) ? textoDescuento(u) : <span className={s.muted}>No</span>}</td>
                <td>
                  <span className={cx(s.pill, u.activo ? s['st-disponible'] : s['est-cancelada'])}>
                    {u.activo ? 'Activo' : 'Desactivado'}
                  </span>
                </td>
                <td>{u.tienePassword ? '••••••' : <span style={{ color: 'var(--crm-color-accent-2)', fontWeight: 600 }}>sin definir</span>}</td>
                <td className={s['actions-col']}>
                  <div className={s['row-actions']}>
                    <Btn variant="btn-edit" small onClick={() => setModal({ tipo: 'usuario', datos: u })}>Editar</Btn>
                    <Btn
                      small
                      variant={u.activo ? 'btn-delete' : 'btn-ingreso'}
                      onClick={() => mutar(
                        () => httpClient.patch(`/usuarios/${u.id}`, { activo: !u.activo }),
                        u.activo ? `${u.nombre} desactivado.` : `${u.nombre} reactivado.`,
                      )}
                    >
                      {u.activo ? 'Desactivar' : 'Reactivar'}
                    </Btn>
                  </div>
                </td>
              </tr>
            );
          })}
        </Table>
      )}

      {tab === 'roles' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--crm-space-4)' }}>
          {roles.map((r) => {
            const esSuper = r.clave === 'superadmin';
            return (
              <div key={r.id} className={s.card} style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong style={{ fontSize: 15 }}>{r.nombre}</strong>
                  {r.esSistema && <span className={cx(s.pill, s['est-pendiente'])}>Sistema</span>}
                  <span style={{ flex: 1 }} />
                  <span className={s.muted} style={{ fontSize: 12.5 }}>{r.usuarios} usuario(s)</span>
                </div>
                <div className={s.muted} style={{ fontSize: 13 }}>{r.descripcion || '—'}</div>
                <div style={{ fontSize: 12.5 }}>
                  {r.permisos.includes('*')
                    ? <strong style={{ color: 'var(--crm-color-primary)' }}>Todos los permisos</strong>
                    : `${r.permisos.length} permiso(s)`}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                  {esSuper ? (
                    <span className={s.muted} style={{ fontSize: 12.5 }}>Maneja todo el sistema — no se toca.</span>
                  ) : (
                    <>
                      <Btn variant="btn-edit" small onClick={() => setModal({ tipo: 'rol', datos: r })}>Editar permisos</Btn>
                      {!r.esSistema && r.usuarios === 0 && (
                        <Btn variant="btn-delete" small onClick={() => mutar(
                          () => httpClient.delete(`/roles/${r.id}`), `Rol ${r.nombre} eliminado.`,
                        )}>Eliminar</Btn>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'sucursales' && (
        <>
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
              { h: 'Domicilio del comprobante' }, { h: 'Factura electrónica' }, { h: 'Mayorista' }, { h: 'Fondo de caja', num: true }, { h: 'Estado' }, { h: 'Acciones', cls: 'actions-col' },
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
            El <strong>fondo de caja</strong> es con cuánto abre la caja de cada local y cuánto queda
            apartado al cerrar para el turno siguiente; si está vacío, lo fija la primera apertura.
            Para encender la <strong>factura electrónica</strong> de un local: dá de alta su punto de venta
            (tipo Web Services) en ARCA, cargalo acá con el domicilio, guardá, y probalo en{' '}
            <strong>Ventas › Configuración › Facturación › Probar conexión</strong> (tiene que figurar autorizado).
            Recién ahí tildá la casilla. Dos locales no pueden compartir el punto de venta.
          </div>
        </>
      )}
    </div>
  );

  return (
    <div style={{ padding: 'var(--crm-space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead title="Gerencia" desc="Administración y tablero de gestión del negocio." />

      {/* Mismo shell que Compras/Almacén: sub-menú lateral + panel activo. */}
      <div className={s.shell}>
        <nav className={s.subnav} aria-label="Secciones de Gerencia">
          {secciones.map((x) => {
            const Icon = x.icon;
            return (
              <button
                key={x.id}
                type="button"
                className={cx(s.subnavItem, activa.id === x.id && s.subnavItemActive)}
                onClick={() => setSeccion(x.id)}
              >
                <span className={s.subnavIcon}><Icon fontSize="small" /></span>
                <span className={s.subnavLabel}>{x.label}</span>
              </button>
            );
          })}
        </nav>

        <div className={s.content}>
          {activa.id === 'rentabilidad' ? <RentabilidadPanel />
            : activa.id === 'metricas' ? <MetricasPanel />
            : activa.id === 'cashflow' ? <CashFlowPanel />
            : activa.id === 'auditoria' ? <AuditoriaPanel />
            : panelUsuarios}
        </div>
      </div>

      {modal?.tipo === 'usuario' && (
        <UsuarioModal
          usuario={modal.datos}
          roles={roles}
          sucursales={sucursales.filter((x) => x.activa !== false)}
          onCerrar={() => setModal(null)}
          onGuardar={(payload) => (modal.datos
            ? mutar(() => httpClient.patch(`/usuarios/${modal.datos.id}`, payload), 'Usuario actualizado.')
            : mutar(() => httpClient.post('/usuarios', payload), 'Usuario creado.'))}
        />
      )}
      {modal?.tipo === 'rol' && (
        <RolModal
          rol={modal.datos}
          catalogo={catalogo}
          onCerrar={() => setModal(null)}
          onGuardar={(payload) => (modal.datos
            ? mutar(() => httpClient.patch(`/roles/${modal.datos.id}`, payload), 'Permisos actualizados.')
            : mutar(() => httpClient.post('/roles', payload), 'Rol creado.'))}
        />
      )}
    </div>
  );
}
