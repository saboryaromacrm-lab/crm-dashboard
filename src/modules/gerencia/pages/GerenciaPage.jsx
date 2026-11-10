/**
 * GERENCIA — los números del negocio
 * ============================================================================
 * El shell del módulo: el sub-menú lateral con las secciones que tiene el rol y
 * el panel activo. Usuarios y roles y Sucursales se mudaron a Sistema el
 * 9/11/2026 (0225, pedido del dueño): Gerencia queda para mirar el negocio.
 */
import { useMemo, useRef, useState } from 'react';
import { useSeccionEnUrl, useSubnavALaVista } from '@core/hooks/useSeccionEnUrl.js';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { cx } from '@shared/utils/classNames.js';
import { PanelHead, s } from '@modules/productos/components/ui.jsx';
import { GERENCIA_SECCIONES } from '../config/gerencia.config.js';
import { RentabilidadPanel } from '../panels/RentabilidadPanel.jsx';
import { MetricasPanel } from '../panels/metricas/MetricasPanel.jsx';
import { IndicadoresPanel } from '../panels/indicadores/IndicadoresPanel.jsx';
import { VistaProfesionalPanel } from '../panels/vista/VistaProfesionalPanel.jsx';
import { CashFlowPanel } from '../panels/cashflow/CashFlowPanel.jsx';
import { AuditoriaPanel } from '../panels/AuditoriaPanel.jsx';
import { ResultadosPanel } from '../panels/resultados/ResultadosPanel.jsx';
import { GastosFijosPanel } from '../panels/resultados/GastosFijosPanel.jsx';
import { AsesorPanel } from '../panels/asesor/AsesorPanel.jsx';

const PANELES = {
  vista: VistaProfesionalPanel,
  rentabilidad: RentabilidadPanel,
  metricas: MetricasPanel,
  indicadores: IndicadoresPanel,
  resultados: ResultadosPanel,
  gastosfijos: GastosFijosPanel,
  cashflow: CashFlowPanel,
  asesor: AsesorPanel,
  auditoria: AuditoriaPanel,
};

export function GerenciaPage() {
  const { can } = usePermissions();
  // Solo las secciones del rol: lo no asignado no existe en el menú.
  const secciones = useMemo(() => GERENCIA_SECCIONES.filter((x) => can(x.permiso)), [can]);
  /* `?seccion=cashflow` abre directo esa sección (lo usa el banner de cajas abiertas, 4/10/2026). */
  const [seccion, setSeccion] = useState(() => {
    try {
      const pedida = new URLSearchParams(window.location.search).get('seccion');
      if (pedida && secciones.some((x) => x.id === pedida)) return pedida;
    } catch { /* sin window */ }
    return secciones[0]?.id;
  });

  /*
   * Los hooks van ANTES de la salida temprana (regla de los hooks): un rol sin
   * secciones deja `activa` en undefined y los dos hooks no hacen nada.
   * Si el permiso de la sección activa se fue (rol editado), cae a la primera visible.
   */
  const activa = secciones.find((x) => x.id === seccion) ?? secciones[0];
  const subnavRef = useRef(null);
  useSeccionEnUrl(activa?.id, setSeccion, secciones.map((x) => x.id), 'seccion');
  useSubnavALaVista(subnavRef, activa?.id);

  if (!secciones.length) {
    return (
      <div style={{ padding: 'var(--crm-pagina-pad, var(--crm-space-6))' }}>
        <PanelHead title="Gerencia" desc="Los números del negocio." />
        <div className={cx(s.callout, s.warn)}>
          Tu rol no tiene ninguna sección de <strong>Gerencia</strong> asignada.
        </div>
      </div>
    );
  }

  const Panel = PANELES[activa.id];
  return (
    <div style={{ padding: 'var(--crm-pagina-pad, var(--crm-space-6))', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead title="Gerencia" desc="Los números del negocio: rentabilidad, resultados, métricas, caja central y auditoría." />

      {/* Mismo shell que Compras/Almacén: sub-menú lateral + panel activo. */}
      <div className={s.shell}>
        <nav className={s.subnav} aria-label="Secciones de Gerencia" ref={subnavRef}>
          {secciones.map((x) => {
            const Icon = x.icon;
            return (
              <button
                key={x.id}
                type="button"
                className={cx(s.subnavItem, activa.id === x.id && s.subnavItemActive)}
                aria-current={activa.id === x.id}
                onClick={() => setSeccion(x.id)}
              >
                <span className={s.subnavIcon}><Icon fontSize="small" /></span>
                <span className={s.subnavLabel}>{x.label}</span>
              </button>
            );
          })}
        </nav>

        <div className={s.content}>
          <Panel />
        </div>
      </div>
    </div>
  );
}
