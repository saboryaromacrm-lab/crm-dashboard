/**
 * RESULTADOS EN EL CELULAR (/resultados, 0152) — para mirar, no para cargar.
 * Fuera del menú del ERP, con el mismo estilo del Cash Flow del teléfono: el
 * mes (con flechas), el local, el resultado grande arriba, los indicadores y
 * la cascada en una tarjeta. La configuración y los objetivos se cargan en la
 * computadora (Gerencia › Resultados).
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RefreshIcon from '@mui/icons-material/Refresh';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { useResource } from '@modules/ventas/hooks/useResource.js';
import { cx } from '@shared/utils/classNames.js';
import c from '../cashflow/CashFlowMovil.module.css';
import { resultadosApi } from './resultados.api.js';
import {
  armarColumnas, baldesDe, cumplimiento, indicadores, mesActual, nombreMes, objetivoDe, origenDe, pct, pesosRedondo,
  renglones, sobreVentas, sumarMeses, textoOrigen, variacion,
} from './resultados.js';
import { useAbiertos } from './useAbiertos.js';

export function ResultadosMovil() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const puede = can('gerencia.resultados');
  const hoy = mesActual();
  const [mes, setMes] = useState(hoy);
  const [balde, setBalde] = useState(null);
  const [version, setVersion] = useState(0);
  const [abiertos, alternar] = useAbiertos();
  const { data, loading, error } = useResource(
    `resultados-movil:${mes}:${version}`,
    () => resultadosApi.estado(sumarMeses(mes, -12), mes, mes),
    { enabled: puede },
  );
  const vista = useMemo(() => (data ? armarColumnas(data, { modo: 'mes', mes, vista: 'meses', balde }) : null), [data, mes, balde]);
  const locales = data ? baldesDe(data, [mes]).filter((b) => b.id > 0) : [];

  if (!puede) {
    return (
      <div className={c.app}>
        <div className={c.centro}>
          <strong style={{ fontSize: 18 }}>Resultados es solo del dueño</strong>
          <p className={c.nota}>Con este usuario no se puede ver. Entrá con el usuario superadmin.</p>
          <button type="button" className={cx(c.btn, c.btnPrimario)} onClick={() => navigate('/')}>Ir al ERP</button>
        </div>
      </div>
    );
  }

  const col = vista?.principal;
  const ind = col ? indicadores(col) : null;
  const esEmpresa = balde == null;
  const resultado = col ? (esEmpresa ? col.neto : col.antesGanancias) : 0;
  const contra = vista?.contra;
  const varVentas = col && contra ? variacion(col.ventasNetas, contra.ventasNetas) : null;
  const obj = vista ? objetivoDe(data.objetivos, [mes], balde) : null;
  const filas = col ? renglones([col], data.rubros, abiertos) : [];
  const ivaMes = data?.meses?.find((m) => m.mes === mes)?.iva;

  return (
    <div className={c.app} style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}>
      <header className={c.top}>
        <div className={c.topTitulo}>
          <strong>Resultados</strong>
          <span>Sabor y Aroma · todo en neto</span>
        </div>
        <button type="button" className={cx(c.icono, loading && c.girando)} onClick={() => setVersion((v) => v + 1)} aria-label="Actualizar"><RefreshIcon /></button>
        {can('gerencia.cashflow') && (
          <button type="button" className={c.icono} onClick={() => navigate('/cashflow')} aria-label="Ir al Cash Flow"><PaymentsOutlinedIcon /></button>
        )}
        <button type="button" className={c.icono} onClick={() => navigate('/')} aria-label="Abrir el ERP"><OpenInNewRoundedIcon /></button>
      </header>

      <main className={c.contenido}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" className={c.btn} onClick={() => setMes(sumarMeses(mes, -1))} aria-label="Mes anterior"><ChevronLeftRoundedIcon /></button>
          <strong style={{ flex: 1, textAlign: 'center', fontSize: 17 }}>{nombreMes(mes)}</strong>
          <button type="button" className={c.btn} disabled={mes >= hoy} onClick={() => setMes(sumarMeses(mes, 1))} aria-label="Mes siguiente"><ChevronRightRoundedIcon /></button>
        </div>
        {locales.length > 1 && (
          <div className={c.chips} role="group" aria-label="Local">
            <button type="button" className={c.chip} aria-pressed={balde == null} onClick={() => setBalde(null)}>Empresa</button>
            {locales.map((l) => (
              <button key={l.id} type="button" className={c.chip} aria-pressed={balde === l.id} onClick={() => setBalde(l.id)}>{l.nombre}</button>
            ))}
          </div>
        )}

        {error && !data && <div className={c.aviso} data-tono="error"><WarningAmberRoundedIcon /><span>{error}</span></div>}
        {!data && !error && <div className={c.centro}><span className={c.nota}>Calculando el mes…</span></div>}

        {col && (
          <>
            <div className={c.hero}>
              <div className={c.heroCuerpo}>
                <span className={c.heroLabel}>{esEmpresa ? 'Resultado neto' : 'Resultado antes de Ganancias'}{mes === hoy ? ' · hasta hoy' : ''}</span>
                <span className={c.heroMonto} data-negativo={resultado < 0 ? 'true' : undefined}>{pesosRedondo(resultado)}</span>
                <span className={c.heroSub}>
                  Ventas netas {pesosRedondo(col.ventasNetas)}
                  {varVentas != null ? ` · ${varVentas >= 0 ? '▲' : '▼'} ${pct(Math.abs(varVentas), 0)} vs mes anterior` : ''}
                </span>
              </div>
            </div>

            <div className={c.tiles}>
              <div className={c.tile}><span>Margen bruto</span><strong>{pct(ind.margenBrutoPct)}</strong><small>{pesosRedondo(col.margenBruto)}</small></div>
              <div className={c.tile}><span>Contribución</span><strong>{pct(ind.contribucionPct)}</strong><small>{pesosRedondo(col.contribucion)}</small></div>
              <div className={c.tile}>
                <span>Punto de equilibrio</span>
                <strong>{ind.sinEquilibrio ? 'No se alcanza' : ind.equilibrio == null ? '—' : pesosRedondo(ind.equilibrio)}</strong>
                <small>{ind.sinEquilibrio ? 'la contribución no cubre los fijos' : ind.margenSeguridadPct == null ? 'ventas que cubren los fijos' : ind.margenSeguridadPct >= 0 ? `${pct(ind.margenSeguridadPct, 0)} por encima` : `faltan ${pesosRedondo(ind.equilibrio - col.ventasNetas)}`}</small>
              </div>
              <div className={c.tile}>
                <span>Objetivo de ventas</span>
                <strong>{obj?.ventaNeta != null ? pct(cumplimiento(col.ventasNetas, obj.ventaNeta), 0) : '—'}</strong>
                <small>{obj?.ventaNeta != null ? `de ${pesosRedondo(obj.ventaNeta)}` : 'sin objetivo cargado'}</small>
              </div>
            </div>

            {(data.avisos ?? []).filter((a) => a.tono === 'warn').map((a, i) => (
              <div key={i} className={c.aviso}><WarningAmberRoundedIcon /><span>{a.texto}</span></div>
            ))}

            <section className={c.seccion}>
              <div className={c.seccionHead}><h2>Estado de resultados</h2></div>
              <div className={cx(c.card, c.lista)}>
                {filas.map((f) => {
                  const v = f.valores[0];
                  const p = f.id === 'ventasNetas' ? null : sobreVentas(v, col);
                  const origen = f.origen ? textoOrigen(origenDe(data, [mes], f.origen), f.origen) : '';
                  const contenido = (
                    <>
                      <span className={c.filaTexto}>
                        <strong style={{ fontWeight: f.sub ? 800 : 500 }}>{f.abrible ? (f.abierto ? '▾ ' : '▸ ') : ''}{f.texto}</strong>
                        {(origen || (p != null && Math.abs(v) >= 0.005 && f.id !== 'ventasLista')) && <small>{[p != null && Math.abs(v) >= 0.005 && f.id !== 'ventasLista' ? pct(p) : '', origen].filter(Boolean).join(' · ')}</small>}
                      </span>
                      <span style={{ fontWeight: f.sub ? 800 : 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: f.sub && v < 0 ? 'var(--crm-color-danger)' : undefined }}>{pesosRedondo(v)}</span>
                    </>
                  );
                  const estilo = { ...(f.detalle ? { paddingLeft: 28, fontSize: 14, color: 'var(--crm-color-text-secondary)' } : {}), ...(f.final ? { background: 'var(--crm-color-primary-soft)' } : {}) };
                  return f.abrible
                    ? <button key={f.id} type="button" className={c.fila} style={estilo} onClick={() => alternar(f.id)} aria-expanded={f.abierto}>{contenido}</button>
                    : <div key={f.id} className={c.fila} style={estilo}>{contenido}</div>;
                })}
              </div>
            </section>

            {esEmpresa && ivaMes && (
              <section className={c.seccion}>
                <div className={c.seccionHead}><h2>IVA (aparte)</h2></div>
                <div className={cx(c.card, c.numeros)}>
                  <div><span>A pagar</span><strong>{pesosRedondo(ivaMes.aPagar)}</strong></div>
                  <div><span>Saldo a favor</span><strong>{pesosRedondo(ivaMes.saldoAFavor)}</strong></div>
                  <div><span>De gestión</span><strong>{pesosRedondo(ivaMes.sinFactura)}</strong></div>
                </div>
                <p className={c.nota}>«De gestión»: el IVA de lo vendido sin factura, que queda en la casa. Con él, el mes deja {pesosRedondo(col.neto + ivaMes.sinFactura)}.</p>
              </section>
            )}
            <p className={c.nota}>
              Todo en neto, sin IVA. Ganancias es un estimado por lo acumulado del año. La configuración y los objetivos se cargan en la computadora: Gerencia › Resultados.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
