/**
 * EL ASESOR (0193, 21/10/2026, pedido del dueño)
 * ============================================================================
 * La pantalla de los especialistas de IA: Gerencia › Asesor (el negocio) y
 * Ventas › Asesor comercial. Es UNA sola pantalla; lo que cambia de uno a otro
 * (la ruta de la API, los textos, los ejemplos y las partes propias del
 * informe o de la configuración) viene en `cfg`. Tres pestañas:
 *   · Análisis: el botón «Analizar ahora» (con un enfoque opcional), el informe
 *     con sus alertas («Útil / No aplica / Ya lo sé»: así aprende), el granel,
 *     lo que pregunta y lo que propone recordar, y las señales del sistema
 *     (reglas fijas, sin IA: se ven aunque la IA no esté configurada).
 *   · Preguntar: una conversación; la IA consulta el sistema para responder.
 *   · Configuración: la ficha del negocio, lo que ya sabe, el tope de gasto y
 *     «Ver los números que mira» (la foto entera, para comprobar).
 * Todo se calcula en el servidor (crm-api/src/asesor); acá se pide y se muestra.
 */
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Tabs, Tab } from '@mui/material';
import { httpClient } from '@core/services/httpClient.js';
import { useResource } from '@modules/ventas/hooks/useResource.js';
import { errorMsg } from '@modules/ventas/services/ventas.api.js';
import { cx } from '@shared/utils/classNames.js';
import { PanelHead, Btn, Pill, s } from '@modules/productos/components/ui.jsx';
import { Aviso, Bloque, Cargando } from '../metricas/piezas.jsx';
import { Markdown } from './Markdown.jsx';

