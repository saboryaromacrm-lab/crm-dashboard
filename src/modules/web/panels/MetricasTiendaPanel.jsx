/**
 * TIENDA ONLINE › MÉTRICAS (0179, 18/10/2026, pedido del dueño: «todas las
 * métricas que se puedan medir, por separado mayorista y minorista, bien
 * ordenado»). Reemplaza a «Estadísticas».
 * ============================================================================
 * Una pestaña por modo (Mayorista / Minorista) y un período; todo lo demás lo
 * calcula la API (`GET /web/metricas`) con el período anterior al lado. Cinco
 * bloques, de arriba hacia abajo: el resumen con sus variaciones, el embudo,
 * el tráfico (en el tiempo, por hora, por día de la semana, páginas), los
 * pedidos (cómo terminaron, cómo se entregan, de cuánto son, por hora y día),
 * las ofertas (cómo las recibe la tienda: vistas, carrito, pedidos, descuento
 * y si movieron sus productos), los clientes (altas, ingresos, quién repite,
 * los que más compran) y los productos (ranking, categorías, marcas, búsquedas).
 *
 * Es medición propia y anónima: el sitio reporta a esta misma base. Nada de
 * Google Analytics ni cookies de terceros.
 *
 * DE DÓNDE LLEGAN y «EMPEZAR DE 0» (0194, 22/10/2026, pedido del dueño): el
 * canal de entrada de cada visitante (y cuántos de cada canal piden), y un
 * botón del superadmin que borra la telemetría de una tienda y hace que sus
 * métricas cuenten desde ese momento (pedidos y clientes no se borran).
 */
