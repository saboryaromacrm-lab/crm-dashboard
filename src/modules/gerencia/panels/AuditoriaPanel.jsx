/**
 * GERENCIA › AUDITORÍA (0144, 8/10/2026, pedido del dueño)
 * ============================================================================
 * «Quién hizo qué»: ventas anuladas, notas de crédito, precios y descuentos a
 * mano, ajustes de stock, diferencias de caja, otras anulaciones y los cambios
 * en el sistema (usuarios, roles, permisos, sucursales…), por persona y con
 * tres llamados de atención con reglas a la vista. Solo el superadmin.
 *
 * Todo lo arma la API en una sola lectura (`GET /auditoria/gerencia`, ver
 * crm-api/src/auditoria/gerencia.ts): período, local, persona y tipo van al
 * servidor; buscar y paginar la lista, en el navegador.
 */
import { useMemo, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { useResource } from '@modules/ventas/hooks/useResource.js';
import { cx } from '@shared/utils/classNames.js';
import { descargarCsv, csvNum } from '@shared/utils/csv.js';
import { money, num, fmtFechaHora } from '@modules/productos/domain/format.js';
import { Table, PanelHead, Btn, usePaginado, s } from '@modules/productos/components/ui.jsx';
import { PRESETS, fechaLarga, rangoDe } from './metricas/formato.js';
import { Aviso, Bloque } from './metricas/piezas.jsx';

const CLAVE = 'erp.gerencia.auditoria';
/* Stock y caja tienen signo: − es lo que faltó. El resto es un importe. */
const CON_SIGNO = new Set(['stock', 'caja']);
const AYUDA_TIPO = {
  anulacion: 'Quién la anuló. El importe es el total de la venta.',
  devolucion: 'Quién la hizo. El importe es lo que se devolvió o acreditó.',
  a_mano: 'Quién cobró. El importe es lo que el cliente dejó de pagar contra la lista.',
  stock: 'Quién la hizo. − es mercadería que se fue, a su costo del día.',
  caja: 'De quién era la caja. − es faltante.',
  retiro: 'Quién lo cargó en el POS. El importe es el costo real de lo que se llevó el socio.',
  otras: 'Cobranzas, compras, movimientos de caja y del Cash Flow, sobres y gastos anulados.',
  cambios: 'Usuarios, roles y permisos, sucursales, fichas, formatos, relevos de caja, respaldos…',
};

function leerPreferencias() {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE) || '{}');
    return { preset: PRESETS.some(([k]) => k === v.preset) && v.preset !== 'otro' ? v.preset : 'mes', sucursalId: Number(v.sucursalId) || '' };
  } catch { return { preset: 'mes', sucursalId: '' }; }
}
function guardarPreferencias(p) {
  try { localStorage.setItem(CLAVE, JSON.stringify({ preset: p.preset, sucursalId: p.sucursalId })); } catch { /* sin storage: no pasa nada */ }
}

const conSigno = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${money(Math.abs(n))}`;
const importeTxt = (tipo, n) => (n == null ? '—' : CON_SIGNO.has(tipo) ? conSigno(n) : money(n));
const NOWRAP = { whiteSpace: 'nowrap' };
const der = (txt) => <span style={{ display: 'block', textAlign: 'right' }}>{txt}</span>;
const nombreU = (d, id) => (id ? d?.nombres.usuarios[id] ?? `Usuario #${id}` : 'Sin usuario');
const nombreS = (d, id) => (id ? d?.nombres.sucursales[id] ?? '—' : '—');

