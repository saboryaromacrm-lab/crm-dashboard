/**
 * EL BANNER DE CAJAS ABIERTAS (Cash Flow, parte 3). A diferencia de los otros
 * avisos del ERP (que suenan y se van), este QUEDA a la vista mientras haya
 * una caja de un local abierta hace más de 24 horas: hasta que la cierren, el
 * sobre de ese local no llega al dueño. «Ocultar por hoy» lo esconde hasta
 * mañana en este navegador; si aparece otra caja, vuelve a mostrarse.
 */
import { useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { cajasAbiertas } from '@core/services/cajasAbiertas.js';

const CLAVE = 'erp.cashflow.cajasAbiertas.ocultar';
const hoy = () => new Date().toLocaleDateString('sv-SE');
const fechaHora = (v) => new Date(v).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function leerOculto() {
  try { return JSON.parse(localStorage.getItem(CLAVE) || 'null'); } catch { return null; }
}

export function CajasAbiertasBanner() {
  const { can } = usePermissions();
  const puede = can('gerencia.cashflow');
  const navigate = useNavigate();
  const lista = useSyncExternalStore(puede ? cajasAbiertas.subscribe : () => () => {}, cajasAbiertas.lista, cajasAbiertas.lista);
  const [oculto, setOculto] = useState(leerOculto);
  if (!puede || !lista.length) return null;
  const firma = lista.map((c) => c.id).sort().join(',');
  if (oculto && oculto.dia === hoy() && oculto.firma === firma) return null;

  const ocultar = () => {
    const v = { dia: hoy(), firma };
    try { localStorage.setItem(CLAVE, JSON.stringify(v)); } catch { /* sin storage */ }
    setOculto(v);
  };
  return (
    <div
      role="alert"
      style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10,
        padding: '8px 16px', background: '#fff7ed', borderBottom: '1px solid #fdba74', color: '#9a3412', fontSize: 13.5,
      }}
    >
      <strong>⚠ Caja abierta hace más de 24 h:</strong>
      <span style={{ flex: 1, minWidth: 200 }}>
        {lista.map((c) => `${c.sucursal} (${c.usuario || 'sin usuario'}, desde el ${fechaHora(c.apertura)}, ${c.horas} h)`).join(' · ')}.
        {' '}Puede ser un cierre olvidado: hasta que cierren, el sobre no llega.
      </span>
      <button type="button" onClick={() => navigate('/gerencia?seccion=cashflow')} style={{ border: '1px solid #fdba74', background: '#fff', color: '#9a3412', borderRadius: 6, padding: '4px 10px', fontWeight: 700, cursor: 'pointer' }}>
        Ver en Cash Flow
      </button>
      <button type="button" onClick={ocultar} style={{ border: 'none', background: 'none', color: '#9a3412', textDecoration: 'underline', cursor: 'pointer', fontSize: 12.5 }}>
        Ocultar por hoy
      </button>
    </div>
  );
}
