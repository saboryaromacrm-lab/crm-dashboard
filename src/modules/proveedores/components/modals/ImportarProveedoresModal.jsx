/**
 * IMPORTAR PROVEEDORES — la pantalla (26/8, migración desde el sistema viejo).
 * ============================================================================
 * Un solo CSV (el export "proveedores-ficha" de la app vieja), dos pasos:
 * archivo → vista previa obligatoria → resultado. La traducción vive en
 * `domain/importarProveedores.js`; acá vive la pantalla.
 *
 * Vive en el módulo Proveedores (27/8, pedido del dueño): la importación
 * alimenta el PADRÓN, y el padrón se administra acá desde 0068 — en Compras
 * quedó solo lo operativo (costos y percepciones).
 *
 * La vista previa es donde se decide TODO lo que la máquina no puede sola:
 * incluir o no una fila, mercadería vs. gastos, y los DUDOSOS — el archivo
 * dice "NUEVO COSMOS S.A" y en el CRM ya está "Nuevo Cosmo S.A. - Lucfel"
 * cargado a mano: emparejarlos evita el duplicado, y eso se confirma mirando.
 */
import { useMemo, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProveedores } from '../../context/ProveedoresContext.jsx';
import { errorMsg, provApi } from '../../services/proveedores.api.js';
import { ModalShell, Table, Btn, s } from '../ui.jsx';
// Los helpers de CSV son los del importador de catálogos: mismo sistema viejo,
// misma codificación rota (windows-1252), mismo parser.
import { leerTexto, parseCsv } from '@modules/productos/domain/importarCatalogo.js';
import { esArchivoProveedores, armarPlanProveedores } from '../../domain/importarProveedores.js';

const CHIP = {
  nuevo: { texto: 'NUEVO', color: 'var(--crm-color-success)' },
  completar: { texto: 'YA EXISTE — COMPLETA', color: 'var(--crm-color-info, #0369a1)' },
  dudoso: { texto: 'CONFIRMAR', color: 'var(--crm-color-warning, #b45309)' },
};

