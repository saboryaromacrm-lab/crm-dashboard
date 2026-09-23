/**
 * ACTUALIZAR CATEGORÍA Y ETIQUETAS — el plan, del lado del navegador (23/9/2026).
 * ============================================================================
 * El archivo es el que ya arma «Exportar CSV» (mismo dialecto: `;`, BOM, comillas
 * dobles — lo lee `leerCsv`, NO `parseCsv`, que es el del sistema viejo). Acá
 * solo se arma la VISTA PREVIA, contra el catálogo que ya está en memoria — no
 * se le pregunta nada al servidor todavía, eso pasa recién al confirmar.
 *
 * Tres columnas, cada una OPCIONAL: una celda vacía es "no tocar", no "vaciar".
 * Las etiquetas van varias por celda, separadas por coma.
 */

/** Nombres separados por coma, sin vacíos ni espacios de sobra. */
function partirEtiquetas(celda) {
  return String(celda ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}

const clave = (s) => String(s ?? '').trim().toLowerCase();

/**
 * `catalogo`: `store.state.productos` (para matchear por código).
 * `catalogos`: `store.state.catalogos` (categorias/subcategorias/etiquetas, para
 * saber qué nombre ya existe y cuál se va a crear).
 */
export function armarPlanClasificacion(filas, catalogo, catalogos) {
  const porCodigo = new Map((catalogo || []).map((p) => [String(p.codigoPropio ?? '').trim(), p]));
  const nombresCat = new Set((catalogos?.categorias || []).map((c) => clave(c.nombre)));
  const nombresEtq = new Set((catalogos?.etiquetas || []).map((e) => clave(e.nombre)));
  /* La subcategoría depende de la categoría: "existe" solo cuenta si cuelga
   * de LA MISMA categoría que trae el renglón — otra categoría con una
   * subcategoría de igual nombre no es la misma fila. El bootstrap trae la
   * subcategoría con su `categoriaId`, no con el nombre: se resuelve acá. */
  const nombreCatPorId = new Map((catalogos?.categorias || []).map((c) => [c.id, clave(c.nombre)]));
  const subPorCategoria = new Map();
  for (const s of catalogos?.subcategorias || []) {
    const k = nombreCatPorId.get(s.categoriaId) ?? '';
    if (!subPorCategoria.has(k)) subPorCategoria.set(k, new Set());
    subPorCategoria.get(k).add(clave(s.nombre));
  }

  const vistos = new Set();
  const filasOut = [];
  const items = [];

  for (const f of filas || []) {
    const codigo = String(f['Código interno'] ?? '').trim();
    const categoria = String(f.Categoría ?? '').trim();
    const subcategoria = String(f.Subcategoría ?? '').trim();
    const etiquetas = partirEtiquetas(f.Etiquetas);

    if (!codigo) { filasOut.push({ codigo: '', nombre: '', estado: 'sin_codigo' }); continue; }
    if (vistos.has(codigo)) { filasOut.push({ codigo, nombre: '', estado: 'repetido' }); continue; }

    const prod = porCodigo.get(codigo);
    if (!prod) { filasOut.push({ codigo, nombre: '', estado: 'no_encontrado' }); continue; }
    if (prod.estado === 'archivado') { filasOut.push({ codigo, nombre: prod.nombre, estado: 'archivado' }); continue; }
    if (!categoria && !subcategoria && !etiquetas.length) {
      filasOut.push({ codigo, nombre: prod.nombre, estado: 'vacio' });
      continue;
    }

    /*
     * SOLO SE MANDA LO QUE DE VERDAD CAMBIA (23/9/2026). El caso normal es
     * reexportar TODO el catálogo, tocar dos productos en la planilla y
     * volver a subir el archivo entero: sin esto, cada producto que ya
     * tenía la misma categoría — la enorme mayoría — se reportaba como
     * "se aplica" y disparaba un UPDATE que no cambiaba nada. Comparando
     * contra lo que el producto YA tiene, la vista previa (y el archivo que
     * se manda) hablan solo de lo que en verdad se va a mover.
     */
    const catCambia = categoria && clave(categoria) !== clave(prod.categoria);
    const subCambia = subcategoria && clave(subcategoria) !== clave(prod.subcategoria);
    const etqActuales = new Set((prod.etiquetasNombres || []).map(clave));
    const etqNuevas = new Set(etiquetas.map(clave));
    const etqCambia = etiquetas.length
      && (etqActuales.size !== etqNuevas.size || [...etqNuevas].some((e) => !etqActuales.has(e)));

    if (!catCambia && !subCambia && !etqCambia) {
      filasOut.push({ codigo, nombre: prod.nombre, estado: 'sin_cambios' });
      continue;
    }

    vistos.add(codigo);
    const catExiste = catCambia ? nombresCat.has(clave(categoria)) : true;
    const subExiste = subCambia ? (subPorCategoria.get(clave(categoria))?.has(clave(subcategoria)) ?? false) : true;
    filasOut.push({
      codigo, nombre: prod.nombre, estado: 'aplica',
      categoria: catCambia ? categoria : '', categoriaNueva: catCambia && !catExiste,
      subcategoria: subCambia ? subcategoria : '', subcategoriaNueva: subCambia && !subExiste,
      etiquetas: etqCambia ? etiquetas : [], etiquetasNuevas: etqCambia ? etiquetas.filter((e) => !nombresEtq.has(clave(e))) : [],
    });
    items.push({
      codigoPropio: codigo,
      ...(catCambia ? { categoria } : {}),
      ...(subCambia ? { subcategoria } : {}),
      ...(etqCambia ? { etiquetas } : {}),
    });
  }

  return {
    items,
    filas: filasOut,
    resumen: {
      aplica: filasOut.filter((f) => f.estado === 'aplica').length,
      noEncontrados: filasOut.filter((f) => f.estado === 'no_encontrado').length,
      archivados: filasOut.filter((f) => f.estado === 'archivado').length,
      repetidos: filasOut.filter((f) => f.estado === 'repetido').length,
      vacios: filasOut.filter((f) => f.estado === 'vacio').length,
      sinCambios: filasOut.filter((f) => f.estado === 'sin_cambios').length,
      sinCodigo: filasOut.filter((f) => f.estado === 'sin_codigo').length,
    },
  };
}
