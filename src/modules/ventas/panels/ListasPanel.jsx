import { useMemo } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useVentas } from '../context/VentasContext.jsx';
import { MEDIOS_PAGO } from '../domain/constants.js';
import { PanelHead, Btn, money, s } from '../components/ui.jsx';

/**
 * FORMATO DE VENTA — catálogo de modalidades, listas y reglas globales.
 *
 * Acá NO hay precios: la lista es identidad y orden de preferencia. El markup
 * de cada producto en cada lista se carga en el producto (Compras › Productos ›
 * Formato de Venta), porque la misma "Mayorista" va al 30% en uno y al 50% en
 * otro. Lo único global —porque alcanza a muchos productos de una— son las
 * reglas de marca y el acceso por monto.
 */
export function ListasPanel() {
  const { listasCatalogo, openModal, config } = useVentas();

  const porModalidad = useMemo(() => {
    const { modalidades = [], listas = [] } = listasCatalogo;
    return modalidades.map((m) => ({
      modalidad: m,
      listas: listas.filter((l) => l.modalidadId === m.id).sort((a, b) => a.numero - b.numero),
    }));
  }, [listasCatalogo]);

  /** El orden real de resolución, que es lo que define qué precio gana. */
  const ordenResolucion = useMemo(
    () => (listasCatalogo.listas ?? []).filter((l) => l.activa).sort((a, b) => a.orden - b.orden),
    [listasCatalogo],
  );

  const reglas = listasCatalogo.reglasMarca ?? [];
  const modalidadMonto = (listasCatalogo.modalidades ?? []).find((m) => m.id === config.modalidadMontoId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Formato de venta"
        desc="La modalidad agrupa y la lista identifica. El markup no vive acá: se carga por producto, en Compras › Productos › Formato de Venta."
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={() => openModal('verLogica', {})}>Ver lógica</Btn>
            <Btn onClick={() => openModal('modalidadForm', {})}>+ Modalidad</Btn>
            <Btn variant="btn-primary" onClick={() => openModal('listaForm', {})}>+ Lista</Btn>
          </div>
        }
      />

      {/* El orden de preferencia decide qué lista gana: se muestra primero. */}
      {ordenResolucion.length > 0 && (
        <div className={cx(s.callout, s.info)}>
          <strong>Orden de preferencia</strong> — entre las listas que el renglón habilite gana la
          primera de esta fila. La base es el piso: se usa cuando no se habilita ninguna.
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {ordenResolucion.map((l, i) => (
              <span key={l.id} className={s.badge}>
                {i + 1}. {l.etiqueta}
                {l.id === config.listaBaseId && ' (base)'}
              </span>
            ))}
          </div>
        </div>
      )}

      {porModalidad.length === 0 && (
        <div className={cx(s.callout, s.warn)}>
          No hay modalidades cargadas. Creá una (por ejemplo <strong>Minorista</strong>) y después
          sus listas.
        </div>
      )}

      {porModalidad.map(({ modalidad, listas }) => (
        <div key={modalidad.id} className={cx(s.card, s.cardPad)}>
          <div className={s['panel-head']} style={{ marginBottom: 'var(--crm-space-3)' }}>
            <div>
              <h2 style={{ fontSize: 16 }}>
                {modalidad.nombre}
                {!modalidad.activa && <span className={s.muted}> · inactiva</span>}
              </h2>
              <div className={s.desc}>
                {listas.length} lista(s). La modalidad es la unidad que desbloquean las reglas de
                marca y el monto.
              </div>
            </div>
            <div className={s['panel-actions']}>
              <Btn small onClick={() => openModal('modalidadForm', { modalidadId: modalidad.id })}>Editar</Btn>
              <Btn variant="btn-delete" small onClick={() => openModal('borrarModalidad', { modalidadId: modalidad.id })}>
                Eliminar
              </Btn>
            </div>
          </div>

          <table className={s.table}>
            <thead>
              <tr>
                <th>Nº</th><th>Nombre</th>
                <th className={s.num}>Orden</th>
                <th className={s['actions-col']}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {listas.length === 0 && (
                <tr><td colSpan={4} className={s['empty-state']}>Sin listas en esta modalidad.</td></tr>
              )}
              {listas.map((l) => (
                <tr key={l.id} style={{ opacity: l.activa ? 1 : 0.5 }}>
                  <td className={s.mono}><strong>{l.numero}</strong></td>
                  <td>
                    {l.nombre}
                    {!l.activa && <span className={s.muted}> · inactiva</span>}
                    {l.id === config.listaBaseId && <span className={s.badge} style={{ marginLeft: 6 }}>base</span>}
                  </td>
                  <td className={s.num}>{l.orden}</td>
                  <td className={s['actions-col']}>
                    <div className={s['row-actions']}>
                      <Btn small onClick={() => openModal('listaForm', { listaId: l.id })}>Editar</Btn>
                      <Btn variant="btn-delete" small onClick={() => openModal('borrarLista', { listaId: l.id })}>
                        Eliminar
                      </Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* ---------------------- Reglas de marca ---------------------- */}
      <div className={cx(s.card, s.cardPad)}>
        <div className={s['panel-head']} style={{ marginBottom: 'var(--crm-space-3)' }}>
          <div>
            <h2 style={{ fontSize: 16 }}>Reglas de marca</h2>
            <div className={s.desc}>
              Se acumulan las unidades de toda la marca en el ticket. Al llegar al mínimo, pasan a
              la modalidad <strong>solo los renglones de esa marca</strong>: el resto del ticket no
              se toca. Cada producto de la marca entra con la lista que tenga cargada de esa
              modalidad, y el que no tenga ninguna sigue igual.
            </div>
          </div>
          <div className={s['panel-actions']}>
            <Btn variant="btn-primary" small onClick={() => openModal('reglaMarcaForm', {})}>+ Regla</Btn>
          </div>
        </div>

        <table className={s.table}>
          <thead>
            <tr>
              <th>Marca</th>
              <th className={s.num}>Desde</th>
              <th>Desbloquea</th>
              <th className={s['actions-col']}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {reglas.length === 0 && (
              <tr>
                <td colSpan={4} className={s['empty-state']}>
                  Sin reglas. Por ejemplo: <strong>12 unidades de Coca-Cola → Mayorista</strong>.
                </td>
              </tr>
            )}
            {reglas.map((r) => (
              <tr key={r.id} style={{ opacity: r.activa ? 1 : 0.5 }}>
                <td>
                  <strong>{r.marca}</strong>
                  {!r.activa && <span className={s.muted}> · inactiva</span>}
                </td>
                <td className={s.num}><strong>{r.unidadesMinimas}</strong> u.</td>
                <td>{r.modalidad}</td>
                <td className={s['actions-col']}>
                  <div className={s['row-actions']}>
                    <Btn small onClick={() => openModal('reglaMarcaForm', { reglaId: r.id })}>Editar</Btn>
                    <Btn variant="btn-delete" small onClick={() => openModal('borrarReglaMarca', { reglaId: r.id })}>
                      Eliminar
                    </Btn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---------------------- Acceso por monto ---------------------- */}
      <div className={cx(s.card, s.cardPad)}>
        <h2 style={{ fontSize: 16 }}>Acceso por monto de compra</h2>
        <div className={s.desc} style={{ marginBottom: 'var(--crm-space-3)' }}>
          Se configura en <strong>Ventas › Configuración</strong>. A diferencia de las de cantidad,
          esta NO se aplica sola: se mide sobre pesos, y aplicar el beneficio baja el total, así que
          automatizarla podría dejar el ticket por debajo del umbral y revertirse en un ciclo. La
          caja lo sugiere y el vendedor lo aplica con un clic.
        </div>
        {config.montoMinimoMayorista > 0 && modalidadMonto ? (
          <div className={cx(s.callout, s.ok)} style={{ margin: 0 }}>
            Desde <strong>{money(config.montoMinimoMayorista)}</strong> se sugiere{' '}
            <strong>{modalidadMonto.nombre}</strong>
            {(config.mediosPagoMonto ?? []).length > 0 && (
              <> pagando con <strong>
                {(config.mediosPagoMonto ?? []).map((m) => MEDIOS_PAGO[m] || m).join(' o ')}
              </strong></>
            )}
            . Alcanza solo a los artículos con una lista de esa modalidad.
          </div>
        ) : (
          <div className={cx(s.callout, s.warn)} style={{ margin: 0 }}>
            Desactivado. Se activa cargando un monto y una modalidad en la configuración de ventas.
          </div>
        )}
      </div>
    </div>
  );
}
