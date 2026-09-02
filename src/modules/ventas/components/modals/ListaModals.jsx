import { useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useVentas } from '../../context/VentasContext.jsx';
import { ventasApi } from '../../services/ventas.api.js';
import { MEDIOS_PAGO } from '../../domain/constants.js';
import { ModalShell, money, s } from '../ui.jsx';

/* ==================================================================== *
 * Modalidad (agrupación visual)
 * ==================================================================== */

export function ModalidadFormModal({ modalidadId }) {
  const { listasCatalogo, act, closeModal, toast } = useVentas();
  const mod = listasCatalogo.modalidades.find((m) => m.id === modalidadId) || null;
  const [f, setF] = useState({
    nombre: mod?.nombre ?? '',
    orden: mod?.orden ?? 0,
    activa: mod?.activa ?? true,
  });

  const guardar = () => {
    if (!f.nombre.trim()) { toast('Poné un nombre.', 'err'); return; }
    const datos = { ...f, orden: Number(f.orden) || 0 };
    act(
      mod ? ventasApi.editarModalidad(mod.id, datos) : ventasApi.crearModalidad(datos),
      mod ? 'Modalidad actualizada.' : 'Modalidad creada.',
    );
  };

  return (
    <ModalShell
      title={mod ? `Editar ${mod.nombre}` : 'Nueva modalidad'}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: mod ? 'Guardar' : 'Crear', clase: 'btn-primary', onClick: guardar },
      ]}
    >
      <div className={cx(s.callout, s.info)}>
        La modalidad <strong>agrupa</strong> (Minorista, Mayorista…) y es la unidad que desbloquean
        las reglas de marca y el monto de compra. El markup va en cada producto.
      </div>
      <div className={s.field}>
        <label>Nombre <span className={s.req}>*</span></label>
        <input value={f.nombre} placeholder="Ej: Mayorista" onChange={(e) => setF({ ...f, nombre: e.target.value })} />
      </div>
      <div className={s.field}>
        <label>Orden de aparición</label>
        <input type="number" value={f.orden} onChange={(e) => setF({ ...f, orden: e.target.value })} />
        <div className={s.hint}>Solo ordena la pantalla. La preferencia al cotizar la define cada lista.</div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
        <input type="checkbox" checked={f.activa} onChange={(e) => setF({ ...f, activa: e.target.checked })} />
        Activa
      </label>
    </ModalShell>
  );
}

export function BorrarModalidadModal({ modalidadId }) {
  const { listasCatalogo, act, closeModal } = useVentas();
  const mod = listasCatalogo.modalidades.find((m) => m.id === modalidadId);
  const conListas = listasCatalogo.listas.filter((l) => l.modalidadId === modalidadId);

  return (
    <ModalShell
      title="Eliminar modalidad"
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        {
          texto: 'Eliminar',
          clase: 'btn-delete',
          onClick: () => act(ventasApi.borrarModalidad(modalidadId), 'Modalidad eliminada.'),
        },
      ]}
    >
      {conListas.length > 0 ? (
        <div className={cx(s.callout, s.warn)}>
          <strong>{mod?.nombre}</strong> tiene {conListas.length} lista(s). Borralas o movelas a otra
          modalidad antes de eliminarla.
        </div>
      ) : (
        <p>¿Eliminar la modalidad <strong>{mod?.nombre}</strong>?</p>
      )}
    </ModalShell>
  );
}

/* ==================================================================== *
 * Lista (la regla)
 * ==================================================================== */

