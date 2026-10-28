/**
 * EL BANNER DE CUENTAS CORRIENTES VENCIDAS (28/10/2026, pedido del dueño).
 * Solo administración (admin y superadmin): los clientes que pasaron los días
 * de su cuenta corriente y todavía deben, con lo vencido de cada uno y un
 * toque para reclamarle por WhatsApp. Solo avisa: la caja sigue vendiendo.
 * Se lee al entrar y cada 30 minutos. «Ocultar por hoy» lo esconde hasta
 * mañana en este navegador; si se suma otro cliente, vuelve a mostrarse.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { httpClient } from '@core/services/httpClient.js';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { formatCurrency } from '@shared/utils/formatters.js';
import { abrirWhatsApp } from '@shared/utils/whatsapp.js';
import { telefonoWa } from '@modules/ventas/domain/constants.js';

const CLAVE = 'erp.cuentasVencidas.ocultar';
const CADA_MS = 30 * 60_000;
const hoy = () => new Date().toLocaleDateString('sv-SE');
const leerOculto = () => { try { return JSON.parse(localStorage.getItem(CLAVE) || 'null'); } catch { return null; } };
const hace = (d) => (d === 1 ? 'ayer' : `hace ${d} días`);
const COLOR = '#b91c1c';
const boton = { border: '1px solid #fca5a5', background: '#fff', color: COLOR, borderRadius: 6, padding: '4px 10px', fontWeight: 700, cursor: 'pointer' };

export function CuentasVencidasBanner() {
  const { esAdmin } = usePermissions();
  const navigate = useNavigate();
  const [datos, setDatos] = useState(null);
  const [abierto, setAbierto] = useState(false);
  const [oculto, setOculto] = useState(leerOculto);

  useEffect(() => {
    if (!esAdmin) return undefined;
    let vivo = true;
    const leer = () => httpClient.get('/ventas/cuentas-vencidas').then((d) => { if (vivo) setDatos(d); }).catch(() => { /* el próximo intento */ });
    leer();
    const t = setInterval(leer, CADA_MS);
    return () => { vivo = false; clearInterval(t); };
  }, [esAdmin]);

  const lista = datos?.clientes ?? [];
  if (!esAdmin || !lista.length) return null;
  const firma = lista.map((c) => c.clienteId).sort((a, b) => a - b).join(',');
  if (oculto && oculto.dia === hoy() && oculto.firma === firma) return null;

  const ocultar = () => {
    const v = { dia: hoy(), firma };
    try { localStorage.setItem(CLAVE, JSON.stringify(v)); } catch { /* sin storage */ }
    setOculto(v);
  };
  const reclamar = (c) => abrirWhatsApp(
    telefonoWa(c.telefono),
    `Hola ${c.nombre}, te escribimos por tu cuenta corriente: tenés ${formatCurrency(c.vencido)} vencido. ¿Cuándo podés abonarlo? ¡Gracias!`,
  );

  return (
    <div role="alert" style={{ padding: '8px 16px', background: '#fef2f2', borderBottom: '1px solid #fca5a5', color: COLOR, fontSize: 13.5 }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <strong>⚠ {lista.length === 1 ? '1 cliente tiene' : `${lista.length} clientes tienen`} la cuenta corriente vencida:</strong>
        <span style={{ flex: 1, minWidth: 180 }}>{formatCurrency(datos.total)} sin pagar después del plazo.</span>
        <button type="button" onClick={() => setAbierto((a) => !a)} style={boton}>
          {abierto ? 'Cerrar' : 'Ver quiénes'}
        </button>
        <button type="button" onClick={() => navigate('/ventas?panel=cobranzas')} style={boton}>
          Ir a Cobranzas
        </button>
        <button type="button" onClick={ocultar} style={{ border: 'none', background: 'none', color: COLOR, textDecoration: 'underline', cursor: 'pointer', fontSize: 12.5 }}>
          Ocultar por hoy
        </button>
      </div>
      {abierto && (
        <div style={{ display: 'grid', gap: 4, marginTop: 8, maxHeight: 240, overflowY: 'auto' }}>
          {lista.map((c) => (
            <div key={c.clienteId} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 10px', padding: '4px 0', borderTop: '1px solid #fecaca' }}>
              <strong style={{ minWidth: 160 }}>{c.nombre}</strong>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(c.vencido)} vencido</span>
              <span style={{ flex: 1, minWidth: 160, color: '#7f1d1d' }}>
                {c.comprobantes === 1 ? '1 comprobante' : `${c.comprobantes} comprobantes`}, el más viejo venció {hace(c.diasAtraso)}
              </span>
              <button
                type="button" onClick={() => reclamar(c)} disabled={!telefonoWa(c.telefono)}
                title={telefonoWa(c.telefono) ? 'Abrir el chat con el reclamo escrito' : 'El cliente no tiene un celular cargado'}
                style={{ ...boton, padding: '2px 8px', opacity: telefonoWa(c.telefono) ? 1 : 0.5, cursor: telefonoWa(c.telefono) ? 'pointer' : 'not-allowed' }}
              >
                WhatsApp
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
