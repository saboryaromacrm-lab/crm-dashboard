/**
 * FACTURA A UN CUIT, DENTRO DEL COBRO (0125, 30/9/2026 — pedido del dueño)
 * ============================================================================
 * Vendiendo a Consumidor Final, el cliente pide factura con su CUIT: se busca
 * en ARCA y se factura ahí mismo, sin salir de la ventana de cobro.
 *
 *   · La condición de IVA (y con ella la letra, A o B) la trae ARCA: el cajero
 *     solo escribe el CUIT. La API vuelve a consultar al facturar; esto es para
 *     que el cajero VEA a quién le factura antes de apretar F8.
 *   · Si ARCA no contesta, se cargan los datos a mano (decisión del dueño:
 *     también el cajero). La factura queda marcada «cargada a mano».
 *   · Si el CUIT ya es cliente, se avisa: la venta queda a su nombre con los
 *     mismos precios del ticket.
 *
 * `onCambio(null)` = no se factura a un CUIT; si no,
 * `{ cuit, manual, nombre, letra, listo }` — `listo` habilita Facturar.
 */
import { useEffect, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { ventasApi } from '../services/ventas.api.js';
import { CONDICION_IVA, cuitValido, formatearCuit, letraPara, soloDigitos } from '../domain/cuit.js';
import { Btn, s } from './ui.jsx';

const VACIO_MANUAL = { nombre: '', condicionIva: '', direccion: '', localidad: '' };

export function FacturaACuit({ condicionEmpresa, onCambio }) {
  const [abierto, setAbierto] = useState(false);
  const [cuit, setCuit] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [datos, setDatos] = useState(null);         // lo que devolvió ARCA
  const [error, setError] = useState('');
  const [aMano, setAMano] = useState(false);        // ARCA no contestó: carga manual
  const [manual, setManual] = useState(VACIO_MANUAL);
  const [clienteExistente, setClienteExistente] = useState(null);
  const inputRef = useRef(null);
  const enVuelo = useRef(false);

  useEffect(() => { if (abierto) inputRef.current?.focus(); }, [abierto]);

  /* Lo que se le avisa al cobro. Se recalcula con cada cambio. */
  useEffect(() => {
    if (!abierto) { onCambio(null); return; }
    const numero = soloDigitos(cuit);
    if (datos && soloDigitos(datos.cuit) === numero) {
      onCambio({ cuit: numero, manual: null, nombre: datos.nombre, letra: letraPara(datos.condicionIva, condicionEmpresa), listo: true });
      return;
    }
    if (aMano) {
      const listo = cuitValido(numero) && !!manual.nombre.trim() && !!manual.condicionIva;
      onCambio({
        cuit: numero,
        manual: listo ? { nombre: manual.nombre.trim(), condicionIva: manual.condicionIva, direccion: manual.direccion.trim(), localidad: manual.localidad.trim() } : null,
        nombre: manual.nombre.trim(),
        letra: manual.condicionIva ? letraPara(manual.condicionIva, condicionEmpresa) : '',
        listo,
      });
      return;
    }
    onCambio({ cuit: numero, manual: null, nombre: '', letra: '', listo: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, cuit, datos, aMano, manual, condicionEmpresa]);

  const buscar = async () => {
    if (enVuelo.current) return;
    const numero = soloDigitos(cuit);
    setError(''); setDatos(null); setAMano(false); setClienteExistente(null);
    if (!cuitValido(numero)) { setError('Ese CUIT no es válido: revisá los 11 números (el último es un dígito verificador).'); return; }
    enVuelo.current = true; setBuscando(true);
    try {
      const d = await ventasApi.padronCuit(numero);
      setDatos(d);
      setClienteExistente(d.cliente ?? null);
    } catch (e) {
      const body = e?.data ?? {};
      const msg = body?.message || 'No se pudo consultar ARCA.';
      setError(typeof msg === 'string' ? msg : 'No se pudo consultar ARCA.');
      setClienteExistente(body?.cliente ?? null);
      // 400 = el dato está mal (no existe ese CUIT): no hay nada que cargar a mano.
      if (e?.status !== 400) { setAMano(true); setManual((m) => ({ ...m, nombre: m.nombre || body?.cliente?.nombre || '' })); }
    } finally {
      enVuelo.current = false; setBuscando(false);
    }
  };

  const cerrar = () => {
    setAbierto(false); setCuit(''); setDatos(null); setError(''); setAMano(false); setManual(VACIO_MANUAL); setClienteExistente(null);
  };

  if (!abierto) {
    return (
      <div style={{ marginBottom: 'var(--crm-space-3)' }}>
        <Btn small onClick={() => setAbierto(true)}>Facturar a un CUIT</Btn>
        <span className={s.hint} style={{ marginLeft: 8 }}>el cliente pide factura con su CUIT</span>
      </div>
    );
  }

  const letra = datos ? letraPara(datos.condicionIva, condicionEmpresa) : '';
  return (
    <div className={cx(s.callout, s.info)} style={{ marginBottom: 'var(--crm-space-3)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className={s.field} style={{ marginBottom: 0, flex: '1 1 180px' }}>
          <label htmlFor="cobro-cuit">CUIT del comprador</label>
          <input
            id="cobro-cuit" ref={inputRef} inputMode="numeric" autoComplete="off" placeholder="20-12345678-9"
            value={formatearCuit(cuit)}
            onChange={(e) => { setCuit(soloDigitos(e.target.value)); setDatos(null); setError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); buscar(); } }}
          />
        </div>
        <Btn variant="btn-primary" small disabled={buscando || soloDigitos(cuit).length !== 11} onClick={buscar}>
          {buscando ? 'Buscando en ARCA…' : 'Buscar'}
        </Btn>
        <Btn small onClick={cerrar}>Quitar</Btn>
      </div>

      {datos && (
        <div>
          <div><strong style={{ fontSize: 15 }}>{datos.nombre}</strong></div>
          <div className={s.hint} style={{ margin: 0 }}>
            {formatearCuit(datos.cuit)} · {CONDICION_IVA[datos.condicionIva] ?? datos.condicionIva}
            {datos.direccion ? ` · ${datos.direccion}${datos.localidad ? `, ${datos.localidad}` : ''}` : ''}
          </div>
          <div style={{ marginTop: 4 }}>Sale <strong>Factura {letra}</strong> a su nombre.</div>
          {datos.aviso && <div className={s.hint} style={{ margin: '2px 0 0', color: 'var(--crm-color-warning)' }}>{datos.aviso}</div>}
        </div>
      )}

      {error && <div style={{ color: aMano ? 'var(--crm-color-text)' : 'var(--crm-color-danger)' }}>{error}</div>}

      {aMano && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div><strong>Cargá los datos a mano</strong> <span className={s.hint}>— la factura queda marcada «cargada a mano» para revisarla.</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 8 }}>
            <div className={s.field} style={{ marginBottom: 0 }}>
              <label htmlFor="cobro-cuit-nombre">Nombre o razón social</label>
              <input id="cobro-cuit-nombre" value={manual.nombre} maxLength={160} onChange={(e) => setManual((m) => ({ ...m, nombre: e.target.value }))} />
            </div>
            <div className={s.field} style={{ marginBottom: 0 }}>
              <label htmlFor="cobro-cuit-iva">Condición frente al IVA</label>
              <select id="cobro-cuit-iva" value={manual.condicionIva} onChange={(e) => setManual((m) => ({ ...m, condicionIva: e.target.value }))}>
                <option value="">Elegí…</option>
                {['responsable_inscripto', 'monotributo', 'exento', 'consumidor_final'].map((k) => <option key={k} value={k}>{CONDICION_IVA[k]}</option>)}
              </select>
            </div>
            <div className={s.field} style={{ marginBottom: 0 }}>
              <label htmlFor="cobro-cuit-dir">Domicilio (opcional)</label>
              <input id="cobro-cuit-dir" value={manual.direccion} maxLength={200} onChange={(e) => setManual((m) => ({ ...m, direccion: e.target.value }))} />
            </div>
          </div>
          {manual.condicionIva && <div>Sale <strong>Factura {letraPara(manual.condicionIva, condicionEmpresa)}</strong>.</div>}
          <div><Btn small disabled={buscando} onClick={buscar}>Reintentar con ARCA</Btn></div>
        </div>
      )}

      {clienteExistente && (
        <div className={s.hint} style={{ margin: 0 }}>
          Este CUIT ya es cliente: <strong>{clienteExistente.nombre}</strong>. La venta queda a su nombre, con los mismos precios del ticket.
        </div>
      )}
    </div>
  );
}