import { useMemo, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { errorMsg } from '@modules/ventas/services/ventas.api.js';
import { ModalShell } from '@modules/productos/components/Modal.jsx';
import { useSegundaConfirmacion, AvisoSegundaConfirmacion, textoBoton } from '@modules/gastos/components/segundaConfirmacion.jsx';
import { useResource } from '@modules/ventas/hooks/useResource.js';
import { descargarCsv, csvNum } from '@shared/utils/csv.js';
import { money, num } from '@modules/productos/domain/format.js';
import { Table, PanelHead, Btn, usePaginado, s } from '@modules/productos/components/ui.jsx';
import { describirOferta } from '@modules/ventas/domain/ofertas.js';
import { Barras, Columnas, Reparto } from '@modules/gerencia/panels/metricas/graficos.jsx';
import { DIAS_SEMANA, PRESETS, compacto, etiquetaPeriodo, fechaLarga, nombrePaso, pasoPara, pctTxt, rangoDe, tituloPeriodo } from '@modules/gerencia/panels/metricas/formato.js';
import { Aviso, Bloque, Cargando, Grilla, Tile, Tiles, Variacion } from '@modules/gerencia/panels/metricas/piezas.jsx';

const MODOS = [['mayorista', 'Tienda mayorista'], ['minorista', 'Tienda minorista']];
const ESTADOS = [
  ['pendiente', 'Sin revisar', 'var(--crm-color-warning, #b45309)'],
  ['enviado', 'Aceptados', '#2563eb'],
  ['confirmado', 'Confirmados', '#7c3aed'],
  ['cerrado', 'Cerrados (venta hecha)', 'var(--crm-color-primary)'],
  ['cancelado', 'Rechazados', 'var(--crm-color-danger)'],
];
const ENTREGAS = { retiro: 'Retiro en el local', cadete: 'Envío a domicilio', camioneta: 'Envío sin costo', envio: 'Envío a domicilio' };
const entero = (v) => num(v, 0);
const ESTADO_OFERTA = { vigente: ['Vigente', 'st-disponible'], programada: ['Programada', 'est-transito'], vencida: ['Vencida', 'est-recibida'], inactiva: ['Inactiva', 'est-cancelada'] };
const HORAS = Array.from({ length: 24 }, (_, h) => `${h} h`);
const fechaHora = (v) => new Date(v).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Un número del resumen con su comparación: la API manda {ahora, antes, variacion}. */
const TileCmp = ({ label, dato, formato = entero, detalle, periodoAntes }) => (
  <Tile label={label} valor={formato(dato.ahora)} variacion={dato.variacion} contra={`vs ${periodoAntes}`} detalle={detalle ?? `Antes: ${formato(dato.antes)}`} />
);

/** Vistas / pedidos por hora o por día de la semana: la misma forma para las dos. */
const PorMomento = ({ valores, etiquetas, que }) => (
  <Columnas datos={valores.map((v, i) => ({ etiqueta: etiquetas[i], valor: v, detalle: `${etiquetas[i]}: ${entero(v)} ${que}` }))} formato={entero} eje={entero} alto={160} etiquetaCada={etiquetas.length > 10 ? 3 : 1} />
);

export function MetricasTiendaPanel() {
  const { can } = usePermissions();
  const [modo, setModo] = useState('minorista');
  const [version, setVersion] = useState(0);
  const [reiniciando, setReiniciando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [preset, setPreset] = useState('30d');
  const [manual, setManual] = useState(() => rangoDe('30d'));
  const [desde, hasta] = preset === 'otro' ? manual : rangoDe(preset);
  const [pasoElegido, setPasoElegido] = useState('');
  const paso = pasoElegido || pasoPara(desde, hasta);

  const qs = `modo=${modo}&desde=${desde}&hasta=${hasta}&paso=${paso}`;
  const { data: d, loading, error } = useResource(`web-metricas:${qs}:${version}`, () => httpClient.get(`/web/metricas?${qs}`));
  const ranking = useMemo(() => d?.productos?.ranking ?? [], [d]);
  const pag = usePaginado(ranking, 'web-metricas-productos', qs);
  const periodoAntes = d ? `${fechaLarga(d.periodo.antes.desde)} – ${fechaLarga(d.periodo.antes.hasta)}` : '';

  const exportar = () => descargarCsv(`metricas-tienda-${modo}-${desde}-${hasta}.csv`,
    ['Producto', 'Marca', 'Vistas', 'Seg. mirando (prom.)', 'Al carrito', 'En pedidos', 'Unidades pedidas', 'Pedido ($)'],
    ranking.map((p) => [p.nombre, p.marca, p.vistas, csvNum(p.segundosProm, 1), p.carrito, p.pedidos, csvNum(p.unidades, 3), csvNum(p.total)]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)', minWidth: 0 }}>
      <PanelHead
        title="Métricas de la tienda online"
        desc="Qué se visita, qué se mira, qué se pide y quién compra, por separado en la tienda mayorista y la minorista. Medición propia y anónima: el sitio reporta a esta misma base, sin Google Analytics ni cookies de terceros."
        actions={(
          <>
            <Btn onClick={exportar} disabled={!ranking.length}>Exportar productos (CSV)</Btn>
            {can('*') && <Btn variant="btn-delete" onClick={() => { setAviso(''); setReiniciando(true); }}>Empezar de 0…</Btn>}
          </>
        )}
      />
      {aviso && <Aviso>{aviso}</Aviso>}
      {d?.periodo?.reinicio && (
        <div className={s.hint} style={{ margin: 0 }}>
          Las métricas de la tienda {modo} cuentan desde el <strong>{fechaHora(d.periodo.reinicio)}</strong> (la última vez que se empezó de 0).
        </div>
      )}
      {reiniciando && (
        <EmpezarDeCero
          modo={modo}
          onCerrar={() => setReiniciando(false)}
          onHecho={(r) => {
            setReiniciando(false);
            setAviso(`Listo: las métricas de la tienda ${r.modo} empiezan de 0 desde el ${fechaHora(r.desde)} (${entero(r.eventosBorrados)} registros de navegación borrados).`);
            setVersion((v) => v + 1);
          }}
        />
      )}

      <div className={s.toolbar} style={{ margin: 0 }}>
        {MODOS.map(([k, l]) => (
          <Btn key={k} small variant={modo === k ? 'btn-primary' : 'btn-ghost'} onClick={() => setModo(k)}>{l}</Btn>
        ))}
        <select className={s['select-inline']} value={preset} onChange={(e) => { if (e.target.value === 'otro') setManual([desde, hasta]); setPreset(e.target.value); }} aria-label="Período" style={{ marginLeft: 'auto' }}>
          {PRESETS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        {preset === 'otro' && (
          <>
            <input type="date" value={manual[0]} max={manual[1]} onChange={(e) => setManual([e.target.value, manual[1]])} aria-label="Desde" />
            <input type="date" value={manual[1]} min={manual[0]} onChange={(e) => setManual([manual[0], e.target.value])} aria-label="Hasta" />
          </>
        )}
        <select className={s['select-inline']} value={pasoElegido} onChange={(e) => setPasoElegido(e.target.value)} aria-label="Agrupar por">
          <option value="">Agrupar: automático ({nombrePaso(paso)})</option>
          <option value="dia">Por día</option>
          <option value="semana">Por semana</option>
          <option value="mes">Por mes</option>
        </select>
      </div>

      {error && <Aviso tono="warn">{error}</Aviso>}
      {loading && !d && <Cargando />}
      {d && (
        <>
          {/* ============================ RESUMEN ============================ */}
          <Tiles>
            <TileCmp label="Visitas (páginas vistas)" dato={d.resumen.visitas} periodoAntes={periodoAntes} />
            <TileCmp label="Visitantes (sesiones)" dato={d.resumen.sesiones} periodoAntes={periodoAntes} />
            <TileCmp label="Páginas por visita" dato={d.resumen.paginasPorSesion} formato={(v) => num(v, 1)} periodoAntes={periodoAntes} />
            <TileCmp label="Agregados al carrito" dato={d.resumen.carritos} periodoAntes={periodoAntes} />
            <TileCmp label="Búsquedas" dato={d.resumen.busquedas} periodoAntes={periodoAntes} />
          </Tiles>
          <Tiles>
            <TileCmp label="Pedidos (sin los rechazados)" dato={d.resumen.pedidos} periodoAntes={periodoAntes} />
            <TileCmp label="Pedido ($)" dato={d.resumen.total} formato={money} periodoAntes={periodoAntes} />
            <TileCmp label="Ticket promedio" dato={d.resumen.ticket} formato={money} periodoAntes={periodoAntes} />
            <TileCmp label="Conversión" dato={d.resumen.conversion} formato={pctTxt} detalle="Pedidos cada 100 visitantes" periodoAntes={periodoAntes} />
            <TileCmp label="Compradores distintos" dato={d.resumen.compradores} periodoAntes={periodoAntes} />
            <TileCmp label="Cerrados (venta hecha)" dato={d.resumen.cerrados} detalle={`${money(d.resumen.totalCerrado.ahora)} · antes ${entero(d.resumen.cerrados.antes)}`} periodoAntes={periodoAntes} />
            <TileCmp label="Rechazados" dato={d.resumen.cancelados} periodoAntes={periodoAntes} />
          </Tiles>
          {d.resumen.sesiones.ahora === 0 && d.resumen.pedidos.ahora === 0 && (
            <Aviso>Sin movimiento en este período en la tienda {modo}. Los eventos se juntan a medida que la gente navega; si la tienda {modo} está apagada, no hay nada que medir.</Aviso>
          )}

          {/* ============================ EMBUDO ============================ */}
          <Grilla>
            <Bloque titulo="El embudo: de la visita al pedido" sub="Por visitante: cuántos miraron un producto, cuántos cargaron el carrito y cuántos mandaron el pedido.">
              <Barras
                datos={[
                  { etiqueta: 'Visitantes', valor: d.embudo.sesiones },
                  { etiqueta: 'Miraron un producto', valor: d.embudo.conProducto, detalle: pctTxt(d.embudo.pctProducto) },
                  { etiqueta: 'Cargaron el carrito', valor: d.embudo.conCarrito, detalle: pctTxt(d.embudo.pctCarrito) },
                  { etiqueta: 'Mandaron el pedido', valor: d.embudo.conPedido, detalle: pctTxt(d.embudo.pctPedido) },
                ]}
                formato={entero}
                sufijo={(x) => (x.detalle ? `· ${x.detalle} de los visitantes` : '')}
              />
              <div className={s.hint} style={{ margin: 0 }}>
                De los que cargaron el carrito, pidieron el <strong>{pctTxt(d.embudo.pctCarritoAPedido)}</strong>.
                {' '}De los pedidos, se rechazó el <strong>{pctTxt(d.embudo.tasaCancelacion)}</strong> y se cerró en venta el <strong>{pctTxt(d.embudo.tasaCierre)}</strong> de los vivos.
              </div>
            </Bloque>
            <Bloque titulo="Pedidos por estado" sub="Todos los pedidos del período, según cómo terminaron (los rechazados no suman plata en el resto).">
              <Reparto partes={ESTADOS.map(([k, nombre, color]) => ({ nombre, color, valor: d.pedidos.porEstado[k]?.n ?? 0 }))} />
              <Table cols={[{ h: 'Estado' }, { h: 'Pedidos', num: true }, { h: 'Plata', num: true }]}>
                {ESTADOS.map(([k, nombre, color]) => {
                  const x = d.pedidos.porEstado[k];
                  return (
                    <tr key={k}>
                      <td><span aria-hidden="true" style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: color, marginRight: 6 }} />{nombre}</td>
                      <td className={s.num}>{x ? entero(x.n) : '—'}</td>
                      <td className={s.num}>{x ? money(x.total) : '—'}</td>
                    </tr>
                  );
                })}
              </Table>
            </Bloque>
          </Grilla>

          {/* ============================ TRÁFICO ============================ */}
          <Grilla>
            <Bloque titulo={`Visitas por ${nombrePaso(d.periodo.paso)}`} sub="Páginas vistas en cada período.">
              <Columnas datos={d.serie.map((x) => ({ etiqueta: etiquetaPeriodo(x.periodo, d.periodo.paso), valor: x.vistas, detalle: `${tituloPeriodo(x.periodo, d.periodo.paso)}: ${entero(x.vistas)} vistas · ${entero(x.sesiones)} visitantes` }))} formato={entero} eje={entero} alto={200} />
            </Bloque>
            <Bloque titulo={`Pedidos ($) por ${nombrePaso(d.periodo.paso)}`} sub="La plata de los pedidos no rechazados en cada período.">
              <Columnas datos={d.serie.map((x) => ({ etiqueta: etiquetaPeriodo(x.periodo, d.periodo.paso), valor: x.total, detalle: `${tituloPeriodo(x.periodo, d.periodo.paso)}: ${money(x.total)} en ${entero(x.pedidos)} pedido(s)` }))} formato={money} eje={compacto} alto={200} />
            </Bloque>
          </Grilla>
          <Grilla>
            <Bloque titulo="A qué hora navegan" sub="Páginas vistas por hora del día (hora argentina).">
              <PorMomento valores={d.trafico.vistasPorHora} etiquetas={HORAS} que="vistas" />
            </Bloque>
            <Bloque titulo="Qué día navegan" sub="Páginas vistas por día de la semana.">
              <PorMomento valores={d.trafico.vistasPorDia} etiquetas={DIAS_SEMANA.slice(1)} que="vistas" />
            </Bloque>
            <Bloque titulo="Páginas más vistas" sub="A dónde entra la gente (sin lo que viene después del «?»).">
              {d.trafico.paginas.length
                ? <Barras datos={d.trafico.paginas.map((p) => ({ etiqueta: p.ruta, valor: p.vistas, detalle: `${entero(p.sesiones)} visitantes` }))} formato={entero} sufijo={(p) => `· ${p.detalle}`} />
                : <div className={s.hint} style={{ margin: 0 }}>Sin visitas en el período.</div>}
            </Bloque>
          </Grilla>

          <DeDondeLlegan o={d.trafico.origenes} sesiones={d.resumen.sesiones.ahora} />

          {/* ============================ PEDIDOS ============================ */}
          <Grilla>
            <Bloque titulo="Cómo se entregan" sub="Pedidos no rechazados por forma de entrega.">
              {d.pedidos.porEntrega.length
                ? <Barras datos={d.pedidos.porEntrega.map((e) => ({ etiqueta: ENTREGAS[e.entrega] ?? e.entrega, valor: e.n, detalle: `${money(e.total)}${e.gratis ? ` · ${entero(e.gratis)} con envío gratis` : ''}` }))} formato={entero} sufijo={(e) => `· ${e.detalle}`} />
                : <div className={s.hint} style={{ margin: 0 }}>Sin pedidos en el período.</div>}
            </Bloque>
            <Bloque titulo="De cuánto son los pedidos" sub="Sin los rechazados.">
              <Tiles>
                <Tile label="Más chico" valor={money(d.pedidos.ticket.minimo)} />
                <Tile label="Mediana" valor={money(d.pedidos.ticket.mediana)} detalle="La mitad de los pedidos está por debajo" />
                <Tile label="Más grande" valor={money(d.pedidos.ticket.maximo)} />
                <Tile label="Renglones por pedido" valor={num(d.pedidos.ticket.renglones, 1)} />
              </Tiles>
            </Bloque>
            <Bloque titulo="A qué hora piden" sub="Pedidos por hora del día.">
              <PorMomento valores={d.trafico.pedidosPorHora} etiquetas={HORAS} que="pedidos" />
            </Bloque>
            <Bloque titulo="Qué día piden" sub="Pedidos por día de la semana.">
              <PorMomento valores={d.trafico.pedidosPorDia} etiquetas={DIAS_SEMANA.slice(1)} que="pedidos" />
            </Bloque>
          </Grilla>

          {/* ============================ OFERTAS ============================ */}
          <Bloque titulo="Las ofertas: cómo las recibe la tienda" sub="Por cada oferta con movimiento en el período: cuánto se miró, se cargó y se pidió con ella, y si movió sus productos contra el período anterior.">
            <Tiles>
              <Tile label="Pedidos con alguna oferta" valor={entero(d.ofertas.conOferta)} detalle={`${pctTxt(d.ofertas.pctConOferta)} de los ${entero(d.ofertas.pedidos)} pedidos`} />
              <Tile label="Plata de esos pedidos" valor={money(d.ofertas.totalConOferta)} detalle="El pedido entero, no solo lo que estaba en oferta" />
              <Tile label="Descuento otorgado" valor={money(d.ofertas.descuentoTotal)} detalle="Lo que se dejó de cobrar por las ofertas" />
            </Tiles>
            <Table
              cols={[{ h: 'Oferta' }, { h: 'Vistas', num: true }, { h: 'Al carrito', num: true }, { h: 'Pedidos', num: true }, { h: 'Unidades', num: true }, { h: 'Plata', num: true }, { h: 'Descuento', num: true }, { h: 'Unidades por día' }]}
              empty="Ninguna oferta tuvo movimiento en la tienda en este período."
            >
              {d.ofertas.lista.map((o) => {
                const [estado, pill] = ESTADO_OFERTA[o.estado] ?? [o.estado, ''];
                return (
                  <tr key={o.id}>
                    <td>
                      <strong>{o.nombre}</strong>
                      <div className={s.hint} style={{ margin: 0 }}>
                        {describirOferta({ tipo: o.tipo, ...o.parametros })} · <span className={`${s.pill} ${s[pill] ?? ''}`}>{estado}</span>
                        {o.productos > 0 && ` · ${entero(o.productos)} producto${o.productos === 1 ? '' : 's'}`}
                        {o.compradores > 0 && ` · ${entero(o.compradores)} comprador${o.compradores === 1 ? '' : 'es'}`}
                      </div>
                    </td>
                    <td className={s.num}>{o.vistas || '—'}{o.segundosProm > 0 && <div className={s.hint} style={{ margin: 0 }}>{num(o.segundosProm, 1)} s</div>}</td>
                    <td className={s.num}>{o.carrito || '—'}{o.pctCarrito != null && <div className={s.hint} style={{ margin: 0 }}>{pctTxt(o.pctCarrito)} de las vistas</div>}</td>
                    <td className={s.num}>{o.pedidos || '—'}{o.pctPedido != null && <div className={s.hint} style={{ margin: 0 }}>{pctTxt(o.pctPedido)} de las vistas</div>}</td>
                    <td className={s.num}>{o.unidades ? num(o.unidades, 2) : '—'}</td>
                    <td className={s.num}><strong>{o.total ? money(o.total) : '—'}</strong></td>
                    <td className={s.num}>{o.descuento ? money(o.descuento) : '—'}</td>
                    <td>
                      <strong>{num(o.unidadesDia.ahora, 2)}</strong>{' '}
                      <Variacion valor={o.unidadesDia.variacion} contra={`vs ${num(o.unidadesDia.antes, 2)} antes`} />
                      {o.unidadesDia.variacion == null && o.unidadesDia.antes === 0 && <div className={s.hint} style={{ margin: 0 }}>Antes no se pedía</div>}
                    </td>
                  </tr>
                );
              })}
            </Table>
            <div className={s.hint} style={{ margin: 0 }}>
              <strong>Vistas / Al carrito</strong> = veces que un producto se miró o se cargó <em>mientras estaba publicado con esa oferta</em>. <strong>Pedidos, Unidades y Plata</strong> = lo cotizado con la oferta en pedidos no rechazados; <strong>Descuento</strong> = lo que se dejó de cobrar.
              {' '}<strong>Unidades por día</strong> = cuánto se pidió por día de los productos de la oferta (con o sin ella) contra el período anterior: si sube, la oferta movió; si no, no.
            </div>
          </Bloque>

          {/* ============================ CLIENTES ============================ */}
          <Bloque titulo={`Clientes de la tienda ${modo}`} sub={modo === 'mayorista' ? 'Los que piden ingreso con su DNI y los que ya compran.' : 'Los que se registran con su WhatsApp y los que ya compran.'}>
            <Tiles>
              <Tile label={modo === 'mayorista' ? 'Pedidos de ingreso' : 'Registros nuevos'} valor={entero(d.clientes.altas)} detalle="En el período" />
              {modo === 'mayorista' && <Tile label="Habilitados" valor={entero(d.clientes.habilitados)} detalle={`En el período · ${entero(d.clientes.pendientesAhora)} esperando ahora`} alerta={d.clientes.pendientesAhora > 0} />}
              <Tile label={modo === 'mayorista' ? 'Rechazados o deshabilitados' : 'Bloqueados'} valor={entero(d.clientes.bloqueados)} detalle={modo === 'mayorista' ? 'En el período' : 'En total'} />
              <Tile label="Ingresos" valor={entero(d.clientes.ingresos)} detalle={`${entero(d.clientes.quienesIngresaron)} clientes distintos entraron`} />
              <Tile label="Compraron" valor={entero(d.clientes.compradores)} detalle={`${entero(d.clientes.nuevos)} por primera vez · ${entero(d.clientes.repiten)} más de una vez`} />
              <Tile label="Habilitados en total" valor={entero(d.clientes.habilitadosTotal)} detalle="Pueden entrar hoy" />
            </Tiles>
            <Table cols={[{ h: 'Los que más compran' }, { h: 'Pedidos', num: true }, { h: 'Plata', num: true }, { h: 'Último pedido' }]} empty="Sin pedidos en el período.">
              {d.clientes.top.map((c, i) => (
                <tr key={i}>
                  <td><strong>{c.nombre}</strong>{c.clienteId && <span className={s.muted}> · cliente #{c.clienteId}</span>}</td>
                  <td className={s.num}>{entero(c.pedidos)}</td>
                  <td className={s.num}><strong>{money(c.total)}</strong></td>
                  <td>{c.ultimo ? new Date(c.ultimo).toLocaleDateString('es-AR') : '—'}</td>
                </tr>
              ))}
            </Table>
            <div className={s.hint} style={{ margin: 0 }}>
              <strong>Ingresos</strong> cuenta los aparatos que ingresaron en el período; las sesiones viven 90 días sin uso, así que para períodos más viejos se ve menos de lo que hubo.
            </div>
          </Bloque>

          {/* ============================ PRODUCTOS ============================ */}
          <Bloque titulo="Productos: interés y pedidos" sub="Ordenados por lo que se pidió en plata; también los más mirados aunque no se hayan pedido.">
            <Table
              cols={[{ h: 'Producto' }, { h: 'Vistas', num: true }, { h: 'Seg. mirando', num: true }, { h: 'Al carrito', num: true }, { h: 'En pedidos', num: true }, { h: 'Unidades', num: true }, { h: 'Pedido ($)', num: true }]}
              empty="Sin datos en el período: se juntan a medida que la gente navega y pide."
              pag={pag}
            >
              {pag.visibles.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.nombre}</strong>{p.marca && <div className={s.hint} style={{ margin: 0 }}>{p.marca}</div>}</td>
                  <td className={s.num}>{p.vistas || '—'}</td>
                  <td className={s.num}>{p.segundosProm ? `${num(p.segundosProm, 1)} s` : '—'}</td>
                  <td className={s.num}>{p.carrito || '—'}</td>
                  <td className={s.num}>{p.pedidos || '—'}</td>
                  <td className={s.num}>{p.unidades ? num(p.unidades, 2) : '—'}</td>
                  <td className={s.num}><strong>{p.total ? money(p.total) : '—'}</strong></td>
                </tr>
              ))}
            </Table>
            <div className={s.hint} style={{ margin: 0 }}>
              <strong>Vistas</strong> = veces que la tarjeta estuvo realmente en pantalla (≥50 % visible). <strong>Seg. mirando</strong> = promedio con la tarjeta a la vista: el interés, compren o no.
              {' '}<strong>Pedido ($)</strong> = lo cotizado en pedidos no rechazados del período.
            </div>
          </Bloque>
          <Grilla>
            <Bloque titulo="Categorías más pedidas" sub="Plata de los pedidos no rechazados, por categoría.">
              {d.productos.categorias.length
                ? <Barras datos={d.productos.categorias.map((c) => ({ etiqueta: c.nombre, valor: c.total, detalle: `${entero(c.pedidos)} pedido(s)` }))} formato={money} sufijo={(c) => `· ${c.detalle}`} />
                : <div className={s.hint} style={{ margin: 0 }}>Sin pedidos en el período.</div>}
            </Bloque>
            <Bloque titulo="Marcas más pedidas" sub="Plata de los pedidos no rechazados, por marca.">
              {d.productos.marcas.length
                ? <Barras datos={d.productos.marcas.map((m) => ({ etiqueta: m.nombre, valor: m.total, detalle: `${entero(m.pedidos)} pedido(s)` }))} formato={money} sufijo={(m) => `· ${m.detalle}`} />
                : <div className={s.hint} style={{ margin: 0 }}>Sin pedidos en el período.</div>}
            </Bloque>
            <Bloque titulo="Lo más buscado" sub="Lo que la gente escribe en el buscador. Lo que se busca y no está es la lista de compras del catálogo.">
              {d.productos.busquedas.length
                ? <Barras datos={d.productos.busquedas.map((b) => ({ etiqueta: b.termino, valor: b.veces }))} formato={entero} sufijo={() => 'veces'} />
                : <div className={s.hint} style={{ margin: 0 }}>Sin búsquedas en el período.</div>}
            </Bloque>
          </Grilla>
        </>
      )}
    </div>
  );
}

