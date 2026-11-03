/**
 * MÉTRICAS › SISTEMA ANTERIOR (0213, 3/11/2026)
 * ============================================================================
 * Los meses del sistema viejo (su «Estadística de ventas por período», un
 * archivo por local) al lado de los del ERP, para el mismo local. Qué se
 * compara y qué no lo decide el servidor (crm-api src/metricas/anterior.ts):
 * acá solo se sube el archivo y se muestra.
 */
import { useRef, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { errorMsg } from '@modules/ventas/services/ventas.api.js';
import { useResource } from '@modules/ventas/hooks/useResource.js';
import { leerTexto } from '@modules/productos/domain/importarCatalogo.js';
import { money, num } from '@modules/productos/domain/format.js';
import { Table, Btn, s } from '@modules/productos/components/ui.jsx';
import { leerEstadistica, localDelArchivo } from './anterior.js';
import { nombreMes, pctTxt, puntosTxt } from './formato.js';
import { Aviso, Bloque, Cargando, Tile, Tiles, Variacion } from './piezas.jsx';

const ORIGEN = { anterior: 'Sistema anterior', erp: 'ERP' };

export function PestanaAnterior({ sucursalId, sucursales, version }) {
  const [subidas, setSubidas] = useState(0);
  const [msg, setMsg] = useState(null);
  const { data: d, loading, error } = useResource(
    `metricas:anterior:${sucursalId}:${version}:${subidas}`,
    () => httpClient.get(`/metricas/anterior${sucursalId ? `?sucursalId=${sucursalId}` : ''}`),
  );
  const listo = (texto) => { setMsg({ tono: 'ok', texto }); setSubidas((n) => n + 1); };

  const quitar = async (mes) => {
    if (!window.confirm(`¿Sacar ${nombreMes(mes)} del sistema anterior? Ese mes pasa a mostrarse con lo que tenga el ERP.`)) return;
    try {
      await httpClient.delete(`/metricas/anterior/${sucursalId}/${mes}`);
      listo(`${nombreMes(mes)} quitado.`);
    } catch (e) { setMsg({ tono: 'warn', texto: errorMsg(e) }); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: loading ? 0.6 : 1 }}>
      <SubirArchivo sucursales={sucursales} sucursalId={sucursalId} onGuardado={listo} />
      {msg && <Aviso tono={msg.tono}>{msg.texto}</Aviso>}
      {error && <Aviso tono="warn">{error}</Aviso>}
      {!d && !error && <Cargando />}
      {d && !sucursalId && <ElegirLocal locales={d.locales} />}
      {/* Mientras carga otro local, `d` todavía es el anterior: solo se muestra el que se pidió. */}
      {d && sucursalId && d.sucursalId === Number(sucursalId) && <Comparacion d={d} onQuitar={quitar} />}
    </div>
  );
}

function ElegirLocal({ locales }) {
  return (
    <Aviso>
      Elegí la sucursal arriba para ver su comparación: cada archivo es de un local.
      {locales.length > 0 && (
        <> Ya hay meses del sistema anterior de {locales.map((l) => `${l.nombre} (${nombreMes(l.desde)} a ${nombreMes(l.hasta)})`).join(', ')}.</>
      )}
    </Aviso>
  );
}

/* ============================== SUBIR ============================== */

