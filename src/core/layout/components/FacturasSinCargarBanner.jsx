/**
 * LA MERCADERÍA QUE LLEGÓ Y SU FACTURA NO SE CARGÓ (7/11/2026, pedido del
 * dueño: «avisá a admin y superadmin cuando llega mercadería de un proveedor
 * —tomalo de la tarjeta de pedidos— y no se cargó su fc, así sabemos qué
 * facturas faltan cargar»). Solo administración (admin y superadmin).
 *
 * Sale de Proveedores › Pedidos: cada tarjeta pasada a «Recibido» espera su
 * factura, remito o liquidación de ese proveedor, cargado desde que se pidió
 * (la regla, en la API: `proveedores/sin-factura.ts`). Se va solo al cargarla;
 * «Ya está» la saca a mano (la tarjeta se movió por error, la factura se cargó
 * mucho antes…). Se lee al entrar y cada 30 minutos. «Ocultar por hoy» lo
 * esconde hasta mañana en este navegador; si llega otra, vuelve.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { httpClient } from '@core/services/httpClient.js';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';

const CLAVE = 'erp.facturasSinCargar.ocultar';
const CADA_MS = 30 * 60_000;
const DIA_MS = 86_400_000;
const hoy = () => new Date().toLocaleDateString('sv-SE');
const leerOculto = () => { try { return JSON.parse(localStorage.getItem(CLAVE) || 'null'); } catch { return null; } };
const fecha = (d) => { const f = new Date(d); return `${f.toLocaleDateString('es-AR', { weekday: 'short' })} ${f.getDate()}/${f.getMonth() + 1}`; };
/** Días corridos desde que llegó, por fecha de calendario (no por horas). */
const diasDesde = (d) => Math.round((new Date(hoy()) - new Date(new Date(d).toLocaleDateString('sv-SE'))) / DIA_MS);
const hace = (n) => (n <= 0 ? 'hoy' : n === 1 ? 'ayer' : `hace ${n} días`);
/** Las notas de la orden de pedido traen encabezado y saludo: queda lo pedido, en un renglón. */
const resumen = (notas) => String(notas ?? '').split('\n').map((l) => l.trim())
  .filter((l) => l && !l.startsWith('Pedido - ') && !l.startsWith('Por favor confirmar')).join(' · ');
const COLOR = '#92400e';
const boton = { border: '1px solid #fcd34d', background: '#fff', color: COLOR, borderRadius: 6, padding: '4px 10px', fontWeight: 700, cursor: 'pointer' };

export function FacturasSinCargarBanner() {
  const { esAdmin } = usePermissions();
  const navigate = useNavigate();
  const [lista, setLista] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const [oculto, setOculto] = useState(leerOculto);
  const [resolviendo, setResolviendo] = useState(null);
  const [error, setError] = useState('');

  const leer = useCallback(() => httpClient.get('/pedidos-proveedor/sin-factura')
    .then((d) => setLista(d?.pedidos ?? [])).catch(() => { /* el próximo intento */ }), []);

  useEffect(() => {
    if (!esAdmin) return undefined;
    leer();
    const t = setInterval(leer, CADA_MS);
    return () => clearInterval(t);
  }, [esAdmin, leer]);

  if (!esAdmin || !lista.length) return null;
  const firma = lista.map((p) => p.id).join(',');
  if (oculto && oculto.dia === hoy() && oculto.firma === firma) return null;

  const ocultar = () => {
    const v = { dia: hoy(), firma };
    try { localStorage.setItem(CLAVE, JSON.stringify(v)); } catch { /* sin storage */ }
    setOculto(v);
  };
  const yaEsta = async (p) => {
    if (!window.confirm(`¿Dar por resuelta la mercadería de ${p.proveedor} que llegó el ${fecha(p.fechaRecepcion)}?\n\nDeja de avisar por esta entrega aunque no encuentre su factura. Usalo si la tarjeta se pasó a «Recibido» por error o si la factura ya está cargada.`)) return;
    setResolviendo(p.id);
    setError('');
    try {
      await httpClient.post(`/pedidos-proveedor/${p.id}/factura-resuelta`);
      await leer();
    } catch (e) {
      setError(e?.message || 'No se pudo marcar. Probá de nuevo.');
    } finally {
      setResolviendo(null);
    }
  };
  const masVieja = diasDesde(lista[0].fechaRecepcion);

  return (
    <div role="alert" style={{ padding: '8px 16px', background: '#fffbeb', borderBottom: '1px solid #fcd34d', color: COLOR, fontSize: 13.5 }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <strong>🧾 {lista.length === 1 ? 'Llegó mercadería y su factura no se cargó:' : `${lista.length} entregas de proveedores llegaron y su factura no se cargó:`}</strong>
        <span style={{ flex: 1, minWidth: 180 }}>
          {lista.length === 1 ? `${lista[0].proveedor}, ${hace(masVieja)}.` : `la más vieja, ${hace(masVieja)}.`}
        </span>
        <button type="button" onClick={() => setAbierto((a) => !a)} style={boton}>
          {abierto ? 'Cerrar' : 'Ver cuáles'}
        </button>
        <button type="button" onClick={() => navigate('/compras?panel=facturacion')} style={boton}>
          Ir a Compras
        </button>
        <button type="button" onClick={ocultar} style={{ border: 'none', background: 'none', color: COLOR, textDecoration: 'underline', cursor: 'pointer', fontSize: 12.5 }}>
          Ocultar por hoy
        </button>
      </div>
      {abierto && (
        <div style={{ display: 'grid', gap: 4, marginTop: 8, maxHeight: 260, overflowY: 'auto' }}>
          {error && <div style={{ color: '#b91c1c', fontWeight: 600 }}>{error}</div>}
          {lista.map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 10px', padding: '4px 0', borderTop: '1px solid #fde68a' }}>
              <strong style={{ minWidth: 180 }}>{p.proveedor}</strong>
              <span style={{ minWidth: 150 }}>llegó el {fecha(p.fechaRecepcion)} ({hace(diasDesde(p.fechaRecepcion))})</span>
              <span title={p.notas} style={{ flex: 1, minWidth: 160, color: '#78350f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {resumen(p.notas) || 'sin notas en la tarjeta'}
              </span>
              <button
                type="button" onClick={() => yaEsta(p)} disabled={resolviendo === p.id}
                title="Deja de avisar por esta entrega" style={{ ...boton, padding: '2px 8px' }}
              >
                {resolviendo === p.id ? '…' : 'Ya está'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
