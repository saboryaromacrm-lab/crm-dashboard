/**
 * ACTUALIZAR COSTOS DE TODOS LOS PROVEEDORES DE UNA VEZ (28/9/2026)
 * ============================================================================
 * Pedido del dueño: el archivo de formatos de compra del sistema viejo trae a
 * TODOS los proveedores (columna `Proveedor` en cada renglón). Importarlo de a
 * un proveedor era larguísimo. Acá se agrupa por proveedor, se cruza cada
 * nombre con el padrón y se importa todo junto — con tres reglas:
 *
 *  · NADA SE ADIVINA. El nombre idéntico (sin mayúsculas, tildes ni signos)
 *    entra solo. El PARECIDO ("Nuevo Cosmo S.A. - Lucfel" vs "NUEVO COSMOS
 *    S.A.") lo confirma la persona. Un costo cargado al proveedor equivocado
 *    cambia precios de góndola.
 *  · "Solo proveedores ya cargados" (tilde del paso 1): lo que no está en el
 *    padrón queda AFUERA y se lista. Destildado, se puede CREAR — también
 *    confirmándolo uno por uno.
 *  · Lo que queda afuera se dice, con cuántos renglones tenía.
 *
 * Tres pasos: Proveedores (el mapeo) → Vista previa → Resultado. La
 * importación en sí es la misma de un proveedor (`/productos/importar-costos`),
 * una vez por proveedor y sin recargar el inventario entre medio (ver
 * `importarCostosEnTanda`).
 *
 * El precio: un proveedor que se AGREGA a un producto que ya tenía costo queda
 * como alternativo — el que fija el precio no cambia. Solo el producto que no
 * tenía NINGÚN costo toma el del primero que se importa; si viene de varios
 * proveedores, la vista previa lo avisa.
 */