export function ListaFormModal({ listaId }) {
  const { listasCatalogo, act, closeModal, toast } = useVentas();
  const lista = listasCatalogo.listas.find((l) => l.id === listaId) || null;
  const [f, setF] = useState({
    modalidadId: lista?.modalidadId ?? (listasCatalogo.modalidades[0]?.id ?? ''),
    nombre: lista?.nombre ?? '',
    orden: lista?.orden ?? 50,
    activa: lista?.activa ?? true,
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const guardar = () => {
    if (!f.nombre.trim()) { toast('Poné un nombre para la lista.', 'err'); return; }
    if (!f.modalidadId) { toast('Elegí la modalidad.', 'err'); return; }
    const datos = {
      modalidadId: Number(f.modalidadId),
      nombre: f.nombre,
      orden: Number(f.orden) || 0,
      activa: f.activa,
    };
    act(
      lista ? ventasApi.editarLista(lista.id, datos) : ventasApi.crearLista(datos),
      lista ? 'Lista actualizada.' : 'Lista creada.',
    );
  };

  return (
    <ModalShell
      title={lista ? `Editar ${lista.etiqueta}` : 'Nueva lista de precio'}
      wide
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: lista ? 'Guardar' : 'Crear', clase: 'btn-primary', onClick: guardar },
      ]}
    >
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Modalidad <span className={s.req}>*</span></label>
          <select value={f.modalidadId} onChange={set('modalidadId')} disabled={!!lista}>
            {listasCatalogo.modalidades.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
          {lista && <div className={s.hint}>La modalidad no se cambia: el número es único dentro de ella.</div>}
        </div>
        <div className={s.field}>
          <label>Nombre <span className={s.req}>*</span></label>
          <input value={f.nombre} placeholder="Ej: Por cantidad" onChange={set('nombre')} />
          {lista && <div className={s.hint}>Número <strong>{lista.numero}</strong> (no se edita: lo referencian ventas viejas).</div>}
        </div>
      </div>

      <div className={cx(s.callout, s.info)}>
        La lista es <strong>solo identidad</strong>: no lleva markup ni condición. El precio de cada
        producto en esta lista, y desde cuántas unidades la habilita, se cargan en{' '}
        <strong>Compras › Productos › Formato de Venta</strong>. Es lo que permite que &quot;Mayorista&quot;
        sea 30% en un producto y 50% en otro.
      </div>

      <div className={s['section-title']}>Preferencia</div>
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Orden</label>
          <input type="number" value={f.orden} onChange={set('orden')} />
          <div className={s.hint}>
            Menor = se prueba antes. Entre las que el renglón habilite gana la de orden más bajo, así
            que las de mejor precio van primero y la de mostrador (el piso) última.
          </div>
        </div>
        <div className={s.field}>
          <label>Estado</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={f.activa} onChange={(e) => setF({ ...f, activa: e.target.checked })} />
            Activa
          </label>
        </div>
      </div>
    </ModalShell>
  );
}

export function BorrarListaModal({ listaId }) {
  const { listasCatalogo, act, closeModal } = useVentas();
  const lista = listasCatalogo.listas.find((l) => l.id === listaId);
  return (
    <ModalShell
      title="Eliminar lista"
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Eliminar', clase: 'btn-delete', onClick: () => act(ventasApi.borrarLista(listaId), 'Lista eliminada.') },
      ]}
    >
      <p>¿Eliminar <strong>{lista?.etiqueta}</strong>?</p>
      <div className={cx(s.callout, s.info)}>
        Si ya se vendió con ella, <strong>no se borra: se desactiva</strong>. Los renglones viejos la
        referencian y su precio tiene que seguir siendo explicable.
      </div>
    </ModalShell>
  );
}

/* ==================================================================== *
 * Regla de marca — la única condición global
 * ==================================================================== */

