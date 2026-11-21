/**
 * CUENTA DISPONIBLE COMPLETA (0238, 20/11/2026, pedido del dueño: «cuando se
 * completa el pago a un proveedor en Cuentas disponibles, que me salga un
 * banner de aviso al admin y superadmin»).
 *
 * Sale cuando una cuenta de Proveedores › Cuentas disponibles queda cubierta:
 * por la transferencia de un cliente en la caja, por un recibo o por un pago
 * propio. Lo ve administración (admin y superadmin), cada uno hasta que toca
 * «Entendido» (queda en el servidor: no vuelve en otra compu ni en el celular).
 * Si nadie lo mira, a los 30 días se va solo. Si la cuenta se reabre (se anuló
 * una venta que la pagaba) y se vuelve a completar, avisa de nuevo.
 *
 * Se lee al entrar, cada minuto, al volver a la pestaña y apenas se paga o se
 * edita una cuenta desde el ERP (evento `erp:cuentas-completas`).
 *
 * PASADA (21/11/2026, pedido del dueño): si la cuenta recibió MÁS de lo que
 * le faltaba (el cliente ya le había transferido de más), el aviso sale en
 * ROJO y aparte, con la venta, el cliente y quién cobró: esa plata quedó a
 * cuenta del proveedor y hay que confirmárselo. Mismo «Entendido».
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { httpClient } from '@core/services/httpClient.js';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { EVENTO_CUENTAS_COMPLETAS } from './cuentasCompletas.js';

const CADA_MS = 60_000;
const COLOR = '#166534';
const BORDE = '#86efac';
const boton = { border: `1px solid ${BORDE}`, background: '#fff', color: COLOR, borderRadius: 6, padding: '4px 10px', fontWeight: 700, cursor: 'pointer' };
const RUTA = '/proveedores?panel=cuentas&estado=cubiertas';

const pesos = (n) => `$${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const transferencias = (n) => `${n} ${n === 1 ? 'transferencia' : 'transferencias'}`;
/** «hoy 14:32», «ayer 9:05» o «mar 18/11 16:40». */
const cuando = (d) => {
  const f = new Date(d);
  const hora = f.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const dia = (x) => new Date(x).toLocaleDateString('sv-SE');
  const hoy = new Date();
  const ayer = new Date(hoy.getTime() - 86_400_000);
  if (dia(f) === dia(hoy)) return `hoy ${hora}`;
  if (dia(f) === dia(ayer)) return `ayer ${hora}`;
  return `${f.toLocaleDateString('es-AR', { weekday: 'short' })} ${f.getDate()}/${f.getMonth() + 1} ${hora}`;
};
const detalle = (c) => `${pesos(c.pagado)} en ${transferencias(c.cant)}${c.pasado > 0 ? ` (pasada por ${pesos(c.pasado)})` : ''} · ${cuando(c.completaEn)}`;
const ROJO = '#991b1b';
const BORDE_ROJO = '#fca5a5';
/** «la venta 00034-00002293 de lara quintana · cobró Karen · ayer 18:32». */
const conQue = ({ documento: d, clienteNombre, usuarioNombre, fecha }) => [
  d?.clase === 'venta' ? `la venta ${d.etiqueta}` : d?.clase === 'recibo' ? `el recibo ${d.etiqueta}` : (d?.etiqueta ?? 'una transferencia'),
  clienteNombre && `de ${clienteNombre}`,
].filter(Boolean).join(' ') + (usuarioNombre ? ` · cobró ${usuarioNombre}` : '') + ` · ${cuando(fecha)}`;