function SubirArchivo({ sucursales, sucursalId, onGuardado }) {
  const input = useRef(null);
  const [archivo, setArchivo] = useState(null);
  const [local, setLocal] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const elegir = async (file) => {
    if (!file) return;
    setError('');
    const leido = leerEstadistica(await leerTexto(file));
    setArchivo({ nombre: file.name, ...leido });
    setLocal(String(localDelArchivo(file.name, sucursales)?.id ?? sucursalId ?? ''));
  };

  const guardar = async () => {
    if (guardando) return;
    setGuardando(true); setError('');
    try {
      await httpClient.post('/metricas/anterior', { sucursalId: Number(local), meses: archivo.meses });
      const nombre = sucursales.find((x) => String(x.id) === local)?.nombre ?? '';
      onGuardado(`Listo: ${archivo.meses.length} mes(es) del sistema anterior guardados en ${nombre}.${String(sucursalId) === local ? '' : ' Elegí esa sucursal arriba para verlos.'}`);
      setArchivo(null);
    } catch (e) { setError(errorMsg(e)); } finally { setGuardando(false); }
  };

  return (
    <Bloque
      titulo="Subir ventas del sistema anterior"
      sub="El CSV de «Estadística de ventas por período», un archivo por local. Si un mes ya estaba subido, se reemplaza."
      acciones={(
        <>
          <input ref={input} id="anterior-archivo" type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(ev) => { void elegir(ev.target.files?.[0]); ev.target.value = ''; }} />
          <Btn onClick={() => input.current?.click()}>Elegir archivo…</Btn>
        </>
      )}
    >
      {archivo && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className={s.hint} style={{ margin: 0 }}>{archivo.nombre}</span>
            <Btn small onClick={() => setArchivo(null)}>Cancelar</Btn>
          </div>
          {archivo.errores.length > 0 ? (
            <Aviso tono="warn">{archivo.errores.map((x) => <div key={x}>{x}</div>)}</Aviso>
          ) : (
            <>
              <Table cols={[{ h: 'Mes' }, { h: 'Días con venta', num: true }, { h: 'Comprobantes', num: true }, { h: 'Monto (con IVA)', num: true }, { h: 'Costo (con IVA)', num: true }]}>
                {archivo.meses.map((m) => (
                  <tr key={m.mes}>
                    <td>{nombreMes(m.mes)}</td>
                    <td className={s.num}>{num(m.diasVenta, 0)}</td>
                    <td className={s.num}>{num(m.comprobantes, 0)}</td>
                    <td className={s.num}>{money(m.monto)}</td>
                    <td className={s.num}>{money(m.costo)}</td>
                  </tr>
                ))}
              </Table>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <label htmlFor="anterior-local" className={s.hint} style={{ margin: 0 }}>¿De qué local es?</label>
                <select id="anterior-local" className={s['select-inline']} value={local} onChange={(ev) => setLocal(ev.target.value)}>
                  <option value="">Elegí el local…</option>
                  {sucursales.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                </select>
                <Btn variant="btn-primary" disabled={!local || guardando} onClick={guardar}>
                  {guardando ? 'Guardando…' : `Guardar ${archivo.meses.length} mes(es)`}
                </Btn>
              </div>
            </>
          )}
          {error && <Aviso tono="warn">{error}</Aviso>}
        </>
      )}
    </Bloque>
  );
}

/* ============================== COMPARAR ============================== */