/**
 * DE DÓNDE LLEGAN (0194): por canal, cuántos visitantes entraron y cuántos de
 * ellos cargaron el carrito y pidieron — lo que dice qué canal TRAE compras.
 */
function DeDondeLlegan({ o, sesiones }) {
  const sinDato = Math.max(0, sesiones - (o?.sesiones ?? 0));
  /* Columnas más anchas que la Grilla común: las tablas entran sin correrse; en pantallas chicas, una abajo de la otra. */
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(480px, 100%), 1fr))', gap: 12 }}>
      <Bloque titulo="De dónde llegan" sub="Por dónde entró cada visitante, y cuántos de cada canal cargaron el carrito y mandaron el pedido.">
        {!o?.canales?.length ? (
          <div className={s.hint} style={{ margin: 0 }}>Todavía sin datos de llegada en este período: se miden desde el 22/10/2026.</div>
        ) : (
          <>
            <Table cols={[{ h: 'Canal' }, { h: 'Visitantes', num: true }, { h: 'Carrito', num: true }, { h: 'Pidieron', num: true }, { h: 'Conversión', num: true }]}>
              {o.canales.map((c) => (
                <tr key={c.canal}>
                  <td>{c.nombre}</td>
                  <td className={s.num}>{entero(c.sesiones)} <span className={s.muted}>· {pctTxt(c.pct)}</span></td>
                  <td className={s.num}>{entero(c.carrito)}</td>
                  <td className={s.num}>{entero(c.pedidos)}</td>
                  <td className={s.num}>{pctTxt(c.conversion)}</td>
                </tr>
              ))}
            </Table>
          </>
        )}
        {sinDato > 0 && <div className={s.hint} style={{ margin: 0 }}>{entero(sinDato)} visitante(s) del período entraron antes de que se midiera la llegada (22/10/2026): no tienen este dato.</div>}
      </Bloque>
      <Bloque titulo="Sitios y campañas que más mandan" sub="El sitio que trajo la visita o la campaña del link.">
        {o?.detalle?.length
          ? (
            <Table cols={[{ h: 'Sitio o campaña' }, { h: 'Canal' }, { h: 'Visitantes', num: true }]}>
              {o.detalle.map((x) => (
                <tr key={`${x.canal}|${x.detalle}`}><td style={{ wordBreak: 'break-word' }}>{x.detalle}</td><td>{x.nombre}</td><td className={s.num}>{entero(x.sesiones)}</td></tr>
              ))}
            </Table>
          )
          : <div className={s.hint} style={{ margin: 0 }}>Sin sitios ni campañas en el período.</div>}
        <div className={s.hint} style={{ margin: 0 }}>
          «Directo» es quien escribió la dirección o abrió un link sin datos: WhatsApp y la bio de Instagram casi nunca dicen de dónde viene la visita. Para distinguirlos, compartí el link con
          {' '}<code>?utm_source=whatsapp</code> o <code>?utm_source=instagram</code> (y si es una promo, <code>&amp;utm_campaign=dia-madre</code>).
        </div>
      </Bloque>
    </div>
  );
}

