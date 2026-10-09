import { useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useResource } from '@modules/ventas/hooks/useResource.js';
import { errorMsg } from '@modules/ventas/services/ventas.api.js';
import { Btn, s } from '@modules/productos/components/ui.jsx';
import { Aviso, Bloque, Cargando, Grilla } from '../metricas/piezas.jsx';
import { resultadosApi } from './resultados.api.js';
import { mesActual, nombreMes, pct, pesos, r2 } from './resultados.js';

/**
 * LA CONFIGURACIÓN DE RESULTADOS (0152, solo superadmin). Cada tasa con
 * «vigente desde»: un cambio no reescribe los meses viejos. Todo lo que se
 * cambia queda en Gerencia › Auditoría.
 */
export function ConfigResultados({ alGuardar }) {
  const { data, loading, error, mutate } = useResource('resultados:configuracion', () => resultadosApi.configuracion());
  const [msg, setMsg] = useState(null);
  const enVuelo = useRef(false);

  /** Toda escritura pasa por acá: una a la vez, y la respuesta (la configuración entera) reemplaza a la de pantalla. */
  const hacer = async (promesa, ok) => {
    if (enVuelo.current) return false;
    enVuelo.current = true;
    try {
      mutate(await promesa());
      setMsg({ tono: 'ok', texto: ok });
      alGuardar?.();
      return true;
    } catch (e) {
      setMsg({ tono: 'warn', texto: errorMsg(e) });
      return false;
    } finally { enVuelo.current = false; }
  };

  if (loading && !data) return <Cargando />;
  if (error) return <Aviso tono="warn">{error}</Aviso>;
  if (!data) return null;
  const activas = data.sucursales.filter((x) => x.activa);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {msg && <Aviso tono={msg.tono}>{msg.texto}</Aviso>}
      <Grilla>
        <Bloque titulo="Ingresos Brutos" sub="Sobre lo facturado sin IVA de cada local. Si cargás el pago real del mes (rubro «Ingresos Brutos»), manda el real más las percepciones de IIBB del mes.">
          <Tasa tasas={data.tasas} concepto="iibb" hacer={hacer} />
        </Bloque>
        <Bloque titulo="Comisión de tarjetas (posnet)" sub="Sobre lo cobrado con débito y crédito (ventas y recibos). Va sin IVA: el IVA de la comisión se recupera. Mercado Pago va con su comisión real.">
          <Tasa tasas={data.tasas} concepto="tarjeta" hacer={hacer} titulo="Todas las tarjetas" />
          <Tasa tasas={data.tasas} concepto="tarjeta" medio="tarjeta_debito" hacer={hacer} titulo="Solo débito (si es distinta)" opcional />
          <Tasa tasas={data.tasas} concepto="tarjeta" medio="tarjeta_credito" hacer={hacer} titulo="Solo crédito (si es distinta)" opcional />
        </Bloque>
      </Grilla>

      <Bloque titulo="Tasa municipal (Seguridad e Higiene)" sub="Distinta por local, sobre lo facturado sin IVA de cada uno, con un mínimo por mes si la municipalidad lo cobra. El pago real de un local (rubro «Tasa municipal») reemplaza su estimado.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 12 }}>
          {activas.map((x) => (
            <div key={x.id} className={cx(s.card, s.cardPad)} style={{ boxSizing: 'border-box' }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{x.nombre}</div>
              <Tasa tasas={data.tasas} concepto="municipalidad" sucursalId={x.id} hacer={hacer} conMinimo />
            </div>
          ))}
        </div>
      </Bloque>

      <Rubros data={data} hacer={hacer} />

      <Grilla>
        <Ganancias data={data} hacer={hacer} />
        <Bloque titulo="Amortizaciones" sub="Restan la cuota mensual de los bienes de uso (heladeras, balanzas, reformas) que se cargan en Gastos › Gastos fijos y sueldos › Bienes de uso.">
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox" checked={!!data.config.amortizaciones}
              onChange={(e) => hacer(() => resultadosApi.guardarConfig({ amortizaciones: e.target.checked }), e.target.checked ? 'Amortizaciones encendidas.' : 'Amortizaciones apagadas.')}
            />
            Incluir las amortizaciones en el resultado
          </label>
        </Bloque>
      </Grilla>
    </div>
  );
}

