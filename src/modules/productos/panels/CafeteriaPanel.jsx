/**
 * CAFETERÍA — el punto de salida hacia coffit (Almacén).
 * ============================================================================
 * Acá NO hay existencias: el stock del café lo maneja coffit y contarlo dos
 * veces siempre termina descuadrando. Lo que se ve es el LIBRO de envíos y
 * devoluciones (a costo congelado) y la foto de gestión del período: cuánto
 * le costó la cafetería al negocio = mercadería neta + gastos imputados a
 * ella (Gastos › negocio Cafetería). Las ventas las tiene coffit — la
 * rentabilidad del café es la resta entre los dos sistemas.
 */
import { useCallback, useEffect, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../context/ProductosContext.jsx';
import { money, fmtFecha, isoDate } from '../domain/format.js';
import { Table, PanelHead, Stat, Btn, Pill, usePaginado, s } from '../components/ui.jsx';

const inicioDeMes = () => {
  const d = new Date();
  return isoDate(new Date(d.getFullYear(), d.getMonth(), 1));
};

export function CafeteriaPanel() {
  const { store, isAdmin, openModal, toast } = useProductos();

  const [desde, setDesde] = useState(inicioDeMes());
  const [hasta, setHasta] = useState(isoDate(new Date()));
  const [tipoF, setTipoF] = useState('');
  const [envios, setEnvios] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const filtros = { desde: desde || undefined, hasta: hasta || undefined };
      const [lista, res] = await Promise.all([
        store.enviosCafeteria({ ...filtros, tipo: tipoF || undefined }),
        store.resumenCafeteria(filtros),
      ]);
      setEnvios(lista);
      setResumen(res);
    } catch {
      toast('No se pudieron cargar los envíos.', 'err');
    } finally {
      setCargando(false);
    }
  }, [store, desde, hasta, tipoF, toast]);
  useEffect(() => { cargar(); }, [cargar]);

  // Los modales mutan por el store (_mutate refresca el bootstrap); esta lista
  // vive fuera del bootstrap, así que se re-pide cuando el store versiona.
  const version = store.getVersion?.() ?? 0;
  useEffect(() => { cargar(); }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  const clave = `${desde}|${hasta}|${tipoF}`;
  const pag = usePaginado(envios, 'cafeteria', clave);

  const filas = pag.visibles.map((e) => (
    <tr
      key={e.id}
      className={s.clickable}
      onClick={() => openModal('envioCafeteriaDetalle', { id: e.id })}
    >
      <td className={s.mono}>{e.codigo}</td>
      <td>{fmtFecha(e.fecha)}</td>
      <td>
        {e.tipo === 'devolucion'
          ? <Pill pill="est-pendiente" label="Devolución" />
          : <Pill pill="est-recibida" label="Envío" />}
      </td>
      <td>
        {e.sucursalNombre || '—'}
        {e.usuarioNombre && <div className={s.hint} style={{ margin: 0 }}>{e.usuarioNombre}</div>}
      </td>
      <td className={s.num}>{e.renglones}</td>
      <td className={cx(s.num, s.mono)}>{money(e.totalCosto)}</td>
      <td>
        {e.estado === 'anulado'
          ? <Pill pill="est-cancelada" label="Anulado" />
          : <Pill pill="est-recibida" label="Confirmado" />}
      </td>
    </tr>
  ));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Cafetería"
        desc="El punto de salida hacia coffit: envíos a costo y su devolución. Acá no hay existencias — el stock del café lo maneja coffit."
        actions={isAdmin && (
          <>
            <Btn variant="btn-ghost" onClick={() => openModal('envioCafeteria', { tipo: 'devolucion' })}>
              Devolución
            </Btn>
            <Btn variant="btn-primary" onClick={() => openModal('envioCafeteria', { tipo: 'envio' })}>
              + Nuevo envío
            </Btn>
          </>
        )}
      />

      <div className={s.stats}>
        <Stat label="Enviado (a costo)" value={money(resumen?.enviado ?? 0)} />
        <Stat label="Devuelto" value={money(resumen?.devuelto ?? 0)} />
        <Stat label="Gastos imputados" value={money(resumen?.gastos ?? 0)} />
        <Stat
          label="Costo total del período"
          value={money(resumen?.costoTotal ?? 0)}
          accent="accent-amber"
        />
      </div>

      <div className={s.toolbar}>
        <label className={s.hint} style={{ margin: 0 }}>
          Desde <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label className={s.hint} style={{ margin: 0 }}>
          Hasta <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
        <select className={s['select-inline']} value={tipoF} onChange={(e) => setTipoF(e.target.value)}>
          <option value="">Envíos y devoluciones</option>
          <option value="envio">Solo envíos</option>
          <option value="devolucion">Solo devoluciones</option>
        </select>
        <Btn small onClick={cargar} disabled={cargando}>{cargando ? 'Cargando…' : 'Actualizar'}</Btn>
      </div>

      <Table
        cols={[
          { h: 'Código' }, { h: 'Fecha' }, { h: 'Tipo' }, { h: 'Origen' },
          { h: 'Renglones', num: true }, { h: 'Total a costo', num: true }, { h: 'Estado' },
        ]}
        empty={cargando ? 'Cargando…' : 'Sin envíos en el período. "+ Nuevo envío" registra la primera salida hacia el café.'}
        pag={pag}
      >
        {filas}
      </Table>

      <div className={s.hint}>
        <strong>Costo total del período</strong> = mercadería enviada − devuelta + los gastos
        imputados a Cafetería (se marcan al cargar el gasto). Las ventas las tiene coffit: la
        rentabilidad del café es la resta entre los dos sistemas.
      </div>
    </div>
  );
}
