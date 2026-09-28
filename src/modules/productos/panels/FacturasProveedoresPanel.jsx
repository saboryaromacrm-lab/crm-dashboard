/**
 * PROCESAMIENTO DE FACTURAS › PROVEEDORES — la guía (28/9/2026, pedido del dueño)
 * ============================================================================
 * Cada proveedor de mercadería con su ESTRUCTURA de lectura: el formato con el
 * que se leen solos los renglones de sus facturas PDF, o "sin estructura".
 * Muchos facturan con el mismo sistema (Tango…), así que una estructura armada
 * una vez se le asigna a otros acá mismo, sin tocar nada más.
 *
 * Una consulta al abrir (la API agrega todo de una) y ninguna más hasta que se
 * cambia un formato: la pantalla no le cuesta nada al sistema.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useProductos } from '../context/ProductosContext.jsx';
import { fmtFecha, num } from '../domain/format.js';
import { FORMATOS } from '../domain/facturas/recetas.js';
import { Btn, PanelHead, Pill, Stat, Table, usePaginado, s } from '../components/ui.jsx';

const norm = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
/* Además de las recetas hechas a mano: la lectura automática (confirmada para
   ese proveedor) y la estructura propia que armó el asistente. */
const nombreFormato = new Map([
  ['auto', 'Lectura automática'],
  ['plantilla', 'Estructura propia (asistente)'],
  ...FORMATOS.map((f) => [f.id, f.nombre]),
]);

const FILTROS = [
  ['sin', 'Sin estructura'],
  ['con', 'Con estructura'],
  ['esperando', 'Con facturas esperando'],
  ['todos', 'Todos'],
];

