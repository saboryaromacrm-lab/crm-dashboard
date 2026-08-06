/**
 * INFO DE SISTEMA — el contenido, como DATO
 * ============================================================================
 * Documenta cómo trabaja el sistema por dentro: los procesos, las reglas y —lo
 * más importante— POR QUÉ están así. Cuando dentro de seis meses aparezca la
 * duda de si algo es un error o una decisión, la respuesta está acá.
 *
 * Es una estructura de datos, no componentes: agregar documentación es agregar
 * un objeto a este archivo, no escribir JSX. El renderer entiende estos bloques:
 *
 *   { t: 'p',      texto }                        párrafo (admite **negrita**)
 *   { t: 'lista',  items: [] }                    viñetas
 *   { t: 'pasos',  items: [] }                    secuencia numerada
 *   { t: 'flujo',  items: [] }                    cadena horizontal A → B → C
 *   { t: 'tabla',  cols: [], filas: [[]] }        tabla
 *   { t: 'nota',   tono: 'info|ok|warn', texto }  aviso destacado
 *   { t: 'ejemplo', titulo, lineas: [] }          caso concreto con números
 *   { t: 'ruta',   texto }                        dónde se hace en la app
 *
 * REGLA AL EDITAR: no se documenta lo que el código ya dice (los nombres de las
 * columnas, la firma de una función). Se documenta lo que el código NO puede
 * decir: la decisión, la alternativa que se descartó y el motivo.
 */

