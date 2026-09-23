/**
 * ACTUALIZAR CATEGORÍA Y ETIQUETAS — sin volver a exportar el maestro (23/9/2026).
 * ============================================================================
 * El pedido del dueño después de «Actualizar costos»: no quería tocar cada
 * ficha a mano para reclasificar muchos productos. El archivo es el mismo que
 * ya arma «Exportar CSV» — se exporta, se editan las columnas Categoría,
 * Subcategoría y Etiquetas en la planilla, y se vuelve a subir acá.
 *
 * No hay paso de proveedor (esto no es de compras) ni de "cómo se importa":
 * un solo archivo, una vista previa, confirmar. Todo el plan se arma en el
 * navegador contra `store.state.productos` y `store.state.catalogos` — la API
 * recién se toca al confirmar.
 */
import { useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../../context/ProductosContext.jsx';
import { num as fmtNum } from '../../domain/format.js';
import { armarPlanClasificacion } from '../../domain/actualizarClasificacion.js';
import { leerCsv } from '@shared/utils/csv.js';
import { ModalShell } from '../Modal.jsx';
import { Table, s } from '../ui.jsx';

const ETIQUETA_ESTADO = {
  aplica: { texto: 'Se aplica', color: 'var(--crm-color-success)' },
  no_encontrado: { texto: 'No hay producto con este código', color: 'var(--crm-color-warning)' },
  archivado: { texto: 'Está archivado', color: 'var(--crm-color-warning)' },
  repetido: { texto: 'Código repetido en el archivo', color: 'var(--crm-color-warning)' },
  sin_codigo: { texto: 'Sin código', color: 'var(--crm-color-warning)' },
  vacio: { texto: 'Sin categoría ni etiquetas en el renglón', color: 'var(--crm-color-text-muted)' },
};

/** Lee el archivo como texto: UTF-8 primero, y si falla, windows-1252. */
async function leerTexto(file) {
  const buf = await file.arrayBuffer();
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
  catch { return new TextDecoder('windows-1252').decode(buf); }
}

export function ActualizarClasificacionModal() {
  const { store, closeModal, toast } = useProductos();
  const [paso, setPaso] = useState(1);
  const [archivo, setArchivo] = useState(null); // { nombre, filas }
  const [leyendo, setLeyendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const cargar = async (files) => {
    const file = files[0];
    if (!file) return;
    setLeyendo(true);
    try {
      const texto = await leerTexto(file);
      const { cols, filas } = leerCsv(texto);
      if (!cols.includes('Código interno')) {
        toast(`${file.name} no tiene la columna "Código interno" — ¿es el CSV que exportó este sistema?`, 'err');
      } else {
        setArchivo({ nombre: file.name, filas });
      }
    } catch {
      toast(`No pude leer ${file.name}.`, 'err');
    }
    setLeyendo(false);
  };

  const plan = useMemo(() => {
    if (!archivo) return null;
    return armarPlanClasificacion(archivo.filas, store.state.productos, store.state.catalogos);
  }, [archivo, store]);

  const continuar = () => {
    if (!archivo) { toast('Elegí el archivo.', 'err'); return; }
    setPaso(2);
  };

  const confirmar = async () => {
    setGuardando(true);
    const res = await store.actualizarClasificacion(plan.items);
    setGuardando(false);
    if (!res.ok) { toast(res.error || 'No se pudo actualizar.', 'err'); return; }
    const r = res.data ?? res;
    setResultado(r);
    toast(`${r.actualizados?.length ?? 0} producto(s) actualizado(s).`, 'ok');
  };

  /* ------------------------------- resultado ------------------------------- */
  if (resultado) {
    return (
      <ModalShell title="Clasificación actualizada" wide onClose={closeModal} footer={[{ texto: 'Listo', clase: 'btn-primary', onClick: closeModal }]}>
        <div className={cx(s.callout, s.ok)}>
          <strong>{resultado.actualizados?.length ?? 0}</strong> producto(s) actualizado(s).
          {resultado.categoriasCreadas?.length > 0 && <> Categorías nuevas: {resultado.categoriasCreadas.join(', ')}.</>}
          {resultado.etiquetasCreadas?.length > 0 && <> Etiquetas nuevas: {resultado.etiquetasCreadas.join(', ')}.</>}
        </div>
        {resultado.actualizados?.length > 0 && (
          <Table cols={[{ h: 'Código' }, { h: 'Producto' }]}>
            {resultado.actualizados.map((x, i) => (
              <tr key={i}><td className={s.mono}>{x.codigo}</td><td>{x.nombre}</td></tr>
            ))}
          </Table>
        )}
        {resultado.noEncontrados?.length > 0 && (
          <>
            <div className={s['section-title']}>No encontrados ({resultado.noEncontrados.length})</div>
            <div className={s.hint} style={{ marginTop: 0 }}>
              Ningún producto tiene este código. Cargalo primero en Compras › Productos y volvé a
              importar el archivo — no se toca nada por estos códigos.
            </div>
            <Table cols={[{ h: 'Código' }, { h: 'Por qué' }]}>
              {resultado.noEncontrados.map((x, i) => (
                <tr key={i}><td className={s.mono}>{x.codigo || '—'}</td><td>{x.motivo}</td></tr>
              ))}
            </Table>
          </>
        )}
        {resultado.saltados?.length > 0 && (
          <>
            <div className={s['section-title']}>Saltados ({resultado.saltados.length})</div>
            <Table cols={[{ h: 'Código' }, { h: 'Producto' }, { h: 'Por qué' }]}>
              {resultado.saltados.map((x, i) => (
                <tr key={i}><td className={s.mono}>{x.codigo}</td><td>{x.nombre || '—'}</td><td>{x.motivo}</td></tr>
              ))}
            </Table>
          </>
        )}
      </ModalShell>
    );
  }

  const footer = paso === 2
    ? [
      { texto: 'Volver', clase: 'btn-ghost', onClick: () => setPaso(1) },
      {
        texto: guardando ? 'Actualizando…' : `Actualizar ${plan?.resumen.aplica ?? 0} producto(s)`,
        clase: 'btn-primary',
        onClick: guardando || !plan || !plan.resumen.aplica ? () => {} : confirmar,
      },
    ]
    : [
      { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
      { texto: 'Continuar', clase: 'btn-primary', onClick: continuar },
    ];

  return (
    <ModalShell
      title="Actualizar categoría y etiquetas"
      subtitle={paso === 1 ? 'Paso 1 de 2 · Archivo' : 'Paso 2 de 2 · Vista previa'}
      size="lg"
      onClose={closeModal}
      footer={footer}
    >
      {paso === 1 && (
        <>
          <div className={cx(s.callout, s.info)}>
            El mismo archivo que baja <strong>«Exportar CSV»</strong>: exportalo, editá las columnas
            <strong> Categoría</strong>, <strong>Subcategoría</strong> y <strong>Etiquetas</strong> en la
            planilla (las etiquetas van separadas por coma dentro de la celda), y subilo acá. Una
            columna vacía no toca ese campo — no hace falta completar todas.
          </div>

          <label
            style={{
              display: 'block', border: '2px dashed var(--crm-color-border)', borderRadius: 10,
              padding: 22, textAlign: 'center', cursor: 'pointer', marginBottom: 14,
            }}
          >
            <input
              type="file" accept=".csv,text/csv" style={{ display: 'none' }}
              onChange={(e) => { cargar([...e.target.files]); e.target.value = ''; }}
            />
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              {leyendo ? 'Leyendo…' : 'Elegí el archivo .csv'}
            </div>
            <div className={s.hint} style={{ margin: 0 }}>El que exportaste con «Exportar CSV», editado.</div>
          </label>

          {archivo && (
            <div className={cx(s.callout, s.ok)}>
              <strong>{archivo.nombre}</strong> · {fmtNum(archivo.filas.length, 0)} renglones
            </div>
          )}
        </>
      )}

      {paso === 2 && plan && (
        <>
          <div className={cx(s.callout, s.ok)}>
            <strong>{plan.resumen.aplica}</strong> producto(s) se actualizan
            {plan.resumen.noEncontrados > 0 && <> · <strong>{plan.resumen.noEncontrados}</strong> sin producto</>}
            {plan.resumen.archivados > 0 && <> · {plan.resumen.archivados} archivado(s)</>}
            {plan.resumen.repetidos > 0 && <> · {plan.resumen.repetidos} repetido(s) en el archivo</>}
          </div>

          {plan.resumen.noEncontrados > 0 && (
            <div className={cx(s.callout, s.warn)}>
              Hay <strong>{plan.resumen.noEncontrados}</strong> código(s) que no matchean ningún
              producto tuyo — no se van a tocar.
            </div>
          )}

          {/* `vacio` (el renglón no traía nada), `sin_cambios` (ya estaba
              así) y `sin_codigo` (el producto nunca tuvo código interno) no
              aportan nada para mirar — con el catálogo entero reexportado,
              son la enorme mayoría de las filas y solo tapan lo que sí
              importa. Quedan contados en el resumen de abajo, no en la tabla. */}
          <Table cols={[{ h: 'Código' }, { h: 'Producto' }, { h: 'Categoría' }, { h: 'Subcategoría' }, { h: 'Etiquetas' }, { h: 'Estado' }]}>
            {plan.filas.filter((f) => !['vacio', 'sin_cambios', 'sin_codigo'].includes(f.estado)).map((f, i) => {
              const et = ETIQUETA_ESTADO[f.estado];
              return (
                <tr key={i}>
                  <td className={s.mono}>{f.codigo || '—'}</td>
                  <td>{f.nombre || <span className={s.muted}>—</span>}</td>
                  <td>
                    {f.categoria || <span className={s.muted}>—</span>}
                    {f.categoriaNueva && <span className={s.hint} style={{ margin: 0 }}> (se crea)</span>}
                  </td>
                  <td>
                    {f.subcategoria || <span className={s.muted}>—</span>}
                    {f.subcategoriaNueva && <span className={s.hint} style={{ margin: 0 }}> (se crea)</span>}
                  </td>
                  <td>
                    {f.etiquetas?.length ? f.etiquetas.join(', ') : <span className={s.muted}>—</span>}
                    {f.etiquetasNuevas?.length > 0 && (
                      <span className={s.hint} style={{ margin: 0 }}> ({f.etiquetasNuevas.length} se crea{f.etiquetasNuevas.length === 1 ? '' : 'n'})</span>
                    )}
                  </td>
                  <td style={{ color: et.color, fontWeight: 600, fontSize: 13 }}>{et.texto}</td>
                </tr>
              );
            })}
          </Table>

          <div className={s.hint}>
            Las etiquetas del renglón <strong>reemplazan</strong> el juego completo del producto —
            igual que el selector de la ficha. Si un producto no trae la columna Etiquetas, las suyas
            quedan como estaban. No se muestran acá los{' '}
            {plan.resumen.vacios + plan.resumen.sinCambios + plan.resumen.sinCodigo} renglón(es) sin
            nada que cambiar — el catálogo reexportado entero trae uno por cada producto que no
            tocaste en la planilla, o que nunca tuvo código interno.
          </div>
        </>
      )}
    </ModalShell>
  );
}