export function FacturasProveedoresPanel() {
  const { store, toast, isAdmin, openModal } = useProductos();
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState('sin');
  const [q, setQ] = useState('');
  const [guardando, setGuardando] = useState(null);

  const cargar = useCallback(async () => {
    try { setFilas(await store.facturasPorProveedor()); }
    catch { toast('No se pudo leer la lista de proveedores.', 'err'); }
    finally { setCargando(false); }
  }, [store, toast]);
  useEffect(() => { cargar(); }, [cargar]);

  const cambiarFormato = async (p, formato) => {
    setGuardando(p.id);
    try {
      await store.formatoFacturaProveedor(p.id, formato);
      // Se actualiza la fila en memoria: re-pedir todo por un cambio es gastar.
      setFilas((prev) => prev.map((x) => (x.id === p.id ? { ...x, formato } : x)));
      toast(formato ? `${p.nombre}: se lee con ${nombreFormato.get(formato) ?? formato}.` : `${p.nombre}: sin estructura.`, 'ok');
    } catch (e) {
      toast(e?.data?.message || 'No se pudo guardar el formato.', 'err');
    } finally {
      setGuardando(null);
    }
  };

  const totales = useMemo(() => ({
    con: filas.filter((f) => f.formato).length,
    sin: filas.filter((f) => !f.formato).length,
    esperando: filas.reduce((a, f) => a + (f.pendientes || 0), 0),
    sinConEspera: filas.filter((f) => !f.formato && f.pendientes > 0).length,
  }), [filas]);

  const visibles = useMemo(() => {
    const ql = norm(q.trim());
    return filas
      .filter((f) => {
        if (filtro === 'sin' && f.formato) return false;
        if (filtro === 'con' && !f.formato) return false;
        if (filtro === 'esperando' && !(f.pendientes > 0)) return false;
        return !ql || norm(f.nombre).includes(ql) || String(f.cuit ?? '').includes(q.trim());
      })
      // Primero los que tienen facturas esperando: son los que conviene resolver ya.
      .sort((a, b) => (b.pendientes || 0) - (a.pendientes || 0)
        || (b.cargadas || 0) - (a.cargadas || 0)
        || String(a.nombre).localeCompare(String(b.nombre)));
  }, [filas, filtro, q]);
  const pag = usePaginado(visibles, 'facturas-proveedores', `${filtro}|${q}`);

  const cuenta = (id) => ({
    sin: totales.sin, con: totales.con, todos: filas.length,
    esperando: filas.filter((f) => f.pendientes > 0).length,
  }[id]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Proveedores"
        desc="Quién ya tiene estructura de lectura: con estructura, los renglones de sus facturas PDF se leen solos."
      />

      <div className={s.stats}>
        <Stat label="Con estructura" value={num(totales.con, 0)} accent={totales.con ? 'accent-green' : undefined} />
        <Stat label="Sin estructura" value={num(totales.sin, 0)} accent={totales.sin ? 'accent-amber' : undefined} />
        <Stat label="Facturas esperando" value={num(totales.esperando, 0)} />
        <Stat label="Sin estructura y con facturas" value={num(totales.sinConEspera, 0)} accent={totales.sinConEspera ? 'accent-red' : undefined} />
      </div>

      <div className={s.toolbar} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          id="fp-buscar" type="search" placeholder="Buscar proveedor o CUIT…" value={q}
          onChange={(e) => setQ(e.target.value)} style={{ minWidth: 220 }}
        />
        {FILTROS.map(([id, texto]) => (
          <Btn key={id} small variant={filtro === id ? 'btn-primary' : 'btn-ghost'} onClick={() => setFiltro(id)}>
            {texto} ({num(cuenta(id), 0)})
          </Btn>
        ))}
      </div>

      <Table
        cols={[
          { h: 'Proveedor' }, { h: 'Estructura' }, { h: 'Esperando', num: true }, { h: 'Cargadas', num: true },
          { h: 'Última factura' }, { h: 'Artículos que ya reconoce', num: true },
        ]}
        empty={cargando ? 'Cargando…' : 'No hay proveedores con este filtro.'}
        pag={pag}
      >
        {pag.visibles.map((f) => (
          <tr key={f.id}>
            <td>
              <strong>{f.nombre}</strong>
              {f.cuit && <div className={s.hint} style={{ margin: 0 }}>CUIT {f.cuit}</div>}
            </td>
            <td>
              {isAdmin ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    id={`fp-formato-${f.id}`}
                    aria-label={`Estructura de ${f.nombre}`}
                    value={f.formato || ''}
                    disabled={guardando === f.id}
                    onChange={(e) => cambiarFormato(f, e.target.value)}
                  >
                    <option value="">— Sin estructura (prueba la lectura automática) —</option>
                    <option value="auto">Lectura automática</option>
                    {f.tienePlantilla && <option value="plantilla">Estructura propia (asistente)</option>}
                    {FORMATOS.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                  </select>
                  <Btn
                    small
                    onClick={() => openModal('asistenteFactura', { proveedorId: f.id, proveedorNombre: f.nombre, onListo: cargar })}
                  >
                    {f.tienePlantilla ? 'Rehacer con el asistente' : 'Asistente'}
                  </Btn>
                </div>
              ) : (
                f.formato
                  ? <Pill pill="est-recibida" label={nombreFormato.get(f.formato) ?? f.formato} />
                  : <Pill pill="est-pendiente" label="Sin estructura" />
              )}
            </td>
            <td className={s.num}>{f.pendientes ? <strong>{num(f.pendientes, 0)}</strong> : '—'}</td>
            <td className={s.num}>{f.cargadas ? num(f.cargadas, 0) : '—'}</td>
            <td>{f.ultima ? fmtFecha(f.ultima) : <span className={s.muted}>—</span>}</td>
            <td className={s.num}>{f.aprendidos ? num(f.aprendidos, 0) : '—'}</td>
          </tr>
        ))}
      </Table>

      <div className={s.hint}>
        <strong>Cómo tiene estructura un proveedor, sin que nadie programe nada:</strong> la primera factura PDF
        suya se intenta leer sola (<strong>lectura automática</strong>); si la suma cierra con el papel, la app te
        ofrece dejarla así. Si no cierra, el <strong>Asistente</strong> te pide tocar un renglón de ejemplo y marcar
        qué es cada parte (código, descripción, cantidad, precio, importe): se guarda y desde ahí se lee sola. <strong>Artículos que ya reconoce</strong> son los códigos del papel que ya quedaron
        asociados a tus productos: la primera factura de cada proveedor se asocia a mano, y de ahí en más
        se reconocen solos.
      </div>
    </div>
  );
}
