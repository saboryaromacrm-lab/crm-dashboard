/**
 * LOS PRODUCTOS QUE ELABORA LA CAFETERÍA — su propia puerta al catálogo.
 * ============================================================================
 * La cafetería no entra a Compras › Productos: esa llave abre el catálogo
 * entero, con costos, márgenes y proveedores. Pero necesita poder dar de alta
 * lo que empieza a hacer sin pedírselo a alguien y esperar — y lo que hace no
 * se compra, así que de una ficha de producto solo le aplican tres cosas:
 * cómo se llama, si se cuenta o se pesa, y a cuánto se vende en el mostrador.
 *
 * Esto es esa puerta chica. Muestra SOLO lo marcado como elaborado por ella
 * (la misma lista blanca que habilita el envío), y el candado de verdad está
 * en la API: mirar es de toda la sección, escribir solo de quien carga las
 * entradas — el café y el administrador.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useProductos } from '../context/ProductosContext.jsx';
import { money, num } from '../domain/format.js';
import { antiguedad, esVozDelCafe, vozCafeteria } from '../domain/cafeteria.voz.js';
import { Table, PanelHead, Btn, Pill, usePaginado, s } from '../components/ui.jsx';

export function CafeteriaProductosPanel() {
  const { store, openModal, toast, can } = useProductos();
  const v = useMemo(() => vozCafeteria(esVozDelCafe(can)), [can]);
  /* La misma llave que la API pide para escribir. La cajera ve la lista pero
   * no los botones: ofrecer uno que iba a rebotar es peor que no ofrecerlo. */
  const puedeCargar = can('almacen.cafeteria-entradas');

  /** El color de un número viejo. Tres tonos y nada más: verde no existe —
   *  que esté al día es lo normal, no un logro. */
  const TONO = {
    ok: 'var(--crm-color-text-muted)',
    aviso: 'var(--crm-color-warning)',
    mal: 'var(--crm-color-danger)',
  };
  /** "actualizado hace 2 meses", con el color que corresponde. */
  const Desde = ({ dias, nuncaTexto }) => {
    const a = antiguedad(dias);
    return (
      <div
        className={s.hint}
        style={{ margin: 0, color: TONO[a.tono], fontWeight: a.tono === 'ok' ? 400 : 600 }}
      >
        {a.nunca ? (nuncaTexto ?? 'nunca se cargó') : `actualizado ${a.texto}`}
      </div>
    );
  };

  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [verBajas, setVerBajas] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try { setDatos(await store.productosCafeteria()); }
    catch { toast('No se pudieron cargar los productos.', 'err'); }
    finally { setCargando(false); }
  }, [store, toast]);
  useEffect(() => { cargar(); }, [cargar]);

  const lista = useMemo(
    () => (datos?.productos ?? []).filter((p) => verBajas || p.estado !== 'archivado'),
    [datos, verBajas],
  );
  const pag = usePaginado(lista, 'cafeteria-productos', String(verBajas));

  const baja = async (p) => {
    const activar = p.estado === 'archivado';
    const res = await store.bajaProductoCafeteria(p.id, activar);
    if (!res.ok) { toast(res.error || 'No se pudo cambiar.', 'err'); return; }
    toast(activar ? `${p.nombre} vuelve al catálogo.` : `${p.nombre} queda fuera del catálogo (lo cargado no se toca).`, 'ok');
    cargar();
  };

  const filas = pag.visibles.map((p) => {
    const dadoDeBaja = p.estado === 'archivado';
    return (
      <tr key={p.id} style={dadoDeBaja ? { opacity: 0.55 } : undefined}>
        <td>
          <div style={{ fontWeight: 600 }}>{p.nombre}</div>
          <div className={s.hint} style={{ margin: 0 }}>código {p.codigoPropio}</div>
        </td>
        <td>{p.esGranel ? 'Por kilo' : 'Por unidad'}</td>
        {/* EL COSTO Y SU ANTIGÜEDAD JUNTOS, siempre. Un costo sin fecha al lado
            se lee como si fuera de hoy, y ese es el error que esta pantalla
            viene a hacer visible. */}
        <td className={s.num}>
          {p.costo != null
            ? <><strong>{money(p.costo)}</strong><Desde dias={p.costoDias} /></>
            : <><span className={s.muted}>—</span><Desde dias={null} nuncaTexto="sin costo cargado" /></>}
        </td>
        <td className={s.num}>
          {p.precio != null
            ? <><strong>{money(p.precio)}</strong><Desde dias={p.precioDias} nuncaTexto="desde el alta" /></>
            : <span className={s.muted}>por margen</span>}
        </td>
        <td className={s.num}>
          {p.margen != null
            ? (
              <span style={{ fontWeight: 700, color: p.margen <= 0 ? 'var(--crm-color-danger)' : undefined }}>
                {num(p.margen, 1)}%
              </span>
            )
            : <span className={s.muted}>—</span>}
        </td>
        <td>
          {dadoDeBaja
            ? <Pill pill="est-cancelada" label="Dado de baja" />
            : <Pill pill="est-recibida" label="Activo" />}
        </td>
        <td>
          {puedeCargar && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {!dadoDeBaja && (
                <Btn small onClick={() => openModal('productoCafeteria', { producto: p, onListo: cargar })}>
                  Editar
                </Btn>
              )}
              <Btn small variant={dadoDeBaja ? 'btn-ghost' : 'btn-delete'} onClick={() => baja(p)}>
                {dadoDeBaja ? 'Reactivar' : 'Dar de baja'}
              </Btn>
            </div>
          )}
        </td>
      </tr>
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title={v.prodTitulo}
        desc={v.prodSub}
        actions={puedeCargar && (
          <Btn variant="btn-primary" onClick={() => openModal('productoCafeteria', { onListo: cargar })}>
            {v.prodBtn}
          </Btn>
        )}
      />

      <div className={s.toolbar}>
        <label className={s.hint} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={verBajas} onChange={(e) => setVerBajas(e.target.checked)} />
          Ver también los dados de baja
        </label>
        <Btn small onClick={cargar} disabled={cargando}>{cargando ? 'Cargando…' : 'Actualizar'}</Btn>
      </div>

      <Table
        cols={[
          { h: 'Producto' }, { h: 'Cómo se vende' },
          { h: 'Costo (lo que te cuesta hacerlo)', num: true },
          { h: `Precio en el mostrador${datos?.lista ? ` (${datos.lista})` : ''}`, num: true },
          { h: 'Margen', num: true },
          { h: 'Estado' }, { h: '' },
        ]}
        empty={cargando ? 'Cargando…' : v.prodVacio}
        pag={pag}
      >
        {filas}
      </Table>

      <div className={s.hint}>
        Un producto de acá <strong>no se compra</strong>: no lleva proveedor ni formato de compra.
        El <strong>costo</strong> es lo que te cuesta hacerlo y lo declarás vos — el envío lo toma
        de acá solo, y se puede corregir en un envío puntual si una tanda salió más cara (eso queda
        en ese envío y no cambia la ficha). El <strong>precio</strong> es lo que paga el cliente en
        el mostrador, con IVA.
      </div>
      <div className={s.hint} style={{ marginTop: 0 }}>
        <strong>Mirá las fechas.</strong> Un costo que no se toca hace meses se muestra igual de
        seguro que uno de ayer, y de ahí sale el margen: si el costo quedó viejo, el margen que ves
        no es el que estás teniendo. Por eso cada número dice desde cuándo es el mismo — en amarillo
        pasado el mes, en rojo pasados los tres.
      </div>
      <div className={s.hint} style={{ marginTop: 0 }}>
        <strong>Dar de baja</strong> lo saca del catálogo y del buscador del envío, pero no toca
        nada de lo ya cargado ni de lo ya vendido — es "dejé de hacerlo", no "esto nunca existió".
      </div>
    </div>
  );
}
