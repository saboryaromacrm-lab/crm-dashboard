/**
 * REDONDEAR MARKUPS (28/9/2026, pedido del dueño)
 * ============================================================================
 * "Me quedan muchísimos markups": 134,8 → 135, sin decimales y de 5 en 5.
 * Cada markup va al múltiplo más cercano (ver `redondearMarkup`), así que
 * ninguno se mueve más de medio paso. Se abre desde Márgenes, para todo lo
 * filtrado o para una sola lista, y guarda por la misma puerta que la
 * actualización masiva de márgenes: fila por fila, con la evolución firmada.
 *
 * El precio definido no se toca: lo fijó una persona y no es un porcentaje.
 */
import { useMemo, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../../context/ProductosContext.jsx';
import { num } from '../../domain/format.js';
import { planRedondeo } from '../../domain/margenes.js';
import { ModalShell } from '../Modal.jsx';
import { Table, usePaginado, s } from '../ui.jsx';

/** Lo que acepta el servidor por pedido: más filas van en varias tandas. */
const TANDA = 5000;

const pct = (v) => `${num(v, v % 1 ? 1 : 0)}%`;

export function RedondearMarkupsModal({ filas = [], listaId = null, contexto = '' }) {
  const { store, closeModal, toast } = useProductos();
  const [paso, setPaso] = useState(5);
  const [confirmando, setConfirmando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const enVuelo = useRef(false);

  const plan = useMemo(() => planRedondeo(filas, { paso, listaId }), [filas, paso, listaId]);
  const pag = usePaginado(plan.transiciones, 'redondear-markups', String(paso));

  const aplicar = async () => {
    if (!confirmando) { setConfirmando(true); return; }
    if (enVuelo.current) return;
    enVuelo.current = true;
    setGuardando(true);
    let hechos = 0;
    let error = null;
    for (let i = 0; i < plan.cambios.length && !error; i += TANDA) {
      const tanda = plan.cambios.slice(i, i + TANDA);
      // De a una tanda por vez: la segunda recién sale si la primera entró.
      const res = await store.actualizarMargenes({
        cambios: tanda.map((c) => ({ id: c.id, valor: c.despues })),
        motivo: paso === 5 ? 'Redondeo de markups de 5 en 5' : 'Redondeo de markups sin decimales',
        usuarioId: store.state.ctx.usuarioId ?? undefined,
      });
      if (!res.ok) error = res.error || 'No se pudo guardar el redondeo.';
      else hechos += res.actualizados ?? tanda.length;
    }
    setGuardando(false);
    enVuelo.current = false;
    if (error) {
      setConfirmando(false);
      toast(hechos ? `Se guardaron ${hechos} y después falló: ${error}` : error, 'err');
      return;
    }
    toast(`${num(hechos, 0)} markup(s) redondeado(s).`, 'ok');
    closeModal();
  };

  const nada = plan.cambios.length === 0;
  const footer = [
    { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
    {
      texto: guardando ? 'Guardando…' : confirmando ? 'Sí, redondear' : `Redondear ${num(plan.cambios.length, 0)} markup(s)…`,
      clase: 'btn-primary',
      onClick: guardando || nada ? () => {} : aplicar,
    },
  ];

  return (
    <ModalShell title="Redondear markups" subtitle={contexto} size="md" onClose={closeModal} footer={footer}>
      <div className={s.field} style={{ marginBottom: 12 }}>
        <label htmlFor="redondeo-paso">Cómo redondear</label>
        <select
          id="redondeo-paso"
          value={paso}
          onChange={(e) => { setPaso(Number(e.target.value)); setConfirmando(false); }}
        >
          <option value={5}>De 5 en 5 (134,8% → 135% · 132% → 130%)</option>
          <option value={1}>Solo sacar los decimales (134,8% → 135% · 132% queda)</option>
        </select>
        <div className={s.hint} style={{ margin: '6px 0 0' }}>
          Cada markup va al valor más cercano: ninguno se mueve más de {paso === 5 ? '2,5' : '0,5'} puntos.
          El precio de góndola acompaña, y queda en la evolución de precios.
        </div>
      </div>

      <div className={s.stats} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <div className={s.stat}>
          <div className={s['stat-label']}>Markups distintos</div>
          <div className={s['stat-value']}>{num(plan.valoresAntes, 0)} → {num(plan.valoresDespues, 0)}</div>
        </div>
        <div className={s.stat}>
          <div className={s['stat-label']}>Filas que cambian</div>
          <div className={s['stat-value']}>{num(plan.cambios.length, 0)} de {num(plan.filasConMarkup, 0)}</div>
        </div>
        <div className={s.stat}>
          <div className={s['stat-label']}>Productos</div>
          <div className={s['stat-value']}>{num(plan.productos, 0)}</div>
        </div>
      </div>

      {plan.precioDefinido > 0 && (
        <div className={s.hint}>
          {num(plan.precioDefinido, 0)} fila(s) con <strong>precio definido</strong> no se tocan: su precio
          lo fijó alguien a mano.
        </div>
      )}

      {nada ? (
        <div className={cx(s.callout, s.ok)} style={{ marginTop: 12 }}>
          Ya están todos redondeados{paso === 5 ? ' de 5 en 5' : ''}: no hay nada que cambiar.
        </div>
      ) : (
        <>
          <div className={s['section-title']}>Qué pasa con cada valor</div>
          <Table cols={[{ h: 'Lista' }, { h: 'Hoy', num: true }, { h: 'Queda', num: true }, { h: 'Artículos', num: true }]} pag={pag}>
            {pag.visibles.map((t) => (
              <tr key={`${t.lista}|${t.antes}`}>
                <td>{t.lista}</td>
                <td className={cx(s.num, s.muted)}>{pct(t.antes)}</td>
                <td className={s.num}><strong>{pct(t.despues)}</strong></td>
                <td className={s.num}>{num(t.cantidad, 0)}</td>
              </tr>
            ))}
          </Table>
        </>
      )}

      {confirmando && (
        <div className={cx(s.callout, s.warn)} style={{ marginTop: 12 }}>
          <strong>Segunda confirmación.</strong> Se cambian <strong>{num(plan.cambios.length, 0)}</strong> markup(s)
          de <strong>{num(plan.productos, 0)}</strong> producto(s), y sus precios de góndola se mueven en el acto.
          Tocá «Sí, redondear» para seguir.
        </div>
      )}
    </ModalShell>
  );
}
