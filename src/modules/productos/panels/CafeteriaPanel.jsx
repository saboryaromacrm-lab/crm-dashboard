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
 *  · RECIBIDOS — el camino de vuelta (0097): lo que la cafetería ELABORA y
 *    manda a una sucursal para venderse en el mostrador. Mismo documento, otro
 *    sentido: ahí el stock INGRESA y el costo lo declara ella.
 *  · MÉTRICA — qué se movió en el período, agregado por artículo y con filtros,
 *    por sentido. El agregado lo hace la API: acá solo se muestra.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../context/ProductosContext.jsx';
import { money, num, fmtFecha, isoDate } from '../domain/format.js';
import { ESTADOS_PEDIDO_CAFE, MODOS_ENVIO_CAFE, RECEPCION_ENVIO_CAFE, estadoEnvioCafe } from '../domain/constants.js';
import { esVozDelCafe, vozCafeteria } from '../domain/cafeteria.voz.js';
import { Table, PanelHead, Stat, Btn, Pill, usePaginado, s } from '../components/ui.jsx';
import { pedidosCafe } from '@core/services/pedidosCafe.js';
import { CafeteriaProductosPanel } from './CafeteriaProductosPanel.jsx';

const inicioDeMes = () => {
  const d = new Date();
  return isoDate(new Date(d.getFullYear(), d.getMonth(), 1));
};

/* Los rótulos salen del diccionario de voz: la misma pestaña se llama distinto
 * según de qué lado del puente esté el que mira. Ver `domain/cafeteria.voz.js`. */
const pestanasDe = (v) => [
  { id: 'pedidos', label: v.tabPedidos },
  { id: 'deposito', label: v.tabDeposito },
  { id: 'envios', label: v.tabSalida },
  { id: 'recibidos', label: v.tabEntrada },
  /* Los productos del café, adentro de la sección (27/9/2026): antes eran una
   * entrada aparte del menú, lejos de los envíos que los usan. */
  { id: 'productos', label: v.prodSeccion },
  { id: 'metrica', label: 'Métrica' },
];

