/**
 * ACTUALIZAR COSTOS DE UN PROVEEDOR — sin volver a exportar el catálogo (23/9/2026).
 * ============================================================================
 * El pedido del dueño: cuando el catálogo ya está cargado (productos y precios
 * de venta hechos), volver a exportar y subir el maestro entero solo para
 * cambiarle el costo a un proveedor es doble trabajo. Acá alcanza con UN
 * archivo — el de formatos de compra — y el matching es por código interno
 * contra el catálogo que YA ESTÁ EN MEMORIA (`store.state.productos`).
 *
 * No crea productos: un código que no matchea no tiene de dónde sacar nombre,
 * marca ni categoría, y una ficha a medias es peor que no importarla. Queda
 * listado en "No encontrados" para cargarlo primero en Compras › Productos.
 *
 * Dos pasos, no tres: sin maestro no hay nada que decidir sobre listas de
 * venta ni presentaciones — este archivo no las toca.
 */
import { useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../../context/ProductosContext.jsx';
import { money, num as fmtNum } from '../../domain/format.js';
import {
  armarPlanCostos, leerTexto, parseCsv, proveedorDelArchivo, tipoDeArchivo,
} from '../../domain/importarCatalogo.js';
import { mismoNombreProveedor, proveedoresParecidos } from '@modules/proveedores/domain/importarProveedores.js';
import { ModalShell } from '../Modal.jsx';
import { Table, s } from '../ui.jsx';

const ETIQUETA_ESTADO = {
  actualiza: { texto: 'Actualiza el costo', color: 'var(--crm-color-success)' },
  agrega: { texto: 'Agrega el proveedor', color: 'var(--crm-color-success)' },
  no_encontrado: { texto: 'No hay producto con este código', color: 'var(--crm-color-warning)' },
  archivado: { texto: 'Está archivado', color: 'var(--crm-color-warning)' },
  repetido: { texto: 'Código repetido en el archivo', color: 'var(--crm-color-warning)' },
  sin_codigo: { texto: 'Sin código', color: 'var(--crm-color-warning)' },
};

export function ImportarCostosModal() {
  const { store, closeModal, toast } = useProductos();
  const [paso, setPaso] = useState(1);
  const [archivo, setArchivo] = useState(null); // { nombre, filas }
  const [leyendo, setLeyendo] = useState(false);
  const [proveedorId, setProveedorId] = useState('');
  const [modoProveedor, setModoProveedor] = useState('existente');
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const proveedores = store.state.proveedores.filter((p) => p.proveeMercaderia !== false);

  /* Mismo mecanismo que el importador de catálogo completo: el archivo trae
   * la columna Proveedor y se preselecciona contra el padrón. */
  const deteccion = useMemo(() => {
    const d = proveedorDelArchivo(archivo?.filas);
    if (!d) return null;
    const exacto = proveedores.find((p) => mismoNombreProveedor(p.nombre, d.nombre)) || null;
    const candidatos = exacto ? [] : proveedoresParecidos(d.nombre, proveedores);
    if (exacto && !proveedorId) setProveedorId(String(exacto.id));
    return { ...d, exacto, candidatos };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archivo, proveedores]);

  const cargar = async (files) => {
    const file = files[0];
    if (!file) return;
    setLeyendo(true);
    try {
      const texto = await leerTexto(file);
      const { cols, filas } = parseCsv(texto);
      if (tipoDeArchivo(cols) !== 'compras') {
        toast(`${file.name} no tiene las columnas del listado de formatos de compra.`, 'err');
      } else {
        setArchivo({ nombre: file.name, filas });
      }
    } catch {
      toast(`No pude leer ${file.name}.`, 'err');
    }
    setLeyendo(false);
  };

  const plan = useMemo(() => {
    if (!archivo || !proveedorId) return null;
    return armarPlanCostos(archivo.filas, store.state.productos, Number(proveedorId), store.costoNetoEntry);
  }, [archivo, proveedorId, store]);

  const continuar = () => {
    if (!archivo) { toast('Elegí el archivo de formatos de compra.', 'err'); return; }
    const creaNuevo = deteccion && !deteccion.exacto && modoProveedor === 'nuevo';
    if (!creaNuevo && !proveedorId) { toast('Elegí de qué proveedor son estos costos.', 'err'); return; }
    setPaso(2);
  };

  const importar = async () => {
    setGuardando(true);
    let provId = Number(proveedorId);
    if (deteccion && !deteccion.exacto && modoProveedor === 'nuevo') {
      const r = await store.crearProveedor({ nombre: deteccion.nombre, proveeMercaderia: true });
      if (!r || r.ok === false) {
        setGuardando(false);
        toast(r?.error || 'No se pudo crear el proveedor.', 'err');
        return;
      }
      provId = r.id;
      setProveedorId(String(provId));
    }
    const res = await store.importarCostos(provId, plan.items);
    setGuardando(false);
    if (!res.ok) { toast(res.error || 'No se pudo importar.', 'err'); return; }
    const r = res.data ?? res;
    setResultado(r);
    const n = (r.actualizados?.length ?? 0) + (r.agregados?.length ?? 0);
    toast(`${n} costo(s) importado(s).`, 'ok');
  };

  /* ------------------------------- resultado ------------------------------- */
  if (resultado) {
    return (
      <ModalShell title="Costos actualizados" wide onClose={closeModal} footer={[{ texto: 'Listo', clase: 'btn-primary', onClick: closeModal }]}>
        <div className={cx(s.callout, s.ok)}>
          <strong>{resultado.actualizados?.length ?? 0}</strong> costo(s) actualizado(s) y{' '}
          <strong>{resultado.agregados?.length ?? 0}</strong> agregado(s), de <strong>{resultado.proveedor}</strong>.
        </div>
        {resultado.agregados?.length > 0 && (
          <>
            <div className={s['section-title']}>Se agregaron ({resultado.agregados.length})</div>
            <Table cols={[{ h: 'Código' }, { h: 'Producto' }, { h: 'Precio' }]}>
              {resultado.agregados.map((x, i) => (
                <tr key={i}>
                  <td className={s.mono}>{x.codigo}</td>
                  <td>{x.nombre}</td>
                  <td>{x.fijaPrecio ? 'Pasa a fijar el precio (no tenía ningún costo cargado)' : 'Lo sigue fijando otro proveedor'}</td>
                </tr>
              ))}
            </Table>
          </>
        )}
        {resultado.actualizados?.length > 0 && (
          <>
            <div className={s['section-title']}>Se actualizaron ({resultado.actualizados.length})</div>
            <Table cols={[{ h: 'Código' }, { h: 'Producto' }]}>
              {resultado.actualizados.map((x, i) => (
                <tr key={i}><td className={s.mono}>{x.codigo}</td><td>{x.nombre}</td></tr>
              ))}
            </Table>
          </>
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
        texto: guardando ? 'Importando…' : `Importar ${(plan?.resumen.actualiza ?? 0) + (plan?.resumen.agrega ?? 0)} costo(s)`,
        clase: 'btn-primary',
        onClick: guardando || !plan || (plan.resumen.actualiza + plan.resumen.agrega === 0) ? () => {} : importar,
      },
    ]
    : [
      { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
      { texto: 'Continuar', clase: 'btn-primary', onClick: continuar },
    ];

  return (
    <ModalShell
      title="Actualizar costos de un proveedor"
      subtitle={paso === 1 ? 'Paso 1 de 2 · Archivo' : 'Paso 2 de 2 · Vista previa'}
      size="lg"
      onClose={closeModal}
      footer={footer}
    >
      {paso === 1 && (
        <>
          <div className={cx(s.callout, s.info)}>
            Un solo archivo: el <strong>Formato de compra</strong> que exporta el sistema de gestión
            anterior. No hace falta el listado de productos — se busca cada código contra tu
            catálogo, que ya está cargado, y solo se le agrega o actualiza el costo. Un código que
            no encuentra producto no crea nada: queda listado para cargarlo a mano.
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
            <div className={s.hint} style={{ margin: 0 }}>Formatos de compra, tal como lo exporta el sistema viejo.</div>
          </label>

          {archivo && (
            <div className={cx(s.callout, s.ok)} style={{ marginBottom: 14 }}>
              <strong>{archivo.nombre}</strong> · {fmtNum(archivo.filas.length, 0)} renglones
            </div>
          )}

          {deteccion && !deteccion.exacto && (
            <div className={cx(s.callout, s.warn)}>
              El archivo dice que estos costos son de <strong>«{deteccion.nombre}»</strong>, y en el
              padrón no hay ningún proveedor con ese nombre exacto.
              {deteccion.candidatos.length > 0 && (
                <> Hay {deteccion.candidatos.length === 1 ? 'uno parecido' : 'parecidos'}:{' '}
                  <strong>{deteccion.candidatos.map((c) => c.nombre).join(' · ')}</strong>.</>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="radio" checked={modoProveedor === 'existente'} onChange={() => setModoProveedor('existente')} />
                  <span>Es uno que <strong>ya está cargado</strong> con otro nombre — lo elijo abajo</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="radio" checked={modoProveedor === 'nuevo'} onChange={() => setModoProveedor('nuevo')} />
                  <span>Es un proveedor <strong>nuevo</strong>: crearlo como «{deteccion.nombre}» al importar</span>
                </label>
              </div>
            </div>
          )}

          <div className={s.field}>
            <label>Proveedor de estos costos <span className={s.req}>*</span></label>
            <select
              value={proveedorId}
              onChange={(e) => setProveedorId(e.target.value)}
              disabled={deteccion && !deteccion.exacto && modoProveedor === 'nuevo'}
            >
              <option value="">Elegí el proveedor</option>
              {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
            {deteccion?.exacto && (
              <div className={s.hint} style={{ margin: '6px 0 0' }}>Detectado del archivo: <strong>«{deteccion.nombre}»</strong>.</div>
            )}
          </div>
        </>
      )}

      {paso === 2 && plan && (
        <>
          <div className={cx(s.callout, s.ok)}>
            <strong>{plan.resumen.actualiza}</strong> costo(s) se actualizan ·{' '}
            <strong>{plan.resumen.agrega}</strong> se agregan
            {plan.resumen.noEncontrados > 0 && <> · <strong>{plan.resumen.noEncontrados}</strong> sin producto</>}
            {plan.resumen.archivados > 0 && <> · {plan.resumen.archivados} archivado(s)</>}
            {plan.resumen.repetidos > 0 && <> · {plan.resumen.repetidos} repetido(s) en el archivo</>}
          </div>

          {plan.resumen.noEncontrados > 0 && (
            <div className={cx(s.callout, s.warn)}>
              Hay <strong>{plan.resumen.noEncontrados}</strong> código(s) que no matchean ningún
              producto tuyo — no se van a crear. Cargalos primero en Compras › Productos si son
              nuevos, o revisá que el código interno sea el mismo en los dos sistemas.
            </div>
          )}

          <Table cols={[{ h: 'Código' }, { h: 'Producto' }, { h: 'Costo anterior', num: true }, { h: 'Costo nuevo', num: true }, { h: 'Estado' }]}>
            {plan.filas.map((f, i) => {
              const et = ETIQUETA_ESTADO[f.estado];
              return (
                <tr key={i}>
                  <td className={s.mono}>{f.codigo || '—'}</td>
                  <td>{f.nombre || <span className={s.muted}>—</span>}</td>
                  <td className={s.num}>{f.costoAnterior != null ? money(f.costoAnterior) : <span className={s.muted}>—</span>}</td>
                  <td className={s.num}>{f.netoUnit != null ? money(f.netoUnit) : <span className={s.muted}>—</span>}</td>
                  <td style={{ color: et.color, fontWeight: 600, fontSize: 13 }}>{et.texto}</td>
                </tr>
              );
            })}
          </Table>
        </>
      )}
    </ModalShell>
  );
}