import { useMemo, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../../context/ProductosContext.jsx';
import { money, num as fmtNum } from '../../domain/format.js';
import {
  decisionInicialProveedores, destinosDeProveedores, proveedoresDelArchivo,
} from '../../domain/importarCatalogo.js';
import { mismoNombreProveedor, proveedoresParecidos } from '@modules/proveedores/domain/importarProveedores.js';
import { ModalShell } from '../Modal.jsx';
import { Btn, Table, s } from '../ui.jsx';

const AFUERA = 'afuera';
const NUEVO = 'nuevo';

export function CostosVariosProveedores({ archivo, soloCargados, onVolver }) {
  const { store, closeModal, toast } = useProductos();
  const padron = store.state.proveedores;

  /* Los grupos del archivo y lo que el padrón sugiere para cada uno. */
  const grupos = useMemo(() => proveedoresDelArchivo(archivo.filas).map((g) => {
    if (g.sinNombre) return { ...g, exacto: null, candidatos: [] };
    const exacto = padron.find((p) => mismoNombreProveedor(p.nombre, g.nombre)) || null;
    return { ...g, exacto, candidatos: exacto ? [] : proveedoresParecidos(g.nombre, padron) };
  }), [archivo, padron]);

  /* La decisión por grupo: 'p:<id>' (importar en ese), 'nuevo' (crearlo),
   * 'afuera', o '' (falta decidir). Solo el idéntico arranca decidido. */
  const [decision, setDecision] = useState(() => decisionInicialProveedores(grupos, soloCargados));
  const [paso, setPaso] = useState('mapa');
  const [abierto, setAbierto] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const enVuelo = useRef(false);
  const [resultado, setResultado] = useState(null);

  const pendientes = grupos.filter((g) => decision[g.clave] === '');
  const afuera = grupos.filter((g) => decision[g.clave] === AFUERA);

  /*
   * LOS DESTINOS: varios nombres del archivo pueden terminar en el MISMO
   * proveedor del sistema (el viejo lo escribía de dos maneras); se juntan y
   * se importan como uno. Orden: el de más renglones primero.
   */
  const destinos = useMemo(
    () => destinosDeProveedores(grupos, decision, padron, store.state.productos, store.costoNetoEntry),
    [grupos, decision, padron, store],
  );

  const tot = destinos.reduce((a, t) => ({
    actualiza: a.actualiza + t.plan.resumen.actualiza,
    agrega: a.agrega + t.plan.resumen.agrega,
    noEncontrados: a.noEncontrados + t.plan.resumen.noEncontrados,
  }), { actualiza: 0, agrega: 0, noEncontrados: 0 });
  const nuevos = destinos.filter((t) => t.nuevo);

  /* Productos SIN ningún costo que vienen de más de un proveedor: fija el
   * precio el primero de la lista (ver el comentario de arriba). */
  const sinCostoCompartidos = useMemo(() => {
    const catalogo = new Map(store.state.productos.map((p) => [String(p.codigoPropio ?? '').trim(), p]));
    const quien = new Map();
    for (const t of destinos) {
      for (const f of t.plan.filas) {
        if (f.estado !== 'agrega') continue;
        const p = catalogo.get(f.codigo);
        if (!p || (p.formatosCompra || p.proveedores || []).length) continue;
        if (!quien.has(f.codigo)) quien.set(f.codigo, { nombre: p.nombre, provs: [] });
        quien.get(f.codigo).provs.push(t.nombre);
      }
    }
    return [...quien.entries()].filter(([, v]) => v.provs.length > 1).map(([codigo, v]) => ({ codigo, ...v }));
  }, [destinos, store]);

  const continuar = () => {
    if (pendientes.length) {
      toast(`Falta decidir ${pendientes.length} proveedor(es): elegí en cuál se importa, si se crea, o si queda afuera.`, 'err');
      return;
    }
    if (!destinos.length) { toast('No quedó ningún proveedor para importar.', 'err'); return; }
    setConfirmando(false);
    setPaso('previa');
  };

  /* Segunda confirmación: cambia costos de muchos productos a la vez, y con
   * ellos los precios de góndola que van por margen. */
  const importar = async () => {
    if (!confirmando) { setConfirmando(true); return; }
    if (enVuelo.current) return;
    enVuelo.current = true;
    setGuardando(true);
    const res = [];
    for (const t of destinos) {
      let id = t.id;
      if (t.nuevo) {
        const r = await store.crearProveedorEnTanda({ nombre: t.nombre, proveeMercaderia: true });
        if (!r.ok) { res.push({ nombre: t.nombre, nuevo: true, error: `No se pudo crear: ${r.error}` }); continue; }
        id = r.id;
      }
      if (!t.plan.items.length) {
        res.push({ nombre: t.nombre, nuevo: t.nuevo, actualizados: 0, agregados: 0, noEncontrados: t.plan.resumen.noEncontrados, sinNada: true });
        continue;
      }
      const r = await store.importarCostosEnTanda(id, t.plan.items);
      if (!r.ok) { res.push({ nombre: t.nombre, nuevo: t.nuevo, error: r.error }); continue; }
      res.push({
        nombre: t.nombre,
        nuevo: t.nuevo,
        actualizados: Array.isArray(r.actualizados) ? r.actualizados.length : (Number(r.actualizados) || 0),
        agregados: r.agregados?.length ?? 0,
        noEncontrados: r.noEncontrados?.length ?? 0,
        saltados: r.saltados?.length ?? 0,
      });
    }
    await store.refetch();
    enVuelo.current = false;
    setGuardando(false);
    setResultado(res);
    const ok = res.filter((x) => !x.error);
    toast(`${ok.length} proveedor(es) importado(s)${res.length > ok.length ? `, ${res.length - ok.length} con error` : ''}.`, res.length > ok.length ? 'err' : 'ok');
  };

  /* ------------------------------ resultado ------------------------------ */
  if (resultado) {
    const conError = resultado.filter((x) => x.error);
    return (
      <ModalShell title="Costos de todos los proveedores" size="lg" onClose={closeModal} footer={[{ texto: 'Listo', clase: 'btn-primary', onClick: closeModal }]}>
        <div className={cx(s.callout, conError.length ? s.warn : s.ok)}>
          <strong>{resultado.length - conError.length}</strong> proveedor(es) importado(s):{' '}
          <strong>{resultado.reduce((a, x) => a + (x.actualizados || 0), 0)}</strong> costo(s) actualizado(s) y{' '}
          <strong>{resultado.reduce((a, x) => a + (x.agregados || 0), 0)}</strong> agregado(s).
          {conError.length > 0 && <> <strong>{conError.length}</strong> no se pudieron importar (abajo, en rojo).</>}
        </div>
        <Table cols={[{ h: 'Proveedor' }, { h: 'Actualizados', num: true }, { h: 'Agregados', num: true }, { h: 'Sin producto', num: true }, { h: 'Estado' }]}>
          {resultado.map((x, i) => (
            <tr key={i}>
              <td>{x.nombre}{x.nuevo && <span className={s.muted}> · nuevo</span>}</td>
              <td className={s.num}>{x.error ? '—' : x.actualizados}</td>
              <td className={s.num}>{x.error ? '—' : x.agregados}</td>
              <td className={s.num}>{x.error ? '—' : x.noEncontrados}</td>
              <td style={{ color: x.error ? 'var(--crm-color-danger)' : 'var(--crm-color-success)', fontWeight: 600, fontSize: 13 }}>
                {x.error || (x.sinNada ? 'Ningún código matcheó' : 'Importado')}
              </td>
            </tr>
          ))}
        </Table>
        <ListaAfuera afuera={afuera} />
      </ModalShell>
    );
  }

  /* ------------------------------ vista previa ------------------------------ */
  if (paso === 'previa') {
    return (
      <ModalShell
        title="Actualizar costos de todos los proveedores"
        subtitle="Paso 3 de 3 · Vista previa"
        size="lg"
        onClose={closeModal}
        footer={[
          { texto: 'Volver', clase: 'btn-ghost', onClick: () => { setConfirmando(false); setPaso('mapa'); }, disabled: guardando },
          {
            texto: guardando ? 'Importando…' : confirmando ? 'Sí, importar' : `Importar ${tot.actualiza + tot.agrega} costo(s)…`,
            clase: 'btn-primary',
            onClick: importar,
            disabled: guardando || tot.actualiza + tot.agrega === 0,
          },
        ]}
      >
        {confirmando && (
          <div className={cx(s.callout, s.warn)}>
            <strong>Segunda confirmación.</strong> Se {tot.actualiza ? <>actualizan <strong>{tot.actualiza}</strong></> : null}
            {tot.actualiza && tot.agrega ? ' y se ' : null}{tot.agrega ? <>agregan <strong>{tot.agrega}</strong></> : null} costo(s)
            en <strong>{destinos.length}</strong> proveedor(es)
            {nuevos.length > 0 && <>, y se <strong>crean {nuevos.length}</strong> proveedor(es) nuevo(s)</>}.
            Los precios de góndola que van por margen se recalculan con estos costos. ¿Confirmás?
          </div>
        )}
        <div className={cx(s.callout, s.ok)}>
          <strong>{destinos.length}</strong> proveedor(es) · <strong>{tot.actualiza}</strong> costo(s) se actualizan ·{' '}
          <strong>{tot.agrega}</strong> se agregan
          {tot.noEncontrados > 0 && <> · <strong>{tot.noEncontrados}</strong> código(s) sin producto (no se crean)</>}
          {nuevos.length > 0 && <> · se crean <strong>{nuevos.length}</strong> proveedor(es)</>}
        </div>
        {sinCostoCompartidos.length > 0 && (
          <div className={cx(s.callout, s.warn)}>
            <strong>{sinCostoCompartidos.length}</strong> producto(s) no tenían ningún costo y vienen de más de un
            proveedor. Fija el precio el primero de esta lista (el de más renglones); los demás quedan como
            alternativos y se cambia en la ficha del producto. Ej.: {sinCostoCompartidos.slice(0, 3).map((x) => `${x.nombre} (${x.provs[0]})`).join(' · ')}.
          </div>
        )}
        <Table cols={[{ h: 'Proveedor' }, { h: 'Del archivo' }, { h: 'Actualiza', num: true }, { h: 'Agrega', num: true }, { h: 'Sin producto', num: true }, { h: '' }]}>
          {destinos.map((t) => (
            <FilaDestino key={t.key} t={t} abierto={abierto === t.key} alternar={() => setAbierto(abierto === t.key ? null : t.key)} />
          ))}
        </Table>
        <ListaAfuera afuera={afuera} />
      </ModalShell>
    );
  }

  /* ------------------------------ el mapeo ------------------------------ */
  const exactos = grupos.filter((g) => g.exacto).length;
  return (
    <ModalShell
      title="Actualizar costos de todos los proveedores"
      subtitle="Paso 2 de 3 · Proveedores"
      size="lg"
      onClose={closeModal}
      footer={[
        { texto: 'Volver', clase: 'btn-ghost', onClick: onVolver },
        { texto: pendientes.length ? `Falta decidir ${pendientes.length}` : 'Continuar', clase: 'btn-primary', onClick: continuar },
      ]}
    >
      <div className={cx(s.callout, s.info)}>
        El archivo trae <strong>{grupos.filter((g) => !g.sinNombre).length}</strong> proveedor(es).{' '}
        <strong>{exactos}</strong> coinciden con el padrón y ya quedaron elegidos.
        {pendientes.length > 0 && <> <strong>{pendientes.length}</strong> necesitan que decidas vos (en amarillo).</>}
        {soloCargados
          ? ' Está tildado "solo proveedores ya cargados": lo que no está en el padrón queda afuera.'
          : ' Los que no están en el padrón se pueden crear, confirmándolos uno por uno.'}
      </div>
      <Table cols={[{ h: 'En el archivo' }, { h: 'Renglones', num: true }, { h: 'Se importa en' }]}>
        {grupos.map((g) => (
          <FilaMapeo
            key={g.clave}
            g={g}
            valor={decision[g.clave]}
            padron={padron}
            soloCargados={soloCargados}
            onChange={(v) => setDecision((d) => ({ ...d, [g.clave]: v }))}
          />
        ))}
      </Table>
    </ModalShell>
  );
}

function FilaMapeo({ g, valor, padron, soloCargados, onChange }) {
  const pendiente = valor === '';
  const fondo = pendiente ? 'var(--crm-color-warning-bg, rgba(214,158,46,.12))' : undefined;
  let control;
  if (g.sinNombre) {
    control = <span className={s.muted}>Queda afuera: sin proveedor no hay a quién cargarle el costo</span>;
  } else if (!g.exacto && !g.candidatos.length && soloCargados) {
    control = <span className={s.muted}>Queda afuera: no está en el padrón</span>;
  } else {
    const otros = padron.filter((p) => p.id !== g.exacto?.id && !g.candidatos.some((c) => c.id === p.id));
    control = (
      <select value={valor} onChange={(e) => onChange(e.target.value)} style={{ minWidth: 260 }}>
        {pendiente && <option value="">— Elegí qué hacer —</option>}
        {g.exacto && <option value={`p:${g.exacto.id}`}>{g.exacto.nombre} (mismo nombre)</option>}
        {g.candidatos.length > 0 && (
          <optgroup label="Parecidos en el padrón">
            {g.candidatos.map((c) => <option key={c.id} value={`p:${c.id}`}>{c.nombre}</option>)}
          </optgroup>
        )}
        {!soloCargados && !g.exacto && <option value={NUEVO}>Crear «{g.nombre}» como proveedor nuevo</option>}
        <option value={AFUERA}>No importar (queda afuera)</option>
        {!g.exacto && (
          <optgroup label="Es otro proveedor ya cargado">
            {otros.map((p) => <option key={p.id} value={`p:${p.id}`}>{p.nombre}</option>)}
          </optgroup>
        )}
      </select>
    );
  }
  return (
    <tr style={{ background: fondo }}>
      <td>
        {g.nombre}
        {!g.exacto && !g.sinNombre && g.candidatos.length > 0 && (
          <div className={s.hint} style={{ margin: 0 }}>No está igual en el padrón; hay {g.candidatos.length === 1 ? 'uno parecido' : 'parecidos'}.</div>
        )}
        {!g.exacto && !g.sinNombre && !g.candidatos.length && (
          <div className={s.hint} style={{ margin: 0 }}>No está en el padrón.</div>
        )}
      </td>
      <td className={s.num}>{fmtNum(g.filas.length, 0)}</td>
      <td>{control}</td>
    </tr>
  );
}

function FilaDestino({ t, abierto, alternar }) {
  const r = t.plan.resumen;
  return (
    <>
      <tr>
        <td>
          <strong>{t.nombre}</strong>
          {t.nuevo && <span style={{ color: 'var(--crm-color-warning)', fontWeight: 600 }}> · se crea</span>}
        </td>
        <td className={s.hint} style={{ margin: 0 }}>{t.delArchivo.join(' · ')}</td>
        <td className={s.num}>{r.actualiza}</td>
        <td className={s.num}>{r.agrega}</td>
        <td className={s.num}>{r.noEncontrados || ''}</td>
        <td><Btn small onClick={alternar}>{abierto ? 'Ocultar' : 'Ver detalle'}</Btn></td>
      </tr>
      {abierto && (
        <tr>
          <td colSpan={6} style={{ background: 'var(--crm-color-surface-2, rgba(0,0,0,.03))' }}>
            <Table cols={[{ h: 'Código' }, { h: 'Producto' }, { h: 'Costo anterior', num: true }, { h: 'Costo nuevo', num: true }, { h: 'Estado' }]}>
              {t.plan.filas.map((f, i) => (
                <tr key={i}>
                  <td className={s.mono}>{f.codigo || '—'}</td>
                  <td>{f.nombre || <span className={s.muted}>—</span>}</td>
                  <td className={s.num}>{f.costoAnterior != null ? money(f.costoAnterior) : '—'}</td>
                  <td className={s.num}>{f.netoUnit != null ? money(f.netoUnit) : '—'}</td>
                  <td style={{ fontSize: 13 }}>{{
                    actualiza: 'Actualiza el costo', agrega: 'Agrega el proveedor', no_encontrado: 'Sin producto con este código',
                    archivado: 'Archivado', repetido: 'Repetido', sin_codigo: 'Sin código',
                  }[f.estado]}</td>
                </tr>
              ))}
            </Table>
          </td>
        </tr>
      )}
    </>
  );
}

/** Lo que queda afuera, SIEMPRE a la vista: pedido del dueño. */
function ListaAfuera({ afuera }) {
  if (!afuera.length) return null;
  return (
    <>
      <div className={s['section-title']}>Quedaron afuera ({afuera.length})</div>
      <div className={s.hint} style={{ marginTop: 0 }}>
        Estos proveedores del archivo NO se importaron. Si alguno tiene que entrar, cargalo en el padrón
        (o elegilo en el paso 2) y volvé a importar el archivo: lo que ya se importó se pisa igual, no se duplica.
      </div>
      <Table cols={[{ h: 'Proveedor en el archivo' }, { h: 'Renglones', num: true }]}>
        {afuera.map((g) => (
          <tr key={g.clave}><td>{g.nombre}</td><td className={s.num}>{fmtNum(g.filas.length, 0)}</td></tr>
        ))}
      </Table>
    </>
  );
}
