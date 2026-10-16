/**
 * EL OPERADOR QUE ESTA PC RECUERDA (0102). En el puesto de fraccionado trabaja
 * casi siempre la misma persona: el último elegido se propone solo, sea en el
 * registro de fraccionado o al tomar un pedido de la caja (0170).
 */
const CLAVE = 'crm.fraccion.operador';

export const operadorRecordado = () => { try { return Number(localStorage.getItem(CLAVE)) || null; } catch { return null; } };
export const recordarOperador = (id) => { try { if (id) localStorage.setItem(CLAVE, String(id)); } catch { /* navegación privada */ } };
