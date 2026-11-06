/**
 * GERENCIA › USUARIOS › EMPLEADOS (0221, 6/11/2026, pedido del dueño).
 *
 * Quiénes aparecen para elegir al sacar un ADELANTO DE SUELDO (caja central y
 * caja de los locales): los usuarios del ERP marcados como empleados y los que
 * no usan el sistema, que se cargan acá solo con el nombre. Una sola tabla: la
 * casilla marca al usuario como empleado, o activa/desactiva al que no tiene
 * usuario. Nada se borra: los adelantos viejos siguen nombrándolos.
 */
import { useCallback, useEffect, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { httpClient } from '@core/services/httpClient.js';
import { Table, Btn, s } from '@modules/productos/components/ui.jsx';

export function EmpleadosPestana({ usuarios, mutar }) {
  const [externos, setExternos] = useState(null);
  const [nuevo, setNuevo] = useState('');
  const cargar = useCallback(() => httpClient.get('/personal').then(setExternos).catch(() => setExternos([])), []);
  useEffect(() => { cargar(); }, [cargar]);

  const cambiar = async (fn, msg) => { if (await mutar(fn, msg)) await cargar(); };
  const agregar = () => {
    if (!nuevo.trim()) return;
    cambiar(() => httpClient.post('/personal', { nombre: nuevo.trim() }), `${nuevo.trim()} agregado: ya aparece en los adelantos.`)
      .then(() => setNuevo(''));
  };

  const filas = [
    ...(usuarios ?? []).filter((u) => u.activo).map((u) => ({
      clave: `u${u.id}`, nombre: u.nombre, usuario: true, marcado: !!u.esEmpleado,
      tildar: (v) => cambiar(() => httpClient.patch(`/usuarios/${u.id}`, { esEmpleado: v }), v ? `${u.nombre} es empleado.` : `${u.nombre} ya no aparece en los adelantos.`),
    })),
    ...(externos ?? []).map((p) => ({
      clave: `p${p.id}`, nombre: p.nombre, usuario: false, marcado: p.activo,
      tildar: (v) => cambiar(() => httpClient.patch(`/personal/${p.id}`, { activo: v }), v ? `${p.nombre} reactivado.` : `${p.nombre} ya no aparece en los adelantos.`),
      renombrar: (n) => n.trim() && n.trim() !== p.nombre && cambiar(() => httpClient.patch(`/personal/${p.id}`, { nombre: n.trim() }), 'Nombre actualizado.'),
    })),
  ].sort((a, b) => Number(b.marcado) - Number(a.marcado) || a.nombre.localeCompare(b.nombre, 'es'));
  const cuantos = filas.filter((f) => f.marcado).length;

  return (
    <>
      <div className={cx(s.callout, s.info)} style={{ margin: 0 }}>
        Los tildados aparecen para elegir al sacar un <strong>adelanto de sueldo</strong> (Cash Flow y caja de los locales):
        sin elegir a uno, el adelanto no se registra. Tildá los usuarios que son empleados y agregá acá a los que
        <strong> no usan el sistema</strong> (solo el nombre, no entran al ERP). Hoy: <strong>{cuantos}</strong>.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          id="empleado-nuevo" value={nuevo} maxLength={80} placeholder="Nombre y apellido de un empleado sin usuario"
          onChange={(e) => setNuevo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') agregar(); }}
          style={{ flex: '1 1 260px', maxWidth: 420 }}
        />
        <Btn variant="btn-primary" onClick={agregar} disabled={!nuevo.trim()}>+ Agregar empleado sin usuario</Btn>
      </div>
      <Table cols={[{ h: 'Aparece en adelantos' }, { h: 'Nombre' }, { h: 'Usa el sistema' }]} empty={externos === null ? 'Cargando…' : 'Sin empleados.'}>
        {filas.map((f) => (
          <tr key={f.clave} style={f.marcado ? undefined : { opacity: 0.6 }}>
            <td>
              <input type="checkbox" checked={f.marcado} onChange={(e) => f.tildar(e.target.checked)} aria-label={`${f.nombre} aparece en los adelantos`} />
            </td>
            <td>
              {f.usuario ? <strong>{f.nombre}</strong> : (
                <input defaultValue={f.nombre} maxLength={80} aria-label="Nombre del empleado"
                  onBlur={(e) => f.renombrar(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
              )}
            </td>
            <td>{f.usuario ? 'Sí' : <span className={s.muted}>No (solo para adelantos)</span>}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
