/**
 * CAFETERÍA — el punto de salida hacia coffit (Almacén).
 * ============================================================================
 * Acá NO hay existencias: el stock del café lo maneja coffit y contarlo dos
 * veces siempre termina descuadrando. Lo que se ve es el LIBRO de envíos con
 * su ciclo de vida — pedido → en tránsito → recibido, con el stock
 * acompañando cada estado (en tránsito la mercadería SIGUE siendo de la
 * distribuidora y figura así en Existencias) — más la foto de gestión del
 * período: mercadería salida a costo + gastos imputados a Cafetería.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../context/ProductosContext.jsx';
import { money, fmtFecha, isoDate } from '../domain/format.js';
import { ESTADOS_ENVIO_CAFE } from '../domain/constants.js';
import { Table, PanelHead, Stat, Btn, Pill, usePaginado, s } from '../components/ui.jsx';

const inicioDeMes = () => {
  const d = new Date();
  return isoDate(new Date(d.getFullYear(), d.getMonth(), 1));
};

/** Las bandejas del ciclo de vida (mismo lenguaje que Transferencias). */
const VISTAS = [
  { id: 'todos', label: 'Todos' },
  { id: 'pedido', label: 'Pedidos' },
  { id: 'transito', label: 'En tránsito' },
  { id: 'recibido', label: 'Recibidos' },
];

