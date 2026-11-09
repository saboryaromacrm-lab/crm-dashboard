import { useState } from 'react';
import { Tabs, Tab } from '@mui/material';
import { PanelHead } from '@modules/productos/components/ui.jsx';
import { ResumenFijos } from './ResumenFijos.jsx';
import { AdelantosPestana } from './AdelantosPestana.jsx';
import { GastosFijosEmbebido } from '@modules/gastos/pages/FijosEmbebido.jsx';

/**
 * GERENCIA › GASTOS FIJOS Y SUELDOS (5/11/2026, pedido del dueño: «llevame a
 * un botón solo en el side de gerencia»). Antes era la primera parte de
 * Resultados › Configuración; es la misma pantalla, mudada: arriba lo fijo de
 * cada local con su venta necesaria y abajo gastos fijos, sueldos y bienes de
 * uso. Misma llave que Resultados.
 *
 * 6/11/2026: pestaña «Adelantos» con los adelantos de sueldo del período.
 */
const PESTANAS = [['fijos', 'Gastos fijos y sueldos'], ['adelantos', 'Adelantos']];

export function GastosFijosPanel() {
  const [pestana, setPestana] = useState('fijos');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
      <PanelHead
        title="Gastos fijos y sueldos"
        desc={pestana === 'fijos'
          ? 'Lo fijo de cada local y cuánto tiene que vender para cubrirlo. Abajo se cargan los gastos fijos, los sueldos y los bienes de uso que usa el estado de resultados.'
          : 'Los adelantos de sueldo del período, de la caja central y de las cajas de los locales, con a quién se le dio.'}
      />
      <Tabs value={pestana} onChange={(e, v) => setPestana(v)} variant="scrollable" scrollButtons="auto" sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40 }}>
        {PESTANAS.map(([id, label]) => <Tab key={id} value={id} label={label} sx={{ minHeight: 40, textTransform: 'none', fontWeight: 600 }} />)}
      </Tabs>
      {pestana === 'fijos' ? (
        <>
          <ResumenFijos />
          <GastosFijosEmbebido />
        </>
      ) : <AdelantosPestana />}
    </div>
  );
}
