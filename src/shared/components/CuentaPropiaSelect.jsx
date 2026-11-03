import { useEffect, useState, useSyncExternalStore } from 'react';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { cuentasPropias } from '@core/services/cuentasPropias.js';
import { errorMsg } from '@modules/ventas/services/ventas.api.js';
import { Btn, s } from '@modules/productos/components/ui.jsx';

/** Quien maneja el Cash Flow (el superadmin) carga cuentas; los demás solo eligen. */
const PERMISO_CARGAR = 'gerencia.cashflow';
const NUEVA = '__nueva__';
/** Otra cuenta escrita a mano (0215): el valor es este prefijo + el texto. */
const A_MANO = 'mano:';

/** Lo que el pago manda al servidor según lo elegido: una de Mis cuentas o la escrita a mano. */
export const cuentaDelPago = (value) => (String(value ?? '').startsWith(A_MANO)
  ? { cuentaAMano: String(value).slice(A_MANO.length) }
  : { cuentaPropiaId: Number(value) || undefined });

/** El nombre de lo elegido, para confirmar el pago: «Mercado Pago» o «cuenta de mi hermano (a mano)». */
export const nombreCuentaElegida = (value, cuentas) => (String(value ?? '').startsWith(A_MANO)
  ? `${String(value).slice(A_MANO.length).trim()} (a mano)`
  : cuentas?.find((c) => String(c.id) === String(value))?.nombre);

/** La lista de Mis cuentas (todas, activas primero), viva en todo el ERP. */
export const useCuentasPropias = () => useSyncExternalStore(cuentasPropias.subscribe, cuentasPropias.estado);

/**
 * ¿DE QUÉ CUENTA SALIÓ LA TRANSFERENCIA? (0207, 28/10/2026, pedido del dueño).
 *
 * Va en todo pago por transferencia. Con una sola cuenta activa la elige sola;
 * sin ninguna no pide nada (la regla está en el servidor: con cuentas cargadas,
 * elegir es obligatorio). Quien maneja el Cash Flow agrega una cuenta desde acá
 * mismo, sin salir del pago. `value` es el id como texto ('' = sin elegir).
 *
 * OTRA CUENTA, A MANO (0215, 3/11/2026, pedido del dueño): «desde la cuenta de
 * mi hermano». La escribe cualquiera que paga, no se agrega a Mis cuentas y
 * queda asentada en el pago como «… (a mano)». Se manda con `cuentaDelPago`.
 * `aMano={false}` la saca donde ya hay otra forma de decirlo.
 */
export function CuentaPropiaSelect({ value, onChange, style, aMano = true }) {
  const { cuentas, error } = useCuentasPropias();
  const { can } = usePermissions();
  const puedeCargar = can(PERMISO_CARGAR);
  const activas = (cuentas ?? []).filter((c) => c.activa);
  const unica = activas.length === 1 ? String(activas[0].id) : '';
  const [nueva, setNueva] = useState(null);
  const [errorNueva, setErrorNueva] = useState('');

  useEffect(() => { if (unica && !value) onChange(unica); }, [unica, value, onChange]);

  const agregar = async () => {
    if (!nueva.trim()) { setErrorNueva('Escribí el nombre de la cuenta (por ejemplo «Mercado Pago»).'); return; }
    try {
      const c = await cuentasPropias.crear({ nombre: nueva.trim() });
      onChange(String(c.id));
      setNueva(null);
      setErrorNueva('');
    } catch (e) {
      setErrorNueva(errorMsg(e));
    }
  };

  if (aMano && String(value ?? '').startsWith(A_MANO)) {
    return (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', ...style }}>
        <input
          autoFocus maxLength={80} value={value.slice(A_MANO.length)} aria-label="Otra cuenta, escrita a mano"
          placeholder="¿De qué cuenta? Ej.: cuenta de mi hermano" onChange={(e) => onChange(A_MANO + e.target.value)}
        />
        <Btn small onClick={() => onChange('')}>Elegir de mis cuentas</Btn>
      </div>
    );
  }
  if (nueva !== null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            autoFocus maxLength={60} value={nueva} placeholder="Nombre de la cuenta (Mercado Pago, Galicia…)"
            onChange={(e) => setNueva(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && agregar()}
          />
          <Btn small variant="btn-primary" onClick={agregar}>Agregar</Btn>
          <Btn small onClick={() => { setNueva(null); setErrorNueva(''); }}>Cancelar</Btn>
        </div>
        {errorNueva && <div className={s.hint} style={{ margin: 0, color: 'var(--crm-color-danger)' }}>{errorNueva}</div>}
      </div>
    );
  }
  if (!cuentas) {
    return error
      ? <div className={s.hint} style={{ margin: 0, ...style }}>No se pudieron traer tus cuentas: {errorMsg(error)}</div>
      : <select disabled style={style}><option>Cargando tus cuentas…</option></select>;
  }
  if (!activas.length) {
    return (
      <div className={s.hint} style={{ margin: 0, ...style }}>
        No tenés cuentas cargadas, así que no se pide de cuál salió.{' '}
        {puedeCargar
          ? <Btn small onClick={() => setNueva('')}>Agregar una cuenta</Btn>
          : 'Se cargan en Gerencia › Cash Flow › Configuración.'}
        {aMano && <>{' '}<Btn small onClick={() => onChange(A_MANO)}>Escribir otra cuenta</Btn></>}
      </div>
    );
  }
  return (
    <select
      value={value} style={style} aria-label="De qué cuenta salió"
      onChange={(e) => (e.target.value === NUEVA ? setNueva('') : onChange(e.target.value))}
    >
      <option value="">— Elegí la cuenta —</option>
      {activas.map((c) => <option key={c.id} value={c.id}>{c.detalle ? `${c.nombre} · ${c.detalle}` : c.nombre}</option>)}
      {aMano && <option value={A_MANO}>Otra cuenta (escribirla a mano)…</option>}
      {puedeCargar && <option value={NUEVA}>+ Agregar una cuenta…</option>}
    </select>
  );
}

/** «desde Mercado Pago» (o «desde Mercado Pago y Galicia» en un pago mixto); '' si no salió de una cuenta propia. */
export function desdeCuentas(pago) {
  const nombres = [...new Set([pago.cuentaPropiaNombre, ...(pago.formas ?? []).map((f) => f.cuentaPropiaNombre)].filter(Boolean))];
  return nombres.length ? `desde ${nombres.join(' y ')}` : '';
}

/** El filtro de los listados de pagos: lo que salió de una cuenta (también como parte de un pago mixto). Sin cuentas, no se muestra. */
export function FiltroCuentaPropia({ value, onChange, className }) {
  const { cuentas } = useCuentasPropias();
  if (!cuentas?.length) return null;
  return (
    <select className={className} value={value} onChange={(e) => onChange(e.target.value)} aria-label="Cuenta de la que salió">
      <option value="">Todas las cuentas</option>
      {cuentas.map((c) => <option key={c.id} value={c.id}>{c.activa ? c.nombre : `${c.nombre} (desactivada)`}</option>)}
    </select>
  );
}