function Comparacion({ d, onQuitar }) {
  if (!d.meses.length) return <Aviso>Este local todavía no tiene ventas en el ERP ni meses subidos del sistema anterior.</Aviso>;
  const porMes = new Map(d.meses.map((m) => [m.mes, m]));
  const c = d.comparacion;
  const erp = c && porMes.get(c.erp);
  const ant = c && porMes.get(c.anterior);
  const contra = c && `vs ${nombreMes(c.anterior)}`;
  return (
    <>
      {c ? (
        <>
          <div className={s['card-title']} style={{ margin: 0 }}>{nombreMes(c.erp)} en el ERP contra {nombreMes(c.anterior)} en el sistema anterior</div>
          <Tiles>
            <Tile label="Venta (con IVA)" valor={money(erp.venta)} variacion={c.variacion.venta} contra={contra} detalle={`${nombreMes(c.anterior)}: ${money(ant.venta)}`} />
            <Tile label="Venta por día con venta" valor={money(erp.ventaPorDia)} variacion={c.variacion.ventaPorDia} contra={contra} detalle={`${num(erp.diasVenta, 0)} días contra ${num(ant.diasVenta, 0)}`} />
            <Tile label="Tickets" valor={num(erp.tickets, 0)} variacion={c.variacion.tickets} contra={contra} detalle={`${nombreMes(c.anterior)}: ${num(ant.tickets, 0)}`} />
            <Tile label="Ticket promedio" valor={money(erp.ticketPromedio)} variacion={c.variacion.ticketPromedio} contra={contra} detalle={`${nombreMes(c.anterior)}: ${money(ant.ticketPromedio)}`} />
            <Tile
              label="Renta" valor={pctTxt(erp.rentaPct)}
              detalle={erp.rentaPct == null
                ? `No se compara: solo el ${pctTxt(erp.cobertura)} de lo vendido tiene costo cargado.`
                : `${puntosTxt(c.variacion.rentaPts)} ${contra} (${pctTxt(ant.rentaPct)})`}
            />
          </Tiles>
        </>
      ) : (
        <Aviso>Para comparar hace falta un mes cerrado en el ERP y algún mes anterior subido del sistema viejo.</Aviso>
      )}

      <Bloque titulo="Mes a mes" sub="Cada mes sale de un solo sistema. Las flechas son contra el mes anterior.">
        <Table cols={[
          { h: 'Mes' }, { h: 'Días con venta', num: true }, { h: 'Tickets', num: true }, { h: 'Venta (con IVA)', num: true },
          { h: 'Ticket promedio', num: true }, { h: 'Venta por día', num: true }, { h: 'Renta', num: true }, { h: 'Markup', num: true }, { h: '' },
        ]}>
          {d.meses.map((m) => (
            <tr key={m.mes}>
              <td>
                <div style={{ fontWeight: 600 }}>{nombreMes(m.mes)}</div>
                <div className={s.hint} style={{ margin: 0 }}>{ORIGEN[m.origen]}{m.enCurso ? ' · en curso' : ''}</div>
                {m.tambienErp && (
                  <div className={s.hint} style={{ margin: 0 }}>El ERP también registró {money(m.tambienErp.venta)} ({num(m.tambienErp.tickets, 0)} tickets): no se suma.</div>
                )}
              </td>
              <td className={s.num}>{num(m.diasVenta, 0)}</td>
              <Celda valor={num(m.tickets, 0)} v={m.vsMesAnterior?.tickets} />
              <Celda valor={money(m.venta)} v={m.vsMesAnterior?.venta} />
              <Celda valor={money(m.ticketPromedio)} v={m.vsMesAnterior?.ticketPromedio} />
              <Celda valor={money(m.ventaPorDia)} v={m.vsMesAnterior?.ventaPorDia} />
              <td
                className={s.num}
                title={m.cobertura == null ? '' : `Con costo cargado: ${pctTxt(m.cobertura)} de lo vendido${m.rentaPct == null ? ` (hace falta ${d.coberturaMin} % para compararla)` : ''}`}
              >
                {m.rentaPct == null ? '—' : pctTxt(m.rentaPct)}
                {m.vsMesAnterior?.rentaPts != null && <div><Variacion valor={m.vsMesAnterior.rentaPts} contra="" sufijo=" pts" /></div>}
              </td>
              <td className={s.num}>{m.markupPct == null ? '—' : pctTxt(m.markupPct)}</td>
              <td>{m.origen === 'anterior' && <Btn small variant="btn-delete" onClick={() => onQuitar(m.mes)}>Quitar</Btn>}</td>
            </tr>
          ))}
        </Table>
      </Bloque>
      <div className={s.hint} style={{ margin: 0 }}>
        Comparación aproximada. Venta y ticket con IVA y de todo lo vendido (en el ERP las notas de crédito restan). La renta del sistema
        anterior es con IVA y la del ERP sin IVA: el porcentaje da casi igual, por eso se compara el % y no la ganancia en pesos. En el ERP
        solo cuenta lo que tiene costo cargado, y si es menos del {d.coberturaMin} % de lo vendido no se muestra. Las unidades no se comparan:
        los dos sistemas no cuentan igual el granel.
      </div>
    </>
  );
}

/** Un número con su flecha contra el mes anterior, debajo. */
function Celda({ valor, v }) {
  return (
    <td className={s.num}>
      {valor}
      {v != null && <div><Variacion valor={v} contra="" /></div>}
    </td>
  );
}
