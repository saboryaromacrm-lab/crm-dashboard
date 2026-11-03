import { cx } from '@shared/utils/classNames.js';
import { GastosProvider, useGastos } from '../context/GastosContext.jsx';
import { ModalHost } from '../components/ModalHost.jsx';
import { AvisoGastos } from '../components/AvisoGastos.jsx';
import { s } from '../components/ui.jsx';
import { FijosPanel } from '../panels/FijosPanel.jsx';

/**
 * GASTOS FIJOS Y SUELDOS DENTRO DE LA CONFIGURACIÓN DE RESULTADOS (3/11/2026,
 * pedido del dueño: «todo configurable desde Configuración»). Es la misma
 * pantalla que estaba en Gastos, con su contexto, sus ventanas y su aviso:
 * se mudó de lugar, no se copió.
 */
export function GastosFijosEmbebido() {
  return (
    <GastosProvider panels={[]}>
      <Contenido />
    </GastosProvider>
  );
}

function Contenido() {
  const { loaded, loadError } = useGastos();
  if (loadError) return <div className={cx(s.callout, s.warn)}>No se pudieron traer los gastos fijos: {loadError}</div>;
  if (!loaded) return <div className={s.hint}>Cargando los gastos fijos…</div>;
  return (
    <>
      <FijosPanel />
      <ModalHost />
      <AvisoGastos />
    </>
  );
}