export function CafeteriaPanel() {
  const { store, can, openModal, toast } = useProductos();
  /* Ver la seccion habilita mandar mercaderia: es lo que ya permite la API. */
  const puedeOperar = can('almacen.cafeteria');
  /* El rol Cafetería carga SUS envíos (los de entrada) y nada más; el admin
   * puede los dos. El candado de verdad está en la API — esto solo evita
   * ofrecer un botón que iba a rebotar. */
  const puedeCargarEntradas = puedeOperar || can('almacen.cafeteria-entradas');
  /* Armar un pedido a una sucursal: la llave del café (la del rol Coffit). */
  const puedePedir = can('almacen.cafeteria-pedidos');
  /* Toda la pantalla habla en la voz del que la abre. Un solo lugar donde se
   * decide quién está mirando; de ahí en más se piden textos, no roles. */
  const v = useMemo(() => vozCafeteria(esVozDelCafe(can)), [can]);
  /*
   * LAS MÉTRICAS SON SOLO DEL SUPERADMIN (27/9/2026, pedido del dueño): las
   * tarjetas de plata, la pestaña Métrica y el total del depósito. La llave no
   * la tiene ningún rol — solo pasa el comodín `*`. La API frena lo mismo; acá
   * además NO se piden, porque un 403 en la carga tumbaría la pantalla entera.
   */
  const verMetricas = can('almacen.cafeteria-metricas');
  const PESTANAS = useMemo(
    () => pestanasDe(v).filter((t) => verMetricas || t.id !== 'metrica'),
    [v, verMetricas],
  );

  /*
   * DÓNDE ARRANCA LA PANTALLA, según para qué la abre cada uno.
   *
   * Para la distribuidora es Pedidos: la cola de trabajo, donde cae el aviso.
   * Para la cafetería NO, y esto se vio usándolo: entraba, veía «Sin pedidos
   * del café» y ningún botón, porque lo suyo —cargar lo que mandó— vive en la
   * pestaña de al lado. La persona quedaba parada en una pantalla sin nada
   * que hacer, que es la peor forma de esconder una función.
   */
  const soloCafe = puedeCargarEntradas && !puedeOperar;
  const [pestana, setPestana] = useState(soloCafe ? 'recibidos' : 'pedidos');
  const [desde, setDesde] = useState(inicioDeMes());
  const [hasta, setHasta] = useState(isoDate(new Date()));

  /* ---- Envíos (los dos sentidos: se piden por separado y se muestran por
     separado, porque mezclarlos daría un total que no significa nada) ---- */
  const [estadoF, setEstadoF] = useState('');
  const [envios, setEnvios] = useState([]);
  const [recibidos, setRecibidos] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);

  /* ---- Métrica ---- */
  const [buscar, setBuscar] = useState('');
  const [sentidoMet, setSentidoMet] = useState('salida');
  const [metrica, setMetrica] = useState(null);

  /* ---- Pedidos (la demanda del café) ---- */
  const [pedidos, setPedidos] = useState([]);

  /*
   * LO QUE ME TOCA RECIBIR (0113), en la pestaña donde se recibe. Sale del
   * mismo aviso que el globito del menú, no de la lista de la pantalla: la
   * lista está filtrada por período, y un envío de antes del período quedaba
   * sin avisar. A la cafetería le toca lo que le mandan; a la sucursal, lo que
   * le manda la cafetería.
   */
  const [porRecibir, setPorRecibir] = useState(pedidosCafe.porRecibir());
  useEffect(() => pedidosCafe.subscribe(() => setPorRecibir(pedidosCafe.porRecibir())), []);

  /* ---- El depósito del café (0101): se pide SOLO al abrir su pestaña ----
   * No va en la carga general: es una foto de stock, no del período, y las
   * otras cuatro consultas ya son bastante para abrir la pantalla. Se
   * vuelve a pedir cuando el store versiona (un envío la cambia). */
  const [deposito, setDeposito] = useState(null);
  const version = store.getVersion?.() ?? 0;
  useEffect(() => {
    if (pestana !== 'deposito') return undefined;
    let vivo = true;
    store.depositoCafeteria()
      .then((d) => { if (vivo) setDeposito(d); })
      .catch(() => { if (vivo) toast('No se pudo leer el depósito del café.', 'err'); });
    return () => { vivo = false; };
  }, [store, pestana, version, toast]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const filtros = { desde: desde || undefined, hasta: hasta || undefined };
      const [lista, entr, res, met, peds] = await Promise.all([
        store.enviosCafeteria({ ...filtros, estado: estadoF || undefined, sentido: 'salida' }),
        store.enviosCafeteria({ ...filtros, estado: estadoF || undefined, sentido: 'entrada' }),
        verMetricas ? store.resumenCafeteria(filtros) : null,
        verMetricas
          ? store.metricaCafeteria({ ...filtros, buscar: buscar.trim() || undefined, sentido: sentidoMet })
          : null,
        store.pedidosCafeteria({ limit: 100 }),
      ]);
      setEnvios(lista);
      setRecibidos(entr);
      setResumen(res);
      setMetrica(met);
      setPedidos(peds);
    } catch {
      toast('No se pudieron cargar los envíos.', 'err');
    } finally {
      setCargando(false);
    }
  }, [store, desde, hasta, estadoF, buscar, sentidoMet, toast, verMetricas]);
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
  const versionVista = useRef(version);
  useEffect(() => {
    if (versionVista.current === version) return;
    versionVista.current = version;
    cargar();
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  const clave = `${pestana}|${desde}|${hasta}|${estadoF}`;
  const pag = usePaginado(envios, 'cafeteria', clave);
  const pagRec = usePaginado(recibidos, 'cafeteria-recibidos', clave);
  const pagMet = usePaginado(metrica?.productos ?? [], 'cafeteria-metrica', `${desde}|${hasta}|${buscar}|${sentidoMet}`);

  /** La fila es la misma en los dos sentidos: cambia el título de la columna. */
  const filaEnvio = (e) => {
    const est = estadoEnvioCafe(e.estado, e.sentido);
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
        <td>
          {e.estado === 'anulado'
            ? <span className={s.muted}>—</span>
            : <Pill pill={RECEPCION_ENVIO_CAFE[e.recepcion]?.pill} label={RECEPCION_ENVIO_CAFE[e.recepcion]?.label || e.recepcion} />}
        </td>
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
  };
  const filasEnvios = pag.visibles.map(filaEnvio);
  const filasRecibidos = pagRec.visibles.map(filaEnvio);

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
        title={v.titulo}
        desc={v.desc}
        /*
          EL BOTÓN NO DEPENDE DE LA PESTAÑA QUE SE ESTÉ MIRANDO. Antes sí, y el
          resultado era que desde Pedidos o desde Métrica no había forma de
          cargar nada: cargar un envío es algo que se puede hacer siempre, y la
          pestaña es dónde se MIRA, no qué se PUEDE.

          En la pestaña de un sentido se ofrece ese sentido; en las otras dos,
          lo que esa persona hace todos los días. El admin no ve los dos
          botones a la vez: sería un segundo botón principal que casi nunca se
          usa, compitiendo con el que sí.
        */
        actions={(() => {
          /* En Productos el botón es el del producto: vive en la pestaña. */
          if (pestana === 'productos') return null;
          /* PEDIR VIVE ACÁ (28/9/2026, pedido del dueño): antes era una
             entrada aparte del menú, «Pedido a la distribuidora». Para el café
             es el botón principal de su pestaña de pedidos; el que además
             opera la sección lo ve al lado, sin robarle el lugar al envío. */
          const botonPedido = (variant) => (
            <Btn variant={variant} onClick={() => openModal('pedidoCafeteria', {})}>+ Nuevo pedido</Btn>
          );
          if (pestana === 'pedidos' && puedePedir && !puedeOperar) return botonPedido('btn-primary');
          const entrada = pestana === 'recibidos' || (soloCafe && pestana !== 'envios');
          let principal = null;
          if (entrada && puedeCargarEntradas) {
            principal = (
              <Btn variant="btn-primary" onClick={() => openModal('envioCafeteria', { sentido: 'entrada' })}>
                {v.btnEntrada}
              </Btn>
            );
          } else if (puedeOperar && v.btnSalida) {
            principal = (
              <Btn variant="btn-primary" onClick={() => openModal('envioCafeteria', {})}>
                {v.btnSalida}
              </Btn>
            );
          }
          return pestana === 'pedidos' && puedePedir
            ? <>{botonPedido('btn-ghost')}{principal}</>
            : principal;
        })()}
      />

      {/* Pestañas. El contador de Pedidos es la demanda que espera respuesta. */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {PESTANAS.map((v) => {
          const pestanaRecibir = soloCafe ? 'envios' : 'recibidos';
          const abiertos = v.id === 'pedidos'
            ? pedidos.filter((p) => p.estado === 'pendiente' || p.estado === 'armando').length
            : (v.id === pestanaRecibir ? porRecibir : 0);
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
              { h: 'Código' }, { h: 'Fecha' }, { h: v.pedidoColSuc }, { h: 'Estado' },
              { h: 'Renglones', num: true }, { h: 'Envío' },
            ]}
            empty={cargando
              ? 'Cargando…'
              : (soloCafe
                ? 'Todavía no pediste nada. "+ Nuevo pedido" arma el primero.'
                : 'Sin pedidos para esta sucursal. Cuando Coffit le pida algo, aparece acá (y suena el aviso).')}
          >
            {pedidos.map((p) => {
              const est = ESTADOS_PEDIDO_CAFE[p.estado] || {};
              return (
                <tr key={p.id} className={s.clickable} onClick={() => openModal('pedidoCafeteriaDetalle', { id: p.id })}>
                  <td className={s.mono}>{p.codigo}</td>
                  <td>{fmtFecha(p.fecha)}</td>
                  <td>
                    {p.sucursalNombre || <span className={s.muted}>—</span>}
                    {/* Quién lo pidió va debajo: importa, pero la sucursal es
                        la que decide quién lo ve y de dónde sale la mercadería. */}
                    {!soloCafe && p.usuarioNombre && (
                      <div className={s.hint} style={{ margin: 0 }}>{p.usuarioNombre}</div>
                    )}
                  </td>
                  <td><Pill pill={est.pill} label={est.label || p.estado} /></td>
                  <td className={s.num}>{p.renglones}</td>
                  <td>{p.envioCodigo ? <span className={s.mono}>{p.envioCodigo}</span> : <span className={s.muted}>—</span>}</td>
                </tr>
              );
            })}
          </Table>
          <div className={s.hint}>
            {soloCafe ? (
              <>
                Tus pedidos a Sabor y Aroma. <strong>Pendiente</strong> = todavía no lo tomaron (lo
                podés anular). <strong>Armando</strong> = lo están preparando.{' '}
                <strong>Enviado</strong> = ya salió, y el detalle real es el del envío.{' '}
                <strong>Cada pedido lo ve solo la sucursal a la que se lo pediste</strong>, y de ahí
                sale la mercadería — por eso conviene pedirle a la que tiene lo que necesitás.
              </>
            ) : (
              <>
                La demanda del café <strong>para esta sucursal</strong>: cada local ve los que le
                pidieron a él, y el envío que lo cumple sale de acá.{' '}
                <strong>Tomar</strong> le avisa a Coffit que se está armando;{' '}
                <strong>Convertir en envío</strong> abre el alta con lo pedido precargado — corregís
                a lo que de verdad va y el pedido queda cerrado. Lo pedido es propuesta; el envío es
                la verdad.
              </>
            )}
          </div>
        </>
      )}

      {pestana === 'envios' && (
        <>
          {verMetricas && (<>
          <div className={s.stats}>
            <Stat label={v.statSalida} value={money(resumen?.enviado ?? 0)} />
            <Stat label={v.statEntrada} value={money(resumen?.recibido ?? 0)} />
            {/* El número que antes no existía: de qué lado quedó la cuenta
                entre los dos negocios en el período. */}
            <Stat
              label={(resumen?.saldo ?? 0) >= 0 ? v.saldoCasa : v.saldoCafe}
              value={money(Math.abs(resumen?.saldo ?? 0))}
            />
            <Stat label="Gastos imputados" value={money(resumen?.gastos ?? 0)} />
            {/* Es "le mandamos + gastos", no el costo de los dos sentidos:
                al lado de "Nos mandó" el nombre viejo se leía como un error. */}
            <Stat
              label={v.costoTotal}
              value={money(resumen?.costoTotal ?? 0)}
              accent="accent-amber"
            />
          </div>

          {/* Cómo se arman el saldo y el costo: lo mismo que Gerencia. */}
          <div className={s.hint} style={{ marginTop: 0 }}>
            El <strong>saldo</strong> y el <strong>costo</strong> cuentan lo comprado para el café, lo
            mandado desde el stock propio y los gastos. Lo de <strong>uso exclusivo</strong> se cuenta una
            sola vez, al comprarlo: mandarlo después no lo suma de nuevo — por eso pueden ser menos que
            {' '}“{v.statSalida}”. Son los mismos números que Gerencia.
          </div>
          </>)}

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
              { h: 'Código' }, { h: 'Fecha' }, { h: v.colSucSalida }, { h: 'Estado' }, { h: 'Recepción' },
              { h: 'Versión', num: true }, { h: 'Renglones', num: true }, { h: 'Total a costo', num: true },
            ]}
            empty={cargando
              ? 'Cargando…'
              : (soloCafe
                ? 'Sabor y Aroma no te mandó nada en el período.'
                : 'Sin envíos en el período. "+ Nuevo envío" registra el primero.')}
            pag={pag}
          >
            {filasEnvios}
          </Table>

          <div className={s.hint}>
            {soloCafe ? (
              <>
                Lo que Sabor y Aroma te mandó en el período, al costo con el que salió de sus
                depósitos. <strong>Esto no lo cargás vos</strong>: lo registran ellos al despachar,
                y te llega a Coffit por la sincronización de siempre. <strong>Cuando llega, controlalo
                contra el remito</strong>: entrá al envío y usá <strong>Controlar y recibir</strong>. Si
                falta algo, lo anotás ahí y la administración se entera sola.
              </>
            ) : (
              <>
                <strong>El envío egresa el stock en el acto</strong>, con el costo congelado, y se
                imprime el remito que va con la mercadería. Coffit lo <strong>controla y lo
                marca recibido</strong>; si falta algo, se abre una incidencia. Para corregir uno, entrá
                al detalle y usá <strong>Editar</strong> (la versión sube y Coffit se entera por
                sincronización).
              </>
            )}
          </div>
        </>
      )}

      {pestana === 'deposito' && (
        <>
          {verMetricas && (
          <div className={s.stats}>
            <Stat label="En depósito hoy (a costo)" value={money(deposito?.valor ?? 0)} accent="accent-amber" />
            <Stat label="Artículos con stock" value={deposito?.articulos?.length ?? 0} />
            {/* Del período de arriba, no de hoy: cuánto se compró directo para el
                café. Lo que ya salió está en la pestaña de envíos. */}
            <Stat label="Comprado para el café en el período" value={money(resumen?.compradoDirecto ?? 0)} />
            <Stat label="Facturas con mercadería del café" value={resumen?.comprasCantidad ?? 0} />
          </div>
          )}

          <div className={s.hint} style={{ marginTop: 0 }}>{v.depositoSub}</div>

          <Table
            cols={[
              { h: 'Artículo' }, { h: 'Código' },
              ...(deposito?.sucursales ?? []).map((su) => ({ h: su.nombre, num: true })),
              { h: 'Total', num: true }, { h: 'Costo u.', num: true }, { h: 'Valor', num: true },
              ...(v.depositoBtn ? [{ h: '' }] : []),
            ]}
            empty={deposito ? v.depositoVacio : 'Cargando…'}
          >
            {(deposito?.articulos ?? []).map((a) => {
              /* El pedido sale de la sucursal que más tiene de ESTE artículo:
                 es la que casi seguro puede mandarlo entero. Se puede cambiar
                 en el formulario. */
              const [sucMax] = Object.entries(a.porSucursal).sort((x, y) => y[1] - x[1])[0] ?? [];
              return (
                <tr key={`${a.productoId}-${a.presentacionId ?? 0}`}>
                  <td>{a.nombre}</td>
                  <td className={s.mono} style={{ fontSize: 12 }}>{a.codigoPropio || '—'}</td>
                  {(deposito?.sucursales ?? []).map((su) => {
                    const n = a.porSucursal[su.id] ?? 0;
                    return (
                      <td key={su.id} className={cx(s.num, s.mono)} style={{ opacity: n > 0 ? 1 : 0.3 }}>
                        {num(n, a.unidad === 'kg' ? 2 : 0)}
                      </td>
                    );
                  })}
                  <td className={cx(s.num, s.mono)} style={{ fontWeight: 600 }}>{num(a.total, a.unidad === 'kg' ? 2 : 0)} {a.unidad}</td>
                  <td className={cx(s.num, s.mono)}>{money(a.costoU)}</td>
                  <td className={cx(s.num, s.mono)}>{money(a.valor)}</td>
                  {v.depositoBtn && (
                    <td className={s.num}>
                      <Btn
                        small
                        onClick={() => openModal('pedidoCafeteria', {
                          inicial: {
                            sucursalId: Number(sucMax) || undefined,
                            items: [{ prodId: a.productoId, presId: a.presentacionId, cantidad: '' }],
                          },
                        })}
                      >
                        Pedir
                      </Btn>
                    </td>
                  )}
                </tr>
              );
            })}
          </Table>

          <div className={s.hint}>
            {soloCafe ? (
              <>
                Esto <strong>ya es tuyo</strong>: Sabor y Aroma lo compró para vos y te lo imputó al
                comprarlo. Está guardado en las sucursales hasta que lo pidas — el pedido sale de la
                sucursal que lo tiene, y cuando te lo mandan deja de figurar acá.
              </>
            ) : (
              <>
                Es el stock de los artículos marcados <strong>«uso exclusivo de Coffit»</strong> en
                su ficha. Su costo <strong>ya se le imputó al café en la factura de compra</strong>, así
                que el envío que lo lleve no vuelve a moverle plata: solo cruza la calle. Lo que la
                distribuidora también vende (el azúcar, la harina) no entra acá — se le imputa al café
                recién cuando se le manda.
              </>
            )}
          </div>
        </>
      )}

      {pestana === 'recibidos' && (
        <>
          <div className={s.toolbar}>
            <label className={s.hint} style={{ margin: 0 }}>
              Desde <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </label>
            <label className={s.hint} style={{ margin: 0 }}>
              Hasta <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </label>
            <select className={s['select-inline']} value={estadoF} onChange={(e) => setEstadoF(e.target.value)}>
              <option value="">Recibidos y anulados</option>
              <option value="enviado">Solo recibidos</option>
              <option value="anulado">Solo anulados</option>
            </select>
            <Btn small onClick={cargar} disabled={cargando}>{cargando ? 'Cargando…' : 'Actualizar'}</Btn>
          </div>

          <Table
            cols={[
              { h: 'Código' }, { h: 'Fecha' }, { h: v.colSucEntrada }, { h: 'Estado' }, { h: 'Recepción' },
              { h: 'Versión', num: true }, { h: 'Renglones', num: true }, { h: 'Total declarado', num: true },
            ]}
            empty={cargando
              ? 'Cargando…'
              : (soloCafe
                ? 'Todavía no mandaste nada en el período.'
                : 'Coffit todavía no mandó nada en el período.')}
            pag={pagRec}
          >
            {filasRecibidos}
          </Table>

          <div className={s.hint}>
            {soloCafe ? (
              <>
                <strong>Lo que mandás entra al stock de la sucursal cuando ellos lo controlan y lo
                reciben</strong>, con lo que cuenten: el remito se imprime al enviar y va con la
                mercadería. El <strong>costo lo declarás vos</strong> —ellos no pueden
                saberlo—: cada envío propone el de tu ficha en <strong>Mis productos</strong>, y con
                ese costo de la ficha se registra cada venta. Si te cambió el costo, cambialo ahí: si
                queda mal, la ganancia de ese producto queda mal y nadie lo nota. Solo podés mandar
                los productos <strong>elaborados por vos</strong>. Un costo mal tipeado en un envío se
                corrige con Editar aunque ya lo hayan vendido; anular no se puede si ya se vendió.
              </>
            ) : (
              <>
                <strong>La mercadería entra al stock de la sucursal cuando la sucursal la controla y
                la recibe</strong> (entrá al envío → <strong>Controlar y recibir</strong>), con lo que se
                contó. El <strong>costo lo declara Coffit</strong> — el sistema
                no puede saberlo —: el de su ficha (Productos Coffit) es con el que se registra cada
                venta. Solo se pueden cargar productos marcados <strong>“Lo elabora Coffit”</strong>.
                Un costo mal tipeado se corrige con Editar aunque ya se haya vendido; anular no se puede
                si ya se vendió.
              </>
            )}
          </div>
        </>
      )}

      {pestana === 'productos' && <CafeteriaProductosPanel embebido />}

      {pestana === 'metrica' && verMetricas && (
        <>
          <div className={s.stats}>
            <Stat label={sentidoMet === 'entrada' ? 'Envíos del café' : 'Envíos en el período'} value={metrica?.envios ?? 0} />
            <Stat label="Artículos distintos" value={metrica?.articulos ?? 0} />
            <Stat label="Kg totales (granel + paquetes)" value={`${num(metrica?.kgTotales ?? 0, 1)} kg`} />
            <Stat
              label={sentidoMet === 'entrada' ? 'Recibido (costo declarado)' : 'Enviado a costo'}
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
            {/* Un sentido por vez: sumar lo que mandamos con lo que nos
                mandaron en una sola tabla daría un total sin significado. */}
            <select className={s['select-inline']} value={sentidoMet} onChange={(e) => setSentidoMet(e.target.value)}>
              <option value="salida">{v.metricaSalida}</option>
              <option value="entrada">{v.metricaEntrada}</option>
            </select>
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
            arriba es lo que más pesa.
          </div>
        </>
      )}
    </div>
  );
}
