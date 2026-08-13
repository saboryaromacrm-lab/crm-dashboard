/**
 * CAFETERÍA — el punto de salida hacia coffit (Almacén).
 * ============================================================================
 * Acá NO hay existencias: el stock del café lo maneja coffit y contarlo dos
 * veces siempre termina descuadrando. Dos pestañas:
 *
 *  · ENVÍOS — el libro. El envío nace ENVIADO (egresa stock y congela costo en
 *    el acto: con el envío ya se da por hecho que coffit recibió) y la
 *    corrección es EDITARLO — cada cambio sube la versión y coffit lo ve en su
 *    próxima sincronización.
 *  · MÉTRICA — qué se le mandó al café en el período, agregado por artículo,
 *    con filtros. El agregado lo hace la API: acá solo se muestra.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../context/ProductosContext.jsx';
import { money, num, fmtFecha, isoDate } from '../domain/format.js';
import { ESTADOS_ENVIO_CAFE, ESTADOS_PEDIDO_CAFE, MODOS_ENVIO_CAFE } from '../domain/constants.js';
import { Table, PanelHead, Stat, Btn, Pill, usePaginado, s } from '../components/ui.jsx';

const inicioDeMes = () => {
  const d = new Date();
  return isoDate(new Date(d.getFullYear(), d.getMonth(), 1));
};

const PESTANAS = [
  { id: 'pedidos', label: 'Pedidos' },
  { id: 'envios', label: 'Envíos' },
  { id: 'metrica', label: 'Métrica' },
];

export function CafeteriaPanel() {
  const { store, isAdmin, openModal, toast } = useProductos();

  // Arranca en Pedidos: es la cola de trabajo (el aviso del admin cae acá).
  const [pestana, setPestana] = useState('pedidos');
  const [desde, setDesde] = useState(inicioDeMes());
  const [hasta, setHasta] = useState(isoDate(new Date()));

  /* ---- Envíos ---- */
  const [estadoF, setEstadoF] = useState('');
  const [envios, setEnvios] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);

  /* ---- Métrica ---- */
  const [buscar, setBuscar] = useState('');
  const [metrica, setMetrica] = useState(null);

  /* ---- Pedidos (la demanda del café) ---- */
  const [pedidos, setPedidos] = useState([]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const filtros = { desde: desde || undefined, hasta: hasta || undefined };
      const [lista, res, met, peds] = await Promise.all([
        store.enviosCafeteria({ ...filtros, estado: estadoF || undefined }),
        store.resumenCafeteria(filtros),
        store.metricaCafeteria({ ...filtros, buscar: buscar.trim() || undefined }),
        store.pedidosCafeteria({ limit: 100 }),
      ]);
      setEnvios(lista);
      setResumen(res);
      setMetrica(met);
      setPedidos(peds);
    } catch {
      toast('No se pudieron cargar los envíos.', 'err');
    } finally {
      setCargando(false);
    }
  }, [store, desde, hasta, estadoF, buscar, toast]);
  useEffect(() => { cargar(); }, [cargar]);

  /*
   * Los modales mutan por el store (_mutate refresca el bootstrap); esta lista
   * vive fuera del bootstrap, así que se re-pide cuando el store versiona.
   *
   * SALTEA EL PRIMER RENDER. El efecto de arriba ya carga al montar (y cada vez
   * que cambia un filtro, que es su trabajo), así que sin esta guarda entrar a
   * Cafetería disparaba OCHO consultas en vez de cuatro — envíos, resumen,
   * métrica y pedidos, dos veces cada una.
   */
  const version = store.getVersion?.() ?? 0;
  const versionVista = useRef(version);
  useEffect(() => {
    if (versionVista.current === version) return;
    versionVista.current = version;
    cargar();
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  const clave = `${pestana}|${desde}|${hasta}|${estadoF}`;
  const pag = usePaginado(envios, 'cafeteria', clave);
  const pagMet = usePaginado(metrica?.productos ?? [], 'cafeteria-metrica', `${desde}|${hasta}|${buscar}`);

  const filasEnvios = pag.visibles.map((e) => {
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
          {e.sucursalNombre || '—'}
          {e.usuarioNombre && <div className={s.hint} style={{ margin: 0 }}>{e.usuarioNombre}</div>}
        </td>
        <td><Pill pill={est.pill} label={est.label || e.estado} /></td>
        <td className={s.num}>
          v{e.version}
          {e.version > 1 && e.estado !== 'anulado' && (
            <div className={s.hint} style={{ margin: 0 }}>corregido</div>
          )}
        </td>
        <td className={s.num}>{e.renglones}</td>
        <td className={cx(s.num, s.mono)}>{money(e.totalCosto)}</td>
      </tr>
    );
  });

  const filasMetrica = pagMet.visibles.map((p) => (
    <tr key={`${p.productoId}-${p.presentacionId ?? 0}`}>
      <td>{p.nombre}</td>
      <td>{MODOS_ENVIO_CAFE[p.modo]?.label || p.modo}</td>
      <td className={s.num}>{num(p.cantidad, 3)} {p.unidad}</td>
      <td className={s.num}>{p.modo === 'unidad' ? '—' : `${num(p.kg, 3)} kg`}</td>
      <td className={s.num}>{p.envios}</td>
      <td className={cx(s.num, s.mono)}>{money(p.costo)}</td>
    </tr>
  ));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Cafetería"
        desc='El punto de salida hacia coffit: el envío egresa a costo y del otro lado entra al almacén "Sabor y Aroma", donde coffit clasifica. Acá no hay existencias.'
        actions={isAdmin && pestana === 'envios' && (
          <Btn variant="btn-primary" onClick={() => openModal('envioCafeteria', {})}>
            + Nuevo envío
          </Btn>
        )}
      />

      {/* Pestañas. El contador de Pedidos es la demanda que espera respuesta. */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {PESTANAS.map((v) => {
          const abiertos = v.id === 'pedidos'
            ? pedidos.filter((p) => p.estado === 'pendiente' || p.estado === 'armando').length
            : 0;
          return (
            <button
              key={v.id}
              type="button"
              className={cx(s.badge)}
              style={{
                cursor: 'pointer', padding: '7px 14px', fontSize: 13, border: '1px solid var(--crm-color-border)',
                ...(pestana === v.id
                  ? { background: 'var(--crm-color-primary)', color: 'var(--crm-color-primary-contrast)', borderColor: 'var(--crm-color-primary)' }
                  : {}),
              }}
              onClick={() => setPestana(v.id)}
            >
              {v.label}
              {abiertos > 0 && (
                <span style={{
                  marginLeft: 7, padding: '0 7px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                  background: pestana === v.id ? 'rgba(255,255,255,.25)' : 'var(--crm-color-accent-2)',
                  color: '#fff',
                }}>
                  {abiertos}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {pestana === 'pedidos' && (
        <>
          <Table
            cols={[
              { h: 'Código' }, { h: 'Fecha' }, { h: 'Pidió' }, { h: 'Estado' },
              { h: 'Renglones', num: true }, { h: 'Envío' },
            ]}
            empty={cargando ? 'Cargando…' : 'Sin pedidos del café. Cuando la cafetería arme uno, aparece acá (y suena el aviso).'}
          >
            {pedidos.map((p) => {
              const est = ESTADOS_PEDIDO_CAFE[p.estado] || {};
              return (
                <tr key={p.id} className={s.clickable} onClick={() => openModal('pedidoCafeteriaDetalle', { id: p.id })}>
                  <td className={s.mono}>{p.codigo}</td>
                  <td>{fmtFecha(p.fecha)}</td>
                  <td>{p.usuarioNombre || '—'}</td>
                  <td><Pill pill={est.pill} label={est.label || p.estado} /></td>
                  <td className={s.num}>{p.renglones}</td>
                  <td>{p.envioCodigo ? <span className={s.mono}>{p.envioCodigo}</span> : <span className={s.muted}>—</span>}</td>
                </tr>
              );
            })}
          </Table>
          <div className={s.hint}>
            La demanda del café. <strong>Tomar</strong> le avisa a la cafetería que se está armando;{' '}
            <strong>Convertir en envío</strong> abre el alta con lo pedido precargado — corregís a lo
            que de verdad va y el pedido queda cerrado. Lo pedido es propuesta; el envío es la verdad.
          </div>
        </>
      )}

      {pestana === 'envios' && (
        <>
          <div className={s.stats}>
            <Stat label="Enviado (a costo)" value={money(resumen?.enviado ?? 0)} />
            <Stat label="Envíos" value={resumen?.enviosCantidad ?? 0} />
            <Stat label="Gastos imputados" value={money(resumen?.gastos ?? 0)} />
            <Stat
              label="Costo total del período"
              value={money(resumen?.costoTotal ?? 0)}
              accent="accent-amber"
            />
          </div>

          <div className={s.toolbar}>
            <label className={s.hint} style={{ margin: 0 }}>
              Desde <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </label>
            <label className={s.hint} style={{ margin: 0 }}>
              Hasta <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </label>
            <select className={s['select-inline']} value={estadoF} onChange={(e) => setEstadoF(e.target.value)}>
              <option value="">Enviados y anulados</option>
              <option value="enviado">Solo enviados</option>
              <option value="anulado">Solo anulados</option>
            </select>
            <Btn small onClick={cargar} disabled={cargando}>{cargando ? 'Cargando…' : 'Actualizar'}</Btn>
          </div>

          <Table
            cols={[
              { h: 'Código' }, { h: 'Fecha' }, { h: 'Origen' }, { h: 'Estado' },
              { h: 'Versión', num: true }, { h: 'Renglones', num: true }, { h: 'Total a costo', num: true },
            ]}
            empty={cargando ? 'Cargando…' : 'Sin envíos en el período. "+ Nuevo envío" registra el primero.'}
            pag={pag}
          >
            {filasEnvios}
          </Table>

          <div className={s.hint}>
            <strong>El envío egresa el stock en el acto</strong>, con el costo congelado — no hay
            etapas: con esto ya se da por hecho que el café lo recibió. Para corregir uno, entrá
            al detalle y usá <strong>Editar</strong> (la versión sube y coffit se entera por
            sincronización). <strong>Costo total del período</strong> = enviado + gastos imputados
            a Cafetería.
          </div>
        </>
      )}

      {pestana === 'metrica' && (
        <>
          <div className={s.stats}>
            <Stat label="Envíos en el período" value={metrica?.envios ?? 0} />
            <Stat label="Artículos distintos" value={metrica?.articulos ?? 0} />
            <Stat label="Kg totales (granel + paquetes)" value={`${num(metrica?.kgTotales ?? 0, 1)} kg`} />
            <Stat
              label="Enviado a costo"
              value={money(metrica?.costoTotal ?? 0)}
              accent="accent-amber"
            />
          </div>

          <div className={s.toolbar}>
            <label className={s.hint} style={{ margin: 0 }}>
              Desde <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </label>
            <label className={s.hint} style={{ margin: 0 }}>
              Hasta <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </label>
            <input
              type="search"
              placeholder="Buscar artículo…"
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              style={{ minWidth: 200 }}
            />
            <Btn small onClick={cargar} disabled={cargando}>{cargando ? 'Cargando…' : 'Actualizar'}</Btn>
          </div>

          <Table
            cols={[
              { h: 'Artículo' }, { h: 'Modo' }, { h: 'Cantidad', num: true },
              { h: 'Equiv. kg', num: true }, { h: 'Envíos', num: true }, { h: 'A costo', num: true },
            ]}
            empty={cargando ? 'Cargando…' : 'Nada enviado en el período (o el filtro no matchea).'}
            pag={pagMet}
          >
            {filasMetrica}
          </Table>

          <div className={s.hint}>
            Suma <strong>solo lo enviado</strong> (lo anulado no existió) al costo <strong>congelado</strong> de
            cada envío — editar precios hoy no cambia lo que ya salió. Ordenado por plata: lo de
            arriba es lo que más le cuesta el café al negocio.
          </div>
        </>
      )}
    </div>
  );
}