export function ImportarProveedoresModal() {
  const { proveedores: existentes, getProveedor, recargar, closeModal, toast } = useProveedores();
  const [filas, setFilas] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const inputRef = useRef(null);
  const ordenados = useMemo(
    () => [...existentes].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [existentes],
  );

  const leerArchivo = async (file) => {
    if (!file) return;
    const { cols, filas: crudas } = parseCsv(await leerTexto(file));
    if (!esArchivoProveedores(cols)) {
      toast('Ese archivo no es el export de proveedores: no tiene sus columnas (Nombre, Emite, Modo de cuenta…).', 'err');
      return;
    }
    const plan = armarPlanProveedores(crudas, existentes);
    if (!plan.length) { toast('El archivo no trae ninguna fila con nombre.', 'err'); return; }
    setFilas(plan);
  };

  const setFila = (clave, patch) => setFilas((prev) => prev.map((f) => (f.clave === clave ? { ...f, ...patch } : f)));

  const incluidas = (filas ?? []).filter((f) => f.incluir);
  const mixtos = incluidas.filter((f) => f.condicionCompra === 'mixto').length;

  const importar = async () => {
    if (!incluidas.length) { toast('No quedó ninguna fila tildada para importar.', 'err'); return; }
    setGuardando(true);
    try {
      const res = await provApi.importarProveedores(incluidas.map((f) => ({
        nombre: f.nombre,
        cuit: f.cuit,
        email: f.email,
        telefono: f.telefono,
        condicionCompra: f.condicionCompra,
        medioHabitual: f.medioHabitual || undefined,
        diasPago: f.diasPago || undefined,
        modoCuenta: f.modoCuenta,
        porcSinFactura: f.porcSinFactura,
        proveeMercaderia: !f.esGastos,
        proveeGastos: f.esGastos,
        productosEsperados: f.productosEsperados,
        cuentas: f.cuentas,
        // Solo el emparejamiento decidido acá viaja; el resto lo re-resuelve la API.
        proveedorId: f.proveedorId || undefined,
      })));
      setResultado(res);
      // El padrón de atrás se refresca YA: la pantalla de resultado convive
      // con la lista, y la lista tiene que mostrar lo que se acaba de crear.
      recargar();
    } catch (e) {
      toast(errorMsg(e), 'err');
    } finally {
      setGuardando(false);
    }
  };

  /* ------------------------------- resultado ------------------------------- */
  if (resultado) {
    return (
      <ModalShell
        title="Proveedores importados"
        wide
        onClose={closeModal}
        footer={[{ texto: 'Listo', clase: 'btn-primary', onClick: closeModal }]}
      >
        <div className={cx(s.callout, s.ok)}>
          <strong>{resultado.creados?.length ?? 0}</strong> creados y{' '}
          <strong>{resultado.completados?.length ?? 0}</strong> completados (ya existían: solo se
          les llenaron los campos vacíos).
        </div>
        {resultado.saltados?.length > 0 && (
          <>
            <div className={s['section-title']}>No entraron ({resultado.saltados.length})</div>
            <Table cols={[{ h: 'Proveedor' }, { h: 'Por qué' }]}>
              {resultado.saltados.map((x, i) => (
                <tr key={i}><td>{x.nombre}</td><td>{x.motivo}</td></tr>
              ))}
            </Table>
          </>
        )}
        <div className={s.hint}>
          Los saldos y la cuenta corriente NO se importaron: los saldos iniciales se cargan como
          paso propio el día del corte con el sistema viejo. El avance de la migración de cada
          proveedor se ve en esta misma lista.
        </div>
      </ModalShell>
    );
  }

  /* --------------------------- paso 1 · archivo --------------------------- */
  if (!filas) {
    return (
      <ModalShell
        title="Importar proveedores"
        subtitle="El export del padrón del sistema viejo (proveedores-ficha), tal como sale."
        onClose={closeModal}
        footer={[{ texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal }]}
      >
        <div className={cx(s.callout, s.info)}>
          Se importa la <strong>ficha</strong>: nombre, CUIT, contacto, cómo factura y cómo cobra,
          sus cuentas bancarias y cuántos productos tiene allá (para seguir el avance).{' '}
          <strong>Los saldos no</strong>: esos se cargan aparte el día del corte.
        </div>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); leerArchivo(e.dataTransfer?.files?.[0]); }}
          style={{
            border: '2px dashed var(--crm-color-border)', borderRadius: 'var(--crm-radius-md)',
            padding: '34px 16px', textAlign: 'center', display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 10,
          }}
        >
          <strong>Arrastrá el .csv acá</strong>
          <Btn small onClick={() => inputRef.current?.click()}>Elegir archivo</Btn>
          <input
            ref={inputRef} type="file" accept=".csv,text/csv" hidden
            onChange={(e) => { leerArchivo(e.target.files?.[0]); e.target.value = ''; }}
          />
        </div>
      </ModalShell>
    );
  }

  /* ------------------------- paso 2 · vista previa ------------------------- */
  const resumen = {
    nuevo: incluidas.filter((f) => f.estado === 'nuevo' || (f.estado === 'dudoso' && !f.proveedorId)).length,
    completar: incluidas.filter((f) => (f.estado === 'completar') || (f.estado === 'dudoso' && f.proveedorId)).length,
    afuera: (filas.length - incluidas.length),
  };

  return (
    <ModalShell
      title="Importar proveedores — vista previa"
      subtitle={`${filas.length} fila(s) en el archivo. Nada se guarda hasta Confirmar.`}
      size="xl"
      onClose={closeModal}
      footer={[
        { texto: 'Volver', clase: 'btn-ghost', onClick: () => setFilas(null), disabled: guardando },
        {
          texto: guardando ? 'Importando…' : `Importar ${incluidas.length} proveedor(es)`,
          clase: 'btn-primary',
          onClick: importar,
          disabled: guardando || !incluidas.length,
        },
      ]}
    >
      <div style={{ padding: '0 24px 16px', display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
        <div className={s.hint} style={{ margin: '12px 0 0' }}>
          <strong style={{ color: CHIP.nuevo.color }}>{resumen.nuevo} se crean</strong>
          {' · '}
          <strong style={{ color: CHIP.completar.color }}>{resumen.completar} ya existen</strong>
          {' (solo se completan campos vacíos) · '}
          <strong>{resumen.afuera} afuera</strong> (destildadas)
          {mixtos > 0 && (
            <> · <strong style={{ color: CHIP.dudoso.color }}>{mixtos} mixtos</strong>: el
            “Sin factura %” real no viene en el archivo — cargarlo a mano después</>
          )}
        </div>

        <Table cols={[
          { h: '' }, { h: 'Proveedor' }, { h: 'Estado' }, { h: 'Emite' }, { h: 'Cobra' },
          { h: 'Clasificación' }, { h: 'Prod. allá', num: true },
        ]}
        >
          {filas.map((f) => {
            const chip = CHIP[f.estado];
            return (
              <tr key={f.clave} style={{ opacity: f.incluir ? 1 : 0.45 }}>
                <td>
                  <input
                    type="checkbox" checked={f.incluir}
                    onChange={(e) => setFila(f.clave, { incluir: e.target.checked })}
                  />
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{f.nombre}</div>
                  <div className={s.hint} style={{ margin: 0 }}>
                    {f.cuit || (f.cuitDescartado ? `CUIT “${f.cuitDescartado}” inválido: se descarta` : 'sin CUIT')}
                    {f.esPrueba && ' · fila de prueba del sistema viejo'}
                  </div>
                </td>
                <td>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.04em', color: chip.color, whiteSpace: 'nowrap' }}>
                    {chip.texto}
                  </span>
                  {/* El dudoso se resuelve ACÁ: o es uno existente, o se crea. */}
                  {f.estado === 'dudoso' && (
                    <select
                      value={f.proveedorId ?? ''}
                      style={{ display: 'block', marginTop: 4, maxWidth: 240 }}
                      onChange={(e) => setFila(f.clave, { proveedorId: e.target.value ? Number(e.target.value) : null })}
                    >
                      <option value="">➕ Crear como proveedor nuevo</option>
                      {ordenados.map((p) => (
                        <option key={p.id} value={p.id}>Es el mismo que: {p.nombre}</option>
                      ))}
                    </select>
                  )}
                  {f.estado === 'completar' && (
                    <div className={s.hint} style={{ margin: '2px 0 0' }}>
                      {getProveedor(f.proveedorId)?.nombre}
                    </div>
                  )}
                </td>
                <td>
                  {f.condicionCompra === 'factura' ? 'Factura'
                    : f.condicionCompra === 'liquidacion' ? 'Remito (sin factura 100)' : 'Mixto'}
                </td>
                <td>
                  {f.medioHabitual ? f.medioHabitual.replace('cta_cte', 'cta. cte.') : '—'}
                  {f.diasPago ? ` ${f.diasPago}d` : ''}
                  {f.modoCuenta === 'libre' ? ' · libre' : ''}
                  {f.cuentas.length > 0 && ` · ${f.cuentas.length} cta(s)`}
                </td>
                <td>
                  <select
                    value={f.esGastos ? 'gastos' : 'mercaderia'}
                    onChange={(e) => setFila(f.clave, { esGastos: e.target.value === 'gastos' })}
                  >
                    <option value="mercaderia">Mercadería</option>
                    <option value="gastos">Gastos</option>
                  </select>
                </td>
                <td className={s.num}>{f.productosEsperados || '—'}</td>
              </tr>
            );
          })}
        </Table>
      </div>
    </ModalShell>
  );
}
