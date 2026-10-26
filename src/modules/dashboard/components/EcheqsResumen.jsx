/**
 * ECHEQS EN EL DASHBOARD (22/10/2026, pedido del dueño): lo que hay que mirar
 * de los echeqs emitidos sin entrar a Proveedores — los vencidos que todavía
 * no se marcaron cobrados, lo que debita en la semana, lo que está en
 * circulación y los próximos a debitar. Sale de `GET /echeqs/stats` (una sola
 * llamada) y solo se dibuja para quien tiene la sección Echeqs.
 */
import { useNavigate } from 'react-router-dom';
import { cx } from '@shared/utils/classNames.js';
import { useResource } from '@modules/ventas/hooks/useResource.js';
import { provApi } from '@modules/proveedores/services/proveedores.api.js';
import { Table, Stat, VencePill, money, fmtFecha, s } from '@modules/proveedores/components/ui.jsx';

const RUTA = '/proveedores?panel=echeqs';
const cuenta = (x) => `${x?.n ?? 0} · ${money(x?.monto ?? 0)}`;

export function EcheqsResumen() {
  const navigate = useNavigate();
  const { data: e, error } = useResource('dashboard-echeqs', provApi.statsEcheqs);
  if (error || !e) return null;
  return (
    <div className={cx(s.card, s.cardPad)}>
      <h3 className={s['card-title']}>
        Echeqs
        <button type="button" className={s.link} style={{ all: 'unset', cursor: 'pointer' }} onClick={() => navigate(RUTA)}>
          <span className={s.link}>Ver todos →</span>
        </button>
      </h3>
      {/* Se acomodan solos: cuatro en la PC, uno abajo del otro en el celular (los importes no se cortan). */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: 12, marginBottom: 12 }}>
        <Stat label="Vencidos sin marcar cobrados" value={cuenta(e.vencidos)} accent={e.vencidos.n ? 'accent-red' : undefined} />
        <Stat label="Debitan en 3 días" value={cuenta(e.prox3)} accent={e.prox3.n ? 'accent-amber' : undefined} />
        <Stat label="Debitan en 7 días" value={cuenta(e.semana)} />
        <Stat label="En circulación" value={cuenta(e.activos)} />
      </div>
      <Table cols={[{ h: 'Debita' }, { h: 'A nombre de' }, { h: 'Banco' }, { h: 'Importe', num: true }]} empty="No hay echeqs en circulación.">
        {(e.proximos ?? []).map((x) => (
          <tr key={x.id}>
            <td style={{ whiteSpace: 'nowrap' }}>{fmtFecha(x.fechaVenc)} <VencePill dias={x.diasRest} /></td>
            <td>{x.aNombreDe || '—'}</td>
            <td>{x.banco || '—'}</td>
            <td className={s.num}>{money(x.importe)}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
