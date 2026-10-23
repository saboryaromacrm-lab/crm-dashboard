/**
 * Una fecha del Cash Flow con su día de la semana chico adelante («JU 23/10/2026, 09:01»).
 * `corta` = sin la hora. Vale para instantes y para días de calendario ('2026-10-23').
 */
import { diaSemana, fechaCortaSinDia, fechaHoraSinDia } from './formato.js';

const DIA = { fontSize: '0.72em', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--crm-color-text-muted)' };

export function Fecha({ v, corta = false }) {
  if (!v) return '—';
  return <><span style={DIA}>{diaSemana(v)}</span> {corta ? fechaCortaSinDia(v) : fechaHoraSinDia(v)}</>;
}
