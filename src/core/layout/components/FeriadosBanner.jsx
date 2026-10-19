/**
 * EL AVISO DEL PRÓXIMO FERIADO (0182, 19/10/2026, pedido del dueño). Arriba de
 * toda la app, para quien tiene Sistema › Feriados (admin y superadmin): los
 * que caen de hoy a 10 días, con lo que hace cada sucursal —así se ve a tiempo
 * la que todavía está «sin definir»—. Se lee al entrar, cada 30 minutos y
 * cuando se guarda algo en Sistema › Feriados (`EVENTO_FERIADOS`).
 * «Ocultar» lo esconde en este navegador hasta que aparezca otro feriado.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { httpClient } from '@core/services/httpClient.js';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { ALCANCE_FERIADO, EVENTO_FERIADOS, TIPO_FERIADO, cuantoFalta, diaYFecha, queHace } from '@shared/utils/feriados.js';

const CLAVE = 'erp.feriados.ocultos';
const CADA_MS = 30 * 60_000;
const leerOcultos = () => { try { return JSON.parse(localStorage.getItem(CLAVE) || '[]'); } catch { return []; } };

export function FeriadosBanner() {
  const { can } = usePermissions();
  const puede = can('sistema.feriados');
  const navigate = useNavigate();
  const [datos, setDatos] = useState(null);
  const [ocultos, setOcultos] = useState(leerOcultos);

  useEffect(() => {
    if (!puede) return undefined;
    let vivo = true;
    const leer = () => httpClient.get('/feriados/proximos').then((d) => { if (vivo) setDatos(d); }).catch(() => { /* el próximo intento */ });
    leer();
    const t = setInterval(leer, CADA_MS);
    window.addEventListener(EVENTO_FERIADOS, leer);
    return () => { vivo = false; clearInterval(t); window.removeEventListener(EVENTO_FERIADOS, leer); };
  }, [puede]);

  const lista = (datos?.feriados ?? []).filter((f) => !ocultos.includes(f.id));
  if (!puede || !lista.length) return null;

  const ocultar = () => {
    /* Solo los ids de ahora: los viejos se van solos y la lista no crece. */
    const v = datos.feriados.map((f) => f.id);
    try { localStorage.setItem(CLAVE, JSON.stringify(v)); } catch { /* sin storage */ }
    setOcultos(v);
  };
  return (
    <div
      role="status"
      style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px 12px', padding: '8px 16px', fontSize: 13.5,
        background: 'color-mix(in srgb, var(--crm-color-info) 10%, var(--crm-color-surface))',
        borderBottom: '1px solid color-mix(in srgb, var(--crm-color-info) 35%, transparent)', color: 'var(--crm-color-text)',
      }}
    >
      <div style={{ flex: 1, minWidth: 220, display: 'grid', gap: 2 }}>
        {lista.map((f) => {
          const config = new Map(f.sucursales.map((x) => [x.sucursalId, x]));
          return (
            <div key={f.id}>
              <strong>📅 {cuantoFalta(f.fecha, datos.hoy) === 'hoy' ? 'Hoy' : `Feriado ${cuantoFalta(f.fecha, datos.hoy)}`}: {diaYFecha(f.fecha)} · {f.nombre}</strong>
              <span style={{ color: 'var(--crm-color-text-secondary)' }}>
                {' '}({TIPO_FERIADO[f.tipo] ?? f.tipo} {(ALCANCE_FERIADO[f.alcance] ?? f.alcance).toLowerCase()}).{' '}
                {datos.sucursales.map((su) => `${su.nombre}: ${queHace(config.get(su.id))}`).join(' · ')}
              </span>
            </div>
          );
        })}
      </div>
      <button type="button" onClick={() => navigate('/sistema?seccion=feriados')} style={{ border: '1px solid var(--crm-color-border)', background: 'var(--crm-color-surface)', color: 'var(--crm-color-text)', borderRadius: 6, padding: '4px 10px', fontWeight: 700, cursor: 'pointer' }}>
        Ver feriados
      </button>
      <button type="button" onClick={ocultar} style={{ border: 'none', background: 'none', color: 'var(--crm-color-text-secondary)', textDecoration: 'underline', cursor: 'pointer', fontSize: 12.5 }}>
        Ocultar
      </button>
    </div>
  );
}
