import { useState } from 'react';
import { Tabs, Tab } from '@mui/material';
import { CatalogoAdmin } from '../components/CatalogoAdmin.jsx';
import { s } from '../components/ui.jsx';

/**
 * CATÁLOGOS — marcas, categorías › subcategorías y etiquetas.
 *
 * Es la misma pantalla que se abre desde "Administrar" en el modal de producto;
 * acá vive con su propio menú para el mantenimiento a fondo (renombrar en
 * masa, fusionar duplicados, dar de baja lo que ya no se usa).
 */
const TABS = [
  { id: 'marcas', label: 'Marcas' },
  { id: 'categorias', label: 'Categorías' },
  { id: 'subcategorias', label: 'Subcategorías' },
  { id: 'etiquetas', label: 'Etiquetas' },
];

export function CatalogosPanel() {
  const [tab, setTab] = useState(0);
  const tipo = TABS[tab].id;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <div className={s['panel-head']}>
        <div>
          <h2>Catálogos</h2>
          <div className={s.desc}>
            Los valores con los que se clasifica un producto. Son entidades, no texto suelto:
            renombrar una marca acá la cambia en todos lados y no rompe las reglas que la usan.
          </div>
        </div>
      </div>

      <div className={s.card} style={{ padding: 'var(--crm-space-4)' }}>
        <Tabs
          value={tab}
          onChange={(e, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          {TABS.map((t) => <Tab key={t.id} label={t.label} />)}
        </Tabs>
        <CatalogoAdmin tipo={tipo} />
      </div>
    </div>
  );
}
