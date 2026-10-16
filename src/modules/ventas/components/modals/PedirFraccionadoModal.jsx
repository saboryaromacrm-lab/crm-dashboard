/**
 * PEDIR A FRACCIONADO (0170, pedido del dueño) — F7 en la caja de la Distribuidora.
 *
 * El cliente pide «un paquete de avena de 400 g» que no está en la góndola. Se
 * busca el paquete como en la caja y Enter lo suma (escanearlo otra vez, uno
 * más); con el buscador vacío, Enter pide. Solo paquetes que existen: ningún granel
 * se vende suelto. Fraccionado lo ve en su aviso y el cajero ve cómo va.
 */
import { useMemo, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { pedidosCajaApi } from '@modules/productos/services/pedidosCaja.js';
import { useVentas } from '../../context/VentasContext.jsx';
import { errorMsg } from '../../services/ventas.api.js';
import { buscarEnCatalogo, esPaquete } from '../../domain/pos.js';
import { Btn, ModalShell, num, s } from '../ui.jsx';
import p from '../../styles/Pos.module.css';

const esEntero = (v) => /^\d+$/.test(String(v).trim()) && Number(v) > 0;

export function PedirFraccionadoModal({ catalogo, inicial = null, onPedido }) {
  const { closeModal, toast } = useVentas();
  const paquetes = useMemo(() => catalogo.filter(esPaquete), [catalogo]);
  const [q, setQ] = useState('');
  const [activo, setActivo] = useState(0);
  const [renglones, setRenglones] = useState(() => (inicial ? [{ item: inicial, paquetes: '1' }] : []));
  const [nota, setNota] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const candado = useRef(false);
  const buscadorRef = useRef(null);

  const resultados = useMemo(() => buscarEnCatalogo(paquetes, q, 8), [paquetes, q]);

  const agregar = (item) => {
    setRenglones((rs) => (rs.some((r) => r.item.key === item.key)
      ? rs.map((r) => (r.item.key === item.key && esEntero(r.paquetes) ? { ...r, paquetes: String(Number(r.paquetes) + 1) } : r))
      : [...rs, { item, paquetes: '1' }]));
    setQ('');
    setActivo(0);
    buscadorRef.current?.focus();
  };

  const pedir = async () => {
    if (candado.current) return;
    if (!renglones.length) { setError('Buscá el paquete que pide el cliente.'); return; }
    if (renglones.some((r) => !esEntero(r.paquetes))) { setError('Los paquetes van en números enteros, desde 1.'); return; }
    candado.current = true;
    setEnviando(true);
    setError('');
    try {
      const r = await pedidosCajaApi.pedir({
        items: renglones.map((x) => ({ presentacionId: x.item.presentacionId, paquetes: Number(x.paquetes) })),
        observaciones: nota.trim(),
      });
      toast(`${r.codigo}: pedido a fraccionado. Acá arriba ves cuando lo están armando.`, 'ok');
      onPedido?.();
      closeModal();
    } catch (e) {
      setError(errorMsg(e));
      candado.current = false;
      setEnviando(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (q.trim()) { if (resultados[activo]) agregar(resultados[activo]); } else pedir();
    } else if (e.key === 'ArrowDown') { e.preventDefault(); setActivo((i) => Math.min(i + 1, resultados.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo((i) => Math.max(i - 1, 0)); }
  };
  const volverAlBuscador = (e) => { if (e.key === 'Enter') { e.preventDefault(); buscadorRef.current?.focus(); } };

  return (
    <ModalShell
      title="Pedir a fraccionado"
      subtitle="Para el paquete que no está en la góndola: fraccionado lo arma y te avisa."
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', onClick: closeModal, disabled: enviando },
        { texto: enviando ? 'Pidiendo…' : 'Pedir a fraccionado', clase: 'btn-primary', onClick: pedir, disabled: enviando || !renglones.length },
      ]}
    >
      <input
        ref={buscadorRef}
        className={p.buscadorInput}
        placeholder="Paquete: escaneá o escribí el nombre (avena 400…)"
        value={q}
        onChange={(e) => { setQ(e.target.value); setActivo(0); }}
        onKeyDown={onKeyDown}
        autoFocus
        autoComplete="off"
        aria-label="Buscar el paquete"
      />
      {q && (
        <div className={p.pedirResultados}>
          {resultados.length === 0 && <div className={p.resultado}><span className={p.resultadoMeta}>No hay un paquete que coincida con «{q}».</span></div>}
          {resultados.map((item, i) => (
            <button
              key={item.key} type="button"
              className={cx(p.resultado, i === activo && p.resultadoActivo)}
              onMouseEnter={() => setActivo(i)} onClick={() => agregar(item)}
            >
              <span>
                <span className={p.resultadoNombre}>{item.nombre}</span>
                <span className={p.resultadoMeta}>
                  {' · '}<strong>{item.detalle}</strong>
                  {item.marca ? ` · ${item.marca}` : ''}
                  {' · '}<span className={item.stock <= 0 ? p.sinStock : undefined}>en góndola: {num(item.stock)}</span>
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {renglones.length > 0 && (
        <table className={p.pedirTabla}>
          <tbody>
            {renglones.map((r) => (
              <tr key={r.item.key}>
                <td><strong>{r.item.nombre}</strong> · {r.item.detalle}</td>
                <td style={{ width: 90 }}>
                  <input
                    inputMode="numeric" value={r.paquetes} aria-label={`Paquetes de ${r.item.nombre} ${r.item.detalle}`}
                    onChange={(e) => setRenglones((rs) => rs.map((x) => (x.item.key === r.item.key ? { ...x, paquetes: e.target.value } : x)))}
                    onKeyDown={volverAlBuscador}
                  />
                </td>
                <td style={{ width: 36 }}>
                  <button type="button" className={p.pedirQuitar} aria-label={`Quitar ${r.item.nombre}`}
                    onClick={() => setRenglones((rs) => rs.filter((x) => x.item.key !== r.item.key))}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className={s.field} style={{ marginTop: 12 }}>
        <label htmlFor="pedir-fraccion-nota">Nota (opcional)</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            id="pedir-fraccion-nota" value={nota} maxLength={300} placeholder="Ej.: cliente esperando"
            onChange={(e) => setNota(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); pedir(); } }}
            style={{ flex: 1, minWidth: 180 }}
          />
          <Btn small onClick={() => setNota('Cliente esperando')}>Cliente esperando</Btn>
        </div>
      </div>
      {error && <div className={cx(s.callout, s.warn)} style={{ marginTop: 10 }}>{error}</div>}
      <div className={s.hint} style={{ marginTop: 10 }}>
        <kbd>Enter</kbd> suma el paquete (escanearlo otra vez suma uno más) · con el buscador vacío, <kbd>Enter</kbd> pide.
      </div>
    </ModalShell>
  );
}