export function AuditoriaPanel() {
  const [pref, setPref] = useState(leerPreferencias);
  const [manual, setManual] = useState(() => rangoDe('mes'));
  const [usuarioId, setUsuarioId] = useState('');
  const [tipo, setTipo] = useState('');
  const [q, setQ] = useState('');
  const cambiar = (cambio) => setPref((p) => { const n = { ...p, ...cambio }; guardarPreferencias(n); return n; });
  const [desde, hasta] = pref.preset === 'otro' ? manual : rangoDe(pref.preset);

  const qs = `desde=${desde}&hasta=${hasta}${pref.sucursalId ? `&sucursalId=${pref.sucursalId}` : ''}${usuarioId ? `&usuarioId=${usuarioId}` : ''}${tipo ? `&tipo=${tipo}` : ''}`;
  const { data: d, loading, error, reload } = useResource(`auditoria:${qs}`, () => httpClient.get(`/auditoria/gerencia?${qs}`));
  const { data: sucursales } = useResource('auditoria:sucursales', () => httpClient.get('/sucursales?todas=1'));
  const { data: usuarios } = useResource('auditoria:usuarios', () => httpClient.get('/usuarios'));

  const nomU = (id) => nombreU(d, id);
  const nomS = (id) => nombreS(d, id);
  const etiquetaTipo = useMemo(() => Object.fromEntries((d?.tipos ?? []).map((t) => [t.clave, t.etiqueta])), [d]);

  const eventos = useMemo(() => {
    const txt = q.trim().toLowerCase();
    if (!d || !txt) return d?.eventos ?? [];
    return d.eventos.filter((e) => `${e.titulo} ${e.detalle.join(' ')} ${e.motivo} ${nombreU(d, e.usuarioId)} ${e.otro ? nombreU(d, e.otro.usuarioId) : ''} ${nombreS(d, e.sucursalId)}`
      .toLowerCase().includes(txt));
  }, [d, q]);
  const pag = usePaginado(eventos, 'gerencia-auditoria', `${qs}|${q}`);

  const exportar = () => descargarCsv(
    `auditoria-${desde}-a-${hasta}${tipo ? `-${tipo}` : ''}.csv`,
    ['Fecha y hora', 'Tipo', 'Qué', 'Detalle', 'Motivo', 'Quién', 'Otra persona', 'Local', 'Importe', 'Suma'],
    eventos.map((e) => [fmtFechaHora(e.fecha), etiquetaTipo[e.tipo] ?? e.tipo, e.titulo, e.detalle.join(' | '), e.motivo, nomU(e.usuarioId),
      e.otro ? `${e.otro.etiqueta}: ${nomU(e.otro.usuarioId)}` : '', nomS(e.sucursalId), e.monto == null ? '' : csvNum(e.monto), e.informativo ? 'no' : 'sí']),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)', minWidth: 0 }}>
      <PanelHead
        title="Auditoría"
        desc="Quién hizo qué: ventas anuladas, notas de crédito, precios y descuentos a mano, ajustes de stock, diferencias de caja, otras anulaciones y los cambios en el sistema. Lee lo que cada operación deja firmado: no hay nada que cargar."
        actions={<Btn small onClick={reload} disabled={loading}>{loading ? 'Actualizando…' : 'Actualizar'}</Btn>}
      />

      {/* Lo que cambia la consulta: una fila, arriba de todo. */}
      <div className={s.toolbar} style={{ margin: 0 }}>
        <select className={s['select-inline']} value={pref.preset} aria-label="Período"
          onChange={(ev) => { const v = ev.target.value; if (v === 'otro') setManual([desde, hasta]); cambiar({ preset: v }); }}>
          {PRESETS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        {pref.preset === 'otro' && (
          <>
            <input type="date" value={manual[0]} max={manual[1]} onChange={(ev) => setManual([ev.target.value, manual[1]])} aria-label="Desde" />
            <input type="date" value={manual[1]} min={manual[0]} onChange={(ev) => setManual([manual[0], ev.target.value])} aria-label="Hasta" />
          </>
        )}
        <select className={s['select-inline']} value={pref.sucursalId} aria-label="Local" onChange={(ev) => cambiar({ sucursalId: ev.target.value ? Number(ev.target.value) : '' })}>
          <option value="">Todos los locales</option>
          {(sucursales ?? []).map((x) => <option key={x.id} value={x.id}>{x.nombre}{x.activa === false ? ' (desactivada)' : ''}</option>)}
        </select>
        <select className={s['select-inline']} value={usuarioId} aria-label="Persona" onChange={(ev) => setUsuarioId(ev.target.value)}>
          <option value="">Todas las personas</option>
          {(usuarios ?? []).map((u) => <option key={u.id} value={u.id}>{u.nombre}{u.activo === false ? ' (inactivo)' : ''}</option>)}
        </select>
        <span className={s.hint} style={{ margin: 0 }}>{fechaLarga(desde)} → {fechaLarga(hasta)}</span>
      </div>
      {pref.sucursalId && <div className={s.hint} style={{ margin: 0 }}>Con un local elegido no figura lo que no es de ningún local: el Cash Flow del dueño y los cambios de usuarios, roles y fichas.</div>}

      {error && <Aviso tono="warn">{error}</Aviso>}
      {!d ? <div className={s.hint}>Juntando lo firmado del período…</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)', opacity: loading ? 0.6 : 1, transition: 'opacity 120ms' }}>
          {/* Un número por tipo: tocarlo deja en la lista solo ese tipo. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: 10 }} role="group" aria-label="Filtrar por tipo">
            {d.tipos.map((t) => (
              <TileTipo key={t.clave} t={t} activo={tipo === t.clave} onClick={() => setTipo(tipo === t.clave ? '' : t.clave)} />
            ))}
          </div>

          {d.alertas.length > 0 && (
            <Aviso tono="warn">
              <strong>Para mirar</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {d.alertas.map((a, i) => (
                  <li key={i}>
                    {a.texto}
                    {a.usuarioId && String(a.usuarioId) !== String(usuarioId) && (
                      <> <button type="button" onClick={() => setUsuarioId(String(a.usuarioId))}
                        style={{ background: 'none', border: 0, padding: 0, font: 'inherit', color: 'var(--crm-color-primary)', fontWeight: 700, cursor: 'pointer' }}>Ver solo lo suyo</button></>
                    )}
                  </li>
                ))}
              </ul>
            </Aviso>
          )}

          <Bloque titulo="Por persona" sub="Tocá una persona para ver solo lo suyo. Las ventas cobradas son la base para comparar: anular 5 de 1.000 no es lo mismo que 5 de 50.">
            <Table
              cols={[{ h: 'Persona' }, { h: der('Cobró'), num: true }, { h: der('Anuló'), num: true }, { h: der('Devoluciones'), num: true },
                { h: der('A mano'), num: true }, { h: der('Stock'), num: true }, { h: der('Caja'), num: true }, { h: der('Retiros'), num: true }, { h: der('Otras anul.'), num: true }, { h: der('Cambios'), num: true }]}
              empty="Nadie hizo nada de esto en el período."
            >
              {d.personas.map((p) => (
                <tr key={p.usuarioId ?? 'sin'} onClick={() => p.usuarioId && setUsuarioId(String(usuarioId) === String(p.usuarioId) ? '' : String(p.usuarioId))}
                  style={{ cursor: p.usuarioId ? 'pointer' : undefined }}>
                  <td style={NOWRAP}><strong>{nomU(p.usuarioId)}</strong></td>
                  <td className={cx(s.num, s.mono)} style={NOWRAP}>
                    {p.cobradas ? <>{num(p.cobradas, 0)}<div className={s.hint} style={{ margin: 0 }}>{money(p.totalCobrado)}</div></> : <Nada />}
                  </td>
                  <CeldaCuenta c={p.anulacion} extra={p.cobradas && p.anulacion.n ? `${num((p.anulacion.n / p.cobradas) * 100, 1)} % de lo cobrado` : ''} />
                  <CeldaCuenta c={p.devolucion} />
                  <CeldaCuenta c={p.a_mano} />
                  <CeldaCuenta c={p.stock} signo />
                  <td className={cx(s.num, s.mono)} style={NOWRAP}>
                    {p.caja.faltantes || p.caja.sobrantes ? (
                      <>
                        {p.caja.faltantes > 0 && <div style={{ color: 'var(--crm-color-danger)' }}>{p.caja.faltantes} falt. {conSigno(p.caja.faltante)}</div>}
                        {p.caja.sobrantes > 0 && <div>{p.caja.sobrantes} sobr. {conSigno(p.caja.sobrante)}</div>}
                      </>
                    ) : <Nada />}
                  </td>
                  <CeldaCuenta c={p.retiro} />
                  <CeldaCuenta c={p.otras} />
                  <td className={cx(s.num, s.mono)}>{p.cambios ? num(p.cambios, 0) : <Nada />}</td>
                </tr>
              ))}
            </Table>
          </Bloque>

          <div className={s.toolbar} style={{ margin: 0 }}>
            <input type="search" placeholder="Buscar en la lista: producto, cliente, motivo, persona…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 260 }} aria-label="Buscar" />
            {tipo && <Btn small onClick={() => setTipo('')}>Ver todos los tipos</Btn>}
            {usuarioId && <Btn small onClick={() => setUsuarioId('')}>Ver todas las personas</Btn>}
            <Btn small onClick={exportar} disabled={!eventos.length}>Exportar CSV</Btn>
            <span className={s.hint} style={{ margin: '0 0 0 auto' }}>
              {num(eventos.length, 0)} {eventos.length === 1 ? 'movimiento' : 'movimientos'}{tipo ? ` · ${etiquetaTipo[tipo]}` : ''}
            </span>
          </div>
          {d.totalEventos > d.eventos.length && (
            <Aviso>Hay {num(d.totalEventos, 0)} movimientos: la lista muestra los {num(d.tope, 0)} más recientes (los números de arriba cuentan todos). Achicá el período o elegí un tipo o una persona para ver el resto.</Aviso>
          )}

          <Table
            cols={[{ h: 'Fecha y hora' }, { h: 'Qué pasó' }, { h: 'Quién' }, ...(pref.sucursalId ? [] : [{ h: 'Local' }]), { h: der('Importe'), num: true }]}
            empty={q ? 'Nada coincide con la búsqueda.' : 'No hay nada firmado con estos filtros.'}
            pag={pag}
          >
            {pag.visibles.map((e) => (
              <tr key={e.id} style={e.informativo ? { opacity: 0.75 } : undefined}>
                <td style={NOWRAP}>{fmtFechaHora(e.fecha)}</td>
                <td style={{ minWidth: 280 }}>
                  <span className={s.badge} style={{ background: 'var(--crm-color-surface-2)', color: 'var(--crm-color-text-secondary)', fontWeight: 700, marginRight: 6 }}>{etiquetaTipo[e.tipo]}</span>
                  <strong>{e.titulo}</strong>
                  {e.detalle.map((l, i) => <div key={i} className={s.hint} style={{ margin: 0 }}>{l}</div>)}
                  {e.motivo && <div style={{ fontSize: 13, marginTop: 2 }}>Motivo: <em>{e.motivo}</em></div>}
                </td>
                <td style={NOWRAP}>
                  {nomU(e.usuarioId)}
                  {e.otro && <div className={s.hint} style={{ margin: 0 }}>{e.otro.etiqueta}: {nomU(e.otro.usuarioId)}</div>}
                </td>
                {!pref.sucursalId && <td style={NOWRAP}>{nomS(e.sucursalId)}</td>}
                <td className={cx(s.num, s.mono)} style={{ ...NOWRAP, color: CON_SIGNO.has(e.tipo) && e.monto < 0 ? 'var(--crm-color-danger)' : undefined }}>
                  {importeTxt(e.tipo, e.monto)}
                </td>
              </tr>
            ))}
          </Table>
          <div className={s.hint} style={{ margin: 0 }}>
            <strong>Las reglas de «Para mirar»:</strong> alguien anula 3 ventas o más y, en proporción a lo que cobró, el doble o más que el resto del equipo (y al menos el 2 %);
            alguien tiene 2 faltantes de caja o más (cierres o sobres); un mismo producto, en un mismo local, tiene 3 ajustes o bajas o más.
            Menos de 50 centavos de diferencia de caja no cuenta (es redondeo). Lo automático del sistema (copias nocturnas, sincronizaciones) no figura: solo lo que hizo una persona.
          </div>
        </div>
      )}
    </div>
  );
}

function TileTipo({ t, activo, onClick }) {
  const caja = t.clave === 'caja';
  return (
    <button type="button" onClick={onClick} aria-pressed={activo} title={AYUDA_TIPO[t.clave]} className={cx(s.card, s.cardPad)}
      style={{
        minWidth: 0, boxSizing: 'border-box', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-start',
        outline: activo ? '2px solid var(--crm-color-primary)' : undefined, opacity: t.n ? 1 : 0.7,
      }}>
      {/* El título reserva dos renglones: en una fila de tarjetas los números quedan todos a la misma altura. */}
      <div className={s['mini-label']} style={{ lineHeight: 1.35, minHeight: '2.7em' }}>{t.etiqueta}</div>
      <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{num(t.n, 0)}</div>
      {t.monto != null && t.n > 0 && (
        <div className={s.hint} style={{ margin: '2px 0 0', fontVariantNumeric: 'tabular-nums' }}>
          {caja
            ? <><span style={{ color: t.faltante < 0 ? 'var(--crm-color-danger)' : undefined }}>faltó {money(Math.abs(t.faltante))}</span> · sobró {money(t.sobrante)}</>
            : importeTxt(t.clave, t.monto)}
        </div>
      )}
    </button>
  );
}

function CeldaCuenta({ c, signo, extra }) {
  if (!c.n) return <td className={cx(s.num, s.mono)}><Nada /></td>;
  return (
    <td className={cx(s.num, s.mono)} style={NOWRAP}>
      {num(c.n, 0)}
      <div className={s.hint} style={{ margin: 0, color: signo && c.monto < 0 ? 'var(--crm-color-danger)' : undefined }}>{signo ? conSigno(c.monto) : money(c.monto)}</div>
      {extra && <div className={s.hint} style={{ margin: 0 }}>{extra}</div>}
    </td>
  );
}

const Nada = () => <span className={s.muted}>—</span>;