const PESTANAS = [['analisis', 'Análisis'], ['preguntar', 'Preguntar'], ['configuracion', 'Configuración']];
const PRIORIDAD = {
  urgente: ['st-defectuoso', 'Urgente'], mirar: ['st-comprometido', 'Para mirar'], oportunidad: ['st-disponible', 'Oportunidad'], dato: ['st-vencido', 'Dato'],
};
const NIVEL = { urgente: PRIORIDAD.urgente, mirar: PRIORIDAD.mirar, dato: PRIORIDAD.dato };
const ESTADO = { bien: ['st-disponible', 'Bien'], atencion: ['st-comprometido', 'Atención'], problema: ['st-defectuoso', 'Problema'] };
const OPINIONES = [['util', 'Útil'], ['no_aplica', 'No aplica'], ['ya_lo_se', 'Ya lo sé']];
export const usd = (n) => `USD ${(Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fechaHora = (v) => (v ? new Date(v).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

/** El de Gerencia: el negocio entero (ventas, márgenes, granel, stock, cajas, gastos, resultados). */
const NEGOCIO = {
  api: '/asesor',
  titulo: 'Asesor',
  analizarTitulo: 'Analizar el negocio',
  informeTitulo: 'Cómo está el negocio',
  desc: 'Una IA que lee los números de tu sistema, te dice qué pasa, qué le parece raro y qué harías. No hace cuentas: interpreta las que ya hace el sistema.',
  analizarSub: 'Arma la foto del negocio con tus números (ventas, márgenes, granel y fraccionado, stock, costos, cajas, gastos y resultados) y la IA la lee. Tarda uno o dos minutos; podés seguir usando el sistema mientras tanto.',
  enfoqueEjemplo: 'el granel de Fontana',
  areas: {
    ventas: 'Ventas', rentabilidad: 'Rentabilidad', granel: 'Granel', stock: 'Stock', precios: 'Precios', caja: 'Caja', gastos: 'Gastos',
    resultados: 'Resultados', ofertas: 'Ofertas', datos: 'Datos',
  },
  ejemplos: [
    '¿Qué granel conviene fraccionar esta semana y en qué tamaños?',
    '¿Qué productos me dejan menos margen este mes y por qué?',
    '¿Qué costos subieron y todavía no pasé al precio?',
    '¿Cómo viene cada local contra el mes pasado?',
  ],
  ficha: {
    titulo: 'Tu negocio, contado por vos',
    sub: 'La IA lo lee en cada análisis y en cada pregunta. Lo que no está en los números: qué vende cada local, a quién le vende, qué margen esperás, temporadas, decisiones tomadas, qué no hace falta que te repita.',
    ejemplo: 'Ej.: La Distribuidora le vende a comercios con la lista mayorista; los Express son minoristas. El granel tiene que dejar al menos 35 %. Enero y febrero son flojos. Coffit va aparte.',
  },
};

const CfgAsesor = createContext(NEGOCIO);
const useCfg = () => useContext(CfgAsesor);

export function AsesorPanel() {
  return <Asesor cfg={NEGOCIO} />;
}

/**
 * La pantalla de un especialista. `cfg`: { api, titulo, desc, analizarTitulo, analizarSub, informeTitulo,
 * enfoqueEjemplo, areas, ejemplos, ficha: {titulo, sub, ejemplo},
 * InformeExtra?: ({ informe, onCambio }) => …, ConfigExtra?: () => … }.
 */
export function Asesor({ cfg }) {
  const [pestana, setPestana] = useState('analisis');
  const [version, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);
  const { data: estado, error } = useResource(`${cfg.api}:estado:${version}`, () => httpClient.get(`${cfg.api}/estado`));
  return (
    <CfgAsesor.Provider value={cfg}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
        <PanelHead
          title={cfg.titulo}
          desc={cfg.desc}
          actions={estado && <span className={s.hint} style={{ margin: 0 }}>Este mes: <strong>{usd(estado.gastadoMesUsd)}</strong> de {usd(estado.topeMensualUsd)}</span>}
        />
        {error && <Aviso tono="warn">{error}</Aviso>}
        {estado && !estado.configurado && (
          <Aviso tono="warn">
            <strong>Falta la clave de la IA en el servidor</strong> (ANTHROPIC_API_KEY, en Dokploy). Mientras tanto el análisis muestra solo las señales que detecta el sistema, y no se pueden hacer preguntas.
          </Aviso>
        )}
        {estado?.avisoTope && estado.configurado && (
          <Aviso tono="warn">Este mes ya se usó el {estado.usoTopePct} % del tope de gasto del asesor. Al llegar al tope deja de llamar a la IA hasta el mes que viene (podés subirlo en Configuración).</Aviso>
        )}
        <Tabs value={pestana} onChange={(e, v) => setPestana(v)} variant="scrollable" scrollButtons="auto" sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40 }}>
          {PESTANAS.map(([id, label]) => <Tab key={id} value={id} label={label} sx={{ minHeight: 40, textTransform: 'none', fontWeight: 600 }} />)}
        </Tabs>
        {pestana === 'analisis' && <Analisis estado={estado} bump={bump} irA={setPestana} />}
        {pestana === 'preguntar' && <Preguntar estado={estado} bump={bump} />}
        {pestana === 'configuracion' && <Configuracion estado={estado} bump={bump} />}
      </div>
    </CfgAsesor.Provider>
  );
}

/* ==================================================================== *
 * Análisis
 * ==================================================================== */
function Analisis({ estado, bump, irA }) {
  const cfg = useCfg();
  const [enfoque, setEnfoque] = useState('');
  const [analizando, setAnalizando] = useState(false);
  const [error, setError] = useState('');
  const [elegido, setElegido] = useState(null);
  const [lista, setLista] = useState(0);
  const enVuelo = useRef(false);
  const { data: informes } = useResource(`${cfg.api}:informes:${lista}`, () => httpClient.get(`${cfg.api}/informes`));
  const id = elegido ?? informes?.[0]?.id ?? null;
  const { data: informe, loading } = useResource(`${cfg.api}:informe:${id}:${lista}`, () => httpClient.get(`${cfg.api}/informes/${id}`), { enabled: !!id });
  /* Mientras la IA escribe (en el servidor, en segundo plano), se vuelve a mirar cada 4 segundos. */
  const enCurso = informe?.estado === 'analizando';
  useEffect(() => {
    if (!enCurso) return undefined;
    const t = setTimeout(() => setLista((n) => n + 1), 4000);
    return () => clearTimeout(t);
  }, [enCurso, lista]);
  /* Al terminar, se actualiza el gasto del mes de arriba. */
  const eraEnCurso = useRef(false);
  useEffect(() => {
    if (enCurso) eraEnCurso.current = true;
    else if (eraEnCurso.current) { eraEnCurso.current = false; bump(); }
  }, [enCurso]); // eslint-disable-line react-hooks/exhaustive-deps
  const ocupado = analizando || enCurso || !!estado?.analizando;

  const analizar = async () => {
    if (enVuelo.current) return;
    enVuelo.current = true; setAnalizando(true); setError('');
    try {
      const r = await httpClient.post(`${cfg.api}/analizar`, { enfoque: enfoque.trim() });
      setElegido(r.id); setLista((n) => n + 1);
    } catch (e) { setError(errorMsg(e)); } finally { enVuelo.current = false; setAnalizando(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Bloque
        titulo={cfg.analizarTitulo}
        sub={cfg.analizarSub}
      >
        <div className={s.toolbar} style={{ flexWrap: 'wrap', gap: 8 }}>
          <input
            id="asesor-enfoque" value={enfoque} maxLength={400} onChange={(e) => setEnfoque(e.target.value)} disabled={ocupado}
            placeholder={`Opcional: en qué querés que se fije (ej.: ${cfg.enfoqueEjemplo})`} style={{ flex: '1 1 320px', minWidth: 0 }}
          />
          <Btn variant="btn-primary" onClick={analizar} disabled={ocupado}>{ocupado ? 'Analizando…' : 'Analizar ahora'}</Btn>
        </div>
        {error && <Aviso tono="warn">{error}</Aviso>}
      </Bloque>

      {(informes ?? []).length > 1 && (
        <div className={s.toolbar} style={{ gap: 8 }}>
          <label htmlFor="asesor-historial" className={s.hint} style={{ margin: 0 }}>Análisis anteriores</label>
          <select id="asesor-historial" className={s['select-inline']} value={id ?? ''} onChange={(e) => setElegido(Number(e.target.value))}>
            {informes.map((x) => (
              <option key={x.id} value={x.id}>
                {fechaHora(x.fecha)} · {x.estado === 'analizando' ? 'analizando…' : x.error ? 'solo señales' : ESTADO[x.salud]?.[1] ?? '—'}{x.enfoque ? ` · ${x.enfoque.slice(0, 40)}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {!id && informes && <Aviso tono="info">Todavía no hay análisis. Apretá «Analizar ahora».</Aviso>}
      {id && loading && !informe ? <Cargando /> : informe && <Informe informe={informe} onCambio={() => setLista((n) => n + 1)} irA={irA} bump={bump} aprendidos={estado?.aprendizajes ?? []} />}
    </div>
  );
}

