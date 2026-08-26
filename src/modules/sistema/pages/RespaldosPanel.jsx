/**
 * RESPALDOS — la versión chica y honesta (26/8, decisión del dueño).
 * ============================================================================
 * Los backups automáticos corren en Dokploy y la restauración se hace allá:
 * esta pantalla NO los duplica ni los ve. Lo que agrega es lo que el VPS solo
 * no cubre: la COPIA EXTERNA (descargar el volcado completo a esta máquina —
 * si el servidor se cae con sus backups adentro, la copia de afuera salva) y
 * el RASTRO (cada descarga queda en auditoría y la última se muestra acá:
 * "hace tres meses que nadie baja una copia" tiene que estar a la vista).
 */
import { useCallback, useEffect, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { cx } from '@shared/utils/classNames.js';
import { PanelHead, Btn, Stat, Table, s } from '@modules/productos/components/ui.jsx';
import { fmtFechaHora, num } from '@modules/productos/domain/format.js';

export function RespaldosPanel({ onAviso }) {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [bajando, setBajando] = useState(false);

  const cargar = useCallback(() => {
    httpClient.get('/sistema/respaldos/info')
      .then((r) => { setInfo(r); setError(''); })
      .catch((e) => setError(e?.data?.message || 'No se pudo consultar el estado de la base.'));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const descargar = async () => {
    if (bajando) return;
    setBajando(true);
    try {
      const nombre = await httpClient.descargar('/sistema/respaldos/descargar', 'respaldo-crm.sql');
      onAviso?.({ tipo: 'ok', texto: `Respaldo descargado: ${nombre}. Guardalo fuera de esta máquina también (pendrive, Drive).` });
      cargar();
    } catch (e) {
      onAviso?.({ tipo: 'err', texto: e?.data?.message || 'No se pudo generar el respaldo.' });
    } finally {
      setBajando(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Respaldos"
        desc="La copia externa de la base, bajada a esta máquina. Los backups automáticos corren en el servidor (Dokploy) y la restauración se hace allá."
        actions={(
          <Btn variant="btn-primary" disabled={bajando || !!error} onClick={descargar}>
            {bajando ? 'Generando…' : 'Descargar respaldo (.sql)'}
          </Btn>
        )}
      />

      {error && <div className={cx(s.callout, s.warn)}>{error}</div>}

      {info && (
        <div className={s.stats}>
          <Stat label="Tamaño de la base" value={info.tamano} />
          <Stat label="Tablas" value={info.tablas} />
          <Stat label="Ventas" value={num(info.resumen?.ventas ?? 0, 0)} />
          <Stat label="Comprobantes de compra" value={num(info.resumen?.comprobantes ?? 0, 0)} />
          <Stat label="Productos" value={num(info.resumen?.productos ?? 0, 0)} />
        </div>
      )}

      <div className={cx(s.callout, s.info)} style={{ margin: 0 }}>
        <strong>Para qué sirve esta copia.</strong> Los backups automáticos viven en el mismo
        servidor que la base: un problema grande se los puede llevar juntos. El archivo que se
        descarga acá es <strong>la copia de afuera</strong> — llevala a un pendrive o a un Drive
        cada tanto. Se restaura sobre una base con el sistema ya migrado, cargándolo con
        <code> psql</code>; las instrucciones exactas van en el encabezado del propio archivo.
      </div>

      <div>
        <div className={s['section-title']}>Descargas registradas</div>
        <Table
          cols={[{ h: 'Fecha y hora' }, { h: 'Qué se bajó' }, { h: 'Quién' }]}
          empty="Nadie descargó una copia todavía."
        >
          {(info?.descargas ?? []).map((d, i) => (
            <tr key={i}>
              <td style={{ whiteSpace: 'nowrap' }}>{fmtFechaHora(d.fecha)}</td>
              <td>{d.detalle}</td>
              <td>{d.usuario || <span className={s.muted}>—</span>}</td>
            </tr>
          ))}
        </Table>
        {(info?.descargas?.length ?? 0) > 0 && (
          <div className={s.hint}>
            Si la última descarga tiene meses, la copia externa está vieja: bajá una nueva.
          </div>
        )}
      </div>
    </div>
  );
}