export function CuentasCompletasBanner() {
  const { esAdmin } = usePermissions();
  const navigate = useNavigate();
  const [lista, setLista] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const [marcando, setMarcando] = useState(null);
  const [error, setError] = useState('');

  const leer = useCallback(() => httpClient.get('/cuentas-disponibles/completas-aviso')
    .then((d) => setLista(Array.isArray(d) ? d : [])).catch(() => { /* el próximo intento */ }), []);

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

  if (!esAdmin || !lista.length) return null;
  const pasadas = lista.filter((c) => c.pasado > 0.009 && c.ultimo);
  const completas = lista.filter((c) => !pasadas.includes(c));

  const entendido = async (cuentas) => {
    setMarcando(cuentas.length === 1 ? cuentas[0].id : 'todas');
    setError('');
    try {
      await Promise.all(cuentas.map((c) => httpClient.post(`/cuentas-disponibles/${c.id}/aviso-visto`)));
      const fuera = new Set(cuentas.map((c) => c.id));
      setLista((l) => l.filter((c) => !fuera.has(c.id)));
    } catch (e) {
      setError(e?.message || 'No se pudo marcar. Probá de nuevo.');
      leer();
    } finally {
      setMarcando(null);
    }
  };
  const verlas = () => navigate(RUTA);
  const sinResumen = completas.filter((c) => !c.enviado).length;
  const una = completas.length === 1 ? completas[0] : null;

  const botonRojo = { ...boton, borderColor: BORDE_ROJO, color: ROJO };

  return (
    <>
      {pasadas.map((c) => (
        <div key={c.id} role="alert" style={{ padding: '8px 16px', background: '#fef2f2', borderBottom: `1px solid ${BORDE_ROJO}`, color: ROJO, fontSize: 13.5 }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <strong>⚠️ La cuenta disponible de {c.proveedorNombre} ({c.titular}) recibió {pesos(c.pasado)} de más.</strong>
            <span style={{ flex: 1, minWidth: 200 }}>Entró con {conQue(c.ultimo)}. Quedó a cuenta del proveedor: confirmáselo.</span>
            <button type="button" onClick={verlas} style={botonRojo}>Ver la cuenta</button>
            <button type="button" onClick={() => entendido([c])} disabled={marcando != null} style={botonRojo}>
              {marcando === c.id ? '…' : 'Entendido'}
            </button>
          </div>
        </div>
      ))}
      {completas.length > 0 && (
        <div role="status" style={{ padding: '8px 16px', background: '#f0fdf4', borderBottom: `1px solid ${BORDE}`, color: COLOR, fontSize: 13.5 }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <strong>
              ✅ {una
                ? `Se completó la cuenta disponible de ${una.proveedorNombre} (${una.titular}):`
                : `Se completaron ${completas.length} cuentas disponibles:`}
            </strong>
            <span style={{ flex: 1, minWidth: 180 }}>
              {una ? detalle(una) : `la última, ${completas[0].proveedorNombre} · ${cuando(completas[0].completaEn)}`}
              {sinResumen > 0 && (
                <em style={{ marginLeft: 6 }}>
                  {una ? '· Falta mandarle el resumen.' : `· ${sinResumen === 1 ? 'A una le falta' : `A ${sinResumen} les falta`} mandar el resumen.`}
                </em>
              )}
            </span>
            {!una && (
              <button type="button" onClick={() => setAbierto((a) => !a)} style={boton}>
                {abierto ? 'Cerrar' : 'Ver cuáles'}
              </button>
            )}
            <button type="button" onClick={verlas} style={boton}>Ir a Cuentas disponibles</button>
            <button type="button" onClick={() => entendido(completas)} disabled={marcando != null} style={boton}>
              {marcando === 'todas' || (una && marcando === una.id) ? '…' : una ? 'Entendido' : 'Entendido con todas'}
            </button>
          </div>
          {!una && abierto && (
            <div style={{ display: 'grid', gap: 4, marginTop: 8, maxHeight: 260, overflowY: 'auto' }}>
              {completas.map((c) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 10px', padding: '4px 0', borderTop: `1px solid ${BORDE}` }}>
                  <strong style={{ minWidth: 180 }}>{c.proveedorNombre}</strong>
                  <span style={{ minWidth: 140 }}>{c.titular}</span>
                  <span style={{ flex: 1, minWidth: 200 }}>
                    {detalle(c)}
                    {!c.enviado && <em style={{ marginLeft: 6 }}>· falta el resumen</em>}
                  </span>
                  <button
                    type="button" onClick={() => entendido([c])} disabled={marcando != null}
                    title="Deja de avisarte por esta cuenta" style={{ ...boton, padding: '2px 8px' }}
                  >
                    {marcando === c.id ? '…' : 'Entendido'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {error && <div role="alert" style={{ padding: '4px 16px', color: '#b91c1c', fontWeight: 600, fontSize: 13 }}>{error}</div>}
    </>
  );
}