function Informe({ informe, onCambio, irA, bump, aprendidos }) {
  const { InformeExtra, informeTitulo } = useCfg();
  const inf = informe.informe;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {informe.estado === 'analizando' && (
        <Aviso tono="info">
          <strong>La IA está leyendo tus números y escribiendo el informe…</strong> Tarda uno o dos minutos. Podés seguir usando el sistema: el informe aparece acá solo.
        </Aviso>
      )}
      {informe.error && <Aviso tono="warn">{informe.error}</Aviso>}
      {inf && (
        <Bloque
          titulo={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{informeTitulo} <Pill pill={ESTADO[inf.estado]?.[0]} label={ESTADO[inf.estado]?.[1] ?? inf.estado} /></span>}
          sub={`Análisis del ${fechaHora(informe.fecha)}${informe.enfoque ? ` · enfoque: ${informe.enfoque}` : ''}`}
        >
          <div style={{ fontSize: 15, lineHeight: 1.55 }}>{inf.resumen}</div>
        </Bloque>
      )}
      {inf?.alertas?.map((a, i) => <Alerta key={i} a={a} i={i} informeId={informe.id} opinion={informe.opiniones?.[i]} onCambio={onCambio} />)}
      {inf?.granel && <GranelInforme g={inf.granel} />}
      {inf && InformeExtra && <InformeExtra informe={informe} onCambio={onCambio} />}
      {inf && (inf.preguntas?.length > 0 || inf.aprendizajesSugeridos?.length > 0) && (
        <Bloque titulo="Para conocer mejor tu negocio" sub="Lo que el asesor no puede saber con los números. Respondé en la ficha (Configuración) o guardá lo que propone recordar.">
          {inf.preguntas?.length > 0 && (
            <div>
              <div className={s['mini-label']}>Te pregunta</div>
              <ul style={{ margin: '4px 0 0', paddingLeft: 20, display: 'grid', gap: 4 }}>{inf.preguntas.map((p, k) => <li key={k}>{p}</li>)}</ul>
              <Btn small onClick={() => irA('configuracion')} style={{ marginTop: 6 }}>Responder en la ficha</Btn>
            </div>
          )}
          {inf.aprendizajesSugeridos?.length > 0 && (
            <div>
              <div className={s['mini-label']}>Propone recordar</div>
              <div style={{ display: 'grid', gap: 6, marginTop: 4 }}>
                {inf.aprendizajesSugeridos.map((t, k) => <Sugerencia key={k} texto={t} yaEsta={aprendidos.some((x) => x.texto === t)} bump={bump} />)}
              </div>
            </div>
          )}
        </Bloque>
      )}
      <Senales senales={informe.senales} />
      <div className={s.hint} style={{ margin: 0 }}>
        {informe.modelo ? `${informe.modelo} · ${usd(informe.costoUsd)} · ` : ''}números de ventas al {fechaHora(informe.datosAl)}. Cada número del informe sale de tus datos: si algo no te cierra, comprobalo en la pantalla que indica.
      </div>
    </div>
  );
}