export const MANUAL = [
  /* ================================================================== */
  {
    id: 'arquitectura',
    titulo: 'Arquitectura',
    resumen: 'Cómo está partido el sistema y por qué.',
    temas: [
      {
        id: 'piezas',
        titulo: 'Las tres piezas',
        bloques: [
          { t: 'flujo', items: ['PostgreSQL', 'crm-api (NestJS)', 'crm-dashboard (React)'] },
          {
            t: 'tabla',
            cols: ['Pieza', 'Qué hace', 'Dónde vive'],
            filas: [
              ['PostgreSQL', 'La verdad. Todo lo demás es una vista de esto.', 'local hoy, Hostinger después'],
              ['crm-api', 'Reglas de negocio y cálculo. Nada se calcula dos veces.', 'carpeta crm-api'],
              ['crm-dashboard', 'La pantalla. Replica algunos cálculos para responder en vivo.', 'carpeta crm-dashboard'],
            ],
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: 'Hay cálculos DUPLICADOS a propósito entre API y pantalla (precios y costos). La pantalla necesita recalcular con cada tecla y pedirle el número a la API en cada pulsación sería inusable. El precio de esa decisión: **si se toca la fórmula, se toca en los dos lados o el formulario miente**.',
          },
        ],
      },
      {
        id: 'identidad',
        titulo: 'Identidad visual',
        bloques: [
          {
            t: 'p',
            texto: 'Dos colores con papeles fijos. **Verde oscuro** es el principal: navegación, botones primarios, foco, selección y totales — siempre con letra blanca encima. **Naranja** es el detalle: el indicador del módulo activo, la barrita de las pestañas, el chip de oferta — señala "acá", nunca pinta superficies grandes.',
          },
          {
            t: 'tabla',
            cols: ['Si es…', 'Va en…'],
            filas: [
              ['Una superficie o una acción principal', 'Verde oscuro con blanco'],
              ['Un acento chico que tiene que saltar a la vista', 'Naranja'],
              ['Todo lo demás', 'Claro y neutro, con un tinte verde apenas perceptible'],
            ],
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: 'Los colores viven en **un solo lugar**: `src/styles/tokens.css` (variables `--crm-*`) con su espejo MUI en `core/theme/palette.js`. Nunca un hex crudo en un módulo — cambiar la marca entera fue tocar esos dos archivos, y así tiene que seguir. Hay tema claro (por defecto) y oscuro con la misma identidad.',
          },
        ],
      },
      {
        id: 'paginacion',
        titulo: 'Tablas y paginación',
        bloques: [
          {
            t: 'p',
            texto: 'Todos los listados de datos (productos, proveedores, clientes, movimientos, comprobantes, existencias, consultas Alt+F5/F3, etc.) se paginan **de a 20 filas por defecto**. Al pie de cada tabla está el paginador: navegación por páginas y el selector "Filas por página" (10 / 20 / 50 / 100).',
          },
          {
            t: 'lista',
            items: [
              'El tamaño elegido se **recuerda por tabla** (queda en el navegador): si en Productos elegís 50, Productos vuelve a abrir en 50 y las demás tablas siguen en lo suyo.',
              'Cambiar un filtro o la búsqueda vuelve a la página 1; si el filtro achica el listado, la página se ajusta sola.',
              'El paginador no aparece cuando el listado entra en una pantalla (10 filas o menos): no hay nada que pasar de página.',
              'La paginación es **en memoria** sobre lo ya cargado: pinta solo la página visible, que es lo que mantiene liviana la pantalla con miles de filas.',
            ],
          },
          {
            t: 'nota',
            tono: 'ok',
            texto: 'Para el que programa: `usePaginado(items, clave, firmaDeFiltros)` + prop `pag` de `Table`, en `productos/components/ui.jsx`. Una sola implementación para todo el sistema.',
          },
        ],
      },
      {
        id: 'modulos',
        titulo: 'Módulos',
        bloques: [
          {
            t: 'p',
            texto: 'Cada módulo se declara a sí mismo en un manifiesto y el menú y las rutas se generan a partir de esa lista. Agregar un módulo es agregarlo al registro; no hay que tocar el núcleo.',
          },
          {
            t: 'tabla',
            cols: ['Módulo', 'Contiene'],
            filas: [
              ['Compras', 'Productos, proveedores, comprobantes, catálogos, precios'],
              ['Almacén', 'Existencias, transferencias, incidencias, fraccionamiento'],
              ['Ventas', 'Punto de venta, clientes, cobranzas, caja, formato de venta, ofertas, cambios de precio'],
              ['Consultas', 'Las dos consultas globales de teclado (Alt+F5 y Alt+F3). No aparece en el menú: se monta en el layout'],
              ['Info de sistema', 'Esta documentación'],
              ['Gerencia', 'Reservado'],
            ],
          },
          {
            t: 'p',
            texto: 'Compras y Almacén comparten el mismo motor de inventario (un store único). Ventas tiene el suyo propio, porque nadie fuera de Ventas necesita ese estado y al salir del módulo se libera solo.',
          },
        ],
      },
    ],
  },

  /* ================================================================== */
  {
    id: 'formato-compra',
    titulo: 'Formato de Compra',
    resumen: 'Cómo ENTRA el producto y de dónde sale su costo.',
    temas: [
      {
        id: 'que-es',
        titulo: 'Qué es un formato de compra',
        bloques: [
          {
            t: 'p',
            texto: 'Una forma de comprar el producto: **proveedor + cantidad por bulto + costo**. Un producto puede tener varios, incluso del mismo proveedor (caja x12 y caja x24), y **uno solo fija el precio**.',
          },
          { t: 'ruta', texto: 'Compras › Productos › (abrir un producto) › Formato de Compra' },
          {
            t: 'nota',
            tono: 'info',
            texto: 'La cantidad por bulto es lo que hace **comparables** dos proveedores que venden en presentaciones distintas: el costo unitario los pone en la misma escala.',
          },
          {
            t: 'nota',
            tono: 'ok',
            texto: 'La relación con el primer proveedor puede nacer **en el alta del producto** (campo "Con quién llega", con su costo de lista opcional): así el producto ya aparece en el buscador de la factura de ese proveedor desde el primer día. Los siguientes proveedores se suman acá, en el Formato de Compra.',
          },
        ],
      },
      {
        id: 'carga-factura',
        titulo: 'Cargar la factura: asistente en tres pasos',
        bloques: [
          {
            t: 'p',
            texto: 'El alta del comprobante es un **asistente de tres pasos**: **1) Datos del comprobante** (tipo, proveedor, letra/punto de venta/número, fechas, sucursal de recepción), **2) Ítems** (los renglones y el impacto en precios) y **3) Pago y confirmación** (cómo se paga, vencimiento, observaciones). Se avanza con "Continuar" y se puede volver atrás sin perder nada, con los botones o clickeando un paso ya recorrido en el indicador de arriba.',
          },
          {
            t: 'p',
            texto: 'El **proveedor se elige en el paso 1 y queda fijo al avanzar**: para cuando se cargan productos, ya es un hecho de la factura. Si el alta se abre desde la ficha de un proveedor (pestaña Operaciones, botones "+ Factura", "+ Remito"…), el campo viene **bloqueado con ese proveedor** — se abrió desde ahí porque el comprobante es de él. Y si en el paso 1 se cambia el proveedor con renglones ya cargados, **los renglones se vacían**: eran productos y costos del padrón anterior, dejarlos sería colar mercadería de un proveedor en la factura de otro.',
          },
          {
            t: 'p',
            texto: 'En el paso de ítems, el buscador ofrece **solo los productos relacionados con el proveedor de la factura** — los que tienen formato de compra con él, sin importar quién esté activo. Que el activo sea otro no significa que este no entregue más: cada resultado muestra su **proveedor activo actual**, y el cambio de activo se decide abajo, en "Impacto en precios", viendo el precio de góndola que va a quedar.',
          },
          {
            t: 'lista',
            items: [
              '**El renglón es un buscador**: nombre, código interno o código de barras (el escáner funciona). El costo que precarga es el de ESTE proveedor — no el del activo — así la variación que muestra la tabla de impacto compara la factura contra su propia lista.',
              '**Se carga EN BULTOS, como habla la factura**: llegaron 2 bolsas de 25 kg → Bultos 2, y el sistema ingresa los 50 kg solo. El renglón muestra la cuenta en vivo: "50 kg · $2.000/kg".',
              '**El tamaño del bulto es un dato de LA ENTREGA**: viene precargado del Formato de Compra y se corrige en el renglón si esta vez la bolsa vino de 20 o de 22,68 kg (admite decimales). No hay que editar el producto antes de cargar.',
              '**Buscar en lote**: como el Shift+Ins de la caja pero para compras — texto, marca y categoría sobre los productos del proveedor, se tildan los que vinieron y entran todos juntos con su costo precargado. Lo ya cargado aparece deshabilitado ("ya en la factura").',
              '**El renglón nace vacío** y un ítem sin producto no viaja: se acabó el primer producto del catálogo preseleccionado por accidente.',
              '**Si el proveedor tiene pagos a cuenta** (los que la cajera hizo desde la sucursal), el paso 1 avisa cuánto hay esperando y el paso 3 ofrece **solo los de la sucursal de recepción** de esta factura. Tomar un pago es una decisión: se **tilda** el que esta factura explica (el importe se sugiere y se puede corregir) — si la factura se pagó por otro lado (transferencia, etc.), no se tilda nada y se usa "Se paga ahora". Tomar no mueve plata: el egreso ya quedó en el arqueo de la caja que pagó.',
            ],
          },
          {
            t: 'nota',
            tono: 'ok',
            texto: 'La tabla de impacto compara **por kg (o por unidad), nunca por bulto**: $50.000 la bolsa de 25 contra $42.000 la de 20 parece una baja, pero es $2.000/kg contra $2.100/kg — una suba del 5%. Y al tildar "actualizar costo", el precio del bulto y su tamaño viajan **juntos** al Formato de Compra: son un solo hecho ("la bolsa de 20 kg sale $40.000"), y por separado el $/kg que fija la góndola quedaría mintiendo.',
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: 'La compra ingresa SIEMPRE el producto base: el granel en kg, el entero en unidades. Las presentaciones (lenteja 500g, 1kg) son **producción propia** — nacen del fraccionamiento, que descuenta granel y crea presentación. Si algún día un proveedor vende un empaquetado que NO se fracciona acá, eso es un producto ENTERO nuevo, no una presentación del granel: esa es la línea que separa compra de producción.',
          },
          { t: 'ruta', texto: 'Compras › Facturación › + Nuevo comprobante' },
        ],
      },
      {
        id: 'cadena',
        titulo: 'La cadena de costos',
        bloques: [
          {
            t: 'flujo',
            items: ['Costo de lista', '− descuentos', '+ flete', 'COSTO NETO', '+ IVA', 'Costo final'],
          },
          {
            t: 'ejemplo',
            titulo: 'Caja de 12, lista $19.024,55, flete 8%, IVA 21%',
            lineas: [
              'Costo de lista            $19.024,55   ← por el bulto de 12',
              'Costo de lista unitario    $1.585,38   ← ÷ 12',
              'Descuentos (0%)                    —',
              'Costo bruto (sin flete)   $19.024,55',
              'Flete 8%                   +$1.521,96',
              'COSTO NETO                $20.546,51   ← el que fija el precio',
              'IVA 21%                    +$4.314,77',
              'Costo final               $24.861,28   ← lo que se le paga al proveedor',
              'Costo final unitario       $2.071,77',
              'COSTO NETO UNITARIO        $1.712,21   ← × markup = precio',
            ],
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: 'El **Costo Final lleva IVA adentro y es informativo**: sirve para conciliar contra la factura del proveedor. El precio de venta se calcula SIEMPRE desde el neto. Usar el final contaría el IVA dos veces y el número resultante sería plausible — nadie lo notaría.',
          },
        ],
      },
      {
        id: 'descuentos',
        titulo: 'La escala de descuentos',
        bloques: [
          {
            t: 'p',
            texto: 'Son cuatro campos porque los proveedores dan escalas ("treinta y diez y cinco"). Se aplican **en cascada**, cada uno sobre lo que quedó del anterior.',
          },
          {
            t: 'ejemplo',
            titulo: '30 y 10 NO es 40%',
            lineas: [
              '1 − (1 − 0,30) × (1 − 0,10)  =  1 − 0,70 × 0,90  =  1 − 0,63',
              'Descuento efectivo: 37%',
              '',
              'Con 30 / 10 / 5  →  40,15%   (no 45%)',
            ],
          },
          {
            t: 'nota',
            tono: 'info',
            texto: 'La pantalla muestra el **descuento efectivo calculado** al lado de los campos. Sumarlos de cabeza es un error caro y silencioso: ese número existe para evitarlo.',
          },
        ],
      },
      {
        id: 'modo-carga',
        titulo: 'Los dos modos de carga',
        bloques: [
          {
            t: 'tabla',
            cols: ['Modo', 'Se carga', 'Qué hace el sistema'],
            filas: [
              ['Costo de lista', 'El costo del bulto sin IVA', 'Aplica descuentos y flete'],
              ['Costo final con IVA', 'El total que factura el proveedor', 'Deriva el neto hacia atrás; ignora descuentos y flete'],
            ],
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: 'Es un **interruptor visible**, y eso es deliberado. El sistema anterior cambiaba de modo cuando el costo de lista quedaba en 0: alguien lo borraba para corregir un tipeo y cambiaba el cálculo de todo el producto sin enterarse.',
          },
        ],
      },
      {
        id: 'formato-activo',
        titulo: 'Cuál formato fija el precio',
        bloques: [
          {
            t: 'p',
            texto: 'Exactamente uno por producto, marcado con **"Fija el precio"**. Su costo neto unitario es lo que multiplica el markup del Formato de Venta.',
          },
          {
            t: 'lista',
            items: [
              'Al guardar, el sistema garantiza que quede uno solo activo.',
              'Si se quita el que estaba activo, el primero que queda toma la posta.',
              'La recepción de mercadería lo marca sola **solo si el producto todavía no tenía ninguno**. Si ya tenía, cambiarlo es una decisión y se toma a mano, con auditoría.',
            ],
          },
          {
            t: 'nota',
            tono: 'info',
            texto: 'Antes esto era un campo "proveedor activo" en el producto. Se eliminó: eran dos fuentes de verdad para el mismo dato, y con varios formatos por proveedor el id del proveedor ya no alcanzaba para saber cuál manda.',
          },
        ],
      },
    ],
  },

  /* ================================================================== */
  {
    id: 'formato-venta',
    titulo: 'Formato de Venta',
    resumen: 'Cómo SALE el producto: listas, markup y las cuatro puertas.',
    temas: [
      {
        id: 'modelo',
        titulo: 'El precio es del producto, no de la lista',
        bloques: [
          {
            t: 'p',
            texto: 'Este es el concepto que sostiene todo el módulo: **la lista no tiene precio ni markup**. Solo aporta identidad y orden de preferencia. El markup vive en la fila producto × lista.',
          },
          {
            t: 'ejemplo',
            titulo: 'La misma lista, dos markups',
            lineas: [
              'Harina Integral  ·  Mayorista 1  ·  markup 30%',
              'Lentejas         ·  Mayorista 1  ·  markup 50%',
              '',
              'Galletitas       ·  (sin fila mayorista)  → no se vende al por mayor',
            ],
          },
          {
            t: 'nota',
            tono: 'info',
            texto: 'La fila **es** la habilitación: si existe, el producto se vende así. Si no existe, no se vende así — no hay nada que destildar ni que excluir.',
          },
          { t: 'ruta', texto: 'Compras › Productos › (abrir un producto) › Formato de Venta' },
        ],
      },
      {
        id: 'formato-fila',
        titulo: 'La fila del formato: unidades, código y modo de precio',
        bloques: [
          {
            t: 'p',
            texto: 'Cada fila del formato de venta dice **en qué se vende** (1 = suelto; 12 = caja de 12, con su propio código de barras) y **cómo se define el precio**: por *markup %* sobre el costo neto — el precio acompaña al costo — o por *precio definido*, un número final fijado a mano que no se mueve aunque el costo cambie.',
          },
          {
            t: 'ejemplo',
            titulo: 'Gaseosa: minorista suelta, mayorista por caja de 6',
            lineas: [
              'Mostrador   x1   markup 70%     unitario $2.353   formato $2.353',
              'Mayorista   x6   markup 22%     unitario $1.689   formato $10.134',
              '',
              'El "precio detallado por unidad" del mayorista está siempre a la',
              'vista: la caja de $10.134 son 6 unidades de $1.689.',
            ],
          },
          {
            t: 'lista',
            items: [
              '**El precio definido no se redondea**: fijar $10.000 y que el sistema muestre $10.001 sería pisarle la decisión al que lo fijó. La ficha muestra el *markup equivalente* para no perder de vista el margen.',
              '**Escanear el código de la caja** en el POS carga las N unidades de una y **fija la lista del formato** (origen Manual): el cliente compró la caja, no seis sueltas — y el motor no la recotiza a mostrador.',
              'Los códigos de formato compiten con TODOS los demás códigos (producto, DUN, presentaciones): si dos cosas responden al mismo código, el lector queda sin desempate.',
              'Con precio definido, un cambio de costo NO mueve el precio — pero sí queda en la evolución si se edita el precio a mano (origen "formato de venta").',
            ],
          },
        ],
      },
      {
        id: 'modalidad',
        titulo: 'Modalidad › Lista',
        bloques: [
          {
            t: 'flujo',
            items: ['Modalidad (carpeta)', 'Lista (identidad + orden)', 'Producto × Lista (markup)'],
          },
          {
            t: 'p',
            texto: 'La **modalidad** (Minorista, Mayorista) solo agrupa visualmente; no lleva condiciones. La **lista** ("Mayorista 1 · Distribuidor") tiene número, nombre y orden de preferencia.',
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: 'El **número de lista no se edita nunca**. Es parte de la identidad que referencian los clientes y las ventas viejas; renumerar reescribiría el historial en silencio. Para dar de baja, se desactiva.',
          },
          { t: 'ruta', texto: 'Ventas › Formato de venta' },
        ],
      },
      {
        id: 'puertas',
        titulo: 'Las cuatro puertas',
        bloques: [
          {
            t: 'p',
            texto: 'Son un **OR**: con que se abra una alcanza. Entre todas las que se habilitan gana la de menor orden. Si no se abre ninguna, queda el piso (la lista base): el precio de mostrador.',
          },
          {
            t: 'tabla',
            cols: ['Puerta', 'Se mide sobre', 'Alcanza a', 'Se aplica'],
            filas: [
              ['Cliente — la tiene asignada', 'contrato', 'ese renglón', 'Sola'],
              ['Producto — mínimo de unidades', 'cantidades', 'ese renglón', 'Sola'],
              ['Marca — mínimo de unidades de la marca', 'cantidades', 'los renglones de esa marca', 'Sola'],
              ['Monto — total del ticket', 'pesos', 'todo el ticket', 'Avisa; se aplica con un clic'],
            ],
          },
        ],
      },
      {
        id: 'regla-oro',
        titulo: 'La regla de oro',
        bloques: [
          {
            t: 'p',
            texto: 'Las condiciones que se miden sobre **cantidades** son estables: doce unidades siguen siendo doce aunque cambie el precio. Aplicar la lista no altera la condición, así que se pueden aplicar solas.',
          },
          {
            t: 'p',
            texto: 'La condición por **monto** se mide sobre pesos, y ahí aparece el problema:',
          },
          {
            t: 'flujo',
            items: ['Ticket $41.000', 'aplica mayorista', 'baja a $38.000', 'ya no califica', 'vuelve atrás', 'sube a $41.000…'],
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: 'Por eso el monto **nunca entra en el automático**: la caja avisa y el cajero lo aplica con un clic. No es una limitación, es lo único que evita un ciclo infinito.',
          },
        ],
      },
      {
        id: 'regla-marca',
        titulo: 'Reglas de marca',
        bloques: [
          {
            t: 'p',
            texto: 'Se acumulan las unidades de toda la marca en el ticket, sumando sus productos. Al llegar al mínimo, pasan a la modalidad **solo los renglones de esa marca**.',
          },
          {
            t: 'ejemplo',
            titulo: 'Regla: Coca-Cola, 12 unidades → Mayorista',
            lineas: [
              'Ticket: 12 Coca-Cola + 3 Galletitas + 2 Yerbas',
              '',
              'Gaseosa Cola    Mayorista 1   $1.800   ← ColaCo: 12 u. ≥ 12',
              'Galletitas      Mostrador     $1.400   ← no es de la marca',
              'Yerba           Mostrador     $5.200   ← no es de la marca',
              '',
              'Con 11 Coca-Cola: todo queda a precio de mostrador.',
            ],
          },
          {
            t: 'lista',
            items: [
              'Pueden convivir varias reglas (Coca-Cola desde 12, Quilmes desde 6).',
              'Una misma marca puede tener dos reglas que abran modalidades distintas.',
              'Si un producto de la marca no tiene ninguna lista de esa modalidad, sigue con su precio: no se le asigna nada.',
              'La regla apunta a la marca por id, no por texto: renombrarla no la desarma.',
            ],
          },
          { t: 'ruta', texto: 'Ventas › Formato de venta › Reglas de marca' },
        ],
      },
      {
        id: 'monto',
        titulo: 'Condición por monto',
        bloques: [
          {
            t: 'p',
            texto: 'Se configura un monto mínimo, qué modalidad desbloquea y —opcionalmente— con qué medios de pago vale ("solo efectivo").',
          },
          {
            t: 'lista',
            items: [
              'Alcanza a todo el ticket, porque habla de la compra entera.',
              'Solo cambia los productos que tengan una lista cargada en esa modalidad.',
              'Los renglones que entran por esta vía quedan marcados, y al confirmar se valida el medio de pago.',
            ],
          },
          { t: 'ruta', texto: 'Ventas › Configuración › Precios' },
        ],
      },
    ],
  },

  /* ================================================================== */
  {
    id: 'ofertas',
    titulo: 'Ofertas',
    resumen: 'Promociones: mecánicas, alcance y cómo se aplican en la caja.',
    temas: [
      {
        id: 'mecanicas',
        titulo: 'Las siete mecánicas',
        bloques: [
          {
            t: 'tabla',
            cols: ['Mecánica', 'Ejemplo', 'Se aplica'],
            filas: [
              ['Descuento %', '20% en Galletitas', 'Sola'],
              ['Precio de oferta', 'La yerba a $3.500', 'Sola'],
              ['Llevá N pagá M', '3×2 en yerbas', 'Sola'],
              ['2ª unidad con descuento', '2ª unidad al 50%', 'Sola'],
              ['Pack', '3 por $10.000', 'Sola'],
              ['Combo', 'Galletitas + yerba por $5.000', 'Sola'],
              ['% al ticket', '10% desde $30.000 en efectivo', '**Se sugiere** — el cajero la aplica con un clic'],
            ],
          },
          {
            t: 'p',
            texto: 'Los precios configurados ($ del pack, del combo y el precio de oferta) son **finales, con IVA** — el número del cartel. El motor deriva el neto por producto, porque cada uno tiene su alícuota.',
          },
          { t: 'ruta', texto: 'Ventas › Ofertas' },
        ],
      },
      {
        id: 'alcance',
        titulo: 'Alcance y condiciones',
        bloques: [
          {
            t: 'lista',
            items: [
              '**Alcance**: producto, marca, categoría o etiqueta — y se pueden mezclar; la unión habilita.',
              '**Vigencia**: desde/hasta, días de la semana, sucursales.',
              '**Medio de pago**: solo la de ticket puede exigirlo ("10% pagando en efectivo"); se valida al confirmar la venta, que es cuando el medio existe.',
              '**Solo precio de mostrador** (por defecto): un renglón que ya está en lista mayorista no recibe además la promo — evita el doble beneficio.',
            ],
          },
          {
            t: 'nota',
            tono: 'info',
            texto: 'Una oferta vencida figura **Vencida** sola: el estado se calcula con el reloj, nadie tiene que acordarse de apagarla. Y si ya se usó en ventas, borrar la **desactiva** — el ticket viejo la referencia.',
          },
        ],
      },
      {
        id: 'resolucion',
        titulo: 'Cómo resuelve la caja',
        bloques: [
          {
            t: 'flujo',
            items: ['Precio de lista resuelto', 'Combos (consumen unidades)', 'Mejor oferta por renglón', 'Sugerencia de ticket'],
          },
          {
            t: 'lista',
            items: [
              '**Una oferta por renglón**: la de mayor beneficio. Apilar promos vuelve el ticket inexplicable.',
              'Los **combos van primero** y consumen unidades: lo que entró en un combo no cuenta para el 3×2.',
              'La de **ticket no se apila**: reparte su % solo entre los renglones que quedaron sin promo.',
              'Misma regla de oro de las listas: cantidades → sola; pesos → se sugiere.',
            ],
          },
          {
            t: 'ejemplo',
            titulo: 'Verificado en caja: 30 galletitas + 1 kg de harina, 10% desde $30.000',
            lineas: [
              'Galletitas ×30    2ª unidad al 50%     −$10.208,70   (15 pares)',
              'Harina 1 kg       10% al ticket        −$113,03      (no tenía promo)',
              '',
              'Las galletitas NO reciben además el 10%: ya tienen su oferta.',
              'Ahorro total: $10.321,73 — auditado renglón por renglón en la venta.',
            ],
          },
          {
            t: 'p',
            texto: 'Cada renglón guarda **qué oferta** se le aplicó y **cuánto descontó** (nombre congelado, como la lista): meses después se puede responder cuánto costó cada promoción.',
          },
        ],
      },
    ],
  },

  /* ================================================================== */
  {
    id: 'precios',
    titulo: 'Precios y redondeo',
    resumen: 'De la factura del proveedor a la etiqueta de góndola.',
    temas: [
      {
        id: 'derivacion',
        titulo: 'La derivación completa',
        bloques: [
          {
            t: 'flujo',
            items: ['Costo neto unitario', '× (1 + markup)', 'PRECIO NETO', '× (1 + IVA)', 'redondeo', 'Etiqueta'],
          },
          {
            t: 'p',
            texto: 'Las **presentaciones** (fraccionados) parten del precio por kg **de la lista que corresponda** y recién ahí suman su recargo de fraccionamiento. Así un mayorista paga la bolsa de 1 kg a precio mayorista.',
          },
        ],
      },
      {
        id: 'redondeo',
        titulo: 'Redondeo de góndola',
        bloques: [
          {
            t: 'p',
            texto: 'Se redondea el precio **final con IVA**, que es el que ve el cliente, y el neto se deriva hacia atrás.',
          },
          {
            t: 'nota',
            tono: 'info',
            texto: 'Redondear el neto no sirve: $1.455 neto termina igual en $1.760,55 en la etiqueta. La operación es idempotente, así que la etiqueta y el ticket nunca discrepan.',
          },
          {
            t: 'p',
            texto: 'Se configura global (por defecto: al entero más cercano) y cada producto puede tener el suyo propio con **"Heredar de configuración"** como valor por defecto.',
          },
          { t: 'ruta', texto: 'Ventas › Configuración › Precios' },
        ],
      },
      {
        id: 'evolucion',
        titulo: 'Evolución de precios',
        bloques: [
          {
            t: 'p',
            texto: 'El precio se deriva, así que "cambió el precio" no es un evento: es la consecuencia de otra operación. Después de cada una que puede moverlo, un **snapshot** compara el precio de góndola actual contra el último registrado y anota solo lo que cambió — con el anterior, el nuevo, el **% de variación** y qué palanca se movió.',
          },
          {
            t: 'lista',
            items: [
              'Dispara con: cambio de costo, formato de compra, formato de venta (markup), cambio de formato activo y reversión de lote.',
              'Guarda el precio **final con IVA y redondeo**: el número de la etiqueta. Por eso un +10% de costo puede figurar +9,96% o +10,01% — es el redondeo de góndola real.',
              'Se consulta en el producto (pestaña **Evolución de precios**) y global con **Alt+F5**.',
            ],
          },
          { t: 'ruta', texto: 'Compras › Productos › (producto) › Evolución de precios — o Alt+F5 en Ventas' },
        ],
      },
      {
        id: 'aviso-precios',
        titulo: 'Aviso de cambio de precios a los cajeros',
        bloques: [
          {
            t: 'p',
            texto: 'El punto de venta pide el catálogo **una sola vez** y lo guarda en memoria (así cambiar de cliente o cruzar un umbral se resuelve sin volver a la red). El costo de eso es que si se actualizan precios mientras un cajero tiene el POS abierto, ese cajero **sigue cobrando el precio viejo** hasta que se acuerda de apretar "Actualizar precios". Nadie se acuerda: por eso el sistema avisa solo.',
          },
          {
            t: 'p',
            texto: 'Cada CRM abierto consulta la **firma del último cambio** (`GET /precios/ultimo-cambio`) cada 30 segundos. Cuando aparece una nueva, suena y aparece un cartel arriba al centro que dice **quién** lo cambió, con el botón **Actualizar precios** que trae los nuevos al instante.',
          },
          {
            t: 'nota',
            tono: 'info',
            texto: 'Ojo con la asimetría respecto del aviso de pedidos web: ese va PARA la administración; este va para el CAJERO, que es el que tiene precios viejos en pantalla. Lo que se filtra acá no es quién lo recibe sino **quién lo provocó** — solo avisa cuando el precio lo movió la administración, que es la única que toca precios. Un cambio sin autor registrado también avisa: un cajero no tiene con qué mover un precio, así que salió igual de una operación de administración (típicamente la recepción de una factura).',
          },
          {
            t: 'tabla',
            cols: ['Decisión', 'Por qué'],
            filas: [
              ['La firma es el **id** del historial, no la fecha', 'Es monotónico, no discute con zonas horarias y dos tandas en el mismo segundo no se confunden'],
              ['**No le avisa a quien hizo el cambio**', 'Ya lo sabe. Un cartel avisándote de lo que acabás de hacer entrena a ignorar los carteles'],
              ['Solo lo ve quien tiene **Punto de venta**', 'Al que no cobra no le cambia nada'],
              ['**No se auto-esconde** (el de pedidos web sí, a los 10 s)', 'Un precio viejo cuesta plata en cada venta: el cartel se queda hasta que el cajero actualice o lo cierre'],
              ['Actualizar desde el POS **también apaga el aviso**', 'Quien ya trajo los precios nuevos no tiene que ver el cartel. El "ya lo vi" vive en el servicio, así las dos puntas hablan del mismo dato'],
            ],
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: 'Los renglones YA cargados en un ticket abierto no se re-precian: cada uno guarda el precio con el que entró, y cambiarlo por atrás sería cobrarle al cliente un número distinto del que se le dijo. Los precios nuevos rigen para lo que se agregue de ahí en adelante.',
          },
          { t: 'ruta', texto: 'Aparece en cualquier pantalla · el botón equivalente está en Ventas › Punto de venta' },
        ],
      },
      {
        id: 'actualizacion',
        titulo: 'Actualización masiva y deshacer',
        bloques: [
          {
            t: 'lista',
            items: [
              'Los costos se actualizan desde la pestaña de productos del proveedor, que es donde aparece el aumento.',
              'La regla masiva alcanza **solo a los productos tildados** — no siempre sube todo el proveedor. Por defecto están todos tildados; se destildan los que no cambian (el checkbox de la cabecera tilda/destilda todos). Lo mismo en "Actualizar márgenes" de Compras › Productos.',
              'Editar un campo a mano vale siempre, esté tildado o no: el checkbox solo define el alcance de la regla masiva.',
              '«Actualizar márgenes» (Compras › Productos) opera sobre el **markup del formato de venta** por fila producto×lista, o sobre el recargo de fraccionamiento. Las filas en **precio definido** se saltean: ese precio lo fijó una persona y un % no lo pisa. Los cambios de markup quedan en la evolución de precios (origen «Formato de venta»).',
              'Cada cambio queda registrado con el valor anterior Y el nuevo, en lotes.',
              'Un lote se puede revertir. Las filas que alguien tocó DESPUÉS se saltean: revertirlas pisaría una decisión más nueva.',
            ],
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: 'El historial cuelga de los formatos de compra. Por eso guardar la pestaña **actualiza por id** en vez de borrar e insertar: hacerlo al revés vaciaba la auditoría del producto en silencio.',
          },
        ],
      },
    ],
  },

  /* ================================================================== */
  {
    id: 'pos',
    titulo: 'Punto de venta',
    resumen: 'La caja: pestañas, atajos y cierre.',
    temas: [
      {
        id: 'presupuestos',
        titulo: 'Presupuestos (pedidos mayoristas)',
        bloques: [
          {
            t: 'p',
            texto: 'La **bandeja de entrada de los pedidos mayoristas**: llegan por WhatsApp (se cotizan a mano en el POS) o **solos desde el sitio web** (el cliente arma su carrito y confirma). El presupuesto NO es fiscal ni toca la caja — es la palabra dada al cliente, con precios congelados.',
          },
          {
            t: 'flujo',
            items: ['Cotizar en el POS', 'Enviar (validez)', 'Confirmar (reserva stock)', 'Armar con la hoja', 'Cerrar en POS (venta real)'],
          },
          {
            t: 'tabla',
            cols: ['Paso', 'Qué pasa'],
            filas: [
              ['Cotizar', 'En el POS (WhatsApp), con el botón **Presupuesto** del ticket: cotiza el MISMO motor de listas y ofertas de la caja. Desde el **sitio web**, el pedido nace directo en "Enviado" — no hay nadie cotizando en el medio'],
              ['Enviar', 'Congela la palabra y arranca la **validez** (configurable, 7 días). El botón **WhatsApp abre el chat del cliente con el presupuesto ya escrito** (mensaje con la marca, items ordenados, total y validez — solo queda tocar enviar); el teléfono sale del pedido web o de la ficha del cliente, y sin número completo cae a copiar el texto. Un enviado con la fecha pasada se muestra **Vencido** solo'],
              ['Confirmar', 'El cliente dijo sí → se **reserva el stock** (disponible → comprometido): mientras el vendedor arma, la caja no puede vender esa mercadería. Un vencido no se confirma: se reabre y se re-cotiza'],
              ['Armar', 'La **hoja de armado** sale sin precios, con columna en blanco para el lápiz. Al volver se carga pedida / armada / motivo — la venta sale por **lo armado**'],
              ['Cerrar', '"Cerrar en POS" crea la venta en curso con lo armado y los precios congelados; el cajero **agrega o saca** lo que el cliente pida y cobra normal. Al cobrar, el presupuesto se cierra solo y la reserva se libera'],
            ],
          },
          {
            t: 'lista',
            items: [
              '**Pagos**: si paga al retirar, la venta se cierra ese día al contado. Si transfirió antes, se cierra al momento del pago y el ticket queda junto al pedido esperando el retiro.',
              '**Entregas con chofer / contra entrega** (clientes de cuenta corriente): la venta se cierra en **cta. cte.** al despachar, y la plata que trae el chofer se registra como **cobranza** — cada cosa en su fecha y su circuito.',
              '**Cancelar** un confirmado libera la reserva. Los cerrados guardan la referencia a su venta.',
              '**Permisos**: cotizar/enviar/confirmar es del permiso *presupuestos* (admin); cerrar en el POS lo hace quien vende.',
            ],
          },
          { t: 'ruta', texto: 'Ventas › Presupuestos (se cotiza desde Ventas › Punto de venta)' },
        ],
      },
      {
        id: 'ordenes-web',
        titulo: 'Órdenes web (recepción de pedidos del sitio)',
        bloques: [
          {
            t: 'p',
            texto: 'Todo pedido del sitio nace como presupuesto en estado **Pendiente**, en la bandeja de **Ventas › Órdenes web**. No es un documento nuevo: es el MISMO presupuesto de siempre, pero `Enviado` significa "la casa dio su palabra" — y un pedido que nadie miró todavía no puede serla.',
          },
          {
            t: 'tabla',
            cols: ['Pieza', 'Cómo funciona'],
            filas: [
              ['**La bandeja**', 'Lista los pendientes con cliente (o chip **NUEVO**), WhatsApp, entrega y total. "Ver" muestra los renglones con el **stock disponible de cada uno** — el faltante se ve ANTES de aceptar, no al confirmar'],
              ['**Responder por WhatsApp**', 'Clic en el teléfono del pedido y se abre el chat con el saludo ya escrito (nombre, código y total). Entiende cómo escribe la gente: con o sin `+54`, con el `0` de larga distancia o el viejo `15`. Si el número quedó incompleto, se muestra sin link — uno roto abre un chat que no existe'],
              ['**Aceptar**', 'Pasa la orden a **Enviado** (arranca la validez) y sigue el ciclo normal de Presupuestos. Si el DNI ya era cliente, queda adjudicada sola; si es desconocido, **pregunta si darlo de alta** (o se asigna a mano a uno existente) — el cliente recién se crea acá, nunca antes'],
              ['**Rechazar**', 'Cancela con **motivo obligatorio** (queda en observaciones). El cliente nuevo NO se da de alta: una prueba o un spam no ensucian la base'],
              ['**El aviso**', 'Contador en el sidebar (módulo Ventas) y en el submenu, más una **alerta arriba con campanita** cuando entra un pedido con el CRM abierto. Varios juntos = un solo aviso con el contador. La alerta la ve solo la **administración** (además de tener la sección `ventas.ordenes`): los pedidos del sitio los revisa y acepta el admin, y al cajero un cartel cada vez que entra uno solo lo interrumpe en el mostrador — igual le queda el contador si tiene la sección'],
              ['**Origen marcado**', 'Columna `origen` propia (`web` | `manual`) — no una nota de texto que el cliente podía pisar. En Presupuestos los de la web llevan 🌐, y en Clientes la columna **Web** cuenta los pedidos del sitio de cada cliente (clic = historial)'],
            ],
          },
          {
            t: 'nota',
            tono: 'info',
            texto: 'La bandeja y los contadores se refrescan solos cada 30 segundos. El aviso FUERA del CRM (WhatsApp/email cuando nadie tiene el sistema abierto) sigue pendiente: necesita un servicio externo.',
          },
          { t: 'ruta', texto: 'Ventas › Órdenes web (permiso ventas.ordenes) — el pedido se genera en el sitio (localhost:3002)' },
        ],
      },
      {
        id: 'sitio-web',
        titulo: 'Sitio web (sitio-web/, Next.js)',
        bloques: [
          {
            t: 'p',
            texto: 'Proyecto aparte (`sitio-web/`, puerto **3002**), contra la MISMA API y la misma base — no hay WordPress ni una base propia. Replica estructura y diseño del tema mayorista original (verde `#086633`, tipografía Inter). Sin cuentas de cliente ni pasarela de pago: se cotiza, se arma el carrito y se envía el pedido.',
          },
          {
            t: 'tabla',
            cols: ['Pieza', 'Qué hace'],
            filas: [
              ['**GET /tienda/catalogo**', 'Shape público y liviano: nombre, marca, categoría, etiquetas de dieta, un solo precio (la lista "Mayorista"), y si tiene mínimo propio. Nada de costos ni stock por sucursal — solo la Distribuidora surte al sitio'],
              ['**Mínimo de compra**', 'Igual que el sitio real: NO cambia el precio, **habilita el envío del pedido**. Se cumple con CUALQUIERA de los dos caminos: monto total del carrito, o cantidad mínima por marca/producto (mismas `reglasMarca` y `montoMinimoMayorista` que ya usa el POS)'],
              ['**Mínimo por camioneta**', 'La entrega con la camioneta de la empresa tiene su PROPIO piso ($80.000, editable en **Ventas › Configuración**) y es DURO — sin el camino alternativo por cantidades: mover el vehículo cuesta lo mismo lleve lo que lleve. El checkout muestra la opción deshabilitada con cuánto falta, y el servidor lo revalida'],
              ['**POST /tienda/pedidos**', 'Recotiza TODO server-side (nunca confía en el precio que mandó el navegador), valida el mínimo y busca el cliente **por DNI**. El pedido nace como presupuesto **Pendiente** en la bandeja de **Ventas › Órdenes web** — si el DNI es desconocido, el cliente NO se da de alta todavía (sus datos esperan en la orden)'],
              ['**Qué productos aparecen**', 'Los que tienen **precio en la lista Mayorista** — sin flag manual ni fallback a otra lista. Publicar = cargarle el precio mayorista (Ventas › Formato de venta); sacarlo del sitio = quitárselo. El flag `publicado` viejo quedó sin uso'],
              ['**Carrito**', 'Vive en el navegador (localStorage), sin cuentas. Cada línea guarda una foto del producto al agregarlo; el precio real se reconfirma en el servidor recién al enviar'],
              ['**Imágenes**', 'Se cargan en el **módulo Web** (foto de producto, imagen de categoría, logo de marca, banner). El catálogo viaja con la URL versionada (`tienda/imagenes/tipo/id?v=…`), nunca con los bytes; sin imagen, el sitio muestra la genérica'],
              ['**Ofertas en el sitio**', 'El carrusel de "Ofertas" muestra las promos del motor de Ofertas real que el admin marcó **`soloPrecioBase = false`** (vale también para la lista Mayorista, no solo para el mostrador). El precio con descuento es el que se cobra: recotizado igual que todo lo demás, nunca confiando en el navegador'],
              ['**Volvieron a stock**', 'Un producto aparece en este carrusel si tuvo un ingreso de stock (compra) en los últimos 14 días y hoy tiene stock disponible. Definición simple: no distingue si antes llegó a 0 o no'],
              ['**Mega-menú de marcas**', 'Botón "Marcas" en el header: todas las marcas agrupadas A-Z con un buscador — clic lleva a `/tienda?marca=id`. En mobile, el listado completo va dentro del menú de hamburguesa'],
              ['**Búsqueda en vivo**', 'El buscador del header sugiere hasta 6 productos mientras se escribe (nombre o marca), usando el catálogo ya cargado en el navegador — sin pedir nada nuevo a la API por cada letra'],
              ['**Popup de bienvenida**', 'Aparece una vez por sesión (a los ~900ms), con acceso directo a la tienda o a WhatsApp. Se cierra con la X, clic afuera o Escape'],
              ['**PWA instalable**', '`app/manifest.ts` + service worker mínimo (`public/sw.js`, solo cachea el shell — nunca precios ni stock) + iconos placeholder en `public/icons/`. El navegador ofrece "Instalar" / "Agregar a pantalla de inicio"'],
            ],
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: 'CORS: la API solo acepta pedidos de los orígenes en `CORS_ORIGINS` (`.env` de crm-api) — el sitio (`localhost:3002`) tiene que estar en esa lista, si no el carrito no puede leer el catálogo desde el navegador (los fetch server-side de Next si funcionan igual, porque no pasan por CORS).',
          },
          {
            t: 'nota',
            tono: 'info',
            texto: 'RATE LIMIT: los 4 endpoints públicos de la tienda tienen cupo por IP (ventana deslizante en memoria): pedidos **5 cada 10 min** (estricto: protege la bandeja de órdenes), eventos 40/10 min, catálogo 60/min, imágenes 200/min. Al superarlo la API responde 429 con cuánto esperar. La lectura es holgada a propósito: por el CGNAT de los celulares, muchos clientes reales comparten IP. Las IPs privadas y localhost están EXENTAS — el SSR de Next y el CRM son infraestructura propia, no visitantes.',
          },
          {
            t: 'nota',
            tono: 'info',
            texto: 'Los iconos de la PWA son un placeholder (círculo blanco sobre verde) hasta que se cargue el logo real en Sistema › Empresa — reemplazar `sitio-web/public/icons/icon-192.png` e `icon-512.png` cuando esté.',
          },
          { t: 'ruta', texto: 'sitio-web/ (proyecto separado) — npm run dev, puerto 3002' },
        ],
      },
      {
        id: 'web-seo-stats',
        titulo: 'SEO y estadísticas del sitio',
        bloques: [
          {
            t: 'p',
            texto: 'Las estadísticas son **medición propia y anónima**: el sitio manda eventos a la MISMA base del CRM (nada de Google Analytics ni cookies de terceros) y se leen en **Web › Estadísticas**. La "sesión" es un código al azar que muere al cerrar la pestaña — sin nombre, sin IP.',
          },
          {
            t: 'tabla',
            cols: ['Qué', 'Cómo funciona'],
            filas: [
              ['**Visitas y sesiones**', 'Cada cambio de página cuenta una vista; el gráfico muestra los días del período (con los vacíos en cero). Sesiones = visitantes distintos'],
              ['**Tiempo mirando cada producto**', 'Segundos con la tarjeta REALMENTE en pantalla (≥50% visible y pestaña activa) — una pestaña en segundo plano no suma. Es la medida de interés, compre o no'],
              ['**Al carrito / pedidos**', 'Los clics en Agregar, y las unidades que terminaron en órdenes web no rechazadas: el embudo completo — mirar → cargar → pedir'],
              ['**Envío de eventos**', 'En lote cada 15 segundos y al salir de la página (`sendBeacon`). Si la API no responde, se descartan: la telemetría jamás rompe una compra'],
              ['**SEO**', 'Título por página, OpenGraph, JSON-LD (Organization + WebSite + la grilla de productos con precio y stock), `sitemap.xml` y `robots.txt` (carrito y checkout excluidos). El dominio real se setea con `NEXT_PUBLIC_SITE_URL` al deployar'],
            ],
          },
          {
            t: 'nota',
            tono: 'info',
            texto: 'La conversión (pedidos ÷ sesiones) puede superar el 100% al principio: hay pedidos anteriores al inicio de la medición. Se acomoda sola con tráfico real. El teléfono del checkout ahora exige un número argentino completo (10 dígitos) — la misma regla del link de WhatsApp de Órdenes.',
          },
          { t: 'ruta', texto: 'Web › Estadísticas (permiso web.estadisticas) — selector de 7/30/90 días' },
        ],
      },
      {
        id: 'modulo-web',
        titulo: 'Módulo Web (administrar el sitio)',
        bloques: [
          {
            t: 'p',
            texto: 'La administración del sitio desde el CRM. A propósito toca POCO: el producto (nombre, precio, stock, etiquetas) se maneja en **Compras › Productos** y el precio web en el formato de venta — acá solo lo que es del sitio.',
          },
          {
            t: 'tabla',
            cols: ['Sección', 'Qué se hace'],
            filas: [
              ['**Productos del sitio**', 'La MISMA lista que ve el cliente (mismo endpoint del catálogo público): quien tiene precio en la lista Mayorista está, quien no, no — y un precio en $0 (costo a medio cargar) tampoco se publica. Editables: **★ Destacado**, la **foto** y el **Mínimo web**'],
              ['**Imágenes (el estándar)**', 'TODA imagen del sitio pasa por el mismo molde al subir, en el navegador y sin servicios externos: se adapta a su medida, se comprime a **WebP** y se **previsualiza antes de confirmar**. Medidas ideales: producto **800×800** (entra entera, nunca se recorta), slide **1920×600** y categoría **600×600** (se recortan al centro — por eso la vista previa), logo de marca **400×200** transparente. Se acepta cualquier original hasta 12 MB. **Quitar fondo** (productos y logos): detecta el fondo desde los bordes y lo vuelve transparente, con tolerancia ajustable — funciona mejor con fondos lisos y claros, y un blanco DENTRO del producto no se borra. Componente nuevo con imagen = declarar su preset y hereda todo'],
              ['**Mínimo web** (por producto)', 'El piso de stock para la venta online: cuando el disponible de la Distribuidora llega a ese número, el sitio muestra **"Sin stock"** y lo que queda se prioriza para **fraccionar o para el mostrador**. 0 = se vende online hasta la última unidad. La columna muestra el stock real del depósito al lado'],
              ['**Ofertas del sitio**', 'Solo lectura: las promos activas que valen para toda lista (no "solo precio de mostrador"), sin combos ni descuentos de ticket. Se editan en **Ventas › Ofertas**'],
              ['**Contenido del sitio**', 'Los **slides de la portada** con alta, baja, edición y orden (badge, título, texto, botón, posición del texto e imagen propia por slide — nada fijo en código), y las imágenes de **categorías** y **marcas**. Sin slides, la portada arranca directo en los productos'],
              ['**Estadísticas**', 'Visitas y sesiones por día, ranking de productos (vistas, segundos mirando, carrito, unidades pedidas) y **"Lo más buscado"**: los términos del buscador del sitio — lo que se busca y no se encuentra es la lista de compras del catálogo. Los eventos crudos se guardan **13 meses** (un año completo + el mes en curso, para comparar temporadas) y la API los purga sola: al arrancar y cada 24 hs'],
              ['**Configuración del sitio**', 'La identidad y el contacto que ve el cliente: **logo** del encabezado (400×120, sin logo se muestra el nombre en texto), **favicon** de la pestaña (128×128), **WhatsApp del negocio** (arma todos los botones de WhatsApp del sitio: footer, flotante y popup), teléfono opcional, correo, ubicación e **Instagram/Facebook** (aparecen en el pie solo si están cargados). Los defaults son la info real de siempre — el sitio nunca queda vacío'],
            ],
          },
          {
            t: 'nota',
            tono: 'info',
            texto: 'Si nadie marcó destacados, la portada muestra una selección automática (los primeros 8) para no quedar vacía; apenas hay uno o más ★, la grilla pasa a llamarse "Destacados" y muestra exactamente esos.',
          },
          { t: 'ruta', texto: 'Web › Productos · Ofertas · Contenido (permisos web.productos / web.ofertas / web.contenido)' },
        ],
      },
      {
        id: 'impresion',
        titulo: 'Impresión y módulo Sistema',
        bloques: [
          {
            t: 'p',
            texto: 'TODO lo que se imprime pasa por **un solo motor** que lee la configuración de **Sistema**: el formato asignado a cada documento, el membrete de la empresa (logo + nombre + CUIT) y el pie. Un documento nuevo hereda todo solo.',
          },
          {
            t: 'tabla',
            cols: ['Qué', 'Dónde / cómo'],
            filas: [
              ['**Sistema › Empresa**', 'Nombre, CUIT, dirección, teléfono, **logo** (imagen hasta 400 KB) y color de marca. Es el membrete de todos los documentos; el color aplica solo a A4/Carta — los rollos térmicos son B/N'],
              ['**Sistema › Impresión**', 'Formato por documento: **rollo 80 mm** (recomendado: más texto por línea), **rollo 58 mm** (posnet/portátil), **A4** o **Carta**. Con **vista previa en vivo** (el mismo HTML que va a la impresora) e impresión de prueba'],
              ['**Ticket del POS**', 'Se imprime **solo al cobrar** (se apaga en Sistema › Impresión). "Reimprimir" en la registradora saca de nuevo el último ticket del puesto. Leyenda "DOCUMENTO NO FISCAL" configurable hasta que llegue ARCA'],
              ['**La impresora física**', 'La elige cada puesto en el diálogo del navegador (decisión: diálogo está bien por ahora). En la caja: Chrome con `--kiosk-printing` imprime DIRECTO a la predeterminada, sin diálogo'],
            ],
          },
          { t: 'ruta', texto: 'Sistema › Empresa · Sistema › Impresión (permiso config)' },
        ],
      },
      {
        id: 'ventas-curso',
        titulo: 'Ventas en curso',
        bloques: [
          {
            t: 'p',
            texto: 'Se pueden tener varias ventas abiertas a la vez, en pestañas: un cliente se va a buscar algo y vuelve, y su venta lo espera. Cerrar la pestaña **no descarta la venta**: queda en la tabla de ventas en curso.',
          },
          {
            t: 'p',
            texto: 'Abrir una venta entra en modo **registradora**: pantalla completa, solo lo que necesita el cajero. Los borradores se guardan solos mientras se carga.',
          },
        ],
      },
      {
        id: 'atajos',
        titulo: 'Atajos de teclado',
        bloques: [
          {
            t: 'tabla',
            cols: ['Tecla', 'Qué hace'],
            filas: [
              ['F2', 'Cobrar'],
              ['F4', 'Volver al buscador'],
              ['Ins', 'Carga rápida de producto'],
              ['Shift + Ins', 'Búsqueda masiva (categoría / marca / producto)'],
              ['Esc', 'Salir de la registradora a la lista (guardando)'],
              ['F10', 'Liquidar — ticket interno, al contado'],
              ['F7', 'Facturar — comprobante fiscal'],
              ['Alt + F5', 'Cambios de precio — **desde cualquier pantalla del sistema**'],
              ['Alt + F3', 'Existencias por sucursal — **desde cualquier pantalla del sistema**'],
            ],
          },
          {
            t: 'nota',
            tono: 'info',
            texto: 'Los dos últimos son **globales**: andan en Compras, Almacén, Ventas y el Inicio. Volver a apretar el mismo atajo cierra la consulta. Viven en el layout y no en un módulo, porque un atajo global no tiene ninguna ruta de la cual colgarse.',
          },
          {
            t: 'p',
            texto: 'Las dos consultas comparten estructura: **filtros arriba, grilla con scroll propio, pie abajo**. Los filtros y los encabezados no se van nunca de la vista, que es lo que permite recorrer cientos de filas sin perder de vista qué columna es cuál. Los encabezados van en dos niveles (Producto / Stock / Precios) porque ocho columnas de números seguidas son indistinguibles.',
          },
          {
            t: 'tabla',
            cols: ['Consulta', 'Filtros', 'Columnas'],
            filas: [
              ['**Existencias** (Alt+F3)', 'búsqueda, proveedor, categoría, marca, solo con stock', 'código · producto · una por sucursal · **total** · mostrador · otras listas'],
              ['**Cambios de precio** (Alt+F5)', 'búsqueda, marca, lista, motivo, desde', 'producto · lista · antes → después · variación · motivo · fecha'],
            ],
          },
          {
            t: 'nota',
            tono: 'info',
            texto: 'Esc es escalonado: con un modal abierto, ese Esc es del modal; con texto en el buscador, lo limpia. Recién sin nada de eso sale de la registradora.',
          },
        ],
      },
      {
        id: 'cierre',
        titulo: 'Cerrar la venta',
        bloques: [
          {
            t: 'tabla',
            cols: ['Forma', 'Comprobante', 'Condición'],
            filas: [
              ['Liquidar (F10)', 'Ticket interno', 'Siempre contado'],
              ['Facturar (F7)', 'Fiscal — la letra la resuelve el backend', 'Admite cuenta corriente'],
            ],
          },
          {
            t: 'p',
            texto: 'El modal de cobro está pensado para la velocidad de la caja: el total grande, y el foco entra directo en **"Con cuánto paga"** — se tipea lo que entrega el cliente, el **vuelto** salta a la vista y **Enter cobra** (vacío = pagó justo). El selector Contado/Cta. Cte. solo aparece si **ese cliente** tiene cuenta corriente habilitada; si no, toda venta es al contado y no hay nada que elegir.',
          },
          {
            t: 'p',
            texto: 'Admite **pago mixto**: mitad efectivo y mitad transferencia. La letra del comprobante sale de cruzar la condición de IVA del cliente con la de la empresa.',
          },
          {
            t: 'nota',
            tono: 'info',
            texto: 'La caja pide turno abierto si está configurado así. El turno que manda lo resuelve el backend por sucursal: el que informa la pantalla es una sugerencia, no una orden.',
          },
        ],
      },
      {
        id: 'arqueo-caja',
        titulo: 'Arqueo de caja',
        bloques: [
          {
            t: 'p',
            texto: 'El efectivo del cajón se controla en TRES momentos: al abrir (fondo), durante el turno (controles) y al cerrar (arqueo final). El "esperado" siempre se calcula en vivo: fondo inicial + efectivo cobrado + ingresos − egresos.',
          },
          {
            t: 'tabla',
            cols: ['Momento', 'Qué pasa'],
            filas: [
              ['**Apertura**', 'El fondo inicial es **obligatorio y mayor a cero**: sin punto de partida declarado no hay arqueo posible, así que el turno no se abre'],
              ['**Control de caja** (durante el turno)', 'Se cuenta el efectivo SIN cerrar nada: queda registrado con **fecha, hora, esperado, contado, diferencia y quién contó**. Si hay diferencia, la observación es obligatoria. Se pueden hacer todos los que hagan falta; el turno sigue abierto'],
              ['**Cierre**', 'El arqueo final: se cuenta el efectivo, la diferencia (contado − sistema) se guarda tal cual — incluso negativa — y el turno queda **cerrado definitivo**, sin reapertura. Los totales por medio quedan como foto'],
            ],
          },
          {
            t: 'nota',
            tono: 'ok',
            texto: 'Los controles intermedios sirven para achicar la ventana del problema: un faltante detectado a las 14:00 se investiga sobre 3 horas de ventas, no sobre el día entero. El historial completo se ve en el detalle de cada turno (Ventas › Caja, clic en la fila).',
          },
          { t: 'ruta', texto: 'Ventas › Caja — el turno de tu sucursal arriba (abrir, movimientos, pagar a proveedor, control, cierre) y el historial de arqueos abajo. El punto de venta solo muestra el estado del turno.' },
        ],
      },
    ],
  },

  /* ================================================================== */
  {
    id: 'inventario',
    titulo: 'Stock e inventario',
    resumen: 'El modelo de existencias y los movimientos.',
    temas: [
      {
        id: 'modelo',
        titulo: 'Modelo sin lote',
        bloques: [
          {
            t: 'p',
            texto: 'El stock se identifica por **Producto × Sucursal × Presentación × Estado**. No hay lote: se evaluó y agrega una dimensión que el negocio no usa para decidir nada.',
          },
          {
            t: 'tabla',
            cols: ['Estado', 'Significa'],
            filas: [
              ['disponible', 'Se puede vender'],
              ['comprometido', 'Reservado (presupuesto, si está configurado)'],
              ['retenido', 'Apartado por una revisión'],
              ['defectuoso', 'Roto o fallado'],
              ['vencido', 'Fuera de fecha'],
            ],
          },
        ],
      },
      {
        id: 'movimientos',
        titulo: 'Movimientos',
        bloques: [
          {
            t: 'p',
            texto: 'Registro **inmutable**: nada se edita ni se borra, se corrige con un movimiento opuesto. Es lo que permite explicar cualquier saldo.',
          },
          {
            t: 'lista',
            items: [
              'compra · fraccionamiento · venta (granel y fraccionada) · devolución',
              'ajuste · merma · vencido · defectuoso · transferencia',
            ],
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: 'Los movimientos y los comprobantes **no viajan** en la carga inicial. Crecen sin techo, y meterlos ahí hacía que el sistema se pusiera más lento cada mes. Se piden paginados desde la pantalla que los muestra.',
          },
        ],
      },
      {
        id: 'fraccionamiento',
        titulo: 'Fraccionamiento',
        bloques: [
          {
            t: 'p',
            texto: 'Convierte granel en presentaciones: baja kilos y sube paquetes, en un solo movimiento. Vive en Almacén porque es una operación de depósito, no de compra.',
          },
        ],
      },
      {
        id: 'transferencias',
        titulo: 'Transferencias entre sucursales',
        bloques: [
          {
            t: 'p',
            texto: 'Modelo **pull**: cada local pide lo que necesita, a cualquier otra sucursal (la Distribuidora es el depósito central solo porque las compras entran por ella). No son cuatro pantallas: es **un documento con estados**, y cada bandeja es un filtro por estado + qué papel juega tu sucursal en él.',
          },
          {
            t: 'flujo',
            items: ['Pedido (pendiente)', 'En preparación (dos listas)', 'Despachar (en tránsito)', 'Recibir contando'],
          },
          {
            t: 'tabla',
            cols: ['Paso', 'Qué pasa con el stock'],
            filas: [
              ['Pedido', '**Nada** — es demanda; el origen quizá ni tiene la mercadería'],
              ['En preparación', '**Nada todavía.** El pedido se parte en dos listas por tipo de producto: **Enteros** (preparador) y **Fraccionados** (fraccionador). Cada uno imprime la suya, ajusta lo preparado y agrega lo que llegó a último momento'],
              ['Confirmar lista', 'La mercadería quedó apartada físicamente → se valida y **reserva ESA lista** (disponible → comprometido). Cada encargado confirma la suya'],
              ['Despachar', 'Exige las dos confirmaciones. Viaja **lo preparado** (no lo pedido): comprometido → **en_transito**, sigue siendo del origen'],
              ['Recibir', 'Se cuenta contra lo ENVIADO; lo contado entra al destino y el faltante vuelve a comprometido en el origen con **incidencia automática**'],
            ],
          },
          {
            t: 'p',
            texto: 'Cada renglón lleva tres cantidades: **pedida** (lo que pidió el destino, no se toca), **preparada** (lo que el origen armó de verdad, con su motivo: "sin stock", "llegó tarde") y **recibida** (lo contado). Ejemplo: Express 1 pide 12 galletitas y 3 harinas de 1kg; hay 6 galletitas y 2 harinas, y justo llegó yerba → van 6 + 2 + 10 de yerba **agregada**, cada una con su motivo, sin que Express 1 tenga que re-pedir. El destino ve "≠ difiere de lo pedido" en su bandeja ANTES de abrir cajas.',
          },
          {
            t: 'nota',
            tono: 'ok',
            texto: 'Confirmar una lista con más de lo disponible se rechaza renglón por renglón ("preparado 3 paq., disponible 2 paq."). La lista del fraccionador muestra al lado de cada renglón el **granel suelto disponible** y un atajo a Fraccionar. Desconfirmar libera la reserva para seguir editando. Lo pedido y no enviado solo queda **visible** (no genera pedidos automáticos).',
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: 'Se acepta **lo que llegó** — esa es la verdad — y la diferencia nunca desaparece: queda atada a una incidencia que alguien tiene que cerrar (apareció → liberar; no apareció → merma con responsable). El faltante va a `comprometido` a propósito: es el estado sobre el que ya trabaja la resolución de incidencias.',
          },
          {
            t: 'lista',
            items: [
              '**El pedido se arma con un buscador** (como el legacy): tipeás, Enter o clic agrega, y el último queda arriba. Cada renglón muestra el stock de las DOS puntas — lo que tiene el origen y lo que te queda a vos — y "Ver solo sin stock" lista lo que se te acabó, para reponer de un vistazo. El granel se totaliza en kg equivalentes (suelto + paquetes × tamaño).',
              '**Reposición sugerida**: productos bajo su mínimo en tu sucursal → "Generar pedido" lo arma con las cantidades que faltan.',
              '**Alerta de estancados**: un remito con 3+ días en tránsito se marca en naranja — es mercadería perdida o una recepción sin registrar.',
              '**Recepción a ciegas** (opcional en el modal): contás sin ver lo esperado; si ves el número, todo el mundo aprieta "conforme".',
              '**Imprimir** en cada lista de preparación: hoja simple con Pedido / Preparar / Obs. y casillero para tildar a lápiz.',
              '**Los renglones pedidos no se borran**: si no hay, van en 0 con su motivo — el destino tiene que ver qué pidió y no llegó. Solo se borran los agregados.',
              '**Quién hace qué**: cualquier encargado (permiso *preparar* o *fraccionar*) toma el pedido pendiente y abre las listas — cada uno edita y confirma SOLO la suya (el fraccionador ve Enteros en solo lectura). Despachar y cancelar son del admin. **Recibe quien pide** (permiso *pedidos* — el cajero): armar el pedido y confirmar que llegó bien son las dos puntas del mismo trabajo. El pedido nuevo nace con el destino y el responsable de la SESIÓN. La cola de envíos se ve parado en la sucursal ORIGEN.',
            ],
          },
          { t: 'ruta', texto: 'Almacén › Transferencias (parado en tu sucursal)' },
        ],
      },
      {
        id: 'operaciones',
        titulo: 'Operaciones del almacén',
        bloques: [
          {
            t: 'p',
            texto: 'El libro de cada almacén: **una fila por documento** (envío, recepción, compra recibida, ajuste, merma) en un rango de fechas, con usuario y observación. Los envíos y recepciones se valúan al **costo congelado al despachar** — el remito viejo dice siempre lo mismo aunque el costo haya cambiado.',
          },
          {
            t: 'nota',
            tono: 'info',
            texto: 'Los movimientos sueltos (ajuste, merma) figuran **sin monto**: no congelan costo, y valuarlos al costo de hoy sería inventar un número histórico.',
          },
          { t: 'ruta', texto: 'Almacén › Operaciones' },
        ],
      },
    ],
  },

  /* ================================================================== */
  {
    id: 'catalogos',
    titulo: 'Catálogos del producto',
    resumen: 'Marca, categoría › subcategoría y etiquetas.',
    temas: [
      {
        id: 'entidades',
        titulo: 'Por qué son entidades y no texto',
        bloques: [
          {
            t: 'p',
            texto: 'Antes eran texto libre dentro del producto. Como entidades con id: renombrar deja de romper nada, y **"Cachafaz" y "CACHAFAZ" dejan de ser dos marcas distintas**.',
          },
          {
            t: 'lista',
            items: [
              'La unicidad se mide normalizada: sin acentos, sin mayúsculas, sin espacios de más.',
              'Lo que está en uso **se desactiva, no se borra**. Un producto viejo con la marca en null es un dato perdido para siempre.',
              'Existe "Fusionar" para juntar duplicados que ya entraron: es el antídoto contra el catálogo sucio.',
            ],
          },
          { t: 'ruta', texto: 'Compras › Catálogos' },
        ],
      },
      {
        id: 'cascada',
        titulo: 'Categoría › Subcategoría',
        bloques: [
          {
            t: 'p',
            texto: 'La subcategoría pertenece a una categoría. Al elegir categoría se filtra el segundo desplegable; si se cambia la categoría, la subcategoría elegida se limpia porque dejó de ser válida.',
          },
          {
            t: 'p',
            texto: 'La subcategoría es **opcional**: muchos productos no necesitan el segundo nivel.',
          },
        ],
      },
      {
        id: 'codigos',
        titulo: 'Los tres códigos',
        bloques: [
          {
            t: 'tabla',
            cols: ['Código', 'Identifica'],
            filas: [
              ['Código propio', 'El SKU interno; el que se tipea cuando no hay etiqueta'],
              ['Código de barras', 'El EAN de la unidad de venta'],
              ['DUN', 'El EAN-14 del bulto cerrado'],
            ],
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: 'Los tres son únicos cuando no están vacíos, y además **no pueden pisarse entre sí ni contra los de las presentaciones**: si dos cosas responden al mismo código, el escáner de la caja queda sin desempate.',
          },
          {
            t: 'p',
            texto: 'El **código del proveedor** no está acá: es del par producto × proveedor, porque el mismo artículo tiene un código distinto en cada proveedor. Vive en el Formato de Compra.',
          },
        ],
      },
    ],
  },

  /* ================================================================== */
  {
    id: 'gastos',
    titulo: 'Gastos',
    resumen: 'Lo que la empresa PAGA y no es mercadería: comprobantes, vencimientos y en qué se va la plata.',
    temas: [
      {
        id: 'gastos-que-es',
        titulo: 'Qué es un gasto y qué no',
        bloques: [
          {
            t: 'p',
            texto: 'Un **gasto** es un comprobante que la empresa recibe y tiene que pagar, y que **no entra al stock**: luz, alquiler, combustible, fletes, honorarios, impuestos, seguros. La mercadería NO es un gasto — sigue entrando por **Compras › Facturación**, porque mueve stock y define el costo del producto.',
          },
          {
            t: 'tabla',
            cols: ['', 'Compra de mercadería', 'Gasto'],
            filas: [
              ['Dónde se carga', 'Compras › Facturación', 'Gastos › Gastos'],
              ['Tiene ítems', 'Sí: productos con cantidad y costo', 'No: se imputa a un **rubro**'],
              ['Mueve stock', 'Sí (si es recepción)', 'Nunca'],
              ['Toca precios', 'Sí: actualiza el costo y el precio de venta', 'Nunca'],
              ['Va al libro IVA compras', 'Sí', 'Sí'],
            ],
          },
          {
            t: 'nota',
            tono: 'ok',
            texto: 'Son tablas separadas justamente por eso: mezclarlas dejaría la mitad de las columnas vacías en la mitad de las filas. Lo único que comparten es el proveedor y el libro de IVA.',
          },
          { t: 'ruta', texto: 'Gastos › Gastos' },
        ],
      },
      {
        id: 'gastos-proveedor',
        titulo: 'Un solo padrón de proveedores',
        bloques: [
          {
            t: 'p',
            texto: 'El proveedor de gastos es **el mismo** que el de compras: una entidad, un CUIT, una cuenta. Lo que lo clasifica son dos casillas — **Provee mercadería** y **Provee gastos** — que solo definen en qué buscador aparece. Un proveedor puede tener las dos: el que te trae la mercadería y además te cobra el flete es uno solo.',
          },
          {
            t: 'lista',
            items: [
              'Los proveedores que ya existían quedaron marcados como **de mercadería** (es lo que eran).',
              'Un gasto puede ir **sin proveedor**: para el ticket de nafta o la changa hay un campo "A nombre de" que es solo descriptivo. Sin ficha no hay cuenta corriente, y está bien — obligar a dar de alta un proveedor por cada ticket termina en un "Varios" que junta todo.',
            ],
          },
          { t: 'ruta', texto: 'Gastos › Proveedores · Compras › Proveedores (la misma ficha, las mismas casillas)' },
        ],
      },
      {
        id: 'gastos-rubros',
        titulo: 'Rubros: fijos y variables',
        bloques: [
          {
            t: 'p',
            texto: 'Cada gasto se imputa a un **rubro** del plan de gastos, y cada rubro es **fijo** o **variable**. Esa marca es la que hace útil el resumen: el alquiler no se compara con el combustible.',
          },
          {
            t: 'tabla',
            cols: ['Tipo', 'Qué es', 'Ejemplos'],
            filas: [
              ['**Fijo**', 'Se paga igual vendas mucho o poco. Es el piso que hay que cubrir todos los meses', 'Alquiler, servicios, sueldos, seguros, impuestos, honorarios'],
              ['**Variable**', 'Depende de la actividad', 'Combustible, fletes, packaging, mantenimiento, comisiones'],
            ],
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: 'Un rubro con gastos imputados NO se borra: se da de baja. Borrarlo dejaría gastos históricos apuntando al vacío y el resumen del año pasado sin explicación. Dado de baja deja de ofrecerse y la historia sigue siendo legible.',
          },
          { t: 'ruta', texto: 'Gastos › Rubros' },
        ],
      },
      {
        id: 'gastos-carga',
        titulo: 'Cargar un gasto',
        bloques: [
          {
            t: 'p',
            texto: 'El formulario tiene dos formas de tomar el importe, porque así llegan los papeles: si el comprobante **discrimina IVA** (factura A) se carga neto + alícuota y el IVA queda como **crédito fiscal**; si no (ticket, factura B), se carga el **total** y listo. Forzar a discriminar un ticket sería inventar un número que el papel no dice.',
          },
          {
            t: 'lista',
            items: [
              '**El selector ofrece solo proveedores de GASTOS**: a los de mercadería se les carga factura en Compras. Si uno de mercadería también factura gastos (el flete aparte, un service), se le tilda **Provee gastos** en su ficha — el padrón es uno y las dos casillas conviven.',
              '**Guard de duplicado:** con proveedor y número, la combinación tiene que ser única. Cargar dos veces la misma factura es EL error clásico de un módulo de gastos, y se descubre tarde — cuando el resumen del mes no coincide con el banco.',
              '**"Ya está pagado":** el caso más común es cargar y pagar en el mismo acto. La casilla registra el pago junto con el gasto (si es efectivo desde un turno abierto, genera el egreso de caja) y cubre **el resto**: lo que los pagos de sucursal tomados no explican.',
              '**Sin proveedor del padrón:** el ticket de nafta o la changa se pueden anotar a mano en "O anotalo a mano". Es dato descriptivo: sin proveedor no hay cuenta corriente ni pagos a cuenta que aplicar después.',
              '**Negocio (Distribuidora / Cafetería):** mismo CUIT, dos negocios. Imputar el gasto al negocio correcto es lo que permite que Almacén › Cafetería responda "cuánto me cuesta el café por mes". Por defecto, Distribuidora.',
            ],
          },
          { t: 'ruta', texto: 'Gastos › Gastos › + Nuevo gasto' },
        ],
      },
      {
        id: 'gastos-pagos',
        titulo: 'Pagos a proveedores: la plata sale una sola vez',
        bloques: [
          {
            t: 'p',
            texto: 'El pago es **del proveedor**, no del documento. Ese giro es lo que permite el caso de todos los días: llega el pedido a la sucursal, la cajera le paga al repartidor y NO carga la factura — no le corresponde y no tiene los datos. Si el pago colgara del documento, ese pago no podría existir hasta que alguien cargue la factura, y la plata ya salió del cajón a las 10:40.',
          },
          {
            t: 'tabla',
            cols: ['Momento', 'Qué pasa'],
            filas: [
              ['**10:40 · la cajera paga**', 'Ventas › Caja › **Ingreso / egreso** › Egreso › **Pago a un proveedor**: elige primero el **TIPO** (Mercadería o Gastos — la lista de proveedores se filtra sola) y después el proveedor, el importe, el concepto y el remito. Sale el egreso de caja con hora exacta y su nombre, y el pago queda **a cuenta**'],
              ['**Mientras tanto**', 'El tipo elegido es el **destino** del pago y decide su bandeja: Mercadería → **Compras › Facturación › pestaña Pagos en sucursal** · Gastos → **Gastos › Gastos › pestaña Pagos en sucursal**. Los de gastos suman al badge del sub-menú'],
              ['**Al otro día · el admin carga la factura**', 'En el alta del comprobante, el paso **Pago y confirmación** ofrece los pagos a cuenta de ese proveedor **de la sucursal de recepción de la factura** (los de otras sucursales se avisan pero se toman con SU factura). Se tilda el que la factura explica y el resto se cubre al contado. Tomarlo ahí es lo que lo **aplica**'],
            ],
          },
          {
            t: 'nota',
            tono: 'ok',
            texto: 'Aplicar se hace SIEMPRE desde el documento, nunca desde el pago — en los DOS mundos, con la misma dinámica. En Compras: el **alta de la factura** (paso "Pago y confirmación": se tildan los pagos que la factura explica) o el **detalle de una factura ya cargada**. En Gastos: al **cargar el gasto** aparece la misma tabla con tilde ("Pagos a cuenta del proveedor"), y en su detalle están **"Aplicar un pago existente"** y **"Pagar"** (que registra y aplica en un paso). Las dos bandejas de pagos son de **solo lectura** — el control de "qué plata salió y todavía no tiene comprobante detrás" — y las dos viven como **segunda pestaña** del listado de documentos (Compras › Facturación y Gastos › Gastos), con el filtro de proveedor compartido entre pestañas. En todos lados rige la misma regla de sucursal: solo se ofrecen los pagos de la sucursal del documento (un gasto de "toda la empresa" ve todos).',
          },
          {
            t: 'tabla',
            cols: ['En el alta de la factura', 'Qué hace'],
            filas: [
              ['**Tomar pagos de sucursal**', 'Aplica plata que YA salió. No mueve un peso más: el egreso quedó en el arqueo de la caja que pagó'],
              ['**Se paga ahora**', 'Registra el pago en el acto. De dónde sale se elige: la **caja de la sucursal** (si hay turno abierto — el egreso queda en ese arqueo) o **administración sin caja** (una transferencia del negocio, que no impacta en ningún arqueo)'],
              ['**Lo que queda**', 'Va a cuenta corriente, y ahí recién tiene sentido el vencimiento de pago — que por eso solo aparece cuando queda saldo'],
            ],
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: 'La **condición de pago** ya no se elige: se DERIVA de lo que se pagó (saldada = contado, con saldo = cuenta corriente), y la calcula la API para que no dependa de quién la llame. Antes era solo una etiqueta: se podía marcar "contado" sin registrar un peso y la factura figuraba como deuda del proveedor igual. Un dato que puede contradecir a los otros termina mintiendo.',
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: 'La plata sale UNA sola vez: al registrar el pago. **Aplicarlo después no vuelve a mover plata** — solo dice contra qué documento se descuenta. Si aplicar generara otro egreso, la salida se contaría dos veces y el arqueo dejaría de cerrar.',
          },
          {
            t: 'nota',
            tono: 'info',
            texto: 'Un pago sin aplicar NO es un gasto todavía: es un crédito contra el proveedor. Por eso no figura en el resumen de gastos — si figurara, y después entrara la factura, el mes contaría el doble. El gasto lo genera siempre el comprobante.',
          },
          {
            t: 'lista',
            items: [
              '**Un pago cubre varios documentos y un documento se cubre con varios pagos.** "Repartir todo el saldo" reparte del más viejo al más nuevo, y nunca aplica más de lo que cada documento debe.',
              '**Solo se aplica a documentos del MISMO proveedor.** El pago a Coca-Cola no puede pagar la factura de otro.',
              '**Y solo a documentos de SU MUNDO**: un pago de mercadería únicamente a facturas de compra; uno de gastos únicamente a gastos. Si la cajera eligió mal el tipo, el pago se **mueve de bandeja** ("Mover a Compras/Gastos" en su detalle) mientras no tenga nada aplicado — el error se corrige, no se cruza.',
              '**La cuenta del proveedor sigue siendo UNA** (mercadería + gastos − pagos): el destino separa bandejas de trabajo, no cuentas.',
              '**La bandeja es el control.** Un pago que lleva días sin aplicar significa una de dos cosas, y las dos hay que mirarlas: falta cargar el comprobante, o salió plata sin respaldo.',
            ],
          },
          {
            t: 'tabla',
            cols: ['Regla', 'Por qué'],
            filas: [
              ['Un gasto **con pagos aplicados** no se anula ni se le cambian importes, número o proveedor', 'La plata que salió tiene que poder rastrearse. Primero se quita la aplicación'],
              ['**Quitar** una aplicación no devuelve plata', 'El egreso de caja sigue registrado; el pago vuelve a la bandeja de "sin aplicar". Por eso se puede hacer aunque el turno esté cerrado'],
              ['**Anular** un pago exige que no tenga nada aplicado', 'Anular por arriba dejaría facturas figurando como pagadas sin pago detrás'],
              ['Un pago que salió de un turno **ya cerrado** no se anula', 'Ese arqueo se firmó con el egreso adentro; sacarlo por atrás convierte un cierre correcto en un descuadre inexplicable. El reintegro va como ingreso de caja del turno actual, dejando rastro de las dos operaciones'],
              ['El gasto anulado queda, no se borra', 'La carga y su anulación tienen que poder explicarse'],
            ],
          },
          {
            t: 'nota',
            tono: 'ok',
            texto: 'La cuenta corriente del proveedor pasó a ser real: comprado (mercadería + gastos) − pagado. Antes solo podía crecer, porque no había dónde registrar que se le pagó. Se ve en Gastos › Proveedores, clic en la fila.',
          },
          {
            t: 'nota',
            tono: 'info',
            texto: 'En **Compras › Facturación** el filtro de proveedor está afuera de las pestañas y manda sobre las dos: elegir "Bebidas SA" muestra sus facturas de un lado y los pagos que se le hicieron del otro. La columna **Pago** de la tabla de facturas dice de dónde salió la plata (qué sucursal, qué turno, qué cajero), y la columna **Aplicado a** de los pagos dice qué comprobante lo explica — un pago puede quedar partido entre varias facturas y se ve.',
          },
          { t: 'ruta', texto: 'Ventas › Caja › Ingreso / egreso (Egreso › Pago a un proveedor) · Compras › Facturación (pestañas Facturas / Pagos en sucursal) · Gastos › Gastos (pestañas Gastos / Pagos en sucursal)' },
        ],
      },
      {
        id: 'gastos-fijos',
        titulo: 'Gastos fijos (los que se repiten)',
        bloques: [
          {
            t: 'p',
            texto: 'Una **plantilla** de lo que llega todos los meses: alquiler, internet, seguro. No es un gasto todavía — es el recordatorio de que va a llegar. Con un clic se generan los del período, como pendientes y con el importe **estimado**, que se corrige cuando llega la factura real.',
          },
          {
            t: 'lista',
            items: [
              'La generación es **idempotente**: se comprueba contra los gastos ya emitidos por cada plantilla, no contra un flag. Reintentar nunca duplica, y si se borra el gasto generado la plantilla vuelve a ofrecerse sola.',
              'La **frecuencia** define la ventana: un seguro anual generado en agosto no vuelve a aparecer hasta el agosto siguiente, mientras que los mensuales reaparecen cada mes.',
              'El importe generado es el **estimado** de la plantilla y el vencimiento sale del día configurado (si el mes no llega a ese día, se usa el último). Los dos se corrigen editando el gasto cuando llega el papel.',
            ],
          },
          { t: 'ruta', texto: 'Gastos › Gastos fijos' },
        ],
      },
      {
        id: 'gastos-resumen',
        titulo: 'Cuentas a pagar y resumen',
        bloques: [
          {
            t: 'tabla',
            cols: ['Pantalla', 'Qué responde'],
            filas: [
              ['**Cuentas a pagar**', 'Qué debo y para cuándo. Ordenado por urgencia, con cortes de vencido / vence hoy / próximos 7 días. El **badge del sidebar** cuenta lo vencido o que vence hoy — no lo pendiente, para que no se vuelva un número que nunca baja a cero y deje de mirarse'],
              ['**Resumen**', 'En qué se va la plata: por rubro con su peso, fijos vs. variables, evolución por mes, a quién se le paga más y el IVA acumulado (crédito fiscal)'],
            ],
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: 'El resumen cuenta los gastos PENDIENTES también: el gasto existe desde que llega el comprobante, no desde que se paga. Los anulados no cuentan.',
          },
          { t: 'ruta', texto: 'Gastos › Cuentas a pagar · Gastos › Resumen' },
        ],
      },
    ],
  },

  /* ================================================================== */
  {
    id: 'chat-interno',
    titulo: 'Chat interno',
    resumen: 'El mostrador le pregunta a administración sin dejar el puesto. Hoy, solo en la Distribuidora.',
    temas: [
      {
        id: 'chat-como-funciona',
        titulo: 'Cómo funciona',
        bloques: [
          {
            t: 'p',
            texto: 'El caso de todos los días: la cajera necesita saber si hay cuenta para transferencia, o qué pasó con un pedido web, y no puede dejar el mostrador. El **botón de chat del Topbar** (al lado de las notificaciones) abre un **panel lateral que flota sobre cualquier pantalla — incluido el POS**: pregunta, sigue cobrando, y el badge naranja le avisa cuando le respondieron.',
          },
          {
            t: 'lista',
            items: [
              '**El canal grupal del local + privados 1-a-1.** El canal lo ven todos (si ya preguntaron y ya respondieron, nadie repite); el privado ordena lo otro — si tres cajeros le preguntan a la vez al administrador por el canal, las respuestas se pisan. El panel abre en una LISTA: el canal arriba y abajo el **Equipo**, con punto verde para los que están **en línea** — clic en un nombre y se abre su conversación. Un privado sin leer no desaparece porque el otro se desconectó: la fila queda con su badge.',
              '**"En línea" sin infraestructura**: el mismo poller que trae mensajes es el latido — en línea = su sistema preguntó hace menos de 15 segundos. Se pierde al reiniciar la API y se rearma solo en el próximo tick.',
              '**Los privados son privados EN EL SERVIDOR**: la API solo le entrega cada mensaje a sus dos puntas — no es un filtro de pantalla. Cada conversación (canal o privado) tiene su propia marca de lectura.',
              '**Solo en la Distribuidora, y lo decide la API.** El gate es por TIPO de sucursal en el servidor — una sesión parada en un Express ni ve el botón ni gasta un request. Si mañana otra sucursal necesita su canal, es cambiar esa regla, no rediseñar.',
              '**Sin WebSockets, a propósito.** El cliente pregunta por lo nuevo cada 4 segundos, como los avisos de órdenes web y de precios: para esta dinámica es indistinguible de instantáneo, no agrega infraestructura nueva y la BASE es la verdad — historial consultable, sobrevive recargas, el que llega tarde ve todo.',
              '**El "no leídos" es por usuario y por conversación, y vive en la base** (no en el navegador): sobrevive al F5 y a cambiar de máquina. Lo propio nace leído — el badge del Topbar suma todas las conversaciones y cada fila muestra el suyo. La conversación a la vista queda leída sola.',
              '**Pestaña en segundo plano = avisos demorados.** El navegador estrangula los relojes de las pestañas que no se ven: un mensaje puede tardar hasta un minuto en sonar si el CRM está detrás de otra ventana. Con el CRM a la vista (el caso del mostrador), llega en segundos.',
              '**Enter envía, Shift+Enter hace salto de línea.** Cada mensaje muestra quién y a qué hora (con fecha si no es de hoy). Al llegar un mensaje con el panel cerrado suena UNA nota corta — distinta de la campanita de dos notas de los pedidos web, para que el oído las distinga.',
              '**Como la sesión es por pestaña**, cada ventana chatea como su usuario: dos ventanas en la misma máquina son dos personas distintas en el canal.',
            ],
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: 'Mientras la API no tenga autenticación (bloqueante del deploy), el chat hereda el mismo agujero que todo el resto: cualquiera en la red podría escribir a nombre de otro. Se cierra con el mismo trabajo de auth, no necesita nada propio.',
          },
          { t: 'ruta', texto: 'Botón de chat en el Topbar (visible solo con sesión en la Distribuidora) · API: /chat/bootstrap · /chat/mensajes · /chat/leido' },
        ],
      },
    ],
  },

  /* ================================================================== */
  {
    id: 'usuarios-roles',
    titulo: 'Usuarios y roles',
    resumen: 'Quién es quién: roles dinámicos con permisos, contraseñas y el superadmin.',
    temas: [
      {
        id: 'modelo-roles',
        titulo: 'Roles dinámicos con permisos',
        bloques: [
          {
            t: 'p',
            texto: 'El rol es una **fila con su lista de permisos**, no algo fijo en el código. El catálogo tiene DOS niveles: **secciones** (`modulo.seccion` — qué pantallas ve; un módulo sin ninguna sección asignada desaparece ENTERO del menú, y la URL tipeada a mano rebota) y **acciones** (qué operaciones puede hacer dentro de lo que ve: registrar merma, preparar envíos, cobrar…). El editor de Gerencia muestra una tarjeta por módulo con el detalle fino, sección por sección, y un tilde maestro para marcar o desmarcar el módulo completo.',
          },
          {
            t: 'tabla',
            cols: ['Rol', 'Qué ve / qué hace'],
            filas: [
              ['**Superadmin** (Lucas)', 'Maneja todo (`*`): crea roles, permisos y usuarios con sus contraseñas. No se edita ni se borra, y siempre queda al menos uno activo'],
              ['Administrador', 'Todas las secciones salvo Gerencia › Usuarios y roles, con todas las acciones operativas'],
              ['Fraccionador', 'Solo Almacén › Fraccionamiento y Transferencias (su lista de Fraccionados) + Info de sistema'],
              ['Cajero', 'Ventas › POS, Clientes y Caja; Almacén › Transferencias e Incidencias; Dashboard e Info'],
            ],
          },
          {
            t: 'nota',
            tono: 'info',
            texto: 'Los cambios de permisos llegan a los usuarios al RECARGAR la pantalla (F5), sin re-login: la sesión refresca sus permisos contra la API en cada carga. Si la API no responde, vale la foto del login.',
          },
          {
            t: 'lista',
            items: [
              '**Usuarios**: nombre + rol + contraseña (guardada hasheada, nunca en texto) + activo. No se borran — están en los historiales — se **desactivan**.',
              '**Roles de sistema** (los cuatro de arriba): editables salvo el superadmin, no borrables. Los roles propios se borran solo sin usuarios asignados.',
              '**Login**: usuario + contraseña + **la sucursal con la que se va a operar**, con paso de confirmación ("¿estás seguro?") antes de entrar. La elección fija el contexto de TODA la sesión (Compras, Almacén y Ventas nacen parados ahí) y el header muestra siempre nombre + sucursal. Cerrar sesión: menú de la cuenta.',
              '**El usuario operativo ES el de la sesión**: en Compras/Almacén/Ventas ya no se cambia de usuario a mano — para operar como otro, se cierra sesión y entra el otro.',
              '**Dónde se ve y se cambia el puesto**: usuario y sucursal figuran una sola vez, arriba a la derecha junto al perfil (los paneles ya no repiten esa barra). Admin y superadmin cambian de sucursal desde el **menú del perfil › Cambiar de sucursal**; el resto opera donde dijo al entrar.',
              '**La sesión es POR VENTANA/PESTAÑA**: se pueden tener dos ventanas del mismo navegador logueadas con usuarios y sucursales distintos (Marta en Express 3 y Carla en Express 2 a la vez) sin que se pisen — cada una ve SU caja y opera en SU sucursal. Una pestaña nueva hereda el último login hecho en ese navegador; loguearse en una ventana no afecta a las que ya estaban trabajando.',
            ],
          },
          { t: 'ruta', texto: 'Gerencia › Usuarios y roles (permiso gerencia.usuarios — de fábrica, solo el superadmin)' },
        ],
      },
    ],
  },

  /* ================================================================== */
  {
    id: 'cafeteria',
    titulo: 'Cafetería (coffit)',
    resumen: 'El puente con el otro negocio del dueño: envíos a costo hacia coffit, que es el dueño del stock del café.',
    temas: [
      {
        id: 'cafeteria-como-funciona',
        titulo: 'Cómo funciona',
        bloques: [
          {
            t: 'p',
            texto: 'El dueño tiene DOS negocios con el **mismo CUIT**: la distribuidora (este sistema) y una cafetería cuyo stock maneja **otro sistema, coffit**. El envío de mercadería hacia el café NO es una venta (no hay factura ni IVA entre partes) ni una transferencia entre sucursales (no hay receptor en el CRM): es un **punto de salida**. La mercadería egresa del stock valorizada **a costo congelado**, queda el remito, y ahí termina la responsabilidad del CRM.',
          },
          {
            t: 'tabla',
            cols: ['Regla', 'Por qué'],
            filas: [
              ['**El CRM nunca muestra existencias de Cafetería**', 'Coffit es el dueño del stock. Dos sistemas contando la misma leche siempre terminan descuadrando, y el que mira el número equivocado decide mal'],
              ['**El envío va a COSTO, congelado al despachar**', 'La ganancia aparece donde se genera (cuando el café vende), no en un traspaso interno. Congelado con el costo del día que salió: el remito dice lo mismo dentro de seis meses aunque cambien los proveedores (mientras es solo un pedido, el total es estimado)'],
              ['**Cada renglón lleva destino: Para vender / Para usar**', 'Para vender = coffit lo revende tal cual (gaseosa, alfajor). Para usar = insumo de sus recetas (leche, café en grano). Es el dato que le dice a coffit cómo importarlo — al CRM no le cambia nada'],
              ['**El precio del café lo pone coffit, siempre**', 'Una Coca en el mostrador del café no vale lo de la góndola de la distribuidora. La lista 1 puede viajar como referencia, jamás como mandato'],
              ['**La devolución existe desde el día uno**', 'Se mandó de más o venció: "Devolución" reingresa a costo con su propio documento (CAFD). Sin ese camino, alguien lo resuelve con un ajuste a mano y se pierde la traza'],
            ],
          },
          {
            t: 'p',
            texto: 'El envío tiene **ciclo de vida** — pedido → en tránsito → recibido, con las bandejas arriba del listado como en Transferencias — y **el stock acompaña cada estado**: los estados dicen dónde está la mercadería de verdad, no son etiquetas.',
          },
          {
            t: 'pasos',
            items: [
              '**Pedir.** "+ Nuevo envío": se buscan los productos de a uno (por nombre, código o barras) o **en lote** con "Buscar en lote (marca / categoría)", con destino y cantidad por renglón. El pedido **no toca stock** y su total es el costo *estimado* de hoy. Si el flete ya salió, el tilde "El flete ya salió" lo registra y despacha en un solo acto.',
              '**Despachar.** El pedido pasa a **En tránsito**: el stock se mueve de disponible a *en tránsito* (sigue siendo de la distribuidora y así figura en Existencias — si el flete se pierde, la pérdida es de quien despachó) y **acá se congela el costo**, con el valor del día que salió.',
              '**Recibir.** "Marcar recibido": lo que viajaba **egresa del sistema** — recién acá la mercadería es del café. El movimiento queda como "Envío a Cafetería" en el historial.',
              '**Imprimir / cargar en coffit.** El detalle imprime el remito valorizado (producto, código de barras, destino, cantidad, costo). Con ese papel (o archivo, fase 2) se carga el ingreso en coffit.',
              '**Devolver.** El botón "Devolución" registra el camino inverso en un solo paso: la mercadería vuelve al stock a costo (no tiene etapas — cuando se registra, ya está acá).',
              '**Anular.** Deshace exactamente lo de su etapa: un pedido no tocó stock; lo en tránsito vuelve a disponible; lo recibido reingresa (y la devolución anulada vuelve a salir). Pide motivo y queda en el libro.',
              '**Imputar los gastos del café.** La cafetería también gasta cosas que no pasan por la distribuidora (el panadero, la luz del local). Se cargan en Gastos con **Negocio: Cafetería** — mismo CUIT, mismo libro de IVA, imputación separada.',
            ],
          },
          {
            t: 'p',
            texto: '**La foto de gestión**: el panel suma el período — mercadería enviada − devuelta + gastos imputados = **cuánto le costó la cafetería al negocio**. Las ventas las tiene coffit: la rentabilidad del café es la resta entre los dos sistemas. Y cuando exista Gerencia › Rentabilidad, estos envíos se EXCLUYEN de las ventas de la distribuidora (margen cero: inflarían volumen).',
          },
          { t: 'ruta', texto: 'Almacén › Cafetería (permiso almacen.cafeteria, de fábrica solo administración) · Gastos › Cargar gasto › Negocio' },
        ],
      },
      {
        id: 'cafeteria-conectar-coffit',
        titulo: 'Qué desarrollar en coffit para conectarse',
        bloques: [
          {
            t: 'p',
            texto: 'La fase 1 (esta) funciona con el remito impreso: no necesita tocar coffit ni abrir la API. Lo que sigue es el mapa para el desarrollador de coffit — qué construir de su lado, en dos fases.',
          },
          {
            t: 'tabla',
            cols: ['Fase 2 · Importador por archivo (sin API)', 'Detalle'],
            filas: [
              ['**Un importador de remitos en coffit**', 'Lee el envío (export del CRM o carga del papel) y crea el ingreso de stock en coffit. Renglón con destino "venta" → alta/actualización de producto vendible; "uso" → ingreso de insumo'],
              ['**Mapeo por código de barras**', 'La clave del vínculo es el campo codigoBarras (cada presentación fraccionada tiene el suyo propio); codigoPropio es el respaldo. Coffit guarda SU tabla de equivalencias — nunca mapear por nombre: renombrar un producto rompería el vínculo en silencio'],
              ['**Cuidado con las unidades**', 'El CRM habla en kg para granel y unidades/paquetes para lo demás; cada renglón viaja con su campo "unidad" explícito. Un POS de cafetería suele hablar en unidades: convertir es responsabilidad de coffit'],
              ['**El costo del remito es el costo de reposición del café**', 'Sirve para que coffit calcule su propio margen. El precio de venta del café lo decide coffit — no copiar la lista de la distribuidora'],
            ],
          },
          {
            t: 'tabla',
            cols: ['Fase 3 · Conexión directa por API', 'Detalle'],
            filas: [
              ['**Token propio con permisos acotados**', 'REQUISITO PREVIO: la autenticación de la API (hoy bloqueante del deploy). Coffit recibe un token que solo puede leer envíos — nunca el resto del CRM. Precedente reusable: el guard por ruta del módulo Tienda'],
              ['**Leer los envíos**', 'La API ya expone GET /api/cafeteria/envios (filtros desde/hasta/tipo) y GET /api/cafeteria/envios/:id con los renglones completos (producto, códigos, destino, cantidad, unidad, costo congelado). Coffit consulta periódicamente o al escanear el código del remito'],
              ['**Importación IDEMPOTENTE**', 'La clave es el id/código del envío: si coffit ya lo procesó, volver a verlo NO duplica el ingreso. Es la diferencia entre una integración estable y una que descuadra cada dos semanas'],
              ['**Confirmación de recepción (a construir en el CRM)**', 'El endpoint para que coffit confirme cantidades recibidas y las diferencias queden como incidencia. Recién acá la merma del viaje tiene dueño formal; mientras tanto la controla el papel'],
            ],
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: 'Decisiones ya tomadas que el desarrollo de coffit NO debe rediscutir: coffit es el dueño del stock del café (el CRM no lo espeja); el envío va a costo; el precio de venta del café es de coffit. Están fundamentadas en la memoria del proyecto y en esta guía.',
          },
        ],
      },
    ],
  },

  /* ================================================================== */
  {
    id: 'decisiones',
    titulo: 'Decisiones de diseño',
    resumen: 'Por qué las cosas son como son. Leer antes de "arreglar" algo.',
    temas: [
      {
        id: 'principios',
        titulo: 'Los principios que se repiten',
        bloques: [
          {
            t: 'tabla',
            cols: ['Principio', 'Dónde aparece'],
            filas: [
              ['Lo que se mide en cantidades se automatiza; lo que se mide en pesos se sugiere', 'Puertas del formato de venta'],
              ['Una sola fuente de verdad, aunque cueste una migración', 'Se eliminó "proveedor activo" en favor del formato marcado'],
              ['Lo que está en uso se desactiva, no se borra', 'Listas, marcas, categorías, etiquetas'],
              ['Los modos se cambian con un interruptor, nunca con un valor mágico', 'Modo de carga del costo'],
              ['Lo que crece sin techo no viaja en la carga inicial', 'Movimientos y comprobantes'],
              ['La fila existe = está habilitado', 'Formato de venta y de compra'],
              ['Si algo es global, se monta en el layout y no en un módulo', 'Atajos Alt+F5 y Alt+F3'],
            ],
          },
        ],
      },
      {
        id: 'trampas',
        titulo: 'Trampas conocidas',
        bloques: [
          {
            t: 'lista',
            items: [
              '**IVA contado dos veces.** El precio se calcula desde el costo NETO. El "costo final" ya lo tiene adentro y es solo informativo.',
              '**Descuentos sumados.** La escala es en cascada: 30 y 10 es 37%, no 40%.',
              '**Borrar e insertar al guardar.** El historial de costos cuelga de los formatos por id; hay que actualizar, no reemplazar.',
              '**Campos nuevos que no llegan a la pantalla.** Si la API devuelve algo nuevo y el contexto del frontend no lo copia a su estado, la pantalla queda vacía sin que nada falle. Pasó dos veces.',
              '**Cálculos duplicados desincronizados.** Precios y costos están en la API y en la pantalla. Se tocan de a dos.',
              '**Lost updates en concurrencia.** El stock se actualizaba leyendo el valor y escribiendo el resultado: dos operaciones simultáneas se pisaban en silencio. Los deltas van SIEMPRE en SQL relativo (cantidad = cantidad + δ) y las transiciones de estado reclaman con WHERE estado = el-que-vi.',
            ],
          },
        ],
      },
      {
        id: 'lecciones',
        titulo: 'Lecciones que costaron caro',
        bloques: [
          {
            t: 'lista',
            items: [
              '**Verificar con eventos sintéticos no es verificar.** Los atajos Alt+F5 / Alt+F3 se dieron por buenos disparando `KeyboardEvent` por consola. Con una tecla real fallaban en todo el sistema menos en Ventas, porque el listener vivía en el shell de ese módulo. Lo que se prueba con simulación hay que volver a probarlo como lo usa una persona.',
              '**Un campo que no se copia rompe una regla entera en silencio.** El renglón del POS no copiaba `marcaId`, así que la regla de marca nunca disparaba en la caja aunque el motor pasara sus pruebas.',
              '**Lo que la API devuelve tiene que llegar al estado del frontend.** Dos veces un campo nuevo viajó bien y la pantalla quedó vacía porque el contexto no lo copiaba a su estado.',
              '**Un prop mal escrito no da error, simplemente no hace nada.** `ModalShell` espera `footer` y `size`; dos pantallas le pasaban `actions` y `width`. React los ignoró en silencio: el formulario de Ofertas quedó sin botón de guardar y las consultas se renderizaban a 600 px con ocho columnas. En JSX un prop de más no avisa — hay que mirar la firma del componente.',
              '**Toda tabla nueva va también en `truncateAll`.** Si se olvida, re-sembrar no la limpia y los datos de ejemplo se acumulan: las ofertas terminaron con tres copias de cada promoción.',
            ],
          },
        ],
      },
    ],
  },

  /* ================================================================== */
  {
    id: 'pendientes',
    titulo: 'Pendientes',
    resumen: 'Registro de lo último, lo que falta hacer y lo que hay que arreglar. Se actualiza en cada cambio.',
    temas: [
      {
        id: 'registro',
        titulo: 'Registro de lo último',
        bloques: [
          {
            t: 'p',
            texto: 'Lo más reciente primero. El detalle de cada cosa vive en su sección — esto es el índice de qué cambió y cuándo, para retomar sin releer todo.',
          },
          {
            t: 'tabla',
            cols: ['Fecha', 'Qué se hizo'],
            filas: [
              ['**6/8/2026**', '**Chat interno de la Distribuidora**: canal grupal del local + **privados 1-a-1** con lista de **en línea** (punto verde = su sistema pollea; clic en el nombre abre la conversación) — para que el mostrador le pregunte a administración sin dejar el puesto, y que tres preguntas a la vez no se pisen en el canal. Botón en el Topbar con badge total, panel lateral que flota sobre cualquier pantalla (incluido el POS), sonido propio, lectura por conversación y por usuario guardada en la base, y privacidad EN el servidor (la API solo entrega cada privado a sus dos puntas). Solo sesiones paradas en la Distribuidora; sin WebSockets — pollea como los demás avisos. Guía: "Chat interno"'],
              ['**6/8/2026**', '**Estados del envío a Cafetería**: el envío ganó ciclo de vida — **pedido → en tránsito → recibido** — con bandejas como Transferencias y el stock acompañando (el pedido no toca stock; despachar lo pone *en tránsito* con el costo congelado ese día; recibir lo egresa). "El flete ya salió" registra y despacha en un acto; anular deshace exactamente lo de su etapa'],
              ['**6/8/2026**', '**Cafetería (coffit), fase 1**: nueva sección **Almacén › Cafetería** — envíos y devoluciones a **costo congelado** hacia el café (documentos CAF/CAFD con remito imprimible, destino "para vender / para usar" por renglón, anulación que revierte el stock), gastos imputables al **negocio Cafetería** y resumen del período (mercadería neta + gastos = cuánto costó el café). El CRM no lleva el stock del café: lo maneja coffit. La guía "Cafetería (coffit)" documenta el circuito y el contrato para conectar coffit'],
              ['**6/8/2026**', '**Gastos espejo de Compras, completo**: "Pagos en sucursal" pasó a ser la **segunda pestaña de Gastos › Gastos** con el filtro de proveedor compartido; la bandeja quedó de **solo lectura** (se eliminó el "Aplicar" desde el pago); el **alta del gasto** ofrece tomar los pagos con **tilde** — solo los de la sucursal del gasto ("toda la empresa" ve todos) — y "¿Ya está pagado?" cubre el resto; el selector de proveedores del gasto lista **solo los que proveen gastos**; las dos bandejas (Compras y Gastos) arrancan mostrando todo el período con columna **"Aplicado a"**, así el pago tomado no se esfuma de la vista'],
              ['**6/8/2026**', '**Sesión por pestaña**: dos ventanas del mismo navegador pueden trabajar con usuarios y sucursales distintos sin pisarse (antes el login de una sobreescribía al de la otra y una cajera terminaba viendo la caja ajena). Una pestaña nueva hereda el último login'],
              ['**6/8/2026**', '**Nuevo comprobante de compra en 3 pasos**: datos → ítems → pago. El proveedor se fija en el paso 1 (cambiar de proveedor vacía los renglones — se acabó colar mercadería de un proveedor en la factura de otro) y viene bloqueado si el alta se abre desde la ficha del proveedor. **Tomar pagos de sucursal es opt-in por tilde** y solo se ofrecen los de la **sucursal de recepción** de la factura, en el alta y en el detalle'],
              ['**6/8/2026**', '**Facturación con dos pestañas** (Facturas | Pagos en sucursal) y filtro de proveedor compartido; columna **Pago** en las facturas (de qué caja/turno/cajero salió la plata o cuánto se debe) y **"Aplicado a"** en los pagos. La condición de pago del comprobante se **deriva del saldo** y el "contado" registra un pago real'],
              ['**6/8/2026**', '**Avisos afinados**: el de cambio de precios suena solo cuando el cambio lo hizo la **administración** (y lo ven los cajeros); el de órdenes web lo ve solo el **administrador**'],
              ['**5-6/8/2026**', '**Pago a proveedor desde la caja**: la cajera registra el egreso eligiendo el TIPO de proveedor (mercadería/gastos), la plata queda **a cuenta** y el documento la toma después. Módulo **Gastos** completo (rubros, fijos, cuentas a pagar, resumen) con un solo padrón de proveedores y dos casillas de clasificación'],
            ],
          },
        ],
      },
      {
        id: 'proximo',
        titulo: 'Lo próximo',
        bloques: [
          {
            t: 'tabla',
            cols: ['Qué', 'Por qué importa'],
            filas: [
              ['**Sesiones con token — BLOQUEANTE del deploy**', 'El login ya valida contraseña, pero la API sigue abierta: cualquiera que la alcance puede llamar cualquier endpoint. En la red local no duele; al publicar el sitio, la API queda en internet y esto pasa a ser **condición previa**: solo los 4 endpoints públicos de la tienda (catálogo, pedidos, eventos, imágenes) pueden quedar sin token — todo el resto tiene que exigir sesión autenticada ANTES de apuntar el dominio'],
              ['**Anular un comprobante de compra**', 'No hay endpoint todavía. Cuando se haga, tiene que **liberar las imputaciones**: los pagos tomados vuelven a la bandeja con su saldo — anular por arriba dejaría plata aplicada a un documento que ya no existe'],
              ['**Cafetería, fases 2 y 3 (lado coffit)**', 'La fase 1 ya funciona (Almacén › Cafetería, ver su guía). Falta el **importador de remitos en coffit** (fase 2, por archivo, sin API) y la **conexión directa** (fase 3: token con permisos acotados — activa el bloqueante de auth — más el endpoint de confirmación de recepción en el CRM, que le da dueño formal a la merma del viaje)'],
              ['**Notas de crédito** (compra y venta)', 'Con saldo acreditable. La devolución hoy no tiene comprobante que la respalde'],
              ['**Re-cotización asistida**', 'Al reabrir un presupuesto vencido, traerlo a precios de hoy mostrando el antes/después por renglón'],
              ['**Facturación ARCA**', 'El ticket interno funciona; falta el CAE'],
              ['**Orden de pago impresa**', 'El pago a proveedor ya existe y se aplica a facturas y gastos; falta el COMPROBANTE en papel — el recibo que se le entrega al proveedor con el detalle de qué se le está cancelando'],
              ['**Foto del comprobante de gasto**', 'La tabla y el endpoint están; falta el botón en el detalle del gasto para adjuntar la foto del papel por el estándar de imágenes del sistema'],
              ['**Costo fijo mensualizado**', 'Prorratear las frecuencias largas en el resumen (un seguro anual de $960.000 cuenta $80.000 por mes): es cuánto tiene que facturar el negocio antes de empezar a ganar'],
              ['**Agente de impresión (ESC/POS)**', 'Impresión sin diálogo en cualquier puesto, corte automático y apertura del cajón — se enchufa detrás del mismo motor de impresión'],
              ['**Catálogo real del sitio**', 'Migrar los ~550 productos reales con precio mayorista y sus fotos (el módulo Web ya está: falta el importador masivo — CSV/XML export de WooCommerce). DECISIÓN TOMADA: en ese importador las fotos entran directo a DISCO comprimidas a WebP (~60-100 KB), no a la base — las URLs versionadas ya lo soportan sin tocar el sitio, y el backup pasa a ser base + carpeta'],
              ['**Iconos reales de la PWA**', 'Los del sitio siguen siendo placeholder (círculo blanco sobre verde): reemplazar `sitio-web/public/icons/` cuando esté el logo definitivo'],
              ['**Aviso de pedido web FUERA del CRM**', 'Adentro ya avisa (alerta con sonido + badges); falta el aviso cuando nadie tiene el sistema abierto: WhatsApp o email al dueño (necesita un servicio externo)'],
              ['**Deploy del sitio (Hostinger)**', 'Hoy corre en local (localhost:3002); falta publicarlo y apuntar el dominio real. Checklist: (1) auth con token en toda la API salvo los 4 endpoints de tienda — BLOQUEANTE; (2) Node escuchando SOLO en localhost con nginx como única puerta (el `trust proxy` ya está activo y sin esto el X-Forwarded-For es falsificable); (3) `limit_req` de nginx como refuerzo del rate limit propio'],
            ],
          },
        ],
      },
      {
        id: 'aflojar',
        titulo: 'Cosas a revisar',
        bloques: [
          {
            t: 'lista',
            items: [
              '**Alta masiva de formato de venta.** Cambiar markups en tanda ya está («Actualizar márgenes» sobre los filtrados, con selección por fila). Lo que falta es el ALTA masiva: habilitar una lista que el producto no tiene (tipo "poner Mayorista 1 al 30% en toda la categoría X") sin entrar producto por producto.',
              '**El código propio no se autogenera todavía.** Está el campo y la unicidad, falta el botón "crear un código" correlativo.',
              '**Alícuotas de IVA por producto sin validar contra ARCA.** Hoy es una lista cerrada nuestra; cuando entre la facturación hay que cruzarla.',
              '**Sin paginación en la evolución de precios.** Trae hasta 2.000 filas y filtra en memoria. Anda bien ahora; con años de historia va a haber que paginar del lado del servidor.',
              '**Las presentaciones no tienen su propio formato de compra.** Se compran a granel y se fraccionan, que es el caso real, pero si algún día se compra el paquete cerrado va a haber que modelarlo.',
              '**Recepción a ciegas sin configuración global.** Hoy es un botón opcional en el modal de recepción; falta la llave en configuración para hacerla obligatoria por sucursal.',
              '**Operaciones no incluye fraccionamientos ni ventas.** El libro cubre transferencias, compras recibidas y ajustes/mermas; si hace falta el resto, se suma como fuente.',
              '**Los sueldos se cargan como un gasto más.** Hay rubro ("Sueldos y cargas sociales") pero no hay legajo ni liquidación: si algún día hace falta el detalle por empleado, es un módulo aparte.',
              '**El resumen de gastos no se cruza todavía con las ventas.** Muestra cuánto se gastó, no el margen del período. Ese cruce es trabajo de Gerencia › Rentabilidad.',
              '**La condición de pago del GASTO sigue siendo un selector manual.** En Compras ya se deriva del saldo (saldada = contado); en Gastos todavía puede contradecir a los importes. Unificar cuando moleste.',
              '**Los permisos `gastos.pagos_proveedor` y `compras.pagos` ahora gatean pestañas, no secciones.** Un rol que tenga SOLO ese permiso (sin `gastos.gastos` / `compras.facturacion`) no ve la bandeja: revisar los roles si se crea uno así.',
            ],
          },
        ],
      },
      {
        id: 'gastos-notas-tecnicas',
        titulo: 'Nota técnica: fechas del formulario',
        bloques: [
          {
            t: 'p',
            texto: 'Un `<input type="date">` manda `AAAA-MM-DD` pelado, y `new Date(\'2026-08-05\')` lo interpreta como **medianoche UTC**: en Argentina (UTC−3) eso es el día 4 a las 21:00, y el gasto fechado el 5 aparecía listado el 4. Las fechas de Gastos se parsean con hora explícita (`T00:00:00`) para que queden en medianoche LOCAL.',
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: 'Si aparece el mismo corrimiento de un día en otro módulo con campos de fecha, la causa es esta y el arreglo es el mismo.',
          },
          {
            t: 'lista',
            items: [
              'Recordatorio: cualquier módulo nuevo con `<input type="date">` tiene que parsear igual del lado del servidor.',
            ],
          },
        ],
      },
      {
        id: 'como-mantener',
        titulo: 'Cómo se mantiene esta sección',
        bloques: [
          {
            t: 'p',
            texto: 'Al cerrar cualquier función o cambiar una regla de negocio se actualiza la sección que corresponda **y esta lista**. Documentación vieja es peor que no tener ninguna: si dice algo que ya no es cierto, alguien la va a creer.',
          },
          {
            t: 'p',
            texto: 'Todo el contenido vive en un solo archivo (`modules/manual/content/manual.js`) como estructura de datos. Sumar documentación es agregar un objeto, nunca escribir pantalla.',
          },
        ],
      },
    ],
  },
];
