/**
 * FRACCIONAMIENTO › CUADRE SEMANAL (23/11/2026, pedido del dueño)
 * ============================================================================
 * Lo que sale de los paquetes (ventas, pases, bajas) tiene que haber entrado
 * antes: armado (fraccionado registrado) o recibido. Lo que salió cuando el
 * sistema ya no tenía ese paquete es «salió sin estar armado»: se armó sin
 * registrar, o se eligió el paquete cuando salió de la bolsa grande. Es el
 * hueco que más rompe el stock, y acá se ve semana a semana (la cuenta, en
 * crm-api `inventario/cuadre-fraccionado.ts`).
 */
import { Fragment, useEffect, useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../context/ProductosContext.jsx';
import { num, fmtTam, fmtFechaVenc, isoDate } from '../domain/format.js';
import { Table, Stat, Btn, usePaginado, s } from '../components/ui.jsx';

/** 'AAAA-MM-DD' corrido `n` días, sin pasar por la hora local. */
const masDias = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * 86_400_000).toISOString().slice(0, 10);
};
const norm = (v) => (v || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
/** Un movimiento de la cuenta: con su signo, o una raya si no hubo. */
const conSigno = (v, dec) => (Math.abs(v) < 0.0005 ? '—' : `${v > 0 ? '+' : '−'}${num(Math.abs(v), dec)}`);
/** Lo que salió (ventas, pases y bajas), con su signo; `suf` es 'Kg' en el producto y '' en el paquete. */
const salio = (x, suf) => x[`vendido${suf}`] + x[`enviado${suf}`] + x[`bajas${suf}`];
/** «vendido 2 · enviado 10 · bajas 50»: de dónde sale «Salió». */
const desglose = (x, suf, dec, unidad) => ['vendido', 'enviado', 'bajas']
  .filter((k) => Math.abs(x[`${k}${suf}`]) > 0.0005)
  .map((k) => `${k} ${num(-x[`${k}${suf}`], dec)} ${unidad}`)
  .join(' · ');

export function TabCuadre() {
  const { store, isAdmin, sucOperativa } = useProductos();
  const sucursales = store.state.sucursales;
  const [sucursalId, setSucursalId] = useState(() => String(store.distribuidora()?.id ?? sucOperativa() ?? ''));
  /* Abre en la semana pasada, la que ya terminó: es la que se revisa. */
  const [semana, setSemana] = useState(() => masDias(isoDate(new Date()), -7));
  const [res, setRes] = useState({ clave: '', datos: null, error: '' });
  const [soloSinArmar, setSoloSinArmar] = useState(true);
  const [texto, setTexto] = useState('');
  const [abiertos, setAbiertos] = useState(() => new Set());

  const clave = `${sucursalId}|${semana}`;
  useEffect(() => {
    if (!sucursalId) return undefined;
    let vivo = true;
    const k = `${sucursalId}|${semana}`;
    store.cuadreFraccionado({ sucursalId, semana }).then((r) => {
      if (vivo) setRes({ clave: k, datos: r.ok ? r.data : null, error: r.ok ? '' : (r.error || 'No se pudo armar el cuadre.') });
    });
    return () => { vivo = false; };
  }, [store, sucursalId, semana]);
  const cargando = res.clave !== clave;
  const d = cargando ? null : res.datos;
  const t = d?.totales;

  /* Sin nada que salió sin armar, el tilde no tiene sentido: se ve todo. */
  const hayFaltas = (t?.productosSinArmar ?? 0) > 0;
  const lista = useMemo(() => {
    const q = norm(texto.trim());
    return (d?.filas ?? [])
      .filter((f) => !(hayFaltas && soloSinArmar) || f.sinArmarPaquetes > 0)
      .filter((f) => !q || norm(f.nombre).includes(q));
  }, [d, hayFaltas, soloSinArmar, texto]);
  const pag = usePaginado(lista, 'cuadreFraccionado', `${clave}|${soloSinArmar}|${texto}`);
  /* Armado y recibido, solo si la semana tiene: la Distribuidora casi no recibe y los locales no arman. */
  const verArmado = (d?.filas ?? []).some((f) => Math.abs(f.armadoKg) > 0.0005);
  const verRecibido = (d?.filas ?? []).some((f) => Math.abs(f.recibidoKg) > 0.0005);
  const abrir = (id) => setAbiertos((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  /* En la Distribuidora se arma: lo que salió sin respaldo se armó sin registrar.
   * En un local no se arma: llegó sin recibirse en el sistema o el local nunca se contó. */
  const arma = String(store.distribuidora()?.id ?? '') === sucursalId;
  const txt = arma
    ? { falta: 'Salió sin estar armado', columna: 'Salió sin armar', solo: 'Solo los que salieron sin estar armados' }
    : { falta: 'Salió sin estar en el sistema', columna: 'Sin estar en el sistema', solo: 'Solo los que salieron sin estar en el sistema' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <div className={s.hint} style={{ margin: 0 }}>
        Lo que sale de los paquetes (ventas, pases y bajas) tiene que haber entrado antes: <strong>armado</strong> (el fraccionado
        registrado) o <strong>recibido</strong> (un pase de otra sucursal). <strong>«{txt.falta}»</strong> es lo que se vendió, se mandó
        o se dio de baja cuando el sistema ya no tenía ese paquete. Todo en kilos; tocá un producto para verlo por paquete.
      </div>

      <div className={s.toolbar} style={{ flexWrap: 'wrap', gap: 8 }}>
        {isAdmin && sucursales.length > 1 && (
          <select value={sucursalId} onChange={(e) => setSucursalId(e.target.value)} style={{ width: 'auto' }} aria-label="Sucursal">
            {sucursales.map((su) => <option key={su.id} value={su.id}>{su.nombre}</option>)}
          </select>
        )}
        <Btn small onClick={() => setSemana(masDias(d?.semana.lunes ?? semana, -7))} disabled={cargando} title="La semana anterior">‹</Btn>
        <strong style={{ whiteSpace: 'nowrap' }}>
          {d ? `Semana del lunes ${fmtFechaVenc(d.semana.lunes)} al domingo ${fmtFechaVenc(d.semana.domingo)}` : 'Semana…'}
          {d?.semana.enCurso && <span className={s.muted} style={{ fontWeight: 400 }}> (en curso)</span>}
        </strong>
        <Btn small onClick={() => setSemana(masDias(d.semana.lunes, 7))} disabled={cargando || !d || d.semana.enCurso} title="La semana siguiente">›</Btn>
        <span style={{ flex: 1 }} />
        <input
          type="search" placeholder="Buscar producto…" value={texto} onChange={(e) => setTexto(e.target.value)}
          aria-label="Buscar producto" style={{ width: 220 }}
        />
        {hayFaltas && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={soloSinArmar} onChange={(e) => setSoloSinArmar(e.target.checked)} />
            {txt.solo} ({t.productosSinArmar})
          </label>
        )}
      </div>

      {res.error && !cargando && <div className={cx(s.callout, s.danger)}>{res.error}</div>}

      <div className={s.stats}>
        <Stat label="Armado registrado" value={t ? `${num(t.armadoKg, 1)} kg` : '—'} />
        <Stat label="Recibido de otras sucursales" value={t ? `${num(t.recibidoKg, 1)} kg` : '—'} />
        <Stat label="Salió (ventas, pases y bajas)" value={t ? `${num(t.salieronKg, 1)} kg` : '—'} />
        <Stat
          label={txt.falta}
          value={t ? `${num(t.sinArmarKg, 1)} kg` : '—'}
          accent={t ? (t.sinArmarKg > 0.0005 ? 'accent-red' : 'accent-green') : undefined}
          nota={t && t.sinArmarPaquetes > 0 ? `${num(t.sinArmarPaquetes, 0)} paquetes en ${t.productosSinArmar} producto${t.productosSinArmar === 1 ? '' : 's'}` : null}
        />
      </div>

      {t && (t.sinArmarKg > 0.0005 ? (
        <div className={cx(s.callout, s.danger)}>
          {arma ? (
            <>
              <strong>{num(t.sinArmarPaquetes, 0)} paquetes salieron sin estar armados en el sistema</strong> ({num(t.sinArmarKg, 1)} kg).
              Revisá con quien fracciona si se armaron sin registrar, o si se eligió el paquete cuando salió de la bolsa grande (envíos a
              Coffit, pases). Mientras tanto, la bolsa grande de esos productos tiene kilos de más y los paquetes quedan en negativo.
            </>
          ) : (
            <>
              <strong>{num(t.sinArmarPaquetes, 0)} paquetes se vendieron o se mandaron sin estar en el sistema</strong> ({num(t.sinArmarKg, 1)} kg).
              Pasa cuando llega mercadería que no se recibe en el sistema, o cuando el local nunca hizo su control de stock: con el
              control hecho y cada pase recibido, desde ahí el número queda bien.
            </>
          )}
        </div>
      ) : t.productos > 0 && (
        <div className={cx(s.callout, s.ok)}>Todo lo que salió de los paquetes estaba armado o recibido en el sistema.</div>
      ))}

      <div className={s.tablaCompacta}>
        <Table
          cols={[
            { h: 'Producto' }, { h: 'Había', num: true },
            ...(verArmado ? [{ h: 'Armado', num: true }] : []),
            ...(verRecibido ? [{ h: 'Recibido', num: true }] : []),
            { h: 'Salió', num: true }, { h: 'Ajustes', num: true }, { h: 'Queda', num: true },
            { h: txt.columna, num: true }, { h: 'Bolsa grande', num: true },
          ]}
          pag={pag}
          empty={cargando ? 'Armando el cuadre…' : 'No hubo movimientos de paquetes de granel en esta semana.'}
        >
          {pag.visibles.map((f) => {
            const abierto = abiertos.has(f.productoId);
            return (
              <Fragment key={f.productoId}>
                <tr onClick={() => abrir(f.productoId)} style={{ cursor: 'pointer' }} title={abierto ? 'Ocultar los paquetes' : 'Ver por paquete'}>
                  <td style={{ minWidth: 170 }}><span className={s.muted}>{abierto ? '▾' : '▸'}</span> {f.nombre}</td>
                  <td className={s.num}>{num(f.inicioKg, 1)}</td>
                  {verArmado && <td className={s.num}>{conSigno(f.armadoKg, 1)}</td>}
                  {verRecibido && <td className={s.num}>{conSigno(f.recibidoKg, 1)}</td>}
                  <td className={s.num} title={desglose(f, 'Kg', 1, 'kg')}>{conSigno(salio(f, 'Kg'), 1)}</td>
                  <td className={s.num}>{conSigno(f.ajustesKg, 1)}</td>
                  <td className={s.num} style={{ color: f.finKg < -0.0005 ? 'var(--crm-color-danger)' : undefined }}>{num(f.finKg, 1)}</td>
                  <td className={s.num}>
                    {f.sinArmarKg > 0.0005
                      ? <strong style={{ color: 'var(--crm-color-danger)' }}>{num(f.sinArmarKg, 1)}</strong>
                      : <span className={s.muted}>—</span>}
                  </td>
                  <td className={s.num}>{num(f.bolsaKg, 1)}</td>
                </tr>
                {abierto && f.paquetes.map((p) => (
                  <tr key={`${f.productoId}-${p.presentacionId}`} style={{ fontSize: 12 }}>
                    <td style={{ paddingLeft: 24 }}>
                      Paquete de {fmtTam(p.tamKg)}, en unidades
                      <div className={s.muted}>{desglose(p, '', 0, 'u.') || 'sin salidas'}</div>
                    </td>
                    <td className={s.num}>{num(p.inicio, 0)}</td>
                    {verArmado && <td className={s.num}>{conSigno(p.armado, 0)}</td>}
                    {verRecibido && <td className={s.num}>{conSigno(p.recibido, 0)}</td>}
                    <td className={s.num}>{conSigno(salio(p, ''), 0)}</td>
                    <td className={s.num}>{conSigno(p.ajustes, 0)}</td>
                    <td className={s.num} style={{ color: p.fin < -0.0005 ? 'var(--crm-color-danger)' : undefined }}>{num(p.fin, 0)}</td>
                    <td className={s.num}>
                      {p.sinArmar > 0.0005 ? <strong style={{ color: 'var(--crm-color-danger)' }}>{num(p.sinArmar, 0)}</strong> : <span className={s.muted}>—</span>}
                    </td>
                    <td />
                  </tr>
                ))}
              </Fragment>
            );
          })}
        </Table>
      </div>
    </div>
  );
}
