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
        actualizado: '2026-07-30',
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
        actualizado: '2026-07-30',
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
        actualizado: '2026-07-30',
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
        actualizado: '2026-08-06 18:53',
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
        actualizado: '2026-07-30',
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
        id: 'importar-catalogo',
        actualizado: '2026-08-07 10:30',
        titulo: 'Importar el catálogo de un proveedor',
        bloques: [
          {
            t: 'p',
            texto: 'Para dar de alta cientos de productos de una vez: se cargan los tres listados que exporta el sistema de gestión anterior (**productos**, **formatos de compra** y **formatos de venta**) tal como salen, y el sistema los traduce a su modelo. Se reconocen **por sus columnas**, así que el orden en que se eligen no importa.',
          },
          { t: 'ruta', texto: 'Compras › Productos › Importar catálogo' },
          {
            t: 'flujo',
            items: ['Archivos', 'Proveedor y listas', 'VISTA PREVIA', 'Se escribe todo junto'],
          },
          {
            t: 'lista',
            items: [
              '**Los paquetes fraccionados NO entran como productos.** El archivo trae "x100g / x250g / x1kg" como si fueran productos aparte, pero son **presentaciones** de su producto madre: se atan solas por el nombre, con su código de barras y su recargo. Importarlos como productos habría dejado decenas de fantasmas que nadie le compra a nadie.',
              '**El costo sale del formato de compra, no del maestro**: lista − descuentos en cascada + flete ÷ bulto. El costo del maestro del sistema viejo viene **con IVA adentro** y acá los costos se guardan netos — tomarlo de ahí metía un 21% de error en toda la góndola.',
              '**El markup por paquete se traduce a recargo.** En el sistema viejo cada paquete tiene su markup (el kilo al 48%, el de 250 g al 66%); acá el markup es de la lista y la presentación lleva el **recargo por fraccionar**, que se calcula solo.',
              '**El rubro se deduce del nombre** (el archivo trae los rubros como números sin nombre), y **"GRANEL" o "VARIOS" no se toman como marca**: describen la modalidad, no al fabricante.',
              '**No se puede importar sin ver la vista previa.** Ahí está lo que importa: cuántos productos y presentaciones entran, qué rubros se asignaron, y sobre todo **qué precios se mueven**.',
            ],
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: 'La vista previa separa los precios que cambian en dos, y la diferencia es importante: hasta **15%** es el costo que se actualizó y el precio que venía atrasado (normal, es el trabajo del sistema). **Más de 15% casi siempre significa que en el archivo el costo del producto y el de su paquete no coinciden** — uno de los dos está mal. Esos quedan con el costo real pero conviene mirarlos con la factura del proveedor a mano antes de vender.',
          },
          {
            t: 'nota',
            tono: 'ok',
            texto: 'Se escribe **todo junto o nada**: si algo falla, no queda medio catálogo cargado. Y es **repetible**: lo que ya existe con el mismo código interno no se toca y se informa al final, así que reimportar el mismo archivo no duplica nada. Actualizar costos de productos que ya están es trabajo de la factura, no de la importación.',
          },
          {
            t: 'nota',
            tono: 'info',
            texto: 'El **stock arranca en cero**: entra con la primera factura de compra. Los archivos no traen existencias, y inventarlas sería peor que no tenerlas.',
          },
        ],
      },
      {
        id: 'facturas-por-procesar',
        actualizado: '2026-08-07 19:40',
        titulo: 'Facturas por procesar (subir el papel y cargarlo después)',
        bloques: [
          {
            t: 'p',
            texto: 'Separa dos cosas que hasta ahora eran una sola y no tienen por qué serlo: **recibir el papel** y **cargar la factura**. La mercadería llega el martes a la mañana con el camión; el admin carga las facturas el viernes. Entre esos dos momentos el papel se moja, se pierde o se queda en un cajón. Ahora la cajera **saca la foto cuando llega el camión** y ahí termina su trabajo: la factura queda en la bandeja, con el papel guardado, esperando que alguien la cargue.',
          },
          {
            t: 'p',
            texto: 'Ese desacople es la mayor parte del ahorro de tiempo, y no depende de ninguna magia. Lo que sí ahorra tipeo es el **QR de la factura**: toda factura electrónica argentina lo trae (RG 4892) y **es un JSON**, no una imagen para interpretar. De ahí salen CUIT del emisor, tipo, letra, punto de venta, número, fecha, **total** y CAE. Leer un QR es determinístico: o lo lee o no lo lee, no existe "lo leyó mal".',
          },
          {
            t: 'lista',
            items: [
              '**El proveedor se reconoce por el CUIT del papel**, no por parecido de nombre. Para que funcione, cada proveedor tiene que tener su CUIT cargado en su ficha — sin eso la factura llega a la bandeja sin proveedor y hay que elegirlo a mano (una sola vez: la próxima ya se reconoce).',
              '**Lo que el papel NO dice, se pregunta.** Sobre todo **en qué sucursal entró la mercadería**: eso lo sabe quien la recibió y no está escrito en ninguna parte de la factura. Se propone la sucursal del que subió la foto, pero es editable.',
              '**El detalle de renglones se carga a mano.** Argentina no tiene intercambio de factura estructurada (no hay nada como el CFDI mexicano): los ítems solo existen en el PDF del proveedor. Esa parte es la etapa que sigue.',
              '**Del PDF no se lee el QR**, solo de las fotos: su encabezado se carga a mano. Igual se guarda el archivo.',
              '**Una factura de varias hojas es UNA sola factura** con varias páginas: se sube la primera y las demás se agregan desde su detalle con "+ Agregar página".',
            ],
          },
          {
            t: 'p',
            texto: 'La bandeja pinta cada factura con un **semáforo**. **Rojo frena la carga** y son siempre decisiones que el sistema no puede tomar solo: falta el proveedor, falta el número, falta la sucursal, o **la factura ya está cargada**. **Amarillo avisa** sin frenar (no se pudo leer el QR, la factura no está en pesos, falta el total del papel). Verde no se muestra: la regla es que los rojos sean pocos y verdaderos — si la bandeja pregunta quince cosas por factura, el admin tipea más rápido a mano.',
          },
          {
            t: 'nota',
            tono: 'ok',
            texto: 'El dato más útil que trae el QR es **el total**. Al cargar los renglones, el pie compara contra ese número: si la suma de los ítems, menos la bonificación, más el IVA, más las percepciones da el total del papel, la carga está **demostrada** — no "parece bien", cierra. Y cuando falta algo, dice cuánto: probado con una factura real de Bavosi, con la bonificación cargada y sin la percepción el pie avisaba "faltan $35.128,56", que es exactamente la percepción que traía el papel.',
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: 'Ese control mira **la plata, no las cantidades**. `1 × $12.000` y `12 × $1.000` cierran idéntico, y el segundo mete el stock **doce veces mal en silencio**. Es la falla más peligrosa de todas justamente porque la factura cuadra igual, así que **el número de bultos hay que mirarlo aparte** — la tabla de impacto en precios ayuda: si el costo unitario salta por el factor del bulto, no es un aumento, es una caja cargada como unidad.',
          },
          {
            t: 'lista',
            items: [
              '**"Procesar"** guarda las correcciones del encabezado y abre el alta del comprobante con todo puesto (proveedor bloqueado, tipo, número, fecha, CAE) y con un link **"Ver el papel"** visible en los tres pasos: es lo que se mira mientras se tipean los renglones.',
              '**Al confirmar, la bandeja se cierra sola** y el papel queda pegado al comprobante: se ve desde su detalle. Es lo que se busca cuando seis meses después el total no cuadra.',
              '**Si la factura ya estaba cargada a mano**, la salida útil no es descartar el papel sino **engancharlo al comprobante que ya existe** — la bandeja ofrece el botón con el número del comprobante.',
              '**Descartar no borra el papel**: la factura queda en la pestaña "Descartadas" y se puede recuperar.',
              '**Se borra la página, no la factura**: si una de las hojas salió mal se quita esa; si no sirve ninguna, se descarta la factura entera.',
            ],
          },
          {
            t: 'nota',
            tono: 'ok',
            texto: 'De paso quedaron tapados dos agujeros que ya existían. **(1)** `comprobantes` no tenía el índice único de número que Ventas y Cobranzas sí tenían: con carga manual no molestaba porque el que cargaba se acordaba, pero con papeles entrando desde el celular el duplicado era cuestión de tiempo — y entraba dos veces al stock y a la deuda. **(2)** El punto de venta ahora se **normaliza a cuatro dígitos** en las dos puertas: el papel imprime "00115", el QR trae "115" y antes eran dos puntos de venta distintos, así que el control de duplicados no los cruzaba.',
          },
          { t: 'ruta', texto: 'Compras › Por procesar · el permiso es `compras.lecturas` (subir el papel lo puede hacer cualquiera con la sección; confirmar la factura sigue siendo del admin)' },
        ],
      },
      {
        id: 'carga-factura',
        actualizado: '2026-08-07 19:40',
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
          {
            t: 'p',
            texto: '**El pie de la factura** (abajo del paso 2) replica el papel en su orden, para poder cuadrar de reojo: **subtotal de los ítems → bonificación → neto gravado → IVA → percepciones → TOTAL**. Si el total del sistema coincide con el de la factura, la carga está bien; si no, algo falta. El pie muestra **solo lo que esta factura trajo**: la bonificación y las percepciones se agregan con los botones **"+ Bonificación"** y **"+ Percepciones"**, porque la mayoría de las facturas no traen ninguna de las dos y no tienen por qué ocupar el formulario.',
          },
          {
            t: 'lista',
            items: [
              '**La bonificación es el descuento GENERAL del pie** ("Bonif. 21,38 %"), aparte de los `Desc%` de cada renglón. Se carga en su botón: se escribe el porcentaje, el importe se calcula solo y se puede corregir — el proveedor redondea a su manera y el que manda es el papel. Una vez cargada, el pie la muestra con un "cambiar" al lado y el botón pasa a decir "Editar bonificación".',
              '**El IVA se calcula sobre el neto YA bonificado**, y renglón por renglón: con dos alícuotas distintas en la misma factura (21% y 10,5%), prorratear el IVA total daría un número que no cierra con el libro.',
              '**Las percepciones se configuran una vez por proveedor** y el botón "+ Percepciones" abre la lista para **tildar la que vino** — nunca se aplican solas, porque el mismo proveedor a veces las trae y a veces no. El importe se sugiere con la alícuota y se puede corregir al del papel. Si el proveedor no tiene ninguna configurada, el botón queda deshabilitado y avisa dónde cargarlas.',
              '**Las percepciones NO son IVA**: son pago a cuenta de otro impuesto (IVA RG 5329, Ingresos Brutos), se declaran por separado y **no van al crédito fiscal**. Están en el total porque hay que pagárselas al proveedor. Cada una queda guardada en el comprobante con su nombre y alícuota **copiados**: si mañana cambia la alícuota del proveedor, la factura del año pasado sigue explicando su propio total.',
              '**Cada línea del pie se puede cambiar y quitar**: al lado de la bonificación y de cada percepción aplicada hay un "cambiar" (vuelve a abrir su modal) y una **×** que la saca. Quitar la bonificación recalcula las percepciones solas, porque su base cambió.',
            ],
          },
          {
            t: 'nota',
            tono: 'ok',
            texto: 'Si la factura entró por la bandeja **"Por procesar"**, el pie agrega una línea más: **el total que dice el papel**, con la diferencia en vivo. Cuando cierra dice "✓ Coincide con el papel"; cuando no, dice si faltan o sobran y cuánto. La tolerancia no es cero a propósito — el proveedor redondea cada renglón y en facturas grandes queda un centavo que no es un error; lo que sí es un error se mide en pesos.',
          },
          { t: 'ruta', texto: 'Compras › Facturación › + Nuevo comprobante · las percepciones se configuran en Compras › Proveedores › (abrir uno) › Percepciones' },
        ],
      },
      {
        id: 'liquidacion',
        actualizado: '2026-08-08 05:30',
        titulo: 'Liquidación: la mitad que el proveedor entrega sin factura',
        bloques: [
          {
            t: 'p',
            texto: 'Hay proveedores que entregan **mitad facturado y mitad sin factura**. Esa segunda mitad **entró al depósito y hay que pagarla**, así que tiene que estar cargada: si no, el stock miente (falta la mercadería que sí llegó) y la cuenta corriente miente (falta la plata que sí se debe). Para eso está el tipo **Liquidación**.',
          },
          {
            t: 'p',
            texto: 'Antes no había forma de cargarla. Los dos tipos que existían daban cada uno la mitad de lo que hacía falta:',
          },
          {
            t: 'tabla',
            cols: ['Tipo', '¿Mueve stock?', '¿Genera deuda?', '¿Es fiscal?'],
            filas: [
              ['**Factura**', 'sí (con recepción)', 'sí', '**SÍ** — IVA, CAE, va a ARCA'],
              ['**Remito**', 'sí (con recepción)', '**NO**', 'no'],
              ['**Liquidación**', 'sí (con recepción)', 'sí', '**no** ← la que faltaba'],
            ],
          },
          {
            t: 'p',
            texto: 'Con un remito la mercadería entraba pero **la deuda no quedaba registrada**; cargar la mitad negra como factura **inflaba el IVA computado**. La liquidación hace las dos cosas bien: suma stock y suma deuda, sin ser fiscal.',
          },
          {
            t: 'p',
            texto: '**Cómo se carga.** Igual que una factura (Compras › Facturación › + Nuevo comprobante), eligiendo el tipo **Liquidación (sin factura)**. La pantalla se acomoda sola: **letra X fija** (no se elige), **sin IVA** y **sin percepciones** — ni las filas del pie ni el botón aparecen. El total es la mercadería y nada más. Se cargan las dos mitades como dos comprobantes del mismo proveedor y la misma fecha; cada uno con lo que le corresponde.',
          },
          {
            t: 'nota',
            tono: 'ok',
            texto: '**La plata al proveedor es UNA.** Las dos mitades caen en la misma cuenta corriente y las dos aparecen en la bandeja de pago, así que se le paga junto y el saldo es el real. Facturación muestra además un indicador **"Sin factura"** aparte del "Total facturado", que es el número que se compara contra el libro de IVA: son dos cosas distintas y no hay que mezclarlas.',
          },
          {
            t: 'p',
            texto: '**Por qué es un tipo propio y no una factura con letra X ni un tilde de "no fiscal".** Lo que importa es qué pasa cuando alguien se olvida. Con un tipo aparte, toda consulta que pide "facturas" la excluye sola y hay que **optar por incluirla**. Con una letra o un tilde, todo la incluye por defecto y hay que acordarse de sacarla — y ese olvido **infla el IVA computado**, que es el lado caro del error. El costo de la decisión: el tipo nuevo hay que agregarlo en **seis listas explícitas** del código (mueve stock, genera deuda, cuenta corriente, documentos pagables, lo que se acepta imputar, y la suma del saldo); están todas marcadas con el comentario `LISTA DE TIPOS` para poder encontrarlas.',
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: '**Quién la ve.** Tiene **permiso propio** (`liquidaciones`), separado del de cargar facturas, y arranca **solo para admin y superadmin**. Sin ese permiso el tipo no está en el alta, no está en el filtro y las liquidaciones **no se listan**. Se puede aflojar cuando quieras en Sistema › Roles. **Pero es una comodidad de pantalla, no un candado**: la API no valida quién llama y no va a poder hasta que haya sesiones con token — es el mismo bloqueante de siempre.',
          },
          {
            t: 'p',
            texto: '**Lo que la liquidación NO hace:** no tiene CAE ni QR (no es electrónica, el papel se carga a mano), **una nota de crédito no puede ajustarla** (la NC es fiscal y no puede referenciar algo que para ARCA no existe: si vuelve mercadería de esa mitad, se corrige la liquidación), y no aparece en ninguna suma de IVA. Si el proveedor te da un papel de esa mitad, se puede subir a la bandeja de Por procesar y clasificarlo como liquidación a mano.',
          },
          { t: 'ruta', texto: 'Compras › Facturación › + Nuevo comprobante › tipo "Liquidación (sin factura)" · el permiso se configura en Sistema › Roles' },
        ],
      },
      {
        id: 'notas-credito-debito',
        actualizado: '2026-08-07 23:05',
        titulo: 'Notas de crédito y de débito: siempre sobre una factura',
        bloques: [
          {
            t: 'p',
            texto: 'Una nota de crédito o de débito **nace de UNA factura**: la mercadería que se devolvió de esa entrega, el flete que el proveedor se olvidó de cobrar en ese remito. Por eso el **paso 3** del alta, cuando el tipo es NC o ND, muestra **la lista de facturas de ese proveedor** con su saldo, para elegir cuál ajusta. La **NC resta** y la **ND suma**.',
          },
          {
            t: 'p',
            texto: 'La lista muestra, por cada factura, el total, lo pagado, el **saldo de hoy** y —al elegirla— **en cuánto queda**. Ese último número es el que importa: es la consecuencia de lo que se está por registrar, a la vista antes de confirmar.',
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: '**Sin la referencia, la nota quedaba flotando y se le pagaba de más al proveedor.** El campo existía en la base pero ninguna pantalla lo cargaba, así que una NC de $50.000 contra una factura de $200.000 restaba de la deuda TOTAL del proveedor —la cuenta corriente cerraba bien— pero **la factura seguía ofreciendo $200.000 para pagar**. El que paga factura por factura le pagaba los $200.000 enteros. Verificado y corregido: con una NC de $38.675 sobre una factura de $41.934,75, la bandeja pasó de ofrecer $41.934,75 a ofrecer $3.259,75.',
          },
          {
            t: 'lista',
            items: [
              '**Elegir no es opcional, pero "ninguna" es una opción.** La lista tiene una fila final —"no corresponde a una factura en particular"— que hay que marcar a propósito. Si no se elige nada, el alta no deja registrar: por defecto la nota volvería a flotar. Sin factura, la nota mueve la cuenta del proveedor pero no cambia el saldo de ningún documento, que es lo correcto para un ajuste general (una bonificación de fin de año, un recargo financiero sobre varias facturas).',
              '**La ND que ajusta una factura NO se paga por separado.** Su importe ya está sumado en el saldo de esa factura; pagarla aparte sería cobrar dos veces el mismo ajuste. La bandeja no la lista y la aplicación la rechaza con ese mensaje. La ND **sin** referencia sí sigue siendo un documento pagable por sí mismo.',
              '**El total del papel no cambia nunca.** La factura sigue diciendo lo que dice. Lo que cambia es cuánto queda debiéndose por ella — y eso es lo que la bandeja de pago ofrece. El detalle de la factura muestra la tabla de sus notas con la cuenta completa: total del papel, ajuste, pagado, y lo que queda.',
              '**Se puede pasar del saldo, y avisa.** Si la NC es mayor que lo que queda de la factura (pasa cuando ya estaba pagada y la mercadería se devolvió después), el alta lo advierte y deja registrar: el excedente queda a favor tuyo en la cuenta del proveedor.',
              '**Una NC con recepción devuelve mercadería** y descuenta stock. No es automático por tipo, porque una NC no siempre es devolución —también ajusta un precio mal facturado o compensa un bulto roto que igual te quedaste—: lo decide el tilde de recepción.',
            ],
          },
          {
            t: 'nota',
            tono: 'ok',
            texto: 'Guardas al registrar: la nota solo puede ajustar una **factura** (no un remito, que no genera deuda, ni otra nota), **del mismo proveedor** y **confirmada**. Y la referencia solo la aceptan las notas: una factura con referencia se rechaza.',
          },
          { t: 'ruta', texto: 'Compras › Facturación › + Nuevo comprobante › (tipo Nota de crédito o de débito) › paso 3' },
        ],
      },
      {
        id: 'cadena',
        actualizado: '2026-07-30',
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
        actualizado: '2026-07-30',
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
        actualizado: '2026-07-30',
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
        actualizado: '2026-07-30',
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
        actualizado: '2026-08-01',
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
        actualizado: '2026-08-01',
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
        actualizado: '2026-08-01',
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
        actualizado: '2026-08-01',
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
        actualizado: '2026-08-01',
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
        actualizado: '2026-08-01',
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
        actualizado: '2026-08-01',
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
        actualizado: '2026-08-01',
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
        actualizado: '2026-08-01',
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
        actualizado: '2026-08-01',
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
        actualizado: '2026-08-01',
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
        actualizado: '2026-08-01',
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
        actualizado: '2026-08-01',
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
        actualizado: '2026-08-06 18:53',
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
        actualizado: '2026-08-01',
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
        actualizado: '2026-08-01',
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
        actualizado: '2026-08-06 18:53',
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
        actualizado: '2026-08-01',
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
        actualizado: '2026-08-01',
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
        actualizado: '2026-08-06 18:53',
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
        actualizado: '2026-08-01',
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
        actualizado: '2026-08-01',
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
        actualizado: '2026-08-01',
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
        actualizado: '2026-08-01',
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
        actualizado: '2026-08-06 18:53',
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
        id: 'producto-ciclo-vida',
        actualizado: '2026-08-10 11:20',
        titulo: 'El producto que ya no se trae: dar de baja, no borrar',
        bloques: [
          {
            t: 'p',
            texto: 'Hasta el 10/8/2026 el producto solo tenía **Eliminar**, y era borrado real: el sistema cumplía su propio principio ("lo que está en uso se desactiva, no se borra") con las marcas, las categorías, las listas, las ofertas, los clientes y los usuarios — pero no con el producto, que es el que más historia acumula. Ahora tiene ciclo de vida, y son **DOS decisiones distintas**, no un interruptor.',
          },
          {
            t: 'tabla',
            cols: ['Estado', 'Compras', 'POS y web', 'Para qué es'],
            filas: [
              ['**Activo**', 'Aparece', 'Aparece', 'Todo normal.'],
              ['**Discontinuado**', '**No aparece** (ni en la carga de facturas ni en la reposición por stock mínimo)', '**Sigue vendiéndose**', 'El caso más común: el proveedor lo bajó o se decidió no reponerlo, pero lo que quedó en góndola se termina de vender. Apagar todo de golpe sería tirar esa plata.'],
              ['**Archivado**', 'No', '**No** (tampoco pedidos de cafetería ni control de vencimientos)', 'Fuera de catálogo. Exige que NO quede stock: si queda, el sistema dice cuánto y dónde, y ofrece dejarlo discontinuado.'],
            ],
          },
          {
            t: 'p',
            texto: '**Volver es un clic.** "Reactivar" conserva TODO: los códigos, el historial de precios, las presentaciones, los formatos de compra de cada proveedor, cuántas veces venció. Con el borrado viejo, volver a traer un producto significaba crearlo de nuevo a mano y **perder la historia que justamente sirve para decidir si conviene traerlo**. Al reactivar, el modal avisa de cuándo es el último costo cargado: el precio de venta se calcula con ese número hasta que entre la primera compra nueva.',
          },
          {
            t: 'pasos',
            items: [
              '**Dar de baja.** En Compras › Productos, botón **Dar de baja** en la fila. El modal explica las dos opciones (no hay que adivinar la diferencia), pide un motivo que queda anotado, y muestra el stock que todavía hay y en qué sucursal.',
              '**Verlos y reactivarlos.** El listado muestra por defecto lo que **está en juego** (activos + discontinuados) con un chip en los que no están activos; el filtro de estado llega a los archivados, que es el camino para reactivar uno.',
              '**Eliminar de verdad** quedó como excepción: solo si el producto NO dejó ninguna huella (un duplicado del importador, un alta con el dedo). Si ya se compró, vendió o movió, el sistema dice **cuál es la huella** ("2 ventas, 1 movimiento de stock") en lugar del error crudo de la base, y ofrece la baja.',
            ],
          },
          {
            t: 'nota',
            texto: 'Tres claves foráneas dejaron de ser `cascade` y pasaron a `restrict` (migración 0051): **stock, renglones de transferencias e incidencias**. Antes, borrar un producto hacía desaparecer en silencio sus existencias y mutilaba remitos viejos; ahora la base misma lo impide. El borrado legítimo limpia solo las filas de stock en CERO, que no son información.',
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: 'Los candados están en la API, no solo en las pantallas: la venta rechaza lo archivado incluso en un borrador armado antes (el catálogo del POS se cachea al abrir la caja), la factura de compra rechaza lo discontinuado y lo archivado, y el importador de catálogo **no revive un archivado en silencio** — lo saltea avisando "hay que reactivarlo". El estado NO se cambia editando el producto: tiene su propia acción, así no se modifica de costado sin que nadie lo decida.',
          },
          { t: 'ruta', texto: 'Compras › Productos › Dar de baja / Reactivar · filtro de estado · migración 0051' },
        ],
      },
      {
        id: 'vencimientos-vigia',
        actualizado: '2026-08-10 10:05',
        titulo: 'Vencimientos: el vigía de fechas (la app externa se volvió módulo)',
        bloques: [
          {
            t: 'p',
            texto: 'La app externa de vencimientos (PHP en Hostinger) se **reconstruyó adentro del sistema** como Almacén › Vencimientos: la LÓGICA vino de allá, el DATO es 100% de acá — catálogo, sucursales (incluida **Fontana**, dada de alta con la migración 0050), costos reales y usuarios. El corazón del modelo: **el registro de vencimiento NO es stock, es un vigía**. "6 unidades de X vencen el 15/9 en Express 2" se anota caminando la góndola, el sistema avisa a tiempo, y el stock se toca recién cuando algo venció y se procesa. Es la versión SIN lote de los vencimientos que el modelo original descartó (aquéllos eran por lote).',
          },
          {
            t: 'tabla',
            cols: ['Pestaña', 'Qué hace'],
            filas: [
              ['**Panel**', 'Las alertas por rango **EXCLUYENTE** — vencidos sin procesar / 0-7 / 8-15 / 16-30 días — con plata al costo congelado. Un registro vive en UNA tarjeta, jamás en dos. Clic en la tarjeta = ir filtrado a Registros. Los días se calculan SIEMPRE contra el calendario argentino, nunca contra el reloj UTC del server (a la noche UTC ya es "mañana" y adelantaría los vencidos un día).'],
              ['**Control**', 'La sesión de góndola, en el ORDEN FÍSICO del acto: **1· el producto** (botón 📷 **Escanear** con la cámara del celular, lector USB, o buscándolo por nombre/código/barras — también el de las presentaciones fraccionadas) → **2· la fecha** impresa en el paquete → **3· cuántos hay** → Agregar. El producto elegido queda a la vista ("en la mano") con su código de barras, y **la fecha y la cantidad se conservan** al agregar: cuando toda una tanda vence igual, el siguiente es escanear y agregar, nada más. Enter en fecha, cantidad u observaciones también agrega. Todo cae a una lista editable que se guarda de un saque; mismo producto + misma fecha se suman. La fecha pasada avisa pero DEJA: es la forma de asentar lo encontrado tarde. Cada control queda en el historial con usuario y sucursal.'],
              ['**Registros**', 'Todo lo anotado con chips por rango, filtros y exportación CSV. El **costo viaja CONGELADO** al registrar (lección de cafetería): la pérdida de marzo no cambia en julio porque subió el catálogo. Editar no re-valúa.'],
              ['**Vencidos**', 'El cierre del ciclo: procesar = contar cuántas se **vendieron antes de vencer** y cuántas se tiran. Separa pérdida ESTIMADA (todo lo registrado) de pérdida **REAL** (lo que de verdad se perdió). Con "bajar del stock" tildado genera el movimiento «vencido» (disponible → estado vencido) EN LA MISMA transacción: o pasa todo, o no pasó nada — sin stock suficiente, no procesa ni a medias. Dos personas procesando lo mismo: una sola gana (FOR UPDATE). Lo procesado no se edita ni se borra: es pérdida asentada.'],
              ['**Mermas**', 'La baja de siempre (merma / vencido / defectuoso) **se mudó acá**: registrar abre el modal de movimiento con el producto precargado, y el listado muestra todas las bajas con su costo congelado y su origen ("De vencimiento" si nació de procesar). El modal existía registrado pero SIN botón que lo abriera — quedó huérfano en alguna refactor; ahora tiene casa.'],
              ['**Reportes**', 'General (estimada + real + mermas), por sucursal, por categoría, **los que MÁS vencen** (la señal para comprar distinto), historial mensual y controles hechos con usuario. Períodos semana/mes/trimestre/año. Los movimientos nacidos de procesar NO cuentan como merma suelta: sumarían la misma pérdida dos veces.'],
            ],
          },
          {
            t: 'p',
            texto: '**La oferta por vencer es una oferta REAL.** Desde un registro que todavía no venció, "Oferta" arma una oferta de Ventas (tipo porcentaje, alcance = el producto, vigente **hasta el día del vencimiento inclusive**, por defecto solo en la sucursal del registro) que aplica en la caja como cualquier otra y se administra en Ventas › Ofertas. El registro queda vinculado y muestra "🏷 En oferta"; un registro arma UNA sola. Ojo: el alcance es el producto COMPLETO — si tiene otras presentaciones a la venta, entran mientras dure.',
          },
          {
            t: 'p',
            texto: '**Escanear con la cámara del celular** (10/8/2026): el botón 📷 abre la cámara trasera y agrega el producto al leer el código — con bip y vibración, porque caminando la góndola nadie mira la pantalla. Usa `BarcodeDetector`, la API nativa, cuando existe (**Chrome de Android sí la tiene**, y Android es donde se escanea); si no, cae a **ZXing** por *import dinámico*: son ~450 KB que se descargan SOLO al abrir la cámara la primera vez, así el arranque de la app no engorda. Lee EAN-13, EAN-8, UPC-A/E, Code-128, Code-39 e ITF. No escanea de continuo a lo bruto: mira un frame cada ~120 ms (más rápido calienta el teléfono sin leer mejor), corta al primer acierto y **apaga la cámara en el acto**.',
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: '**La cámara solo funciona en "contexto seguro": HTTPS o localhost.** Entrando desde el celular por `http://192.168.0.x:3000` el navegador la bloquea sin explicar nada — por eso la pantalla lo detecta ANTES y lo dice. Para usarla en la red local hay que levantar el front con **`npm run dev:https`** (imprime la dirección `https://…` a la que entrar; el celular avisa que el certificado no es de confianza → Avanzado → Continuar, una sola vez). En producción, con el dominio y su HTTPS, no hace falta nada. El lector USB y la búsqueda por nombre funcionan siempre, con o sin HTTPS.',
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: 'Lo que se decidió al importar la app y NO se rediscute: el catálogo es SOLO el del sistema (de la app vieja no vino ni un dato — arrancó de cero); no hay productos manuales; el endpoint de BI externo no se replicó; la sección es permiso propio (`almacen.vencimientos`, migración 0050 a admin/superadmin) así se le puede dar a un empleado por local sin abrirle el resto del Almacén. El globito del menú cuenta lo que APURA: vencidos sin procesar + vence en ≤7 días.',
          },
          { t: 'ruta', texto: 'Almacén › Vencimientos (permiso almacen.vencimientos) · pestañas Panel / Control / Registros / Vencidos / Mermas / Reportes · migración 0050 (tablas, Fontana, costo congelado en movimientos) · cámara: npm run dev:https en la red local' },
        ],
      },
      {
        id: 'fraccionado-pantalla-propia',
        actualizado: '2026-08-09 05:30',
        titulo: 'El fraccionado tiene pantalla propia (y la madre dice la verdad total)',
        bloques: [
          {
            t: 'p',
            texto: 'Construido el 9/8/2026, con la lógica que definió el dueño: **el fraccionado muestra lo suyo y la madre cuenta la verdad total**. Si hay 5 kg de ajo sueltos y 10 paquetes de 500 g ya fraccionados, el Ajo X500G muestra sus 10 unidades, y la madre muestra "5 kg suelto + 5 kg fraccionado = **10 kg en total**" — que es la respuesta a "¿cuánto ajo hay?". Comprar mirando solo el suelto compra de más.',
          },
          {
            t: 'tabla',
            cols: ['Qué', 'Cómo quedó'],
            filas: [
              ['**Fila propia en el listado**', 'Compras › Productos lista cada fraccionado debajo de su madre ("↳ Lentejas · 500 g", badge Fraccionado) con su stock en paquetes. Se busca también por el código de barras de la etiqueta del paquete. Clic abre su pantalla propia.'],
              ['**La pantalla propia**', 'Pestaña **Resumen**: tamaño, código de barras, recargo, costo del paquete (derivado), precio de venta, **formato de venta por lista**, stock por sucursal (paquetes y equivalente en kg) y los movimientos DE ESE fraccionado. Pestaña **Producto madre**: el "Prod.Util" del sistema viejo — de qué producto descuenta, cuánto consume por paquete (tamKg), y los dos costos (lista = sin recargo, total = con recargo). Más el desglose: suelto + este fraccionado + todas las presentaciones = TOTAL equivalente.'],
              ['**El costo es de SOLO LECTURA**', 'Se deriva del madre (costo/kg × tamaño × recargo) y no se edita acá — si se pudiera, el costo del paquete y el de la madre divergirían: el vicio del sistema viejo que obligó a revisar 24 precios al importar Bavosi. Lo editable es el **recargo**, en la pestaña Presentaciones de la madre.'],
              ['**"Solo para fraccionar"** (el "SOLO STOCK" del viejo)', 'Tilde en la ficha del granel que no se vende suelto (la pimienta de Jamaica: llega 1 kg y se fracciona entera en 20×50 g). El POS no lo ofrece por kg, y la venta suelta se **rechaza en la API** (hasta en borrador) — sus paquetes se venden normal.'],
              ['**Borrar una presentación con stock se rechaza**', 'Esos paquetes existen en el depósito: borrar el renglón los haría desaparecer del sistema. Primero se venden o se ajustan.'],
            ],
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: '**Bug grave encontrado y corregido al construir esto**: guardar la pestaña Presentaciones hacía borrar-todo-y-reinsertar, y como el stock cascadea por `presentacionId`, CADA guardado **borraba el stock de todos los fraccionados en silencio** — aunque no se hubiera sacado ninguna presentación. Ahora actualiza por id (misma lección que los formatos de compra y su historial): los ids sobreviven al guardado y el stock queda donde estaba. Verificado: guardar con recargo nuevo conserva ids y stock intactos.',
          },
          { t: 'ruta', texto: 'Compras › Productos (filas ↳) · clic en el fraccionado › Resumen / Producto madre · ficha del producto › tilde "Solo para fraccionar"' },
        ],
      },
      {
        id: 'modelo',
        actualizado: '2026-07-30',
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
        actualizado: '2026-07-30',
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
        actualizado: '2026-07-30',
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
        actualizado: '2026-07-30',
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
              ['En preparación', '**Nada todavía.** El pedido se parte en dos listas por tipo de producto: **Enteros** (preparador) y **Fraccionados** (fraccionador). **Cada encargado ve SOLO la suya**: la del otro no le sirve y le haría buscar sus renglones entre los ajenos. Cada uno imprime la suya, ajusta lo preparado y agrega lo que llegó a último momento'],
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
            texto: '**Quién ve qué:** el fraccionador ve solo Fraccionados, el preparador solo Enteros, y quien tenga los dos permisos (o sea admin) ve las dos — necesita el pedido completo para despachar. Si el pedido no trae nada de tu lado, la pantalla lo dice ("este pedido no trae fraccionados") en vez de mostrar una tabla vacía. **Ojo: esto es una comodidad de pantalla, no un candado** — la API todavía no valida quién confirma qué lista, y no va a poder hasta que haya sesiones con token. Confirmar una lista con más de lo disponible se rechaza renglón por renglón ("preparado 3 paq., disponible 2 paq."). La lista del fraccionador muestra al lado de cada renglón el **granel suelto disponible** y un atajo a Fraccionar. Desconfirmar libera la reserva para seguir editando. Lo pedido y no enviado solo queda **visible** (no genera pedidos automáticos).',
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
        actualizado: '2026-07-30',
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
        actualizado: '2026-07-30',
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
        actualizado: '2026-07-30',
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
        actualizado: '2026-07-30',
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
        actualizado: '2026-08-05',
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
        actualizado: '2026-08-05',
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
        actualizado: '2026-08-05',
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
        actualizado: '2026-08-06 18:53',
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
        actualizado: '2026-08-06 18:53',
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
        actualizado: '2026-08-05',
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
        actualizado: '2026-08-05',
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
        actualizado: '2026-08-07 08:45',
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
              '**Los mensajes se borran a las 24 horas.** El chat es conversación, no archivo: lo que hay que decidir va a su documento (el pedido, la factura, la observación del comprobante), no al chat — ahí se pierde. La regla se avisa en el propio panel. Son DOS capas y las dos hacen falta: las consultas **filtran** por el corte (así el límite es exacto en todo momento) y una **purga borra de verdad** cada 10 minutos como máximo (así la tabla no crece). El navegador descarta con el mismo corte, así el panel no muestra lo que el servidor ya borró aunque el CRM lleve dos días abierto. La marca de "leído hasta acá" sobrevive a la purga: es un número, no una referencia al mensaje.',
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
        actualizado: '2026-08-06 18:53',
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
        actualizado: '2026-08-09 03:30',
        titulo: 'Cómo funciona',
        bloques: [
          {
            t: 'p',
            texto: 'El dueño tiene DOS negocios con el **mismo CUIT**: la distribuidora (este sistema) y una cafetería cuyo stock maneja **otro sistema, coffit**. El envío de mercadería hacia el café NO es una venta (no hay factura ni IVA entre partes) ni una transferencia entre sucursales (no hay receptor en el CRM): es un **punto de salida**. La mercadería egresa del stock valorizada **a costo congelado**, y del otro lado coffit la ingresa en su almacén **“Sabor y Aroma”**, donde ELLA le da el tratamiento que corresponda.',
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: '**El 9/8/2026 el circuito se simplificó por decisión del dueño.** Se fueron TRES cosas: el **destino por renglón** (venta/uso — es una clasificación DE COFFIT, que la decide al recibir; el CRM la pedía, la guardaba y jamás la leía), las **etapas** (pedido → tránsito → recibido eran el teatro de un viaje que es cruzar la calle, y cada etapa era un lugar más donde los dos sistemas podían divergir) y las **devoluciones** (no van a existir: la corrección de un envío es EDITARLO).',
          },
          {
            t: 'tabla',
            cols: ['Regla', 'Por qué'],
            filas: [
              ['**El CRM nunca muestra existencias de Cafetería**', 'Coffit es el dueño del stock. Dos sistemas contando la misma leche siempre terminan descuadrando, y el que mira el número equivocado decide mal'],
              ['**El envío nace ENVIADO: egresa stock y congela costo en el acto**', 'Con el envío ya se da por hecho que el café lo recibió. Congelado con el costo del día: el remito dice lo mismo dentro de seis meses aunque cambien los proveedores'],
              ['**La clasificación es de coffit**', 'Qué es góndola y qué es insumo lo decide quien es dueño del stock, al recibirlo en su almacén “Sabor y Aroma". El CRM manda el detalle completo y ahí termina su responsabilidad'],
              ['**La corrección es EDITAR el envío**', 'Se revierte el egreso viejo y se aplica el nuevo, en una transacción. El renglón que ya estaba CONSERVA su costo congelado (re-valuar cambiaría retroactivamente un período ya mirado); el renglón nuevo entra al costo de hoy. Cada cambio sube la **versión**'],
              ['**Coffit se entera de todo por sincronización**', 'Editar o anular después de que coffit ya ingresó el envío dejaría los dos sistemas divergentes en silencio. Por eso cada cambio toca `version`/`actualizadoEn`, y coffit pregunta "¿qué cambió desde la última vez?" (GET /cafeteria/sync)'],
              ['**El precio del café lo pone coffit, siempre**', 'Una Coca en el mostrador del café no vale lo de la góndola de la distribuidora. El costo del remito es su costo de reposición, jamás su lista de venta'],
            ],
          },
          {
            t: 'pasos',
            items: [
              '**Enviar.** "+ Nuevo envío": se buscan los productos de a uno (nombre, código o barras) o en lote, cantidad por renglón, y **Enviar**. El stock egresa ya y el costo queda congelado. Cada renglón viaja con su **modo de unidad explícito** — granel (kg), paquete o unidad — más el equivalente en kg, para que del lado de coffit 10 paquetes de 500 g jamás se conviertan en 10 kg.',
              '**Corregir.** En el detalle, **Editar**: el formulario abre con los renglones cargados, los costos dicen "congelado" o "costo de hoy" según corresponda, y guardar revierte-y-reaplica con el stock acompañando. Si el stock no alcanza para la corrección, no pasa NADA (ni a medias). La versión sube.',
              '**Anular.** Reversión completa: todo reingresa al stock. También sube la versión — coffit tiene que deshacer su ingreso y se entera por sincronización. Pide motivo y queda en el libro.',
              '**Imprimir el remito.** Producto, código, cantidad con su unidad, equivalente en kg y costo congelado. Si el envío se corrigió, el remito dice la versión.',
              '**Mirar la MÉTRICA.** La segunda pestaña del panel: qué se le mandó al café en el período, agregado por artículo, con filtros de fechas y buscador. Suma solo lo enviado (lo anulado no existió) al costo congelado, ordenado por plata: lo de arriba es lo que más cuesta.',
              '**Imputar los gastos del café.** La cafetería también gasta cosas que no pasan por la distribuidora (el panadero, la luz del local). Se cargan en Gastos con **Negocio: Cafetería** — mismo CUIT, mismo libro de IVA, imputación separada.',
            ],
          },
          {
            t: 'p',
            texto: '**La foto de gestión**: el panel suma el período — mercadería enviada + gastos imputados = **cuánto le costó la cafetería al negocio**. Las ventas las tiene coffit: la rentabilidad del café es la resta entre los dos sistemas. Y cuando exista Gerencia › Rentabilidad, estos envíos se EXCLUYEN de las ventas de la distribuidora (margen cero: inflarían volumen).',
          },
          { t: 'ruta', texto: 'Almacén › Cafetería (permiso almacen.cafeteria, de fábrica solo administración) · pestañas Envíos y Métrica · Gastos › Cargar gasto › Negocio' },
        ],
      },
      {
        id: 'cafeteria-pedidos',
        actualizado: '2026-08-09 22:10',
        titulo: 'El pedido de la cafetería: el rol que solo ve una pantalla',
        bloques: [
          {
            t: 'p',
            texto: 'La cafetería también **pide**: arma su pedido de mercadería y la distribuidora lo recibe para armarlo. El pedido nace **en el CRM** (no en coffit) por una razón concreta: necesita el **catálogo completo con disponibilidad a la vista** — coffit solo conoce los artículos que alguna vez le mandaron, que es justo lo contrario de lo que un pedido necesita. Para eso existe el **rol Cafetería**: un usuario que entra al CRM y ve UNA sola sección (Almacén › Pedido a la distribuidora) — sin ninguna otra clave de permiso, el resto del sistema es invisible.',
          },
          {
            t: 'tabla',
            cols: ['Pieza', 'Cómo funciona'],
            filas: [
              ['**El pedido es DEMANDA, no envío**', 'No toca stock ni congela costo (la vieja lección: la realidad entra con el envío). Ciclo: **pendiente** → **armando** (el admin lo tomó) → **enviado** (se convirtió en envío) · **anulado** con motivo. La cafetería puede anular lo pendiente; el admin, todo lo abierto.'],
              ['**El admin se entera al toque**', 'Aviso flotante con campanita en cualquier pantalla ("☕ La cafetería armó un pedido" — dos notas más graves que las de órdenes web, para distinguirlas de oído), globito en el menú Almacén › Cafetería, y contador en la pestaña **Pedidos** de esa pantalla, que ahora es la primera. Solo lo ve la administración con la sección habilitada; el primer tick no alerta (lo viejo se ve en los globitos, la campanita es para lo que ENTRA).'],
              ['**Convertir en envío**', 'Abre el alta del envío con lo pedido **precargado** — "lo pedido es la propuesta": el que arma corrige a lo que de verdad va (faltantes, reemplazos) y al enviar el pedido queda **cerrado** (reclamo atómico: dos conversiones del mismo pedido, solo una gana). El envío viaja con `pedidoId` en el sync, así coffit cruza "esto que llegó responde a aquello que pedí".'],
              ['**El estado vuelve a la cafetería**', 'En su misma pantalla: la fila pasa de Pendiente a Armando a Enviado, con el código del envío que la cumplió. Sin llamar por teléfono a preguntar "¿ya sale?".'],
              ['**Esa pantalla NO la ve administración**', 'La sección `almacen.cafeteria-pedidos` es EXCLUSIVA del rol Cafetería (la migración 0049 se la quitó a admin y superadmin, que la habían heredado de la 0048). Es el café pidiendo, no la distribuidora mandando: tenerla en el menú de Almacén invitaba a cargar un pedido que nadie pidió y confundía de qué lado del mostrador nace cada cosa. El candado no es cosmético: entrar por URL cae en la primera sección permitida.'],
              ['**Mandar sin que hayan pedido**', 'Ese es el camino normal de administración: **"+ Nuevo envío"** en Almacén › Cafetería. El envío nace con `pedidoId` en null (envío espontáneo) y coffit lo recibe igual por sincronización. El pedido es un pedido; el envío no necesita ninguno detrás.'],
            ],
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: '**El usuario "Cafetería" ya existe** (rol cafeteria, creado por la migración 0048) con contraseña inicial **1234 — cambiala en Gerencia › Usuarios y roles** antes de dársela al café. El candado de visibilidad es del sistema de permisos (pantalla): como todo el CRM, la API misma sigue abierta en la red local hasta que llegue la autenticación — el bloqueante conocido del deploy.',
          },
          {
            t: 'nota',
            texto: 'La clave `almacen.cafeteria-pedidos` **sigue en el catálogo** de Gerencia › Usuarios y roles, listada como "SOLO para el rol Cafetería": es la que arma ese rol, y el editor muestra el catálogo completo aunque quien edita no tenga la sección. Deja de venir otorgada, no de existir.',
          },
          { t: 'ruta', texto: 'Rol Cafetería → Almacén › Pedido a la distribuidora · Admin → Almacén › Cafetería › pestaña Pedidos (+ aviso flotante) y "+ Nuevo envío" · migraciones 0048 y 0049' },
        ],
      },
      {
        id: 'cafeteria-conectar-coffit',
        actualizado: '2026-08-09 03:30',
        titulo: 'El contrato para coffit: sync, forma del envío y reglas',
        bloques: [
          {
            t: 'p',
            texto: 'El mapa para el desarrollador de coffit. La versión completa, con ejemplos de respuesta reales, está en **`crm-api/docs/contrato-coffit.md`** — esta ficha es el resumen. El modelo del lado de coffit: un almacén **“Sabor y Aroma”** donde entran todos los envíos del CRM, y ahí coffit clasifica y trata cada artículo como quiera.',
          },
          {
            t: 'tabla',
            cols: ['Pieza', 'Detalle'],
            filas: [
              ['**GET /api/cafeteria/sync?desde=…**', 'TODO lo que cambió desde el cursor: creados, editados y **anulados** (el anulado viaja — coffit tiene que deshacer su ingreso). La respuesta trae `ahora`: coffit lo guarda y lo manda como próximo `desde`. El cursor lo pone el reloj del CRM, así relojes desfasados no abren agujeros'],
              ['**La clave estable es `productoId` + `presentacionId`**', 'Seriales inmutables. Coffit matchea a mano UNA vez contra su catálogo y el vínculo no se rompe aunque acá se renombre o recodifique el producto. `codigoBarras`, `codigoPropio` y `nombre` viajan solo como legibles para la pantalla de matcheo'],
              ['**El modo de unidad es explícito**', 'Cada renglón dice `modo`: granel (cantidad en KG), paquete (cantidad en PAQUETES, con `tamKg` = kg por paquete) o unidad (producto entero). Además viaja `totalKg` ya calculado, para contrastar. La trampa de deducir la unidad quedó cerrada'],
              ['**`version` detecta la corrección**', 'Coffit guarda (id, version) de lo que procesó. Si el sync trae un id conocido con versión mayor: deshacer el ingreso anterior y aplicar el nuevo. Si trae `estado: "anulado"`: deshacer y punto. Reprocesar la MISMA versión no debe duplicar (idempotencia)'],
              ['**El costo del remito es el costo de reposición del café**', 'Congelado al enviar. Sirve para que coffit calcule su propio margen — el precio de venta del café lo decide coffit, jamás la lista de la distribuidora'],
            ],
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: '**El endpoint funciona en la red local.** Exponerlo a coffit por internet está atado al bloqueante de autenticación de la API: cuando se resuelva, coffit recibe un token que SOLO puede leer `/cafeteria/sync` — nunca el resto del CRM (precedente reusable: el guard por ruta del módulo Tienda). Para desarrollar el importador contra la red local, no hace falta nada.',
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: 'Decisiones ya tomadas que el desarrollo de coffit NO debe rediscutir: coffit es el dueño del stock del café (el CRM no lo espeja); el envío va a costo; la clasificación de la mercadería es de coffit; el precio de venta del café es de coffit. Están fundamentadas en la memoria del proyecto y en esta guía.',
          },
          { t: 'ruta', texto: 'crm-api/docs/contrato-coffit.md · GET /api/cafeteria/sync · GET /api/cafeteria/envios/:id' },
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
        actualizado: '2026-08-06 18:53',
        titulo: 'Los principios que se repiten',
        bloques: [
          {
            t: 'tabla',
            cols: ['Principio', 'Dónde aparece'],
            filas: [
              ['Lo que se mide en cantidades se automatiza; lo que se mide en pesos se sugiere', 'Puertas del formato de venta'],
              ['Una sola fuente de verdad, aunque cueste una migración', 'Se eliminó "proveedor activo" en favor del formato marcado'],
              ['Lo que está en uso se desactiva, no se borra', 'Listas, marcas, categorías, etiquetas — y desde el 10/8/2026 también el PRODUCTO, que era la única excepción (ver "El producto que ya no se trae")'],
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
        actualizado: '2026-08-06 18:53',
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
        actualizado: '2026-08-06 18:53',
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
      {
        id: 'candados-saldo',
        actualizado: '2026-08-08 03:00',
        titulo: 'Saldos y dos pedidos a la vez: por qué los chequeos van con candado',
        bloques: [
          {
            t: 'p',
            texto: '**La regla, corta: todo chequeo de "no le podés aplicar más que su saldo" tiene que leer la fila con candado (`FOR UPDATE`) DENTRO de la transacción.** Leerla sin candado hace que el chequeo sea una foto vieja, y el que la mira no se entera.',
          },
          {
            t: 'p',
            texto: '**Por qué.** Postgres trabaja por defecto en READ COMMITTED: un `select` común **no espera** a la transacción de al lado, lee la última versión confirmada. Así, dos pedidos simultáneos de imputar el mismo pago leían los dos `aplicado = 0`, los dos pasaban la validación, y las dos imputaciones entraban. No hace falta un ataque: un doble click en una conexión lenta alcanza.',
          },
          {
            t: 'p',
            texto: '**Demostrado, no supuesto.** Con dos conexiones sobre un pago de $500, escalonadas para que la segunda lea mientras la primera todavía no confirmó:',
          },
          {
            t: 'tabla',
            cols: ['', 'Sin candado', 'Con `FOR UPDATE`'],
            filas: [
              ['Qué lee la segunda', 'saldo = 500 (la foto vieja)', 'espera a que la primera confirme, y lee saldo = 0'],
              ['Resultado', '**entran las DOS: $1.000 imputados a un pago de $500**', 'la segunda se rechaza: "el pago solo tiene 0.00 sin aplicar"'],
            ],
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: '**El comentario del código afirmaba que esto ya estaba cubierto** ("ni por dos pedidos simultáneos"), y eso es peor que no decir nada: una promesa falsa hace que nadie vuelva a mirar. Si un comentario garantiza una propiedad, o está demostrada o la frase se cambia.',
          },
          {
            t: 'p',
            texto: '**ORDEN DE BLOQUEO: primero el pago, después el documento.** Siempre igual, en las cuatro funciones de Pagos que bloquean (`aplicar`, `desimputar`, `anular`, `cambiarDestino`). Dos caminos que tomen los mismos dos candados en orden distinto se abrazan y se quedan esperando para siempre. Hacen falta los dos: el del pago evita que se pase el MISMO pago dos veces; el del documento evita que **dos pagos distintos** sobre-paguen la misma factura entre ambos.',
          },
          {
            t: 'p',
            texto: '**Dónde más apareció el mismo patrón** (se revisaron los tres módulos que faltaban):',
          },
          {
            t: 'tabla',
            cols: ['Dónde', 'Qué pasaba', 'Cómo quedó'],
            filas: [
              ['**Cobranzas** · `saldosEnTx`', 'Idéntico al de Pagos, del lado de las ventas: dos cobranzas simultáneas sobre la misma venta leían el mismo saldo, las dos pasaban el "debe $X y estás imputando $Y", y la venta terminaba **cobrada de más**.', 'La fila de la venta se lee con candado. El agregado de imputaciones no se puede bloquear (es una suma), pero al serializar la venta la suma que se lee ya es estable.'],
              ['**Caja** · `cerrar`', 'No era un saldo sino el CIERRE, y es el peor de los tres. El cierre son tres pasos —ver que está abierta, sumar el arqueo, marcarla cerrada— y entre el segundo y el tercero entraba plata: un pago a proveedor de esa caja, o un movimiento manual. Ese egreso quedaba **adentro de un turno cerrado pero fuera de `sistemaEfectivo`**, así que la diferencia del arqueo nacía mal y quedaba **congelada en la fila**: no se detectaba nunca más.', 'El cierre es una transacción y bloquea la sesión. Las dos puertas que insertan movimientos (`caja.movimiento` y `pagos.crear`) leen la sesión con el mismo candado: o entran antes y el arqueo las cuenta, o esperan y se rechazan porque el turno ya cerró.'],
              ['**Comprobantes**', 'Nada que arreglar. El único lugar parecido lee `total`/`pagado` para decidir una etiqueta derivada (contado vs cuenta corriente), no para autorizar plata.', 'Y el stock ya usaba el patrón correcto desde antes: `UPDATE stock SET cantidad = cantidad + delta`, que es atómico y no necesita candado.'],
            ],
          },
          {
            t: 'p',
            texto: 'Y un detalle de método: el primer intento de probar esto fue disparar dos pedidos HTTP a la vez, y **pasó igual sin el candado** — la transacción dura menos de un milisegundo y no llegaron a solaparse. Un test que pasa con y sin el arreglo no prueba nada. La carrera se reprodujo bajando al nivel donde vive (dos conexiones SQL, con la ventana agrandada a propósito).',
          },
          { t: 'ruta', texto: 'crm-api/src/pagos/pagos.module.ts · cobranzas.module.ts (saldosEnTx) · caja.module.ts (cerrar, movimiento)' },
        ],
      },
      {
        id: 'agentes-catalogo',
        actualizado: '2026-08-08 00:30',
        titulo: 'Agentes: los dos propios, y por qué no el catálogo de aitmpl.com',
        bloques: [
          {
            t: 'p',
            texto: '**aitmpl.com** (Claude Code Templates) es un catálogo comunitario —de Daniel Ávila, no de Anthropic— con unos 600 "agentes" para Claude Code, más comandos, hooks, MCPs y settings. Se evaluó el 7/8/2026 y quedó anotado acá para decidirlo con la cabeza fría.',
          },
          {
            t: 'p',
            texto: '**Qué es un agente, en concreto.** Un archivo Markdown con tres líneas de frontmatter YAML (`name`, `description`, `tools`) y abajo un prompt largo con la especialidad y el criterio de ese rol. Nada más. El mecanismo de subagentes es de Claude Code, no del sitio: el catálogo solo ahorra escribir el prompt. Se instala con `npx claude-code-templates@latest --agent <categoría>/<nombre>`, que deja el `.md` en `.claude/agents/` del proyecto.',
          },
          {
            t: 'tabla',
            cols: ['A favor', 'En contra'],
            filas: [
              ['**Cada subagente corre en su propia ventana de contexto**: puede leer veinte archivos y devolver solo la conclusión, sin llenar el contexto de la conversación principal. Es la ventaja real y no depende del catálogo.', '**Arranca en blanco**: no ve la conversación ni lo que se viene construyendo. No sabe nada del negocio salvo lo que se le pase.'],
              ['**Sirve para paralelizar**: varias búsquedas o revisiones independientes a la vez.', '**Los agentes del catálogo traen opiniones ajenas.** El `frontend-developer` dice cosas como "no recomiendes `useMemo` manual" o "apuntá a 85% de cobertura": razonables en general, ajenas acá. Un agente con opiniones que contradicen al proyecto es **peor que ninguno**, porque las aplica con seguridad.'],
              ['El formato es trivial de escribir a mano, así que el catálogo sirve igual como **referencia de estructura**.', '**Es código de terceros que se ejecuta como instrucciones.** El frontmatter declara qué herramientas se otorga: uno con `Bash` corre comandos. El repo es popular y de autor conocido, pero la práctica sana es la de cualquier dependencia: **leer el `.md` antes de usarlo**, sobre todo la línea `tools`. Son 100-200 líneas.'],
              ['', '**`.claude/agents/` es POR PROYECTO**, y acá hay tres carpetas separadas (crm-dashboard, crm-api, sitio-web). Un agente puesto en una no existe en las otras: o van en `~/.claude/agents/` (siguen a todos los proyectos) o se duplican.'],
            ],
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: '**Un agente NO reemplaza a esta guía ni a `CLAUDE.md`.** Un subagente arranca sin contexto, así que el criterio que viva solo dentro de un agente **se pierde** cuando el trabajo se hace directo. La regla es: **el criterio va en `CLAUDE.md` y en esta guía; el agente sirve para paralelizar o aislar trabajo.**',
          },
          {
            t: 'p',
            texto: '**Recomendación: no instalar el catálogo.** Escribir dos o tres agentes propios —el formato es trivial— usando los del sitio como referencia de estructura pero con el criterio de ESTE proyecto adentro, y guardarlos en `~/.claude/agents/` para que sirvan en los tres repos. Dónde se le vio valor real:',
          },
          {
            t: 'lista',
            items: [
              '**Un revisor con las trampas de acá**: que `_cleanComprobante` se traga los campos nuevos sin avisar, que un `sql` correlacionado de Drizzle renderiza la columna sin calificar y se rompe en silencio, que un borrador mueve stock, que un precio mal calculado se vende 200 veces antes de que alguien lo note.',
              '**Un buscador de lecturas amplias**: "¿en qué otros lugares se calcula `total − pagado` sin mirar las notas?" — exactamente lo que faltó cuando se ataron las NC/ND, y que se encontró de casualidad.',
              '**Quizá uno de esquema y migraciones** que conozca el ritual de `drizzle/00NN_*.sql` + entrada en el journal + snapshot copiado.',
              '**NO los genéricos de framework** (`frontend-developer`, `backend-architect`): este proyecto ya tiene convenciones propias y bastante peleadas, y un prompt genérico empuja contra ellas.',
            ],
          },
          {
            t: 'p',
            texto: 'Si igual se quiere probar el catálogo, el movimiento de menor riesgo es instalar **uno solo** en crm-dashboard, leer el archivo completo, y usarlo en una tarea real de bajo riesgo antes de decidir.',
          },
          {
            t: 'p',
            texto: '**Hecho el 7/8/2026: dos agentes propios, ninguno del catálogo.** Viven en `~/.claude/agents/`, así que sirven en los tres repos. Los dos escriben **un informe en español** con `archivo:línea` y tienen prohibido reportar sin poder señalar la línea, para que no devuelvan una pared de riesgos plausibles.',
          },
          {
            t: 'tabla',
            cols: ['Agente', 'Qué hace', 'Qué sabe de acá'],
            filas: [
              ['**auditor-seguridad** — solo lectura (`Read, Grep, Glob, Bash`)', 'Informe de vulnerabilidades ordenado por severidad, cada una con **cómo se explota** concreto (el request, el campo, el valor) más dos secciones que casi nunca aparecen en un informe automático: **"Para mirar"** (sospechas sin probar) y **"Revisado y está bien"**, que le da un piso de confianza y evita re-auditar lo mismo cada vez. Usarlo antes de un deploy y después de agregar endpoints.', 'Que **la falta de autenticación ya está asumida** y va en una línea arriba, no como descubrimiento — lo que le toca es ver si algo **empeoró**. Que solo los 4 endpoints de tienda pueden ser públicos. Que `trust proxy` es correcto **solo** si Node escucha en localhost. Que un chequeo que vive solo en el frontend **no es un chequeo**. Que Vite mete todo `VITE_*` en el código fuente de la página. Que un `@Body() dto: any` anula el `whitelist` del ValidationPipe. Que el `sql.raw` de `catalogos.module.ts` **está bien** (los nombres de tabla salen de un mapa fijo) y no hay que reportarlo.'],
              ['**depurador-codigo** — puede editar (`Read, Grep, Glob, Bash, Edit`)', 'Busca código muerto, peso al aire y cuellos de botella. Clasifica en **Seguro** / **Requiere criterio** / **No tocar (y por qué)** — esta última es la sección más valiosa, porque evita que la próxima limpieza rompa lo mismo. **Siempre muestra el informe primero**; solo aplica cambios si se le pide explícitamente, solo los "Seguro", y después compila.', 'La trampa de los **registros por string**: los paneles y modales se registran por clave de texto, así que buscar el identificador da cero usos y el archivo parece muerto estando en producción — tiene que grepear identificador, nombre de archivo Y clave. La trampa inversa de las **listas explícitas incompletas** (`_cleanComprobante` se traga los campos nuevos sin avisar: eso es un bug abierto, no basura). Que las **subqueries correlacionadas de Drizzle** fallan en silencio. Que el peso real está en las columnas base64 (`factura_archivos`, `gasto_adjuntos`, `web_imagenes`) colándose en un listado, y en los `bootstrap()` que engordan.'],
            ],
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: '**Al depurador se le prohibió explícitamente**: tocar la carpeta `crm-api/drizzle/` (son migraciones aplicadas más el journal y los snapshots: el historial que reconstruye la base, no archivos viejos), **borrar comentarios explicativos** (este proyecto comenta el *por qué* y esos comentarios son la única copia de lecciones que costaron caro), reformatear, actualizar dependencias, tocar el contenido de esta guía, y simplificar matemática de plata. Unificar helpers duplicados (`r2`, `money`) va en "Requiere criterio", nunca en "Seguro": es un cambio de diseño, no una limpieza.',
          },
          { t: 'ruta', texto: '~/.claude/agents/auditor-seguridad.md · ~/.claude/agents/depurador-codigo.md · aitmpl.com/agents · github.com/davila7/claude-code-templates' },
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
        actualizado: '2026-08-08 03:00',
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
              ['**10/8/2026**', '**El producto que ya no se trae se DA DE BAJA, no se borra — y volver es un clic.** El producto era la única entidad importante que no cumplía el principio del sistema ("lo que está en uso se desactiva, no se borra"): solo tenía Eliminar, y era borrado real. Ahora tiene ciclo de vida con **dos decisiones distintas**: *discontinuado* (no se compra más pero **se sigue vendiendo hasta agotar** — el caso común cuando el proveedor lo baja) y *archivado* (fuera de catálogo, exige que no quede stock; si queda, dice cuánto y dónde y ofrece dejarlo discontinuado). **Reactivar conserva todo**: códigos, historial de precios, presentaciones, formatos de compra por proveedor — y avisa la fecha del último costo, porque el precio de venta se calcula con ese número hasta la primera compra nueva. Los filtros se aplicaron en TODOS los puntos: POS y tienda no listan archivados; compras y reposición por stock mínimo no ofrecen lo dado de baja; pedidos de cafetería y control de vencimientos tampoco. Y los candados viven en la API, no solo en la pantalla (la venta rechaza lo archivado incluso en un borrador viejo, porque el catálogo del POS se cachea al abrir la caja). **Eliminar** quedó como excepción: solo sin ninguna huella, y cuando no se puede dice **cuál es la huella** en vez del error crudo de la base. Además, tres claves foráneas dejaron de ser `cascade`: borrar un producto ya no puede hacer desaparecer existencias ni mutilar remitos e incidencias viejas. Migración 0051, verificado con **23 pruebas de API** (el discontinuado se vende y no se compra, el archivado no entra a ningún lado, archivar con stock se frena, reactivar vuelve entero, la FK bloquea el DELETE directo, el importador no revive nada) más el circuito en pantalla. Guía nueva: Stock e inventario › "El producto que ya no se trae"'],
              ['**10/8/2026**', '**Escanear el paquete con la cámara del celular, y el Control en el orden real del acto.** El formulario de Control se reordenó como se trabaja de verdad: **1· el producto** (📷 cámara, lector USB o buscándolo) → **2· la fecha impresa** → **3· cuántos**. El producto queda a la vista con su código y fecha/cantidad se conservan al agregar: la tanda que vence igual se anota escaneando y apretando Agregar. El botón de cámara usa la API nativa del navegador cuando está (Chrome de Android) y si no baja **ZXing por import dinámico** — 450 KB que se descargan solo al abrir la cámara, el arranque de la app no cambia. Lee EAN-13/EAN-8/UPC/Code-128/Code-39/ITF, con bip y vibración al leer, un frame cada ~120 ms y la cámara apagada al primer acierto. **Aviso importante**: los navegadores solo dan la cámara en HTTPS o localhost, así que para usarla desde el celular en la red local hay que levantar el front con `npm run dev:https` (nuevo, imprime la dirección a la que entrar); en producción con dominio HTTPS no hace falta nada, y el lector USB anda siempre. El decodificador se verificó de verdad: cuatro EAN-13 dibujados a mano leídos correctamente (y un canvas en blanco que no inventa nada) — ahí se descubrió que `decodeFromCanvas` no existe en ZXing 0.23 y el camino correcto es `MultiFormatReader` con la luminancia del canvas'],
              ['**10/8/2026**', '**Vencimientos: la app externa se volvió módulo — el vigía de fechas vive en Almacén.** La app PHP de Hostinger se reconstruyó adentro del sistema con TODA su lógica y NADA de sus datos (arrancó de cero; el catálogo es solo el del CRM). El registro NO es stock: se anota caminando la góndola (sesión por sucursal con lector USB o buscador, fecha y cantidad primero, lista que se guarda de un saque), el costo queda **CONGELADO** al anotar, y las alertas van por rangos **EXCLUYENTES** (vencido / 0-7 / 8-15 / 16-30) calculados contra el calendario argentino, no el UTC del server. Lo por vencer arma una **oferta REAL** de Ventas (porcentaje, hasta el día del vencimiento, solo su sucursal) que aplica en caja y queda vinculada. Lo vencido se **procesa**: vendidas antes vs perdidas → pérdida REAL, con la baja de stock (movimiento «vencido») en la MISMA transacción y reclamo atómico. La **merma de siempre se mudó** a la pestaña Mermas (el modal existía huérfano, sin botón que lo abriera) y ahora congela su costo también. Reportes por sucursal/categoría/frecuentes/historial/controles, exportación CSV, globito con lo que apura, y **Fontana** dada de alta como quinta sucursal. Permiso propio `almacen.vencimientos` (dárselo a un empleado por local no le abre el resto del Almacén). Migración 0050. Verificado con **33 pruebas de API** (costo congelado, rangos, atomicidad sin stock, doble procesar, oferta vinculada con compensación, sin doble conteo de mermas, badge) + el circuito entero en pantalla + celular (375px sin desborde). Guía nueva: Stock e inventario › "Vencimientos: el vigía de fechas"'],
              ['**9/8/2026**', '**"Pedido a la distribuidora" quedó SOLO para el rol Cafetería.** Recién construida, la sección se les había otorgado también a admin y superadmin por el reflejo de siempre (sección nueva → dársela al admin, como `compras.lecturas` en su momento). Estaba mal: esa pantalla es el café pidiéndole mercadería a la distribuidora, y tenerla en el menú de Almacén invitaba a que administración cargue un pedido que nadie pidió. La **migración 0049** se la quita a todo rol que no sea `cafeteria`; el candado no es cosmético (entrar por URL cae en la primera sección permitida). Administración no pierde nada: para mandar mercadería **sin pedido detrás** está "+ Nuevo envío" en Almacén › Cafetería (el envío nace con `pedidoId` en null), y la bandeja de pedidos con Tomar, Convertir y Anular sigue en su lugar. La clave sigue en el catálogo de Gerencia › Usuarios y roles, ahora listada como "SOLO para el rol Cafetería" — es la que arma ese rol'],
              ['**9/8/2026**', '**La cafetería ahora PIDE — rol nuevo con una sola pantalla y aviso al admin.** El circuito que faltaba del lado de la demanda: el usuario **Cafetería** (rol nuevo, migración 0048, contraseña inicial 1234 — cambiarla) entra al CRM y ve UNA sección: armar el pedido contra el catálogo completo **con disponibilidad a la vista** (la razón de que el pedido nazca acá y no en coffit, que solo conoce lo ya mandado). El pedido es demanda pura — sin stock, sin costo — con ciclo pendiente → armando → enviado · anulado. Al admin le llega **el aviso flotante con campanita** ("☕ La cafetería armó un pedido", más grave que la de órdenes web para distinguirla de oído) + globito en el menú + pestaña **Pedidos** primera en Almacén › Cafetería. **Convertir en envío** precarga lo pedido, se corrige a lo que va de verdad, y el pedido queda cerrado con reclamo atómico; el envío viaja con `pedidoId` en el sync para que coffit cruce pedido y entrega, y el estado vuelve a la pantalla del café con el código del envío. Verificado con 20 pruebas de API + el circuito entero en pantalla con el usuario real: login Cafetería → pedido con teclado → campanita sonando en la pestaña del admin → Tomar → Convertir (precargado) → "CAF0015 cumple PCAF0003" → la cafetería ve Enviado · CAF0015. Guía nueva: Cafetería › "El pedido de la cafetería"'],
              ['**9/8/2026**', '**El fraccionado tiene pantalla propia — y la madre dice la verdad total.** Con la lógica que definió el dueño: el Ajo X500G muestra sus paquetes; la madre muestra "suelto + fraccionado = TOTAL equivalente en kg" (77,04 + 8 = 85,04 en las Lentejas de prueba), que es la respuesta a "¿cuánto hay?". Cada fraccionado es **fila propia** en Compras › Productos (↳ debajo de su madre, buscable por el código de barras de su etiqueta) y su pantalla tiene **Resumen** (stock real, movimientos propios, formato de venta por lista, costo derivado de solo lectura) y **"Producto madre"** — el Prod.Util del sistema viejo: de qué descuenta, cuánto consume, costo lista y costo con recargo. Nuevo tilde **"Solo para fraccionar"** (el "SOLO STOCK"): la pimienta de Jamaica llega 1 kg y se fracciona entera — el POS no la ofrece suelta y la venta la rechaza hasta en borrador. **Bug grave corregido de paso**: guardar la pestaña Presentaciones hacía borrar-y-reinsertar y el stock de TODOS los fraccionados se borraba en silencio en cada guardado (cascadea por presentacionId); ahora actualiza por id, y borrar una presentación CON stock se rechaza. Migración 0047. Verificado con 14 pruebas de API + el circuito entero en pantalla. Guía nueva: Stock e inventario › "El fraccionado tiene pantalla propia"'],
              ['**9/8/2026**', '**Cafetería, modelo nuevo: coffit clasifica, el CRM envía — y los envíos se pueden corregir.** Tres cosas se fueron por decisión del dueño: el **destino por renglón** (venta/uso es una decisión de coffit, que ahora recibe todo en su almacén “Sabor y Aroma" y clasifica ahí; el CRM lo pedía, lo guardaba y jamás lo leía), las **etapas** (pedido→tránsito→recibido: el envío nace ENVIADO, egresa stock y congela costo en el acto) y las **devoluciones** (la corrección es EDITAR el envío: revierte-y-reaplica en una transacción, el renglón que ya estaba conserva su costo congelado y el nuevo entra al costo de hoy; si el stock no alcanza, no pasa nada ni a medias). Cada cambio sube la **versión** y toca `actualizadoEn` — el pulso de **GET /cafeteria/sync**, el endpoint con cursor para que coffit sincronice creados, editados y anulados (contrato completo con ejemplos en `crm-api/docs/contrato-coffit.md`). Cada renglón viaja con el **modo de unidad explícito** (granel/paquete/unidad + equivalente en kg: la trampa de 10 paquetes leídos como 10 kg quedó cerrada) y la clave estable para el matcheo es `productoId`+`presentacionId`, no el nombre. Pestaña nueva **Métrica** en el panel: lo enviado por artículo con filtros, agregado en SQL. Migración 0046 (recrea el enum de estado: Postgres no quita valores). Verificado con **27 pruebas** de API (incluida la del costo congelado: el catálogo subió 50% y el renglón no se movió) más el ciclo entero en pantalla con teclado real: alta v1 → edición v2 → métrica → anulación v3, stock restaurado exacto'],
              ['**8/8/2026**', '**El mapeo de artículos del proveedor se aprende solo.** La lectura del PDF ahora reconoce el producto en **tres niveles**: mapeo aprendido (el código del artículo en la factura → nuestro producto, guardado la última vez que una persona confirmó), código del catálogo (el del formato de compra, que vino del sistema viejo con corrimientos), y parecido de nombres solo para el arranque en frío. Lo que no reconoce muestra un selector **"Asociar con un producto…"**: el admin elige, el renglón se agrega, y **al guardar queda aprendido** — la próxima factura lo reconoce sola; si se cancela no se aprende nada, y una asociación equivocada se corrige en la factura siguiente (el guardado la pisa). Con la factura real de Bavosi el nivel catálogo subió el reconocimiento de 8 a **10 de 12** y además corrigió dos propuestas dudosas del parecido. Tabla nueva `proveedor_articulos` (migración 0045), campos `codigoProveedor`/`descripcionPapel` en el ítem del alta (agregados también a la lista de `_cleanComprobante`, la que se traga campos). Verificado con 14 pruebas del ciclo entero: frío → asociar → guardar → reconoce → corregir → pisa; y en pantalla, que cerrar sin guardar no aprende'],
              ['**8/8/2026**', '**Los renglones de un PDF digital ya se leen solos** — la etapa que estaba EN ESPERA, resuelta para la mitad barata sin modelo de visión, sin clave y sin costo: el PDF trae el texto adentro con su posición, se reconstruye por línea y una **receta por proveedor** lo interpreta (la primera: Bavosi, formato Tango). En el paso 2 del alta, si el papel es PDF, aparece **"Leer renglones del PDF"**: llena los renglones (con producto propuesto por similitud — lo que no reconoce queda listado para agregar a mano), la bonificación, tilda las percepciones configuradas y ofrece **el encabezado completo** con un botón — número, fecha, CAE y vencimiento también son texto, así que completa lo que el QR no pudo. Probado con la factura REAL de Bavosi que está en la bandeja: **12 de 12 renglones, el pie al centavo y el total cierra contra la lectura** (22 verificaciones de API + prueba en pantalla; la sonda previa validó la técnica y encontró dos trampas del texto de Tango: números partidos con espacios y el pie de la primera página sin importes). Las **fotos** siguen EN ESPERA (visión). Ficha actualizada: Pendientes › "Leer los renglones de la factura"'],
              ['**8/8/2026**', '**El auditor encontró que la liquidación NO ingresaba stock desde la pantalla, y quedó arreglado.** Las seis listas de tipos del backend estaban completas, pero había **cinco más en el frontend** que no se tocaron: sin la liquidación en `permiteRecepcion`, el tilde de recepción **no se dibujaba** y el alta mandaba siempre `recepcion: false`, así que la mitad no facturada generaba la deuda y **la mercadería no entraba al depósito** — en silencio, y justo el caso que motivó el tipo nuevo. Las otras cuatro dejaban su deuda invisible: no la contaba el saldo del proveedor, no figuraba como movimiento en su ficha, el alta no ofrecía el paso de pago y el detalle no tenía botón Pagar. **La lección: las 16 pruebas fueron contra la API, mandando `recepcion: true` a mano, así que el camino de la pantalla nunca se ejerció.** De paso se corrigió que `cuentaProveedor` del frontend filtraba por `condicionPago`, criterio que el backend ya había abandonado (una factura "contado" sin pago desaparecía del saldo). Y tres más del informe: una liquidación **ya no guarda CAE** (se podía cargar el papel de una factura A real como liquidación y quedaba un no fiscal con número de ARCA, perdiendo el crédito fiscal), en el libro de Operaciones ahora dice **"Liq"** y no "FC" (aparecía idéntica a una factura), y `desimputar` **le faltaba el candado del documento** aunque el comentario de al lado afirmaba que las tres funciones bloqueaban las dos filas. Verificado con 9 pruebas nuevas'],
              ['**8/8/2026**', '**Liquidación: ya se puede cargar la mitad que el proveedor entrega sin factura.** Antes no había forma: el **remito** entraba la mercadería pero **no registraba la deuda**, y cargarla como factura **inflaba el IVA computado**. El tipo nuevo suma stock y suma deuda **sin ser fiscal** — letra X fija, sin IVA, sin percepciones, sin CAE. Las dos mitades caen en la **misma cuenta corriente** y las dos aparecen en la bandeja de pago, así que al proveedor se le paga junto; Facturación muestra un indicador **"Sin factura"** aparte del "Total facturado", que es el que se compara contra el libro de IVA. **Es un tipo propio y no una factura con letra X ni un tilde de "no fiscal"** porque lo que importa es qué pasa cuando alguien se olvida: con un tipo aparte toda consulta que pide "facturas" la excluye sola; con una letra o un tilde, todo la incluye por defecto y el olvido infla el IVA. Tiene **permiso propio** (`liquidaciones`), separado del de cargar facturas, solo para admin y superadmin — sin él el tipo no está en el alta, no está en el filtro y las liquidaciones no se listan. Probado con **16 verificaciones** contra la API (las dos mitades del mismo remito: stock +20, deuda +$22.100, el IVA de la liquidación forzado a 0 incluso mandándole 21%, y la NC rechazada contra ella) más el candado del permiso revocado y restaurado en pantalla. Guía nueva: Formato de Compra › "Liquidación"'],
              ['**8/8/2026**', '**En preparación, cada encargado ve solo su lista.** El fraccionador abre el pedido y ve **Fraccionados**; el preparador, **Enteros**. La lista del otro no le sirve y lo obligaba a buscar sus renglones entre los ajenos. Quien tenga los dos permisos —o sea admin— sigue viendo las dos, porque necesita el pedido completo para despachar, y un supervisor que no pueda tocar ninguna las ve en lectura (esconderle todo dejaba el modal vacío). Si el pedido no trae nada de tu lado, ahora lo dice con palabras en vez de mostrar una tabla vacía. **La división ya existía en el modelo** (`enterosListo` / `granelListo` y el reparto por tipo de producto): lo único que faltaba era el filtro de visibilidad. **Es una comodidad de pantalla, no un candado**: la API no valida quién confirma qué lista y no va a poder hasta que haya sesiones con token'],
              ['**8/8/2026**', '**Pantalla propia del fraccionado: diseñada y EN ESPERA.** Se anotó a partir de cómo lo resuelve el sistema viejo, que le da a cada fraccionado su propio producto y una pestaña "Prod.Util" con la madre de la que descuenta. Acá sería una pestaña **nueva** llamada **"Producto madre"** (no hay ninguna "Prod.Util" que renombrar) más pantalla propia para el fraccionado. **El modelo ya lo soporta entero** —`tamKg`, `recargo`, `opFraccionar`, y `stock`/`movimientos` ya llevan `presentacionId`, así que el x500g ya tiene stock, movimientos, código y precio propios— o sea que **es una vista que falta, no una migración**. Quedaron anotadas las cuatro decisiones previas (el stock queda a la vista en dos lugares y hay que evitar que se cuente mal; el costo del fraccionado tiene que ser de solo lectura o se repite la divergencia de Bavosi; si el fraccionado es fila propia el listado pasa de 94 a 167; y borrar una presentación hoy borra su stock sin avisar) y una pregunta abierta: falta el equivalente al "SOLO STOCK" del sistema viejo para el granel que no se vende suelto. Ficha: Pendientes › "Pantalla propia del fraccionado"'],
              ['**8/8/2026**', '**Aplicado el resto de los dos informes: 8 arreglos de seguridad y 6 de limpieza, en cinco módulos.** El más importante no estaba en el informe original y apareció al buscar la carrera del saldo en los otros módulos: **el cierre de caja podía dejar plata afuera del arqueo**. Sumar el arqueo y marcar el turno cerrado eran dos pasos sueltos, y entre uno y otro entraba un egreso —un pago a proveedor de esa caja, o un movimiento manual— que quedaba **dentro de un turno cerrado pero fuera de `sistemaEfectivo`**, con la diferencia mal y congelada en la fila para siempre. También **Cobranzas tenía la carrera igual que Pagos** (dos cobranzas simultáneas cobraban de más la misma venta) y **Comprobantes no tenía nada** (su caso es una etiqueta derivada, y el stock ya usaba el `cantidad = cantidad + delta` atómico). Además: el **mime de los archivos subidos ahora se verifica contra los bytes reales** (un HTML rotulado como PNG se rechaza) y se sirven con `nosniff`; los tres endpoints de pagos que recibían `any` tienen DTO (el `?desde=abc` que tiraba 500 ahora es un 400); topes de páginas y total no negativo en la bandeja; y el `desde` del filtro de pagos parseaba la fecha como UTC mientras el `hasta` la parseaba local, o sea tres horas del día anterior colándose. De limpieza: la etiqueta del documento vive en UN lugar (`common/documentos`, no en `comprobantes`, porque `comprobantes` ya importa de `pagos` y se hacía un ciclo) así que **se dejó de ver `nota_debito 0001-123` en pantalla**; índice de `ref_comprobante_id` (con el snapshot de Drizzle corregido, que se había quedado sin el único de número); import muerto y campo que nadie leía, afuera. Verificado con **45 pruebas** contra la API y la base restaurada en las tres corridas'],
              ['**8/8/2026**', '**Auditoría de seguridad de Facturas y Pagos: 11 hallazgos, tres arreglados.** (1) **La guarda que impide sobre-imputar un pago se podía pasar dos veces** — dos pedidos simultáneos leían los dos el mismo saldo y las dos imputaciones entraban. Demostrado con dos conexiones: $1.000 imputados a un pago de $500. Se puso `FOR UPDATE` en las cinco lecturas de saldo (`aplicar`, `desimputar`, `anular`), con orden de bloqueo fijo pago → documento. Ficha: Decisiones de diseño › "Saldos y dos pedidos a la vez". (2) **La sucursal del pago la decidía el pedido, no el turno de caja**: se le podía cargar un egreso al cajón de cualquier sucursal con turno abierto, y ahora la discrepancia se rechaza en vez de resolverse sola (falta la otra mitad, que el turno sea de QUIEN pide, y eso necesita autenticación). (3) **Un papel se podía enganchar al comprobante de otro proveedor**: la lectura salía de la bandeja marcada como cargada sin haberse cargado nunca, y el respaldo de un comprobante pasaba a ser la factura de otra empresa. Los otros 8 quedaron anotados en "Cosas a revisar". Verificado con 11 pruebas contra la API y la base restaurada al estado previo'],
              ['**7/8/2026**', '**Dos agentes propios escritos**, ninguno del catálogo: **auditor-seguridad** (informe de vulnerabilidades por severidad, con cómo se explota cada una; solo lectura) y **depurador-codigo** (código muerto, peso al aire y cuellos de botella, clasificado en Seguro / Requiere criterio / **No tocar y por qué**; muestra el informe antes de tocar nada). Viven en `~/.claude/agents/` para que sirvan en los tres repos. Lo que los hace útiles no es el rol sino **las trampas de acá metidas adentro**: que la falta de autenticación ya está asumida y no es un descubrimiento, que un chequeo que vive solo en el frontend no es un chequeo, que los paneles se registran por clave de texto (así que "0 usos" no prueba que esté muerto), que `_cleanComprobante` se traga los campos nuevos, y que las migraciones de `drizzle/` y los comentarios explicativos no se tocan. Detalle en Decisiones de diseño › "Agentes del catálogo de aitmpl.com"'],
              ['**7/8/2026**', '**Evaluado el catálogo de agentes de aitmpl.com** (Claude Code Templates). Un agente de ahí es un archivo `.md` con tres líneas de frontmatter y un prompt: el mecanismo de subagentes es de Claude Code, el catálogo solo ahorra escribirlo. **Recomendación: no instalar el catálogo** y escribir dos o tres propios con el criterio de este proyecto, en `~/.claude/agents/` para que sirvan en los tres repos — los genéricos de framework traen opiniones ajenas y las aplican con seguridad. Pros, contras y las advertencias (es código de terceros que se ejecuta como instrucciones; `.claude/agents/` es por proyecto; un agente no reemplaza a CLAUDE.md porque arranca sin contexto) quedaron en Decisiones de diseño › "Agentes del catálogo de aitmpl.com"'],
              ['**7/8/2026**', '**Las notas de crédito y de débito ahora se toman de una factura.** El paso 3 del alta lista las facturas del proveedor con su saldo y muestra en cuánto queda al elegirla: la NC resta, la ND suma. **Arregla que se le pagaba de más al proveedor**: el campo de la referencia existía en la base pero ninguna pantalla lo cargaba, así que una NC restaba de la deuda TOTAL —la cuenta corriente cerraba bien— pero la factura seguía ofreciendo su importe entero en la bandeja de pago. Probado: una NC de $38.675 sobre una factura de $41.934,75 dejó la bandeja ofreciendo $3.259,75 en lugar de $41.934,75. Además la ND referenciada ya no se puede pagar por separado (sería cobrar dos veces el mismo ajuste) y el detalle de la factura muestra la tabla de sus notas. Guía nueva: Formato de Compra › "Notas de crédito y de débito"'],
              ['**7/8/2026**', '**Lectura automática de los renglones: diseñada y EN ESPERA.** Es la etapa que le falta a la bandeja. Quedó documentada entera —el circuito, qué se le pide al modelo y sobre todo **qué no** (ni el encabezado, ni identificar el producto, ni sumar: solo copiar la tabla), el control contra el total del QR con reintento escalando de modelo, el costo (~US$3 por 50 facturas al mes) y lo que no arregla— pero **no está construido**: espera una decisión que no es técnica (**la imagen de la factura sale de la máquina**) más una clave de API, y que se resuelvan antes los renglones que no son mercadería. Ficha: Pendientes › "Leer los renglones de la factura"'],
              ['**7/8/2026**', '**Facturas por procesar: subir el papel ahora y cargarlo después** (Compras › Por procesar, permiso `compras.lecturas`). La cajera fotografía la factura cuando llega el camión y el admin la procesa cuando puede — ese desacople es la mayor parte del ahorro, y no depende de ninguna magia. Lo que sí ahorra tipeo es el **QR de la RG 4892**: es un JSON, no una imagen para interpretar, y de ahí salen proveedor (por CUIT, exacto), tipo, letra, punto de venta, número, fecha, **total** y CAE. El total del papel se usa como **control**: el pie del alta compara en vivo y avisa si cierra o cuánto falta. El papel queda guardado y pegado al comprobante. Semáforo en la bandeja: rojo frena (falta proveedor / número / sucursal, o ya está cargada), amarillo avisa. **Lo que NO hace todavía**: leer los renglones — eso es la etapa siguiente. Guía nueva: Formato de Compra › "Facturas por procesar"'],
              ['**7/8/2026**', '**Tres agujeros que la bandeja destapó y quedaron tapados.** (1) `comprobantes` **no tenía índice único de número** (Ventas y Cobranzas sí): con carga manual no molestaba, con papeles entrando del celular el duplicado era cuestión de tiempo — y entraba dos veces al stock y a la deuda. (2) El **punto de venta se normaliza a cuatro dígitos** en las dos puertas: el papel imprime "00115" y el QR trae "115", así que antes eran dos puntos de venta distintos y el control de duplicados no los cruzaba. (3) Una **nota de crédito con recepción ahora descuenta stock**: la deuda ya se ajustaba pero la mercadería devuelta quedaba en el depósito. No se hizo automático por tipo porque una NC no siempre es devolución (también ajusta un precio mal facturado): lo decide el tilde de recepción'],
              ['**7/8/2026**', '**El pie de la factura de compra: bonificación y percepciones.** Faltaban las dos y el total del sistema no cerraba con el del proveedor. Ahora el paso 2 replica el papel (subtotal → bonificación → neto → IVA → percepciones → TOTAL), el IVA se calcula sobre el neto ya bonificado y renglón por renglón (para que cierre con dos alícuotas), y las **percepciones se configuran por proveedor** (nueva pestaña en su ficha) y se **tildan** al cargar la factura porque no siempre vienen. Probado contra una factura real de Bavosi: el pie coincide al centavo salvo 1 centavo del redondeo que el proveedor hace por renglón'],
              ['**7/8/2026**', '**Botón "Importar catálogo"** en Compras › Productos: el alta masiva de un proveedor ahora se hace desde el sistema, sin pedirla. Tres pasos —archivos, proveedor y listas, **vista previa**— y la escritura es **una sola transacción** (todo o nada) e **idempotente** por código interno. Traduce lo mismo que la primera importación a mano: los fraccionados entran como presentaciones, el costo sale del formato de compra (el del maestro trae IVA adentro), el markup por paquete se convierte en recargo y el rubro se deduce del nombre. La vista previa es obligatoria y separa los cambios de precio chicos de los **grandes**, que son los que delatan un costo podrido en el archivo. Guía nueva: Formato de Compra › "Importar el catálogo de un proveedor"'],
              ['**7/8/2026**', '**Catálogo de Bavosi importado**: 94 productos (50 a granel + 44 envasados), 73 presentaciones, 94 formatos de compra con sus descuentos en cascada y flete, y 157 formatos de venta (Mostrador y Mayorista). 131 de los 157 precios quedaron **exactos** a los del sistema viejo; **26 se movieron** porque manda el costo real. **24 de esos 26 hay que revisarlos contra la factura** (ver "Cosas a revisar"): en el sistema viejo el costo de la madre y el del fraccionado no coincidían. Script: `crm-api/scripts/importar-bavosi.js` (dry-run por defecto, idempotente por código interno)'],
              ['**7/8/2026**', '**Bug corregido en la pestaña Presentaciones**: la pantalla leía y guardaba `ganancia` cuando el campo es `recargo`, así que mostraba el recargo vacío y **al guardar lo ponía en cero y borraba los códigos de barras** de cada presentación. No se notaba porque hasta ahora todos los recargos eran 0; apareció al importar Bavosi, que los usa. Ahora además el código de barras se edita ahí mismo y el precio que muestra es el que cobra la caja (con IVA)'],
              ['**7/8/2026**', '**El chat se borra a las 24 horas**: es conversación, no archivo. Las consultas filtran por el corte (el límite es exacto siempre) y una purga borra de verdad (la tabla no crece); el panel avisa la regla y descarta con el mismo criterio. Verificado con mensajes de 25 h y 23 h inyectados en la base: el de 25 desapareció de la vista Y de la tabla, el de 23 quedó'],
              ['**6/8/2026**', '**Info de sistema se puede ordenar por última modificación** (Orden › Reciente): cada tema muestra su fecha, el índice se reordena y salta a lo más nuevo. Las fechas salieron de los commits del repo; el campo admite hora para desempatar dentro del mismo día'],
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
        actualizado: '2026-08-07 19:40',
        titulo: 'Lo próximo',
        bloques: [
          {
            t: 'tabla',
            cols: ['Qué', 'Por qué importa'],
            filas: [
              ['**Leer los RENGLONES de la factura — la mitad ya está**', '**PDFs digitales: HECHO** (8/8/2026, botón "Leer renglones del PDF" en el paso 2 del alta, receta Bavosi/Tango, gratis y local). Lo que queda EN ESPERA son las **fotos**, que no tienen texto adentro: para esas sigue vigente el modelo de visión, con la misma decisión pendiente del dueño (la imagen sale de la máquina) pero menos volumen y menos costo. Y sumar **recetas de otros proveedores** a medida que lleguen sus PDFs. Ficha: Pendientes › "Leer los renglones de la factura"'],
              ['**Renglones que NO son mercadería** (flete, envases retornables, redondeo)', 'Las facturas los traen y hoy **no se pueden guardar**: `comprobante_items.productoId` es obligatorio. Sin resolverlo, cada factura con flete no cierra contra el total del papel — y es **bloqueante de la lectura automática de renglones**. Decisión de diseño pendiente: un flag de "concepto no inventariable" en el ítem (más honesto) o productos de servicio designados'],
              ['**Conciliar con "Mis Comprobantes" de ARCA**', 'ARCA deja bajar en CSV todas las facturas que cualquier proveedor emitió contra el CUIT de la empresa. Sirve para **encontrar facturas que existen y nunca se cargaron** — cada una es crédito fiscal de IVA no computado y deuda que no figura en la cuenta del proveedor. Es el mismo patrón de "subir un archivo y previsualizar" que ya está construido dos veces'],
              ['**CUIT de los proveedores y de la empresa**', 'El reconocimiento automático de la bandeja va **por CUIT**: los proveedores que no lo tengan cargado llegan sin proveedor y hay que elegirlo a mano. Y el CUIT de la empresa (Sistema › Empresa) todavía es el de prueba `30-71555666-7`: mientras siga así, **toda factura va a mostrar el aviso "no es nuestra"**, que es peor que no avisar — entrena a ignorar los avisos'],
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
        id: 'fraccionado-pantalla',
        actualizado: '2026-08-09 05:30',
        titulo: 'Pantalla propia del fraccionado — CONSTRUIDA (ver Stock e inventario)',
        bloques: [
          {
            t: 'p',
            texto: '**Se construyó el 9/8/2026** con las respuestas del dueño a las cuatro decisiones que esperaban acá (la madre cuenta la verdad total; el costo es de solo lectura; el fraccionado es fila propia; borrar con stock se frena) y al "SOLO STOCK" (el tilde "Solo para fraccionar" — la pimienta de Jamaica existe). La guía completa está en **Stock e inventario › "El fraccionado tiene pantalla propia"**.',
          },
        ],
      },
      {
        id: 'lectura-renglones',
        actualizado: '2026-08-08 07:00',
        titulo: 'Leer los renglones de la factura — PDFs digitales HECHO · fotos EN ESPERA',
        bloques: [
          {
            t: 'nota',
            tono: 'ok',
            texto: '**La mitad barata quedó construida el 8/8/2026.** Si el papel de la bandeja es un **PDF digital** (la factura electrónica que el proveedor manda por mail), los renglones **se leen del archivo** — sin modelo de visión, sin clave de API, sin costo, y el archivo no sale del sistema. En el paso 2 del alta aparece el botón **"Leer renglones del PDF"**. Lo que sigue EN ESPERA es la otra mitad: las **fotos** (no tienen texto adentro) — para esas el único camino es el modelo de visión de abajo, ahora con menos volumen y menos costo que el presupuestado.',
          },
          {
            t: 'p',
            texto: '**Cómo funciona lo construido.** El PDF trae cada fragmento de texto con su posición X/Y en la hoja: se agrupa por altura (misma línea) y se ordena de izquierda a derecha — el renglón queda reconstruido tal como se ve impreso. Después una **receta por proveedor** interpreta ese texto: dónde están los renglones, cómo viene el pie, qué mugre trae (Tango parte los números con espacios: "87, 731. 41"). La primera receta es la de **Bavosi** (formato Tango, el ERP más común del país). La propuesta llena renglones, bonificación, percepciones (se tildan solas si el proveedor las tiene configuradas) y el encabezado — que en un PDF también es texto, así que **completa lo que el QR no pudo** (número, fecha, CAE, vencimiento) con un botón "usar este encabezado".',
          },
          {
            t: 'p',
            texto: '**Los tres controles que hacen confiable la lectura**: Σ renglones tiene que dar el subtotal del papel (si falta un renglón, se delata solo); el pie tiene que cerrar consigo mismo (neto + IVA + percepciones = total); y el total leído tiene que coincidir con el de la lectura (QR o tipeado). Con la factura real de Bavosi: 12 de 12 renglones, todo al centavo. El **matcheo de productos** es el único paso con criterio (el papel dice "AVENA INSTANT FWP CUM10x400g" y el catálogo "Avena Instantanea CUMANA x400g"): propone por similitud de tokens, y lo que no reconoce queda listado para agregar a mano — **el parser propone, la persona confirma**, nunca adivina. Los renglones sin matchear suelen ser artículos nuevos del proveedor.',
          },
          {
            t: 'p',
            texto: '**El mapeo de artículos se APRENDE, y el trabajo manual es solo la primera vez.** El producto se reconoce en tres niveles, del más confiable al menos: (1) el **mapeo aprendido** — el código del artículo tal como lo imprime la factura, asociado a nuestro producto la última vez que una persona confirmó una factura; (2) el **código del catálogo** (el campo "código de proveedor" del formato de compra, que vino del sistema viejo — con corrimientos: la factura real dice 10206 donde el catálogo dice 10200); (3) el **parecido de nombres**, solo para el arranque en frío. Con la factura real de Bavosi: 8 de 12 salen por código exacto del catálogo, 1 por parecido, y quedan 2 genuinamente nuevos (salmón y mariscos, que no están en el catálogo).',
          },
          {
            t: 'p',
            texto: '**Cómo se asocia lo que no reconoce.** En el panel del PDF, cada renglón sin producto muestra un selector **"Asociar con un producto…"** con todo el catálogo: el admin elige el producto del sistema (aunque en la factura figure con otro nombre), el renglón se agrega al alta, y **al GUARDAR el comprobante el par (código → producto) queda aprendido** — la próxima factura del mismo proveedor lo reconoce sola. Si se cancela, no se aprende nada. Un mapeo mal aprendido se corrige solo: en la factura siguiente se cambia el producto del renglón y el guardado pisa el mapeo viejo. Si el artículo es realmente nuevo, primero se crea en Productos y después se asocia.',
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: '**Para agregar la receta de otro proveedor** hace falta UNA factura real suya en PDF: el botón del modal muestra el **texto extraído** aunque no haya receta, y con eso se arma (registro `RECETAS` en `crm-api/src/facturas/recetas.ts`, por CUIT del emisor). Si el proveedor también factura con Tango, la receta de Bavosi probablemente sirva casi entera. Un PDF **sin** capa de texto (escaneo, foto convertida) avisa y no propone nada: eso es una foto con otro nombre.',
          },
          {
            t: 'p',
            texto: '**Lo que sigue EN ESPERA — las fotos.** El diseño original de esta ficha era para leer la imagen con un modelo de visión, y queda vigente solo para los papeles fotografiados: la decisión sigue siendo del dueño (la imagen sale de la máquina) más una clave de API. Todo lo de abajo describe ese camino.',
          },
          {
            t: 'p',
            texto: '**Por qué hace falta un modelo de visión y no un programa.** El encabezado se resuelve leyendo un QR, que es un dato exacto. Los renglones no: solo existen dibujados en el PDF del proveedor, cada proveedor los imprime distinto, y Argentina no tiene intercambio de factura estructurada (nada como el CFDI mexicano). Hay que interpretar imagen, y eso lo hace un modelo.',
          },
          {
            t: 'lista',
            items: [
              '**El circuito**: el papel ya está guardado y el encabezado ya salió del QR (eso no cambia) → la API manda la imagen o el PDF al modelo con un esquema fijo de respuesta → vuelve un JSON con los renglones → el sistema calcula el pie y lo compara contra el total del QR → la factura aparece en la bandeja con los renglones puestos.',
              '**Corre en la API (crm-api), nunca en el navegador**: la clave de la API no puede estar en el frontend, cualquiera la vería mirando el código de la página.',
              '**Sería un interruptor, no una pieza**: sin clave configurada, la bandeja anda exactamente como hoy (papel guardado, encabezado del QR, renglones a mano). Se puede probar con veinte facturas y apagarlo si no convence.',
            ],
          },
          {
            t: 'p',
            texto: '**Lo que se le pediría, y sobre todo lo que NO.** Acá está la diferencia entre que funcione y que sea una lotería: cuanto más chico el trabajo del modelo, más confiable el resultado.',
          },
          {
            t: 'lista',
            items: [
              '**NO se le pide el encabezado.** Ya lo tenemos exacto del QR; pedírselo sería meter una posibilidad de error donde hoy no hay ninguna.',
              '**NO se le pide identificar el producto.** No se le pasa el catálogo para que elija: es justo donde un modelo inventa con más ganas — le das 900 productos y devuelve uno parecido con total seguridad. El producto lo resuelve el **código del proveedor** contra el diccionario que se va llenando (determinístico), y si no matchea es un rojo que decide una persona.',
              '**NO se le pide sumar nada.** La aritmética la hace el código, siempre. Un modelo que suma es un modelo al que hay que revisarle la suma.',
              '**SÍ se le pide una sola cosa: copiar lo que dice el papel** — por renglón: código, descripción, cantidad, unidad, precio unitario, % de descuento e importe; más las líneas del pie tal como están impresas. Transcribir, no interpretar. "Copiá esta tabla" es una tarea muchísimo más fácil y más verificable que "entendé esta factura".',
            ],
          },
          {
            t: 'nota',
            tono: 'ok',
            texto: '**El esquema no es una sugerencia.** La API tiene salida estructurada: se declara la forma exacta del JSON —qué campos, de qué tipo, cuáles obligatorios— y la respuesta está **obligada** a cumplirla. No es pedirle amablemente que devuelva JSON y después rezar. Lo que el esquema NO garantiza es que los números sean los correctos; para eso está el control del total.',
          },
          {
            t: 'p',
            texto: '**El lazo que se cierra solo.** El total del QR es la respuesta al final del libro. Si el pie calculado con los renglones leídos da ese número, la extracción está *demostrada* y la factura queda lista para confirmar. Si no da, **segundo intento con el modelo más capaz** — la primera pasada va con el barato y solo las que fallan escalan, así que el costo lo domina el camino barato. Si tampoco cierra, queda para cargar a mano con la diferencia marcada: nunca se carga nada roto en silencio.',
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: 'Lo que **no** se le pediría es que declare cuánta confianza tiene en cada renglón. Esa autoevaluación es poco confiable y da una falsa sensación de control: un renglón mal leído con "confianza alta" es peor que no tener el dato. **Vale más la prueba aritmética que la opinión del modelo sobre sí mismo.**',
          },
          {
            t: 'p',
            texto: '**El PDF se da vuelta y pasa a ser el mejor caso.** Hoy el PDF es el peor: no se le puede leer el QR y su encabezado va a mano. Para leer renglones es al revés — la API acepta PDF de forma nativa y un PDF de factura es texto vectorial, no una foto de un papel con sombras, arrugas y flash. Como muchos proveedores mandan la factura por mail en PDF, ese circuito (bajar del mail → subir → salen los renglones) sería el más confiable de todos, aunque su encabezado se siga tipeando.',
          },
          {
            t: 'tabla',
            cols: ['Modelo', 'Por factura', '50 facturas/mes'],
            filas: [
              ['Sonnet 5 (la primera pasada)', '~US$ 0,056', '**~US$ 3**'],
              ['Opus 5 (solo los reintentos)', '~US$ 0,094', '—'],
            ],
          },
          {
            t: 'p',
            texto: 'Las cuentas son sobre una factura de 40 renglones fotografiada (la de Bavosi tiene 3): la imagen a resolución completa pesa hasta ~4.800 tokens, la instrucción con el esquema ~1.500 y la respuesta con 40 renglones ~2.500, a US$3 por millón de entrada y US$15 de salida. **El costo no es el problema** — son unos pocos dólares por mes.',
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: '**La decisión real: el papel sale de la máquina.** La imagen viaja a la API del modelo — los precios de los proveedores, los CUITs, los códigos. Es el único componente de todo el sistema que manda datos afuera: el chat, el importador de catálogos, la lectura del QR y todo lo demás corren en la red local. No es una objeción, es el precio del servicio, pero la decisión es del dueño.',
          },
          {
            t: 'p',
            texto: '**Qué NO arregla, incluso funcionando perfecto:**',
          },
          {
            t: 'lista',
            items: [
              '**El bulto contra la unidad.** El modelo va a leer "4.00" y "CUM10x1kg" fielmente; decidir si son 4 cajas o 40 kg es conocimiento del negocio, no lectura. Es justo el punto ciego del control del total (la plata cierra igual), así que la guarda contra el costo histórico de la presentación sigue siendo necesaria.',
              '**El flete y los envases retornables.** El modelo transcribe el renglón sin problema; el sistema sigue sin tener dónde guardarlo. **Esto hay que resolverlo ANTES**: si no, cada factura con flete falla el cuadre por más perfecta que sea la lectura.',
              '**La compresión del papel.** Lo que se guarda hoy está comprimido a 2.200 px de lado largo, justo debajo del límite de 2.576 px de la API, así que sirve. Si algún día se baja esa compresión para ahorrar base, la letra chica de los renglones se pierde y la lectura empeora sin que nada avise.',
            ],
          },
          {
            t: 'p',
            texto: '**Qué falta para poder empezar** — dos cosas, y una es del dueño:',
          },
          {
            t: 'lista',
            items: [
              '**Decidir que el papel puede salir de la máquina**, y sacar una **clave de API de Anthropic** (console.anthropic.com, con tarjeta). Esa clave es una credencial de la cuenta del dueño y factura a su nombre: no la puede sacar nadie más.',
              '**Resolver los renglones que no son mercadería** (flete, envases retornables, redondeo). Hoy `comprobante_items` exige un producto, así que ese renglón no se puede guardar. Es una decisión de diseño de una sola vez: un flag de "concepto no inventariable" en el ítem —más honesto— o productos de servicio designados.',
              'Con esas dos, el resto es construirlo: el módulo que llama a la API, el esquema de respuesta, el reintento con escalada de modelo, y el diccionario de códigos del proveedor que aprende de cada confirmación (`producto_proveedores.codigoProveedor` ya existe y es la llave).',
            ],
          },
          { t: 'ruta', texto: 'Lo que ya funciona está en Formato de Compra › "Facturas por procesar" · esta ficha es solo el diseño de la etapa que sigue' },
        ],
      },
      {
        id: 'aflojar',
        actualizado: '2026-08-08 03:00',
        titulo: 'Cosas a revisar',
        bloques: [
          {
            t: 'lista',
            items: [
              '**El `cajaSesionId` de una cobranza lo elige el cliente.** Cobranzas guarda el turno que viene en el pedido **sin validar** que exista, que esté abierto, ni que sea de la sucursal del cobro — y el arqueo suma las cobranzas por ese id. Se puede imputar efectivo a un turno **ya cerrado** (la plata no aparece en ningún arqueo abierto) o al turno abierto de **otra sucursal** (esa cajera queda con un faltante que nunca cobró). El molde del arreglo ya está escrito al lado, en `pagos.crear`: leer la sesión con candado, exigir que esté abierta, y que la sucursal la mande el turno. **Es el hallazgo más grave que queda abierto.**',
              '**Anular una venta o una cobranza no mira si el turno de caja ya cerró.** Pagos sí tiene esa guarda ("anularlo rompería el arqueo"); ventas y cobranzas no. Anular el martes una venta en efectivo del lunes la saca del arqueo recalculado del lunes, mientras la fila cerrada sigue diciendo que se esperaban esos pesos: el turno deja de ser reproducible.',
              '**La venta lee el turno de caja sin candado.** Valida bien estado y sucursal, pero fuera de la transacción, así que una venta al contado puede entrar a un turno **después** de que el cierre calculó el arqueo. Es la misma carrera que ya se cerró para los egresos y los movimientos manuales; la ventana es chica pero cae justo en el horario de cierre, que es cuando más se cobra.',
              '**Se pueden abrir dos turnos de caja en la misma sucursal.** El chequeo de "¿ya hay uno abierto?" es un `select` suelto fuera de transacción y **no hay índice único** en la base. Con un doble clic quedan dos turnos abiertos, y desde ahí cuál es "el turno actual" queda indeterminado: las ventas se reparten entre los dos y ningún arqueo cuadra. El arreglo es un único parcial `(sucursalId) where estado = abierta`, el mismo patrón del número de comprobante.',
              '**El endpoint que confirma una lista de preparación recibe `any` y no valida el usuario.** Firma el movimiento de reserva con el `usuarioId` que venga, sin verificar que exista ni que esté activo, así que la traza de "quién apartó la mercadería" es declarativa. Un DTO con clase más la validación del usuario (como ya hace Pagos) es lo único que se puede endurecer antes de que haya sesiones con token.',
              '**El mime del archivo subido se le cree al cliente en Gastos y en la Web.** En la bandeja de facturas ya se verifica contra los bytes reales, pero los **adjuntos de gastos** (`gasto_adjuntos`) y las **imágenes del sitio** (`web_imagenes`) siguen guardando el mime que declaró el pedido y devolviéndolo tal cual, sin `nosniff` ni `Content-Disposition`. El molde a copiar está en `facturas.module.ts` (`FIRMAS` + `mimeReal`).',
              '**Un comprobante en borrador con recepción mueve stock y no genera deuda, y no hay forma de confirmarlo.** El `estado` lo elige quien llama al alta y no existe endpoint de edición, así que un borrador con mercadería adentro queda para siempre: stock cargado, deuda que no existe. Cuando se construya el endpoint de anular/editar, tiene que recalcular IVA, letra y percepciones según el tipo nuevo y volver a tocar la deuda — si se escribe como un `set(patch)` genérico, ahí nace el agujero de convertir una factura en liquidación (o al revés) con los importes viejos.',
              '**El papel de cualquier factura se baja enumerando ids** (`/api/facturas/archivos/1,2,3…`), sin verificar quién pide. Es parte del bloqueante de autenticación, pero conviene tenerlo anotado como lo que es: el archivo entero de facturas de proveedores accesible caminando números. Lo mismo con los adjuntos de gastos.',
              '**Falta helmet (o las cabeceras a mano) en toda la API.** Se agregaron `nosniff` y `Content-Disposition` donde se sirven archivos de facturas, pero el resto de las respuestas no tiene ninguna cabecera de endurecimiento. Es una línea en `main.ts` cuando se toque el deploy.',
              '**El comprobante #14 de Bavosi parece una carga de prueba y está inflando su deuda en $1.451.980,88.** Tiene la observación "primera carga de factura", punto de venta `777-555` y **sin número**, con 40 kg + 40,8 kg + 20 kg ingresados a Distribuidora. Si fue una prueba, hay que sacarlo — y para eso hace falta el endpoint de anular (ver "Lo próximo"), porque hoy la única salida es tocar la base.',
              '**El CUIT de la empresa sigue siendo el de prueba** (`30-71555666-7`, en Sistema › Empresa). La factura real de Bavosi está a nombre del CUIT `23-35678242-9`, así que la bandeja avisa "esta factura no es nuestra" en **todas** las facturas. Cargar el CUIT real apaga el falso aviso y deja el control sirviendo para lo que es: detectar la factura que el proveedor emitió a otra razón social.',
              '**La lectura del QR desde una foto no se pudo probar end-to-end acá.** El mapeo de códigos de ARCA sí está verificado (9 casos: factura A/B/C, notas de crédito y débito, FCE MiPyME, moneda extranjera, código desconocido, QR ajeno) y el circuito completo también, con la factura real de Bavosi. Lo que falta confirmar es el **decodificado de píxeles**, porque no se pudo generar un QR válido sin internet. Con la primera foto de una factura real se sabe: si el encabezado aparece solo, anda. Dato importante del camino: **`BarcodeDetector`, la API nativa del navegador, NO existe en Chrome para Windows** — por eso el lector usa `jsQR` (JavaScript puro, nada sale de la máquina) y deja la nativa solo como camino rápido en Android.',
              '**Alta masiva de formato de venta.** Cambiar markups en tanda ya está («Actualizar márgenes» sobre los filtrados, con selección por fila). Lo que falta es el ALTA masiva: habilitar una lista que el producto no tiene (tipo "poner Mayorista 1 al 30% en toda la categoría X") sin entrar producto por producto.',
              '**El código propio no se autogenera todavía.** Está el campo y la unicidad, falta el botón "crear un código" correlativo.',
              '**Alícuotas de IVA por producto sin validar contra ARCA.** Hoy es una lista cerrada nuestra; cuando entre la facturación hay que cruzarla.',
              '**Sin paginación en la evolución de precios.** Trae hasta 2.000 filas y filtra en memoria. Anda bien ahora; con años de historia va a haber que paginar del lado del servidor.',
              '**Las presentaciones no tienen su propio formato de compra.** Se compran a granel y se fraccionan, que es el caso real, pero si algún día se compra el paquete cerrado va a haber que modelarlo.',
              '**Recepción a ciegas sin configuración global.** Hoy es un botón opcional en el modal de recepción; falta la llave en configuración para hacerla obligatoria por sucursal.',
              '**Operaciones no incluye fraccionamientos ni ventas.** El libro cubre transferencias, compras recibidas y ajustes/mermas; si hace falta el resto, se suma como fuente.',
              '**Los sueldos se cargan como un gasto más.** Hay rubro ("Sueldos y cargas sociales") pero no hay legajo ni liquidación: si algún día hace falta el detalle por empleado, es un módulo aparte.',
              '**24 precios de Bavosi quedaron marcados para revisar contra la factura.** Al importar, el costo de la madre y el del fraccionado NO coincidían en el sistema viejo: uno de los dos estaba podrido. El precio nuevo sale del costo de la madre (el que tiene fecha de actualización), así que estos se movieron fuerte y conviene mirarlos antes de vender: **Harina de almendra sin piel** (+148%), **Coco en escamas** (−64%), **Pimienta negra en grano** (−53%), **Pimienta blanca en grano** (−51%), **Canela molida** (+38%), **Pimienta blanca molida** (−33%), **Dátiles Deglet** (−29%), **Semillas de zapallo** (+17%), **Almendras Carmel** (−17%), **Harina de coco** (−15%). Se corrigen solos al cargar la próxima factura de Bavosi (la carga ofrece actualizar el costo y muestra el precio que quedaría).',
              '**Castañas de cajú partidas entró con costo ESTIMADO** ($13.477/kg, copiado de Castañas de cajú): el archivo de Bavosi la traía en cero. Verificar con la factura.',
              '**Cuatro productos base se crearon en la importación** porque el archivo solo traía sus fraccionados: Lentejón, Pasas de uva sultaninas, Pistachos pelados partidos. Su costo se derivó del paquete de 1 kg y conviene confirmarlo.',
              '**El resumen de gastos no se cruza todavía con las ventas.** Muestra cuánto se gastó, no el margen del período. Ese cruce es trabajo de Gerencia › Rentabilidad.',
              '**La condición de pago del GASTO sigue siendo un selector manual.** En Compras ya se deriva del saldo (saldada = contado); en Gastos todavía puede contradecir a los importes. Unificar cuando moleste.',
              '**Los permisos `gastos.pagos_proveedor` y `compras.pagos` ahora gatean pestañas, no secciones.** Un rol que tenga SOLO ese permiso (sin `gastos.gastos` / `compras.facturacion`) no ve la bandeja: revisar los roles si se crea uno así.',
            ],
          },
        ],
      },
      {
        id: 'gastos-notas-tecnicas',
        actualizado: '2026-08-05',
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
        actualizado: '2026-08-06 20:52',
        titulo: 'Cómo se mantiene esta sección',
        bloques: [
          {
            t: 'p',
            texto: 'Al cerrar cualquier función o cambiar una regla de negocio se actualiza la sección que corresponda **y esta lista**. Documentación vieja es peor que no tener ninguna: si dice algo que ya no es cierto, alguien la va a creer.',
          },
          {
            t: 'p',
            texto: 'Cada tema lleva su **fecha de última modificación** (se ve al lado del título) y el botón **Orden › Reciente** de arriba pone lo último primero — el índice se reordena y salta a lo más nuevo. La fecha de una sección es la del tema más nuevo que tenga adentro: se deriva, no se escribe aparte, así no puede contradecir a sus temas. Tocar un tema significa actualizar su `actualizado`: si no se hace, el orden por fecha empieza a mentir.',
          },
          {
            t: 'p',
            texto: 'El campo admite `AAAA-MM-DD` y, cuando hace falta desempatar dentro del mismo día, `AAAA-MM-DD HH:MM` — sin eso, una jornada con diez secciones tocadas las deja empatadas y el orden "Reciente" pierde sentido. La hora **no se muestra** (queda en el tooltip): sirve solo para ordenar. Las fechas históricas salieron de los commits del repositorio, no de la memoria de nadie.',
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