export function CafeteriaPanel() {
  const { store, isAdmin, act, openModal, toast } = useProductos();

  const [vista, setVista] = useState('todos');
  const [desde, setDesde] = useState(inicioDeMes());
  const [hasta, setHasta] = useState(isoDate(new Date()));
  const [tipoF, setTipoF] = useState('');
  const [envios, setEnvios] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const filtros = { desde: desde || undefined, hasta: hasta || undefined };
      const [lista, res] = await Promise.all([
        store.enviosCafeteria({ ...filtros, tipo: tipoF || undefined }),
        store.resumenCafeteria(filtros),
      ]);
      setEnvios(lista);
      setResumen(res);
    } catch {
      toast('No se pudieron cargar los envíos.', 'err');
    } finally {
      setCargando(false);
    }
  }, [store, desde, hasta, tipoF, toast]);
  useEffect(() => { cargar(); }, [cargar]);

  // Los modales mutan por el store (_mutate refresca el bootstrap); esta lista
  // vive fuera del bootstrap, así que se re-pide cuando el store versiona.
  const version = store.getVersion?.() ?? 0;
  useEffect(() => { cargar(); }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Cuántos hay en cada bandeja: el contador dice cuánto trabajo espera. */
  const conteos = useMemo(() => {
    const c = { todos: 0, pedido: 0, transito: 0, recibido: 0 };
    for (const e of envios) {
      if (c[e.estado] !== undefined) c[e.estado] += 1;
    }
    return c;
  }, [envios]);

  const visibles = useMemo(
    () => (vista === 'todos' ? envios : envios.filter((e) => e.estado === vista)),
    [envios, vista],
  );

  const clave = `${vista}|${desde}|${hasta}|${tipoF}`;
  const pag = usePaginado(visibles, 'cafeteria', clave);

  const avanzar = (e, desdeEstado) => act(
    store.avanzarEnvioCafeteria(e.id, desdeEstado),
    desdeEstado === 'pedido'
      ? `${e.codigo} despachado — la mercadería viaja como "en tránsito".`
      : `${e.codigo} recibido — la mercadería ya es del café.`,
  );

  const stop = (ev) => ev.stopPropagation();

  const filas = pag.visibles.map((e) => {
    const est = ESTADOS_ENVIO_CAFE[e.estado] || {};
    return (
      <tr
        key={e.id}
        className={s.clickable}
        onClick={() => openModal('envioCafeteriaDetalle', { id: e.id })}
      >
        <td className={s.mono}>{e.codigo}</td>
        <td>{fmtFecha(e.fecha)}</td>
        <td>
          {e.tipo === 'devolucion'
            ? <span className={cx(s.badge, s['badge-granel'])}>Devolución</span>
            : <span className={s.muted}>Envío</span>}
        </td>
        <td>
          {e.sucursalNombre || '—'}
          {e.usuarioNombre && <div className={s.hint} style={{ margin: 0 }}>{e.usuarioNombre}</div>}
        </td>
        <td><Pill pill={est.pill} label={est.label || e.estado} /></td>
        <td className={s.num}>{e.renglones}</td>
        <td className={cx(s.num, s.mono)}>
          {money(e.totalCosto)}
          {e.estado === 'pedido' && <div className={s.hint} style={{ margin: 0 }}>estimado</div>}
        </td>
        <td className={s['actions-col']}>
          <div className={s['row-actions']} onClick={stop}>
            {isAdmin && e.tipo === 'envio' && e.estado === 'pedido' && (
              <Btn variant="btn-primary" small onClick={() => avanzar(e, 'pedido')}>Despachar</Btn>
            )}
            {isAdmin && e.tipo === 'envio' && e.estado === 'transito' && (
              <Btn variant="btn-primary" small onClick={() => avanzar(e, 'transito')}>Recibido</Btn>
            )}
          </div>
        </td>
      </tr>
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Cafetería"
        desc="El punto de salida hacia coffit: pedido → en tránsito → recibido, a costo. Acá no hay existencias — el stock del café lo maneja coffit."
        actions={isAdmin && (
          <>
            <Btn variant="btn-ghost" onClick={() => openModal('envioCafeteria', { tipo: 'devolucion' })}>
              Devolución
            </Btn>
            <Btn variant="btn-primary" onClick={() => openModal('envioCafeteria', { tipo: 'envio' })}>
              + Nuevo envío
            </Btn>
          </>
        )}
      />

      <div className={s.stats}>
        <Stat label="Salido (a costo)" value={money(resumen?.enviado ?? 0)} />
        <Stat label="Devuelto" value={money(resumen?.devuelto ?? 0)} />
        <Stat label="Gastos imputados" value={money(resumen?.gastos ?? 0)} />
        <Stat
          label="Costo total del período"
          value={money(resumen?.costoTotal ?? 0)}
          accent="accent-amber"
        />
      </div>

      {/* Las bandejas del ciclo: mismo lenguaje visual que Transferencias. */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {VISTAS.map((v) => (
          <button
            key={v.id}
            type="button"
            className={cx(s.badge)}
            style={{
              cursor: 'pointer', padding: '7px 14px', fontSize: 13, border: '1px solid var(--crm-color-border)',
              ...(vista === v.id
                ? { background: 'var(--crm-color-primary)', color: 'var(--crm-color-primary-contrast)', borderColor: 'var(--crm-color-primary)' }
                : {}),
            }}
            onClick={() => setVista(v.id)}
          >
            {v.label}
            {v.id !== 'todos' && v.id !== 'recibido' && conteos[v.id] > 0 && (
              <span style={{
                marginLeft: 7, padding: '0 7px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                background: vista === v.id ? 'rgba(255,255,255,.25)' : 'var(--crm-color-accent-2)',
                color: '#fff',
              }}>
                {conteos[v.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className={s.toolbar}>
        <label className={s.hint} style={{ margin: 0 }}>
          Desde <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label className={s.hint} style={{ margin: 0 }}>
          Hasta <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
        <select className={s['select-inline']} value={tipoF} onChange={(e) => setTipoF(e.target.value)}>
          <option value="">Envíos y devoluciones</option>
          <option value="envio">Solo envíos</option>
          <option value="devolucion">Solo devoluciones</option>
        </select>
        <Btn small onClick={cargar} disabled={cargando}>{cargando ? 'Cargando…' : 'Actualizar'}</Btn>
      </div>

      <Table
        cols={[
          { h: 'Código' }, { h: 'Fecha' }, { h: 'Tipo' }, { h: 'Origen' }, { h: 'Estado' },
          { h: 'Renglones', num: true }, { h: 'Total a costo', num: true },
          { h: 'Acciones', cls: 'actions-col' },
        ]}
        empty={cargando ? 'Cargando…' : ({
          todos: 'Sin envíos en el período. "+ Nuevo envío" registra el primer pedido hacia el café.',
          pedido: 'No hay pedidos armándose: lo que el café pidió y todavía no salió aparece acá.',
          transito: 'No hay mercadería viajando al café.',
          recibido: 'Todavía no se recibió ningún envío en el período.',
        }[vista])}
        pag={pag}
      >
        {filas}
      </Table>

      <div className={s.hint}>
        <strong>El estado dice dónde está la mercadería</strong>: un pedido todavía no tocó stock
        (su total es estimado); al despachar sale como "en tránsito" (sigue siendo tuya y así
        figura en Existencias, con el costo congelado); al marcarla recibida egresa del sistema y
        pasa a ser del café. <strong>Costo total del período</strong> = salido − devuelto + gastos
        imputados a Cafetería.
      </div>
    </div>
  );
}