export function ReglaMarcaFormModal({ reglaId }) {
  const { listasCatalogo, marcas: marcasCatalogo, act, closeModal, toast } = useVentas();
  const regla = (listasCatalogo.reglasMarca ?? []).find((r) => r.id === reglaId) || null;
  const [f, setF] = useState({
    marcaId: regla?.marcaId ?? '',
    unidadesMinimas: regla?.unidadesMinimas ?? 12,
    modalidadId: regla?.modalidadId ?? (listasCatalogo.modalidades[0]?.id ?? ''),
    activa: regla?.activa ?? true,
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  /** Marcas del catálogo: se elige una, no se escribe. */
  const marcas = marcasCatalogo ?? [];

  const guardar = () => {
    if (!f.marcaId) { toast('Elegí la marca.', 'err'); return; }
    if (!(Number(f.unidadesMinimas) > 0)) { toast('El mínimo tiene que ser mayor a cero.', 'err'); return; }
    if (!f.modalidadId) { toast('Elegí qué modalidad desbloquea.', 'err'); return; }
    const datos = {
      marcaId: Number(f.marcaId),
      unidadesMinimas: Number(f.unidadesMinimas),
      modalidadId: Number(f.modalidadId),
      activa: f.activa,
    };
    act(
      regla ? ventasApi.editarReglaMarca(regla.id, datos) : ventasApi.crearReglaMarca(datos),
      regla ? 'Regla actualizada.' : 'Regla creada.',
    );
  };

  const mod = listasCatalogo.modalidades.find((m) => m.id === Number(f.modalidadId));

  return (
    <ModalShell
      title={regla ? `Editar regla de ${regla.marca}` : 'Nueva regla de marca'}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: regla ? 'Guardar' : 'Crear', clase: 'btn-primary', onClick: guardar },
      ]}
    >
      <div className={cx(s.callout, s.info)}>
        Se cuentan las unidades de <strong>toda la marca</strong> en el ticket, sumando sus
        productos. Al llegar al mínimo, el beneficio alcanza <strong>solo a los renglones de esa
        marca</strong> — el resto del ticket sigue a su precio de siempre. Cada producto de la marca
        entra con la lista que tenga cargada de esa modalidad, y el que no tenga ninguna tampoco
        cambia.
      </div>

      <div className={s.field}>
        <label>Marca <span className={s.req}>*</span></label>
        <select value={f.marcaId} onChange={set('marcaId')}>
          <option value="">— Elegí una marca —</option>
          {marcas.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>
        <div className={s.hint}>
          Se elige del catálogo, no se escribe: renombrarla después no rompe esta regla.
          Las marcas se administran en <strong>Compras › Catálogos</strong>.
        </div>
      </div>

      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Unidades mínimas <span className={s.req}>*</span></label>
          <input type="number" min="1" value={f.unidadesMinimas} onChange={set('unidadesMinimas')} />
          <div className={s.hint}>Se acumulan entre TODOS los productos de la marca en el ticket.</div>
        </div>
        <div className={s.field}>
          <label>Desbloquea <span className={s.req}>*</span></label>
          <select value={f.modalidadId} onChange={set('modalidadId')}>
            {listasCatalogo.modalidades.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
        </div>
      </div>

      <div className={cx(s.callout, s.ok)}>
        <strong>Se aplica sola.</strong> Se mide sobre cantidades, que no cambian al aplicar el
        beneficio: {f.unidadesMinimas || 0} unidades siguen siendo {f.unidadesMinimas || 0} aunque
        baje el precio, así que el resultado es estable.
        {f.marca && mod && (
          <div style={{ marginTop: 6 }}>
            Llevando <strong>{f.unidadesMinimas} unidades de {f.marca}</strong> (sumando todos sus
            productos), esos renglones pasan a <strong>{mod.nombre}</strong>. Si después se saca una,
            vuelven solos.
          </div>
        )}
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, marginTop: 10 }}>
        <input type="checkbox" checked={f.activa} onChange={(e) => setF({ ...f, activa: e.target.checked })} />
        Activa
      </label>
    </ModalShell>
  );
}

export function BorrarReglaMarcaModal({ reglaId }) {
  const { listasCatalogo, act, closeModal } = useVentas();
  const regla = (listasCatalogo.reglasMarca ?? []).find((r) => r.id === reglaId);
  return (
    <ModalShell
      title="Eliminar regla de marca"
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Eliminar', clase: 'btn-delete', onClick: () => act(ventasApi.borrarReglaMarca(reglaId), 'Regla eliminada.') },
      ]}
    >
      <p>
        ¿Eliminar la regla de <strong>{regla?.marca}</strong> ({regla?.unidadesMinimas} u. →{' '}
        {regla?.modalidad})?
      </p>
      <div className={cx(s.callout, s.info)}>
        No afecta ventas ya hechas: solo deja de habilitar esa modalidad en los tickets nuevos.
      </div>
    </ModalShell>
  );
}

/* ==================================================================== *
 * Ver lógica — explicación viva, con la configuración real
 * ==================================================================== */

function Paso({ n, titulo, children }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
      <div
        style={{
          flex: '0 0 26px', height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center',
          background: 'var(--crm-color-primary)', color: 'var(--crm-color-primary-contrast)',
          fontWeight: 700, fontSize: 13,
        }}
      >
        {n}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, marginBottom: 2 }}>{titulo}</div>
        <div className={s.desc}>{children}</div>
      </div>
    </div>
  );
}