function Alerta({ a, i, informeId, opinion, onCambio }) {
  const { api, areas } = useCfg();
  const [enviando, setEnviando] = useState(false);
  const [err, setErr] = useState('');
  const opinar = async (valor) => {
    if (enviando) return;
    setEnviando(true); setErr('');
    try { await httpClient.put(`${api}/informes/${informeId}/opinion`, { alerta: i, valor }); onCambio(); } catch (e) { setErr(errorMsg(e)); } finally { setEnviando(false); }
  };
  const [pill, label] = PRIORIDAD[a.prioridad] ?? ['st-vencido', a.prioridad];
  return (
    <div className={cx(s.card, s.cardPad)} style={{ display: 'grid', gap: 8, opacity: opinion?.valor === 'no_aplica' ? 0.6 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Pill pill={pill} label={label} />
        <span className={s.hint} style={{ margin: 0 }}>{areas[a.area] ?? a.area}</span>
        <strong style={{ flex: '1 1 260px', fontSize: 15 }}>{a.titulo}</strong>
      </div>
      <div style={{ display: 'grid', gap: 6, lineHeight: 1.5 }}>
        <div><span className={s['mini-label']}>Qué pasa</span> {a.quePasa}</div>
        <div><span className={s['mini-label']}>Por qué importa</span> {a.porQueImporta}</div>
        <div className={cx(s.callout, s.info)} style={{ margin: 0 }}><strong>Qué haría:</strong> {a.queHacer}</div>
      </div>
      {a.numeros?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {a.numeros.map((n, k) => <span key={k} className={s.mono} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: 'var(--crm-color-surface-alt, rgba(0,0,0,0.05))' }}>{n}</span>)}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span className={s.hint} style={{ margin: 0, flex: 1, minWidth: 180 }}>Dónde verlo: {a.dondeVerlo}</span>
        {OPINIONES.map(([v, l]) => (
          <Btn key={v} small variant={opinion?.valor === v ? 'btn-primary' : undefined} disabled={enviando} onClick={() => opinar(v)} aria-pressed={opinion?.valor === v}>{l}</Btn>
        ))}
      </div>
      {err && <Aviso tono="warn">{err}</Aviso>}
    </div>
  );
}

function GranelInforme({ g }) {
  return (
    <Bloque titulo="Granel y fraccionado" sub={g.resumen}>
      {g.fraccionar?.length > 0 && (
        <div>
          <div className={s['mini-label']}>Conviene fraccionar</div>
          <div style={{ overflowX: 'auto' }}>
            <table className={s.table} style={{ fontSize: 13 }}>
              <thead><tr><th>Producto</th><th>Tamaño</th><th>Por qué</th></tr></thead>
              <tbody>{g.fraccionar.map((x, k) => <tr key={k}><td>{x.producto}</td><td style={{ whiteSpace: 'nowrap' }}>{x.tamano}</td><td>{x.motivo}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      )}
      {g.revisar?.length > 0 && (
        <div>
          <div className={s['mini-label']}>Para revisar</div>
          <ul style={{ margin: '4px 0 0', paddingLeft: 20, display: 'grid', gap: 4 }}>{g.revisar.map((x, k) => <li key={k}>{x}</li>)}</ul>
        </div>
      )}
    </Bloque>
  );
}

function Sugerencia({ texto, yaEsta, bump }) {
  const { api } = useCfg();
  const [guardada, setGuardada] = useState(yaEsta);
  const [err, setErr] = useState('');
  const guardar = async () => {
    setErr('');
    try { await httpClient.post(`${api}/aprendizajes`, { texto }); setGuardada(true); bump(); } catch (e) { setErr(errorMsg(e)); }
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ flex: '1 1 260px' }}>{texto}</span>
      {guardada ? <span className={s.hint} style={{ margin: 0 }}>Guardado</span> : <Btn small onClick={guardar}>Es así, guardalo</Btn>}
      {err && <span className={s.hint} style={{ margin: 0, color: 'var(--crm-color-danger)' }}>{err}</span>}
    </div>
  );
}

function Senales({ senales }) {
  const [abierto, setAbierto] = useState(false);
  const lista = senales ?? [];
  return (
    <Bloque
      titulo={`Lo que detectó el sistema (${lista.length})`}
      sub="Reglas fijas sobre tus números, sin IA: son el punto de partida del análisis."
      acciones={lista.length > 0 && <Btn small onClick={() => setAbierto((x) => !x)}>{abierto ? 'Ocultar' : 'Ver'}</Btn>}
    >
      {!lista.length ? <div className={s.hint} style={{ margin: 0 }}>Nada fuera de lo normal.</div> : abierto && (
        <div style={{ display: 'grid', gap: 6 }}>
          {lista.map((x, k) => (
            <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <Pill pill={NIVEL[x.nivel]?.[0]} label={NIVEL[x.nivel]?.[1] ?? x.nivel} />
              <strong>{x.titulo}</strong>
              <span className={s.hint} style={{ margin: 0 }}>{x.detalle}</span>
            </div>
          ))}
        </div>
      )}
    </Bloque>
  );
}

/* ==================================================================== *
 * Preguntar
 * ==================================================================== */
function Preguntar({ estado, bump }) {
  const { api, ejemplos } = useCfg();
  const [convId, setConvId] = useState(null);
  const [lista, setLista] = useState(0);
  const [pregunta, setPregunta] = useState('');
  const [esperando, setEsperando] = useState(null); // la pregunta que se está respondiendo
  const [error, setError] = useState('');
  const enVuelo = useRef(false);
  const fin = useRef(null);
  const { data: convs } = useResource(`${api}:convs:${lista}`, () => httpClient.get(`${api}/conversaciones`));
  const { data: conv, loading } = useResource(`${api}:conv:${convId}:${lista}`, () => httpClient.get(`${api}/conversaciones/${convId}`), { enabled: !!convId });
  const mensajes = convId ? (conv?.mensajes ?? []) : [];
  useEffect(() => { fin.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [mensajes.length, esperando]);

  const preguntar = async (texto) => {
    const q = String(texto ?? pregunta).trim();
    if (!q || enVuelo.current) return;
    enVuelo.current = true; setEsperando(q); setError(''); setPregunta('');
    try {
      /* Con herramientas puede tardar un minuto: más plazo que el de siempre. */
      const r = await httpClient.post(`${api}/preguntar`, { pregunta: q, ...(convId ? { conversacionId: convId } : {}) }, { timeoutMs: 5 * 60_000 });
      setConvId(r.id); setLista((n) => n + 1); bump();
    } catch (e) { setError(errorMsg(e)); setPregunta(q); } finally { enVuelo.current = false; setEsperando(null); }
  };
  const borrar = async () => {
    if (!convId || !window.confirm('¿Borrar esta conversación?')) return;
    try { await httpClient.delete(`${api}/conversaciones/${convId}`); setConvId(null); setLista((n) => n + 1); } catch (e) { setError(errorMsg(e)); }
  };
  const deshabilitado = !estado?.configurado;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className={s.toolbar} style={{ gap: 8, flexWrap: 'wrap' }}>
        <label htmlFor="asesor-conv" className={s.hint} style={{ margin: 0 }}>Conversación</label>
        <select id="asesor-conv" className={s['select-inline']} value={convId ?? ''} onChange={(e) => setConvId(e.target.value ? Number(e.target.value) : null)} style={{ maxWidth: 420 }}>
          <option value="">Nueva conversación</option>
          {(convs ?? []).map((c) => <option key={c.id} value={c.id}>{fechaHora(c.actualizadaEn)} · {c.titulo.slice(0, 60)}</option>)}
        </select>
        {convId && <Btn small onClick={() => setConvId(null)}>Nueva</Btn>}
        {convId && <Btn small variant="btn-delete" onClick={borrar}>Borrar</Btn>}
      </div>

      <div className={cx(s.card, s.cardPad)} style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 240 }}>
        {!mensajes.length && !esperando && (
          <div style={{ display: 'grid', gap: 8 }}>
            <div className={s.hint} style={{ margin: 0 }}>Preguntale lo que quieras de tus números: consulta el sistema en el momento para responder. Por ejemplo:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ejemplos.map((x) => <Btn key={x} small onClick={() => preguntar(x)} disabled={deshabilitado || !!esperando}>{x}</Btn>)}
            </div>
          </div>
        )}
        {convId && loading && !conv && <Cargando />}
        {mensajes.map((m) => <Mensaje key={m.id} m={m} />)}
        {esperando && (
          <>
            <Mensaje m={{ rol: 'user', texto: esperando }} />
            <div className={s.hint} style={{ margin: 0 }}>Buscando los números y pensando la respuesta… (puede tardar un minuto)</div>
          </>
        )}
        <div ref={fin} />
      </div>
      {error && <Aviso tono="warn">{error}</Aviso>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <textarea
          id="asesor-pregunta" value={pregunta} maxLength={2000} rows={2} disabled={deshabilitado || !!esperando}
          onChange={(e) => setPregunta(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); preguntar(); } }}
          placeholder={deshabilitado ? 'Falta la clave de la IA en el servidor.' : 'Escribí tu pregunta (Enter para enviar, Shift+Enter para otra línea)'}
          style={{ flex: '1 1 320px', minWidth: 0, resize: 'vertical' }}
        />
        <Btn variant="btn-primary" onClick={() => preguntar()} disabled={deshabilitado || !!esperando || pregunta.trim().length < 3}>Preguntar</Btn>
      </div>
    </div>
  );
}

