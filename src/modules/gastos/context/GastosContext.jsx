import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { leerSesion } from '@core/auth/sesion.js';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { errorMsg, gastosApi } from '../services/gastos.api.js';

/**
 * GASTOS CONTEXT
 * ============================================================================
 * Hub del módulo. Guarda solo los CATÁLOGOS chicos que casi todas las pantallas
 * necesitan —rubros, proveedores, sucursales, usuarios, gastos fijos— y los
 * contadores que alimentan los badges. Los listados que crecen sin techo
 * (gastos, pagos) los pide cada panel con `useResource`.
 *
 * `contadores` se refresca junto con los catálogos y después de cada mutación:
 * los badges del sub-menú tienen que reflejar lo que acaba de pasar, no el
 * estado de hace treinta segundos.
 */
const GastosContext = createContext(null);

const VACIO = {
  categorias: [], proveedores: [], sucursales: [], usuarios: [], recurrentes: [],
};

/* Sucursal y usuario operativos: salen de la sesión del login (por pestaña). */

export function GastosProvider({ children, panels = [], defaultPanel }) {
  const [data, setData] = useState(VACIO);
  const [contadores, setContadores] = useState({ vencidos: 0, pendientes: 0, saldo: 0, sinAplicar: 0 });
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const [panel, setPanel] = useState(defaultPanel || panels[0]?.id);
  const [panelParams, setPanelParams] = useState({});
  const [modal, setModal] = useState(null);
  const [toastState, setToastState] = useState({ open: false, msg: '', kind: 'ok' });

  const sesion = useMemo(leerSesion, []);
  const ctx = useMemo(() => ({
    usuarioId: sesion?.usuario?.id ?? null,
    sucursalId: sesion?.sucursal?.id ?? null,
  }), [sesion]);

  /**
   * ¿Puede atravesar sucursales? Solo administración: imputarle un gasto a otra
   * sucursal, o explicar un pago de un cajón con un comprobante de otro, son
   * cosas de conducción. El servidor decide lo mismo con `esJefe`; esto es para
   * que la pantalla no ofrezca algo que la API va a corregir por atrás.
   */
  const { esAdmin: esJefe } = usePermissions();

  /* ------------------------------ Carga ------------------------------ */

  const cargarContadores = useCallback(async () => {
    try {
      const [p, sa] = await Promise.all([gastosApi.pendientes(), gastosApi.sinAplicar()]);
      setContadores({
        vencidos: p?.vencidos ?? 0,
        pendientes: p?.pendientes ?? 0,
        saldo: p?.saldo ?? 0,
        sinAplicar: sa?.cantidad ?? 0,
      });
    } catch { /* la API puede estar caída: los badges quedan como estaban */ }
  }, []);

  const cargar = useCallback(async () => {
    try {
      const d = await gastosApi.bootstrap();
      setData({
        categorias: d.categorias ?? [],
        proveedores: d.proveedores ?? [],
        sucursales: d.sucursales ?? [],
        usuarios: d.usuarios ?? [],
        recurrentes: d.recurrentes ?? [],
      });
      setLoadError(null);
    } catch (e) {
      setLoadError(errorMsg(e));
    } finally {
      setLoaded(true);
    }
    cargarContadores();
  }, [cargarContadores]);

  useEffect(() => { cargar(); }, [cargar]);

  /* --------------------------- UI compartida --------------------------- */

  const closeModal = useCallback(() => setModal(null), []);
  const openModal = useCallback((type, props = {}) => setModal({ type, props }), []);

  const goPanel = useCallback((id, params = {}) => {
    setPanel(id);
    setPanelParams(params);
    setModal(null);
  }, []);

  const toast = useCallback((msg, kind = 'ok') => setToastState({ open: true, msg, kind }), []);
  const closeToast = useCallback(() => setToastState((t) => ({ ...t, open: false })), []);

  /**
   * Ejecuta una mutación y unifica el feedback: avisa, cierra el modal y
   * refresca lo que corresponda. Devuelve el resultado (o null si falló) para
   * que el llamador pueda encadenar.
   */
  const act = useCallback(
    async (promesa, okMsg, { recargar = false } = {}) => {
      try {
        const res = await promesa;
        if (recargar) await cargar();
        else await cargarContadores();
        toast(okMsg || 'Listo.', 'ok');
        closeModal();
        return res ?? true;
      } catch (e) {
        toast(errorMsg(e), 'err');
        return null;
      }
    },
    [cargar, cargarContadores, toast, closeModal],
  );

  /* ------------------------------ Derivados ------------------------------ */

  const getCategoria = useCallback(
    (id) => data.categorias.find((c) => c.id === id) || null,
    [data.categorias],
  );
  const getProveedor = useCallback(
    (id) => data.proveedores.find((p) => p.id === id) || null,
    [data.proveedores],
  );
  const nombreSucursal = useCallback(
    (id) => data.sucursales.find((x) => x.id === id)?.nombre || '—',
    [data.sucursales],
  );

  /** Rubros que se ofrecen al cargar: los dados de baja no se muestran. */
  const categoriasActivas = useMemo(
    () => data.categorias.filter((c) => c.activa),
    [data.categorias],
  );

  const value = useMemo(
    () => ({
      ...data, categoriasActivas, contadores,
      loaded, loadError, recargar: cargar, recargarContadores: cargarContadores,
      ctx, esJefe,
      panels, panel, panelParams, goPanel,
      modal, openModal, closeModal,
      toast, toastState, closeToast, act,
      getCategoria, getProveedor, nombreSucursal,
    }),
    [data, categoriasActivas, contadores, loaded, loadError, cargar, cargarContadores, ctx, esJefe,
      panels, panel, panelParams, goPanel, modal, openModal, closeModal,
      toast, toastState, closeToast, act, getCategoria, getProveedor, nombreSucursal],
  );

  return <GastosContext.Provider value={value}>{children}</GastosContext.Provider>;
}

export function useGastos() {
  const ctx = useContext(GastosContext);
  if (!ctx) throw new Error('useGastos debe usarse dentro de <GastosProvider>');
  return ctx;
}
