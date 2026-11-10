import { useEffect, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';

/**
 * ¿A QUÉ EMPLEADO SE LE DIO EL ADELANTO? (0221, 6/11/2026, pedido del dueño).
 *
 * Va en todo egreso con concepto de adelanto (el concepto trae `esAdelanto`):
 * Cash Flow, caja del local y el asentado después del cierre. Elegir es
 * obligatorio (el servidor lo exige). La lista se carga en Sistema › Usuarios y roles
 * › Empleados. `value` es el id como texto ('' = sin elegir).
 */
export function EmpleadoAdelanto({ value, onChange, id = 'empleado-adelanto' }) {
  const [lista, setLista] = useState(null);
  useEffect(() => { httpClient.get('/personal/adelantos').then(setLista).catch(() => setLista([])); }, []);
  if (lista && !lista.length) {
    return <div style={{ fontSize: 13, color: 'var(--crm-color-danger)' }}>No hay empleados cargados: el dueño los carga en Sistema › Usuarios y roles › Empleados.</div>;
  }
  const grupo = (usaSistema, label) => {
    const de = (lista ?? []).filter((e) => (e.usuarioId != null) === usaSistema);
    return de.length > 0 && <optgroup label={label}>{de.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</optgroup>;
  };
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{lista ? 'Elegí el empleado' : 'Cargando…'}</option>
      {grupo(true, 'Usan el sistema')}
      {grupo(false, 'No usan el sistema')}
    </select>
  );
}
