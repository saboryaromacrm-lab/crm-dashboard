/**
 * NO HAY CUENTAS DISPONIBLES ABIERTAS (20/11/2026, pedido del dueño: «cuando
 * no hay cuentas disponibles, que me salga un aviso y que me sugiera qué
 * cuentas pueden ser: proveedores a los que les debo y que en su cuenta hayan
 * recibido pagos de cuentas disponibles»).
 *
 * Sin ninguna abierta, la caja no puede cobrar con «Transf. a proveedor».
 * Avisa a administración (admin y superadmin) y sugiere a quién abrirle una:
 * proveedores que alguna vez recibieron por cuentas disponibles y hoy tienen
 * deuda neta (la regla, en la API: `sinAbiertas`). «Crear cuenta» abre el alta
 * ya cargada con el proveedor, lo que se le debe y la última cuenta bancaria
 * que usó. Se va solo apenas hay una abierta.
 *
 * Se lee al entrar, cada 5 minutos, al volver a la pestaña y apenas se crea,
 * paga o edita una cuenta desde el ERP (evento `erp:cuentas-completas`).
 * «Ocultar por hoy» lo esconde hasta mañana en este navegador.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { httpClient } from '@core/services/httpClient.js';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { EVENTO_CUENTAS_COMPLETAS } from './cuentasCompletas.js';

const CLAVE = 'erp.sinCuentasDisponibles.ocultar';
const CADA_MS = 5 * 60_000;
const DIA_MS = 86_400_000;
const COLOR = '#92400e';
const BORDE = '#fcd34d';
const boton = { border: `1px solid ${BORDE}`, background: '#fff', color: COLOR, borderRadius: 6, padding: '4px 10px', fontWeight: 700, cursor: 'pointer' };
const RUTA = '/proveedores?panel=cuentas';

const hoy = () => new Date().toLocaleDateString('sv-SE');
const leerOculto = () => { try { return localStorage.getItem(CLAVE); } catch { return null; } };
const pesos = (n) => `$${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const diasDesde = (d) => Math.round((new Date(hoy()) - new Date(new Date(d).toLocaleDateString('sv-SE'))) / DIA_MS);
const hace = (n) => (n <= 0 ? 'hoy' : n === 1 ? 'ayer' : `hace ${n} días`);
const transferencias = (n) => `${n} ${n === 1 ? 'transferencia' : 'transferencias'}`;

export function SinCuentasDisponiblesBanner() {
  const { esAdmin } = usePermissions();
  const navigate = useNavigate();
  const [datos, setDatos] = useState(null);
  const [abierto, setAbierto] = useState(false);
  const [oculto, setOculto] = useState(leerOculto);

  const leer = useCallback(() => httpClient.get('/cuentas-disponibles/sin-abiertas')
    .then((d) => setDatos(d ?? null)).catch(() => { /* el próximo intento */ }), []);

  useEffect(() => {
    if (!esAdmin) return undefined;
    const alVolver = () => { if (document.visibilityState === 'visible') leer(); };
    leer();
    const t = setInterval(leer, CADA_MS);
    window.addEventListener(EVENTO_CUENTAS_COMPLETAS, leer);
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      clearInterval(t);
      window.removeEventListener(EVENTO_CUENTAS_COMPLETAS, leer);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [esAdmin, leer]);

  if (!esAdmin || !datos || datos.abiertas > 0 || oculto === hoy()) return null;
  const sugerencias = datos.sugerencias ?? [];

  const ocultar = () => {
    try { localStorage.setItem(CLAVE, hoy()); } catch { /* sin storage */ }
    setOculto(hoy());
  };
  const crear = (s) => navigate(RUTA, {
    state: {
      cuentaSugerida: {
        proveedorId: s.proveedorId, importe: s.deuda, cuentaId: s.cuentaId, titular: s.titular, cbuAlias: s.cbuAlias,
      },
    },
  });

  return (
    <div role="alert" style={{ padding: '8px 16px', background: '#fffbeb', borderBottom: `1px solid ${BORDE}`, color: COLOR, fontSize: 13.5 }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <strong>🏦 No hay cuentas disponibles abiertas:</strong>
        <span style={{ flex: 1, minWidth: 200 }}>
          la caja no puede cobrar con «Transf. a proveedor».
          {sugerencias.length > 0
            ? ` ${sugerencias.length === 1 ? 'Hay un proveedor' : `Hay ${sugerencias.length} proveedores`} a los que les debés y ya recibieron por cuentas disponibles.`
            : ' No hay proveedores con deuda que hayan recibido por cuentas disponibles.'}
        </span>
        {sugerencias.length > 0 && (
          <button type="button" onClick={() => setAbierto((a) => !a)} style={boton}>
            {abierto ? 'Cerrar' : 'Ver sugerencias'}
          </button>
        )}
        <button type="button" onClick={() => navigate(RUTA)} style={boton}>Ir a Cuentas disponibles</button>
        <button type="button" onClick={ocultar} style={{ border: 'none', background: 'none', color: COLOR, textDecoration: 'underline', cursor: 'pointer', fontSize: 12.5 }}>
          Ocultar por hoy
        </button>
      </div>
      {abierto && (
        <div style={{ display: 'grid', gap: 4, marginTop: 8, maxHeight: 280, overflowY: 'auto' }}>
          {sugerencias.map((s) => (
            <div key={s.proveedorId} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 12px', padding: '5px 0', borderTop: '1px solid #fde68a' }}>
              <strong style={{ minWidth: 170 }}>{s.nombre}</strong>
              <span style={{ minWidth: 150 }}>le debés <strong>{pesos(s.deuda)}</strong></span>
              <span style={{ flex: 1, minWidth: 220, color: '#78350f' }}>
                recibió {pesos(s.transferido)} en {transferencias(s.cant)}, la última {hace(diasDesde(s.ultimaVez))}
                {' · '}última cuenta: {s.titular} ({s.cbuAlias})
                {s.minimo > 0 && ` · mínimo por transferencia ${pesos(s.minimo)}`}
              </span>
              <button
                type="button" onClick={() => crear(s)} style={{ ...boton, padding: '2px 8px' }}
                title="Abre el alta de la cuenta disponible ya cargada: revisás el importe y guardás"
              >
                Crear cuenta
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
