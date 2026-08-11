/**
 * INFO DE SISTEMA — renderer
 * ============================================================================
 * Genérico a propósito: entiende los tipos de bloque de `content/manual.js` y
 * nada más. Sumar documentación es editar ese archivo; este componente no se
 * toca.
 *
 * Todo el contenido es estático y vive en memoria, así que no hay llamadas a la
 * API ni estado que sincronizar: la sección abre instantánea y no le cuesta
 * nada al resto del sistema.
 */
import { useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { MANUAL } from '../content/manual.js';
import s from '../styles/Manual.module.css';

/** Texto comparable para el buscador: sin acentos ni mayúsculas. */
function norm(v) {
  return (v || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

/**
 * Cuándo se tocó por última vez una sección: la marca MÁS NUEVA de sus temas.
 * Se deriva y no se guarda aparte — así la sección no puede decir una fecha
 * mientras su tema más nuevo dice otra.
 *
 * `actualizado` es 'AAAA-MM-DD' y, cuando importa desempatar dentro del día,
 * 'AAAA-MM-DD HH:MM'. Ese formato ordena igual como texto que como fecha, así
 * que se compara directo: no hace falta construir Date (ni hay dónde
 * equivocarse con la zona horaria). Sin hora ordena al comienzo del día, que
 * es exactamente lo que significa.
 */
function fechaDe(sec) {
  return (sec.temas || []).reduce((max, t) => (t.actualizado > max ? t.actualizado : max), '');
}

/** '2026-08-06 18:53' → '6/8/2026'. La hora solo sirve para ordenar. */
function fmtFecha(marca) {
  if (!marca) return '';
  // Con T00:00:00 para que no se corra un día (UTC−3), y sin la hora pegada.
  return new Date(`${marca.slice(0, 10)}T00:00:00`).toLocaleDateString('es-AR');
}

const porFechaDesc = (a, b) => (b.actualizado || '').localeCompare(a.actualizado || '');

/**
 * `**negrita**` y `*cursiva*` → <strong> / <em>. Los dos únicos formatos que
 * admite el contenido.
 *
 * La negrita se resuelve PRIMERO y la cursiva se busca dentro de cada trozo
 * suelto: al revés, un `**` se comería como dos cursivas vacías. Lo que no
 * cierra queda como texto tal cual — es un manual, no un editor.
 */
function Texto({ children }) {
  const negritas = String(children).split(/\*\*(.+?)\*\*/g);
  return negritas.map((p, i) => {
    if (i % 2) return <strong key={i}>{p}</strong>;
    return p.split(/\*([^*]+?)\*/g).map((q, j) => (j % 2 ? <em key={`${i}-${j}`}>{q}</em> : q));
  });
}

function Bloque({ b }) {
  switch (b.t) {
    case 'p':
      return <p className={s.parrafo}><Texto>{b.texto}</Texto></p>;

    case 'lista':
      return (
        <ul className={s.lista}>
          {b.items.map((it, i) => <li key={i}><Texto>{it}</Texto></li>)}
        </ul>
      );

    case 'pasos':
      return (
        <ol className={s.pasos}>
          {b.items.map((it, i) => <li key={i}><Texto>{it}</Texto></li>)}
        </ol>
      );

    case 'flujo':
      return (
        <div className={s.flujo}>
          {b.items.map((it, i) => (
            <span key={i} className={s.flujoItem}>{it}</span>
          ))}
        </div>
      );

    case 'tabla':
      return (
        <div className={s.tablaWrap}>
          <table className={s.tabla}>
            <thead>
              <tr>{b.cols.map((c, i) => <th key={i}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {b.filas.map((f, i) => (
                <tr key={i}>{f.map((c, j) => <td key={j}><Texto>{c}</Texto></td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'nota':
      return (
        <div className={cx(s.nota, s[`nota-${b.tono || 'info'}`])}>
          <Texto>{b.texto}</Texto>
        </div>
      );

    case 'ejemplo':
      return (
        <div className={s.ejemplo}>
          <div className={s.ejemploTitulo}>{b.titulo}</div>
          <pre className={s.ejemploCuerpo}>{b.lineas.join('\n')}</pre>
        </div>
      );

    case 'ruta':
      return (
        <div className={s.ruta}>
          <span className={s.rutaEtiqueta}>Dónde</span>
          {b.texto}
        </div>
      );

    default:
      return null;
  }
}

export function ManualPage() {
  const [seccionId, setSeccionId] = useState(MANUAL[0].id);
  const [q, setQ] = useState('');
  /**
   * 'tema' = el orden curado (de lo básico a lo específico: así se aprende el
   * sistema). 'fecha' = lo último que se tocó primero, para retomar sin buscar
   * qué cambió.
   */
  const [orden, setOrden] = useState('tema');

  /** El orden del ÍNDICE. Por fecha, manda el tema más nuevo de cada sección. */
  const secciones = useMemo(
    () => (orden === 'fecha'
      ? [...MANUAL].sort((a, b) => fechaDe(b).localeCompare(fechaDe(a)))
      : MANUAL),
    [orden],
  );

  // Al pasar a "Reciente" se salta solo a lo más nuevo: es lo que se fue a ver.
  const cambiarOrden = (modo) => {
    setOrden(modo);
    if (modo === 'fecha') {
      const masNueva = [...MANUAL].sort((a, b) => fechaDe(b).localeCompare(fechaDe(a)))[0];
      if (masNueva) { setQ(''); setSeccionId(masNueva.id); }
    }
  };

  /**
   * Índice de búsqueda: se arma UNA vez. Aplana cada tema a una sola cadena
   * comparable, así filtrar es un `includes` por tema y no un recorrido del
   * árbol entero en cada tecla.
   */
  const indice = useMemo(() => {
    const filas = [];
    for (const sec of MANUAL) {
      for (const tema of sec.temas) {
        const trozos = [sec.titulo, tema.titulo];
        for (const b of tema.bloques) {
          if (b.texto) trozos.push(b.texto);
          if (b.titulo) trozos.push(b.titulo);
          if (b.items) trozos.push(b.items.join(' '));
          if (b.lineas) trozos.push(b.lineas.join(' '));
          if (b.cols) trozos.push(b.cols.join(' '));
          if (b.filas) trozos.push(b.filas.flat().join(' '));
        }
        filas.push({ seccionId: sec.id, temaId: tema.id, texto: norm(trozos.join(' ')) });
      }
    }
    return filas;
  }, []);

  const buscando = q.trim().length >= 2;

  /** Con búsqueda activa: qué temas sobreviven, por sección. */
  const coincidencias = useMemo(() => {
    if (!buscando) return null;
    const n = norm(q);
    const porSeccion = new Map();
    for (const f of indice) {
      if (!f.texto.includes(n)) continue;
      const arr = porSeccion.get(f.seccionId);
      if (arr) arr.add(f.temaId); else porSeccion.set(f.seccionId, new Set([f.temaId]));
    }
    return porSeccion;
  }, [buscando, q, indice]);

  // Buscando se muestran todas las secciones con resultados; si no, la elegida.
  // En los dos casos se respeta el orden activo.
  const visibles = buscando
    ? secciones.filter((sec) => coincidencias.has(sec.id))
    : secciones.filter((sec) => sec.id === seccionId);

  const temasDe = (sec) => {
    const base = buscando
      ? sec.temas.filter((t) => coincidencias.get(sec.id)?.has(t.id))
      : sec.temas;
    return orden === 'fecha' ? [...base].sort(porFechaDesc) : base;
  };

  return (
    <div className={s.pagina}>
      <div className={s.cabecera}>
        <div>
          <h1 className={s.titulo}>Info de sistema</h1>
          <p className={s.bajada}>
            Cómo trabajan los procesos y por qué están así. Ante la duda de si algo es un error o
            una decisión, la respuesta está acá.
          </p>
        </div>
        <div className={s.herramientas}>
          <input
            className={s.buscador}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar en todo el manual…"
          />
          <div className={s.orden} role="group" aria-label="Orden del manual">
            <span className={s.ordenEtiqueta}>Orden</span>
            <button
              type="button"
              className={cx(s.ordenBtn, orden === 'tema' && s.ordenActivo)}
              onClick={() => cambiarOrden('tema')}
              title="De lo básico a lo específico, como para aprender el sistema"
            >
              Temático
            </button>
            <button
              type="button"
              className={cx(s.ordenBtn, orden === 'fecha' && s.ordenActivo)}
              onClick={() => cambiarOrden('fecha')}
              title="Lo último que se tocó, primero"
            >
              Reciente
            </button>
          </div>
        </div>
      </div>

      <div className={s.cuerpo}>
        {/* Índice */}
        <nav className={s.indice}>
          {secciones.map((sec) => {
            const hits = buscando ? coincidencias.get(sec.id)?.size ?? 0 : null;
            return (
              <button
                key={sec.id}
                type="button"
                className={cx(
                  s.indiceItem,
                  !buscando && sec.id === seccionId && s.indiceActivo,
                  buscando && !hits && s.indiceApagado,
                )}
                onClick={() => { setQ(''); setSeccionId(sec.id); }}
              >
                <span className={s.indiceTitulo}>
                  {sec.titulo}
                  {hits ? <span className={s.indiceHits}>{hits}</span> : null}
                  {/* La fecha se muestra solo cuando ES el criterio de orden:
                      en el orden temático sería un dato al costado. */}
                  {orden === 'fecha' && <span className={s.indiceFecha}>{fmtFecha(fechaDe(sec))}</span>}
                </span>
                <span className={s.indiceResumen}>{sec.resumen}</span>
              </button>
            );
          })}
        </nav>

        {/* Contenido */}
        <div className={s.contenido}>
          {buscando && visibles.length === 0 && (
            <div className={s.vacio}>
              Sin resultados para <strong>{q}</strong>.
            </div>
          )}

          {visibles.map((sec) => (
            <section key={sec.id}>
              {buscando && <h2 className={s.seccionTitulo}>{sec.titulo}</h2>}
              {temasDe(sec).map((tema) => (
                <article key={tema.id} className={s.tema}>
                  <h3 className={s.temaTitulo}>
                    <span>{tema.titulo}</span>
                    {tema.actualizado && (
                      <span
                        className={s.temaFecha}
                        title={`Última vez que se tocó esta parte: ${tema.actualizado}`}
                      >
                        {fmtFecha(tema.actualizado)}
                      </span>
                    )}
                  </h3>
                  {tema.bloques.map((b, i) => <Bloque key={i} b={b} />)}
                </article>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