/**
 * «EMPEZAR DE 0» (0194, solo superadmin): borra la navegación registrada de
 * esa tienda y las métricas cuentan desde ahora. Pide confirmar dos veces.
 */
function EmpezarDeCero({ modo, onCerrar, onHecho }) {
  const [error, setError] = useState('');
  const sc = useSegundaConfirmacion(modo);
  const confirmar = () => sc.clic(
    () => true,
    async () => {
      setError('');
      try { onHecho(await httpClient.post('/web/metricas/reiniciar', { modo, confirmado: true })); } catch (e) { setError(errorMsg(e)); }
    },
  );
  return (
    <ModalShell title={`Empezar de 0 la tienda ${modo}`} onClose={onCerrar} footer={[
      { texto: 'Cancelar', onClick: onCerrar },
      { texto: textoBoton(sc, 'Empezar de 0', 'Sí, empezar de 0'), clase: 'btn-delete', onClick: confirmar },
    ]}>
      <div className={s.desc}>
        Se <strong>borran</strong> las visitas, los productos mirados, los agregados al carrito, las búsquedas y de dónde llegaron de la
        {' '}<strong>tienda {modo}</strong>, y todas sus métricas empiezan a contar <strong>desde ahora</strong>.
      </div>
      <div className={s.desc}>
        Los <strong>pedidos</strong> y los <strong>clientes</strong> no se borran (siguen en Ventas y en Accesos), pero dejan de contar en estas métricas.
        La otra tienda no se toca.
      </div>
      <AvisoSegundaConfirmacion {...sc}>No se puede deshacer: lo borrado no se recupera.</AvisoSegundaConfirmacion>
      {error && <Aviso tono="warn">{error}</Aviso>}
    </ModalShell>
  );
}