/** Una tasa: la vigente hoy, su historia y el formulario para cargar una nueva «vigente desde». */
function Tasa({ tasas, concepto, sucursalId = null, medio = null, hacer, titulo, conMinimo, opcional }) {
  const hoy = mesActual();
  const propias = tasas
    .filter((t) => t.concepto === concepto && (t.sucursalId ?? null) === sucursalId && (t.medio ?? null) === medio)
    .sort((a, b) => (a.desde < b.desde ? 1 : -1));
  const vigente = propias.find((t) => t.desde <= hoy) ?? null;
  const [f, setF] = useState({ porcentaje: '', minimo: '', desde: hoy });
  const [historia, setHistoria] = useState(false);
  const guardar = async () => {
    const p = Number(f.porcentaje);
    if (f.porcentaje === '' || !(p >= 0 && p <= 30)) return hacer(() => Promise.reject(new Error('Poné el porcentaje (entre 0 y 30).')), '');
    const ok = await hacer(
      () => resultadosApi.guardarTasa({ concepto, sucursalId, medio, porcentaje: r2(p * 1000) / 1000, minimo: conMinimo ? r2(f.minimo) : 0, desde: f.desde }),
      `${titulo ?? 'Tasa'} guardada: ${pct(p, 3)} desde ${nombreMes(f.desde)}.`,
    );
    if (ok) setF({ porcentaje: '', minimo: '', desde: hoy });
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
      {titulo && <div className={s['mini-label']}>{titulo}</div>}
      <div>
        {vigente
          ? <><strong>{pct(vigente.porcentaje, 3)}</strong>{conMinimo && vigente.minimo > 0 ? ` · mínimo ${pesos(vigente.minimo)} por mes` : ''} <span className={s.hint} style={{ margin: 0 }}>desde {nombreMes(vigente.desde)}</span></>
          : <span className={s.hint} style={{ margin: 0 }}>{opcional ? 'Sin tasa propia: usa la de todas.' : 'Sin tasa cargada.'}</span>}
        {propias.length > 0 && (
          <button type="button" className={s.linkBtn} style={{ marginLeft: 8 }} onClick={() => setHistoria((v) => !v)}>
            {historia ? 'Ocultar historia' : `Historia (${propias.length})`}
          </button>
        )}
      </div>
      {historia && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {propias.map((t) => (
            <div key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
              <span style={{ minWidth: 130 }}>Desde {nombreMes(t.desde)}</span>
              <span>{pct(t.porcentaje, 3)}{t.minimo > 0 ? ` · mín. ${pesos(t.minimo)}` : ''}</span>
              {t.desde > hoy && <span className={s.hint} style={{ margin: 0 }}>(todavía no rige)</span>}
              <Btn small variant="btn-delete" onClick={() => hacer(() => resultadosApi.borrarTasa(t.id), 'Tasa borrada.')}>Borrar</Btn>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="number" min="0" max="30" step="0.01" placeholder="%" value={f.porcentaje} onChange={(e) => setF({ ...f, porcentaje: e.target.value })} style={{ width: 80 }} aria-label="Porcentaje" />
        {conMinimo && <input type="number" min="0" step="100" placeholder="Mínimo $" value={f.minimo} onChange={(e) => setF({ ...f, minimo: e.target.value })} style={{ width: 110 }} aria-label="Mínimo por mes" />}
        <span className={s.hint} style={{ margin: 0 }}>desde</span>
        <input type="month" value={f.desde} onChange={(e) => e.target.value && setF({ ...f, desde: e.target.value })} aria-label="Vigente desde" />
        <Btn small variant="btn-primary" onClick={guardar}>{vigente ? 'Cambiar' : 'Cargar'}</Btn>
      </div>
    </div>
  );
}

/** Cada rubro: fijo o variable, cómo entra en el resultado y qué pasa si el gasto no tiene local. */
function Rubros({ data, hacer }) {
  const cambiar = (r, campo, valor) => hacer(() => resultadosApi.editarRubro(r.id, { [campo]: valor }), `«${r.nombre}» actualizado.`);
  const td = { padding: '6px 10px' };
  return (
    <Bloque
      titulo="Rubros de gastos: cómo entran"
      sub="Fijo o variable decide dónde va en la cascada. «Cómo entra» evita contar dos veces: un pago de Ingresos Brutos reemplaza al estimado; los anticipos de Ganancias no entran (manda el estimado); los pagos de sueldos ceden ante la planilla. «Sin local»: un gasto de toda la empresa se reparte entre los locales por ventas, o queda en Administración."
    >
      <div className={cx(s.tblScroll)}>
        <table className={s.table} style={{ minWidth: 720 }}>
          <thead><tr><th style={td}>Rubro</th><th style={td}>Tipo</th><th style={td}>Cómo entra</th><th style={td}>Si no tiene local</th></tr></thead>
          <tbody>
            {data.rubros.filter((r) => r.activa).map((r) => (
              <tr key={r.id}>
                <td style={td}>{r.nombre}</td>
                <td style={td}>
                  <select value={r.tipo} onChange={(e) => cambiar(r, 'tipo', e.target.value)} aria-label={`Tipo de ${r.nombre}`}>
                    <option value="fijo">Fijo</option><option value="variable">Variable</option>
                  </select>
                </td>
                <td style={td}>
                  <select value={r.resultado} onChange={(e) => cambiar(r, 'resultado', e.target.value)} aria-label={`Cómo entra ${r.nombre}`}>
                    {data.papeles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </td>
                <td style={td}>
                  <select value={r.reparte ? 'si' : 'no'} onChange={(e) => cambiar(r, 'reparte', e.target.value === 'si')} aria-label={`Sin local ${r.nombre}`}>
                    <option value="si">Se reparte por ventas</option><option value="no">Queda en Administración</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={s.hint} style={{ margin: 0 }}>
        Ojo con «Impuestos y tasas»: si ahí cargás los pagos de Ingresos Brutos o de la municipalidad, se suman al estimado. Cargalos en sus rubros propios.
      </div>
    </Bloque>
  );
}

/** Ganancias (persona humana): la base y la escala del artículo 94 de cada año. */
function Ganancias({ data, hacer }) {
  const anios = data.escalas.map((e) => e.anio);
  const anioHoy = Number(mesActual().slice(0, 4));
  const [anio, setAnio] = useState(anios.includes(anioHoy) ? anioHoy : anios[anios.length - 1] ?? anioHoy);
  const base = data.escalas.find((e) => e.anio === anio) ?? [...data.escalas].sort((a, b) => b.anio - a.anio)[0];
  const [edit, setEdit] = useState(null);
  const empezar = () => setEdit({
    tramos: (base?.tramos ?? []).map((t) => ({ desde: String(t.desde), fijo: String(t.fijo), pct: String(t.pct) })),
    deducciones: { gni: '', especial: '', cargasFamilia: '', otras: '', ...Object.fromEntries(Object.entries(base?.deducciones ?? {}).map(([k, v]) => [k, String(v)])) },
  });
  const guardar = async () => {
    const tramos = edit.tramos.filter((t) => t.desde !== '' || t.pct !== '').map((t) => ({ desde: r2(t.desde), fijo: r2(t.fijo), pct: r2(t.pct) }));
    const d = edit.deducciones;
    const ok = await hacer(
      () => resultadosApi.guardarEscala(anio, { tramos, deducciones: { gni: r2(d.gni), especial: r2(d.especial), cargasFamilia: r2(d.cargasFamilia), otras: r2(d.otras) } }),
      `Escala de Ganancias ${anio} guardada.`,
    );
    if (ok) setEdit(null);
  };
  const propia = data.escalas.some((e) => e.anio === anio);
  const td = { padding: '4px 6px', textAlign: 'right' };
  return (
    <Bloque titulo="Impuesto a las Ganancias (persona humana)" sub="Se estima por lo acumulado del año: la ganancia de enero al mes, menos las deducciones de esos meses, contra la escala del artículo 94. Es un estimado: el impuesto real lo determina la contadora.">
      <label className={s.hint} style={{ margin: 0 }}>
        Base del estimado{' '}
        <select value={data.config.gananciasBase} onChange={(e) => hacer(() => resultadosApi.guardarConfig({ gananciasBase: e.target.value }), 'Base de Ganancias actualizada.')}>
          <option value="facturado">Solo la parte facturada del resultado</option>
          <option value="todo">Todo el resultado</option>
        </select>
      </label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className={s.hint} style={{ margin: 0 }}>Escala del año</span>
        <select value={anio} onChange={(e) => { setAnio(Number(e.target.value)); setEdit(null); }}>
          {[...new Set([...anios, anioHoy, anioHoy + 1])].sort().map((a) => <option key={a} value={a}>{a}{anios.includes(a) ? '' : ' (sin cargar)'}</option>)}
        </select>
        {!edit && <Btn small onClick={empezar}>{propia ? 'Editar' : `Cargar ${anio} (copiando ${base?.anio ?? ''})`}</Btn>}
      </div>
      {!propia && !edit && <Aviso tono="warn">La escala de {anio} no está cargada: se usa la de {base?.anio}. Cargá la nueva apenas la publique ARCA (tabla «período anual»).</Aviso>}
      {!edit && base && (
        <div className={s.hint} style={{ margin: 0 }}>
          {base.anio}: {base.tramos.length} tramos, del {pct(base.tramos[0]?.pct, 0)} al {pct(base.tramos[base.tramos.length - 1]?.pct, 0)} · deducciones del año {pesos(base.totalDeducciones, 0)}
          {' '}(ganancia no imponible {pesos(base.deducciones?.gni ?? 0, 0)} + deducción especial {pesos(base.deducciones?.especial ?? 0, 0)}
          {base.deducciones?.cargasFamilia ? ` + cargas de familia ${pesos(base.deducciones.cargasFamilia, 0)}` : ''}{base.deducciones?.otras ? ` + otras ${pesos(base.deducciones.otras, 0)}` : ''}).
        </div>
      )}
      {edit && (
        <>
          <div className={cx(s.tblScroll)}>
            <table className={s.table}>
              <thead><tr><th style={td}>Más de $</th><th style={td}>Pagan $</th><th style={td}>Más el %</th><th /></tr></thead>
              <tbody>
                {edit.tramos.map((t, i) => (
                  <tr key={i}>
                    {['desde', 'fijo', 'pct'].map((k) => (
                      <td key={k} style={td}>
                        <input type="number" step="0.01" value={t[k]} style={{ width: k === 'pct' ? 70 : 140, textAlign: 'right' }}
                          onChange={(e) => setEdit((x) => ({ ...x, tramos: x.tramos.map((y, j) => (j === i ? { ...y, [k]: e.target.value } : y)) }))} aria-label={`${k} tramo ${i + 1}`} />
                      </td>
                    ))}
                    <td><Btn small variant="btn-delete" onClick={() => setEdit((x) => ({ ...x, tramos: x.tramos.filter((_, j) => j !== i) }))}>Sacar</Btn></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Btn small onClick={() => setEdit((x) => ({ ...x, tramos: [...x.tramos, { desde: '', fijo: '', pct: '' }] }))}>+ Tramo</Btn>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
            {[['gni', 'Ganancia no imponible'], ['especial', 'Deducción especial'], ['cargasFamilia', 'Cargas de familia'], ['otras', 'Otras deducciones']].map(([k, l]) => (
              <label key={k} className={s.hint} style={{ margin: 0 }}>
                {l}
                <input type="number" step="0.01" value={edit.deducciones[k]} style={{ width: '100%' }}
                  onChange={(e) => setEdit((x) => ({ ...x, deducciones: { ...x.deducciones, [k]: e.target.value } }))} />
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn small variant="btn-primary" onClick={guardar}>Guardar escala {anio}</Btn>
            <Btn small onClick={() => setEdit(null)}>Cancelar</Btn>
          </div>
        </>
      )}
    </Bloque>
  );
}