/**
 * No es un manual estático: se arma con las modalidades y listas REALES del
 * sistema, así lo que se lee es lo que va a pasar en la caja.
 */
export function VerLogicaModal() {
  const { listasCatalogo, config, closeModal } = useVentas();

  const activas = useMemo(
    () => (listasCatalogo.listas ?? []).filter((l) => l.activa).sort((a, b) => a.orden - b.orden),
    [listasCatalogo],
  );
  const reglas = (listasCatalogo.reglasMarca ?? []).filter((r) => r.activa);
  const base = activas.find((l) => l.id === config.listaBaseId) || activas[activas.length - 1];
  const modMonto = (listasCatalogo.modalidades ?? []).find((m) => m.id === config.modalidadMontoId);
  const montoActivo = config.montoMinimoMayorista > 0 && modMonto;

  return (
    <ModalShell
      title="Cómo se decide el precio de cada renglón"
      wide
      onClose={closeModal}
      footer={[{ texto: 'Entendido', clase: 'btn-primary', onClick: closeModal }]}
    >
      {/* ---- 1. La estructura ---- */}
      <div className={s['section-title']}>1 · Dónde vive cada cosa</div>
      <div className={cx(s.card, s.cardPad)} style={{ marginBottom: 14 }}>
        <pre style={{ margin: 0, fontSize: 12.5, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
{`MODALIDAD          agrupa (Minorista, Mayorista). Es lo que desbloquean
                   las reglas de marca y el monto de compra.
   └─ LISTA        solo identidad: número, nombre y ORDEN de preferencia.
                   Ni un precio.

PRODUCTO › FORMATO DE VENTA   ← acá vive el markup
   una fila por lista en la que ese producto se vende:
   markup propio + desde cuántas unidades la habilita.
   Sin fila = no se vende en esa lista. No se hereda nada.`}
        </pre>
      </div>
      <div className={s.desc} style={{ marginBottom: 18 }}>
        Es por producto y no global porque el negocio funciona así: la misma <strong>Mayorista</strong>{' '}
        puede ir al 30% en un artículo y al 50% en otro. Y si un producto no tiene lista mayorista,
        simplemente <strong>no se le asigna nada</strong> — no hay que excluirlo de ningún lado.
      </div>

      {/* ---- 2. Las cuatro puertas ---- */}
      <div className={s['section-title']}>2 · Las cuatro puertas de acceso (con una alcanza)</div>
      <table className={s.table} style={{ marginBottom: 10 }}>
        <thead>
          <tr><th>Puerta</th><th>Se mide sobre</th><th>Alcance</th><th>Qué hace la caja</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Cliente</strong> — la tiene asignada</td>
            <td>Nada, es un derecho</td>
            <td>Ese renglón</td>
            <td><strong style={{ color: 'var(--crm-color-success)' }}>Sola</strong></td>
          </tr>
          <tr>
            <td><strong>Producto</strong> — mínimo de unidades</td>
            <td>Cantidades</td>
            <td>Ese renglón</td>
            <td><strong style={{ color: 'var(--crm-color-success)' }}>Sola</strong></td>
          </tr>
          <tr>
            <td><strong>Marca</strong> — mínimo de unidades de la marca</td>
            <td>Cantidades</td>
            <td>Los renglones de esa marca</td>
            <td><strong style={{ color: 'var(--crm-color-success)' }}>Sola</strong></td>
          </tr>
          <tr>
            <td><strong>Monto</strong> — total del ticket</td>
            <td>Pesos</td>
            <td>Todo el ticket</td>
            <td><strong style={{ color: 'var(--crm-color-warning)' }}>Avisa, se aplica con un clic</strong></td>
          </tr>
        </tbody>
      </table>
      <div className={cx(s.callout, s.info)} style={{ marginBottom: 18 }}>
        <strong>Por qué el monto es distinto.</strong> Doce unidades siguen siendo doce aunque cambie
        el precio: la condición no se altera al aplicar el beneficio, así que automatizarla es seguro
        — y olvidarse de aplicarla sería cobrarle de más al cliente. El monto no: aplicar el precio
        <em> baja</em> el total, el ticket podría caer bajo el umbral, revertirse, volver a
        calificar… un ciclo sin fin. Por eso ese se sugiere.
      </div>

      {/* ---- 3. El orden real ---- */}
      <div className={s['section-title']}>3 · Tu orden de preferencia</div>
      {activas.length === 0 ? (
        <div className={cx(s.callout, s.warn)} style={{ marginBottom: 18 }}>
          Todavía no hay listas activas.
        </div>
      ) : (
        <table className={s.table} style={{ marginBottom: 18 }}>
          <thead>
            <tr><th>#</th><th>Lista</th><th>Modalidad</th><th className={s.num}>Orden</th><th>Rol</th></tr>
          </thead>
          <tbody>
            {activas.map((l, i) => (
              <tr key={l.id}>
                <td className={s.mono}>{i + 1}</td>
                <td>{l.etiqueta}</td>
                <td>{l.modalidad}</td>
                <td className={s.num}>{l.orden}</td>
                <td>
                  {l.id === base?.id
                    ? <span className={s.badge}>piso</span>
                    : <span className={s.muted}>se gana</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ---- 4. El algoritmo ---- */}
      <div className={s['section-title']}>4 · Qué hace la caja con cada renglón</div>
      <Paso n="1" titulo="¿La eligió una persona?">
        Si el vendedor cambió la lista a mano en ese renglón, se respeta y no se toca más. La
        decisión de una persona siempre gana.
      </Paso>
      <Paso n="2" titulo="Si no, se recorren las listas DE ESE PRODUCTO por orden">
        Solo las que tiene cargadas en su formato de venta. Gana <strong>la primera</strong> que abra
        alguna de las cuatro puertas. Es un <strong>O</strong>: con una alcanza.
      </Paso>
      <Paso n="3" titulo="Si no se abrió ninguna, va el piso">
        <strong>{base?.etiqueta || 'la última por orden'}</strong> — el precio de mostrador, lo que
        se paga sin haber habilitado nada.
      </Paso>
      <Paso n="4" titulo="Se recalcula en cada cambio de cantidad">
        Agregar la unidad que completa el mínimo habilita el precio al instante; sacarla lo vuelve
        atrás. Todo pasa en la máquina, sin consultar al servidor.
      </Paso>

      {/* ---- 5. Reglas globales reales ---- */}
      <div className={s['section-title']}>5 · Tus reglas globales</div>
      {reglas.length === 0 ? (
        <div className={cx(s.callout, s.warn)}>
          No hay reglas de marca cargadas. Por ejemplo: <strong>12 unidades de Coca-Cola →
          Mayorista</strong>.
        </div>
      ) : (
        <div className={cx(s.card, s.cardPad)} style={{ marginBottom: 10 }}>
          {reglas.map((r) => (
            <div key={r.id} className={s.desc} style={{ marginBottom: 6 }}>
              Llevando <strong>{r.unidadesMinimas} unidades de {r.marca}</strong> —sumando todos sus
              productos y presentaciones— esos renglones pasan a <strong>{r.modalidad}</strong>. El
              que no tenga lista de esa modalidad se queda como está.
            </div>
          ))}
        </div>
      )}

      {montoActivo && (
        <div className={cx(s.callout, s.warn)} style={{ marginTop: 10 }}>
          <strong>Por monto:</strong> pasando {money(config.montoMinimoMayorista)} de ticket, la caja
          ofrece <strong>{modMonto.nombre}</strong>
          {(config.mediosPagoMonto ?? []).length > 0 && (
            <> — solo válido pagando con{' '}
              <strong>{(config.mediosPagoMonto ?? []).map((m) => MEDIOS_PAGO[m] || m).join(' o ')}</strong>,
              y se verifica al confirmar la venta</>
          )}
          . Alcanza únicamente a los artículos con una lista de esa modalidad.
        </div>
      )}

      <div className={cx(s.callout, s.info)} style={{ marginTop: 14 }}>
        <strong>Un detalle que evita discusiones:</strong> las unidades se cuentan siempre, sin
        importar a qué lista quedó cada renglón. Si contáramos solo lo que no tiene descuento,
        aplicar una lista cambiaría la propia condición que la habilitó.
      </div>
    </ModalShell>
  );
}
