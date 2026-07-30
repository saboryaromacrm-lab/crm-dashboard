import ConstructionIcon from '@mui/icons-material/Construction';
import ReceiptIcon from '@mui/icons-material/Receipt';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CreditCardOffIcon from '@mui/icons-material/CreditCardOff';
import { cx } from '@shared/utils/classNames.js';
import { PanelHead, s } from '../components/ui.jsx';

const SECCIONES = [
  { icon: ReceiptIcon, titulo: 'Facturas de compra', desc: 'Carga de facturas de proveedores. Al confirmar una factura, se suma el stock de los productos y se registra el costo del ingreso.' },
  { icon: LocalShippingIcon, titulo: 'Remitos', desc: 'Remitos de entrega/recepción de mercadería, con o sin factura asociada.' },
  { icon: CreditCardOffIcon, titulo: 'Notas de crédito / débito', desc: 'Ajustes contables sobre facturas: devoluciones, bonificaciones y correcciones.' },
];

/**
 * Facturación (Compras) — SCAFFOLD.
 * Acá se manejará toda la parte contable: facturas, remitos y notas de crédito.
 * El STOCK de los productos se cargará al confirmar las facturas (todavía no
 * implementado). Estructura lista para construir sobre ella.
 */
export function FacturacionPanel() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Facturación"
        desc="Contabilidad de compras: facturas, remitos y notas de crédito. El stock de los productos se cargará al confirmar las facturas."
      />

      <div className={cx(s.callout, s.info)}>
        <ConstructionIcon style={{ verticalAlign: 'middle', fontSize: 18, marginRight: 6 }} />
        Sección en construcción. Definí el circuito y arrancamos: tipo de comprobante, numeración,
        discriminación de IVA, ítems por producto y el impacto en stock.
      </div>

      <div className={s['dash-grid']}>
        {SECCIONES.map((sec) => {
          const Icon = sec.icon;
          return (
            <div key={sec.titulo} className={cx(s.card, s.cardPad)}>
              <h3 className={s['card-title']}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Icon fontSize="small" /> {sec.titulo}
                </span>
                <span className={cx(s.pill, s['est-pendiente'])}>Próximamente</span>
              </h3>
              <div className={s.desc}>{sec.desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
