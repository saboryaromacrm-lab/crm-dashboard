/**
 * CASH FLOW EN EL CELULAR — erp.saboryaroma.com/cashflow (7/10/2026, pedido del dueño)
 * ============================================================================
 * El dueño usa el Cash Flow sobre todo desde el teléfono: esta es una pantalla
 * propia, sin el menú del ERP, con su dirección para guardarla como acceso
 * directo (o instalarla como app aparte: ver el manifiesto que se cambia acá
 * abajo, `public/manifest-cashflow.json`).
 *
 * LA PLATA SE MUEVE CON LAS MISMAS VENTANAS DEL PANEL DE GERENCIA (contar,
 * sobre a ciegas, ingreso/egreso, pago a proveedor, anular, arranque): mismas
 * reglas, misma doble confirmación con candado. Esta pantalla solo ordena la
 * información para el dedo:
 *   · el efectivo en mano arriba, grande, y lo que está en tránsito;
 *   · las 4 acciones de todos los días a un toque;
 *   · listas en tarjetas (nada de tablas anchas), agrupadas por día;
 *   · pestañas abajo, al alcance del pulgar, con el número de sobres;
 *   · ventanas a pantalla completa (ModalModo) y el botón «atrás» del
 *     teléfono las cierra en vez de salir de la pantalla;
 *   · al volver a la app (otra pestaña, el celular bloqueado) se actualiza sola.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RefreshIcon from '@mui/icons-material/Refresh';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import CalculateOutlinedIcon from '@mui/icons-material/CalculateOutlined';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import IosShareRoundedIcon from '@mui/icons-material/IosShareRounded';
import { httpClient } from '@core/services/httpClient.js';
import { useAuth } from '@core/auth/AuthContext.jsx';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { esAppInstalada, plataforma } from '@core/pwa/app.js';
import { useResource } from '@modules/ventas/hooks/useResource.js';
import { errorMsg } from '@modules/ventas/services/ventas.api.js';
import { money } from '@modules/productos/domain/format.js';
import { ModalShell } from '@modules/productos/components/Modal.jsx';
import { ModalModo } from '@modules/productos/components/modalModo.js';
import { descargarCsv, csvNum } from '@shared/utils/csv.js';
import { cx } from '@shared/utils/classNames.js';
import { ColumnasMulti } from '../metricas/graficos.jsx';
import { iso } from '../metricas/formato.js';
import {
  AnularModal, Arranque, ConteoModal, MovimientoModal, PagoProveedorModal, SobreModal, SobreVer,
} from './CashFlowPanel.jsx';
import {
  ANULABLES, ORIGEN, diasDesde, etiquetaPeriodo, fechaCorta, fechaHora, fechaIso, horaCorta, hoy,
  primerDiaMes, queEs, textoAnular, tituloPeriodo,
} from './formato.js';
import { CajasAControlar } from './CajasAControlar.jsx';
import c from './CashFlowMovil.module.css';

const MODO_MOVIL = { movil: true };
const PESTANAS = [
  { id: 'inicio', label: 'Inicio', Icono: HomeOutlinedIcon },
  { id: 'sobres', label: 'Sobres', Icono: EmailOutlinedIcon },
  { id: 'movimientos', label: 'Movimientos', Icono: SwapVertIcon },
  { id: 'reportes', label: 'Reportes', Icono: BarChartRoundedIcon },
  { id: 'conceptos', label: 'Conceptos', Icono: CategoryOutlinedIcon },
];
const CLAVE_PESTANA = 'erp.cashflow.movil.pestana';
const leerPestana = () => {
  try { const v = sessionStorage.getItem(CLAVE_PESTANA); return PESTANAS.some((p) => p.id === v) ? v : 'inicio'; } catch { return 'inicio'; }
};

/* ---------- formatos chicos ---------- */
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const ayer = () => { const d = new Date(); d.setDate(d.getDate() - 1); return iso(d); };
const nombreDia = (k) => {
  if (k === hoy()) return 'Hoy';
  if (k === ayer()) return 'Ayer';
  const t = new Date(`${k}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'numeric' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
/** «hoy 21:05», «ayer 9:40», «sáb 4/10 21:40»: en el celular la fecha entera no entra. */
const cuando = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  const k = iso(d);
  const h = horaCorta(v);
  if (k === hoy()) return `hoy ${h}`;
  if (k === ayer()) return `ayer ${h}`;
  const dia = d.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '');
  return `${dia} ${d.getDate()}/${d.getMonth() + 1}${d.getFullYear() !== new Date().getFullYear() ? `/${d.getFullYear()}` : ''} ${h}`;
};
const MESES_LARGOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
/** Para los totales chicos: sin «,00» cuando no hay centavos (así entran tres por renglón). */
const moneyCorto = (v) => money(v).replace(/,00$/, '');
/** «$ 12.345» grande y «,67» chico: en el número que más se mira, los centavos molestan. */
function Monto({ v }) {
  const [ent, dec] = money(v).split(',');
  return <>{ent}<small>,{dec ?? '00'}</small></>;
}
function Dif({ v }) {
  const n = Number(v) || 0;
  if (Math.abs(n) < 0.009) return <span className={c.pill}>sin diferencia</span>;
  return <span className={c.pill} data-tono={n < 0 ? 'rojo' : 'verde'}>{n > 0 ? 'sobran ' : 'faltan '}{money(Math.abs(n))}</span>;
}

/* ==================================================================== *
 * Piezas
 * ==================================================================== */
function Aviso({ tono, children }) {
  return (
    <div className={c.aviso} data-tono={tono} role={tono === 'error' ? 'alert' : undefined}>
      <WarningAmberRoundedIcon fontSize="small" />
      <div>{children}</div>
    </div>
  );
}

function Seccion({ titulo, accion, children }) {
  return (
    <section className={c.seccion}>
      <div className={c.seccionHead}>
        <h2>{titulo}</h2>
        {accion}
      </div>
      {children}
    </section>
  );
}

function FilaMovimiento({ m, onClick, conFecha }) {
  const anulado = !!m.anuladoEn;
  const extra = [conFecha ? cuando(m.fecha) : horaCorta(m.fecha), m.usuario, m.detalle].filter(Boolean).join(' · ');
  return (
    <button type="button" className={cx(c.fila, anulado && c.anulado)} onClick={() => onClick(m)}>
      <span className={c.filaIcono} data-tipo={m.tipo} aria-hidden>
        {m.tipo === 'ingreso' ? <ArrowDownwardRoundedIcon fontSize="small" /> : <ArrowUpwardRoundedIcon fontSize="small" />}
      </span>
      <span className={c.filaTexto}>
        <strong>{queEs(m)}</strong>
        <small>{anulado ? `Anulado · ${m.anuladoMotivo || ''}` : extra}</small>
      </span>
      <span className={cx(c.filaImporte, m.tipo === 'ingreso' ? c.ingreso : c.egreso)}>
        {m.tipo === 'ingreso' ? '+' : '−'}{money(m.importe)}
        {m.origen === 'sobre' && m.sobreDiferencia != null && Math.abs(m.sobreDiferencia) > 0.009 && (
          <small>{m.sobreDiferencia < 0 ? 'faltó ' : 'sobró '}{money(Math.abs(m.sobreDiferencia))}</small>
        )}
      </span>
    </button>
  );
}

function TarjetaSobre({ x, pendiente, abrir }) {
  const dias = diasDesde(x.cierre);
  return (
    <article className={cx(c.card, c.sobre)}>
      <div className={c.sobreHead}>
        <strong>{x.sucursal}</strong>
        {pendiente
          ? <span className={c.pill} data-tono={dias >= 3 ? 'rojo' : dias >= 1 ? 'naranja' : undefined}>{dias === 0 ? 'de hoy' : `hace ${plural(dias, 'día', 'días')}`}</span>
          : x.descartado ? <span className={c.pill}>No corresponde</span> : <Dif v={x.diferencia} />}
      </div>
      <div className={c.sobreMeta}>
        Cerró {cuando(x.cierre)} · armó el sobre {x.cajero || 'sin cajero'}
        {x.pagosLocal > 0 && <><br />El local pagó {money(x.pagosLocal)} en ese turno (no resta de tu caja)</>}
        {!pendiente && <><br />Lo resolvió {x.controladoPor || '—'} {cuando(x.controladoEn)}</>}
      </div>
      <div className={c.sobreMonto}>
        <span>{pendiente ? 'Dice el sobre' : x.descartado ? 'Decía el sobre' : 'Contaste'}</span>
        <strong>{money(pendiente || x.descartado ? x.enviado : x.contado)}</strong>
      </div>
      <div className={c.botones}>
        {pendiente ? (
          <>
            <button type="button" className={c.btn} onClick={() => abrir({ tipo: 'descartar', sobre: x })}>No corresponde</button>
            <button type="button" className={cx(c.btn, c.btnPrimario)} onClick={() => abrir({ tipo: 'sobre', sobre: x })}>Controlar</button>
          </>
        ) : (
          <>
            <button type="button" className={cx(c.btn, c.btnPeligro)} onClick={() => abrir({ tipo: 'deshacer', sobre: x })}>Deshacer</button>
            <button type="button" className={c.btn} onClick={() => abrir({ tipo: 'sobreVer', sobre: x })}>Ver detalle</button>
          </>
        )}
      </div>
    </article>
  );
}

/* ==================================================================== *
 * Inicio
 * ==================================================================== */
function Inicio({ d, abrir, irA, actualizado, version, bump, avisar }) {
  const negativo = d.saldo < -0.009;
  const pend = d.enTransito.sobres;
  const { data: sobresPend } = useResource(`cfm:inicio-sobres:${pend}:${d.enTransito.total}:${version}`, () => httpClient.get('/cashflow/sobres?estado=pendientes'), { enabled: pend > 0 });
  const mes = `${MESES_LARGOS[Number(d.mes.periodo.slice(5, 7)) - 1] ?? ''} ${d.mes.periodo.slice(0, 4)}`;
  return (
    <>
      <div className={c.hero}>
        <div className={c.heroCuerpo}>
          <span className={c.heroLabel}>Efectivo en mano</span>
          <span className={c.heroMonto} data-negativo={negativo}><Monto v={d.saldo} /></span>
          <span className={c.heroSub}>{negativo ? 'Quedó en negativo: revisá los movimientos' : `Actualizado a las ${horaCorta(actualizado)}`}</span>
        </div>
        <button type="button" className={c.heroPie} onClick={() => irA('sobres')} disabled={!pend}>
          <span>
            En tránsito
            <strong>{money(d.enTransito.total)}</strong>
          </span>
          <span style={{ textAlign: 'right' }}>
            {pend ? plural(pend, 'sobre sin controlar', 'sobres sin controlar') : 'Ningún sobre pendiente'}
          </span>
          {pend > 0 && <ChevronRightRoundedIcon />}
        </button>
      </div>

      {d.cajasAbiertas?.length > 0 && (
        <Aviso>
          <strong>Caja abierta hace más de 24 horas:</strong>{' '}
          {d.cajasAbiertas.map((x) => `${x.sucursal} (${x.usuario || 'sin usuario'}, ${x.horas} h)`).join(' · ')}. Hasta que cierren, ese sobre no llega.
        </Aviso>
      )}

      <div className={c.acciones}>
        <button type="button" className={c.accion} onClick={() => abrir({ tipo: 'conteo' })}>
          <span className={c.accionIcono} data-tono="verde"><CalculateOutlinedIcon /></span>
          Contar mi caja<small>billete por billete</small>
        </button>
        <button type="button" className={c.accion} onClick={() => abrir({ tipo: 'egreso' })}>
          <span className={c.accionIcono} data-tono="rojo"><ArrowUpwardRoundedIcon /></span>
          Sacar plata<small>retiro, depósito, gasto</small>
        </button>
        <button type="button" className={c.accion} onClick={() => abrir({ tipo: 'ingreso' })}>
          <span className={c.accionIcono} data-tono="azul"><ArrowDownwardRoundedIcon /></span>
          Entró plata<small>aparte de los sobres</small>
        </button>
        <button type="button" className={c.accion} onClick={() => abrir({ tipo: 'pago' })}>
          <span className={c.accionIcono} data-tono="naranja"><StorefrontOutlinedIcon /></span>
          Pagar a proveedor<small>a sus facturas</small>
        </button>
      </div>

      {pend > 0 && (
        <Seccion titulo="Sobres por controlar" accion={<button type="button" className={c.link} onClick={() => irA('sobres')}>Ver {pend > 2 ? `los ${pend}` : 'todos'}</button>}>
          {(sobresPend ?? []).slice(0, 2).map((x) => <TarjetaSobre key={x.cajaSesionId} x={x} pendiente abrir={abrir} />)}
          {!sobresPend && <div className={cx(c.card, c.vacio)}>Cargando los sobres…</div>}
        </Seccion>
      )}

      {d.aControlar > 0 && (
        <Seccion titulo={`Cajas a controlar (${d.aControlar})`}>
          <CajasAControlar version={version} bump={bump} avisar={avisar} compacto />
        </Seccion>
      )}

      <Seccion titulo={mes}>
        <div className={cx(c.card, c.numeros)}>
          <div><span>Ingresos</span><strong className={c.ingreso}>{moneyCorto(d.mes.ingresos)}</strong></div>
          <div><span>Egresos</span><strong className={c.egreso}>{moneyCorto(d.mes.egresos)}</strong></div>
          <div><span>Neto</span><strong>{moneyCorto(d.mes.ingresos - d.mes.egresos)}</strong></div>
        </div>
      </Seccion>

      <Seccion titulo="Últimos movimientos" accion={<button type="button" className={c.link} onClick={() => irA('movimientos')}>Ver todos</button>}>
        <div className={cx(c.card, c.lista)}>
          {(d.ultimos ?? []).length
            ? d.ultimos.map((m) => <FilaMovimiento key={m.id} m={m} conFecha onClick={(x) => abrir({ tipo: 'mov', m: x })} />)
            : <div className={c.vacio}>Todavía no hay movimientos.</div>}
        </div>
      </Seccion>

      <Seccion titulo="Últimos conteos" accion={<button type="button" className={c.link} onClick={() => abrir({ tipo: 'conteo' })}>Contar</button>}>
        <div className={cx(c.card, c.lista)}>
          {(d.conteos ?? []).length ? d.conteos.map((x) => (
            <div key={x.id} className={c.fila}>
              <span className={c.filaTexto}>
                <strong>{cuando(x.fecha)}</strong>
                <small>
                  Contaste {money(x.contado)} · el libro decía {money(x.esperado)}
                  {Math.abs(x.diferencia) >= 0.009 ? (x.ajustado ? ' · ajustado' : ' · sin ajustar') : ''}
                </small>
              </span>
              <Dif v={x.diferencia} />
            </div>
          )) : <div className={c.vacio}>Todavía no contaste tu caja.</div>}
        </div>
      </Seccion>

      <Seccion titulo="Arranque">
        <div className={cx(c.card, c.fila)}>
          <span className={c.filaTexto}>
            <strong>Desde el {fechaIso(d.caja.fechaInicio)}</strong>
            <small>con {money(d.caja.saldoInicial)} en mano</small>
          </span>
          <button type="button" className={c.link} onClick={() => abrir({ tipo: 'arranque' })}>Cambiar</button>
        </div>
      </Seccion>
    </>
  );
}

/* ==================================================================== *
 * Sobres
 * ==================================================================== */
const TOPE_SOBRES = 300;

function Sobres({ f, setF, version, abrir, pendientes: nPend }) {
  const { data: sucursales } = useResource('cfm:sucursales', () => httpClient.get('/sucursales'));
  const qs = `estado=${f.estado}${f.sucursalId ? `&sucursalId=${f.sucursalId}` : ''}${f.desde ? `&desde=${f.desde}` : ''}${f.hasta ? `&hasta=${f.hasta}` : ''}`;
  const { data, loading, error } = useResource(`cfm:sobres:${qs}:${version}`, () => httpClient.get(`/cashflow/sobres?${qs}`));
  const filas = data ?? [];
  const pend = f.estado === 'pendientes';
  const total = filas.reduce((a, x) => a + (pend ? x.enviado : x.descartado ? 0 : x.contado), 0);
  const filtrando = !!(f.sucursalId || f.desde || f.hasta);
  return (
    <>
      <div className={c.seg} role="group" aria-label="Qué sobres">
        <button type="button" aria-pressed={pend} onClick={() => setF({ ...f, estado: 'pendientes' })}>Sin controlar{nPend ? ` (${nPend})` : ''}</button>
        <button type="button" aria-pressed={!pend} onClick={() => setF({ ...f, estado: 'controlados' })}>Resueltos</button>
      </div>
      <div className={c.campos}>
        <label className={c.campo}>
          <span>Local</span>
          <select value={f.sucursalId} onChange={(e) => setF({ ...f, sucursalId: e.target.value })}>
            <option value="">Todos</option>
            {(sucursales ?? []).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </select>
        </label>
        <div className={c.campo}>
          <span>Fechas</span>
          <button type="button" className={c.btn} onClick={() => setF({ ...f, verFechas: !f.verFechas })} aria-expanded={!!f.verFechas}>
            {f.desde || f.hasta ? `${f.desde ? fechaIso(f.desde) : '…'} – ${f.hasta ? fechaIso(f.hasta) : '…'}` : 'Elegir'}
          </button>
        </div>
      </div>
      {f.verFechas && (
        <div className={c.campos}>
          <label className={c.campo}><span>Desde</span><input type="date" value={f.desde} max={f.hasta || hoy()} onChange={(e) => setF({ ...f, desde: e.target.value })} /></label>
          <label className={c.campo}><span>Hasta</span><input type="date" value={f.hasta} min={f.desde || undefined} max={hoy()} onChange={(e) => setF({ ...f, hasta: e.target.value })} /></label>
        </div>
      )}
      <div className={c.resumenLinea}>
        <span>{plural(filas.length, 'sobre', 'sobres')} · <strong>{money(total)}</strong></span>
        {filtrando && <button type="button" className={c.link} onClick={() => setF({ ...f, sucursalId: '', desde: '', hasta: '', verFechas: false })}>Quitar filtros</button>}
      </div>
      {filas.length >= TOPE_SOBRES && <Aviso>Se muestran los {TOPE_SOBRES} más recientes: elegí un local o acotá las fechas.</Aviso>}
      {error && <Aviso tono="error">{error}</Aviso>}
      {loading && !data ? <div className={cx(c.card, c.vacio)}>Cargando…</div> : !filas.length ? (
        <div className={cx(c.card, c.vacio)}>{pend ? 'No hay sobres sin controlar. ✓' : 'No hay sobres resueltos con este filtro.'}</div>
      ) : filas.map((x) => <TarjetaSobre key={x.cajaSesionId} x={x} pendiente={pend} abrir={abrir} />)}
    </>
  );
}

/* ==================================================================== *
 * Movimientos
 * ==================================================================== */
function Movimientos({ f, setF, version, abrir }) {
  const qs = `${f.tipo ? `tipo=${f.tipo}&` : ''}${f.desde ? `desde=${f.desde}&` : ''}${f.hasta ? `hasta=${f.hasta}&` : ''}${f.anulados ? 'anulados=1&' : ''}`;
  const { data, loading, error } = useResource(`cfm:mov:${qs}:${version}`, () => httpClient.get(`/cashflow/movimientos?${qs}`));
  const filas = useMemo(() => data ?? [], [data]);
  const vivos = filas.filter((m) => !m.anuladoEn);
  const ingresos = vivos.filter((m) => m.tipo === 'ingreso').reduce((a, m) => a + m.importe, 0);
  const egresos = vivos.filter((m) => m.tipo === 'egreso').reduce((a, m) => a + m.importe, 0);
  /* Agrupados por día (el servidor los manda del más nuevo al más viejo). */
  const dias = useMemo(() => {
    const g = [];
    for (const m of filas) {
      const k = iso(new Date(m.fecha));
      if (!g.length || g[g.length - 1].k !== k) g.push({ k, filas: [], neto: 0 });
      const dia = g[g.length - 1];
      dia.filas.push(m);
      if (!m.anuladoEn) dia.neto += m.tipo === 'ingreso' ? m.importe : -m.importe;
    }
    return g;
  }, [filas]);
  const filtrando = !!(f.desde || f.hasta || f.anulados);
  return (
    <>
      <div className={c.seg} role="group" aria-label="Tipo de movimiento">
        {[['', 'Todos'], ['ingreso', 'Ingresos'], ['egreso', 'Egresos']].map(([v, l]) => (
          <button key={v} type="button" aria-pressed={f.tipo === v} onClick={() => setF({ ...f, tipo: v })}>{l}</button>
        ))}
      </div>
      <div className={c.chips} data-envolver>
        <button type="button" className={c.chip} aria-pressed={!!f.verFiltros} onClick={() => setF({ ...f, verFiltros: !f.verFiltros })}>
          {f.desde || f.hasta ? `${f.desde ? fechaIso(f.desde) : '…'} – ${f.hasta ? fechaIso(f.hasta) : '…'}` : 'Elegir fechas'}
        </button>
        <button type="button" className={c.chip} aria-pressed={!!f.anulados} onClick={() => setF({ ...f, anulados: !f.anulados })}>Ver anulados</button>
        {filtrando && <button type="button" className={c.chip} onClick={() => setF({ ...f, desde: '', hasta: '', anulados: false, verFiltros: false })}>Quitar filtros</button>}
      </div>
      {f.verFiltros && (
        <div className={c.campos}>
          <label className={c.campo}><span>Desde</span><input type="date" value={f.desde} max={f.hasta || hoy()} onChange={(e) => setF({ ...f, desde: e.target.value })} /></label>
          <label className={c.campo}><span>Hasta</span><input type="date" value={f.hasta} min={f.desde || undefined} max={hoy()} onChange={(e) => setF({ ...f, hasta: e.target.value })} /></label>
        </div>
      )}
      <div className={cx(c.card, c.numeros)}>
        <div><span>Ingresos</span><strong className={c.ingreso}>{moneyCorto(ingresos)}</strong></div>
        <div><span>Egresos</span><strong className={c.egreso}>{moneyCorto(egresos)}</strong></div>
        <div><span>Neto</span><strong>{moneyCorto(ingresos - egresos)}</strong></div>
      </div>
      {filas.length >= 500 && <Aviso>Se muestran los últimos 500: elegí fechas para ver los anteriores.</Aviso>}
      {error && <Aviso tono="error">{error}</Aviso>}
      {loading && !data ? <div className={cx(c.card, c.vacio)}>Cargando…</div> : !filas.length ? (
        <div className={cx(c.card, c.vacio)}>Sin movimientos con este filtro.</div>
      ) : (
        <div>
          {dias.map((g) => (
            <div key={g.k}>
              <div className={c.dia}><span>{nombreDia(g.k)}</span><span>{g.neto >= 0 ? '+' : '−'}{money(Math.abs(g.neto))}</span></div>
              <div className={cx(c.card, c.lista)}>
                {g.filas.map((m) => <FilaMovimiento key={m.id} m={m} onClick={(x) => abrir({ tipo: 'mov', m: x })} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/** El detalle de un movimiento, con «Anular» si se puede. */
function DetalleMovimiento({ m, onCerrar, onAnular }) {
  const anulable = !m.anuladoEn && ANULABLES.includes(m.origen);
  return (
    <ModalShell title={queEs(m)} subtitle={fechaHora(m.fecha)} onClose={onCerrar} footer={[
      { texto: 'Cerrar', onClick: onCerrar },
      ...(anulable ? [{ texto: 'Anular', clase: 'btn-delete', onClick: onAnular }] : []),
    ]}>
      <dl className={c.detalle}>
        <dt>Importe</dt>
        <dd className={m.tipo === 'ingreso' ? c.ingreso : c.egreso} style={{ fontSize: 20 }}>{m.tipo === 'ingreso' ? '+' : '−'}{money(m.importe)}</dd>
        <dt>Tipo</dt><dd>{m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} · {ORIGEN[m.origen] ?? m.origen}</dd>
        {m.detalle && <><dt>Detalle</dt><dd>{m.detalle}</dd></>}
        <dt>Lo cargó</dt><dd>{m.usuario || '—'}</dd>
        {m.origen === 'sobre' && m.sobreDiferencia != null && Math.abs(m.sobreDiferencia) > 0.009 && (
          <><dt>Diferencia del sobre</dt><dd><Dif v={m.sobreDiferencia} /></dd></>
        )}
        {m.anuladoEn && (
          <><dt>Anulado</dt><dd>{m.anuladoPor || '—'} · {fechaHora(m.anuladoEn)}</dd><dt>Motivo</dt><dd>{m.anuladoMotivo || '—'}</dd></>
        )}
      </dl>
      {!m.anuladoEn && !anulable && (
        <p className={c.nota}>
          {m.origen === 'sobre' ? 'Un sobre se deshace desde la pestaña Sobres › Resueltos.' : m.origen === 'saldo_inicial' ? 'El saldo inicial se cambia desde «Arranque», en Inicio.' : 'Este movimiento no se anula desde acá.'}
        </p>
      )}
    </ModalShell>
  );
}

/* ==================================================================== *
 * Reportes
 * ==================================================================== */
function Reportes({ f, setF, version, avisar }) {
  const qs = `desde=${f.desde}&hasta=${f.hasta}`;
  const { data: d, loading, error } = useResource(`cfm:reporte:${qs}:${version}`, () => httpClient.get(`/cashflow/reporte?${qs}`));
  const [bajando, setBajando] = useState(false);
  const preset = (k) => {
    const h = new Date();
    if (k === 'mes') setF({ ...f, k, desde: primerDiaMes(), hasta: hoy() });
    if (k === 'mes-pasado') setF({ ...f, k, desde: iso(new Date(h.getFullYear(), h.getMonth() - 1, 1)), hasta: iso(new Date(h.getFullYear(), h.getMonth(), 0)) });
    if (k === 'anio') setF({ ...f, k, desde: iso(new Date(h.getFullYear(), 0, 1)), hasta: hoy() });
    if (k === 'fechas') setF({ ...f, k });
  };
  const exportar = async () => {
    if (bajando) return;
    setBajando(true);
    try {
      const movs = await httpClient.get(`/cashflow/movimientos?${qs}&limite=2000&anulados=1`);
      descargarCsv(`cash-flow-${f.desde}-${f.hasta}.csv`,
        ['Fecha', 'Tipo', 'Qué', 'Detalle', 'Quién', 'Ingreso', 'Egreso', 'Anulado', 'Motivo anulación'],
        (movs ?? []).map((m) => [fechaHora(m.fecha), m.tipo, queEs(m), m.detalle || '', m.usuario || '', m.tipo === 'ingreso' ? csvNum(m.importe) : '', m.tipo === 'egreso' ? csvNum(m.importe) : '', m.anuladoEn ? 'Sí' : '', m.anuladoMotivo || '']));
    } catch (e) { avisar('error', errorMsg(e)); } finally { setBajando(false); }
  };
  const nombre = (x) => (x.origen === 'concepto' || x.origen === 'gasto' ? x.concepto : ORIGEN[x.origen] ?? x.origen);
  return (
    <>
      <div className={c.chips} data-envolver>
        {[['mes', 'Este mes'], ['mes-pasado', 'Mes pasado'], ['anio', 'Este año'], ['fechas', 'Otras fechas']].map(([k, l]) => (
          <button key={k} type="button" className={c.chip} aria-pressed={f.k === k} onClick={() => preset(k)}>{l}</button>
        ))}
      </div>
      {f.k === 'fechas' && (
        <div className={c.campos}>
          <label className={c.campo}><span>Desde</span><input type="date" value={f.desde} max={f.hasta} onChange={(e) => e.target.value && setF({ ...f, desde: e.target.value })} /></label>
          <label className={c.campo}><span>Hasta</span><input type="date" value={f.hasta} min={f.desde} max={hoy()} onChange={(e) => e.target.value && setF({ ...f, hasta: e.target.value })} /></label>
        </div>
      )}
      {error && <Aviso tono="error">{error}</Aviso>}
      {loading && !d ? <div className={cx(c.card, c.vacio)}>Cargando…</div> : !d ? null : (
        <>
          <div className={c.resumenLinea}><span>Del <strong>{fechaIso(d.desde)}</strong> al <strong>{fechaIso(d.hasta)}</strong></span><span>{plural(d.movimientos, 'movimiento', 'movimientos')}</span></div>
          <div className={c.tiles}>
            <div className={c.tile}><span>Efectivo al inicio</span><strong>{money(d.saldoInicio)}</strong><small>antes del primer movimiento</small></div>
            <div className={c.tile}><span>Efectivo al fin</span><strong className={d.saldoFin < -0.009 ? c.egreso : undefined}>{money(d.saldoFin)}</strong><small>al {fechaIso(d.hasta)}</small></div>
            <div className={c.tile}><span>Ingresos</span><strong className={c.ingreso}>{money(d.ingresos)}</strong><small>{d.saldoInicial > 0 ? `+ ${money(d.saldoInicial)} del arranque` : 'sobres y otros'}</small></div>
            <div className={c.tile}><span>Egresos</span><strong className={c.egreso}>{money(d.egresos)}</strong><small>lo que salió</small></div>
          </div>
          {d.serie.length > 1 && (
            <div className={c.card} style={{ padding: '12px 12px 6px' }}>
              <ColumnasMulti
                titulo={`Ingresos y egresos por ${d.paso}`}
                alto={200}
                series={[{ nombre: 'Ingresos', color: 'var(--crm-color-primary)' }, { nombre: 'Egresos', color: '#dc2626' }]}
                datos={d.serie.map((x) => ({ etiqueta: etiquetaPeriodo(x.periodo, d.paso), titulo: tituloPeriodo(x.periodo, d.paso), valores: [x.ingresos, x.egresos] }))}
                formato={money}
              />
            </div>
          )}
          <Seccion titulo="Por concepto">
            <div className={cx(c.card, c.lista)}>
              {d.porConcepto.length ? d.porConcepto.map((x, i) => (
                <div key={i} className={c.fila}>
                  <span className={c.filaIcono} data-tipo={x.tipo} aria-hidden>{x.tipo === 'ingreso' ? <ArrowDownwardRoundedIcon fontSize="small" /> : <ArrowUpwardRoundedIcon fontSize="small" />}</span>
                  <span className={c.filaTexto}><strong>{nombre(x)}</strong><small>{plural(x.cantidad, 'movimiento', 'movimientos')}</small></span>
                  <span className={cx(c.filaImporte, x.tipo === 'ingreso' ? c.ingreso : c.egreso)}>{money(x.importe)}</span>
                </div>
              )) : <div className={c.vacio}>Sin movimientos en el período.</div>}
            </div>
          </Seccion>
          <Seccion titulo="Sobres por local">
            <div className={cx(c.card, c.lista)}>
              {d.sobresPorSucursal.length ? d.sobresPorSucursal.map((x) => (
                <div key={x.sucursalId} className={c.fila}>
                  <span className={c.filaTexto}>
                    <strong>{x.sucursal}</strong>
                    <small>
                      {plural(x.sobres, 'sobre', 'sobres')} · enviado {money(x.enviado)} · contado {money(x.contado)}
                      {x.controlados < x.sobres ? ` · ${x.sobres - x.controlados} sin controlar` : ''}
                      {x.descartados > 0 ? ` · ${x.descartados} no corresponde${x.descartados === 1 ? '' : 'n'}` : ''}
                    </small>
                  </span>
                  <Dif v={x.diferencia} />
                </div>
              )) : <div className={c.vacio}>Sin sobres en el período.</div>}
            </div>
            <p className={c.nota}>Por fecha de cierre del local. En «Ingresos» el sobre cuenta el día que lo controlaste.</p>
          </Seccion>
          <Seccion titulo="Diferencias por cajero">
            <div className={cx(c.card, c.lista)}>
              {d.porCajero.length ? d.porCajero.map((x) => (
                <div key={x.usuarioId ?? x.cajero} className={c.fila}>
                  <span className={c.filaTexto}>
                    <strong>{x.cajero}</strong>
                    <small>{plural(x.sobres, 'sobre', 'sobres')} · {x.conDiferencia} con diferencia · faltó {money(Math.abs(x.faltantes))} · sobró {money(Math.abs(x.sobrantes))}</small>
                  </span>
                  <Dif v={x.diferencia} />
                </div>
              )) : <div className={c.vacio}>Sin sobres controlados en el período.</div>}
            </div>
          </Seccion>
          <button type="button" className={cx(c.btn, c.btnAncho)} onClick={exportar} disabled={bajando || !d.movimientos}>{bajando ? 'Preparando…' : 'Descargar los movimientos (CSV)'}</button>
        </>
      )}
    </>
  );
}

/* ==================================================================== *
 * Conceptos
 * ==================================================================== */
function Conceptos({ conceptos, abrir, cambiarActivo, ocupado }) {
  const grupos = [['egreso', 'Egresos · plata que sacás'], ['ingreso', 'Ingresos · aparte de los sobres']];
  return (
    <>
      <button type="button" className={cx(c.btn, c.btnPrimario, c.btnAncho)} onClick={() => abrir({ tipo: 'conceptoNuevo' })}><AddRoundedIcon /> Nuevo concepto</button>
      <p className={c.nota}>El concepto es el motivo del movimiento. «Movimiento de plata» (retiro, depósito) no es gasto; «Gasto» se carga también en Gastos, en su rubro. Tocá uno para renombrarlo.</p>
      {grupos.map(([t, titulo]) => {
        const lista = conceptos.filter((x) => x.tipo === t);
        return (
          <Seccion key={t} titulo={titulo}>
            <div className={cx(c.card, c.lista)}>
              {lista.length ? lista.map((x) => (
                <div key={x.id} className={c.fila} style={x.activo ? undefined : { opacity: 0.6 }}>
                  <button type="button" className={c.filaTexto} style={{ border: 0, background: 'none', padding: 0, font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer' }} onClick={() => abrir({ tipo: 'concepto', concepto: x })}>
                    <strong>{x.nombre}</strong>
                    <small>{x.clase === 'gasto' ? `Gasto · ${x.gastoCategoria || 'sin rubro'}` : t === 'egreso' ? 'Movimiento de plata' : 'Ingreso'} · {plural(x.usos, 'uso', 'usos')}</small>
                  </button>
                  <button type="button" role="switch" aria-checked={x.activo} aria-label={`${x.nombre}: ${x.activo ? 'activo' : 'desactivado'}`}
                    className={c.switch} disabled={ocupado === x.id} onClick={() => cambiarActivo(x)} />
                </div>
              )) : <div className={c.vacio}>Ninguno todavía.</div>}
            </div>
          </Seccion>
        );
      })}
    </>
  );
}

/** Crear o editar un concepto (nombre y, si es gasto, el rubro). */
function ConceptoForm({ concepto, onCerrar, onHecho, avisar }) {
  const { data: rubros } = useResource('cfm:rubros', () => httpClient.get('/cashflow/gasto-categorias'));
  const nuevo = !concepto;
  const [nombre, setNombre] = useState(concepto?.nombre ?? '');
  const [tipo, setTipo] = useState(concepto?.tipo ?? 'egreso');
  const [clase, setClase] = useState(concepto?.clase ?? 'movimiento');
  const [rubro, setRubro] = useState(concepto?.gastoCategoriaId ? String(concepto.gastoCategoriaId) : '');
  const [error, setError] = useState('');
  const enVuelo = useRef(false);
  const [guardando, setGuardando] = useState(false);
  const esGasto = tipo === 'egreso' && clase === 'gasto';
  const guardar = async () => {
    if (enVuelo.current) return;
    setError('');
    if (!nombre.trim()) { setError('Escribí el nombre del concepto.'); return; }
    if (esGasto && !rubro) { setError('Elegí el rubro de Gastos al que va este concepto.'); return; }
    enVuelo.current = true; setGuardando(true);
    try {
      if (nuevo) {
        await httpClient.post('/cashflow/conceptos', { nombre: nombre.trim(), tipo, clase: esGasto ? 'gasto' : 'movimiento', gastoCategoriaId: esGasto ? Number(rubro) : null });
        avisar('ok', `Concepto «${nombre.trim()}» creado.`);
      } else {
        const cambios = {};
        if (nombre.trim() !== concepto.nombre) cambios.nombre = nombre.trim();
        if (concepto.clase === 'gasto' && Number(rubro) !== concepto.gastoCategoriaId) cambios.gastoCategoriaId = rubro ? Number(rubro) : null;
        if (Object.keys(cambios).length) await httpClient.patch(`/cashflow/conceptos/${concepto.id}`, cambios);
        avisar('ok', 'Concepto guardado.');
      }
      onHecho();
    } catch (e) { setError(errorMsg(e)); } finally { enVuelo.current = false; setGuardando(false); }
  };
  return (
    <ModalShell title={nuevo ? 'Nuevo concepto' : 'Editar concepto'} onClose={onCerrar} footer={[
      { texto: 'Cancelar', onClick: onCerrar },
      { texto: guardando ? 'Guardando…' : nuevo ? 'Crear' : 'Guardar', clase: 'btn-primary', onClick: guardar, disabled: guardando },
    ]}>
      <div className={c.hoja}>
        <label className={c.campo}><span>Nombre</span><input value={nombre} maxLength={60} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Depósito en el banco" autoFocus={nuevo} /></label>
        {nuevo && (
          <div className={c.campo}>
            <span>Es un</span>
            <div className={c.seg} role="group" aria-label="Tipo">
              <button type="button" aria-pressed={tipo === 'egreso'} onClick={() => setTipo('egreso')}>Egreso</button>
              <button type="button" aria-pressed={tipo === 'ingreso'} onClick={() => setTipo('ingreso')}>Ingreso</button>
            </div>
          </div>
        )}
        {nuevo && tipo === 'egreso' && (
          <div className={c.campo}>
            <span>Qué es</span>
            <div className={c.seg} role="group" aria-label="Clase">
              <button type="button" aria-pressed={clase === 'movimiento'} onClick={() => setClase('movimiento')}>Movimiento de plata</button>
              <button type="button" aria-pressed={clase === 'gasto'} onClick={() => setClase('gasto')}>Gasto del negocio</button>
            </div>
          </div>
        )}
        {(nuevo ? esGasto : concepto.clase === 'gasto') && (
          <label className={c.campo}>
            <span>Rubro de Gastos</span>
            <select value={rubro} onChange={(e) => setRubro(e.target.value)}>
              <option value="">— Elegí —</option>
              {(rubros ?? []).map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </label>
        )}
        {error && <Aviso tono="error">{error}</Aviso>}
      </div>
    </ModalShell>
  );
}

/* ==================================================================== *
 * Menú e instalación
 * ==================================================================== */
function Menu({ onCerrar, irAlErp, salir, instalar, nombre }) {
  return (
    <ModalShell title="Cash Flow" subtitle={nombre ? `Entraste como ${nombre}` : undefined} onClose={onCerrar} footer={[{ texto: 'Cerrar', onClick: onCerrar }]}>
      <div className={c.hoja}>
        <button type="button" className={c.opcion} onClick={instalar}>
          <span className={c.accionIcono} data-tono="verde"><IosShareRoundedIcon /></span>
          <span>Tenerlo en la pantalla del celular<small>Un ícono que abre directo el Cash Flow</small></span>
        </button>
        <button type="button" className={c.opcion} onClick={irAlErp}>
          <span className={c.accionIcono} data-tono="azul"><OpenInNewRoundedIcon /></span>
          <span>Abrir el ERP completo<small>Con el menú de todas las secciones</small></span>
        </button>
        <button type="button" className={c.opcion} onClick={salir}>
          <span className={c.accionIcono} data-tono="rojo"><LogoutRoundedIcon /></span>
          <span>Cerrar sesión<small>La próxima vez pide usuario y contraseña</small></span>
        </button>
      </div>
    </ModalShell>
  );
}

function Instalar({ onCerrar }) {
  const p = plataforma();
  const instalada = esAppInstalada();
  return (
    <ModalShell title="Cash Flow en tu celular" onClose={onCerrar} footer={[{ texto: 'Listo', clase: 'btn-primary', onClick: onCerrar }]}>
      <div className={c.hoja}>
        {instalada ? (
          <p className={c.nota}>Ya lo estás usando como app: el ícono está en tu pantalla de inicio.</p>
        ) : p === 'ios' ? (
          <ol className={c.nota} style={{ paddingLeft: 18, margin: 0, display: 'grid', gap: 8 }}>
            <li>Abrí esta página en <strong>Safari</strong>.</li>
            <li>Tocá el botón <strong>Compartir</strong> (el cuadrado con la flecha hacia arriba).</li>
            <li>Elegí <strong>«Agregar a inicio»</strong> y confirmá con <strong>«Agregar»</strong>.</li>
          </ol>
        ) : (
          <ol className={c.nota} style={{ paddingLeft: 18, margin: 0, display: 'grid', gap: 8 }}>
            <li>Abrí esta página en <strong>Chrome</strong>.</li>
            <li>Tocá el menú <strong>⋮</strong> (arriba a la derecha).</li>
            <li>Elegí <strong>«Agregar a la pantalla principal»</strong> (o «Instalar app») y confirmá.</li>
          </ol>
        )}
        <p className={c.nota}>Queda un ícono <strong>«Cash Flow»</strong> que abre directo esta pantalla, sin el resto del ERP. La dirección es <strong>{window.location.host}/cashflow</strong>.</p>
      </div>
    </ModalShell>
  );
}

/* ==================================================================== *
 * La pantalla
 * ==================================================================== */
/**
 * Mientras esta pantalla está abierta, el «agregar a inicio» del celular
 * guarda el Cash Flow (su manifiesto, su ícono y su nombre) y no el ERP.
 */
function useIdentidadCashFlow() {
  useEffect(() => {
    const cambios = [
      ['link[rel="manifest"]', 'href', '/manifest-cashflow.json'],
      ['link[rel="apple-touch-icon"]', 'href', '/icons/cashflow-180.png'],
      ['meta[name="apple-mobile-web-app-title"]', 'content', 'Cash Flow'],
      ['meta[name="theme-color"]', 'content', '#0c3b22'],
    ];
    const antes = cambios.map(([sel, attr, valor]) => {
      const el = document.querySelector(sel);
      const previo = el?.getAttribute(attr) ?? null;
      el?.setAttribute(attr, valor);
      return [el, attr, previo];
    });
    const titulo = document.title;
    document.title = 'Cash Flow · Sabor y Aroma';
    return () => {
      antes.forEach(([el, attr, previo]) => { if (el && previo != null) el.setAttribute(attr, previo); });
      document.title = titulo;
    };
  }, []);
}

export function CashFlowMovil() {
  useIdentidadCashFlow();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { can } = usePermissions();
  const puede = can('gerencia.cashflow');

  const [pestana, setPestanaEstado] = useState(leerPestana);
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [ocupado, setOcupado] = useState(null);
  const [actualizado, setActualizado] = useState(() => new Date());
  const ultimaCarga = useRef(Date.now());

  /* Los filtros de cada pestaña viven acá: ir y volver no los pierde. */
  const [fSobres, setFSobres] = useState({ estado: 'pendientes', sucursalId: '', desde: '', hasta: '', verFechas: false });
  const [fMov, setFMov] = useState({ tipo: '', desde: '', hasta: '', anulados: false, verFiltros: false });
  const [fRep, setFRep] = useState(() => ({ k: 'mes', desde: primerDiaMes(), hasta: hoy() }));

  const { data: d, loading, error } = useResource(`cfm:resumen:${version}`, () => httpClient.get('/cashflow/resumen'), { enabled: puede });
  const { data: conceptos } = useResource(`cfm:conceptos:${version}`, () => httpClient.get('/cashflow/conceptos'), { enabled: puede });
  /* El último resumen bueno queda a la vista mientras se actualiza (sin parpadeo). */
  const ultimo = useRef(null);
  if (d) ultimo.current = d;
  const datos = d ?? ultimo.current;
  useEffect(() => { if (d) { setActualizado(new Date()); ultimaCarga.current = Date.now(); } }, [d]);

  const avisar = useCallback((tono, texto) => setToast({ tono, texto, id: Date.now() }), []);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), toast.tono === 'error' ? 9000 : 6000);
    return () => clearTimeout(t);
  }, [toast]);

  /* Al volver a la app (desbloquear el celular, cambiar de app) se actualiza sola. */
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === 'visible' && Date.now() - ultimaCarga.current > 30_000) bump();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [bump]);

  /*
   * EL BOTÓN «ATRÁS» DEL TELÉFONO CIERRA LA VENTANA ABIERTA. Al abrir la
   * primera se agrega UNA entrada al historial (con el mismo estado del router)
   * y se reusa para las siguientes; «atrás» la consume y cierra la ventana.
   */
  const guarda = useRef(false);
  const abrir = useCallback((m) => {
    if (!guarda.current) {
      window.history.pushState({ ...(window.history.state ?? {}), cashflowVentana: true }, '');
      guarda.current = true;
    }
    setModal(m);
  }, []);
  useEffect(() => {
    const alVolver = () => {
      if (!guarda.current) return;
      guarda.current = false;
      setModal(null);
    };
    window.addEventListener('popstate', alVolver);
    return () => window.removeEventListener('popstate', alVolver);
  }, []);
  const cerrar = useCallback(() => setModal(null), []);
  const hecho = useCallback(() => { setModal(null); bump(); }, [bump]);

  const irA = (id) => {
    setPestanaEstado(id);
    try { sessionStorage.setItem(CLAVE_PESTANA, id); } catch { /* sin storage */ }
    window.scrollTo({ top: 0 });
  };

  const cambiarActivo = async (x) => {
    if (ocupado) return;
    setOcupado(x.id);
    try {
      await httpClient.patch(`/cashflow/conceptos/${x.id}`, { activo: !x.activo });
      avisar('ok', x.activo ? `«${x.nombre}» desactivado: no se ofrece más, lo registrado queda.` : `«${x.nombre}» activado.`);
      bump();
    } catch (e) { avisar('error', errorMsg(e)); } finally { setOcupado(null); }
  };

  const salir = async () => {
    setModal(null);
    await logout();
    navigate('/login', { replace: true, state: { from: '/cashflow' } });
  };

  const pend = datos?.enTransito?.sobres ?? 0;
  const cargando = loading && !!datos;
  const saldo = datos?.saldo ?? 0;

  let cuerpo;
  if (!puede) {
    cuerpo = (
      <div className={c.centro}>
        <strong style={{ fontSize: 18 }}>El Cash Flow es solo del dueño</strong>
        <p className={c.nota}>Con este usuario no se puede ver. Entrá con el usuario superadmin.</p>
        <button type="button" className={cx(c.btn, c.btnPrimario)} onClick={() => navigate('/')}>Ir al ERP</button>
      </div>
    );
  } else if (!datos) {
    cuerpo = error
      ? <div className={c.centro}><Aviso tono="error">{error}</Aviso><button type="button" className={cx(c.btn, c.btnPrimario)} onClick={bump}>Reintentar</button></div>
      : <div className={c.centro}><span className={c.nota}>Cargando tu caja…</span></div>;
  } else if (!datos.caja) {
    cuerpo = <Arranque avisar={avisar} onHecho={bump} />;
  } else {
    cuerpo = (
      <>
        {error && <Aviso tono="error">No se pudo actualizar: {error}. Lo que ves es de las {horaCorta(actualizado)}.</Aviso>}
        {pestana === 'inicio' && <Inicio d={datos} abrir={abrir} irA={irA} actualizado={actualizado} version={version} bump={bump} avisar={avisar} />}
        {pestana === 'sobres' && <Sobres f={fSobres} setF={setFSobres} version={version} abrir={abrir} pendientes={pend} />}
        {pestana === 'movimientos' && <Movimientos f={fMov} setF={setFMov} version={version} abrir={abrir} />}
        {pestana === 'reportes' && <Reportes f={fRep} setF={setFRep} version={version} avisar={avisar} />}
        {pestana === 'conceptos' && <Conceptos conceptos={conceptos ?? []} abrir={abrir} cambiarActivo={cambiarActivo} ocupado={ocupado} />}
      </>
    );
  }
  const titulo = PESTANAS.find((p) => p.id === pestana)?.label;
  const hayCaja = puede && !!datos?.caja;

  return (
    <ModalModo.Provider value={MODO_MOVIL}>
      <div className={cx(c.app, hayCaja && pestana === 'movimientos' && c.conFab)}>
        <header className={c.top}>
          <div className={c.topTitulo}>
            <strong>Cash Flow</strong>
            <span>{hayCaja && pestana !== 'inicio' ? `${titulo} · ` : ''}Sabor y Aroma</span>
          </div>
          {puede && (
            <button type="button" className={cx(c.icono, cargando && c.girando)} onClick={bump} aria-label="Actualizar">
              <RefreshIcon />
            </button>
          )}
          <button type="button" className={c.icono} onClick={() => abrir({ tipo: 'menu' })} aria-label="Más opciones">
            <MoreVertIcon />
          </button>
        </header>

        <main className={c.contenido}>{cuerpo}</main>

        {hayCaja && pestana === 'movimientos' && (
          <button type="button" className={c.fab} onClick={() => abrir({ tipo: 'nuevo' })}><AddRoundedIcon /> Registrar</button>
        )}

        {hayCaja && (
          <nav className={c.nav} aria-label="Secciones del Cash Flow">
            {PESTANAS.map(({ id, label, Icono }) => (
              <button key={id} type="button" className={c.tab} aria-current={pestana === id ? 'page' : undefined} onClick={() => irA(id)}>
                <span className={c.tabIcono}>
                  <Icono fontSize="small" />
                  {id === 'sobres' && pend > 0 && <span className={c.badge}>{pend > 99 ? '99+' : pend}</span>}
                </span>
                {label}
              </button>
            ))}
          </nav>
        )}

        {toast && (
          <div className={c.toast} data-tono={toast.tono === 'error' ? 'error' : undefined} role="status" aria-live="polite" key={toast.id}>
            <span>{toast.texto}</span>
            <button type="button" onClick={() => setToast(null)} aria-label="Cerrar aviso">×</button>
          </div>
        )}

        {/* Las ventanas: las mismas del panel de Gerencia, a pantalla completa. */}
        {modal?.tipo === 'menu' && (
          <Menu onCerrar={cerrar} nombre={user?.name} irAlErp={() => { setModal(null); navigate('/'); }} salir={salir} instalar={() => setModal({ tipo: 'instalar' })} />
        )}
        {modal?.tipo === 'instalar' && <Instalar onCerrar={cerrar} />}
        {modal?.tipo === 'conteo' && datos && <ConteoModal saldo={saldo} enTransito={datos.enTransito} onCerrar={cerrar} onHecho={hecho} avisar={avisar} />}
        {(modal?.tipo === 'ingreso' || modal?.tipo === 'egreso') && (
          <MovimientoModal tipo={modal.tipo} conceptos={conceptos ?? []} saldo={saldo} onCerrar={cerrar} onHecho={hecho} avisar={avisar} />
        )}
        {modal?.tipo === 'pago' && <PagoProveedorModal saldo={saldo} onCerrar={cerrar} onHecho={hecho} avisar={avisar} />}
        {modal?.tipo === 'sobre' && <SobreModal sobre={modal.sobre} onCerrar={cerrar} onHecho={hecho} avisar={avisar} />}
        {modal?.tipo === 'sobreVer' && <SobreVer sobre={modal.sobre} onCerrar={cerrar} />}
        {modal?.tipo === 'descartar' && (
          <AnularModal
            titulo={`El sobre de ${modal.sobre.sucursal} no corresponde`}
            texto={`El sobre del ${fechaCorta(modal.sobre.cierre)} por ${money(modal.sobre.enviado)} sale de «sin controlar» SIN entrar a tu caja y sin cargarle un faltante a ${modal.sobre.cajero || 'el cajero'}. Usalo si ya estaba en tu saldo inicial, si es un duplicado o si se perdió (con su denuncia). Si fue un error, se deshace desde «Resueltos».`}
            ruta={`/cashflow/sobres/${modal.sobre.cajaSesionId}/descartar`}
            extra={{ confirmado: true }}
            boton="No corresponde"
            aviso={<>El sobre por <strong>{money(modal.sobre.enviado)}</strong> queda resuelto sin plata. Tu efectivo en mano no cambia.</>}
            placeholder="Ej: ya estaba contado en el saldo inicial del arranque"
            exito="Sobre marcado como «no corresponde»."
            onCerrar={cerrar} onHecho={hecho} avisar={avisar}
          />
        )}
        {modal?.tipo === 'deshacer' && (
          <AnularModal
            titulo={`Deshacer el sobre de ${modal.sobre.sucursal}`}
            texto={modal.sobre.descartado
              ? `El sobre del ${fechaCorta(modal.sobre.cierre)} vuelve a «sin controlar».`
              : `El sobre del ${fechaCorta(modal.sobre.cierre)} vuelve a «sin controlar» y los ${money(modal.sobre.contado)} salen de tu efectivo en mano. Si esa plata ya se usó, no se puede: el efectivo quedaría en negativo.`}
            ruta={`/cashflow/sobres/${modal.sobre.sobreId}/anular`}
            boton="Deshacer"
            exito="Listo: el sobre volvió a «sin controlar»."
            onCerrar={cerrar} onHecho={hecho} avisar={avisar}
          />
        )}
        {modal?.tipo === 'mov' && <DetalleMovimiento m={modal.m} onCerrar={cerrar} onAnular={() => setModal({ tipo: 'anular', m: modal.m })} />}
        {modal?.tipo === 'anular' && (
          <AnularModal
            titulo={`Anular ${modal.m.tipo} de ${money(modal.m.importe)}`}
            texto={textoAnular(modal.m)}
            ruta={`/cashflow/movimientos/${modal.m.id}/anular`}
            exito="Movimiento anulado."
            onCerrar={cerrar} onHecho={hecho} avisar={avisar}
          />
        )}
        {modal?.tipo === 'nuevo' && (
          <ModalShell title="Registrar" onClose={cerrar} footer={[{ texto: 'Cancelar', onClick: cerrar }]}>
            <div className={c.hoja}>
              {[
                ['ingreso', 'Entró plata', 'Un ingreso aparte de los sobres', 'azul', ArrowDownwardRoundedIcon],
                ['egreso', 'Sacar plata', 'Retiro, depósito o un gasto', 'rojo', ArrowUpwardRoundedIcon],
                ['pago', 'Pagar a un proveedor', 'Aplicado a sus facturas o gastos', 'naranja', StorefrontOutlinedIcon],
                ['conteo', 'Contar mi caja', 'Billete por billete, contra el libro', 'verde', CalculateOutlinedIcon],
              ].map(([tipo, t, sub, tono, Icono]) => (
                <button key={tipo} type="button" className={c.opcion} onClick={() => setModal({ tipo })}>
                  <span className={c.accionIcono} data-tono={tono}><Icono /></span>
                  <span>{t}<small>{sub}</small></span>
                  <ChevronRightRoundedIcon />
                </button>
              ))}
            </div>
          </ModalShell>
        )}
        {modal?.tipo === 'arranque' && datos?.caja && (
          <ModalShell title="Cambiar el arranque" onClose={cerrar}>
            <p className={c.nota} style={{ marginBottom: 12 }}>Solo se puede mientras no haya movimientos registrados. Después, el efectivo se corrige con un ingreso o un egreso con su motivo.</p>
            <Arranque caja={datos.caja} avisar={avisar} onHecho={hecho} onCancelar={cerrar} />
          </ModalShell>
        )}
        {(modal?.tipo === 'concepto' || modal?.tipo === 'conceptoNuevo') && (
          <ConceptoForm concepto={modal.concepto} onCerrar={cerrar} onHecho={hecho} avisar={avisar} />
        )}
      </div>
    </ModalModo.Provider>
  );
}
