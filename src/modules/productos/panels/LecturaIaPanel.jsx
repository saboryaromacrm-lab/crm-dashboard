/**
 * LECTURA CON IA (0153) — el tablero de la lectura de facturas.
 * ============================================================================
 * Si está andando (la clave cargada en el servidor), cuánto se gastó en el mes
 * contra el tope, cuánto cuesta en promedio una factura, si se leen solas al
 * subir y las últimas llamadas con su modelo, tokens y costo. Solo superadmin
 * y admin.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../context/ProductosContext.jsx';
import { fmtFechaHora } from '../domain/format.js';
import { Table, PanelHead, Stat, Btn, s } from '../components/ui.jsx';

/** Dólares con los decimales que hacen falta: una lectura cuesta décimas de centavo. */
const usd = (n, dec = 4) => (n == null ? '—' : `USD ${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: dec })}`);
const nombreModelo = (m) => (/haiku/.test(m) ? 'Haiku' : /sonnet/.test(m) ? 'Sonnet' : /opus/.test(m) ? 'Opus' : m);

export function LecturaIaPanel() {
  const { store, toast } = useProductos();
  const [d, setD] = useState(null);
  const [tope, setTope] = useState('');
  const enVuelo = useRef(false);

  const cargar = useCallback(async () => {
    try {
      const r = await store.iaFacturas();
      setD(r);
      setTope(String(r.topeMensualUsd));
    } catch (e) {
      toast(e?.data?.message || 'No se pudo leer el estado de la IA.', 'err');
    }
  }, [store, toast]);
  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (o, ok) => {
    if (enVuelo.current) return;
    enVuelo.current = true;
    try {
      const r = await store.iaConfigFacturas(o);
      setD(r);
      setTope(String(r.topeMensualUsd));
      toast(ok, 'ok');
    } catch (e) {
      toast(e?.data?.message || 'No se pudo guardar.', 'err');
    } finally { enVuelo.current = false; }
  };

  if (!d) return <div className={s.hint}>Cargando…</div>;
  const topeNum = Number(tope.replace(',', '.'));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Lectura con IA"
        desc="La IA (Claude) lee cada factura que se sube y deja la carga lista para revisar. Primero el modelo barato; si la cuenta no cierra, uno más fuerte."
        actions={<Btn small onClick={cargar}>Actualizar</Btn>}
      />

      {!d.configurado ? (
        <div className={cx(s.callout, s.warn)}>
          <strong>La IA no está conectada.</strong> Falta la clave de Anthropic en el servidor: en Dokploy, en la
          aplicación del servidor (API), agregá la variable <span className={s.mono}>ANTHROPIC_API_KEY</span> con la
          clave creada en platform.claude.com y volvé a desplegar. Mientras tanto, las facturas se cargan a mano.
        </div>
      ) : d.avisoTope && (
        <div className={cx(s.callout, s.warn)}>
          {d.usoTope >= 100
            ? <>Se llegó al <strong>tope de gasto del mes</strong>: las facturas nuevas no se leen hasta que lo subas o empiece el mes que viene.</>
            : <>Ya se usó el <strong>{Number(d.usoTope).toLocaleString('es-AR')} %</strong> del tope de gasto del mes.</>}
        </div>
      )}

      <div className={s.stats}>
        <Stat label="Gastado este mes" value={usd(d.gastadoMesUsd)} accent={d.avisoTope ? 'accent-amber' : undefined} />
        <Stat label="Tope del mes" value={`${usd(d.topeMensualUsd, 2)} · ${Number(d.usoTope).toLocaleString('es-AR')} %`} />
        <Stat label="Facturas leídas este mes" value={d.leidasMes} />
        <Stat label="Promedio por factura" value={usd(d.promedioPorFacturaUsd)} />
        <Stat label="En cola ahora" value={d.enCola} />
      </div>

      <div className={cx(s.card, s.cardPad)} style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className={s.field} style={{ margin: 0 }}>
          <label>Tope de gasto por mes (USD)</label>
          <input type="number" min="0" max="1000" step="1" value={tope} onChange={(e) => setTope(e.target.value)} style={{ width: 120 }} />
        </div>
        <Btn
          small variant="btn-primary"
          disabled={!(topeNum >= 0 && topeNum <= 1000) || topeNum === d.topeMensualUsd}
          onClick={() => guardar({ topeMensualUsd: topeNum }, `Tope guardado: USD ${topeNum}.`)}
        >Guardar tope</Btn>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: 0 }}>
          <input
            type="checkbox" checked={!!d.leerAlSubir}
            onChange={(e) => guardar({ leerAlSubir: e.target.checked }, e.target.checked ? 'Las facturas se leen solas al subirlas.' : 'Las facturas ya no se leen solas: se mandan a leer desde la bandeja.')}
          />
          Leer cada factura sola al subirla
        </label>
        <span className={s.hint} style={{ margin: 0 }}>
          Modelos: {nombreModelo(d.modeloRapido)} y, si la cuenta no cierra, {nombreModelo(d.modeloFuerte)}.
        </span>
      </div>

      <Table
        cols={[
          { h: 'Cuándo' }, { h: 'Factura' }, { h: 'Qué' }, { h: 'Modelo' },
          { h: 'Tokens que entran', num: true }, { h: 'Tokens que salen', num: true }, { h: 'Costo', num: true }, { h: 'Resultado' },
        ]}
        empty="Todavía no se leyó ninguna factura con IA."
      >
        {(d.ultimos || []).map((u) => (
          <tr key={u.id}>
            <td>{fmtFechaHora(u.fecha)}</td>
            <td className={s.mono}>{u.lecturaId ? `#${u.lecturaId}` : '—'}</td>
            <td>{u.tarea === 'elegir' ? 'Elegir productos' : 'Leer la factura'}</td>
            <td>{nombreModelo(u.modelo)}</td>
            <td className={cx(s.num, s.mono)}>{(u.tokensEntrada + u.tokensCacheEscritura + u.tokensCacheLectura).toLocaleString('es-AR')}</td>
            <td className={cx(s.num, s.mono)}>{u.tokensSalida.toLocaleString('es-AR')}</td>
            <td className={cx(s.num, s.mono)}>{usd(u.costoUsd, 6)}</td>
            <td>{u.ok ? 'Bien' : <span title={u.error} style={{ color: 'var(--crm-color-danger)' }}>Error: {u.error}</span>}</td>
          </tr>
        ))}
      </Table>

      <div className={s.hint}>
        Precios oficiales de Anthropic: Haiku 5.5, USD 0,10 por millón de tokens que entran y 0,50 por millón
        que salen; Sonnet 5.5, USD 2 y 10. Una factura de una hoja son unos 5.000 tokens que entran y 2.000
        que salen: <strong>menos de un centavo de dólar</strong> con Haiku. La API se paga aparte de la
        suscripción de Claude, con crédito cargado en platform.claude.com.
      </div>
    </div>
  );
}