function Mensaje({ m }) {
  if (m.rol === 'user') {
    return (
      <div style={{ alignSelf: 'flex-end', maxWidth: '85%', background: 'color-mix(in srgb, var(--crm-color-primary) 12%, transparent)', padding: '8px 12px', borderRadius: 12, whiteSpace: 'pre-wrap' }}>
        {m.texto}
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gap: 6, maxWidth: '100%' }}>
      <Markdown texto={m.texto} />
      <div className={s.hint} style={{ margin: 0 }}>
        {m.herramientas?.length ? `Consultó: ${m.herramientas.map((h) => h.replace(/_/g, ' ')).join(', ')} · ` : ''}{usd(m.costoUsd)}
      </div>
    </div>
  );
}

/* ==================================================================== *
 * Configuración
 * ==================================================================== */
function Configuracion({ estado, bump }) {
  const { api, ficha: textos, ConfigExtra } = useCfg();
  const [ficha, setFicha] = useState(estado?.ficha ?? '');
  const [tope, setTope] = useState(String(estado?.topeMensualUsd ?? ''));
  const [nuevo, setNuevo] = useState('');
  const [msg, setMsg] = useState(null);
  const [foto, setFoto] = useState(null);
  const [cargandoFoto, setCargandoFoto] = useState(false);
  useEffect(() => { if (estado) { setFicha(estado.ficha ?? ''); setTope(String(estado.topeMensualUsd ?? '')); } }, [estado?.ficha, estado?.topeMensualUsd]); // eslint-disable-line react-hooks/exhaustive-deps
  const hacer = async (fn, ok) => {
    setMsg(null);
    try { await fn(); setMsg({ tono: 'info', texto: ok }); bump(); } catch (e) { setMsg({ tono: 'warn', texto: errorMsg(e) }); }
  };
  const verFoto = async () => {
    setCargandoFoto(true); setMsg(null);
    try { setFoto(await httpClient.get(`${api}/foto`)); } catch (e) { setMsg({ tono: 'warn', texto: errorMsg(e) }); } finally { setCargandoFoto(false); }
  };
  if (!estado) return <Cargando />;
  const topeN = Number(tope);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {msg && <Aviso tono={msg.tono}>{msg.texto}</Aviso>}
      <Bloque titulo={textos.titulo} sub={textos.sub}>
        <textarea id="asesor-ficha" value={ficha} maxLength={8000} rows={8} onChange={(e) => setFicha(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
          placeholder={textos.ejemplo} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className={s.hint} style={{ margin: 0 }}>{ficha.length} / 8000</span>
          <Btn variant="btn-primary" small disabled={ficha === (estado.ficha ?? '')} onClick={() => hacer(() => httpClient.patch(`${api}/config`, { ficha }), 'Ficha guardada.')}>Guardar la ficha</Btn>
        </div>
      </Bloque>

      {ConfigExtra && <ConfigExtra />}

      <Bloque titulo="Lo que ya sabe" sub="Hechos de tu negocio que confirmaste (desde los análisis o escritos acá). Desactivá lo que ya no vale.">
        {!estado.aprendizajes?.length && <div className={s.hint} style={{ margin: 0 }}>Nada todavía.</div>}
        {estado.aprendizajes?.map((a) => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', opacity: a.activo ? 1 : 0.55 }}>
            <span style={{ flex: '1 1 260px' }}>{a.texto}</span>
            <Btn small onClick={() => hacer(() => httpClient.patch(`${api}/aprendizajes/${a.id}`, { activo: !a.activo }), a.activo ? 'Desactivado: ya no lo tiene en cuenta.' : 'Activado.')}>{a.activo ? 'Desactivar' : 'Activar'}</Btn>
            <Btn small variant="btn-delete" onClick={() => window.confirm('¿Borrarlo?') && hacer(() => httpClient.delete(`${api}/aprendizajes/${a.id}`), 'Borrado.')}>Borrar</Btn>
          </div>
        ))}
        <div className={s.toolbar} style={{ gap: 8 }}>
          <input id="asesor-aprendizaje" value={nuevo} maxLength={400} onChange={(e) => setNuevo(e.target.value)} placeholder="Agregar un hecho (ej.: Todo el fraccionado se hace en la Distribuidora)" style={{ flex: '1 1 320px', minWidth: 0 }} />
          <Btn small disabled={nuevo.trim().length < 5} onClick={() => hacer(async () => { await httpClient.post(`${api}/aprendizajes`, { texto: nuevo.trim() }); setNuevo(''); }, 'Agregado.')}>Agregar</Btn>
        </div>
      </Bloque>

      <Bloque titulo="Gasto de la IA" sub="Cada análisis cuesta unos centavos de dólar y cada pregunta, menos. Al llegar al tope del mes deja de llamar a la IA; las señales del sistema siguen.">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <div className={s['mini-label']}>Este mes</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{usd(estado.gastadoMesUsd)}</div>
            <div className={s.hint} style={{ margin: 0 }}>{estado.llamadasMes} llamada(s) · {estado.usoTopePct} % del tope · modelo {estado.modelo}</div>
          </div>
          <label htmlFor="asesor-tope" style={{ display: 'grid', gap: 4 }}>
            <span className={s['mini-label']}>Tope mensual (USD)</span>
            <input id="asesor-tope" type="number" min="0" step="1" inputMode="decimal" value={tope} onChange={(e) => setTope(e.target.value)} style={{ width: 120 }} />
          </label>
          <Btn small disabled={!(topeN >= 0) || tope === '' || topeN === estado.topeMensualUsd} onClick={() => hacer(() => httpClient.patch(`${api}/config`, { topeMensualUsd: topeN }), 'Tope guardado.')}>Guardar el tope</Btn>
        </div>
      </Bloque>

      <Bloque
        titulo="Los números que mira"
        sub="La foto del negocio tal cual la recibe la IA, y las señales del sistema. Sirve para comprobar de dónde sale cada cosa. No gasta IA."
        acciones={<Btn small onClick={verFoto} disabled={cargandoFoto}>{cargandoFoto ? 'Armando…' : foto ? 'Actualizar' : 'Ver'}</Btn>}
      >
        {foto && (
          <>
            <div className={s.hint} style={{ margin: 0 }}>{foto.tamano.caracteres.toLocaleString('es-AR')} caracteres (~{foto.tamano.tokensAprox.toLocaleString('es-AR')} tokens) · {foto.senales.length} señal(es)</div>
            <Senales senales={foto.senales} />
            <pre className={s.mono} style={{ maxHeight: 420, overflow: 'auto', fontSize: 11.5, margin: 0, padding: 10, background: 'var(--crm-color-surface-alt, rgba(0,0,0,0.04))', borderRadius: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {JSON.stringify(foto.foto, null, 2)}
            </pre>
          </>
        )}
      </Bloque>
    </div>
  );
}
