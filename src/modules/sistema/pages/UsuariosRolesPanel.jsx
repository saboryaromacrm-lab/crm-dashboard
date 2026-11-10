/**
 * SISTEMA › USUARIOS Y ROLES (9/11/2026, 0225; antes en Gerencia)
 * ============================================================================
 * Acá se crean los usuarios con su contraseña, los empleados que no usan el
 * sistema (adelantos de sueldo) y los ROLES con sus permisos (checkboxes sobre
 * el catálogo que sirve la API — agregar un permiso nuevo al catálogo lo hace
 * aparecer acá solo, sin tocar esta pantalla). Llave `sistema.usuarios`.
 *
 * Reglas espejadas del backend (la API las valida igual):
 *   - superadmin: no se edita ni se borra; siempre queda uno activo.
 *   - roles de sistema: editables, no borrables.
 *   - usuarios: se desactivan, nunca se borran (viven en los historiales).
 *   - no se reparte lo que no se tiene (permisos ni «Libre»).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { useAuth } from '@core/auth/AuthContext.jsx';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { cx } from '@shared/utils/classNames.js';
import { ModalShell } from '@modules/productos/components/Modal.jsx';
import { Table, PanelHead, Btn, usePaginado, s } from '@modules/productos/components/ui.jsx';
import { EmpleadosPestana } from './EmpleadosPestana.jsx';
import { mutarConAviso } from './mutarConAviso.js';

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
  /* Es empleado (0221): aparece para elegir en los adelantos de sueldo. */
  const [esEmpleado, setEsEmpleado] = useState(usuario?.esEmpleado ?? false);
  const [pin, setPin] = useState('');
  /* EN QUÉ SUCURSALES ENTRA (0105). Ninguna tildada = todas, lo de siempre. */
  const [sucs, setSucs] = useState(() => new Set(usuario?.sucursales ?? []));
  const rolElegido = roles.find((r) => r.id === Number(rolId));
  /* Cómo entra lo dice el rol (0224): solo «Las de cada usuario» usa las tildadas. */
  const modoRol = (rolElegido?.permisos ?? []).includes('*') ? 'libre' : (rolElegido?.modoSucursal ?? 'usuario');
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
      relevoCaja, esEmpleado,
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
          y el servidor rechaza las demás. Si el rol es «Libre» o no trabaja en una
          sucursal (0224), la lista no corre. */}
      <div className={s.field} style={{ marginTop: 12 }}>
        <label>Sucursales donde trabaja</label>
        {modoRol !== 'usuario' ? (
          <div className={s.hint} style={{ margin: 0 }}>
            {modoRol === 'libre'
              ? 'Su rol es «Libre»: entra en cualquier sucursal y la cambia desde el encabezado.'
              : 'Su rol no trabaja en una sucursal: no se le pide al entrar.'}
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

      <div className={s.field} style={{ marginTop: 12 }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={esEmpleado} onChange={(e) => setEsEmpleado(e.target.checked)} />
          Es empleado
        </label>
        <div className={s.hint} style={{ margin: '4px 0 0' }}>
          Aparece para elegir al sacar un adelanto de sueldo. Los empleados que no usan el sistema se cargan en la pestaña «Empleados».
        </div>
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
/**
 * CÓMO ENTRA A LAS SUCURSALES (0224, pedido del dueño): va en el rol. «Libre»
 * solo dice dónde puede pararse; lo que ve sigue siendo lo tildado. Quien no
 * entra en cualquier sucursal no puede dar «Libre» (la API también lo exige).
 */
const MODOS_SUCURSAL = [
  ['usuario', 'Las de cada usuario', 'Entra en las sucursales tildadas en su usuario (ninguna tildada: elige cualquiera al entrar) y se queda en esa.'],
  ['libre', 'Libre', 'Entra en cualquier sucursal y la cambia desde el encabezado, como el administrador. Solo ve lo que tenga tildado abajo.'],
  ['ninguna', 'No trabaja en una sucursal', 'No se le pide sucursal al entrar (como Coffit): lo que carga dice a qué sucursal va.'],
];
const nombreModo = (modo) => MODOS_SUCURSAL.find(([k]) => k === modo)?.[1] ?? '';

function RolModal({ rol, catalogo, puedeLibre, onGuardar, onCerrar }) {
  const esAlta = !rol;
  const [nombre, setNombre] = useState(rol?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(rol?.descripcion ?? '');
  const [modoSucursal, setModoSucursal] = useState(rol?.modoSucursal ?? 'usuario');
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
    const ok = await onGuardar({ nombre, descripcion, modoSucursal, permisos: [...permisos] });
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
        <div className={s.field}>
          <label htmlFor="rol-modo-sucursal">Sucursal</label>
          <select id="rol-modo-sucursal" value={modoSucursal} onChange={(e) => setModoSucursal(e.target.value)}>
            {MODOS_SUCURSAL.map(([k, texto]) => (
              <option key={k} value={k} disabled={k === 'libre' && !puedeLibre && rol?.modoSucursal !== 'libre'}>{texto}</option>
            ))}
          </select>
          <div className={s.hint} style={{ margin: '4px 0 0' }}>
            {MODOS_SUCURSAL.find(([k]) => k === modoSucursal)?.[2]}
            {!puedeLibre && ' «Libre» lo da solo quien entra en cualquier sucursal.'}
          </div>
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

const PESTANAS = [['usuarios', 'Usuarios'], ['empleados', 'Empleados'], ['roles', 'Roles y permisos']];

export function UsuariosRolesPanel({ onAviso }) {
  const { user } = useAuth();
  const [tab, setTab] = useState('usuarios');
  const [usuarios, setUsuarios] = useState(null);
  const [roles, setRoles] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  /** Para elegir dónde trabaja cada usuario y nombrarlas en la tabla (leerlas es de cualquier sesión). */
  const [sucursales, setSucursales] = useState([]);
  const [modal, setModal] = useState(null); // {tipo:'usuario'|'rol', datos}

  const cargar = useCallback(async () => {
    try {
      const [us, rs, sc] = await Promise.all([
        httpClient.get('/usuarios'),
        httpClient.get('/roles'),
        httpClient.get('/sucursales?todas=1'),
      ]);
      setUsuarios(us); setRoles(rs); setSucursales(sc);
    } catch (e) {
      onAviso({ tipo: 'err', texto: e?.data?.message || 'No se pudo conectar con la API.' });
      setUsuarios([]);
    }
  }, [onAviso]);
  useEffect(() => { cargar(); }, [cargar]);

  /*
   * El catálogo de permisos va APARTE y una sola vez: es una constante del
   * servidor. Adentro de `cargar()`, que corre después de cada guardado, se
   * bajaba otra vez la misma tabla que nunca cambia.
   */
  useEffect(() => {
    httpClient.get('/roles/permisos').then(setCatalogo).catch(() => setCatalogo([]));
  }, []);

  const mutar = useCallback((fn, okMsg) => mutarConAviso(fn, okMsg, { onAviso, cargar }), [onAviso, cargar]);
  const nombreRol = useMemo(() => new Map(roles.map((r) => [r.id, r.nombre])), [roles]);
  const pagUsuarios = usePaginado(usuarios ?? [], 'sistemaUsuarios');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Usuarios y roles"
        desc={`Sesión de ${user?.name ?? '—'}. Los usuarios entran con su contraseña; cada rol define qué puede hacer cada uno.`}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
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
        {PESTANAS.map(([id, label]) => (
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
            const modo = roles.find((r) => r.id === u.rolId)?.modoSucursal;
            return (
              <tr key={u.id} style={u.activo ? undefined : { opacity: 0.55 }}>
                <td>
                  <strong>{u.nombre}</strong>
                  {esSuper && <span className={cx(s.pill, s['st-disponible'])} style={{ marginLeft: 6 }}>Superadmin</span>}
                </td>
                <td>{nombreRol.get(u.rolId) ?? u.rolNombre}</td>
                <td>
                  {u.cruzaSucursales ? <span className={s.muted}>Todas (libre)</span>
                    : modo === 'ninguna' ? <span className={s.muted}>Ninguna</span>
                      : u.sucursales?.length ? u.sucursales.map((id) => sucursales.find((x) => x.id === id)?.nombre ?? `#${id}`).join(', ')
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

      {tab === 'empleados' && <EmpleadosPestana usuarios={usuarios} mutar={mutar} />}

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
                  {!esSuper && <span className={s.muted}> · Sucursal: {nombreModo(r.modoSucursal)}</span>}
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
          puedeLibre={!!user?.cruzaSucursales}
          onCerrar={() => setModal(null)}
          onGuardar={(payload) => (modal.datos
            ? mutar(() => httpClient.patch(`/roles/${modal.datos.id}`, payload), 'Permisos actualizados.')
            : mutar(() => httpClient.post('/roles', payload), 'Rol creado.'))}
        />
      )}
    </div>
  );
}
