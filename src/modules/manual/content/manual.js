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
              ['Dashboard', 'La pantalla que abre el sistema: el **resumen del inventario** — valor disponible, productos, stock bajo y comprometido, el stock por sucursal y los últimos movimientos. Cada tarjeta tiene su "Ver todo →" que cae en la sección exacta de Compras o Almacén. Era una pestaña adentro de Compras; se mudó acá el 18/8/2026'],
              ['Compras', 'Productos, proveedores, comprobantes, catálogos, precios'],
              ['Almacén', 'Existencias, transferencias, incidencias, fraccionamiento'],
              ['Ventas', 'Punto de venta, clientes, cobranzas, caja, formato de venta, ofertas, cambios de precio'],
              ['Consultas', 'Las dos consultas globales de teclado (Alt+F5 y Alt+F3). No aparece en el menú: se monta en el layout'],
              ['Info de sistema', 'Esta documentación'],
              ['Gerencia', 'Usuarios y roles, y **Rentabilidad** (19/8/2026): el margen real del período —con el IVA absorbido por la mercadería sin factura a la vista—, la posición fiscal y el control por proveedor. Las demás secciones siguen en agenda'],
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
              '**Los paquetes fraccionados NO entran como productos.** El archivo trae "x100g / x250g / x1kg" como si fueran productos aparte, pero son **presentaciones** de su producto madre: se atan solas por el nombre, con su código de barras y su propio formato de venta. Importarlos como productos habría dejado decenas de fantasmas que nadie le compra a nadie.',
              '**El costo sale del formato de compra, no del maestro**: lista − descuentos en cascada + flete ÷ bulto. El costo del maestro del sistema viejo viene **con IVA adentro** y acá los costos se guardan netos — tomarlo de ahí metía un 21% de error en toda la góndola.',
              '**El markup por paquete entra TAL CUAL.** En el sistema viejo cada paquete tiene su markup (el kilo al 48%, el de 250 g al 66%), y desde la 0053 acá también: cada paquete tiene formato de venta propio. Hasta el 10/8/2026 eso se traducía a un  sobre la madre — una cuenta que ya no hace falta.',
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
          { t: 'ruta', texto: 'Compras › Facturación › + Nuevo comprobante · las percepciones se configuran en Compras › Costos y percepciones › (abrir uno) › Percepciones' },
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
              '**Una NC con recepción devuelve mercadería** y descuenta stock. No puede ser automático por tipo, porque una NC no siempre es devolución: también ajusta un precio mal facturado o compensa un bulto roto que igual te quedaste. **PENDIENTE:** la API lo soporta pero la pantalla no lo puede activar — el alta manda `recepcion` derivado del tipo, y para una nota eso siempre da "no". Hoy la mercadería devuelta hay que sacarla a mano por Almacén › Operaciones; falta el control propio en el paso de la nota.',
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
        id: 'sin-factura',
        actualizado: '2026-08-19',
        titulo: 'La mercadería sin factura (liquidación)',
        bloques: [
          {
            t: 'p',
            texto: 'El producto comprado en liquidación (total o parcial) **no puede trasladarle al cliente un IVA que nunca se pagó**: al facturar la venta, ese IVA lo absorbe el negocio. En el sistema viejo se resolvía descontándole a mano el 17,36% al costo (o 8,36% para el mitad y mitad). Ahora es un campo: **"Sin factura %"** en el Formato de Compra — 100 = liquidación pura, 50 = mitad y mitad — y la cuenta la hace el sistema, exacta y para cualquier alícuota.',
          },
          {
            t: 'p',
            texto: 'El costo se parte en dos, porque hay dos preguntas distintas: el **costo real** (lo que la mercadería cuesta: valúa stock, pérdidas y transferencias) y la **base del precio** (lo que multiplica el markup: a la parte sin factura se le quita el IVA que se va a absorber). La diferencia es el **IVA absorbido** — plata que sale del margen al vender, y el dato central de Gerencia › Rentabilidad.',
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: 'El % corre **solo sobre la mercadería, nunca sobre el flete** (corregido el 19/8/2026): el flete es un costo tuyo, pagado aparte a un tercero — no viene en la liquidación y no hay IVA que absorber ahí. Entra entero a la base del precio, y "Le pagás al proveedor" lo excluye (tiene su propia línea en la cadena). Con $1.000 de mercadería + 10% de flete al 100% sin factura: base = 826,45 + 100 = **$926,45**, no 909,09.',
          },
          {
            t: 'ejemplo',
            titulo: 'Compra de $100 toda en negro, IVA 21%, markup 40%',
            lineas: [
              'Costo real                  $100,00   ← lo que pagaste',
              'Base del precio              $82,64   ← ÷ 1,21 (el "17,36%" de antes)',
              'IVA absorbido                $17,36   ← lo pierde el margen al vender',
              'Le pagás al proveedor       $100,00   ← base × 1,21: la prueba',
              '',
              'Precio final (markup 40%)   $140,00   ← el cliente no paga IVA ajeno',
              'Venta neta                  $115,70',
              'Ganancia real          $15,70 (15,7%)  ← no 40: la diferencia es el IVA',
            ],
          },
          {
            t: 'p',
            texto: 'El % se **precarga desde la ficha del proveedor** ("Qué emite" + su número: liquidación pura = 100 aunque no lo tipees) y se ajusta por producto — el que manda para el costo es siempre el del formato. El mitad y mitad real (mercadería de $100: $50 en liquidación, $50 facturados con IVA) da **8,68%**: desembolsás $110,50 y la base queda en $91,32.',
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: 'El markup se sigue cargando como siempre, pero sobre estos productos **deja de ser tu ganancia**: poné 40 y ganás 15,7 real. Gerencia › Rentabilidad te muestra las dos columnas —margen aparente y real— para que esa diferencia tenga cara. Y cada venta **congela** su costo real, su IVA absorbido y el % del momento: el margen de marzo no cambia porque en julio subió el catálogo.',
          },
          { t: 'ruta', texto: 'Compras › Productos → detalle → Formato de Compra → "Sin factura %" · Proveedores › Padrón → Ficha → "Sin factura %" · Gerencia › Rentabilidad (permiso gerencia.rentabilidad)' },
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
        actualizado: '2026-08-15 05:00',
        titulo: 'Alcance y condiciones',
        bloques: [
          {
            t: 'lista',
            items: [
              '**Alcance**: producto, **paquete fraccionado**, marca, categoría o etiqueta — y se pueden mezclar; la unión habilita.',
              '**Los paquetes fraccionados no entran solos** (10/8/2026): el paquete tiene su propio precio, así que una oferta a la madre —o a su marca, categoría o etiqueta— **no lo toca** salvo que se tilde *"incluir también los paquetes fraccionados"*. Para poner en oferta UN tamaño puntual ("Lentejas 500 g"), se lo elige como **Paquete** en el buscador de alcance: eso no toca el kilo suelto ni los otros tamaños.',
              '**Vigencia**: desde/hasta, días de la semana, **sucursales** (se tildan en el formulario; todas tildadas = corre en todas).',
              '**Medio de pago**: solo la de ticket puede exigirlo ("10% pagando en efectivo"); se valida al confirmar la venta, que es cuando el medio existe.',
              '**Listas de precio** (15/8/2026): sobre cuáles corre. Se tildan igual que los días y las sucursales, y **todas tildadas = corre sobre cualquier precio**. Dejando solo la de mostrador se consigue lo de siempre —que un mayorista no reciba además la promo, o sea el doble beneficio— y además ahora se puede lo que antes era imposible: **una promo solo para Mayorista 1**.',
            ],
          },
          {
            t: 'nota',
            tono: 'info',
            texto: 'Las listas **reemplazaron a la tilde "solo sobre el precio de mostrador"** (0065). Decía lo mismo con otro vocabulario, y dos perillas que se pisan obligan a explicar cuál gana cada vez que alguien arma una oferta. Las ofertas que ya existían se convirtieron solas: las que tenían la tilde quedaron atadas a la lista base —la de mostrador— y las que no, corriendo en todas. **Se compara contra la lista con la que quedó cotizado el renglón**, no contra su origen: si alguien lo pasó a mano a esa lista, está en esa lista (antes, con el criterio viejo, un renglón puesto a mano en mostrador quedaba afuera de una promo de mostrador).',
          },
          {
            t: 'nota',
            tono: 'info',
            texto: 'Una oferta vencida figura **Vencida** sola: el estado se calcula con el reloj, nadie tiene que acordarse de apagarla. Y si ya se usó en ventas, borrar la **desactiva** — el ticket viejo la referencia.',
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: '**Esta pantalla avisa cuando una oferta está descontando mercadería que YA venció** (10/8/2026): el dato viene del vigía de fechas (Almacén › Vencimientos), y el aviso vive acá porque acá está el remedio — editar la oferta para apagarla o recortarle el alcance. La fila de esa oferta además queda marcada "⚠ mercadería vencida". Desde Vencimientos también se llega al alta con el formulario ya lleno (producto, fecha de fin y sucursal del lote); ver Stock e inventario › "Vencimientos: el vigía de fechas".',
          },
        ],
      },
      {
        id: 'resolucion',
        actualizado: '2026-08-14 22:00',
        titulo: 'Cómo resuelve la caja',
        bloques: [
          {
            t: 'flujo',
            items: ['Precio de lista resuelto', 'Combos (consumen unidades)', 'Mejor oferta por renglón', 'Descuento con nombre (si gana)', 'Sugerencia de ticket'],
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
      {
        id: 'descuentos-nombre',
        actualizado: '2026-08-15 01:00',
        titulo: 'Descuentos con nombre (la autorización escrita)',
        bloques: [
          {
            t: 'p',
            texto: 'Hasta acá un precio podía bajar por tres caminos: el descuento del **cliente** (con quién se vende), el **manual** del renglón (decisión del vendedor, acotada por el tope de Configuración) y la **oferta** (promoción del catálogo). Esto es un cuarto y no encaja en ninguno: *"Empleados 15%"*, *"Atención por tardanza 25%"*. Lo crea el dueño una vez, y en la caja se elige por su nombre — **sin tipear un número**.',
          },
          {
            t: 'p',
            texto: 'Existe porque ese porcentaje **saltea el tope del vendedor**: lo autorizó el dueño al crearlo, no la cajera al tipearlo. Sin esto, permitir un 25% de vez en cuando obliga a subirle el tope a todo el mundo, todo el tiempo.',
          },
          {
            t: 'tabla',
            cols: ['Campo', 'Qué decide'],
            filas: [
              ['**Nombre**', 'Único. Es lo que ve la cajera y lo que queda impreso en el ticket. Dos "Empleados" en el desplegable es una trampa'],
              ['**Porcentaje**', 'El que autoriza el dueño. No lo puede cambiar quien lo aplica'],
              ['**Lista de precios**', '**Obligatorio: es su identidad.** El descuento cae solo sobre los renglones de ESA lista, nunca sobre el total del ticket'],
              ['**Vencimiento**', 'Vacío = no vence. Con fecha, **vale todo ese día** hasta las 23:59 de Argentina'],
              ['**Medio de pago**', 'Vacío = cualquiera. Con valor, el pago tiene que ser **íntegro** de ese medio'],
              ['**Sucursal**', 'Vacío = todas. Al revés que la lista a propósito: el alcance geográfico es una restricción opcional'],
              ['**Requiere admin**', 'Si está tildado, la cajera lo ve pero no lo puede aplicar sola'],
            ],
          },
          {
            t: 'p',
            texto: '**Las seis reglas que decidió el dueño (14/8/2026):**',
          },
          {
            t: 'lista',
            items: [
              '**Cae solo sobre su lista.** Si el cliente lleva algo de Minorista y algo de Mayorista 1, un descuento de Mayorista 1 toca **solo esa parte**. Nunca el subtotal.',
              '**Uno por lista.** Dos de la misma lista competirían por los mismos renglones; se rechaza al aplicar.',
              '**Gana el mayor, nunca se suman.** Si el cliente ya trae 25% propio y el descuento es del 20%, el renglón queda en 25 — y **no cuenta como del descuento**, porque no fue el que lo produjo.',
              '**No toca los renglones con oferta**: ya tienen su beneficio.',
              '**El medio de pago se bloquea, y se avisa.** Un descuento "en efectivo" no admite un ticket pagado mitad y mitad: o el pago entero es de ese medio, o el descuento no corre.',
              '**El vencimiento vale todo el día.** Puesto el 14/8, sirve hasta las 23:59 del 14/8 en hora argentina.',
            ],
          },
          {
            t: 'nota',
            tono: 'info',
            texto: 'El navegador **nunca manda un porcentaje**: manda el **id** del descuento y el servidor resuelve todo de nuevo — que exista, que esté vigente, que sea de esta sucursal, que quien lo aplica tenga permiso, y que su lista esté de verdad en el ticket. Es la misma regla que ya rige el precio, el IVA y las ofertas: la pantalla propone, el servidor cobra.',
          },
          {
            t: 'p',
            texto: 'El renglón guarda la pareja **id + nombre congelado**, igual que la lista y la oferta, y **solo si el nombrado ganó**. Un ticket de hace seis meses se reimprime diciendo "Empleados" aunque después se renombre o se dé de baja, y el reporte de cuánto costó cada autorización no cuenta renglones que en realidad bajaron por otra cosa.',
          },
          { t: 'ruta', texto: 'Ventas › Configuración › Descuentos con nombre' },
          {
            t: 'p',
            texto: '**En la caja** hay un botón chico debajo del total: **"Aplicar descuento"**. Se abre la lista con los que sirven para ESE ticket, y los que no sirven aparecen **en gris con el motivo escrito** —venció, es de otra sucursal, ningún renglón usa su lista, lo tiene que aplicar un administrador—. Está a propósito: "no está" y "está pero no se puede, por esto" son cosas distintas, y lo primero manda a la cajera a buscar al encargado sin saber qué preguntar.',
          },
          {
            t: 'p',
            texto: 'Aplicado, queda como un cartelito arriba del botón y cada renglón alcanzado muestra su sello (igual que una oferta). **Se re-evalúa en cada cambio del ticket**: si entra otro producto de esa lista, entra solo; si un renglón cambia de lista, se cae; y si se cae el último, el cartel avisa *"ya no descuenta"* en vez de quedarse mintiendo. Vuelve a entrar solo si el ticket vuelve a calificar.',
          },
          {
            t: 'nota',
            tono: 'info',
            texto: 'El campo **Desc. %** del renglón se vuelve texto mientras hay un descuento con nombre ganando. Es a propósito: lo que se tipea ahí es el descuento propio del renglón —el de abajo—, así que escribir 30 sobre un 25 autorizado daría un 30 que el servidor rebota por el tope del vendedor. Para tocarlo a mano, primero se saca el descuento.',
          },
          {
            t: 'ruta',
            texto: 'Punto de venta › debajo del total › Aplicar descuento',
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
            texto: 'Las **presentaciones** (fraccionados) tienen **formato de venta propio** desde la 0053: su markup o su precio fijo, su caja por N paquetes y su mínimo. Antes derivaban del precio por kg de la lista más un recargo, y eso dejaba sin precio a los paquetes de las 73 madres que no tienen listas cargadas.',
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
        actualizado: '2026-08-15 06:00',
        titulo: 'Actualización masiva y deshacer',
        bloques: [
          {
            t: 'lista',
            items: [
              'Los costos se actualizan desde **Compras › Costos y percepciones › (el proveedor) › Productos y costos**, que es donde aparece el aumento. Se elige el campo (**Costo**, Descuento % o Flete %), cómo se mueve (**variar un %**, sumar/restar, o fijar un valor) y el número. La tabla muestra en el acto el costo neto y el **precio de venta antes → después**, en rojo lo que sube; recién al Guardar viaja.',
              '**Se puede filtrar antes de aplicar** (15/8/2026): buscador por nombre, marca o código, y un desplegable con las marcas que ESE proveedor trae. Es lo que hace usable el caso normal —"Coca Cola subió 10%" dentro de un distribuidor que trae seis marcas—, porque antes había que destildar a mano, de a 20 por página, todo lo que no cambiaba.',
              'La regla masiva alcanza **solo a los productos tildados Y VISIBLES** — no siempre sube todo el proveedor. Por defecto están todos tildados; se destildan los que no cambian (el checkbox de la cabecera tilda/destilda **solo lo que se ve**). Lo mismo en "Actualizar márgenes" de Compras › Productos.',
              'Editar un campo a mano vale siempre, esté tildado o no: el checkbox solo define el alcance de la regla masiva.',
              '«Actualizar márgenes» (Compras › Productos) opera sobre el **markup del formato de venta**: las filas del producto Y las de cada **paquete fraccionado**, que desde la 0053 son la misma clase de fila. Tenía un segundo modo para el recargo de fraccionamiento, que dejó de existir con la columna. Las filas en **precio definido** se saltean: ese precio lo fijó una persona y un % no lo pisa. Los cambios quedan en la evolución de precios (origen «Formato de venta»).',
              'Cada cambio queda registrado con el valor anterior Y el nuevo, en lotes.',
              'Un lote se puede revertir. Las filas que alguien tocó DESPUÉS se saltean: revertirlas pisaría una decisión más nueva.',
            ],
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: '**Con el filtro puesto, la regla cae SOLO sobre lo que se ve.** Suena obvio y es lo que evita el accidente caro: los tildes arrancan todos puestos, así que filtrar por una marca y aplicar +10% "a los tildados" —los 134 del proveedor, incluidos los que el filtro esconde— sería subirle el costo a todo el catálogo de un clic, sin verlo. El rótulo del botón lo dice con el número exacto ("Aplicar a 2 de los 2 que se ven"). Los tildes **no se reinician** al filtrar: lo que destildaste sigue destildado cuando volvés.',
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
        actualizado: '2026-08-10',
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
              ['**"Ya está en tu carrito"**', 'La tarjeta muestra sobre la foto lo que ya cargaste de ese producto (`🛒 2 kg en el carrito`), así se ve recorriendo la tienda sin abrir el carrito para acordarse'],
              ['**Tope por stock**', 'El catálogo manda `disponible` (el stock menos el piso reservado al mostrador, `webStockMin`) y el carrito lo usa de TOPE: el `+` se detiene ahí y la tarjeta explica qué pasa — «Solo quedan 0,5 kg (ya tenés 1,5 kg)», «Es todo lo que hay disponible», o el botón en «Sin más stock» cuando ya tenés todo. El tope vive en el carrito y no en la tarjeta, porque la cantidad se toca desde tres lados (tarjeta, carrito, mini-carrito) y con la regla repartida el que se la olvide deja pedir 50 kg de algo que tiene 3'],
              ['**Imágenes**', 'Se cargan en el **módulo Web** (foto de producto, imagen de categoría, logo de marca, banner). El catálogo viaja con la URL versionada (`tienda/imagenes/tipo/id?v=…`), nunca con los bytes; sin imagen, el sitio muestra la genérica'],
              ['**Ofertas en el sitio**', 'El carrusel de "Ofertas" muestra las promos del motor de Ofertas real que corren **sobre TODAS las listas** (o sea, las que no tienen ninguna tildada en particular). El precio con descuento es el que se cobra: recotizado igual que todo lo demás, nunca confiando en el navegador. **Ojo**: el precio que publica el sitio es el de mostrador, así que una promo acotada a esa lista debería verse acá y hoy no se ve — quedó igual que antes a propósito (15/8/2026) y está anotado en Pendientes'],
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
        actualizado: '2026-08-10',
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
              ['**Etiquetas del fraccionado**', 'El único documento que NO es papel: va a la **impresora térmica de etiquetas** en su medida (50 × 30 mm por defecto, más 50 × 25, 40 × 25 y 60 × 40) y **sin membrete** — en 30 mm de alto el logo se come el precio. Una etiqueta = una página del rollo. Se eligen en Almacén › Fraccionamiento › Etiquetas'],
              ['**La impresora física**', 'La elige cada puesto en el diálogo del navegador (decisión: diálogo está bien por ahora). En la caja: Chrome con `--kiosk-printing` imprime DIRECTO a la predeterminada, sin diálogo'],
            ],
          },
          {
            t: 'nota',
            tono: 'info',
            texto: 'Cada documento ofrece **solo los formatos que le sirven**: a los de papel no se les puede elegir una medida de etiqueta, y a la etiqueta no se le puede elegir A4. Elegir mal ahí solo podía terminar en papel tirado.',
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
        id: 'listado-ventas',
        actualizado: '2026-08-10',
        titulo: 'Ventas (el listado de lo vendido)',
        bloques: [
          {
            t: 'p',
            texto: 'La pantalla que responde **"¿qué se vendió?"**. Sección propia en el menú de Ventas, entre el Punto de venta y la Caja: se vende, se mira lo vendido, se cierra el turno. Antes de existir, la única lista de ventas del sistema estaba **escondida adentro del detalle de un cliente** (sus últimas 100) — no había forma de mirar el día ni de buscar un ticket viejo.',
          },
          {
            t: 'tabla',
            cols: ['Pieza', 'Cómo funciona'],
            filas: [
              ['**Abre en HOY**', 'Y de ahí a cualquier fecha con los atajos (Hoy · Ayer · Últimos 7 · Este mes · Todo) o los dos campos de fecha'],
              ['**Las tarjetas**', 'Tickets, vendido, ticket promedio y descuentos — más **cómo se pagó** (por medio de pago) y **cuánto costaron las ofertas**. Son del **filtro completo**, no de la página que se ve: "vendí $X hoy" suma las 300 ventas del día, no las 20 visibles'],
              ['**La plata no cuenta lo anulado**', 'Una anulada **sigue en la lista** (hay que poder auditarla) pero no suma en los totales; se informa aparte, en su propia tarjeta'],
              ['**Filtros**', 'Fechas, sucursal, cajero, turno de caja, medio de pago, estado, cliente, origen (mostrador / nacida de un pedido), **solo con oferta**, y buscador por **número de ticket o nombre del cliente**'],
              ['**Cada fila**', 'Comprobante y tipo, hora y turno, sucursal, cajero, cliente, renglones, medio de pago, descuento, **la oferta que se aplicó** (con su nombre al pasar el mouse), total y estado'],
              ['**El ticket**', 'Clic en la fila: renglones con **la lista y la oferta congeladas al vender**, otros cargos, totales, cómo se pagó y —en cuenta corriente— cobrado y saldo'],
              ['**Reimprimir**', 'Sale por el motor de impresión de Sistema, con el formato configurado (rollo 80 mm por defecto). Ahora el ticket dice el **nombre del producto**: antes la reimpresión imprimía "#12" porque el renglón no guarda el nombre'],
              ['**Anular** (sin CAE)', 'Solo administración, y **solo si la venta NO tiene CAE**. Pide confirmación explicando las tres consecuencias: la mercadería **vuelve al stock** con su movimiento, deja de contar como plata vendida, y el comprobante **no se borra** (el número emitido no se recicla). Si tiene cobranzas imputadas, la API la rechaza: primero se anula el recibo'],
              ['**Nota de crédito** (con CAE)', 'Reemplaza a Anular en cuanto la venta tiene CAE: para ARCA ese comprobante existe, y borrarlo acá haría que los dos sistemas dejen de coincidir. Ver la guía **"La nota de crédito"** acá abajo'],
              ['**Notas de crédito** (tarjeta)', 'Cuando el filtro tiene notas, aparece su propia tarjeta con cuánto se acreditó. **"Vendido" ya viene neto**: las notas están restadas, y no cuentan como ticket'],
              ['**Paginado de servidor**', 'La tabla de ventas crece para siempre: se piden 20 filas y el total viene aparte. Bajar 40.000 tickets para mostrar 20 es tráfico tirado'],
            ],
          },
          {
            t: 'nota',
            tono: 'info',
            texto: 'QUIÉN VE QUÉ. Administración (admin y superadmin) ve todas las sucursales y todos los filtros. El **cajero ve solo la sucursal donde está operando y solo las ventas de mostrador**: no hay selector de sucursal (un cartelito con su puesto), no está la columna Sucursal, y la consulta sale con la sucursal clavada — no es un adorno de la vista. Anular tampoco: la ve solo administración.',
          },
          {
            t: 'lista',
            items: [
              'Los **tickets abiertos** (sin cobrar) NO están acá: viven en el Punto de venta, que es donde se retoman.',
              '**Descuento** incluye lo que descontaron las ofertas (por eso las dos cifras pueden coincidir): el renglón guarda el porcentaje y el importe de la promo por separado, y ambos suman al descuento del comprobante.',
              '**Exportar CSV** baja lo que se está viendo, con BOM y `;` para que Excel en español lo abra derecho.',
            ],
          },
          { t: 'ruta', texto: 'Ventas › Ventas (permiso ventas.listado — sección propia, aparte de ventas.caja)' },
        ],
      },
      {
        id: 'nota-credito',
        actualizado: '2026-08-20',
        titulo: 'La nota de crédito (deshacer una factura)',
        bloques: [
          {
            t: 'p',
            texto: 'Una factura con **CAE ya existe para ARCA**. Anularla en el sistema no la borra de allá: solo lograría que los dos libros dejen de coincidir, y el que queda mal parado en una inspección es el nuestro. La forma de deshacerla es **emitir otro comprobante que diga qué vuelve**, y eso es la nota de crédito.',
          },
          {
            t: 'nota',
            tono: 'info',
            texto: 'UNA PUERTA O LA OTRA, NUNCA LAS DOS. En el detalle de la venta aparece **"Nota de crédito"** si tiene CAE, y **"Anular"** si no lo tiene (ticket interno, o una factura que todavía no se emitió porque ARCA estaba caído). No es una preferencia de la pantalla: la API rechaza anular una venta con CAE aunque se la llame por afuera.',
          },
          {
            t: 'tabla',
            cols: ['Lo que se elige', 'Por qué lo tenés que decir vos'],
            filas: [
              ['**Toda la venta** o **algunos renglones**', 'Es el mismo circuito: la nota total es la que lleva todos los renglones completos. Si ya hubo una nota antes, "toda la venta" quiere decir **todo lo que queda**, no lo que decía la factura'],
              ['**La mercadería vuelve al stock**', 'Viene tildado. **Destildalo si la nota es por un error de precio o de facturación**: ahí no volvió un gramo, y reingresarlo inventaría stock que no existe. Es la misma nota y una cosa distinta — el sistema no lo puede adivinar'],
              ['**Devolver el efectivo por caja**', 'Viene apagado a propósito. Tildado, sale un **egreso del turno abierto** y le baja el efectivo esperado al arqueo. Hacerlo automático le descuadraría el cierre a quien no lo esperaba'],
              ['**El motivo** (obligatorio)', 'Va **impreso en la nota** y queda guardado con tu nombre y la hora'],
            ],
          },
          {
            t: 'lista',
            items: [
              '**El precio es el de la venta original, no el de hoy.** Si el producto aumentó la semana pasada, eso no es problema del cliente: la nota devuelve exactamente lo que se cobró.',
              '**Los otros cargos** (envío, packaging) solo viajan en la nota **total**: devolver medio envío no significa nada, y prorratearlo sería inventar un número. Y viajan **una sola vez**.',
              '**No se puede devolver lo mismo dos veces.** Cada renglón muestra cuánto ya volvió por notas anteriores y cuánto queda; la API lo revalida.',
              '**En cuenta corriente la nota BAJA la deuda** del comprobante que ajusta. No aparece como algo para cobrar, y no se le puede imputar un recibo — sería cobrarle al cliente su propia devolución.',
              '**La nota se imprime sola** al emitirse, con su letra, el comprobante asociado, el motivo y el IVA discriminado si es A. Se reimprime desde el listado como cualquier comprobante.',
              '**Una nota de crédito no se anula ni lleva otra nota**: si está mal, se corrige con una nota de débito (todavía no construida — está en Pendientes).',
            ],
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: 'ARCA NO TIENE "NOTA DE CRÉDITO" A SECAS: tiene una **por letra** —código 3 (A), 8 (B) y 13 (C)—, cada una con su numeración correlativa, y **la letra tiene que ser la misma que la de la factura que ajusta**. El sistema la deduce de la venta, no se elige. El comprobante viaja además con el **asociado declarado** (tipo, punto de venta y número de la factura): sin eso la nota queda huérfana en el libro de IVA.',
          },
          {
            t: 'nota',
            tono: 'info',
            texto: 'EL CENTAVO DEL REDONDEO. El IVA se redondea comprobante por comprobante, así que partir una factura en dos notas lo redondea dos veces y la suma puede quedar **$0,01 abajo** del total. Ese centavo no se puede acreditar: no hay mercadería que lo respalde y ARCA no toma una nota de un centavo. Por eso **lo que queda por acreditar se mide en mercadería, no en plata** — cuando no queda ni una unidad, el botón se apaga y la cuenta corriente perdona la diferencia en vez de dejar la factura pidiendo un centavo para siempre.',
          },
          { t: 'ruta', texto: 'Ventas › Ventas › (una venta con CAE) › Nota de crédito — permiso devoluciones, el mismo que anular' },
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
              ['Shift + Ins', 'Búsqueda de productos (categoría / marca / producto) — stock de TU sucursal y precio por lista'],
              ['Esc', 'Salir de la registradora a la lista (guardando)'],
              ['F10', 'Liquidar — ticket interno, al contado'],
              ['F8', 'Facturar — comprobante fiscal'],
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
              ['**Cambios de precio** (Alt+F5)', 'búsqueda, marca, lista, motivo, desde', 'producto · lista · antes → después · variación · fecha — el **motivo** se filtra arriba pero ya no tiene columna (15/8/2026): era la más ancha para un dato que se mira poco. Sigue disponible al pasar el mouse por la fecha'],
            ],
          },
          {
            t: 'nota',
            tono: 'info',
            texto: 'Esc es escalonado: con un modal abierto, ese Esc es del modal; con texto en el buscador, lo limpia. Recién sin nada de eso sale de la registradora.',
          },
          {
            t: 'nota',
            tono: 'ok',
            texto: '**LA BÚSQUEDA DE PRODUCTOS MUESTRA TU SUCURSAL (18/8/2026, pedido tuyo).** El Shift+Ins traía una columna de stock por CADA sucursal: seis columnas que empujaban el precio fuera de la pantalla, y que además invitan a prometer mercadería que está en otro local. Ahora sale **una sola: la de la caja con la que entraste** (Fontana ve Fontana). Las columnas de precio quedaron **agrupadas por modalidad: primero Minorista, después Mayorista**, y adentro de cada una por número de lista. El orden sale de la configuración —el mismo `orden` que ordena las modalidades en Formato de Venta—, así que una modalidad nueva entra sola en su lugar sin tocar código.',
          },
        ],
      },
      {
        id: 'cierre',
        actualizado: '2026-08-14 22:00',
        titulo: 'Cerrar la venta',
        bloques: [
          {
            t: 'tabla',
            cols: ['Forma', 'Comprobante', 'Condición'],
            filas: [
              ['Liquidar (F10)', 'Ticket interno', 'Siempre contado'],
              ['Facturar (F8)', 'Fiscal — la letra la resuelve el backend', 'Admite cuenta corriente'],
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
            t: 'p',
            texto: 'Cobrado el ticket, el modal ofrece **imprimir** y **Nuevo ticket**. Ese botón abre **otra venta en el mismo punto de venta**, con el foco en el buscador y listo para cargar — no vuelve a la pantalla de Caja. Es el movimiento de una caja con cola: se cobra, se entrega, se arranca el siguiente sin pasar por ningún lado.',
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
        actualizado: '2026-08-10 12:15',
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
            t: 'p',
            texto: '**¿Y cuando se vende la última unidad, se archiva solo?** No, y la decisión es deliberada — **archivar lo propone el sistema, no lo hace solo; volver a abrir sí es automático**. La asimetría es la clave: archivar CIERRA puertas y por eso lo decide una persona; reabrir las ABRE, y no hacerlo dejaría plata inmovilizada esperando que alguien se acuerde.',
          },
          {
            t: 'tabla',
            cols: ['Momento', 'Qué hace el sistema', 'Por qué así'],
            filas: [
              ['**Se agotó un discontinuado**', 'Lo **sugiere** en Compras › Productos: "2 productos discontinuados se agotaron — archivarlos", con un botón que los archiva de una (revalidando cada uno).', 'Archivar en el acto de vender la última unidad rompería al cajero: el catálogo del POS se carga **al abrir la caja**, así que un ticket ya armado daría "está archivado" sobre algo que estaba en pantalla. Y una devolución o la anulación de ese mismo ticket devuelve el stock.'],
              ['**Espera 30 días** sin movimiento', 'Recién agotado no lo sugiere.', 'Los primeros días una devolución es probable; sugerir archivar el mismo día es ruido.'],
              ['**Reaparece stock** de un archivado', 'Vuelve **solo** a *discontinuado*, con el motivo "Volvió a haber stock…" anotado.', '"Archivado con stock" es un estado imposible: mercadería que existe y que el sistema no deja vender. Vuelve a *discontinuado* y no a *activo* porque que aparezca una unidad no significa que se haya vuelto a comprar.'],
            ],
          },
          {
            t: 'nota',
            texto: 'El **cierre de caja no tiene nada que ver**: no toca el stock, solo cuenta la plata. El stock baja al **confirmar cada venta**, en su transacción. Por eso, si el archivado fuera automático, ocurriría en medio del turno — otra razón para que sea una sugerencia. La sugerencia ignora el stock **en tránsito** (lo que está arriba de un camión va a llegar a algún lado) pero sí sugiere los que solo tienen stock vencido o defectuoso, porque esa mercadería ya no se vende.',
          },
          {
            t: 'nota',
            texto: 'Tres claves foráneas dejaron de ser `cascade` y pasaron a `restrict` (migración 0051): **stock, renglones de transferencias e incidencias**. Antes, borrar un producto hacía desaparecer en silencio sus existencias y mutilaba remitos viejos; ahora la base misma lo impide. El borrado legítimo limpia solo las filas de stock en CERO, que no son información. El "reabrir automático" vive en el corazón del inventario (`addDelta`), que es el único lugar por donde pasa TODO aumento de stock: así ningún camino nuevo se lo puede olvidar.',
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: 'Los candados están en la API, no solo en las pantallas: la venta rechaza lo archivado incluso en un borrador armado antes (el catálogo del POS se cachea al abrir la caja), la factura de compra rechaza lo discontinuado y lo archivado, y el importador de catálogo **no revive un archivado en silencio** — lo saltea avisando "hay que reactivarlo". El estado NO se cambia editando el producto: tiene su propia acción, así no se modifica de costado sin que nadie lo decida.',
          },
          { t: 'ruta', texto: 'Compras › Productos › Dar de baja / Reactivar · filtro de estado · el aviso de "se agotaron" arriba del listado · migración 0051' },
        ],
      },
      {
        id: 'vencimientos-vigia',
        actualizado: '2026-08-10 22:00',
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
              ['**Registros**', 'Todo lo anotado con chips por rango, filtros y exportación CSV. El **costo viaja CONGELADO** al registrar (lección de cafetería): la pérdida de marzo no cambia en julio porque subió el catálogo. Editar no re-valúa. El botón **"Oferta"** lleva al motor de ofertas de Ventas con el formulario ya lleno (ver abajo).'],
              ['**Ofertas**', 'El **cruce con Ventas**: qué mercadería vigilada está —o debería estar— en oferta, y qué se desalineó. No mira solo las ofertas nacidas acá: resuelve el alcance REAL de cada oferta (producto, marca, categoría, etiqueta, componentes de un combo) contra los registros abiertos, así también aparece la promo que alguien armó en Ventas sobre algo que además está por vencer. Filtros por aviso y por sucursal, exportación CSV, y el globito rojo de la pestaña cuenta lo URGENTE.'],
              ['**Vencidos**', 'El cierre del ciclo: procesar = contar cuántas se **vendieron antes de vencer** y cuántas se tiran. Separa pérdida ESTIMADA (todo lo registrado) de pérdida **REAL** (lo que de verdad se perdió). Con "bajar del stock" tildado genera el movimiento «vencido» (disponible → estado vencido) EN LA MISMA transacción: o pasa todo, o no pasó nada — sin stock suficiente, no procesa ni a medias. Dos personas procesando lo mismo: una sola gana (FOR UPDATE). Lo procesado no se edita ni se borra: es pérdida asentada.'],
              ['**Mermas**', 'La baja de siempre (merma / vencido / defectuoso) **se mudó acá**: registrar abre el modal de movimiento con el producto precargado, y el listado muestra todas las bajas con su costo congelado y su origen ("De vencimiento" si nació de procesar). El modal existía registrado pero SIN botón que lo abriera — quedó huérfano en alguna refactor; ahora tiene casa.'],
              ['**Reportes**', 'General (estimada + real + mermas), por sucursal, por categoría, **los que MÁS vencen** (la señal para comprar distinto), historial mensual y controles hechos con usuario. Períodos semana/mes/trimestre/año. Los movimientos nacidos de procesar NO cuentan como merma suelta: sumarían la misma pérdida dos veces.'],
            ],
          },
          {
            t: 'p',
            texto: '**"Oferta" NO abre un mini-formulario propio: lleva al MOTOR de ofertas con todo cargado** (10/8/2026). En el sistema hay **un solo lugar para crear una oferta** —Ventas › Ofertas, con sus siete mecánicas y su vista previa que corre el motor real sobre un ticket de ejemplo— y el vencimiento aporta el CONTEXTO, no un motor paralelo. El botón abre "Nueva oferta" ya con: el **producto** en el alcance, la **fecha de fin = el día que vence** (así el descuento nunca sobrevive a la mercadería), la **sucursal del lote** (rematar donde no está el lote es regalar margen), 25% propuesto y una ficha arriba que dice cuántas unidades son, dónde y **cuánta plata se pierde** si no se venden. Todo se puede cambiar antes de crear. Al crearla, la oferta **queda atada al registro** ("🏷 En oferta"); un registro se ata a UNA sola. Ojo: el alcance es el producto COMPLETO — si tiene presentaciones fraccionadas a la venta, entran mientras dure.',
          },
          {
            t: 'p',
            texto: '**El vínculo no puede mentir.** Si la oferta que se creó no alcanza al producto del registro (porque se le cambió el alcance en el formulario), la API **rechaza el vínculo** y lo dice: la oferta se creó igual —es válida— pero el registro no va a figurar "en oferta" cuando en la caja no descuenta nada. Y de paso, el formulario de ofertas ganó el **selector de sucursales** que le faltaba: el dato existía y se mostraba en la tabla, pero no había forma de elegirlo, así que toda oferta nacía "en todas".',
          },
          {
            t: 'tabla',
            cols: ['Aviso del cruce', 'Qué pasó y qué hacer'],
            filas: [
              ['🔴 **Mercadería vencida con la oferta corriendo**', 'Lo más caro que puede estar pasando: la caja vende con **descuento** algo que **ya venció**. Aparece arriba del Panel con la plata en góndola, con globito en la pestaña, y **también en Ventas › Ofertas** — que es donde se apaga. Apagar la oferta + procesar el registro.'],
              ['🟡 **La oferta ya no alcanza al producto**', 'Estaba atada y alguien le cambió el alcance: el registro dice "en oferta" y la caja no descuenta. Corregir el alcance o desatar.'],
              ['🟡 **La oferta no corre en esa sucursal**', 'La promo está viva pero no en el local donde está el lote.'],
              ['🟡 **Apagada / terminada / arranca después**', 'La oferta que se armó para este lote ya no está descontando y la mercadería todavía no venció: hay tiempo, pero sin descuento no se va a ir.'],
              ['🔵 **La oferta corta antes de la fecha**', 'Termina antes de que venza el paquete: quedan días de mercadería a precio lleno.'],
              ['🟡 **Venció y la oferta ya no descuenta**', 'Se apagó o terminó a tiempo, así que no hay nada regalándose — pero el registro sigue abierto: retirar y procesar. (Decir "todo en orden" al lado de "venció hace 3 días" sería absurdo.)'],
            ],
          },
          {
            t: 'nota',
            texto: 'La lista de la pestaña Ofertas es honesta a propósito: una fila existe solo si la oferta está **atada** al registro (ahí cualquier desajuste es la noticia) o si está **descontando de verdad** ese lote (vigente + alcanza + cubre la sucursal). Una promo apagada, o que corre solo en otro local, no es "el producto en oferta" — mostrarla llenaría la pantalla de filas «todo en orden» que no descuentan nada. Y lo **procesado** sale de la lista: ya es historia.',
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
          { t: 'ruta', texto: 'Almacén › Vencimientos (permiso almacen.vencimientos) · pestañas Panel / Control / Registros / Ofertas / Vencidos / Mermas / Reportes · la oferta se crea en Ventas › Ofertas (permiso ventas.ofertas: sin él el botón no aparece) · migración 0050 (tablas, Fontana, costo congelado en movimientos) · cámara: npm run dev:https en la red local' },
        ],
      },
      {
        id: 'fraccionado-pantalla-propia',
        actualizado: '2026-08-10 22:00',
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
              ['**La pantalla propia**', 'Tres pestañas. **Resumen**: tamaño, código de barras, costo del paquete (derivado), precio de venta, su formato de venta por lista, stock por sucursal (paquetes y equivalente en kg) y los movimientos DE ESE fraccionado. **Formato de venta** (editable, 10/8): el precio del paquete, que es propio. **Producto madre**: el "Prod.Util" del sistema viejo — de qué producto descuenta, cuánto consume por paquete (tamKg) y a qué costo sale. Más el desglose: suelto + este fraccionado + todas las presentaciones = TOTAL equivalente.'],
              ['**El costo es de SOLO LECTURA, el precio es PROPIO**', 'Ésa es la división. El **costo** se deriva de la madre (costo/kg × tamaño) porque lo pone el proveedor: si fuera editable, el costo del paquete y el de la madre divergirían — el vicio del sistema viejo que obligó a revisar 24 precios al importar Bavosi. El **precio** se decide en la ficha del paquete, con la misma libertad que un producto.'],
              ['**"Solo para fraccionar"** (el "SOLO STOCK" del viejo)', 'Tilde en la ficha del granel que no se vende suelto (la pimienta de Jamaica: llega 1 kg y se fracciona entera en 20×50 g). El POS no lo ofrece por kg, y la venta suelta se **rechaza en la API** (hasta en borrador) — sus paquetes se venden normal.'],
              ['**Borrar una presentación con stock se rechaza**', 'Esos paquetes existen en el depósito: borrar el renglón los haría desaparecer del sistema. Primero se venden o se ajustan.'],
              ['**El código de barras se pide EAN-13** (10/8/2026)', 'El campo de la pestaña Presentaciones exige un **EAN-13 válido** —13 dígitos con el verificador cerrando— en todo código que nace o se edita, y avisa al lado del renglón qué le pasa a cada uno. Al lado tiene un botón **Generar**: da un código propio de la serie interna, libre y sin repetir. Una presentación nueva **no puede nacer sin código** (sería un paquete que la caja no puede escanear); vaciarle el código a una que ya existe SÍ se puede, es la forma de sacar uno malo.'],
              ['**El paquete se vende SOLO** (10/8/2026, migración 0053)', 'El paquete tiene **formato de venta propio**: su markup o su precio fijo, su caja por N paquetes, su mínimo de unidades y su código, igual que un producto. El `recargo` que había —un solo número que multiplicaba el precio de la lista de la madre— **se borró**. La pestaña Presentaciones de la madre quedó para lo que es suyo: el **tamaño** (cuánto granel consume cada paquete), el código y el link a la ficha.'],
              ['**Los paquetes y su stock, debajo del granel** (11/8/2026)', 'La pestaña *Fraccionar* muestra abajo **solo los fraccionados** —código, producto, tamaño y marca— con **una columna por sucursal** y el total. La madre ya está arriba con su granel, así que no se repite. El cero se atenúa a propósito: lo que hay tiene que saltar a la vista.'],
              ['**Corregir una tanda mal cargada** (11/8/2026)', 'Botón **Corregir** en cada paquete: "puse 20 y son 19". La corrección **mueve las dos puntas** — da de baja el paquete y **devuelve los kilos al granel** — porque el fraccionamiento no crea ni destruye mercadería: la convierte. Si solo se editaran los paquetes, los kilos totales del producto cambiarían de la nada. El modal muestra la cuenta en vivo ("0,5 kg vuelven al granel, que quedaría en 10,5 kg") y no deja fabricar paquetes sin granel para respaldarlos. Toca solo el **disponible**: lo comprometido está apartado para un envío confirmado.'],
              ['**Dos códigos que no son el mismo**', 'El **código del paquete** es el de su etiqueta y se carga una vez, en Presentaciones de la madre. El **código de una fila del formato de venta** es otra cosa: el de la **caja de N paquetes**, para que escanearla cargue las N de una. Por eso ese campo solo se habilita cuando "Vende por" es mayor a 1 — con 1 sería un segundo código para el mismo artículo y el escáner de la caja se quedaría sin desempate. La ficha del paquete muestra arriba cuál es su código, para no volver a cargarlo abajo. Y a la caja no se le pide EAN-13: suele venir con un **DUN-14**, que tiene 14 dígitos y es igual de legítimo.'],
            ],
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: 'El motivo del cambio se veía en pantalla: **73 de las 103 madres con fraccionados no tienen listas de venta**, y como el precio del paquete se derivaba de la madre, esos paquetes no tenían precio de verdad — el cálculo se caía al costo neto y había paquetes cotizando **por debajo del costo** (la Nuez Pecán de 250 g: precio $4.266,94 contra un costo de $4.267,13). Ahora el paquete se cotiza solo y la madre puede no tener ninguna lista. Los **238 paquetes arrancaron sin precio** (decisión del dueño): un paquete sin formato de venta **no vale cero, no tiene precio** — la caja lo muestra pero no lo deja cargar, la etiqueta sale sin precio avisando, y Almacén › Fraccionamiento tiene el contador **"N sin precio"** con la lista de lo que falta y el atajo para cargarlo.',
          },
          {
            t: 'nota',
            tono: 'info',
            texto: 'Por qué el verificador y no "cualquier número": es lo único que hace que un dígito mal tipeado NO produzca otro código válido — el lector se da cuenta en vez de cargar otro producto. Los **71 códigos heredados** del sistema viejo que no cumplen (13 con el verificador mal, 58 más cortos) **pasan igual mientras no se los toque**: si se rechazaran, esas presentaciones no podrían guardar ni un cambio de tamaño. Se muestran en amarillo y se arreglan de a uno con Generar. Y el duplicado se frena por las **tres** puertas donde vive un código: el producto, la presentación y el **formato de venta** (el EAN de la caja) — las tres se escanean en la misma caja, y el único de la base no puede verlo porque es por tabla.',
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: '**Bug grave encontrado y corregido al construir esto**: guardar la pestaña Presentaciones hacía borrar-todo-y-reinsertar, y como el stock cascadea por `presentacionId`, CADA guardado **borraba el stock de todos los fraccionados en silencio** — aunque no se hubiera sacado ninguna presentación. Ahora actualiza por id (misma lección que los formatos de compra y su historial): los ids sobreviven al guardado y el stock queda donde estaba. Verificado: guardar conserva ids y stock intactos.',
          },
          {
            t: 'nota',
            tono: 'info',
            texto: '**Un granel sin tamaños definidos no se puede fraccionar**, y son más de los que parece: al 15/8/2026, **62 de los 164 granel activos**. Es lo primero que hay que cargar —el sistema no sabe de cuántos kilos es cada paquete—, así que Almacén › Fraccionamiento lo marca **en la fila** ("sin tamaños de paquete definidos") y, si se abre igual, el modal dice qué falta y dónde se carga en vez de mostrar una lista de paquetes vacía.',
          },
          { t: 'ruta', texto: 'Compras › Productos (filas ↳) · clic en el fraccionado › Resumen / Producto madre · ficha del producto › tilde "Solo para fraccionar" · pestaña Presentaciones para los tamaños' },
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
        actualizado: '2026-08-10',
        titulo: 'Fraccionamiento (y las etiquetas de los paquetes)',
        bloques: [
          {
            t: 'p',
            texto: 'La pantalla tiene **dos pestañas, y la separación es a propósito**: **Fraccionar** convierte granel en presentaciones (baja kilos, sube paquetes, en un solo movimiento) y **Etiquetas** solamente imprime. Vive en Almacén porque es una operación de depósito, no de compra.',
          },
          {
            t: 'nota',
            tono: 'ok',
            texto: '**Sacar etiquetas NO mueve stock** (10/8/2026, decisión del dueño). Se imprimen las que se necesiten, todas las veces que hagan falta: la que sale corrida se tira y no pasó nada. Si imprimir descontara, cada etiqueta arruinada, cada prueba y cada rollo mal cargado dejarían el inventario mintiendo — y el inventario es lo único que no se puede recuperar mirando el depósito.',
          },
          {
            t: 'p',
            texto: 'Cómo es el trabajo de verdad: los chicos reciben el pedido (la lista **Fraccionados** del envío), fraccionan, **sacan las etiquetas**, las pegan, y recién ahí se asienta en el sistema y se despacha. Los días sin pedidos se fracciona para la Distribuidora o para stockear. Las dos pestañas acompañan eso sin obligar a ningún orden: la etiqueta no espera al asiento y el asiento no espera a la etiqueta.',
          },
          {
            t: 'tabla',
            cols: ['En Etiquetas', 'Qué hace'],
            filas: [
              ['**Buscador**', 'Lista los **fraccionados** del catálogo (cada presentación de un granel activo), buscables por nombre, marca o código de barras. Un granel sin presentaciones no aparece: no hay etiqueta que sacarle'],
              ['**Cantidad**', 'Cuántas etiquetas salen, una por paquete armado. Hasta 500 por impresión: un cero de más no puede vaciar el rollo'],
              ['**Fecha de vencimiento**', 'Sale impresa como "Vto 15/09/2026". Vacía, la etiqueta sale sin fecha (hay productos que no la llevan)'],
              ['**Precio**', 'NO se tipea: sale del catálogo, de la **lista base** (Mostrador) y con **IVA incluido** — el mismo número que cobra la caja. Un precio escrito a mano en la etiqueta es un precio que en dos semanas discute con el POS'],
              ['**Vista previa**', 'El **mismo HTML** que va a la impresora, en el tamaño real de la etiqueta. Lo que se ve es lo que sale'],
            ],
          },
          {
            t: 'p',
            texto: 'La etiqueta lleva **nombre, peso, precio, código de barras y vencimiento**. Es interna (precio y código para la caja), no un rótulo legal: si algún día tiene que cumplir el rótulo del fraccionado, faltan **lote, RNE/RNPA y razón social**, y eso es otra vuelta.',
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: 'El código de barras se dibuja **EAN-13** cuando el código de la presentación tiene 13 dígitos y el verificador cierra; cualquier otro (7, 9 u 11 dígitos, con letras, o de 13 con el dígito mal) se dibuja en **Code 39**, que escanea los mismos caracteres pero ocupa mucho más ancho y algunos lectores baratos lo traen apagado. La pantalla lo avisa en los dos casos, y también **avisa si el código quedó demasiado fino** para la etiqueta configurada (abajo de 0,25 mm por barra una térmica empieza a fallar): ahí conviene una etiqueta más ancha o corregir el código a EAN-13 en el producto madre. Antes de tirar una tanda larga, pasale el lector a UNA etiqueta.',
          },
          {
            t: 'ruta',
            texto: 'Almacén › Fraccionamiento › pestañas Fraccionar / Etiquetas · el tamaño de la etiqueta se elige una vez en Sistema › Impresión',
          },
        ],
      },
      {
        id: 'transferencias',
        actualizado: '2026-08-15 02:00',
        titulo: 'Transferencias entre sucursales',
        bloques: [
          {
            t: 'p',
            texto: 'Modelo **pull**: cada local pide lo que necesita, a cualquier otra sucursal (la Distribuidora es el depósito central solo porque las compras entran por ella). No son cuatro pantallas: es **un documento con estados**, y cada bandeja es un filtro por estado + qué papel juega tu sucursal en él.',
          },
          {
            t: 'nota',
            tono: 'info',
            texto: 'En el paso 1, **el destino es tu sucursal y no se elige** —pedís para donde estás parado— y el origen ofrece **las otras**, nunca la propia: pedirse mercadería a uno mismo no es una operación. El servidor dice lo mismo: clava el destino en la sucursal de la sesión y toma el origen libre. Arranca en la **Distribuidora**, que es de donde se pide casi siempre.',
          },
          {
            t: 'flujo',
            items: ['Armando (borrador)', 'Pedido (pendiente)', 'En preparación (dos listas)', 'Despachar (en tránsito)', 'Recibir contando'],
          },
          {
            t: 'tabla',
            cols: ['Paso', 'Qué pasa con el stock'],
            filas: [
              ['Armando (borrador)', '**Nada, y el origen NO lo ve** (11/8/2026). El cajero atiende clientes y arma el pedido en los ratos libres, así que el pedido vive en la base desde que se elige la ruta: **se guarda solo**, sin botón, y cerrar es "sigo después". No lleva código —la serie TR se asigna al enviarlo— y **no le llega a nadie hasta que se envía**: nadie tiene que preparar algo que el que pide sigue escribiendo. Hay **UNO por ruta** (origen → destino), no uno por cajero: el pedido es del local, y el que entra al turno sigue la lista que dejó el anterior. Si fuera de cada uno, dos cajeros armarían dos pedidos el mismo día y el depósito mandaría mercadería duplicada. Se retoma desde el aviso de arriba del panel ("Seguir armando") y se **descarta** —se borra, no queda un pedido cancelado en el historial, porque nunca fue un documento'],
              ['Pedido', '**Nada** — es demanda; el origen quizá ni tiene la mercadería. Se arma en **tres pasos** (a quién le pido → qué se pide → revisar y enviar) y dentro del segundo, en **dos pestañas** (**Prod. Enteros** y **Prod. a granel**) porque son dos recorridos distintos de góndola. El pedido que sale es **uno solo**: la división es de la pantalla, no del documento. **Cada pestaña tiene su propio buscador y solo ofrece sus productos**: parado en Enteros no aparece un granel. Si lo que se buscó está en la otra, el aviso lo dice y ofrece el atajo ("hay 3 a granel · Ver Prod. a granel"). Al lado del buscador está **Buscar en el catálogo**: el mismo lenguaje que la consulta de Existencias (Alt+F3) pero recortado a lo que el pedido necesita — filtros de proveedor, categoría y marca en una fila, botón Agregar por renglón, y de las cinco sucursales **solo las dos de este pedido**. En granel **se ofrecen los tamaños y no la madre** (lo que viaja son paquetes), cada uno con su código y ya con la presentación elegida; el granel suelto del destino va como info debajo de su stock ("hay 123 kg a granel"), que es lo que la fila de la madre decía antes. La lista tiene **su propio scroll y el paginador fijo abajo**: los filtros no se van de vista y no hay que llegar al final de la página para enterarse de que hay 14 más. El paso 3 muestra el resumen, los kilos que el origen va a tener que fraccionar y —lo que más sirve— **qué renglones el origen no puede cubrir hoy** ("pide 20 kg y hay 3 kg de granel"): no frena el pedido, pero se sabe antes y no cuando llega el envío cortado'],
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
            tono: 'info',
            texto: '**Lo que se pide a granel se fracciona del MADRE** (11/8/2026, regla del dueño). Por eso, al armar el pedido, la columna del origen de un renglón a granel muestra el **granel suelto en kg** —no los paquetes— y debajo dice cuántos kilos hay que fraccionar ("se fraccionan 8 kg") o cuántos faltan. Los paquetes que ya están armados en la Distribuidora **son su góndola y no viajan**: verlos ahí era peor que no ver nada, porque "10 paq." al lado de un pedido de 8 daba tranquilidad sobre mercadería que no se iba a mandar.',
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
        id: 'incidencias',
        actualizado: '2026-08-10',
        titulo: 'Incidencias: la cuarentena del stock',
        bloques: [
          {
            t: 'p',
            texto: 'El principio: **ante una anomalía no se toca el stock a mano, se abre una incidencia y la mercadería queda en cuarentena**. Eso la separa de la merma. La merma dice "esto se perdió, bajalo"; la incidencia dice "acá hay algo raro y todavía no sé qué, no lo vendas hasta que lo resolvamos".',
          },
          {
            t: 'p',
            texto: 'La cuarentena es el estado **`comprometido`**: el stock sigue existiendo y sigue valorizado, pero el POS y el sitio no lo pueden vender. Nada desaparece mientras se averigua.',
          },
          {
            t: 'tabla',
            cols: ['Pieza', 'Cómo funciona'],
            filas: [
              ['**Cómo nace, a mano**', '«+ Nueva incidencia» en Almacén › Incidencias (permiso `incidencia_crear`, que el cajero tiene). Seis tipos: etiqueta incorrecta, producto mal pesado, bolsa rota, diferencia de inventario, defectuoso, vencido. Valida que haya stock disponible y mueve esa cantidad a comprometido'],
              ['**Cómo nace, sola**', 'Al **recibir una transferencia con faltante**: se acepta lo que llegó (esa es la verdad) y la diferencia vuelve a comprometido **en el origen**, con una incidencia tipo `faltante` cuyo motivo ya viene escrito ("se enviaron 10 y llegaron 8"). Es el uso que más corre'],
              ['**El ciclo**', '`pendiente → revisión → resuelta`. "A revisión" es un acuse ("lo estoy mirando"); **resolver es de admin**'],
              ['**Liberar**', 'Vuelve a `disponible`: apareció, era error de conteo, la etiqueta se corrigió. No es pérdida — no descuenta ni congela costo'],
              ['**Baja por merma / vencido / defectuoso**', 'Sale de comprometido: la merma se descuenta y las otras dos pasan al estado `vencido` o `defectuoso`. Las tres **congelan el costo del día**: son pérdida y tienen que valer plata en el reporte'],
              ['**Queda registrado**', 'Código `INCnnnn`, el movimiento atado (`refIncidenciaId`) y el motivo. No se borra nunca: desde la 0051 la FK del producto es `restrict`, así que la incidencia es historia'],
            ],
          },
          {
            t: 'nota',
            tono: 'info',
            texto: 'LA CONEXIÓN CON VENCIMIENTOS. No hay vínculo de datos entre los dos módulos —ninguna tabla se referencia— pero se cruzan en un lugar y es a propósito: la pestaña **Vencimientos › Mermas** no lista "las mermas del módulo", lista TODOS los movimientos de tipo merma, vencido y defectuoso. Entonces una incidencia resuelta como baja aparece ahí y suma en el reporte de pérdidas del período, con el chip **«De incidencia»** (y el código en el tooltip). Vencimientos es el lugar donde se lee la pérdida de TODO el negocio, sin importar por qué puerta entró; la incidencia es una de esas puertas.',
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: 'Lo que NO hay, aunque suene razonable: un producto que el control de vencimientos detecta por vencer **no abre una incidencia** (el vigía de fechas es una lista de control, sin stock), y una incidencia de tipo "Producto vencido" **no crea un registro de vencimiento**. Son circuitos paralelos que se cruzan solo en el reporte de pérdidas.',
          },
          { t: 'ruta', texto: 'Almacén › Incidencias (crear: permiso incidencia_crear · resolver: admin)' },
        ],
      },
      {
        id: 'conteos',
        actualizado: '2026-08-15 10:00',
        titulo: 'Control de stock: el físico contra el virtual',
        bloques: [
          {
            t: 'p',
            texto: 'Se cuenta lo que hay en la góndola y el sistema lo compara contra lo que él cree que hay (migración 0066). El conteo es una **sesión de trabajo**, no una acción: dura horas, se interrumpe, y la sigue el que entra al turno — igual que el pedido de mercadería, y es **del local**, no de cada persona. Se hace con el **local cerrado**.',
          },
          {
            t: 'lista',
            items: [
              '**El alcance define qué se cuenta**: marca, categoría, proveedor, enteros/granel, y "solo con stock" (destildado entra también lo que figura en cero, para descubrir sobrantes). El dueño cuenta por marca, no todo junto. **La lista se congela al abrir**: un alta a mitad del conteo no se cuela.',
              '**La pantalla está pensada para el lector**: escaneás el código (del producto o del paquete), el foco cae en su renglón, tipeás la cantidad, Enter, y el foco vuelve al lector. El granel madre se cuenta **en kg** (pesado) y cada tamaño de paquete **por paquetes**, en filas separadas.',
              '**Es CIEGO por defecto** (decisión del dueño): el que cuenta no ve cuánto "debería" haber — se cuenta la realidad, no la pantalla. Y el ciego lo impone **la API**, no el CSS: mientras la sesión está en curso, el payload no trae el virtual para quien no tiene la llave de aplicar; ocultarlo solo en pantalla se lee con F12. El jefe puede abrir sesiones no-ciegas.',
              '**Los apartados avisan**: si un renglón tiene mercadería comprometida (separada para envíos), la pantalla lo dice para que no se cuente — sin eso la diferencia daría un sobrante fantasma.',
              '**Cerrar → reporte de diferencias** (lo ve quien puede aplicar): contado vs. sistema, la diferencia **valorizada al costo del día**, faltante/sobrante/neto en pesos, y el botón **Recontar** por renglón — las diferencias grandes casi siempre son errores de conteo. Se reabre, el contador ve los marcados resaltados, recuenta y se vuelve a cerrar.',
              '**Aplicar** (llave `conteos_aplicar`: admin, o el encargado a quien se la des en Usuarios y roles) genera un lote **atómico** de ajustes, cada uno atado a la sesión (`refConteoId`) y con el **costo congelado** — el reporte en pesos de este conteo no cambia el mes que viene.',
            ],
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: '**SE APLICA POR DIFERENCIA, NUNCA POR VALOR ABSOLUTO.** Cada renglón guarda el disponible del instante en que se contó, y al aplicar se ajusta por `contado − ese snapshot` sobre el stock actual. Si el sistema pisara el stock con el contado, resucitaría mercadería legítimamente movida después del conteo. Y como el control se hace con el local cerrado, **cualquier movimiento entre contar y aplicar es una alarma**: la aplicación lo lista con nombre y apellido ("el stock se movió después de contarlo — ¿se vendió algo con el local cerrado?"). **Lo no contado queda como está**: un pendiente no es un cero, es una pregunta sin responder.',
          },
          {
            t: 'nota',
            tono: 'info',
            texto: 'Candados: un producto no puede estar en **dos sesiones abiertas** de la misma sucursal (dos conteos ajustarían dos veces, y el error dice en cuál está). La cajera abre, cuenta, cierra y puede **descartar su sesión virgen**; con renglones contados, tirar ese trabajo lo decide quien puede aplicar. El ajuste de un **paquete no toca a la madre** — un faltante de paquetes es pérdida real, no un error de fraccionamiento (para eso está "Corregir fraccionado").',
          },
          {
            t: 'nota',
            tono: 'ok',
            texto: '**LA PLANILLA DE PAPEL (18/8/2026, pedido tuyo).** Adentro del control, arriba a la derecha de los filtros, está **🖨 Imprimir planilla (N)**: la hoja que se lleva a la góndola, con el membrete de la empresa, el alcance, la sucursal, un renglón por producto —nombre, presentación, código, unidad— y el **casillero en blanco** para anotar a lápiz, más el cuadrito de tildar. Sale **lo que muestra la pestaña elegida** (Pendientes / Contados / Todos) y el número del botón es el que va a salir; el buscador NO la recorta, porque ese campo es el lector y se llena y se vacía todo el tiempo. Dos cosas a propósito: la planilla **NUNCA imprime la cantidad del sistema** —ni cuando el control no es ciego y la pantalla la muestra—, porque un número al lado del casillero es el número que se termina copiando; y los **apartados SÍ van, en negrita**, con el aviso de no contarlos. Después se cargan los números en la pantalla, que es donde el sistema toma el instante de cada renglón. El formato (A4 / Carta / rollo) se elige en **Sistema › Impresión → "Planilla del control de stock"**, y ahí mismo hay vista previa.',
          },
          { t: 'ruta', texto: 'Almacén › Control de stock (contar: sección almacen.conteos · revisar y aplicar: conteos_aplicar)' },
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
    id: 'proveedores',
    titulo: 'Proveedores',
    resumen: 'La relación comercial con cada proveedor: pedidos, cuentas corrientes, echeqs y estados de cuenta. Solo dueño y admin.',
    temas: [
      {
        id: 'prov-que-es',
        actualizado: '2026-08-17',
        titulo: 'Qué es el módulo (y de dónde viene)',
        bloques: [
          {
            t: 'p',
            texto: 'Es la app externa de proveedores (PHP+MySQL) **integrada como módulo del CRM** — la app se apaga y este es el único sistema. Junta lo que antes vivía repartido: a quién hay que pedirle, qué promesas de pago hay firmadas, la cartera de echeqs y cuánto se le debe de verdad a cada uno. **La deuda nace SOLO de la factura cargada en Compras** (o del gasto): acá no se tipean deudas, se administran.',
          },
          {
            t: 'tabla',
            cols: ['Sección', 'Qué es'],
            filas: [
              ['**Pedidos**', 'La pizarra interna (kanban): Solicitado / Pedido / Para retomar, y el historial de ingresos con la demora real'],
              ['**Cuentas corrientes**', 'Los compromisos de pago con fecha. Nacen solos al confirmar la factura de un proveedor diferido'],
              ['**Echeqs**', 'La cartera de echeqs propios. Cobrarlo ES el pago real'],
              ['**Estados de cuenta**', 'El saldo con cada proveedor de mercadería, y la cuenta de cada uno en pantalla propia: el mayor completo, lo impago y el botón para pagarle'],
              ['**Proveedores**', 'El padrón único del sistema: la ficha fiscal y comercial completa'],
            ],
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: 'El módulo es de **dueño y admin** (permisos `proveedores.*`, sembrados solo en el rol admin). La equivalencia con la app vieja: su "REM" acá es **Liquidación**.',
          },
          { t: 'ruta', texto: 'Proveedores (módulo propio en el menú)' },
        ],
      },
      {
        id: 'prov-ficha',
        actualizado: '2026-08-17',
        titulo: 'La ficha única, y qué quedó en Compras',
        bloques: [
          {
            t: 'p',
            texto: 'Desde 0068 hay **una sola ficha de proveedor** y vive acá: identidad (nombre, CUIT, contacto), clasificación (mercadería/gastos, condición de IVA, letra), y lo COMERCIAL de la app vieja — **qué emite** (factura/liquidación/mixto), **cómo cobra** (efectivo, transferencia, depósito, echeq, cta cte), **días de plazo** (obligatorio si cobra diferido), **modo de cuenta** y hasta 5 **cuentas bancarias** (CBU o alias) para transferirle.',
          },
          {
            t: 'tabla',
            cols: ['Modo de cuenta', 'Qué significa'],
            filas: [
              ['**Por facturas**', 'La factura se paga COMPLETA (o la cuota pactada). El sistema rechaza el pago parcial suelto — es el modo de casi todos'],
              ['**Libre**', 'Acepta pagos a cuenta de cualquier importe; la antigüedad de la deuda se calcula por FIFO'],
            ],
          },
          {
            t: 'nota',
            tono: 'ok',
            texto: 'En Compras quedó **Costos y percepciones**: lo OPERATIVO del proveedor que no es su ficha — los costos por producto con la regla masiva, las percepciones que cobra, sus operaciones y su cuenta. Sin alta ni edición: eso se hace acá.',
          },
          { t: 'ruta', texto: 'Proveedores › Proveedores · Compras › Costos y percepciones' },
        ],
      },
      {
        id: 'prov-pedidos',
        actualizado: '2026-08-17',
        titulo: 'Pedidos: la pizarra',
        bloques: [
          {
            t: 'p',
            texto: 'Info interna entre el admin y el encargado de compras, calcada de la app vieja. **No toca stock ni deuda**: la mercadería y la plata entran al cargar la factura en Compras. "+ Solicitar pedidos" tilda varios proveedores y crea una tarjeta por cada uno en **Solicitado**; "Ya lo pedí" registra el pedido hecho por teléfono y entra directo en **Pedido** con fecha de hoy.',
          },
          {
            t: 'lista',
            items: [
              'La tarjeta en Solicitado tiene **Enviado ✓** (se le mandó el pedido) y **Ya lo vi** (el admin la revisó) — marcas que se resetean al mover de columna.',
              '**→ Pedido** cuando se le pidió en serio; **Aparcar** la manda a "Para retomar" (sin fecha, para más adelante).',
              '**✓ Recibido** la saca de la pizarra y la manda al historial de **Ingresos**: cuándo se pidió, cuándo llegó y cuántos días tardó (con la demora promedio del filtro).',
              'Las notas son **texto libre a propósito**: "yerba x 20, harina integral" — es la nota entre ustedes, no un remito.',
            ],
          },
          { t: 'ruta', texto: 'Proveedores › Pedidos (el globito cuenta los no recibidos)' },
        ],
      },
      {
        id: 'prov-ctasctes',
        actualizado: '2026-08-17',
        titulo: 'Cuentas corrientes: los compromisos',
        bloques: [
          {
            t: 'p',
            texto: 'Un **compromiso** es una promesa de pago con fecha. Nace SOLO al confirmar la factura (o liquidación) de un proveedor que cobra **cta cte o echeq**: el alta de la factura muestra la sección "Compromiso de pago" prellenada — una cuota por el saldo, con vencimiento a los días de plazo de la ficha — y se puede partir en **cuotas** editables que tienen que sumar el saldo. También se puede crear un compromiso manual suelto.',
          },
          {
            t: 'p',
            texto: '**El puente**: el compromiso se cierra SOLO cuando el pago salda la factura (con las notas de crédito descontadas), y si ese pago después se anula o desimputa, el compromiso **se reabre solo**. La cuota cerrada por un pago que sigue vivo no se toca. Nunca hay que marcar nada a mano — el botón Pagar de la fila arma el pago con su imputación en un solo paso.',
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: 'El candado del modo **por facturas**: el pago tiene que ser el saldo completo del documento o coincidir con una cuota pactada. Si el proveedor de verdad acepta pagos sueltos, se le cambia el modo de cuenta a "libre" en la ficha.',
          },
          { t: 'ruta', texto: 'Proveedores › Cuentas corrientes (el globito: vencidos + próximos 3 días)' },
        ],
      },
      {
        id: 'prov-echeqs',
        actualizado: '2026-08-17',
        titulo: 'Echeqs: la cartera propia',
        bloques: [
          {
            t: 'p',
            texto: 'Solo echeqs **propios** (emitidos por la empresa). Con la factura del proveedor que cobra así nace el echeq **placeholder** (número "a completar") junto con su compromiso; el número y el banco reales se completan cuando se emite de verdad. Estados: **emitido → entregado → cobrado** (anulado aparte; "vencido" no es un estado — se deriva de la fecha).',
          },
          {
            t: 'nota',
            tono: 'warn',
            texto: '**Cobrar el echeq ES el momento contable**: cuando el banco lo debita, "Cobrar" crea el pago real (medio echeq, con la fecha del débito), lo imputa a la factura y cierra el compromiso — todo junto. Por eso un compromiso de echeq no se paga desde Cuentas corrientes: se cobra desde acá. Un echeq cobrado no retrocede; si el pago estuvo mal, se anula desde Pagos y la cascada reabre todo.',
          },
          { t: 'ruta', texto: 'Proveedores › Echeqs (el globito: vencidos sin cobrar + debitan en 3 días)' },
        ],
      },
      {
        id: 'prov-edoc',
        actualizado: '2026-08-17',
        titulo: 'Estados de cuenta: el saldo real',
        bloques: [
          {
            t: 'p',
            texto: 'La foto global: **saldo = facturado (mercadería) + gastos + ajustes − pagado**, por proveedor. Al lado, lo **comprometido** (compromisos pendientes) y el **proyectado** (saldo − comprometido). El estado sale del documento impago más viejo contra los días de plazo: al día / pendiente / vencido / a favor. **Acá van solo los proveedores de mercadería**: el que solo factura gastos —el plomero, la imprenta— tiene su cuenta en el módulo Gastos.',
          },
          {
            t: 'p',
            texto: 'La fila abre **la cuenta completa del proveedor, en pantalla propia** (antes era un modal apretado): el encabezado con su ficha, el saldo y **de qué está hecho** (mercadería, notas de crédito, gastos, ajustes, pagado), lo que **le queda impago documento por documento** con su botón Pagar, los compromisos pendientes, el **mayor entero con saldo acumulado renglón por renglón** —filtrable por tipo de movimiento, rango de fechas y texto— y las cuentas bancarias para transferirle. Se vuelve al listado con **← Estados de cuenta**.',
          },
          {
            t: 'lista',
            items: [
              '**"Registrar un pago"** está ahí, en la cuenta: el mismo pago de siempre del sistema (su egreso de caja, su arqueo, su bandeja) más la posibilidad de **tildar qué facturas cancela** en el mismo acto. Si tildás documentos, el importe es la **suma exacta** de sus saldos y no se edita: así el pago nunca sobrepasa lo que se debe y siempre pasa el candado del modo "por facturas". Si no tildás nada, queda **a cuenta** —baja el saldo del proveedor— y se aplica después desde la factura.',
              'El pago que deja la factura saldada **cierra sus compromisos solo** (el puente), y **anularlo los reabre**. Anular pide motivo, lo hace solo administración y **solo si el pago no tiene nada aplicado**: con imputaciones vivas hay que desaplicarlas primero desde el documento.',
              'Un pago vive en **una** bandeja: si se tilda una factura de mercadería y un gasto a la vez, la pantalla lo corta y explica que van dos pagos.',
              '**Ajustes manuales** DEBE/HABER con motivo obligatorio: la diferencia de flete, el redondeo que el proveedor perdonó. Sin motivo no se registra.',
              '**"Concilié con su resumen"** deja sellado hasta qué fecha se cuadró con el resumen del proveedor (y se puede quitar).',
              'En cuenta **libre**, la antigüedad es FIFO: lo cobrado cancela primero lo más viejo, y el mayor dice desde qué fecha arrastra deuda.',
              'El pago acepta **multi-forma** (se partió en varios medios, cada parte con su fecha): el mayor muestra el split. El egreso de caja sale solo por la parte en efectivo.',
              'El mayor ordena **por día de calendario** y, dentro del día, primero lo que genera la deuda y después lo que la cancela. Es a propósito: la hora que queda grabada es incidental (el pago se guarda a medianoche del día elegido, la factura con la hora de carga), y ordenando por hora el pago aparecía ANTES de la factura que estaba pagando.',
            ],
          },
          { t: 'ruta', texto: 'Proveedores › Estados de cuenta › (la fila o "Ver cuenta") · los ajustes y las anulaciones, solo admin' },
        ],
      },
      {
        id: 'prov-flete',
        actualizado: '2026-08-18',
        titulo: 'El flete que el proveedor descuenta',
        bloques: [
          {
            t: 'p',
            texto: 'Llega el camión: a la cajera le deja **la factura de la mercadería** y **el remito del flete**, y ella le paga el flete al fletero de su caja. Son dos papeles distintos y el sistema los trata como tales. **La factura se carga tal cual dice**, por su total. El flete queda como plata que ya se le adelantó al proveedor —es de él, no un gasto nuestro— y **se descuenta recién cuando se le paga la cuenta corriente**, que es cuando se decide cuánto transferir.',
          },
          {
            t: 'flujo',
            items: ['La cajera paga el flete', 'El administrativo carga el remito', 'La factura entra por su total', 'Al pagar, se descuenta el flete'],
          },
          {
            t: 'ejemplo',
            titulo: 'Mercadería $100.000, flete $20.000',
            lineas: [
              'Factura de mercadería      $100.000   ← se carga tal cual',
              'Flete pagado de caja        $20.000   ← queda a cuenta del proveedor',
              'Debe el proveedor           $80.000   ← su cuenta corriente',
              '',
              'Al pagar: se tilda la factura y se tilda el flete',
              'A transferir                $80.000',
              'La factura queda            SALDADA   ← $80.000 + $20.000 de flete',
            ],
          },
          {
            t: 'lista',
            items: [
              '**La cajera**: Ventas › Caja › Ingreso / egreso → Egreso → "Pago a un proveedor" → Mercadería → el proveedor → tilde **"Es el flete de esta entrega"**. Sale el egreso de caja con la hora y su nombre —eso ES el recibo: fecha, monto, medio, quién— y queda en Compras › Pagos en sucursal marcado **Flete**.',
              '**El remito lo carga el administrativo**, que es quien tiene el papel: se abre el pago desde Compras › Pagos en sucursal y se completa el **Nº de remito y el transportista**. No toca un solo peso —ni el importe, ni el medio, ni la caja—, así que se puede hacer al día siguiente y con el turno ya cerrado.',
              '**La factura de mercadería no se mezcla**: entra por su total. Los fletes ni siquiera se ofrecen para tomar en el alta ni en el detalle de la factura; ahí solo se avisa que existen y dónde se usan.',
              '**Al pagarle** (Proveedores › Estados de cuenta › Registrar un pago) aparece la sección **"Fletes ya pagados de caja"**. Se tilda la factura y se tildan los fletes: el importe a transferir baja solo y la factura **igual queda saldada**, porque el flete se imputa contra ella en el mismo acto. Si el flete cubre todo, no hay nada que transferir y el botón pasa a decir **"Descontar $X de flete"**.',
              '**El orden importa y es a propósito**: el flete se imputa PRIMERO. Así el saldo de la factura baja a $80.000 y el pago cae por el saldo exacto — pasa el candado del modo "por facturas" sin ninguna excepción. Todo en la misma operación: si el pago falla, el flete vuelve a estar disponible.',
              '**En el estado de cuenta** el movimiento se llama **Flete**, "De qué está hecho el saldo" dice cuánto de lo pagado fueron fletes, y hay un filtro **"Solo fletes adelantados"** que responde *"¿cuánto le adelanté de fletes a este proveedor?"*.',
              '**Si el proveedor reconoce MENOS de lo que se le pagó al fletero** (pagaste $20.000 y te admite $18.000): descontás $18.000 y los $2.000 que sobran quedan en el flete, a la vista. Esa diferencia es un **costo nuestro** y se cierra con un **Ajuste DEBE** en su estado de cuenta, con el motivo escrito.',
            ],
          },
          {
            t: 'nota',
            texto: 'El **flete propio** —el que contratás vos y nadie te reintegra— NO se tilda: eso es un gasto de verdad y va por el módulo Gastos. El tilde solo aparece del lado de mercadería justamente por eso. Y ojo con el otro "flete": el **% de flete del Formato de Compra** es otra cosa —forma parte del costo del producto—; este flete no toca el costo, porque el proveedor te lo devuelve.',
          },
          { t: 'ruta', texto: 'Ventas › Caja › Ingreso / egreso (la cajera) · Compras › Pagos en sucursal (el remito) · Proveedores › Estados de cuenta › Registrar un pago (descontarlo)' },
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
          { t: 'ruta', texto: 'Proveedores › Proveedores (la ficha única del sistema desde 0068 — los ABM de Compras y Gastos se fueron)' },
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
        actualizado: '2026-08-16 12:30',
        titulo: 'Cargar un gasto',
        bloques: [
          {
            t: 'p',
            texto: 'La carga se parece a **leer la factura**, y arranca por el **PROVEEDOR** (rediseño del 16/8/2026): elegirlo completa solo la letra del comprobante y cómo se van a leer los montos. Después se anotan **CONCEPTOS con su monto** —"abono mensual $45.000, reconexión $8.000"— y el total es la suma, solo lectura.',
          },
          {
            t: 'tabla',
            cols: ['Los montos que vas a cargar…', 'Cómo cuenta'],
            filas: [
              ['**…ya incluyen el IVA** (ticket, factura B/C)', 'El total es la suma tal cual. El campo "IVA incluido" es opcional e informativo: no cambia el total, ya está adentro de los montos — por atrás el neto se deriva solo'],
              ['**…son sin IVA y el IVA va aparte** (factura A)', 'Los renglones se tipean **NETOS, tal como los lista el papel**, y el IVA se **calcula solo con la alícuota** (o se copia del pie): se SUMA al total (neto + IVA) y cuadra centavo a centavo. Acá neto e IVA son los del comprobante, no derivados — el crédito fiscal del resumen sale exacto'],
            ],
          },
          {
            t: 'nota',
            tono: 'ok',
            texto: '**EL PIE DE LA FACTURA (18/8/2026, migración 0071, pedido tuyo).** El IVA **se calcula solo**: se pone el neto en el concepto y el sistema lo saca con la **alícuota** que elijas al lado (21 · 10,5 · **27** · sin IVA · a mano). El 27 % no es adorno: **luz, gas, agua y teléfono a responsable inscripto** van a esa alícuota, y son los gastos de todos los meses. Escribir el número a mano pasa el selector a "A mano" y no se vuelve a tocar — el papel manda sobre la cuenta, siempre. En modo "ya incluyen el IVA" la cuenta es al revés (lo **desagrega** de los montos) y el total no se mueve. Y abajo, tres campos propios: **Impuestos internos**, **Percepción D.G.I.** y **Percepción D.G.R. (Ingresos Brutos)**, que SUMAN al total en los dos modos. Van separados porque terminan en lugares distintos: la de D.G.R. se computa contra Ingresos Brutos, la de D.G.I. contra el impuesto nacional, y los internos no se recuperan (son costo). En una sola bolsa eso no se puede reclamar.',
          },
          {
            t: 'lista',
            items: [
              '**Un importe sin concepto NO se suma, y ahora lo dice.** El renglón necesita el texto ("de qué es") para contar; si escribís el monto y dejás el concepto vacío, el Neto se queda en $0,00. Antes pasaba **en silencio** y no había forma de saber por qué; ahora aparece el aviso al lado del Neto y el guardado se planta.',
              '**El modo lo trae la LETRA**: elegir un proveedor que factura A (o poner la letra A a mano) pasa el selector a "sin IVA" solo — y queda editable, porque la excepción existe. Un IVA mayor que el neto se rechaza: no salió de ninguna factura.',
              '**La LETRA viene del proveedor**: en su ficha se responde una vez "qué factura hace" (A/B/C/X) y el formulario la precarga al elegirlo. El selector la muestra al lado del nombre ("Edesur · factura A").',
              '**El selector ofrece solo proveedores de GASTOS**: a los de mercadería se les carga factura en Compras. Si uno de mercadería también factura gastos (el flete aparte, un service), se le tilda **Provee gastos** en su ficha — el padrón es uno y las dos casillas conviven.',
              '**Sucursal o General**: el gasto se imputa a una sucursal o a "General (toda la empresa)". Para quien no es jefe queda clavado en la suya.',
              '**Guard de duplicado:** con proveedor y número, la combinación tiene que ser única. Cargar dos veces la misma factura es EL error clásico de un módulo de gastos, y se descubre tarde — cuando el resumen del mes no coincide con el banco.',
              '**"¿Cómo se pagó?":** el caso más común es cargar y pagar en el mismo acto — vino el plomero y se le pagó del cajón. La casilla registra el pago junto con el gasto; con efectivo y turno abierto ofrece **"Sale de la caja de [tu sucursal] — turno #N"**: el egreso queda en el arqueo de esa noche, con hora y nombre. Solo se puede sacar del cajón de la sucursal con la que entraste, y registrar el pago exige su permiso propio. Cubre **el resto**: lo que los pagos de sucursal tomados no explican.',
            ],
          },
          {
            t: 'nota',
            tono: 'info',
            texto: 'LO QUE SE FUE DEL FORMULARIO el 15/8/2026 (decisión del dueño): **"O anotalo a mano"**, la **Descripción** libre y el selector de **Negocio** (los gastos son siempre de Sabor y Aroma). Nada se fue de la BASE: los gastos viejos conservan sus campos, los gastos fijos generados siguen usando el camino anterior, y la descripción ahora se escribe sola con los conceptos — por eso el listado y la búsqueda siguen mostrando lo mismo de siempre. Los gastos del negocio Cafetería que existían siguen contando en su métrica; los nuevos nacen todos como Distribuidora.',
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
            texto: 'La cuenta corriente del proveedor pasó a ser real: comprado (mercadería + gastos) − pagado. Antes solo podía crecer, porque no había dónde registrar que se le pagó. Se ve en **Proveedores › Estados de cuenta**, clic en la fila (desde 0068 el mayor completo vive allá).',
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
        actualizado: '2026-08-19',
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
              ['**20/8/2026**', '**LA NOTA DE CRÉDITO: la única forma de deshacer una factura (fase 7 de 8, migración 0076).** Hasta hoy, "Anular" borraba cualquier venta. Con una factura que tiene CAE eso es imposible: **el comprobante ya existe para ARCA**, y borrarlo acá solo lograría que los dos sistemas dejen de coincidir. Ahora el detalle de la venta muestra **una puerta o la otra, nunca las dos**: con CAE aparece "Nota de crédito", sin CAE (ticket interno, o factura que todavía no se emitió) sigue apareciendo "Anular". Y `anular()` tiene el candado del lado del servidor, que es donde vale. **Total y parcial son el mismo circuito**: la nota total es simplemente la que lleva todos los renglones completos, así que no hay dos botones ni dos caminos que puedan divergir. La pantalla pide **tres cosas que el sistema no puede adivinar**: qué renglones vuelven y por cuánto (el precio y el IVA son los de la venta ORIGINAL, no los de hoy — si el producto aumentó, no es problema del cliente); **si la mercadería vuelve al stock** (una nota por un error de precio no mueve un gramo; una devolución sí — son la misma nota y distinta cosa); y **si se devuelve el efectivo por caja** (va apagado a propósito: hacerlo automático le descuadraría el arqueo a quien no lo esperaba). **ARCA no tiene "nota de crédito" a secas**: tiene una por letra —3 (A), 8 (B), 13 (C)— con numeración propia, y la letra tiene que ser la misma que la de la factura que ajusta; además el comprobante viaja con el **asociado** declarado, sin lo cual la nota queda huérfana en el libro de IVA. Todo lo que sumaba ahora **resta**: la cuenta corriente del cliente (la nota le baja la deuda al comprobante que ajusta y **no aparece como algo para cobrar** — imputarle un recibo está bloqueado, sería cobrarle al cliente su propia devolución), los totales del listado ("Vendido" ya viene neto y las notas se muestran aparte), el débito fiscal de Gerencia y el margen por producto (una devolución que sumara diría que la mercadería se vendió DOS veces). **No se puede devolver lo mismo dos veces**: se descuenta renglón por renglón lo que las notas anteriores ya acreditaron, y "toda la venta" quiere decir *todo lo que queda*, no lo que decía la factura. **El centavo del redondeo**: partir una factura en dos notas redondea el IVA dos veces, así que la suma puede quedar $0,01 abajo del total — ese centavo no se puede acreditar (no hay mercadería que lo respalde y ARCA no toma una nota de un centavo), así que lo que queda por acreditar **se mide en mercadería, no en plata**, y la cuenta corriente lo perdona en vez de dejar la factura pidiendo $0,01 para siempre. La nota **se imprime sola** al emitirse, siempre por la plantilla fiscal (el ticket del POS dice "cómo se pagó" y un total que entró: usarlo para una devolución diría lo contrario de lo que pasó), con su letra, el comprobante asociado, el motivo y el IVA discriminado si es A. **Verificado con 34 pruebas** contra la base real —incluida la identidad de que las dos notas suman la factura al centavo— y **a mano en pantalla**, emitiendo una nota parcial de 2 de 4 unidades y viendo el stock volver de 8 a 10.'],
              ['**19/8/2026**', '**FACTURACIÓN ELECTRÓNICA — la factura impresa con su QR (fase 5 de 8).** El papel fiscal. **La factura REEMPLAZA al ticket**, no se suma: si salieran los dos, el cliente no sabría cuál vale, y solo uno tiene validez. Las tres pantallas que sacan papel —el cobro, el "Reimprimir" del punto de venta y el detalle del listado— pasaron a llamar a un único `imprimirVenta()` que decide: **con CAE sale la factura, sin CAE el ticket de siempre**. Antes cada una armaba lo suyo, y tres copias de la misma decisión terminan divergiendo. **La diferencia entre A y B no es cosmética, es la ley**: la **Factura A** (a un responsable inscripto) DISCRIMINA el IVA — renglones en neto, columna de alícuota, y al pie neto gravado + IVA por alícuota + total, porque el cliente se computa ese IVA como crédito fiscal; la **Factura B** (consumidor final, monotributo o exento) **no lo discrimina** — renglones con el impuesto adentro y solo el total, que además es la regla de la casa. Lleva todo lo que exige la RG 1415: recuadro con la letra y el código (A/COD. 01, B/COD. 06), datos del emisor y del receptor con su condición frente al IVA, CAE y vencimiento del CAE. **El QR de la RG 4892** lo arma la API (ahí viven la tabla de códigos y el CUIT del certificado; hacerlo del otro lado sería duplicar las dos y que un día apunten a un comprobante que no existe) y el navegador lo dibuja **como SVG en línea** — la CSP del documento impreso prohíbe todo script, así que no se puede generar en la página, y un SVG escala sin perder nitidez donde un rasterizado se lee mal en una térmica de 203 dpi. El formato arranca en **rollo** porque reemplaza al ticket y sale de la misma impresora; se pasa a A4 desde Sistema › Impresión si el fuerte pasa a ser la Factura A del mayorista, y tiene **vista previa** con la misma función que imprime la de verdad. **Un detalle que salió mirando la vista previa**: el importe con IVA de cada renglón se arma como `neto + redondeo(neto × alícuota)`, igual que el sistema construyó el total al cobrar — calcularlo como `neto × 1,21` puede diferir un centavo, y en una factura que los renglones no sumen el total lo nota el cliente.'],
              ['**19/8/2026**', '**FACTURACIÓN ELECTRÓNICA — el enganche (fase 4 de 8, migración 0075).** El módulo `arca/` dejó de estar suelto: la venta ahora pide el CAE de verdad. **Lo importante es la NUMERACIÓN**: hasta hoy el número salía de un contador local (`max+1`), y la numeración fiscal **la lleva ARCA** — un contador propio no puede competir con ella (apenas se desincronizan, ARCA rechaza todo). Ahora, cuando el comprobante es fiscal, el número y el punto de venta vienen de ARCA; el correlativo local queda para los tickets internos. Y el punto de venta de web services es OTRO que el de los tickets: tienen numeraciones independientes. **Tres problemas resueltos que no son del protocolo**: (1) **dos cajas facturando a la vez** pedirían el mismo número — se serializa por tipo de comprobante (A y B no se pisan entre sí porque sus numeraciones son independientes), y si igual se cruzan, el "10016" de ARCA se reintenta una vez pidiendo el número de nuevo; (2) **la respuesta que se pierde** (ARCA emite y el timeout se come la respuesta) es la que genera facturas DUPLICADAS: se cubre en dos capas — en el acto se consulta el número, y además la venta **guarda el número reservado antes de pedirlo** (0075), así el reintento de mañana consulta en vez de emitir de nuevo; (3) **el ticket de acceso se pide al ARRANCAR la API**, no en la primera venta: medido contra el WSAA real, pedirlo tarda **10 segundos** y el resto de las llamadas uno o dos — sin esto, la primera factura del día (y la primera después de cada deploy) se comía diez segundos con un cliente esperando. **Se separó lo que se quiere de lo que se puede**: el interruptor de Configuración es la INTENCIÓN y el certificado la CAPACIDAD. Apagado, todo sale como siempre; prendido sin certificado, sale el ticket provisorio **y el motivo dice exactamente qué falta** ("Falta ARCA_CUIT…") en vez del genérico de antes. **Verificado**: con ARCA apagado la venta sale idéntica a ayer (factura_b, numeración local, sin CAE) — o sea que nada se rompió; prendido sin certificado, provisorio con el motivo preciso, y el reintento contesta lo mismo; y **el WSAA real de homologación aceptó y parseó nuestra firma CMS**, rechazando el certificado por identidad ("Certificado bloqueado"), que es exactamente lo que tiene que pasar con uno autofirmado. Falta el certificado real.'],
              ['**19/8/2026**', '**FACTURACIÓN ELECTRÓNICA — el módulo `arca/` (fase 3 de 8, migración 0074).** Trajiste la guía de la implementación que ya funciona en la cafetería y se armó el protocolo acá, adaptado. **La diferencia grande**: aquella es Monotributo y emite Factura C (sin IVA); ustedes son **Responsable Inscripto**, así que van **Factura A y B con el IVA discriminado por alícuota** — el comprobante lleva un renglón por alícuota con su base y su importe, y las sumas tienen que cerrar **al centavo** contra el neto y el IVA de la cabecera. Como el sistema redondea renglón por renglón (para que el ticket cierre consigo mismo), la diferencia se le carga al renglón más grande: probado con tres renglones de $33,33 que suman $99,99 contra una cabecera de $100, y cierra exacto. **Lo construido**: el interruptor (sin certificado, la facturación queda dormida y el sistema opera igual — es lo que permite desplegar sin riesgo); el **WSAA** con firma CMS por `node-forge` (no el binario `openssl`: el contenedor viene pelado) y cache en tres niveles memoria→base→ARCA, **con el entorno adentro de la clave** (un ticket de homologación en producción traba la facturación 12 horas); el **WSFE** con `FEDummy`, `FECompUltimoAutorizado`, `FECAESolicitar` y `FECompConsultar` —esta última es la que evita duplicados si la respuesta de ARCA se pierde en el camino—; y el script `probar.ts`, que hace las tres llamadas de solo lectura del §2.4. **Verificado de verdad**: las fechas dan idénticas bajo cinco zonas horarias (incluido el instante que cruza la medianoche UTC, donde la fecha argentina y la del servidor son días distintos — es la trampa que rompe en producción), y **`FEDummy` responde OK/OK/OK contra el ARCA de homologación real en 322 ms**, o sea que el SOAP está bien armado. Los certificados **nunca entran a la imagen de Docker** (van en volumen montado; el `.dockerignore` los bloquea) porque la imagen se reconstruye entera en cada deploy.'],
              ['**19/8/2026**', '**ARCA CAÍDO NO ES VENTA CAÍDA: el ticket provisorio y la pestaña Sin facturar.** El principio: la venta del mostrador **nunca depende de que ARCA conteste** — el cliente está parado enfrente. Si el cajero pide Facturar (F8) y el servicio no responde, la venta **se confirma igual** como ticket interno: la mercadería sale, la plata entra al turno, el ticket se imprime con la leyenda "**SERVICIO DE ARCA NO DISPONIBLE — COMPROBANTE PROVISORIO, PENDIENTE DE FACTURACIÓN**" (esa leyenda no se puede apagar: es la explicación que se lleva el cliente), y el cajero ve el aviso de que quedó pendiente. La venta aparece en **Ventas › Ventas** bajo la pestaña **⚠ Sin facturar (N)** —el globito es global, avisa aunque estés mirando otro día, y al entrar el rango salta a "Todo" para que nada quede escondido detrás del filtro "Hoy"— y cada fila tiene su botón **Facturar**: reintenta la emisión, y es inocuo (no toca plata, stock ni turno — se puede apretar mil veces; si ARCA sigue caído, dice por qué y la venta queda donde estaba). Al lograrse, la venta **pasa a ser la factura** (letra según el cliente, número nuevo del correlativo fiscal) y el rastro del provisorio queda escrito en sus observaciones. El pedido de CAE corre **antes** de la transacción de stock (un servicio lento no puede dejar la caja colgada) y un medio que "exige factura" acepta el provisorio pendiente — la intención de facturar quedó registrada. **La costura**: `solicitarCae()` es el único punto que hablará con el WSFE; hoy, con el interruptor de ARCA prendido en Configuración, contesta "integración no conectada" — o sea que **prenderlo ensaya el circuito de caída completo**, que es exactamente como se verificó (migración 0073).'],
              ['**19/8/2026**', '**LOS MEDIOS DE PAGO SE TRABAJAN UNO POR UNO, Y ALGUNOS EXIGEN FACTURA.** En Ventas › Configuración, "Medios de pago" dejó de ser una lista de texto libre (que permitía tipear medios que ninguna pantalla usaba, porque el cobro y las cobranzas filtran contra el catálogo real) y pasó a ser la **tabla del catálogo con dos tildes por medio**: *Habilitado* (aparece al cobrar y en cobranzas) y **Exige factura** — la regla nueva, tuya: un peso cobrado con ese medio **bloquea Liquidar**, la venta sale facturada sí o sí. El caso típico es lo bancarizado (transferencia, tarjetas), que deja rastro. En el cobro el aviso aparece **apenas se elige el medio** (no cuando el botón rebota): Liquidar queda apagado con el cartel "*Transferencia exige factura: se factura (F8) o se cobra con otro medio*", y F10 contesta el porqué en vez de no hacer nada. Solo cuentan los renglones **con importe** (una transferencia en $0 no obliga), y **la API lo revalida al confirmar** en los dos caminos (el cobro de caja y el alta directa) — un POS desactualizado no puede esquivarlo. Deshabilitar un medio le destilda el exige solo, para que no quede una regla colgada de un medio que no existe. **Quedó todo destildado: tildá vos cuáles exigen factura.**'],
              ['**19/8/2026**', '**TODO PRECIO DE LISTA SE MUESTRA CON EL IVA ADENTRO.** Lo pediste mirando Alt+F3: la ficha del producto decía $149 y la consulta $123,14, y no se entendía qué precio era. Eran el mismo — la consulta mostraba el NETO (la moneda interna del motor, que suma el IVA al total) sin decirlo. Regla nueva, tuya: **los precios al público llevan el IVA incluido, siempre, en cualquier lista**. El catálogo del POS ahora viaja con los dos números (el neto para el motor, el **final** para mostrar, calculado con el redondeo de góndola exacto) y las cuatro pantallas que contestan "¿cuánto está?" muestran el final: **Alt+F3** (Mostrador y Otras listas, con el subtítulo que lo dice), el **buscador del punto de venta**, la **Carga rápida (Ins)** (sugerencias y el "Agregado") y la **Búsqueda masiva (Shift+Ins)** (todas las columnas de lista, con la aclaración al pie). El círculo cierra a la vista: el buscador dice $149,00, el renglón trabaja a $123,14 neto, y el pie suma Neto $123,14 + IVA $25,86 = **TOTAL $149,00** — el cliente escucha el mismo número que después paga. **El renglón del ticket queda en neto a propósito**: es la estructura del documento (neto → IVA → total, como la factura) y el ticket impreso ya salía con los finales. **Dos arreglos que salieron de revisar el circuito completo**: el fallback de la etiqueta de balanza dividía el importe (que viene CON IVA impreso) por el precio neto — la cantidad daba inflada un 21% cuando la etiqueta no traía el peso—, ahora divide por el final; y el catálogo del POS ignoraba el redondeo PROPIO del producto (usaba solo el global), así que un producto con redondeo especial podía mostrar en el POS un precio que ninguna etiqueta imprimió — ahora usa el mismo criterio que la ficha.'],
              ['**19/8/2026**', '**EL AJUSTE DE STOCK TIENE SU PUERTA EN EXISTENCIAS.** Preguntaste si existía, y la respuesta era "sí, pero sin puerta": el movimiento manual (tipo **Ajuste**, con entrada o salida, motivo y permiso `inventario`) estaba completo en la API y en el modal desde la revisión del 13/8, pero el único lugar que lo abría era una pantalla interna de Vencimientos. Ahora cada fila **disponible** de Almacén › Existencias tiene su botón **Ajustar** (solo para quien tiene la llave `inventario` — vos como superadmin la tenés), que abre el movimiento **prellenado con la fila**: producto, sucursal y presentación, con el tipo ya en Ajuste. Solo filas disponibles a propósito: lo comprometido/vencido/defectuoso tiene sus circuitos (transferencias, vencimientos, incidencias) y ajustarlo desde acá los descuadraría. **El motivo pasó a ser obligatorio para el ajuste** —en la pantalla y en la API— porque "Ajuste −1" sin porqué es el movimiento que nadie puede explicar después; los otros tipos se explican solos (una merma ES el motivo). Todo queda en el **historial del producto** (detalle → Últimos movimientos) y en Compras › Historial, con cantidad, motivo y quién lo hizo. **Y un bug destapado por la prueba**: el modal mandaba la cantidad y el signo como TEXTO, y desde que los controllers del almacén validan estricto (13/8) todo movimiento manual rebotaba con un error de constraints — nadie lo había pisado justamente porque el modal no tenía puerta. Verificado completo: el ajuste sin motivo rebota en la pantalla y en la API, el de −2 con motivo bajó el stock de 10 a 8 y quedó en la ficha con su texto y su autor.'],
              ['**19/8/2026**', '**EL % SIN FACTURA YA NO CORRE SOBRE EL FLETE.** Lo corregiste el mismo día, probando con el Salvado de Avena de 3 ARROYOS ($1.000 + 10% de flete): la base daba $909,09 porque el sistema le sacaba el IVA también a los $100 del flete, como si el flete viniera adentro de la liquidación. Y no viene: **el flete es un costo tuyo, pagado aparte a un tercero** — ahí no hay IVA que absorber. Ahora la cuenta parte SOLO la mercadería (base $826,45 + flete entero $100 = **$926,45**, IVA absorbido **$173,55** en vez de $190,91) y "Le pagás al proveedor" quedó en $1.000 justos, con el flete en su propia línea ("y el flete lo pagás vos, aparte"). El error regalaba 17,36 centavos por cada peso de flete en cada venta. Ningún dato quedó mal escrito: el tuyo era el único formato con % cargado y no había ventas congeladas con %.'],
              ['**19/8/2026**', '**LA MERCADERÍA SIN FACTURA, Y GERENCIA › RENTABILIDAD (migración 0072).** Lo pediste con tu truco del sistema viejo: comprás en liquidación a $100, le descontás 17,36%, el sistema le suma el 21% y quedás en $100 — así el cliente no paga un IVA que vos nunca pagaste, y ese IVA lo absorbés vos. Ahora es una **cuenta, no un número de memoria**: el Formato de Compra tiene **"Sin factura %"** (100 = liquidación pura, 50 = mitad y mitad) y el sistema parte el costo en dos — el **costo real** (valúa stock, pérdidas y transferencias: lo que pagaste) y la **base del precio** (lo que multiplica el markup, con la parte sin factura despojada del IVA que vas a absorber). Vale para **cualquier alícuota** (el 10,5 da su propio número, no el 17,36) y la cadena de la pantalla muestra todo: base, costo real, IVA absorbido y **lo que le pagás al proveedor** — que es exactamente base × 1,21, la prueba de que la cuenta es la tuya. El % se **precarga de la ficha del proveedor** ("Qué emite" ganó su número: liquidación = 100 solo) y se ajusta por producto; tu 50/50 real da **8,68%**, no el 8,36 aproximado de antes. **El markup se sigue cargando igual** — lo que cambia es que ahora se ve la verdad: con 40% de markup en un producto todo en negro la **ganancia real es 15,7%**, y esa diferencia dejó de estar invisible. Para eso, **cada renglón de venta congela su costo** al confirmarse (costo real + IVA absorbido + el %) — sin eso no hay margen medible, porque el costo de hoy no es el de la venta de marzo. Y sobre ese dato se construyó **Gerencia › Rentabilidad** (el permiso ya existía): margen real contra aparente, IVA absorbido del período, venta y stock de lo sin factura (con el IVA que falta absorber si se vende todo), débito vs. crédito fiscal, la tabla por **producto / marca / categoría / proveedor** con su filtro, y el **control por proveedor**: lo que facturó de verdad (facturas vs. liquidaciones) contra el % declarado en su ficha — si difieren en serio, avisa que el costo de sus productos está mal partido. Los renglones anteriores a hoy no tienen costo congelado y el panel **lo dice en vez de inventar** (se saltean del margen; el aviso muere solo a medida que se vende). Verificado de punta a punta con un circuito real: liquidación que ingresa stock → venta → congelado exacto ($100 real / $17,36 absorbido) → panel con todos los números cruzados a mano → control del desvío saltando (declaró 50%, entró 100% por liquidación). Los precios de todo lo facturado **no se movieron ni un centavo** (con 0% las dos columnas son el mismo número de siempre)'],
              ['**18/8/2026**', '**LA BÚSQUEDA DEL POS MIRA TU SUCURSAL, Y FACTURAR PASA A F8.** Dos pedidos tuyos. (1) El Shift+Ins abría una columna de stock por cada sucursal —seis— y el precio quedaba fuera de la pantalla; ahora muestra **solo la de la caja con la que entraste** y el pie lo dice con nombre y apellido. No es solo espacio: con las seis a la vista, el cajero de Fontana termina prometiendo mercadería que está en la Distribuidora. (2) Las columnas de precio quedaron **agrupadas por modalidad, Minorista primero y Mayorista después**, y adentro por número de lista. El orden lo decide la **configuración** (el `orden` de las modalidades en Formato de Venta), no una lista escrita en el código: si mañana agregás una modalidad, entra sola donde corresponde. (3) **Facturar es F8** (antes F7) en el cobro: cambia el atajo, el cartel del botón y el mensaje que aparece cuando querés liquidar una cuenta corriente. F10 sigue siendo Liquidar.'],
              ['**18/8/2026**', '**EL PIE DE LA FACTURA DE GASTO: el IVA se calcula solo, y entran Impuestos internos, D.G.I. y D.G.R. (migración 0071).** Lo probaste y reportaste que "no suma el IVA": **el importe estaba bien, lo que faltaba era el CONCEPTO**. El renglón necesita el texto para contar, y sin él se descartaba **en silencio** —Neto en $0,00 y ninguna explicación—, así que el número terminó tipeado en la casilla del IVA y el total salió de ahí. Ahora ese caso avisa al lado del Neto y no deja guardar. Lo pedido: **el IVA se saca solo del neto** con una alícuota al lado (21 · 10,5 · **27** · sin IVA · a mano); el 27 % está porque luz, gas, agua y teléfono a responsable inscripto van a esa alícuota. Escribirlo a mano lo congela: el papel manda. En modo "ya incluyen el IVA" lo desagrega y el total no cambia. Y el pie se abrió en **tres campos propios** —Impuestos internos, Percepción D.G.I. y Percepción D.G.R.— que suman al total: separados a propósito, porque cada uno se computa después contra un impuesto distinto (D.G.R. contra Ingresos Brutos, D.G.I. contra el nacional) y los internos no se recuperan. En una sola bolsa no se puede reclamar ninguno. El detalle se ve en el gasto y el candado del gasto ya pagado también los cubre.'],
              ['**18/8/2026**', '**LA PLANILLA DE PAPEL DEL CONTROL DE STOCK.** Pedido tuyo, y era el pendiente "fase 2" de esta pantalla. Adentro del control apareció **🖨 Imprimir planilla (N)**: la hoja con membrete, alcance y sucursal, un renglón por producto con su presentación, código y unidad, el **casillero en blanco** para el lápiz y el cuadrito de tildar. Imprime **lo que muestra la pestaña** (Pendientes / Contados / Todos) y el número del botón es el del papel — el buscador no la recorta, que es el campo del lector y se vacía a cada rato. Lo que **no** lleva, a propósito: la cantidad del sistema, ni siquiera cuando el control no es ciego y la pantalla la muestra, porque un número impreso al lado del casillero es el número que se copia y ahí el control deja de controlar. Lo que **sí** lleva, también a propósito: los **apartados en negrita** con el aviso de no contarlos, que es el error que la pantalla ya evitaba y en papel se repetía. El formato se elige en **Sistema › Impresión → "Planilla del control de stock"** (arranca en A4; en rollo de 80 mm no queda lugar para escribir) y tiene vista previa.'],
              ['**18/8/2026**', '**SE CIERRA EL INGRESO DE MERCADERÍA A MANO: la mercadería entra por la factura.** Pedido tuyo. Almacén › Existencias tenía arriba a la derecha un botón **"+ Compra (ingreso)"** que sumaba stock cargando producto, cantidad y sucursal, sin papel detrás. Convivía con el circuito real —la **factura de compra**, que es la que trae el costo, el proveedor y la deuda— y esa convivencia era el problema: el mismo kilo podía entrar dos veces (una a mano y otra con la factura), el costo del producto no se actualizaba, y el proveedor quedaba sin la deuda que sí existía. **Se sacó el botón, la pantalla que abría y también la puerta del servidor** (`POST /operaciones/compra`): ya no hay forma de sumar stock salteando el papel, ni desde la pantalla ni tocando la API. Existencias queda como lo que es, **consulta pura**. Si aparece un faltante o un sobrante contando la góndola, eso es **Control de stock**; si algo se rompió o venció, **Incidencias** o **Vencimientos**. El motor de ingreso sigue vivo adentro: es el que usa la factura al confirmarse.'],
              ['**18/8/2026**', '**EL DASHBOARD DEL MENÚ MUESTRA EL INVENTARIO DE VERDAD, y Compras se queda sin su pestaña.** Pedido tuyo, y de paso destapó algo: la pantalla **Dashboard** del menú principal mostraba métricas de EJEMPLO —ventas de $184.500, "Panadería El Sol", "María G."— que venían de la plantilla original y nunca se cablearon, mientras el resumen real estaba escondido en una pestaña adentro de Compras. Estaba exactamente al revés: datos inventados en la puerta de entrada y los verdaderos adentro. Ahora el Dashboard abre con el **valor del inventario disponible, los productos, el stock bajo y el comprometido, el stock por sucursal y los últimos movimientos**, y cada tarjeta tiene su "Ver todo →" que **cae en la sección exacta** (Existencias en Almacén, Productos e Historial en Compras) gracias a un `?panel=` nuevo que las dos páginas entienden — si el rol no tiene esa sección, el link se ignora y entra por la primera visible: un enlace no puede abrir lo que el permiso no deja ver. **Los datos falsos se borraron** (no se dejaron "por las dudas": una cifra inventada en pantalla la lee alguien como si fuera cierta). **La pestaña Dashboard de Compras ya no existe** y su permiso `compras.dashboard` se sacó del catálogo y de los roles (migración 0070) — nadie pierde nada, porque el Dashboard usa el permiso general y le muestra el resumen a quien tenga alguna sección de Compras o Almacén. **Un cuidado que se agregó**: el valor del inventario es dato sensible, así que a un rol que no llega al inventario el Dashboard no se lo muestra; antes tampoco lo veía y no es esta mudanza la que debería dárselo. De paso, los "Ver todo" eran `<span>` con un clic encima: ahora son botones, así se llega con el tabulador y un lector de pantalla los anuncia'],
              ['**18/8/2026**', '**EL FLETE QUE SE PAGA EN EFECTIVO Y EL PROVEEDOR DESCUENTA (migración 0069).** Estaba en stand by y lo sacaste explicando el circuito real: llega el camión, a la cajera le dejan **la factura de la mercadería y el remito del flete**, ella paga el flete de su caja, y el descuento contra el proveedor **se hace al pagarle la cuenta corriente** —que es como se trabaja con estos proveedores, saldando durante la semana—. La primera versión de esto lo descontaba al cargar la factura y **estaba mal**: vos lo corregiste y se rehízo entero. Ahora: la cajera tilda **"Es el flete de esta entrega"** al registrar el egreso (Caja › Ingreso / egreso › Pago a un proveedor › Mercadería) y sale el egreso con su hora y su nombre, que ES el recibo; **el remito lo carga el administrativo**, que es quien tiene el papel, abriendo ese pago desde Compras › Pagos en sucursal — completar el número no toca ni el importe ni la caja, así que se hace al otro día y con el turno cerrado; **la factura de mercadería entra por su total, tal cual dice el papel** (los fletes ni se ofrecen para tomar ahí, solo se avisa que existen); y al pagarle, en Proveedores › Estados de cuenta › Registrar un pago, aparece **"Fletes ya pagados de caja"**: se tilda la factura y se tildan los fletes, el importe a transferir baja solo y la factura **igual queda saldada**. Si el flete cubre todo, no hay nada que transferir y el botón pasa a "Descontar $X de flete". **El orden es a propósito**: el flete se imputa PRIMERO, así el saldo baja y el pago cae por el saldo exacto — pasa el candado del modo "por facturas" sin ninguna excepción, y todo en la misma operación (si el pago falla, el flete vuelve a estar disponible). Se verificó el circuito completo contra la API real, más las guardas: un pago común no se puede colar por la puerta de los fletes, un flete de otro proveedor tampoco, y un flete contra la cuenta de gastos se rechaza. **De paso, un bug visual viejo de todo el sistema**: la regla CSS de los formularios le daba ancho completo a TODOS los input, así que cualquier casilla suelta se dibujaba como una raya de 427 px de ancho por 13 de alto. Apareció midiendo el tilde nuevo y se arregló para todos los modales de una vez'],
              ['**17/8/2026**', '**EL ESTADO DE CUENTA DEL PROVEEDOR ES UNA PANTALLA, Y DESDE AHÍ SE LE PAGA.** Los tres pedidos tuyos, hechos. (1) **Ya no es un modal**: la fila del listado abre la cuenta completa a pantalla ancha — encabezado con su ficha, el saldo y **de qué está hecho** (mercadería, notas de crédito, gastos, ajustes, pagado), **lo que le queda impago documento por documento** con su saldo real (las notas ya descontadas), los compromisos pendientes, el **mayor entero con saldo acumulado renglón por renglón** y filtros (tipo de movimiento, desde/hasta, buscador), y las cuentas bancarias. Cada pago del mayor muestra **quién lo registró, de qué turno salió y cuánto quedó sin aplicar**. (2) **"Registrar un pago" está ahí**, que era lo que faltaba: es el pago de siempre del sistema —con su egreso de caja y el puente que cierra compromisos— y permite **tildar qué facturas cancela** en el mismo acto; tildando, el importe es la suma EXACTA de esos saldos y no se edita (nunca se paga de más y siempre pasa el candado del modo "por facturas"), y sin tildar nada el pago queda **a cuenta**. Se puede **anular** con motivo, solo administración y solo si no tiene nada aplicado. (3) **Acá van solo los proveedores de mercadería**: el que solo factura gastos queda en su módulo. **Dos errores de lógica que salieron verificando en pantalla**: el saldo acumulado del mayor no cerraba leído de abajo hacia arriba (la tabla se dibujaba con un orden y el acumulado se calculaba con otro), y ordenando por la HORA del movimiento el pago aparecía antes de la factura que estaba pagando —la hora es incidental, se ordena por día de calendario y dentro del día primero lo que genera la deuda—. Verificado con la factura real de Bavosi y un circuito de prueba completo (factura en 2 cuotas → pagarla → las cuotas se cerraron solas → pago a cuenta → anularlo → ajuste → borrarlo), y todo lo de prueba borrado.'],
              ['**17/8/2026**', '**"Solicitar pedidos", rediseñado: buscador + lista compacta + chips de los elegidos.** Con los 169 reales la lista de tildes se veía torcida, y el culpable medido fue el CSS global de formularios: le pone ancho completo a TODOS los `input`, así que cada checkbox nativo flotaba en 240 px. La lista nueva no usa checkbox ni label: **filas-botón** de una columna, compactas, con el tilde dibujado a la izquierda y el nombre en una línea; la fila entera es clickeable y la elegida queda resaltada. Los elegidos aparecen como **chips arriba de la lista**, siempre a la vista, con su × para sacarlos — no dependen del scroll ni desaparecen al seguir filtrando. El botón Solicitar sigue contando.'],
              ['**17/8/2026**', '**EL ALTA DE PRODUCTO, EN DOS ETAPAS — y nace con su proveedor completo.** Lo pediste mirando el formulario: primero **el producto en sí** (tipo, identificación, concepto, clasificación y valores) y recién al Continuar la segunda etapa, **con quién llega**: el proveedor, **el código con el que ÉL lo llama** (el de su lista y su factura, que es el que la lectura del PDF reconoce), la **escala de descuentos en cascada** y el **flete %** — los mismos campos del Formato de Compra, pedidos de entrada para que el producto nazca completo y con el precio fijado por su primer proveedor. El costo de lista es opcional: si no se sabe, lo trae la primera factura. La sección **Tienda quedó solo informativa**, sin campos — el producto aparece en el sitio cuando tiene precio Mayorista, y el destacado y la foto viven en el módulo Web. Elegir proveedor sigue siendo opcional ("Elegir después") y la edición del producto sigue siendo una sola pantalla: el proveedor ya vive en su Formato.'],
              ['**17/8/2026**', '**EL RESET: se terminaron los datos de prueba — el padrón REAL adentro y el sistema en cero.** La etapa final del módulo Proveedores, tal como se decidió: **se borró TODO el movimiento de desarrollo** (ventas, compras, gastos, pagos, cajas, stock, conteos, transferencias, incidencias, vencimientos, ofertas de prueba, analytics del sitio y el chat) y **se importaron los 169 proveedores reales** del CSV de la app vieja, con su condición (los 34 "Remito" entraron como Liquidación), su medio habitual, sus días y su modo de cuenta (3 ARROYOS y PECANES en cuenta libre). **El catálogo quedó INTACTO** — 228 productos, 228 formatos de compra, 238 presentaciones — porque Bavosi y Nuevo Cosmos no se reimportaron: se les pisó la ficha con la fila real del CSV conservando su id, así que ningún producto perdió su proveedor. Los otros 9 ficticios se borraron con candado (cero formatos de compra). La **numeración volvió a 1**: la primera factura y el primer ticket reales no arrancan en 95. Se conservaron usuarios, roles, sucursales, configuración, rubros de gastos y las listas de venta. Todo corrió en una transacción con candados de conteo antes/después — si algo no cerraba, rollback. La deuda arranca de cero: nace con la primera factura real, como se definió.'],
              ['**17/8/2026**', '**EL MÓDULO PROVEEDORES (migración 0068): la app externa quedó adentro del CRM.** La app de proveedores (PHP+MySQL) se apaga y su lógica vive acá como módulo propio del menú, solo dueño y admin. **Cinco secciones**: la pizarra de pedidos (el kanban tal cual, con historial de ingresos y demora real), las cuentas corrientes (compromisos que **nacen solos** al confirmar la factura del proveedor diferido, con cuotas), los echeqs propios (cobrarlo ES el pago real: imputación + cierre del compromiso en un paso), los estados de cuenta (mercadería + gastos + ajustes − pagado, con mayor completo, FIFO en cuenta libre, ajustes con motivo y conciliación) y el padrón único (la ficha con qué emite, cómo cobra, días, modo de cuenta y cuentas bancarias — los ABM de Compras y Gastos se fueron). **El puente**: el pago que salda la factura cierra su compromiso, y anular o desimputar lo reabre — nunca se marca nada a mano. El pago acepta **multi-forma** (cada parte con su medio y fecha; la caja solo se toca por la parte en efectivo) y aparecieron los medios **depósito** y **echeq**. En Compras quedó **"Costos y percepciones"**: lo operativo (costos por producto con la regla masiva, percepciones, operaciones y cuenta), sin alta ni edición. De paso cayeron tres bugs de lógica encontrados verificando en pantalla: el update parcial del proveedor **borraba el CUIT** (los campos ausentes ahora se conservan), la fecha del pago se guardaba en UTC y **el pago de hoy figuraba ayer** (T00:00:00 local, y el mismo blindaje en las fechas del comprobante), y el alta del kanban no refrescaba la pizarra.'],
              ['**16/8/2026**', '**LA CARGA DE GASTOS ARRANCA POR EL PROVEEDOR, y la factura A se carga con montos SIN IVA.** Tres pedidos del dueño sobre el formulario del 15/8. (1) **El proveedor primero**: el modal ahora abre con Proveedor (con el foco puesto), Rubro y Sucursal — elegir el proveedor completa solo la letra Y el modo de los montos; el papel (fecha/tipo/letra/número) pasó abajo. (2) **Dos modos de leer los conceptos**, porque la factura A lista los renglones netos y agrega el IVA al pie: un selector arriba de los conceptos — *"ya incluyen el IVA"* (como hasta ahora) o *"son sin IVA y el IVA va aparte"*. En modo aparte los renglones se tipean **netos tal como los lista el papel**, el IVA se **copia del pie** y se SUMA (total = neto + IVA, cuadra centavo a centavo), y neto e IVA pasan a ser los REALES del comprobante — el crédito fiscal del resumen sale exacto. **La letra decide el arranque** (A → sin IVA) y el selector queda editable; un IVA mayor que el neto se rechaza en vez de acotarse, porque en este modo infla el total. **Sin columna nueva**: el modo se deduce al editar (neto == suma de renglones). Se eligió copiar el IVA del pie y no alícuota por renglón: el papel ya lo imprime exacto, y así se cubren facturas con 21/10,5/27 mezcladas sin pelearse con redondeos. (3) **Pagar de la caja ya existía** (es el circuito de pagos a proveedor de siempre, con sus candados) — lo que se hizo fue ponerlo a la vista: la sección se llama **"¿Cómo se pagó?"**, la opción dice *"Sale de la caja de [sucursal] — turno #N"* con la advertencia de que el egreso queda en el arqueo con hora y nombre, y sin tildar un aviso aclara que queda debiendo. Verificado con **13 pruebas nuevas contra la API** (neto = suma, IVA sumado, rechazo del IVA imposible, modo incluido intacto, editar cruzando de modo en las dos direcciones) + la suite anterior (14/14) + el circuito del plomero en pantalla con clicks reales: Plomería Pérez con letra A saltó el modo solo, $10.000 + $2.100 = $12.100, y el gasto quedó pagado desde el turno #2 con su egreso "Pago a proveedor · Plomería Pérez · Arreglo de canilla del baño" en el arqueo — y al reabrirlo para editar, el modo "sin IVA" se dedujo solo. Después se limpió todo'],
              ['**15/8/2026**', '**LA CARGA DE GASTOS, MÁS SIMPLE (migración 0067).** Lo pediste con cuatro puntas y salieron las cuatro: (1) **la letra vive en el proveedor** — en su ficha se responde una vez "qué factura hace" (A/B/C/X) y la carga la precarga al elegirlo, editable; el selector la muestra al lado del nombre. (2) Se fueron del formulario **"O anotalo a mano"** y la **Descripción** libre (el rubro quedó: sin él muere el resumen por categoría). (3) Se fue el selector de **Negocio** — los gastos son siempre de Sabor y Aroma; la columna sigue en la base y los gastos viejos del café conservan su métrica. La sucursal ahora dice **"General (toda la empresa)"** o una puntual. (4) **CONCEPTOS con su monto**, como cargar una factura: renglones "concepto + importe final", el total es la suma (solo lectura), y un campo **"IVA incluido"** opcional e informativo para la factura A — el servidor lo acota al total y deriva el neto, así los reportes que suman neto/IVA siguen cerrando sin que nadie cargue un desglose. La **descripción se escribe sola** con los conceptos (por eso listados, búsqueda y el concepto del pago siguen andando sin tocarlos), y los renglones quedan en tabla propia (`gasto_items`) que el detalle devuelve. Sin renglones sigue valiendo el camino viejo — gastos fijos generados y API externa no se enteran. Editar un gasto viejo lo migra solo: precarga un concepto con su descripción y total. Con pagos encima, los renglones quedan tan clavados como los importes. Verificado con **14 pruebas contra la API** (letra que se guarda/borra en el padrón, total = suma, IVA acotado, descripción derivada, camino viejo intacto, edición que reemplaza, duplicado vivo) y el circuito completo en pantalla: la letra saltó de A a B al elegir el proveedor, dos conceptos sumaron $57.500,50 y el gasto quedó guardado con sus dos renglones. **Trampa encontrada de paso**: el selector del formulario se alimenta del BOOTSTRAP de gastos (no del padrón completo), y el select parcial no traía la letra — la precarga fallaba en silencio con la API devolviéndola bien'],
              ['**15/8/2026**', '**CONTROL DE STOCK: el físico contra el virtual (migración 0066).** Preguntaste si existía y no existía: lo más cercano era el ajuste suelto (un producto, la diferencia calculada de memoria) y la corrección del fraccionado. Ahora es una pestaña propia en Almacén con el modelo de SESIÓN: se abre con filtros (marca, categoría, proveedor, tipo, solo con stock — porque el stock se cuenta por partes, no todo junto), **la lista se congela al abrir**, se cuenta con el lector renglón por renglón con guardado automático, y la sigue el que entra al turno. **Ciego por defecto** (tu decisión): el que cuenta no ve el virtual, y lo impone la API en el payload, no un ocultamiento de pantalla. **Se aplica POR DIFERENCIA**, nunca pisando el stock con lo contado — cada renglón congela el disponible del instante en que se contó, así aplicar horas después no resucita nada; y como el control es con el **local cerrado**, cualquier movimiento entre contar y aplicar sale listado como alarma. El reporte valoriza cada diferencia **al costo del día** (faltante/sobrante/neto en pesos), tiene **Recontar** por renglón, y **Aplicar** es una llave aparte (`conteos_aplicar`, admin y el encargado que designes) que genera el lote atómico de ajustes atados a la sesión con costo congelado. **Lo no contado queda como está** — jamás se pisa con cero. Verificado con una suite de 24 pruebas contra la API (el ciego real en el payload, el solapamiento de sesiones, la venta fantasma entre contar y aplicar que termina en el stock correcto por diferencia, la cajera que cuenta pero no aplica, decimales del granel, lo no contado intacto, el costo congelado en el ledger) + el circuito completo en pantalla (alta con preview por marca, conteo con Enter, cierre, recontar, aplicar con 2 ajustes reales que después se revirtieron) + las **67 migraciones desde cero**. La planilla de papel (contar impreso y cargar después) quedó para una fase 2, en Pendientes'],
              ['**15/8/2026**', '**El paso 1 del pedido pasó de tres preguntas a una.** Tenía "Pedir a (origen)", "Entregar en (destino)" y "Responsable", los tres como desplegables. Pero **dos de esos no son preguntas**: quien pide es el que está logueado, en el local donde está parado, y lo que pide se descarga ahí mismo — se entiende por lógica. Peor que redundante era peligroso: ofrecerlos como desplegables invitaba a un error caro (mandarle el pedido a otro local) en la pantalla más apurada del día. Ahora hay **"Quién pide"** —sucursal y usuario de la sesión, fijos, sin desplegable— y **"A quién le pide"**, que es la única decisión real, con un aviso abajo que dice dónde se va a descargar. **El jefe conserva lo que ya podía hacer**: como `sucursalDeOperacion` le acepta pedir en nombre de otra sucursal (a la cajera le clava la suya pase lo que pase), tiene un enlace discreto *"Pedir en nombre de otra sucursal"* que abre los dos campos. La cajera no lo ve, porque ofrecérselo sería prometerle algo que el servidor no le va a cumplir. **Y el responsable, al RETOMAR un pedido, queda el que lo abrió** (decisión tuya): el pedido se arma durante el día y lo continúa quien entra al turno, pero el responsable del armado es quien lo empezó — si se pisara con el de la sesión, al enviarlo figuraría el último que pasó por la pantalla. Verificado con las dos sesiones: la cajera de Express 1 ve un solo desplegable y ningún enlace; el jefe ve el enlace, y al cambiar quién pide a Express 1, Express 1 desaparece de "a quién" y el aviso se actualiza solo'],
              ['**15/8/2026**', '**Alt+F5 sin la columna Motivo.** Pedido tuyo. Ojo que "Origen" no era una columna sino un **encabezado de grupo** que abarcaba *Motivo* y *Fecha*, así que sacarlo entero te dejaba sin saber CUÁNDO cambió cada precio — con 164 registros de varias fechas, dos filas del mismo producto pasaban a ser indistinguibles. Elegiste sacar **solo Motivo**: era la columna más ancha de la tabla para un dato que se mira poco (el 90% de los cambios vienen del mismo lado). Con eso muere también el rótulo "Origen", porque un encabezado de grupo sobre una sola columna es ruido que no agrupa nada. **El motivo no se pierde**: sigue en el filtro de arriba —que es donde de verdad sirve, para acotar la lista— y aparece al pasar el mouse por la fecha, para el caso puntual, sin volver a agrandar la tabla'],
              ['**15/8/2026**', '**Los costos de un proveedor se pueden filtrar antes de la regla masiva.** Preguntaste cómo hacer "Coca Cola subió un 10%" y resultó que Coca Cola es una MARCA dentro de un distribuidor que trae varias. La regla masiva ya existía —campo (costo/descuento/flete) × modo (variar un %, sumar/restar, fijar) sobre los tildados, con vista previa del precio de venta antes → después y lote reversible— pero la pestaña **no tenía buscador ni filtro**: listaba los 134 productos del proveedor paginados de a 20, así que subir una sola marca obligaba a destildar a mano todo lo demás, página por página. Inviable. Ahora hay un **buscador por nombre, marca o código** y un desplegable con **las marcas que ESE proveedor trae** (no las 40 del sistema: una lista con 35 marcas que no están acá es una lista para elegir mal). **Y el candado que importa: con el filtro puesto la regla cae solo sobre lo que se ve.** Los tildes arrancan todos puestos, así que sin eso, filtrar por una marca y aplicar +10% habría subido el costo de los 134 productos del proveedor de un clic, sin verlo en pantalla — el rótulo ahora dice el número exacto ("Aplicar a 2 de los 2 que se ven"), y el tilde de la cabecera también alcanza solo a lo visible. Los tildes no se reinician al filtrar. Verificado con datos reales: filtré una marca de 2 productos dentro de un proveedor de 134, apliqué +10%, y al sacar el filtro solo esos 2 tenían el cambio y otra marca quedó intacta. Se cerró sin guardar y se comprobó contra la base que no se escribió nada'],
              ['**15/8/2026**', '**La oferta elige sobre qué listas corre (migración 0065), y de paso el servidor empezó a controlarlo.** Lo pediste así: *"que se pueda elegir a qué lista se aplica la oferta"*. Hasta acá había un sí/no —"solo sobre el precio de mostrador"— que servía para una sola cosa: que la promo de vidriera no se le sumara al precio ya negociado de un mayorista. Con ese sí/no, **"20% en Mayorista 1" era imposible de expresar**: o corría en todas o corría solo en la de mostrador. Ahora son chips, **igual que los días y las sucursales**, con la misma regla de "todas tildadas = corre en todas". **La tilde murió en vez de convivir** (decisión tuya): decía lo mismo con otro vocabulario, y dos perillas que se pisan obligan a explicar cuál gana cada vez que alguien arma una oferta. **El arrastre se hizo solo y es exacto**: las 5 ofertas que tenían la tilde quedaron atadas a la lista de mostrador y las 2 que no, corriendo en todas — que resultan ser justo las dos que se llaman "(web)", así que el sitio publica exactamente lo mismo que antes. **Y apareció un agujero que no era del pedido:** el servidor validaba QUÉ PRODUCTOS alcanza una oferta —eso se cerró el 13/8— pero no sobre qué lista corre. La restricción vivía **solo en el navegador**, así que un pedido armado a mano le colgaba una promo de mostrador a un renglón cotizado a precio mayorista: exactamente el doble beneficio que la restricción existe para impedir. Ahora se valida del lado que manda, con el mensaje diciendo qué lista es. **Dos cosas más que se corrigieron de paso, las dos encontradas usando la pantalla:** (1) los chips de **Sucursales** se comportaban distinto que los de **Días** —en Días, con todas encendidas, un clic apaga esa; en Sucursales, un clic dejaba SOLO esa y apagaba las otras cuatro de golpe—. Tres controles pegados, con la misma pinta y la misma promesa escrita abajo, no pueden responder distinto al mismo clic: se unificaron con el de Días, que es el que hace lo que la pantalla dice. (2) La **vista previa** neutraliza fechas, días y sucursal para mostrar qué hace la mecánica, y sus renglones de ejemplo no tienen lista asignada — sin sumar las listas a esa lista de exenciones, toda oferta acotada iba a decir "no descuenta nada" justo en el lugar donde se la está revisando. Verificado con **9 pruebas nuevas** contra la API (se guarda ordenado y sin repetidos ni basura; sobre su lista entra, sobre otra la rechaza, sin acotar entra en cualquiera), las **66 migraciones contra una base virgen**, y armando una oferta acotada a Mayorista desde el formulario de punta a punta'],
              ['**15/8/2026**', '**"No me deja fraccionar, me pide el tamaño y no me da las opciones" — y era cierto.** El producto (Albahaca) **no tiene ningún tamaño de paquete definido**, y el modal abría con la sección "Paquetes a armar" **vacía** y un botón Fraccionar que no podía hacer nada: se lee exactamente como lo describió el dueño. No es un caso raro — son **62 de los 164 granel activos**. Ahora el modal dice qué falta (*"el sistema no sabe de cuántos kilos es cada paquete"*) y **dónde se carga** (Compras › Productos, abriendo el producto, pestaña Presentaciones), y el botón queda deshabilitado en vez de prometer algo que no va a pasar. **Y se avisa antes del clic**, que es lo que de verdad ahorra el viaje: la fila de "Granel disponible para fraccionar" marca *"sin tamaños de paquete definidos"*. El botón igual se deja —lleva a la explicación—, porque esconderlo dejaría al producto sin ninguna pista de por qué no aparece. De paso, Fraccionar también se deshabilita con el total en 0 o excediendo el granel: los dos casos el servidor ya los rechazaba (*"Indicá al menos un paquete a fraccionar"*), así que el error se adelanta al lugar donde se entiende'],
              ['**15/8/2026**', '**El buscador rápido del pedido seguía ofreciendo la madre en vez de los tamaños.** La regla es del 11/8 y está escrita: **en granel se ofrecen los tamaños, no la madre**, porque lo que viaja a una sucursal son paquetes. El **explorador** del catálogo ("Buscar en el catálogo") lo hacía así desde el primer día; el que se había quedado atrás era el **buscador rápido de la pestaña** —el que se usa con el lector—, que mostraba "Ajo en Polvo" con un solo botón y obligaba a elegir el tamaño DESPUÉS, en un desplegable del renglón ya agregado. Ahora las dos puertas hablan el mismo idioma: una fila por tamaño, **con su código**, con el granel suelto del origen (que es lo que puede mandar: el paquete se fracciona del madre al preparar) y con los paquetes que el destino tiene de ESE tamaño; si además tiene granel suelto, va como nota al lado, porque sin eso "0 paq. de 500 g" esconde que el local tiene 123 kg sin envasar y se pide de más. La excepción es la misma que ya tenía el explorador: un granel **sin tamaños definidos** va con su fila suelta, porque esconderlo sería no poder pedirlo nunca. **Y de paso el buscador encuentra por el código del PAQUETE**, no solo por el de la madre: escanear un 500 g tiene que traerlo, y ese código es de la presentación. Verificado en pantalla con una cajera de Express 1: "Ajo en Polvo" ahora son tres filas (1 kg, 500 g, 100 g) con sus códigos, y al agregar la de 500 g el renglón cae **con la presentación ya elegida**. La pestaña de enteros sigue con una fila por producto'],
              ['**15/8/2026**', '**El pedido de mercadería no se podía armar desde un local: el origen ofrecía el mismo local que el destino.** Lo encontró el dueño usándolo. En el paso 1 los dos desplegables mostraban **Express 1**, y como el modal exige origen y destino distintos, "Continuar" cortaba: **la cajera no podía pedirle nada a nadie**. La causa es un candado bien puesto en el lugar equivocado. En la revisión de seguridad de Almacén se acotó el desplegable de sucursales a la propia para el que no es jefe, y ahí está perfecto: en un movimiento de stock la sucursal es **dónde opero**, y ofrecerle otra al repositor de Fontana era ofrecerle bajarle 80 unidades a un local donde no pisa. Pero en el pedido la pregunta es otra: **a quién le pido**. Pedirle a la Distribuidora es literalmente el trabajo de la cajera, y el pedido no toca ni una unidad del origen —es demanda; la mercadería recién se mueve cuando el origen prepara y despacha, con su propia gente y su propio permiso—. Ahora el origen usa su propia lista: **las otras sucursales, nunca la propia**, arrancando en la Distribuidora. El destino sigue clavado en la sucursal de la sesión, que es lo que el servidor ya hacía por su cuenta. **Y de paso se cerraron dos formas de que el desplegable mostrara una cosa y el modal guardara otra:** el valor inicial se calcula al montar y las sucursales llegan por red, así que con la lista todavía vacía el origen quedaba en blanco; y al cambiar el destino a la sucursal que estaba de origen, esa opción desaparecía de la lista pero el estado se quedaba con ella. Ahora el origen se repara solo en los dos casos. Verificado en pantalla con una **cajera de Express 1**: el origen ofrece Distribuidora, Express 2, Express 3 y Fontana —sin Express 1—, el destino solo Express 1, y el borrador se crea (201) llegando al paso 2 con la ruta "Distribuidora → Express 1"'],
              ['**15/8/2026**', '**El botón del punto de venta, y las DOS trampas que solo aparecieron usándolo (migración 0064).** La función quedó completa: botón chico debajo del total, la lista con los que sirven y los que no —en gris y **con el motivo escrito**—, el cartelito de lo aplicado y el sello en cada renglón alcanzado. Y el recálculo vivo, comprobado en pantalla: se aplica *"Empleados 15%"*, el total baja de $7.818 a **$6.645,31**; se le cambia la lista al renglón y **el descuento se cae solo**, el total vuelve a subir y el cartel avisa *"ya no descuenta"*; se la devuelve y **entra solo otra vez**. **La primera trampa la encontré mirando el esquema antes de escribir la pantalla, y era la más cara:** el renglón guardaba el descuento COMBINADO. Al reabrir un borrador —que en esta caja pasa todo el día, hay varios tickets abiertos a la vez— el 25% autorizado volvía al POS como si lo hubiera tipeado el vendedor, y el autoguardado siguiente lo mandaba como manual: el servidor lo rebota contra el tope del 10% **antes** de llegar a aplicar el nombrado, y el ticket quedaba **sin poder guardarse**, con un error sobre un número que la cajera nunca escribió. Es el mismo bug que ya pasó acá con las ofertas y el descuento del cliente. Se agregó una columna que guarda **el descuento propio del renglón**, aparte del que se cobró: con eso, reabrir es exacto y quitar el nombrado devuelve al cliente su 10% de contrato en vez de dejarlo en 0. **La segunda apareció recién manejando la pantalla de verdad, y las pruebas de API no la habían visto:** el POS conserva el descuento que se quedó sin lista para poder avisar, pero el servidor **rechaza guardar** un ticket así —y con razón, es la defensa contra colgarle a una venta un descuento que no le corresponde—. Resultado: **400 en cada tecla**. Ahora el POS manda solo lo que el servidor acepta y el aviso queda de este lado. **Y una tercera que salió de ahí:** el permiso se pedía para APLICAR y también, sin querer, para CONVIVIR. La escena para la que `requiereAdmin` existe es que el encargado se acerque, autorice el 25% por la demora y se vaya — y con eso, ese ticket le quedaba **radiactivo a la cajera**: no podía agregar un producto ni guardar, porque cada autoguardado reenviaba el descuento y se lo rebotaba su propio permiso. Ahora el permiso rige para ponerlo, no para seguir trabajando sobre uno ya puesto (probado en las dos direcciones: la cajera sigue el ticket, pero aplicarlo ella en uno nuevo le sigue pidiendo admin). **Dos cosas más del renglón que estaban mintiendo:** la alerta roja de "descuento excedido" se medía contra el número visible, así que se prendía sobre un porcentaje que **autorizó el dueño** —justo el caso que el descuento con nombre existe para permitir—; y el campo era editable mostrando 25, cuando lo que se tipea ahí es el de abajo. Ahora el tope se mide contra la base y el campo se vuelve texto mientras el nombrado gana. **Y el candado del medio de pago no corría donde se cobra:** vivía en el alta y no en la confirmación, que es por donde va el POS — o sea que la regla que pediste ("si exige un medio, se bloquea y se avisa") no se habría aplicado nunca en la caja. Ahora corre en los dos, releyendo el descuento de la base, y de paso rechaza cobrar con uno que venció mientras el ticket estaba abierto (un ticket armado a las 23:50 y cobrado a las 00:10 se llevaba el descuento de ayer). Verificado con **41 pruebas** que ejecutan cada cruce contra la API real —cae solo sobre su lista, gana el mayor y nunca se suma, la oferta lo excluye, dos de la misma lista se rechazan, otra sucursal, el que vence hoy sigue valiendo, el pago mixto 90/10 se rechaza y todo en efectivo cobra, un 90% mandado por el costado no cambia nada—, más las **65 migraciones contra una base virgen** y el circuito completo en el navegador con clicks y teclas reales'],
              ['**14/8/2026**', '**Descuentos con nombre: la mitad de servidor terminada (migración 0063), y la caja arranca sola el ticket siguiente.** **Lo chico primero:** cobrado un ticket, "Nuevo ticket" abría la venta siguiente pero la pantalla se iba a **Caja** — parecía que te sacaba del punto de venta en medio de la cola. Ahora abre el borrador nuevo **en el mismo POS**, con el foco en el buscador. **Lo grande es un cuarto camino para que un precio baje**, y hasta ahora no existía: el descuento del cliente, el manual del renglón y la oferta ya estaban; faltaba *"Empleados 15%"*, *"Atención por tardanza 25%"* — algo que el dueño autoriza **una vez** y que en el mostrador se elige por su nombre, sin tipear un número. Existe justamente porque ese porcentaje **saltea el tope del vendedor**: si no, permitir un 25% de vez en cuando obliga a subirle el tope a todo el mundo, todo el tiempo. **Las seis reglas las decidiste vos y la forma de la tabla las sostiene:** cae **solo sobre los renglones de su lista** (por eso la lista es obligatoria y no un filtro más: si el cliente lleva algo de Minorista y algo de Mayorista 1, un descuento de Mayorista 1 toca solo esa parte, nunca el subtotal); **uno por lista**; **gana el mayor, nunca se suman**; **no toca lo que ya está en oferta**; si exige un medio de pago, el pago tiene que ser **íntegro** de ese medio (nada de pagos mixtos); y el vencimiento **vale todo el día**, hasta las 23:59 de Argentina. **Lo que se construyó del lado del servidor:** la tabla propia con su rastro en el renglón —id **más nombre congelado**, como ya hacen la lista y la oferta, así un ticket de hace seis meses se reimprime diciendo "Empleados" aunque después se renombre—, el motor que lo resuelve, el candado del medio de pago al confirmar y el alta con permiso propio. **El navegador nunca manda un porcentaje: manda el id**, y el servidor revisa de nuevo las seis cosas (que exista y esté activo, que no haya vencido, que sea de esta sucursal, que quien lo aplica tenga permiso, que no haya dos de la misma lista, y que esa lista **esté de verdad en el ticket**). Es la misma regla que ya rige el precio, el IVA y las ofertas. **Y el rastro se llena solo si el nombrado GANÓ:** si el 25% del cliente le gana al 20% de "Familiares", ese renglón no es de Familiares, y el reporte de cuánto costó cada autorización no lo cuenta. **Un detalle que solo aparece manejando la pantalla de verdad:** el validador de la API salta los campos **nulos**, no los **vacíos** — y un descuento sin vencimiento y sin medio de pago, que es el caso más común, manda dos cadenas vacías. Resultado: *"El vencimiento va como AAAA-MM-DD"* sobre un campo que el usuario **nunca tocó**. Las 16 pruebas de API no lo habían encontrado porque mandaban objetos completos. **Verificado además contra una base virgen:** las **64 migraciones corren de cero** y dejan la tabla, los dos índices y la clave del renglón — la prueba que faltó antes del deploy de esta mañana y que dejó al `0046` rompiendo en el servidor. **Falta el botón "Aplicar descuento" en el punto de venta**, que es por donde se usa: está a medio hacer y **no se commiteó** — el motor del ticket ya lo recalcula en cada cambio, faltan las acciones y el desplegable. Queda anotado en Lo próximo con las tres decisiones ya resueltas'],
              ['**14/8/2026**', '**El sistema quedó listo para subir al VPS: Docker, y tres cosas que lo habrían roto en el primer intento.** El servidor es Ubuntu 24 con **Dokploy**, o sea Docker con **Traefik** de puerta, y eso cambia supuestos que estaban escritos en el código. **Lo primero, y era lo más grave:** el proyecto en el servidor apuntaba a la rama `main`, y `main` estaba **7 commits atrás** — desplegar ahí habría subido el sistema **anterior a toda la revisión de seguridad**, sin permisos en los controllers, con el motor de impresión sin escapar y con Gastos abierto. Se hizo el trabajo de deploy en `dev` y recién al final el merge, así que `main` recibe todo junto. **Lo segundo: el candado de la IP no funciona detrás de Traefik.** El sistema decide "de dónde viene cada visitante" para el cupo de la tienda y el freno de intentos del login, y estaba configurado para creerle solo a un proxy que venga de la misma máquina (127.0.0.1), que es correcto con nginx instalado en el servidor. **Traefik es otro contenedor**, así que no califica: la IP habría quedado en la de la red interna de Docker, **idéntica para todos**, y el freno del login habría contado a todos los visitantes como si fueran uno — bloqueando a todo el mundo junto tras unos pocos intentos fallidos de cualquiera. Ahora es una variable, con el valor de siempre por defecto (no se rompe nada del otro modelo) y el de Docker en el servidor. Va con una condición que quedó escrita en el checklist: **el puerto de la API no se publica**, porque si se publica, el encabezado vuelve a ser falsificable. **Lo tercero, que habría dado un contenedor reiniciando en loop sin explicación clara:** el script que aplica las migraciones importa `dotenv`, y `dotenv` estaba declarado como dependencia **de desarrollo** — una imagen de producción las descarta. Comprobado reproduciendo a mano la etapa de ejecución con las dependencias recortadas. **Lo que se construyó:** un `Dockerfile` para cada uno. El de la API es de dos etapas (compila en una, corre en la otra, sin el compilador ni el código fuente adentro) y **aplica las migraciones al arrancar, antes de escuchar**: si una falla el contenedor queda en rojo, que es mucho mejor que una API sirviendo contra un esquema viejo y devolviendo errores raros repartidos por todas las pantallas. El de la pantalla construye la SPA y la sirve con nginx, con el **fallback** que evita el 404 clásico al apretar F5 parado en una pantalla interna. **Cuatro trampas que se cerraron de paso:** (1) la imagen lleva la base de zonas horarias y la zona fijada — alpine viene **sin** ella y sin eso la variable se ignora en silencio, que es el peor de los dos mundos: parece configurado y no lo está, y vuelve el bug de "vence hoy" mostrado como "vencido"; (2) el `.env` local del dashboard **no entra al build**: ahí dice que la API está en `localhost:3001`, y esas variables se hornean adentro del JavaScript, así que habría salido una imagen pidiéndole la API a la máquina de quien la construyó — sin fallar en el build, fallando recién en el navegador del usuario; (3) los **source maps son 7,9 MB de los 11** que pesa la pantalla y son el código fuente entero en texto legible: no viajan a producción, pero se siguen generando localmente, que es donde sirven; (4) el script que **borra la base entera** se cae de la imagen a propósito. **El respaldo** ahora sabe hablarle a la base adentro del contenedor, y escribe con un nombre provisorio que solo renombra al terminar bien — un `pg_dump` cortado a la mitad dejaba un archivo con nombre de respaldo bueno y contenido incompleto, y eso no se descubre hasta el día que hace falta. **Y la guía de deploy se reescribió entera** para Dokploy: estaba escrita para el otro modelo y encima decía que faltaban dos cosas que ya estaban hechas hace semanas, que es la clase de error que hace que un checklist se deje de leer. **Lo que NO se pudo probar acá y se prueba en el primer deploy:** las imágenes no se construyeron, porque esta máquina tiene Docker instalado pero sin el subsistema que necesita para correr. Sí se verificó lo que tenía riesgo real, reproduciendo la etapa de ejecución a mano: las migraciones corren sin las herramientas de desarrollo y quedan idempotentes, la API levanta y responde con el portero cerrado (401) y el login abierto, y la pantalla construye con las rutas que el nginx espera. Queda por confirmar en el servidor la zona horaria dentro del contenedor y el fallback de la SPA — los dos con una prueba de un minuto que está en la guía. **De paso:** revisar la pantalla dejó de reportar **591 errores falsos**, porque la carpeta del build se estaba revisando como si fuera código fuente (dos archivos minificados, 288 errores cada uno) y tapaba por completo los 14 reales, todos viejos y cosméticos'],
              ['**14/8/2026**', '**Depuración de GASTOS: tres regresiones mías de hace un rato, y una borraba datos.** Cierra la revisión de los siete módulos, y lo que valió la pasada no fue el código muerto (poquísimo) sino **encontrar lo que rompí esta misma mañana**. **La peor, porque pierde información en silencio:** al cerrar los permisos recorté lo que manda el arranque del módulo —el padrón viajaba entero y ahora solo con nombre y banderas—, y **el formulario de proveedor se prellenaba justo de ahí**. Como al guardar reenvía todos los campos, tildarle "provee gastos" al plomero desde Gastos **le borraba el CUIT, la dirección, el teléfono y el mail**, y lo pasaba a Responsable Inscripto. El CUIT no es un dato de adorno: es lo que usa la bandeja de facturas para reconocer de quién es un comprobante que llega, así que el proveedor quedaba mudo del lado de Compras. **El arreglo no fue volver atrás:** la pantalla de Proveedores ahora pide la ficha completa por su cuenta, con lo cual el CUIT y el contacto quedan detrás del permiso de ESA pantalla —que es donde corresponde— y los selectores del formulario de gasto siguen bajando livianos. **La segunda: el botón "Anular" dejó de funcionar para todos.** Le puse `@Permiso("gastos_anular")` porque el catálogo declara esa acción desde el primer día… y **ninguna migración se la había dado a nadie**. Mientras el endpoint estaba abierto no se notaba; al cerrarlo, hasta el rol Administrador se comía un 403. Va por migración al rol Administrador, que es de quien es la responsabilidad — el cajero paga, pero no decide qué comprobante deja de contar. **La tercera: editar re-imputaba el gasto a la sucursal del que editaba.** Un empleado que corregía una coma en la descripción del alquiler de la oficina —un gasto de "toda la empresa"— se lo mudaba a su sucursal sin enterarse, y con eso cambiaba el resumen por sucursal y cambiaba qué pagos lo podían explicar. En el ALTA la sucursal sí se clava (ahí el documento nace); en la EDICIÓN el campo ahora se ignora salvo que sea el jefe. **Y dos bugs que no eran míos.** Uno: **editar un gasto que ya tiene pagos SIEMPRE fallaba**. El cartel del modal promete que con pagos se pueden cambiar rubro, descripción, vencimiento y observaciones, pero la pantalla mandaba igual los importes y el número, que el servidor rechaza — o sea que ninguna edición pasaba nunca y el mensaje de error hablaba de campos que el usuario no había tocado. Ahora los campos bloqueados directamente no viajan. El otro: **no se podía generar un mes viejo de gastos fijos**. Generado septiembre, pedir julio contestaba "ya está generado" apuntando al gasto de septiembre, porque a la comprobación le faltaba la punta de arriba: una emisión POSTERIOR contaba como si cubriera el período. Es el hermano del desborde de `setMonth` que se arregló a la mañana, en la misma función. **Y el jefe tampoco podía devolver un gasto a "toda la empresa"**: el cambio se guardaba "bien" y la sucursal quedaba como estaba. **Limpieza y peso al aire:** salieron dos claves de API que no llamaba nadie, un campo de contador fantasma, un re-export de `isoDate` (la función que da MAÑANA después de las 21 h, que no tiene por qué estar al alcance de este módulo) y dos ramas muertas del pago inmediato. La búsqueda del listado **dejó de disparar una consulta por tecla** (escribir "coca cola" eran nueve consultas de hasta 300 filas). Los cuatro números del encabezado sumaban **solo las primeras 300 filas** sin decirlo: ahora, si se llega al techo, la pantalla avisa que los totales son de lo que se ve y manda a Resumen, que los calcula en la base. El contador del sidebar **deja de reintentar cuando el servidor le dice 403** —un rol con solo "Rubros" se comía uno cada 60 segundos, para siempre—. Y la cuenta corriente del proveedor dejó de prometer "documentos impagos" para mostrar solo los de gastos. **Dos cosas para el servidor:** un índice que faltaba sobre la columna de gastos fijos (la consulta corre **dentro** de la transacción que bloquea las plantillas, o sea que el escaneo de la tabla entera pasa con las filas tomadas), y **la zona horaria del proceso fijada en el arranque**: un VPS viene en UTC y el sistema decide "hoy" con el reloj de Node, así que después de las 21:00 "vence hoy" se mostraba como "vencido hace 1 día" y el badge contaba de más, todas las noches. Verificado con **21 pruebas nuevas** y comprobando en el navegador el caso que borraba datos: se tilda la casilla, se guarda, y el CUIT sigue ahí. **13 suites sin regresiones**'],
              ['**14/8/2026**', '**GASTOS: el módulo entero estaba abierto, y por él se sacaba plata del cajón.** Es el último módulo de la revisión y trajo el agujero más grande de permisos de toda la serie: `GastosController` **no tenía ni un solo `@Permiso`** — 24 endpoints, cualquier sesión. Las siete claves de sección y las cuatro de acción existían en el catálogo desde el primer día, se podían tildar en la pantalla de roles, y **cuatro de ellas no las leía ningún código**: eran casillas que no hacían nada. El único filtro era el sub-menú del dashboard, que decide qué panel dibuja. Con el rol Cafetería —que ve UNA pantalla— se pedía `/gastos/resumen` y salía la estructura de costos completa de la empresa por rubro, proveedor y mes; `/gastos/bootstrap` daba el padrón de proveedores; y `DELETE /gastos/recurrentes/:id` borraba las plantillas de alquiler e internet. **Y adentro de eso, el peor:** tres endpoints de Gastos llaman derecho al servicio que genera el **egreso de efectivo de la caja** — el mismo que en el módulo de Pagos ya estaba cerrado con tres claves, y cuyo comentario **describe este agujero como tapado**. Gastos lo reabría por el costado, porque el permiso estaba en el controller y no viaja con el servicio. La secuencia completa, con el rol más chico del sistema: cargar un gasto de $80.000, después probar `cajaSesionId` 1, 2, 3 —los mensajes de error distinguen "inexistente" de "cerrado" de "de otra sucursal", así que el turno abierto se encuentra en tres intentos— y el arqueo de esa noche cierra en falta con la plata puesta por la cajera. Ahora hay un piso de lectura en la clase y permiso propio en cada escritura; y como el alta con "lo pagué y lo cargo" tildado también saca plata, **el alta pregunta por el permiso de pagar solo cuando el pago viene** (un `@Permiso` es un OR fijo y no puede expresar eso). **Los adjuntos eran la segunda cadena a la sesión:** el comprobante se subía como data URL y **el tipo de archivo lo declaraba el cliente**; un `text/html` con un script adentro se servía tal cual desde `/api/...`, o sea desde el mismo origen donde vive el token del CRM — se le pasa el link al administrador ("mirá el comprobante") y el script se lleva su sesión. `common/archivos.ts` ya existía para esto y su encabezado decía "dos lugares": eran tres. Ahora el mime sale de los bytes, hay tope de tamaño, y se sirve con `nosniff` y nombre saneado. **Y el borrado del comprobante** era un `DELETE` pelado que no miraba nada: el mismo que registraba un pago trucho borraba después la foto. Ahora, con pagos hechos, el adjunto no se borra — la misma regla que ya cumplían anular y editar. **Lo que pasaba entre sucursales:** la regla "un pago del cajón de Fontana explica gastos de Fontana" vivía **solo en el frontend**. Servía para tapar un faltante: se agarra un gasto legítimo de otra sucursal por el mismo importe, se lo imputa, y el pago sale de la bandeja de "sin aplicar" —que es justo el contador que mirás vos— con el egreso explicado por un papel de otro mostrador. Ahora se valida del lado que manda, en la función compartida con Compras, y el jefe sigue pudiendo cruzar porque corregir lo cargado en el mostrador equivocado es su trabajo. Lo mismo con la sucursal del gasto: la elegía el cliente, así que un cajero le colgaba $200.000 de "reparación" a otra sucursal; ahora la decide el servidor y la pantalla dejó de ofrecer lo que la API iba a corregir por atrás. **Y aparecieron dos bugs de plata que el informe no tenía.** El primero lo destapó la prueba de concurrencia: **"Generar el mes" duplicaba los gastos fijos apretándolo dos veces**, sin ninguna simultaneidad. La comprobación de "esto ya se emitió" restaba un mes desde el ÚLTIMO día del período, y `setMonth` no recorta: desborda. Restarle un mes al 31 de marzo da "31 de febrero" → 3 de marzo, un límite POSTERIOR al gasto recién creado, que entonces no se encontraba. Resultado: dos alquileres, dos internets, dos seguros del mismo mes en Cuentas a Pagar. Ahora se cuenta desde el día 1 —que existe en todos los meses— y además la previsualización corre dentro de la transacción con las plantillas bloqueadas, así que dos clicks simultáneos tampoco duplican. El segundo: el botón "Cargar gasto" no se apagaba mientras la petición volaba, y el guard de duplicados del servidor **se rinde justo en el caso más común de este módulo** (`si no hay proveedor y número, no comparo`), que es el ticket de nafta. Doble click en una conexión lenta = dos gastos y dos egresos. **Lo demás:** techo a los importes (`1e308` es finito, pasa la validación y desborda a `Infinity`, que Postgres acepta y deja el resumen del mes en blanco), fechas validadas (`?hasta=lunes` daba 500 con stack en el log en vez de 400 — Pagos ya lo había resuelto al lado y Gastos no lo había copiado), y DTO real en las tres consultas que recibían `any`. Verificado con **51 pruebas nuevas** que ejecutan cada ataque con roles de prueba creados y borrados por el test, más el doble click de verdad en el navegador (un solo `POST`, un solo gasto, en la sucursal de la sesión). **12 suites sin regresiones**'],
              ['**14/8/2026**', '**Depuración de SISTEMA: el candado que puse ayer tenía una rendija, y la ruta del respaldo estaba mal.** **Lo primero es un error mío de ayer.** La función que obliga a que el botón de la portada apunte adentro del sitio miraba tres cosas: que empiece con `/`, que no empiece con `//` y que no tenga dos puntos. Y `/\\evil.com` **cumple las tres** — el parser de los navegadores convierte la barra invertida en barra, así que ese botón llevaba a `https://evil.com/`. Justo el phishing con la marca de la casa que la función existía para impedir. **El arreglo no es sumar otra condición:** adivinar qué texto va a resolver adentro del sitio es una carrera perdida (quedan `%2F`, los espacios raros, lo que agregue el estándar mañana), así que ahora se **resuelve con el mismo parser que decide** y se compara el origen: si cambió, no era interna. Verificado con las cinco rutas reales del desplegable y con los payloads que se escapaban. **Lo segundo también es mío, de hace una hora:** la línea del cron que dejé para activar la copia de respaldo fuera del servidor apuntaba a `/opt/crm/deploy/`, que **no existe** —la instalación real es `/srv/crm/prod/crm-api/deploy/`— y encima le faltaba el campo de usuario que exige `/etc/cron.d/`. Cualquiera de los dos errores hace que el cron no corra, y como el aviso lo da el propio script, te quedabas **sin respaldo y sin alarma**. Corregido en los tres lugares donde estaba escrito. **Lo tercero:** `impresion` era la única área sin reglas de rango, justo la que decide por qué camino sale cada documento. Un `ticketPos: "etiqueta50x30"` mandaba **todos los tickets del punto de venta** al camino de la etiqueta —sin membrete, sin total y sin la leyenda no fiscal— y un valor inventado los tiraba a A4, con lo que el rollo de 80 mm salía en hoja. Ahora cada documento solo acepta los formatos de su mundo (papel o etiqueta). Y de paso apareció que **`remitoCafeteria` no estaba en el catálogo**: se imprime todos los días, caía a A4 y no había forma de mandarlo al rollo. **Limpieza:** salió `comprobanteDefault`, una perilla que **ninguna pantalla dejaba editar y ningún código leía** (el tipo de comprobante lo decide `arcaHabilitado`); un campo de retorno sin usar; y se corrigió un comentario en inglés que describía un modelo de permisos que este sistema nunca tuvo. **Tres arreglos chicos con efecto visible:** la pantalla de Sistema ahora **se queda con lo que devolvió el servidor** al guardar (antes seguía mostrando el CUIT como lo tipeaste, aunque se hubiera guardado formateado), el logo se valida una sola vez por documento en vez de dos (la vista previa rearma todo en cada tecla, y son ~533 KB), y la sección Respaldos —que es texto fijo— dejó de esperar dos consultas que no necesita, así que con la API caída ya no se queda en "Cargando…". **Y se cerró una trampa antes de que muerda:** la tabla de reglas solo se aplicaba a números y textos, así que una regla futura sobre una lista —por ejemplo para cerrar los medios de pago— **no se habría aplicado ni habría avisado**; ahora corre en las cuatro ramas. Verificado con **19 pruebas nuevas** que miden adónde lleva de verdad cada ruta y qué formato queda guardado, más la comprobación de que los 3 slides publicados apuntan adentro del sitio. **11 suites sin regresiones**'],
              ['**14/8/2026**', '**Sistema: el alto, los medios y el bajo — la configuración dejó de poder romper el negocio.** **El grande: un número de configuración ponía TODOS los precios en $0.** El redondeo de góndola aceptaba cualquier número, porque la lista de valores válidos (0/1/10/50/100) vivía **solo en el desplegable de la pantalla**. Con `redondeoPrecio: 100000`, la cuenta `Math.round(precio / redondeo) * redondeo` da **0** para todo lo que valga menos de $50.000 — en el punto de venta Y en el catálogo público del sitio— y el portero de precios ni se enteraba, porque el precio de lista *calculado* también daba 0: no había "precio pisado" que denunciar. **El arreglo va donde el auditor dijo:** el catálogo de valores por defecto ya era el esquema (dice el tipo de cada campo), solo le faltaba decir **qué valores tienen sentido**. Ahora hay una tabla de reglas por campo: listas cerradas para los redondeos, y rangos para los días de validez del presupuesto, el tope de descuento, los plazos de cuenta corriente y los montos mínimos. **Las reglas ACOMODAN, no rechazan, y es a propósito:** esa misma limpieza corre también al LEER, así que una regla que lanzara excepción convertiría un valor viejo mal guardado en una pantalla caída para siempre. **Los dos casos que estaban escondidos:** los días de validez aceptaban un negativo —con lo cual **toda orden web nacía vencida** y el canal de ventas del sitio quedaba muerto, con síntoma de bug de fechas— y aceptaban `1e308`, que **esquiva la defensa del Infinity porque es finito** y terminaba en un 500 en cada envío de presupuesto. **El punto de venta y el CUIT** se guardaban como texto libre: ya existía la función que normaliza el punto de venta —la usan comprobantes y facturas— y la configuración era el único de los cuatro lugares que **no la usaba**, así que un `"00A1 "` entraba tal cual al índice único de la numeración y arrancaba una serie paralela desde 1. Ahora usa la misma, y el CUIT de 11 dígitos se guarda con el formato de siempre. **Y el chico:** `GET /configuracion/constructor` devolvía 200 con un objeto vacío en vez de 404 (y el `PUT`, un 500 o una fila basura), porque el mapa de áreas es un objeto común y heredaba esos nombres de `Object`. **Los respaldos:** el dump —que es la base ENTERA, con los hashes de contraseña, el DNI y la dirección de cada cliente y los papeles de facturas— se creaba en **644** con el umask que hereda de cron, o sea legible por cualquier cuenta del servidor sin tocar Postgres; ahora el script corre con `umask 077` y deja el directorio en 700. Y la copia fuera de la máquina dejó de ser un comentario: el script ya la hace, y **lo único que falta es decirle adónde** (una variable en la línea del cron, ver Pendientes) — mientras no esté, cada corrida **avisa** en vez de terminar en un "OK" que no dice toda la verdad, y queda un `ultimo-ok.txt` con la fecha del último respaldo bueno. Verificado con **21 pruebas** que mandan los valores del informe y comprueban el efecto donde se ve: entre ellas, que con el redondeo saneado el catálogo público tiene **67 productos y ninguno en $0**, y un simulacro de permisos que confirma directorio 700 y dump 600. **10 suites sin regresiones**'],
              ['**14/8/2026**', '**Auditoría de SISTEMA: el peor agujero de toda la revisión — de internet, sin cuenta, a la sesión del vendedor.** El motor de impresión —que Sistema gobierna y que usan TODOS los impresos: tickets, presupuestos, remitos, listas y etiquetas— armaba el documento pegando texto y **no escapaba nada**. La ironía es que el archivo YA TENÍA la función para escapar, y la usaba solo en las etiquetas. **La cadena, verificada paso por paso:** cualquiera, desde internet y sin cuenta, manda un pedido en el sitio escribiendo HTML en el campo "observaciones" del checkout (el tope de 500 caracteres que se puso ayer limita el LARGO, no el contenido) → el pedido cae en Ventas › Presupuestos con el botón Imprimir ya disponible → el panel mete esas observaciones crudas en el documento → y la ventana de impresión se abre con `about:blank`, **que HEREDA EL ORIGEN del dashboard**. O sea que el script del desconocido corre en la máquina del vendedor, con su sesión abierta al lado. Había una segunda puerta, interna: con `sistema.impresion` —el permiso más chico del módulo— se pone el pie del ticket con un `<img onerror=...>` y eso corre en el navegador de **todo el que imprima un ticket**, incluido el dueño. **Por qué no apareció en las auditorías anteriores:** vive en la costura. Web escribe el dato, Sistema es dueño del motor y Ventas dispara la impresión; cada pasada miró su propio módulo y el camino cruza los tres. **El arreglo tiene tres candados, y ninguno reemplaza a los otros.** (1) Se escapa todo lo que es dato: el membrete de la empresa, el título, el pie, y —en los cuatro paneles que arman documentos— el nombre del producto, el del cliente, las observaciones y los motivos. (2) Lo que no se arregla escapando se valida por formato: el **color de marca** entra adentro del bloque `<style>`, donde las entidades HTML no protegen (un `#000}</style><script>` se escapaba del bloque), así que ahora solo se acepta un color de verdad; y el **logo** solo puede ser una imagen embebida, porque un `data:text/html` no es un logo. (3) El documento lleva su propia **política de seguridad que prohíbe ejecutar cualquier script**, para que un olvido futuro en (1) no vuelva a abrir esto. Verificado en el navegador de verdad, no con expresiones regulares: se **parsea** el documento resultante y se cuenta qué elementos construye el navegador — cero `<script>`, cero atributos `on*`, cero imágenes ajenas, con los payloads exactos del informe en las cinco puertas (pedido del sitio, membrete, color, ticket del POS y etiqueta). Y se comprobó que el tercer candado funciona solo: **se inyectó un script a mano salteando el escape y la política no lo dejó correr**. Del otro lado, que no se rompió nada: el impreso sigue saliendo con el color de marca aplicado, el logo cargado, los bordes de la tabla, el membrete y el pie. **Quedan pendientes el alto y los medios de Sistema** (el redondeo de precios sin rango, que puede poner todo en $0; los días de validez del presupuesto; el punto de venta sin formato; y los permisos del archivo de respaldo)'],
              ['**14/8/2026**', '**Depuración de GERENCIA: dos bugs de producción que nacían del mismo lugar.** Código muerto había poquísimo (tres cosas, ~20 líneas). Lo que valió la pasada fueron dos bugs que salen del **mismo defecto de raíz**: `/auth/yo` devolvía MENOS campos que el login, y el frontend **reemplaza** el usuario con esa respuesta más pobre en cada arranque. **El primero:** faltaba `rolNombre`, así que desaparecía en el primer F5 y el encabezado quedaba mostrando " · Express 2" con el separador colgando — literalmente el mismo bug del "Lucas — " que se acababa de arreglar en el login, una pantalla más allá. **El segundo es más caro: el cambio de sucursal del jefe se deshacía solo.** El encabezado ofrecía cambiar de sucursal, pero lo hacía únicamente en el navegador: la sucursal vive en la fila de la sesión y **se fijaba en el login sin actualizarse nunca**. En la recarga siguiente `/auth/yo` devolvía la vieja y pisaba la elegida, mientras el contexto de los módulos —que no se pisa— se quedaba en la nueva. Resultado: el encabezado y el chat parados en una sucursal y Compras/Almacén/Ventas trabajando en otra. Ahora hay un endpoint que mueve la sucursal **de la sesión**, solo para el jefe (mismo criterio `esJefe` que usa todo el sistema) y el navegador no toca nada si el servidor rechaza. **Y se completó la regla de los permisos:** las tres validaciones nuevas se esquivaban por la puerta de al lado, porque **asignar un rol que ya existe no pasaba por ninguna**. Quien administra usuarios se creaba uno con el rol Administrador —o se cambiaba el suyo— y entraba con `precio_manual`, `diferencias` y `gastos_pagar_proveedor` puestos, sin tocar el comodín. El rol es un paquete de permisos: asignarlo ES otorgarlos, así que ahora le rige el mismo límite. **Limpieza:** se borró un `listarDe` de sesiones que ningún endpoint llamaba (y que tenía los argumentos de la comparación de fechas al revés, o sea que nunca corrió), más `email`/`tenantId` —restos del andamio multi-inquilino que nadie leía— y un `hasRole()` sin un solo uso. **Rendimiento:** el rol Administrador, que tiene las otras cinco secciones de Gerencia pero no "Usuarios y roles", se comía **tres 403 cada vez que entraba** a la pantalla, con un aviso de error que ni se ve; ahora no se pide nada sin el permiso. Y el catálogo de permisos —una constante de ~5 KB— dejó de re-bajarse después de cada guardado. **Cuatro comentarios que quedaron mintiendo** (dos de mis cambios de hoy) se corrigieron, incluido el del freno de login que seguía diciendo que el mínimo de contraseña es 4: un comentario que miente sobre una defensa es peor que no tenerlo. Verificado con **14 pruebas nuevas** —entre ellas que la fila de la sesión en la base cambia de verdad de sucursal, y que la cajera no puede moverse sola— y **9 suites sin regresiones**'],
              ['**14/8/2026**', '**Gerencia: los medios y bajos — y el freno del login dejó de ser un arma.** **El cambio que más pesa:** el contador de intentos fallidos era por usuario a secas, así que el castigo lo manejaba el atacante. Cinco intentos contra el id del dueño lo dejaban afuera, y repitiendo el ciclo se lo podía mantener bloqueado **desde internet, sin sesión y sin costo** — un lunes a la mañana con la caja sin abrir eso no es teórico. Ahora la clave del contador lleva **el origen además del usuario**: los intentos de un extraño ya no cuentan contra la cajera que entra desde el local. Verificado en la prueba: al atacante lo frenan al sexto intento **mientras la cajera entra normalmente desde otra IP**. **Lo que se paga a cambio, dicho en voz alta:** un atacante con muchas IPs consigue 5 intentos por IP contra el mismo usuario, en vez de 5 en total. La defensa contra eso no es el contador —siempre se puede rotar de IP— sino que la contraseña no sea adivinable, así que **el mínimo subió de 4 a 8 caracteres en el mismo cambio**. Las dos piezas van juntas y así quedó escrito en el código. El mínimo rige solo para contraseñas NUEVAS: las que ya están guardadas siguen entrando (probado con una de 4), así que no deja a nadie afuera — cambiar los `1234` de la semilla sigue en el checklist del deploy. **Lo demás:** el endpoint público del login dejó de mandar `tienePassword`, que decía **qué cuentas están sin contraseña** y que la pantalla ni siquiera usaba (el único que lo muestra es Gerencia, que va con permiso); las ramas "desactivado" y "sin contraseña" ahora **gastan intento** como cualquier otra, en vez de ser un canal gratis para sondear el estado de cada cuenta; y el desplegable del login dejó de mostrar "Lucas — " con el guion colgando, porque pedía un `rolNombre` que la API **no manda a propósito** — el comentario ahora avisa que "arreglar" ese guion agregándolo publicaría quién es el superadmin. **Y el token dejó de sobrevivir a la noche:** la copia heredable de la sesión vive en `localStorage`, que sobrevive a cerrar el navegador, así que en la PC del mostrador el que abría Chrome a la mañana entraba como el último de la tarde anterior. Ahora esa copia caduca a las 10 horas — y el tope limita **solo la herencia hacia una pestaña nueva**, no la pestaña que está trabajando, así que a nadie se le corta el turno. Verificado en el navegador de verdad, con las dos mitades: con la marca vigente la sesión se hereda y se prueba contra el servidor, y con la marca vencida **no se hereda, se borra la copia y aparece el login**. **14 pruebas nuevas**, y las cuatro suites de autenticación y permisos sin regresiones'],
              ['**14/8/2026**', '**Auditoría de GERENCIA: `gerencia.usuarios` era, en los hechos, el superadmin.** Gerencia tiene seis secciones pero **cinco están marcadas "pronto"**: la única construida es *Usuarios y roles*, o sea la raíz de confianza de todo el sistema. Un agujero acá no roba un dato: reparte llaves. **Había TRES puertas distintas al mismo lugar, y una cuarta que las esquivaba a todas.** (1) **El comodín `*` se podía pedir por API.** La validación decía literalmente `p !== "*"` para que el rol superadmin sobreviviera a un guardado, pero como es la misma función para crear que para editar, cualquiera podía pedir `*` para un rol nuevo y asignárselo: superadmin en dos llamadas. Y `*` no es un permiso más — `tienePermiso` y `esJefe` lo aceptan **antes de mirar nada**, así que además del catálogo entero da el cruce de sucursales. (2) **Se le podía cambiar la contraseña al dueño.** `editarUsuario` miraba si el usuario existía y si era el último superadmin, pero **nunca quién estaba editando ni a quién**: el bloque de contraseña no tenía ninguna condición. Un `PATCH /usuarios/<el dueño> {"password":"..."}` y se entraba como él — y el cierre de sesiones, que está bien puesto, encima lo echaba de las suyas. Ni hacía falta la consola: el botón **Editar** estaba en su fila. El comentario del archivo decía "superadmin: no se edita, no se borra", y eso valía para el **rol**, no para el **usuario**. (3) **Nombrar superadmin era una llamada**: del `rolId` solo se validaba que existiera, así en el alta como en la edición — y con dos superadmins activos, el candado del "último superadmin" deja de proteger al original. (4) **Y la cuarta, que hacía inútiles a las otras tres:** el que reparte podía darse permisos que él no tenía. Sin tocar el comodín, un `PATCH` al propio rol con todo el catálogo daba `precio_manual`, `diferencias`, `gastos_pagar_proveedor` y `devoluciones` — todo lo que mueve plata. **El arreglo es un concepto solo, escrito en un lugar:** no se reparte lo que no se tiene, y al superadmin no se lo toca desde afuera. El comodín ya no se acuña por API **ni siquiera siendo superadmin** (existe solo en el rol que planta la semilla); nombrar o editar a un superadmin exige ser uno; y los permisos que se otorgan tienen que ser un subconjunto de los propios. La pregunta de "¿es un rol de mando?" se hace por sus **permisos** y no por el nombre `superadmin`, porque el poder está en el comodín y preguntar por la clave dejaría pasar cualquier rol que lo tuviera guardado. **Lo importante para vos: hoy nada de esto era explotable**, porque `gerencia.usuarios` no lo tiene nadie salvo el superadmin — el rol Administrador tiene las otras CINCO claves de Gerencia y deliberadamente no esa. La separación ya estaba bien pensada; lo que faltaba era que el código la sostuviera el día que tildaras ese checkbox para otro rol, cosa que la pantalla presenta igual que "Reportes de ventas". Verificado con **19 pruebas que ejecutan cada ataque**, con una precaución: el blanco es un superadmin **de prueba** creado por el test, nunca el real, y al cerrar se comprueba que la contraseña del dueño quedó intacta. Las seis suites anteriores sin regresiones'],
              ['**13/8/2026**', '**Depuración de WEB: el módulo estaba limpio, y el único cuello de botella era el catálogo.** Poco para barrer: cero `console.log`, cero CSS huérfano en el sitio, cero imports muertos, y los espejos de oferta entre la tienda y el POS (`ofertaVigente`, `precioConOferta`) **coinciden** — no hay divergencia de plata. Código muerto real, uno solo: una constante `TIPOS_IMAGEN` que quedó de una versión anterior (la validación de tipo ya la hacen el mapa de permisos y `resolverRefId`). **Lo que valió la pasada fue el catálogo público.** Adentro del loop de productos había un `filas.find` sobre toda la tabla de precios y un `provs.filter` sobre toda la de proveedores, POR CADA producto: O(productos × filas). En el endpoint más caliente del sitio —que además corre en cada pedido— con el catálogo grande son millones de comparaciones por llamada. Se pre-indexan las dos tablas hijas en un Map antes del loop y queda lineal; es una refactor que **no cambia el resultado**, verificado: el catálogo sigue devolviendo los mismos 67 ítems con los mismos precios, stock y ofertas exactos, y las dos suites de Web (que ejercitan catálogo y pedido) más las de Ventas siguen en verde. **Quedó una cosa anotada para vos**, que es UX y no plata: la pestaña "Ofertas del sitio" del panel marca "Vigente" por fecha, pero el sitio además filtra por día de la semana y por sucursal — así que una promo de fin de semana figura "Vigente" un miércoles, y una apuntada a otra sucursal figura como del sitio aunque la tienda es la Distribuidora. Alinearla es fácil; primero hay que decidir si esa tabla debe mostrar "lo que PODRÍA llegar al sitio" o "lo que el sitio muestra ahora mismo". Está en Pendientes. Todo en verde: **327 pruebas** (la depuración no sumó pruebas nuevas: es limpieza y una refactor sin cambio de comportamiento, cubierta por las 47 de Web que ya existían)'],
              ['**13/8/2026**', '**Web: los tres medios y los cuatro bajos, cerrados.** **El cupo por IP se saltaba con un encabezado.** El contador de la tienda y su exención salían de `req.ip`, que detrás del proxy es el `X-Forwarded-For` — dato que escribe el cliente. Con `trust proxy: true`, Express se creía el PRIMER valor de esa cadena, así que un `X-Forwarded-For: 10.0.0.1` a mano hacía pasar al atacante por infraestructura interna (que el cupo exime) y de paso le cambiaba la "IP" en cada intento de login, diluyendo ese otro freno. Se bajó a `trust proxy: «loopback»`: ahora Express solo confía en el proxy que viene de 127.0.0.1 —nginx, en la misma máquina— y toma el valor que NGINX puso ($remote_addr, la IP real); si alguien llega a Node directo, su encabezado se ignora. Se apoya en tres patas que quedaron escritas en el checklist de deploy: nginx pisa el encabezado (no lo concatena), Node escucha solo en localhost, y **el vhost de la tienda —que todavía no existe— tiene que pisarlo igual** cuando se cree. **El botón de la portada podía apuntar a cualquier lado.** El `ctaUrl` de un slide se guardaba como texto libre; la lista de cinco destinos vivía solo en el `<select>` del panel. Un `PUT` a mano ponía el botón principal del sitio público apuntando al dominio de un tercero, con la marca de la casa arriba (phishing de cobranzas). Ahora el servidor exige que sea una ruta INTERNA —empieza con `/`, no con `//`, sin `:`— y lo que no cumple cae a la portada; no es la lista exacta de cinco (se agranda sola con otro link interno) sino el invariante de verdad. **Los cuatro bajos:** (1) subir una imagen ahora verifica que el destino EXISTA —un `POST /web/imagenes/producto/$i` en un `for` de 1 a 5000 dejaba miles de filas de 800 KB colgadas de productos inexistentes que engordan cada backup—, y `logo`/`favicon` se fuerzan a `refId=1` (hay uno solo de cada uno). (2) El pedido público recorta los textos largos del lado del servidor (nombre/apellido a 60, observaciones a 500): el `maxLength` estaba solo en el checkout, y un `POST` directo con 3 MB de texto volvía inusable la bandeja de Órdenes. (3) `GET /web/estadisticas` dejó de bajarse TODA la tabla de renglones de presupuesto histórica para cruzarla — ahora pide solo los del período. (4) El checklist de deploy tenía dos ítems FALSOS que lo hacían dejar de leerse: decía que faltaba helmet (está puesto hace semanas) y que "no hay login del lado del servidor" (el guard y el login están); se corrigieron a lo que de verdad queda. **Quedó una sola decisión tuya:** el catálogo público publica el stock exacto de la Distribuidora, y el recorte que propone el auditor (`min(disponible, 20)`) rompería el pedido mayorista de 50 kg de algo que hay 123 — es tu llamada, está en Pendientes. Verificado con **19 pruebas**: el cupo frena a la IP pública en la request 61 y exime a la privada, el `ctaUrl` externo/`javascript:`/`//` cae a la portada y la ruta interna sobrevive, la imagen a un destino inexistente da 404 y `logo/7` se guarda como `logo/1`, y el pedido con textos de 5.000 y 200 caracteres queda en 500 y 60. **327 pruebas, todas en verde**'],
              ['**13/8/2026**', '**Auditoría de WEB: el crítico y los dos altos, cerrados — y una imagen que hoy no se ve.** Web es el **único módulo con superficie pública en internet**, así que sus agujeros no necesitan que nadie esté adentro. **El crítico era una cadena completa de cajera a dueño.** La subida de imágenes aceptaba cualquier cosa que dijera ser `image/*` — y ahí entra el **SVG, que no es una imagen sino un documento que ejecuta JavaScript**. Esa imagen vuelve a salir por `GET /tienda/imagenes/...`, que es público y que nginx publica **en el mismo origen que el dashboard**, donde vive el token de sesión del CRM. O sea: se sube un SVG como "foto de producto", se le pasa el link al dueño, y el script se lleva su sesión. Ahora **el formato sale de los bytes, no del rótulo**: lista blanca de PNG, JPG y WebP contrastada contra la firma real del archivo, y se guarda lo que los bytes dicen ser. Del lado de la salida hay **tres candados más, y ninguno reemplaza a los otros**: el mime sale de la lista blanca y no de la base (una fila vieja con un mime peligroso ya no puede salir), `Content-Disposition: attachment` para que el navegador la baje en vez de renderizarla, y `Content-Security-Policy: sandbox` para que si igual la renderiza, ahí adentro no corra nada. No le quita nada al uso real: el panel pasa toda imagen por el canvas y exporta WebP. La tabla de firmas **se mudó a `common/archivos.ts`** en vez de escribir una segunda copia: Compras ya la tenía con el mismo razonamiento escrito, y dos copias se separan solas. **El primer alto: los cinco endpoints del módulo no tenían un solo `@Permiso`.** Las cuatro claves de Web existían en el catálogo y se miraban **únicamente en el navegador**, o sea que escondían el botón y no la llamada: con cualquier sesión válida se ponía el sitio entero en "Sin stock" (`webStockMin: 99999` sobre los más vendidos) o se le cambiaba el logo. Como el permiso de una imagen depende del **tipo** —la foto de producto es de quien administra el catálogo web, el banner de quien arma el contenido, el logo es configuración— y el tipo es un dato del cuerpo, el decorador pide cualquiera de los tres y el servicio exige el exacto; las dos puertas se derivan **del mismo mapa**, así que no pueden discrepar. **El segundo alto: el pedido del sitio no tenía techo.** No agrupaba renglones repetidos, no miraba el stock publicado y `Number("1e999")` es `Infinity`, que es truthy, pasaba el `> 0` y **Postgres lo guardaba**. Con el cuerpo de 4 MB entraban ~110.000 renglones válidos en un solo INSERT, y el mismo producto partido en dos renglones esquivaba cualquier control de stock. Ahora: 100 renglones como máximo (medido **antes** de tocar la base), agrupado por producto, cantidad finita, y se rechaza lo agotado y lo que excede el disponible — con el mensaje diciendo cuánto queda. **Y una que encontré verificando, que no era del informe:** helmet marca toda la API como `Cross-Origin-Resource-Policy: same-origin`, que está bien para el dashboard —comparte origen— pero deja al **sitio público sin poder mostrar una sola imagen** cuando vive en otro dominio (o en otro puerto, como en desarrollo). El navegador cortaba con `ERR_BLOCKED_BY_RESPONSE.NotSameOrigin` y no se veía ni el logo ni el favicon ni una foto. Se abrió **en ese único endpoint**, que es público por definición. Verificado con **28 pruebas** que ejecutan cada ataque —el SVG declarado, el SVG disfrazado de PNG, la fila vieja ya guardada, los cinco endpoints con una cajera, el permiso justo con solo `web.contenido`, los 101 renglones, el `1e999` y el pedido partido en dos— más la comprobación en el navegador de verdad, con el buscador del sitio, de que la foto del producto vuelve a cargar y no queda ninguna imagen rota'],
              ['**13/8/2026**', '**Depuración de ALMACÉN: una pantalla que rompí hoy y un remito valuado con dos criterios.** **Lo primero es un error mío del mismo día.** Al escribir los DTO del módulo declaré el campo `diferencia`, pero el servicio lee `cantidadReal` y el modal manda `cantidadReal` — y como el validador borra todo lo que el DTO no declara, al servicio le llegaba vacío y **"Corregir fraccionado" contestaba "la cantidad real no puede ser negativa" pusieras lo que pusieras**. Es la contracara del candado: poner un DTO cierra la puerta a lo que no corresponde, y si un campo está mal escrito cierra también la puerta buena. Después revisé campo por campo los 16 DTO contra lo que el servicio lee de verdad: ese era el único. **La fórmula que daba distinto:** el mismo remito valuado de dos maneras. El libro de Operaciones lo medía por lo **pedido** y el detalle del remito por lo **preparado** —lo que de verdad subió al camión, que es lo único con costo congelado—. Diverge en las dos direcciones: un renglón agregado durante la preparación (pedido 0, preparado 30) salía **en $0** en el libro, o sea mercadería que se fue del depósito y no figura; y un renglón corto (pidieron 20, había 14) lo valuaba **43% de más**. El comentario de la propia línea decía "valuada a lo ENVIADO" y no lo hacía. **La segunda:** en la Métrica de Cafetería, con el buscador puesto, "Artículos distintos" y "Kg totales" filtraban pero "Envíos" y "Enviado a costo" seguían midiendo el período entero — cuatro números de la misma tarjeta, a diez centímetros, sobre conjuntos distintos. **Limpieza:** los tres pendientes que el propio depurador había dejado anotados para esta pasada quedaron cerrados —el import muerto, las dos clases CSS huérfanas y las constantes `DIAS_VENC_*`, que eran una **tercera** copia de los umbrales 7/15/30 que nadie leía—, más dos campos de DTO que nadie consume, el `move()` que seguía declarando que devolvía `true` cuando ahora lanza, y un `toISOString()` que después de las 21 h hacía nacer el filtro "hasta" **mañana**. **Rendimiento:** el N+1 que había marcado el auditor (un SELECT por renglón dentro de la transacción, hasta 600 idas y vueltas) quedó en 3 consultas, en Vencimientos y en su copia literal de Cafetería; el libro de Operaciones dejó de bajarse dos tablas enteras; y tres paneles que pedían todo dos veces al abrir (6→3, 8→4 y 2→1 consultas) usan ahora el mismo idioma que Compras ya había arreglado. Verificado con **9 pruebas nuevas** que mandan el cuerpo exacto del modal de corregir fraccionado y comprueban que el kilo del paquete que no salió vuelve al granel. **308 pruebas en total, todas en verde**'],
              ['**13/8/2026**', '**Almacén: los ALTOS y MEDIOS, cerrados (migración 0062).** **Coffit ya no se autentica con una cuenta del CRM.** Era el hallazgo más incómodo porque no dependía de un error sino del diseño: coffit es un sistema, no una persona, y para leer sus envíos usaba usuario y contraseña de alguien del CRM guardados en la configuración de otra máquina. Ese token no era "solo lectura de envíos" — era el panel entero, con el que se mueve stock. Ahora tiene su propia llave (`COFFIT_TOKEN` en el `.env`, que viaja en la cabecera `X-Clave-Servicio`) y **abre únicamente ese endpoint**. Se comparó con `timingSafeEqual` y no con `===`, porque comparar textos corta en el primer byte distinto y el tiempo de respuesta filtra el secreto letra por letra. Lo importante para vos: **sin cargar la variable, todo sigue funcionando igual que hoy**, así que el cambio se activa el día que lo coordines con quien mantiene coffit, sin cortar el servicio. **Y el sync perdía envíos en silencio.** La página corta en 200, pero el cursor que devolvía era el reloj de pared: con una tanda de 250 cambios, los 50 que no entraron quedaban DETRÁS del cursor y **no se devolvían nunca más** — del otro lado, mercadería que no ingresó a la cafetería y que nadie iba a notar hasta un inventario. Ahora el cursor es la marca del último envío devuelto, viaja `hayMas` para que coffit pida de nuevo enseguida, y se vacía el grupo de esa marca de tiempo para que el corte no pueda partir dos ediciones simultáneas. El contrato quedó actualizado con las dos cosas y con el aviso de reconciliar una vez si el cursor viene de antes. **El resto:** la **versión del envío pasó a ser obligatoria** —era opcional, y un candado que se abre no mandando la llave no es un candado: un `PUT` sin ese campo salteaba la comparación y ganaba siempre—; **no se le puede cambiar el tamaño a una presentación con paquetes en stock**, que era el gemelo silencioso del borrado (ese sí estaba cerrado): pasar 0,5 kg a 5 kg convierte 250 kg en 2.500 al instante, multiplica por diez el costo del paquete y hace mentir la valorización y el reporte de pérdidas en la misma proporción; **la base garantiza que haya UNA sola distribuidora** (índice único parcial), porque ese `tipo` no es una etiqueta sino el destino por defecto de toda compra y el origen de todo envío al café — con dos, la mercadería empieza a entrar en el depósito equivocado sin que nada avise; y **las lecturas de stock, remitos e incidencias se filtran por sucursal**, así que un repositor deja de poder bajarse la foto del negocio entero. También: **la baja por incidencia y la cancelación de un remito dejaron de ser anónimas** (el autor sale de la sesión, no del desplegable de "responsable", que es OTRO dato — a quién se le atribuye el faltante), el listado de remitos dejó de traerse las tres tablas enteras en cada bootstrap, y se corrigieron **dos fechas** que se guardaban un día antes por la trampa de siempre (un vencimiento cargado como 1/9 quedaba el 31/8 a las 21 h, y el vigía lo daba por vencido un día antes). Verificado con **21 pruebas**, entre ellas la carrera real: **dos resoluciones simultáneas de la misma incidencia** —el doble clic— donde gana una sola y el comprometido baja exactamente 4, no 8. Todo en verde: **299 pruebas**'],
              ['**13/8/2026**', '**Auditoría de ALMACÉN: los tres críticos y las dos líneas del motor.** Almacén estaba **más atrasado que Compras y Ventas juntos**: sus **55 endpoints** (26 de inventario, 10 de vencimientos, 14 de cafetería, 5 de sucursales) tenían **cero permisos, cero `@Auth()` y `@Body() any` en todos los POST**. Y lo más caro: las siete acciones que los describen —`inventario`, `merma`, `defectuoso`, `fraccionar`, `preparar`, `pedidos`, `incidencia_crear`— **existían desde siempre en el catálogo y las miraba únicamente el navegador**. El rol Cafetería, que ve UNA pantalla, copiaba su token y con un POST daba de baja 300 kg como merma o los inventaba. **Lo que se cerró.** (1) `@Permiso` en los cuatro controllers, con la regla de que la acción va SOLA cuando es más fuerte que la pantalla: el movimiento manual elige su llave **según el tipo** —`merma` y `vencido` piden `merma`, `defectuoso` pide la suya, el ajuste pide `inventario`—, porque con una sola llave para los cinco, quien puede corregir un conteo podría asentar pérdidas. Procesar un vencido pide `inventario` (es una baja real con pérdida contable) y resolver una incidencia también. (2) **La sucursal sale de la sesión**, y esto no era un ataque de consola: el desplegable del panel listaba las cinco sucursales sin mirar el rol, así que el repositor de Fontana elegía "Express 2" y le bajaba 80 unidades a un local donde no pisa. Ahora el servidor ignora el número del body y el combo muestra solo la propia. (3) **Borrar una sucursal se llevaba su stock por cascada**, sin un movimiento, sin log y sin vuelta atrás; ahora es de gerencia (como usuarios) y se rechaza si queda una sola unidad o una incidencia abierta. **Y las dos líneas del motor, que son las que más importan** porque `inventario.service` lo llaman los cinco módulos: **`move()` devolvía `false` cuando no había qué mover y ninguno de sus OCHO llamadores lo miraba**. La cadena: se confirma una lista de transferencia y la reserva falla en silencio → el despacho falla igual → la recepción resta sin piso → el origen queda con **tránsito negativo** y el destino **gana unidades que nunca existieron**, con tres movimientos de auditoría diciendo que todo salió bien. Ahora lanza, y como corre adentro de una transacción, el error revierte todo: si la mercadería no está, el documento no se emite. La otra: **`resolverIncidencia` era la única transición del módulo sin reclamo atómico** —todo el resto usa `FOR UPDATE` o `WHERE estado = <el que leí>`—, así que un doble clic con la base cargada dejaba `comprometido = −10` y `disponible = +20`: **diez unidades de la nada**. De paso: el movimiento manual dejó de aceptar los once tipos y acepta los cinco que son del almacén (con `venta_granel` se descontaba stock sin ticket ni caja, y el arqueo no lo veía nunca); `cantidad: 1e999` es `Infinity`, pasaba el guard `> 0` y dejaba la fila arruinada **para siempre** (`Infinity − 300` sigue siendo `Infinity`); un `cantidadRecibida: "x"` dejaba 200 kg varados en tránsito **sin ningún camino en el código para sacarlos**; el borrador del pedido del día de otra ruta se vaciaba con un `PUT` y no tiene historial, así que el trabajo de la jornada desaparecía sin rastro; y el **autor de una incidencia lo elegía el cliente** de un desplegable con todos los usuarios, así que la pérdida figuraba contra quien uno quisiera. **La regla de las transferencias la decidió el dueño:** cada sucursal PIDE y RECIBE lo que llega a ella (`destinoId`) y PREPARA lo que sale de ella (`origenId`); el único pedido que prepara alguien que no es su dueño es el de la Cafetería, y ese va por otro circuito. Verificado con **23 pruebas que ejecutan los ataques del informe** —incluida la comprobación de que el stock no se movió ni una unidad y de que no quedó ninguna fila negativa—, y las 8 suites anteriores sin regresiones: **278 en total**'],
              ['**13/8/2026**', '**Ventas: los 16 ALTOS y MEDIOS de la auditoría, cerrados (migraciones 0060 y 0061).** El auditor volvió a pasar y encontró **nueve más** de los que estaban anotados, dos peores que los conocidos, **más una regresión que había metido yo** con el portero de precios. **La regresión primero, porque rompía una venta real:** todo presupuesto mayorista dejó de poder cerrarse en el POS. El botón mandaba el precio congelado **sin decir con qué lista se congeló**, así que el servidor lo comparaba contra el precio de HOY y lo tomaba por precio pisado a mano: el vendedor veía "hace falta el permiso para pisar precios" sobre un pedido que la casa ya había firmado. Un presupuesto existe justamente para que el precio no se mueva —para eso tiene vencimiento—, así que ahora el renglón guarda su `listaId` (0060) y el precio cotizado es una **sexta puerta** del motor de precios, con su propio origen `presupuesto` (0061) para no confundirlo nunca con un precio tocado en el mostrador. La excepción es angosta y está probada: el precio tiene que coincidir con el renglón de un presupuesto **confirmado, vigente y de ese cliente**; con un precio inventado, con el pedido de otro cliente, con uno en borrador o con uno vencido ayer, sigue dando 400. **Los dos hallazgos nuevos que eran peores que los conocidos:** (1) **anular un recibo era gratis y anónimo** — el arqueo solo suma las cobranzas confirmadas, así que se cobraban $80.000 en efectivo a la mañana, se anulaba el recibo a las 19:50 y el esperado del cajón bajaba $80.000: el cierre daba diferencia 0 y el faltante no existía para el sistema, sin quedar ni quién ni por qué. Era el gemelo exacto del agujero que se había cerrado en las ventas, en la puerta de al lado. Ahora pide `devoluciones`, motivo obligatorio, guarda quién y cuándo, y **no se puede anular contra un turno ya cerrado**. (2) **`presupuestoId` no se validaba contra nada**: un ticket de $1 a Consumidor Final con `presupuestoId: 57` cerraba el pedido de $480.000 de otro, lo sacaba de la bandeja de armado y liberaba los 300 kg reservados. La variante de sucursal era peor porque fallaba **en silencio**: la reserva se liberaba con la sucursal de la VENTA, así que un pedido reservado en Fontana y cerrado desde otra caja liberaba stock donde no había nada comprometido, y la mercadería de Fontana quedaba apartada **para siempre** sin ningún documento que explicara por qué. **Los otros:** la oferta **no validaba su alcance** —con un 3×2 de galletitas activo, un renglón de aceite de $80.000 se cobraba $1— y ahora además tiene techo EXACTO por mecánica (antes solo se acotaban las de porcentaje; para `nxm`, `pack` y `precio_fijo` el límite era el 100% del renglón). **Ver el punto de venta no es cobrar**: la acción `ventas` existía en el catálogo desde siempre y **ningún endpoint la exigía**, así que un rol "Consulta de mostrador" armaba tickets, los confirmaba, descontaba stock y le metía el efectivo al turno del cajero; verificado antes de aplicarlo que los cinco roles que ven el POS ya la tienen. **Presupuestos era el único módulo sin candado de sucursal**: se confirmaba el pedido de otra sucursal (dejando 400 unidades de ALLÁ comprometidas, que es denegación de venta con solo poder cotizar) y se cancelaba el de otro liberándole la reserva al vendedor que lo estaba armando; ahora las siete escrituras lo comparan y el listado se filtra por sucursal en el servidor. Sus **siete endpoints con `@Body() any`** ya tienen DTO con topes: `precioLista: 1e999` es `Infinity`, sobrevivía al `|| 0` y **Postgres lo guardaba**, dejando una fila cuyos totales vuelven como `null` y que no se puede editar ni borrar desde la pantalla. **El listado dejó de bajarse entero** con todos sus renglones (Órdenes web lo recargaba cada 30 segundos para contar pendientes) y la tabla, que no tenía **ningún** índice, ahora tiene cuatro. **La venta es de quien la armó** (0060): la línea decía `dto.usuarioId ?? borrador.usuarioId`, pero el interceptor del autor pone el de la sesión SIEMPRE, así que el `??` nunca caía del otro lado — Marta armaba el ticket toda la mañana y quedaba a nombre de Juan por apretar F2; ahora quién cobró va en su propia columna. **El bootstrap dejó de repartir los permisos de todos los roles** (era el mapa de a quién apuntar: quién tiene `precio_manual`, quién `diferencias`), y las **lecturas de caja** dejaron de mostrar el efectivo que debería haber ahora mismo en el cajón de otra sucursal y el histórico de faltantes de cada compañero. **La cobranza ya no se fecha en otro mes** —un recibo fechado en noviembre entraba al turno de hoy y ningún corte lo veía— ni admite un importe de $900.000.000, que dejaba al cliente con saldo a favor y crédito ilimitado sin que entrara un peso. Y **no se le pueden asignar listas al Consumidor Final**: era la forma de poner TODO el mostrador a precio mayorista sin necesitar `precio_manual` y sin que ningún renglón quedara marcado. Verificado con **26 pruebas nuevas que ejecutan cada ataque del informe** más **10 del precio congelado**, y las 8 suites anteriores sin regresiones: **254 en total**. Quedó **sin hacer y anotado en Pendientes** el caché de `GET /ventas/catalogo`: son 14 consultas por llamada y es una palanca real, pero un caché con vencimiento simple le mostraría al cajero el stock viejo justo después de vender, así que necesita invalidación de verdad'],
              ['**13/8/2026**', '**Depuración de VENTAS: el POS no podía cobrarle a un cliente con descuento.** El módulo estaba limpio de basura —eslint no reporta un solo import ni variable sin usar en sus 10.000 líneas, y de las 76 clases del CSS del punto de venta **ninguna** quedó huérfana—, así que lo que valió la pasada fueron dos fórmulas que daban distinto en cada punta. **La que rompía la venta:** el navegador calculaba el descuento de una oferta de porcentaje sobre el **bruto** del renglón, mientras la API lo acota al mismo porcentaje del neto **ya bonificado**. Con un cliente que tiene su 10% de descuento, 10 unidades de $1.000 al 20% daban **$2.000** en la pantalla contra un techo de **$1.800** en el servidor: la API rechazaba el ticket entero. Y como ese control corre también sobre el borrador, **el autoguardado fallaba en cada tecla y la venta no se podía ni guardar**, mucho menos cobrar. Cualquier cliente con descuento propio quedaba sin poder comprar nada en oferta. Se corrigió el navegador, que era el que descontaba de más. El límite quedó explícito y no es "todas las ofertas": se escalan las **proporcionales** —porcentaje, 2ª unidad y el 3×2, donde la unidad gratis vale lo que el cliente iba a pagar por ella ($900, no $1.000)— y **no** las que prometen un precio, `precio_fijo` y `pack` ("el kilo a $800", "el pack de 6 a $4.000"): escalarles el ahorro le cobraría al cliente más que el número del cartel, y el servidor tampoco lo pide. Cómo se combinan un precio de oferta y el descuento del cliente quedó **para que lo decida el dueño**, sin cambiarlo por ahora. **La segunda:** la cabecera de la venta no era la suma de sus propios renglones — cada renglón se guardaba redondeado y el total acumulaba el neto crudo, así que 4 renglones de $10,005 sumaban $40,04 en las filas y $40,02 arriba. El POS mandaba 40,04, `validarPagos` tolera un centavo y **rechazaba el cobro sin que hubiera nada que corregir en pantalla**. **Y una que firmaba un arqueo falso:** el modal de cerrar caja tomaba el campo vacío como "conté $0", así que cerrar sin escribir nada dejaba una diferencia inventada del tamaño de todo el efectivo del día, firmada y sin poder reabrirse; el control intermedio ya exigía el conteo y el cierre —que es el que queda— no lo pedía. Además: delegar una venta ya no ofrece usuarios dados de baja (la API los rechaza, así que ofrecerlos era ofrecer un error), la validación de medios de pago de una oferta dejó de leer la tabla entera de ofertas para descartarla en memoria, y el catálogo del POS dejó de hacer tres consultas de ofertas en cada autoguardado cuando el ticket no tiene ninguna (de 10 a 7 por tecla). Verificado con **13 pruebas del motor real del navegador** medido contra la fórmula del servidor, más **8 contra la API de verdad** con un producto y una oferta reales que prueban las dos direcciones (el número nuevo se guarda, el viejo da 400 con el techo en el mensaje). Las 6 suites anteriores siguen en verde: **195 en total**'],
              ['**12/8/2026**', '**Auditoría de seguridad de VENTAS: los seis críticos, cerrados (migración 0059).** El módulo estaba peor que Compras: de sus **9 controllers, solo `listas` y `precios` pedían permiso**. Los otros siete no verificaban ninguno, así que cualquier sesión válida —incluido el rol **Fraccionador**, que en el menú ve dos pantallas— podía abrir y cerrar la caja de otra sucursal, sacar plata del cajón con un egreso, anular ventas sin dejar rastro, dar crédito ilimitado a un cliente y **apagar por HTTP todos los controles de la configuración**. Lo que se arregló: (1) **`@Permiso` en los siete**, con las claves del catálogo que ya existía; sacar plata del cajón pide `diferencias` y anular pide `devoluciones`, cada una su propia llave. (2) **El ticket lo calcula el SERVIDOR.** Antes tomaba precio, descuento e IVA tal como venían: `descuento: 100` con un pago de un centavo daba mercadería gratis con ticket numerado, y el arqueo esperaba $0,01. Ahora el IVA sale del producto, el precio se recalcula contra la fila de `producto_listas` y **la lista tiene que estar habilitada por una de las cuatro puertas del motor** (cliente, unidades del producto, regla de marca, monto del ticket) — mandar el `listaId` mayorista con su precio real ya no alcanza: hay que haberlo ganado. (3) **Muere el total negativo**: `iva: -200` daba total **−$50.000**, y en cuenta corriente eso le BAJABA la deuda al cliente sin aparecer en Cobranzas, que solo lista saldos positivos. (4) **La sucursal sale de la sesión**: un cajero mandaba `sucursalId: 5` y la venta se colgaba del turno de Fontana descontando el stock de allá — la cajera de Fontana cerraba con un ticket que no hizo. (5) **La cobranza en efectivo entra al turno**, que era un agujero abierto SIN que nadie atacara nada: el único cliente que crea cobranzas nunca mandaba el turno, así que **todas** nacían sin él y el arqueo no las veía — se cobraban $200.000 en efectivo y el cierre daba diferencia 0. (6) **Anular deja rastro** (`anuladoPor`, `anuladoEn`, `anuladoMotivo`): era la forma de tapar un faltante, porque saca el efectivo del arqueo y devuelve el stock, así que el cierre cuadra en cero. Ahora pide motivo obligatorio, guarda quién y cuándo, el autor llega hasta el movimiento de reingreso (antes llegaba `undefined`) y **no se puede anular contra un turno ya cerrado** — eso se corrige con nota de crédito. Se sumó el permiso **`precio_manual`** ("pisar el precio y pasar el tope de descuento"), que es la llave que le da sentido del lado del servidor a `descuentoMaxVendedor` y `overrideListaRequiereAdmin`: las dos existían en Ventas › Configuración y **se evaluaban únicamente en el navegador**. Verificado con **66 pruebas** contra datos reales, y con las 6 suites anteriores en verde (195 en total)'],
              ['**12/8/2026**', '**Los tres pendientes de Compras, cerrados (migración 0058).** (1) **El saldo del proveedor lo calcula la API.** Estaba escrito cuatro veces y la copia del navegador sumaba los comprobantes que tenía en memoria — así que desde que el listado esconde las liquidaciones a quien no tiene el permiso, ese saldo salía **más bajo que la deuda real**, sin ningún aviso. Un saldo que depende de quién lo mira no es un saldo. Ahora sale de `GET /comprobantes/saldos`, que suma en la base en una consulta agrupada. Eso es lo que permitió lo siguiente: **el listado dejó de ser el único sin techo** (300 por defecto, tope 1000). El orden importaba: mientras el saldo se calculara con la lista, acotarla lo habría dejado mal en silencio para cualquier proveedor con más de 300 comprobantes. De paso, el encabezado de Facturación recorría TODOS los comprobantes una vez por proveedor en cada render y sin memo — con 50 proveedores y 2.000 comprobantes, 100.000 iteraciones por cada tecla tipeada en un filtro. (2) **Tres índices que faltaban:** las dos tablas hijas del comprobante no tenían ninguno y se consultan en cada apertura de Facturación; y por `proveedor_id` **no había ninguno usable** aunque pareciera que sí — el único que lo lleva de primera columna es parcial (`where numero is not null`), así que Postgres no puede usarlo para un filtro por proveedor. Verificado con `explain` forzado: los tres se usan. (3) **La NC que devuelve mercadería ya se puede cargar.** La API lo soportaba desde hace tiempo pero ninguna pantalla podía activarlo, así que la mercadería devuelta a un proveedor quedaba en el depósito y había que sacarla a mano. Acá el tilde **sí hace falta y no puede deducirse del tipo**: una nota de crédito a veces es una devolución y a veces solo corrige un precio mal facturado o compensa un bulto roto que igual te quedaste — solo quien tiene el papel en la mano lo sabe. Con el tilde puesto, la sucursal pasa a ser obligatoria y el paso 3 avisa en rojo que el stock **se descuenta**. Verificado con 13 pruebas: el saldo agregado coincide con `cuenta()` y con la suma cruda en SQL, la NC sin tilde no mueve stock y con tilde lo baja de 10 a 7. Quedó SIN tocar, por decisión del dueño, que Operaciones e Historial del proveedor muestren la misma tabla'],
              ['**12/8/2026**', '**Depuración de COMPRAS: poco código muerto y CINCO bugs encontrados de paso.** El módulo estaba limpio —de 135 clases del CSS solo 2 sin usar, y el código muerto real fueron 9 cosas chicas (cuatro helpers de fecha, un `puedeLeerQr()` que devolvía `true` fijo, una consulta a `productos` dentro de la transacción de reversión de costos que nadie leía)—. Lo que valió la pasada fueron los bugs. **El caro:** la columna "Precio de venta" de Proveedores › Productos y costos estaba **58,8 veces más alta que el precio real**. Era una quinta copia a mano de la cadena de costo, mal de tres formas a la vez: miraba solo el primer descuento (ignorando el segundo, que el importador del sistema viejo carga), ignoraba el modo "costo con IVA incluido" (mostraba 0), y mezclaba escalas — devolvía el neto **del bulto** mientras la ganancia se calculaba con el neto **unitario**. Para el atún CUMANA (bulto de 48, descuentos 10 y 18,3) mostraba $71.560 donde el precio es $1.218. Ahora usa `costosFormato`, que es el espejo del backend que ya usa todo el resto. **Dos que podían tirar la pantalla:** `usePaginado` y dos `useState` estaban DESPUÉS de un `return` temprano, así que la cantidad de hooks del componente cambiaba entre renders. No es teórico: guardar costos recarga el bootstrap y recalcula las filas, y el modal de baja es justo el que hace desaparecer el producto del store — en los dos casos React tira "Rendered fewer hooks" y se cae la pantalla. **Y dos chicos:** el botón "Limpiar" de Productos aparecía cuando lo único cambiado era el filtro de estado y al hacer clic no pasaba nada (no lo reseteaba), y la bandeja "Por procesar" se pedía **dos veces** en cada entrada, con dos efectos disparando al montar. Compras quedó con **cero errores de eslint** (eran 6). Quedaron cuatro cosas para decidir, anotadas en Pendientes: `GET /comprobantes` es el único listado sin techo (se descarga entero al abrir Facturación, y acotarlo exige mover antes el saldo del proveedor a la API), faltan tres índices, la NC que devuelve mercadería y dos pestañas del proveedor que muestran la misma tabla'],
              ['**12/8/2026**', '**Auditoría de seguridad módulo por módulo: cerrado COMPRAS.** El auditor encontró 13 cosas y el titular fue que cerrar la API tapó la puerta grande pero **el segundo nivel —los permisos— había llegado a 3 de los 7 controllers**: cualquier sesión, incluida la del rol Cafetería (que ve UNA pantalla), podía sacar plata del cajón de otra sucursal, crear deuda, cambiar costos y borrar papeles. **Los dos críticos.** (1) Los 11 endpoints de pagos a proveedor sin ningún permiso: ahora piden `compras.pagos`, `gastos.pagos_proveedor` o `ventas.caja` —las tres, porque **la cajera le paga al proveedor cuando llega el camión** y dejarla afuera rompía el circuito del mostrador—. Pero el ataque no era de rol sino **de sucursal**: bastaba pasar el id de un turno de caja ajeno (se ven en cualquier listado) para cargarle el egreso a ese cajón, y esa cajera cerraba el arqueo en falta con la diferencia congelada. El propio código tenía escrito el pendiente ("falta que el turno sea el de QUIEN pide, eso necesita sesión autenticada"); ya la hay, así que se cerró. (2) `POST /comprobantes` llamaba por adentro al servicio de precios: **se cerró el controller de precios y quedó esta puerta de atrás**, así que un solo request reescribía el costo de catálogo y con él el precio de góndola. Era la regla de las dos puertas y se pisó igual. **Los altos.** La bandeja de papeles entera pide permiso, y el borrado de una página ya no funciona si la factura está cargada (esas imágenes son el respaldo del asiento). Proveedores y catálogos: **lecturas abiertas, escrituras con permiso** — el padrón lo lee medio sistema y cerrar el GET rompía tres módulos, pero el CUIT es lo que la bandeja usa para reconocer facturas. Y el **extractor de PDF tenía techo cero**: recorría todas las páginas del archivo acumulando el texto en memoria, así que un PDF válido de 2 MB con miles de páginas dejaba **la API entera sin responder, el POS incluido** (Node es un solo proceso). Ahora corta en 30 páginas y 200.000 fragmentos, libera cada página y apaga el `eval` de pdf.js, que estaba prendido sobre un archivo que sube cualquiera. **Los medios**, todos de plata: el IVA del renglón aceptaba `300` (ahora está cerrado a la lista de la ley, que estaba escrita solo en productos y ahora vive en un lugar); el descuento aceptaba `150`; y la **bonificación negativa esquivaba su propio techo** y dejaba el comprobante con total negativo, restando de la cuenta del proveedor como una nota de crédito que nadie emitió. En el formato de compra, un costo negativo daba **precio de góndola bajo cero** (ahora hay piso y techo, y se filtra el `Infinity` que sobrevive a un `|| 0`). El importador quedó con tope de 3000 renglones. Y `GET /productos` **dejó de mandar los costos de compra y los márgenes a quien no tiene permiso** — se recortan los IMPORTES, no la fila: vaciarla habría roto en silencio todo filtro por proveedor. Verificado con **51 pruebas nuevas** que ejecutan los ataques del informe uno por uno (incluido un PDF de 40 páginas de verdad), más las 67 anteriores sin regresiones'],
              ['**12/8/2026**', '**Factura, liquidación y remito ingresan stock SIEMPRE: se sacó el tilde.** Antes había un casillero "Ingresa stock (recepción)" que en el alta manual arrancaba vacío, así que el caso normal —la factura llega con el camión— necesitaba un clic, y olvidarlo dejaba la deuda cargada con la mercadería afuera del depósito, sin ningún aviso. El dueño explicó por qué el tilde nunca hizo falta: el proveedor manda 50 paquetes de fideos, **25 vienen en la factura y 25 en la liquidación**, y entran los 50 — mitad facturada, mitad no. **Cada documento trae SUS renglones y nada más**, así que no existe el caso de contar dos veces la misma mercadería, que era lo único que el casillero podía prevenir. El remito se queda en la lista aunque el dueño lo marcó como "no aplica" (para él remito = liquidación): sacarlo reviviría la falla de siempre, alguien elige Remito y el stock no entra sin que nada lo avise. Efecto de la decisión: **la sucursal de recepción pasó a ser obligatoria** —antes se podía registrar sin ella dejando el casillero vacío—, y se corta en el paso 1 en vez de que el aviso llegue al confirmar con todo ya cargado. El paso 3 dejó de preguntar por el stock y ahora avisa lo único que todavía se elige mal: **a qué sucursal entra**. Cargar en Express 3 lo que llegó a la Distribuidora deja las dos con el inventario torcido'],
              ['**12/8/2026**', '**LA API SE CERRÓ: hay que estar logueado, y el sistema sabe quién sos (migración 0057).** Era el pendiente más caro y estaba abierto de par en par: el login verificaba bien la contraseña y ahí terminaba — después de eso **cada request era anónima**, así que cualquiera que conociera la dirección leía y escribía todo (costos, precios, stock, ventas). Ahora el login entrega un **token** y un guard exige sesión en los **224 endpoints**. Lo público se marca a mano y son **cinco**: el login, las opciones para poder elegir en el login, el health del deploy y los cuatro de la tienda. Está así —cerrado por defecto— porque la lista al revés deja abierto cada endpoint nuevo hasta que alguien se acuerde de anotarlo. **La sesión vive en la base y no en un token firmado**, y eso compra cuatro cosas: se puede cortar antes de que venza (un empleado que se va, una tablet perdida en una sucursal), los permisos se leen **frescos** en cada llamada, desactivar a alguien le corta el acceso en el acto, y **la sucursal vive del lado del servidor** — el candado del cajero a su sucursal deja de poder abrirse cambiando un número. En la base queda el **sha256** del token, nunca el token: con un `pg_dump` todas las noches, el backup no puede ser la llave. Vence por **inactividad (12 h)** corriéndose con el uso, porque un vencimiento corto deja al cajero afuera en mitad del turno y uno largo deja la caja abierta toda la noche. **El autor de cada cosa lo pone el servidor**: había 56 lugares donde el `usuarioId` llegaba en el body, o sea que cualquiera logueado podía firmar una merma, un pedido o un pago con el nombre de otro. Lo resuelve UN interceptor global (no 56 ediciones: así el endpoint del mes que viene también nace seguro). El **chat** era el peor caso — pedía `?usuarioId=9` y con eso se leían las conversaciones privadas de otro. Lo que NO se pisa, a propósito: el `usuarioId` del **query** del listado de ventas, que es un filtro para mirar el trabajo de otro, y el de **delegar una venta**, que pasó a llamarse `paraUsuarioId` porque significa otra cosa. **Los permisos empezaron a exigirse en el servidor** (antes solo escondían botones): usuarios y roles piden `gerencia.usuarios` —repartir permisos es la operación que permite darse cualquier otro—, y todo lo que toca **precios y catálogo** pide el suyo: un cajero llamando a mano la masiva de márgenes o el `PUT` que pone el precio de un producto se come un **403**. Da 403 y no 401 para que el frontend no lo confunda con sesión vencida y lo eche al login. Además **helmet** (faltaba desde siempre) y **freno de intentos** en el login: con contraseñas de 4 caracteres —y las que se reparten arrancan en 1234— sin freno se prueban las 10.000 en minutos; van dos contadores porque son dos ataques distintos, por usuario (5) y por IP (20). Verificado con **67 pruebas de API** más el circuito en el navegador, sin usar ninguna contraseña real (los tests crean sus usuarios y los borran). La prueba que más importa: **inyecté permisos falsos en el navegador** (`["*"]` y rol superadmin) y el servidor los corrigió a los reales, con 403 en la llamada. **Todos tienen que entrar una vez más**: las sesiones viejas no tienen token'],
              ['**11/8/2026**', '**Dos etapas para el VPS: producción y dev (plomería, no funciones).** Los tres repos van a un VPS de Hostinger y hacía falta definir cómo se trabaja. Quedó: **`main` = producción, `dev` = la etapa de prueba**, un VPS con las dos separadas por cuatro cosas (carpeta, base de datos, puerto y dominio) y las dos bases en el mismo Postgres pero **con usuario y contraseña distintos** — ese es el candado contra el accidente clásico, que es un `.env` mal copiado corriendo un `db:reset` contra producción. La aclaración que ordena todo lo demás: **el dev del VPS no es un segundo taller** (para eso ya está la máquina de desarrollo), es el **ensayo general** — probar el deploy, que el equipo mire algo nuevo desde la sucursal, y probar migraciones contra una copia de los datos reales. Quedaron versionados el runbook (`crm-api/deploy/DEPLOY.md`), la unidad de systemd (una **plantilla** `crm-api@.service` para las dos etapas), los dos bloques de nginx, el backup con rotación y un `deploy.sh` por proyecto. Tres decisiones que importan: (1) **la API se publica en `/api` del mismo dominio**, así el bundle del dashboard no lleva ninguna URL horneada —Vite las compila adentro del JavaScript, y un build de dev promovido a producción apuntaría a la API equivocada con datos reales— y de paso desaparece el CORS; (2) el deploy **apaga el servicio antes de migrar** y, si la migración falla, **vuelve al commit anterior y lo levanta**: migrar en caliente deja una ventana con el código viejo sobre el esquema nuevo, y en un sistema que corre la caja esa ventana es una venta mal grabada; (3) la API ganó la variable **`HOST`** (default `0.0.0.0`, en el VPS `127.0.0.1`) en vez de dejarla fija — porque en la red del local la API la consumen otras máquinas (la sync de coffit y las cajas) y clavarla en localhost las dejaría afuera. Verificado con red real: con el default la IP de LAN responde, y con `HOST=127.0.0.1` queda **rechazada**. **Sigue bloqueante para publicar: la API no tiene autenticación** — dos etapas expuestas sin eso no son dos ambientes, son dos copias del sistema abiertas en internet'],
              ['**11/8/2026**', '**Buscar en el catálogo desde el pedido.** El buscador de la pestaña sirve cuando ya sabés qué querés: tipeás y agregás. Esto es para la otra mitad del trabajo — **recorrer** el catálogo por proveedor, categoría o marca, que es como se arma el pedido semanal mirando la góndola. Es el mismo lenguaje que la consulta de Existencias (Alt+F3) del POS, recortado a lo que el pedido necesita, y el recorte es la decisión: **sin precios** (un pedido entre sucursales no mueve plata: la transferencia se valúa a costo al despacharse, y eso no lo decide el que pide) y de las cinco sucursales **solo las dos de este pedido** (la columna de Express 1 no ayuda a decidir cuánto le pido a la Distribuidora y llena la fila de números que hay que saltear). **Cada tamaño es una fila propia con su código de barras**, igual que en el listado de Productos: se pide "Ajo en Polvo · 500 g" derecho, con la presentación ya elegida, sin agregar la madre y después tocar el selector. La columna del origen respeta la regla de siempre —muestra el **granel suelto en kg** también en la fila de un tamaño, porque el paquete se fracciona del madre— y para no tener esa regla escrita en dos pantallas se mudó a `domain/pedido.js`, que es de donde la leen las dos. El botón cuenta lo que ya llevás pedido ("+ 1 (lleva 3)"), así no hay que cerrar el explorador para saberlo, y el tilde de stock dice explícitamente de qué sucursal habla: *"Solo lo que Express 1 puede mandar"*. **Corregido el mismo día:** faltaban el scroll y el paginador —el modal se fija al alto de la ventana y recortaba la lista, así que parecía que no había más productos— y en granel se ofrecía también el producto madre, que era una fila más para elegir mal. Los filtros pasaron a UNA fila y el contador al pie: cada línea fija que se agrega arriba es un producto menos que se ve, y la lista pasó de 4 filas visibles a 6 en una pantalla de 768 y ~10 en una de 1080'],
              ['**11/8/2026**', '**El pedido se arma durante el día: tres pasos y estado `borrador` (migraciones 0055 y 0056).** El dueño contó cómo se usa de verdad: el cajero atiende clientes y arma el pedido en los ratos libres, no de una sentada. Hasta acá el pedido nacía ya **pendiente** —o sea, demanda visible para el origen— así que la única forma de armarlo de a poco era dejar el modal abierto todo el día y rezar. Ahora el pedido **vive en la base desde que se elige la ruta** y **se guarda solo, sin botón**: un "Guardar borrador" que hay que acordarse de apretar pierde el trabajo en el único momento en que importa, que es cuando entra un cliente y hay que largar todo. Mientras es borrador **no toca stock y el origen NO lo ve**: nadie prepara algo que el que pide sigue escribiendo, y no lleva código porque la serie TR se asigna al enviarlo — un TR0012 que quizá nunca exista es peor que ninguno. **Hay UNO por ruta (origen → destino), no uno por cajero**, con índice único en la base: el pedido es del LOCAL y el que entra al turno sigue la lista que dejó el anterior; si fuera de cada uno, Marta armaría el suyo a la mañana y Carla el suyo a la tarde y el depósito mandaría mercadería duplicada. Se retoma desde el aviso de arriba del panel ("Seguir armando"), y descartar **borra**: no queda un pedido cancelado en el historial de algo que nunca fue un documento. Además el modal quedó en **tres pasos** como el de facturas: (1) a quién y para dónde —y avisa si esa ruta ya tiene un pedido armándose—, (2) qué se pide, con las dos pestañas y su buscador, (3) revisar y enviar, con el resumen, los kilos a fraccionar y **los renglones que el origen no puede cubrir hoy**. Detalle de ingeniería que importa: el guardado automático **no** recarga el estado del sistema (traería el inventario entero cada dos segundos) pero **cerrar sí lo hace una vez** — sin eso, el panel decía "0 renglones" justo después de que el cajero agregó cinco. Verificado con **42 pruebas de API** más el circuito completo en pantalla con clics y teclas reales'],
              ['**11/8/2026**', '**Cada pestaña del pedido busca lo suyo.** Las pestañas quedaron **arriba del buscador**, y ahora mandan sobre él: parado en **Prod. Enteros** el buscador no ofrece un granel, y al revés. Antes había **un** buscador arriba de todo que ofrecía los 228 productos, así que la cajera tenía que leer el tipo de cada resultado antes de hacer clic — justo el trabajo que las pestañas vinieron a sacar. El detalle que evita el problema nuevo: un buscador acotado puede decir "no existe" de algo que **sí** existe. Si la coincidencia está en la otra pestaña, el aviso lo dice con el número y ofrece el atajo — *"Nada coincide entre los productos enteros, pero hay 3 a granel · Ver Prod. a granel"*—, y al cambiar de pestaña **lo tipeado se conserva**, así que el producto aparece sin volver a escribir. También el placeholder, el título y el estado vacío nombran la pestaña en la que uno está. El pedido sigue siendo **uno**: el título dice "1 de 2 en total" y el botón "Crear pedido (2)". Verificado en pantalla con clics y teclas reales'],
              ['**11/8/2026**', '**El pedido de mercadería: dos pestañas para armarlo y el granel medido donde importa.** Dos cosas que pidió el dueño mirando cómo lo usan las cajeras. **(1)** Al armar el pedido, los renglones se separan en **Prod. Enteros** y **Prod. a granel** —pestañas al estilo de las del POS— porque son dos recorridos distintos de góndola y mezclarlos en una lista larga hace perder el lugar. El pedido que sale sigue siendo **uno solo**: la división es de la pantalla, no del documento. Cada producto cae en su pestaña solo y la vista salta a la del último agregado, así el clic nunca parece no haber hecho nada. **(2)** En un renglón a granel, la columna del origen mostraba **los paquetes de esa presentación en la Distribuidora** — y eso es su góndola, mercadería que no viaja: todo lo que se pide para una sucursal se fracciona del madre. "10 paq." al lado de un pedido de 8 daba tranquilidad sobre algo que no se iba a mandar. Ahora muestra el **granel suelto en kg** y debajo dice cuántos kilos hay que fraccionar ("se fraccionan 8 kg") o cuántos faltan, en rojo. En el caso real de las Avellanas Peladas: la Distribuidora tiene **15 kg de granel** más 10 paquetes de 1 kg y 20 de 250 g de góndola — el número que importa para el pedido es el primero'],
              ['**11/8/2026**', '**Los paquetes con su stock por sucursal, y se puede corregir una tanda mal cargada.** Debajo del granel disponible, la pestaña Fraccionar lista ahora **solo los fraccionados** con una columna por sucursal y el total — la madre ya está arriba, no se repite. Y cada paquete tiene botón **Corregir**, para el "puse 20 y son 19": la corrección **mueve las dos puntas**, da de baja el paquete y **devuelve el medio kilo al granel**. Eso es lo importante del diseño: el fraccionamiento no crea ni destruye mercadería, la convierte, así que editar solo los paquetes cambiaría los kilos totales del producto de la nada y el inventario mentiría. El modal muestra la cuenta antes de aceptar ("0,5 kg vuelven al granel, que quedaría en 10,5 kg"), no deja fabricar paquetes que el granel no respalda, y **no toca lo comprometido** (está apartado para un envío ya confirmado). El movimiento queda con su autor, su motivo y una descripción que se explica sola: *"Corrigió 500 g: 20 → 19 paquetes (0,5 kg vuelven al granel)"*. Es para el ERROR DE CARGA: un paquete roto es merma o incidencia, ahí la mercadería no volvió a ningún lado y la pérdida tiene que quedar con su costo — el modal lo dice. Verificado con **19 pruebas de API**, incluida la que importa: los kilos totales del producto no se mueven ni corrigiendo para abajo ni para arriba'],
              ['**10/8/2026**', '**La oferta distingue la madre del paquete (migración 0054).** Consecuencia directa de lo anterior: si el paquete tiene su propio precio, una promo a la madre no puede bajárselo sin que nadie lo decida — y eso es exactamente lo que pasaba, porque el motor compara el `productoId` del renglón y el de un paquete es el de su madre. Ahora hay **alcance de paquete**: "Lentejas 500 g al 20%" sin tocar el kilo suelto ni los otros tamaños. Y para los cuatro alcances que se resuelven por la madre (producto, marca, categoría, etiqueta) está el tilde **"incluir también los paquetes fraccionados"**, **apagado por defecto** y apagado también en las **7 ofertas que ya existían**: alcanzaban a los paquetes, sí, pero por arrastre y no por decisión. El listado de ofertas lo muestra en la columna de alcance ("+ sus fraccionados"), la vista previa del formulario lo respeta porque **elige el artículo de muestra con el motor real** en vez de repetir sus reglas, y el borrador que arma Vencimientos apunta al paquete cuando lo que vence es un paquete — descontarle el kilo suelto para salvar 12 bolsas de 500 g es regalar margen de mercadería que no vence. El sitio web no cambia: publica el producto suelto, así que un alcance de paquete no le llega. Verificado con **24 pruebas**, 15 de ellas sobre el motor del POS importado tal cual corre en la caja'],
              ['**10/8/2026**', '**El paquete fraccionado se vende solo: formato de venta propio (migración 0053).** El precio de un paquete se derivaba de la madre —precio por kg de la lista × tamaño × un `recargo`— y no alcanzaba: en el mostrador el paquete tiene su propio precio, su caja por N, su mínimo y sus ofertas. Peor: **73 de las 103 madres con fraccionados no tienen listas de venta**, así que sus paquetes no tenían precio real (el cálculo se caía al costo neto — la Nuez Pecán de 250 g cotizaba a $4.266,94 con un costo de $4.267,13). Ahora el **formato de venta es de LO QUE SE VENDE**: el producto suelto o uno de sus paquetes, en la misma tabla y con el mismo motor de precio. Un paquete es un producto cuyo costo es costo/kg × tamaño, así que pasa por el mismo camino: `precioPresentacion` y la columna `recargo` **se borraron**, no quedaron dormidas. La ficha del fraccionado gana la pestaña **Formato de venta** (la misma que usa el producto, con otro costo) y la pestaña Presentaciones de la madre queda con tamaño, código, stock y el link **Ver ficha**. La masiva de márgenes se quedó con un solo modo, que ya mueve paquetes. **La mina de tener las dos cosas en una tabla**: guardar el formato de la madre borraba por `producto_id`, o sea que le hubiera borrado el precio a todos sus hijos — cada escritura y cada lectura quedó con su ámbito (y apareció otra: el granel podía cotizarse con la fila de un paquete). **Sin formato, el paquete no vale cero: no tiene precio** — el POS lo muestra y explica por qué no lo puede cargar, la venta se rechaza con el motivo, la etiqueta avisa, y Fraccionamiento tiene el contador "N sin precio" con la lista y el atajo. Los 238 arrancaron en blanco, por decisión del dueño. Verificado con **27 pruebas de API**. Guía actualizada: Stock e inventario › "El fraccionado tiene pantalla propia"'],
              ['**10/8/2026**', '**El código de la presentación se pide EAN-13, y hay un botón que lo genera.** Consecuencia directa de lo anterior: si la etiqueta lleva el código impreso, el código tiene que servir. El campo de Compras › Productos › Presentaciones ahora exige un **EAN-13 válido** (13 dígitos con el verificador cerrando) en todo código que **nace o se edita**, avisa al lado del renglón qué le pasa a cada uno —válido, verificador que no cierra, largo equivocado, repetido en la lista, vacío— y tiene un botón **Generar** que da uno propio: serie interna en el rango de circulación restringida de GS1 (prefijo **29**), **esquivando el prefijo de la balanza** (hoy 20; si el POS lo leyera como etiqueta de peso variable cargaría 500 g de otra cosa), correlativo y verificado contra todos los códigos en uso. Si se agregan tres presentaciones de una, el generador recibe los que están en pantalla sin guardar: antes daba el mismo tres veces. Dos decisiones que evitan trabar el trabajo: los **71 códigos heredados** que no cumplen **pasan mientras no se los toque** (rechazarlos dejaría esas presentaciones sin poder guardar ni un cambio de recargo — se avisan en amarillo), y **vaciar** un código sigue permitido, que es la forma de sacar uno malo. Lo que ya no se puede es que una presentación **nazca sin código**. Y el duplicado se frena por las **tres** puertas donde vive un código: producto, presentación y **formato de venta** — esa tercera faltaba, y el único de la base no la ve porque es por tabla. Verificado con **22 pruebas de API** sobre un producto temporal (generador válido/sin el prefijo de la balanza/sin repetir ni contra la base ni contra la pantalla, los tres rechazos, las tres puertas, el heredado que pasa al cambiar el recargo pero se exige si se lo edita, el vaciado, y el reemplazo por uno generado)'],
              ['**10/8/2026**', '**Las etiquetas de los paquetes fraccionados — y sacarlas NO mueve stock.** Faltaba el paso que en el depósito existe desde siempre: fraccionar, **sacar las etiquetas** y pegarlas. Ahora Almacén › Fraccionamiento tiene **dos pestañas**: *Fraccionar* (la de siempre, que mueve stock) y *Etiquetas*, que es una impresora y nada más. La separación la pidió el dueño y es la decisión importante: si imprimir descontara, cada etiqueta arruinada, cada prueba y cada rollo mal cargado dejarían el inventario mintiendo. Se busca el **fraccionado** (solo los granel con presentaciones, por nombre, marca o código de barras), se pone **cuántas etiquetas** y la **fecha de vencimiento**, y sale: nombre, peso, precio, código de barras y "Vto". El **precio no se tipea** — sale del catálogo, lista base, IVA incluido: el mismo número que cobra la caja. El motor de impresión ganó los formatos de **etiqueta autoadhesiva** (50 × 30 por defecto, 50 × 25, 40 × 25, 60 × 40) que van **sin membrete** y con una etiqueta por página del rollo, y en Sistema › Impresión cada documento ofrece solo los formatos que le sirven. El **código de barras se dibuja acá, sin librerías**: EAN-13 cuando el código cierra el verificador, **Code 39** para todo lo demás, y la pantalla avisa los dos casos flojos — código que no es EAN-13 y código **demasiado fino para la etiqueta** (abajo de 0,25 mm por barra una térmica no lee). Ese aviso no es teórico: de las 238 presentaciones del catálogo, **163 tienen EAN-13 válido, 13 tienen 13 dígitos con el verificador mal, 58 no llegan a 13 dígitos y 4 no tienen código**, y un código de 9 dígitos en Code 39 sobre una etiqueta de 40 mm queda en 0,195 mm por barra. Verificado con **30 pruebas** del generador (las tablas contra la construcción documentada de cada simbología, el ida y vuelta dibujo → barras → dígitos, y el verificador contra los códigos REALES del catálogo) más las medidas de la etiqueta en el navegador (50 × 30 mm exactos, sin desborde, código de 8 mm de alto). De paso: los documentos impresos no declaraban su codificación y un "sin código" salía "sin cÃ³digo" según cómo se abrieran — ahora todos llevan `<meta charset>`'],
              ['**10/8/2026**', '**La oferta por vencer se arma en el motor de ofertas, no en un formulario aparte — y el sistema avisa si termina descontando algo vencido.** El botón "Oferta" de un registro por vencer ya no abre un mini-formulario propio: **lleva a Ventas › Ofertas con "Nueva oferta" abierta y llena** — el producto en el alcance, la fecha de fin = el día que vence, la sucursal del lote, 25% propuesto — más una ficha arriba que dice cuántas unidades hay, dónde y **cuánta plata se pierde** si no se venden. Ahí están las siete mecánicas y la vista previa que corre el motor real: un 3×2 o un pack para rematar un lote antes eran imposibles. Al crearla **queda atada al registro**, y si el alcance se cambió de modo que ya no llegue a ese producto, el vínculo se **rechaza** con el motivo: "en oferta" en pantalla y cero descuento en la caja es una mentira que no se asienta. Pestaña nueva **Ofertas** con la lista de qué mercadería vigilada está en oferta — resolviendo el alcance REAL de cada promo (producto, marca, categoría, etiqueta, componentes de combo), así aparece también la que alguien armó en Ventas sobre algo que además está por vencer. De ahí salen los avisos, y el grave es uno: **mercadería VENCIDA con la oferta corriendo**, o sea la caja vendiendo con descuento algo que ya pasó su fecha; se ve arriba del Panel con la plata en góndola, con globito en la pestaña, y **también en Ventas › Ofertas**, que es donde se apaga. Los otros avisan lo contrario: la oferta que se armó para ese lote está apagada, ya terminó, arranca después de que venza, corre en otra sucursal o le cambiaron el alcance. De paso el formulario de ofertas ganó el **selector de sucursales** que le faltaba (el dato existía y se mostraba, pero no se podía elegir: toda oferta nacía "en todas"). Verificado con **40 pruebas de API** (el borrador y sus tres candados, el vínculo que no miente, los cuatro caminos del alcance + combo + ticket, cada aviso, la plata que no se cuenta dos veces, el orden por gravedad) más el circuito entero en pantalla con clics reales'],
              ['**10/8/2026**', '**El ciclo del producto se cierra solo, pero para el lado correcto.** La pregunta era si un discontinuado se archiva automáticamente al venderse la última unidad. La respuesta es una **asimetría deliberada**: archivar CIERRA puertas → el sistema lo **sugiere** ("2 productos discontinuados se agotaron — archivarlos", con botón que los archiva de una y revalida cada uno, porque entre el aviso y el clic una devolución pudo cambiar todo); reabrir las ABRE → **es automático**. Si reaparece stock de un archivado (una devolución, la anulación de un ticket, un ajuste), vuelve solo a *discontinuado* con el motivo anotado: "archivado con stock" es un estado imposible, mercadería que existe y que el sistema no deja vender. Vuelve a discontinuado y no a activo porque que aparezca una unidad no es haberlo vuelto a comprar. Por qué no archivar en el acto: el catálogo del POS se carga **al abrir la caja**, así que un cajero con el ticket armado vería "está archivado" sobre algo que tenía en pantalla — y el cierre de caja no toca stock, el stock baja al confirmar cada venta. La sugerencia espera **30 días sin movimiento** (recién agotado, una devolución es probable), ignora el stock **en tránsito** y sí propone los que solo tienen stock vencido. El reabrir vive en `addDelta`, el único lugar por donde pasa todo aumento de stock, así ningún camino nuevo se lo olvida. Verificado con 18 pruebas de API más el circuito en pantalla (el aviso, el archivado en lote con su omitido explicado, y la devolución que reabre)'],
              ['**10/8/2026**', '**El producto que ya no se trae se DA DE BAJA, no se borra — y volver es un clic.** El producto era la única entidad importante que no cumplía el principio del sistema ("lo que está en uso se desactiva, no se borra"): solo tenía Eliminar, y era borrado real. Ahora tiene ciclo de vida con **dos decisiones distintas**: *discontinuado* (no se compra más pero **se sigue vendiendo hasta agotar** — el caso común cuando el proveedor lo baja) y *archivado* (fuera de catálogo, exige que no quede stock; si queda, dice cuánto y dónde y ofrece dejarlo discontinuado). **Reactivar conserva todo**: códigos, historial de precios, presentaciones, formatos de compra por proveedor — y avisa la fecha del último costo, porque el precio de venta se calcula con ese número hasta la primera compra nueva. Los filtros se aplicaron en TODOS los puntos: POS y tienda no listan archivados; compras y reposición por stock mínimo no ofrecen lo dado de baja; pedidos de cafetería y control de vencimientos tampoco. Y los candados viven en la API, no solo en la pantalla (la venta rechaza lo archivado incluso en un borrador viejo, porque el catálogo del POS se cachea al abrir la caja). **Eliminar** quedó como excepción: solo sin ninguna huella, y cuando no se puede dice **cuál es la huella** en vez del error crudo de la base. Además, tres claves foráneas dejaron de ser `cascade`: borrar un producto ya no puede hacer desaparecer existencias ni mutilar remitos e incidencias viejas. Migración 0051, verificado con **23 pruebas de API** (el discontinuado se vende y no se compra, el archivado no entra a ningún lado, archivar con stock se frena, reactivar vuelve entero, la FK bloquea el DELETE directo, el importador no revive nada) más el circuito en pantalla. Guía nueva: Stock e inventario › "El producto que ya no se trae"'],
              ['**10/8/2026**', '**Escanear el paquete con la cámara del celular, y el Control en el orden real del acto.** El formulario de Control se reordenó como se trabaja de verdad: **1· el producto** (📷 cámara, lector USB o buscándolo) → **2· la fecha impresa** → **3· cuántos**. El producto queda a la vista con su código y fecha/cantidad se conservan al agregar: la tanda que vence igual se anota escaneando y apretando Agregar. El botón de cámara usa la API nativa del navegador cuando está (Chrome de Android) y si no baja **ZXing por import dinámico** — 450 KB que se descargan solo al abrir la cámara, el arranque de la app no cambia. Lee EAN-13/EAN-8/UPC/Code-128/Code-39/ITF, con bip y vibración al leer, un frame cada ~120 ms y la cámara apagada al primer acierto. **Aviso importante**: los navegadores solo dan la cámara en HTTPS o localhost, así que para usarla desde el celular en la red local hay que levantar el front con `npm run dev:https` (nuevo, imprime la dirección a la que entrar); en producción con dominio HTTPS no hace falta nada, y el lector USB anda siempre. El decodificador se verificó de verdad: cuatro EAN-13 dibujados a mano leídos correctamente (y un canvas en blanco que no inventa nada) — ahí se descubrió que `decodeFromCanvas` no existe en ZXing 0.23 y el camino correcto es `MultiFormatReader` con la luminancia del canvas'],
              ['**10/8/2026**', '**La baja por incidencia ahora vale plata (y dice de dónde vino).** Apareció explicando cómo se conectan Incidencias y Vencimientos: los dos módulos no comparten ninguna tabla, pero se cruzan en un lugar real — la pestaña **Vencimientos › Mermas** lista TODOS los movimientos de tipo merma/vencido/defectuoso, así que una incidencia resuelta como baja aparece ahí y suma en el reporte de pérdidas. El cruce estaba a medias en dos puntos: (1) **el costo no se congelaba**, porque la resolución de la incidencia insertaba el movimiento sin costo y la columna vale 0 por defecto — la mercadería se perdía igual pero la pérdida figuraba en **$0**; (2) **no se veía el origen**: la pantalla muestra el campo `motivo`, que en la resolución quedaba vacío, y la fila aparecía como una merma anónima aunque el vínculo estuviera guardado. Cerrado: el cálculo del costo congelado se extrajo a **un solo lugar** (`costoDePerdida`) que ahora usan las DOS puertas que dan de baja mercadería —el movimiento manual y la resolución de una incidencia—, porque con la fórmula repetida una de las dos había quedado en cero; y el movimiento guarda `Incidencia INC0006 · Bolsa rota` en el motivo, que la pantalla muestra como chip **«De incidencia»** con el código en el tooltip. Verificado con **18 pruebas de API** (mismo costo por las dos puertas hasta el centavo, liberar no congela nada ni descuenta, la plata aparece en el reporte del mes, no se resuelve dos veces) más la fila en pantalla con su chip y su importe. No hubo que arreglar datos viejos: no existían bajas por incidencia en la base. Guía nueva: Stock e inventario › "Incidencias: la cuarentena del stock"'],
              ['**10/8/2026**', '**El sitio avisa lo que ya está en el carrito y frena en el stock.** Dos cosas que el cliente no veía: ahora la tarjeta muestra sobre la foto lo que ya cargó de ese producto (`🛒 2 kg en el carrito`) —se ve recorriendo la tienda, sin abrir el carrito— y la cantidad **se topea en el stock disponible**, con el mensaje que corresponde a cada caso: «Solo quedan 0,5 kg (ya tenés 1,5 kg)» cuando pide más de lo que hay, «Es todo lo que hay disponible» al llegar justo, y el botón en «Sin más stock» cuando ya tiene todo cargado. El catálogo público suma un dato para esto: `disponible` = stock menos el **piso reservado al mostrador** (`webStockMin`), o sea que el tope respeta lo que se guarda para el local. **El tope vive en el carrito, no en la tarjeta**, porque la cantidad se toca desde tres lados (tarjeta, carrito y mini-carrito) y con la regla repartida el que se la olvidara dejaba pedir 50 kg de algo que tiene 3. Un carrito guardado de ayer con más de lo que hay hoy **no se corrige por atrás**: se avisa en el renglón y el cliente decide. Verificado con clics reales en los tres estados sobre un producto de 2 kg: el `+` corta en 2, pedir 1 kg más cuando queda 0,5 agrega 0,5 y no 1, y el badge acompaña en kg y en unidades'],
              ['**10/8/2026**', '**Ventas tiene su propia pantalla: el listado de lo vendido.** Faltaba la pregunta más básica del mostrador — "¿qué se vendió?" — y la única lista de ventas del sistema estaba **escondida adentro del detalle de un cliente** (sus últimas 100): no había forma de mirar el día, buscar un ticket viejo ni ver cuánto vendió cada cajero. Sección propia (`ventas.listado`, migración 0052) entre el Punto de venta y la Caja, porque es una **consulta de todo el negocio** y meterla dentro de Caja la ataba al turno abierto. Abre en HOY con atajos de rango; filtra por sucursal, cajero, **turno**, medio de pago, estado, cliente, origen (mostrador / nacida de un pedido), **solo con oferta** y buscador por número o cliente. Las tarjetas (tickets, vendido, promedio, descuentos, **cómo se pagó**, **cuánto costaron las ofertas**) son del **filtro completo y no de la página**, y **no cuentan lo anulado** — la anulada sigue en la lista, para auditarla, pero se informa aparte. Clic en la fila abre el ticket con la **lista y la oferta congeladas al vender**, se **reimprime** por el motor de impresión de Sistema y —solo administración— se **anula** con las tres consecuencias escritas (vuelve el stock, deja de contar, el número no se recicla). **QUIÉN VE QUÉ**: el cajero ve solo su sucursal y solo mostrador, con la sucursal clavada **en la consulta**, no en la vista. Paginado de servidor (la tabla de ventas crece para siempre). De paso salieron tres arreglos: la reimpresión del POS imprimía **"#12" en lugar del nombre del producto** (el renglón no lo guarda: ahora la API lo resuelve), `isoDate` daba **mañana** a partir de las 21 h (UTC) — la factura cargada de noche nacía con la fecha del día siguiente y "este mes" arrancaba el 31 del mes anterior — y la impresión **fallaba en silencio** si el navegador bloqueaba la ventana emergente. Verificado con **42 pruebas de API** (cada filtro, el borrador que no figura, anular con stock que vuelve y plata que deja de contar, paginado sin filas repetidas, el día de acá) más el circuito en pantalla, incluida la vista del cajero. Guía nueva: Punto de venta › "Ventas (el listado de lo vendido)"'],
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
        actualizado: '2026-08-17',
        titulo: 'Lo próximo',
        bloques: [
          {
            t: 'tabla',
            cols: ['Qué', 'Por qué importa'],
            filas: [
              ['**Marcar los productos que se compran sin factura** (19/8/2026, carga de datos tuya — la función ya está)', 'La cuenta del 17,36% ya la hace el sistema (Formato de Compra → "Sin factura %", y el default en la ficha del proveedor), pero **ningún producto real lo tiene puesto todavía**: los formatos importados del sistema viejo no traían el dato (no había ningún 17,36 ni 8,36 tipeado en los descuentos — se ve que la vuelta la hacías antes de cargar). Hasta que lo cargues, esos productos cotizan como facturados: precio más alto del que venías cobrando y ninguna métrica en Gerencia › Rentabilidad. El camino corto: en la ficha de cada proveedor de liquidación poné "Qué emite" y su %, y después abrí sus productos y poné el % en el formato (o pedime la pasada masiva por proveedor, que es un rato).'],
              ['**Rentabilidad: el margen viejo no existe** (19/8/2026, estado — muere solo)', 'El costo se congela en cada venta desde la migración 0072: **las ventas anteriores no tienen costo congelado** y el panel las excluye del margen avisándolo (la venta sí se cuenta). No es un bug y no hay nada que hacer: a medida que se venda, la cobertura llega al 100% sola. Se anota para que el primer vistazo al panel no se lea como "faltan números".'],
              ['**Proveedores: completar los CUIT del padrón importado** (17/8/2026, carga de datos tuya — sin apuro)', 'El CSV de la app vieja traía CUIT en solo 6 de los 169 (y uno era basura y se descartó). El reconocimiento automático de la bandeja de facturas matchea **por CUIT**: cada proveedor al que le saques una foto de factura conviene que tenga el suyo cargado en la ficha. Se pueden ir completando a medida que llegan las primeras facturas reales. Ojo con NUEVO COSMOS: el CUIT ficticio de desarrollo se vació — cargale el real del papel.'],
              ['**La revisión de seguridad terminó: los SIETE módulos auditados** (14/8/2026, estado, no tarea)', 'Compras, Ventas, Almacén, Web, Gerencia, Sistema y Gastos pasaron los dos pases (auditoría de seguridad + depuración) y **nada está commiteado todavía**: son ~50 archivos por repositorio esperando. Lo que sigue no es "otro módulo" sino lo que quedó anotado en esta misma lista, y tres cosas que cruzan el sistema entero: los **permisos exigidos en el servidor** que quedan sin cubrir (tarea vieja), la tabla de **sucursales por usuario** que ya decidiste, y los índices del motor de stock. El resto de esta lista son decisiones tuyas.'],
              ['**Tres consultas que dan 403 en cada carga para los roles chicos** (14/8/2026, apareció verificando Gastos)', 'El armazón del dashboard pregunta siempre por los pedidos de Cafetería, el último cambio de precios y las órdenes web pendientes, sin mirar si el rol tiene permiso para eso. Un usuario de mostrador se come **tres 403 en cada carga de página**, con el error en la consola y ningún aviso visible. No es un agujero —el servidor está haciendo lo correcto, que es negar—, es ruido y trabajo al pedo: es exactamente el mismo caso que ya se arregló para Gerencia el 14/8, y el mismo que se acaba de cortar en el contador de Gastos (que ahora deja de reintentar tras un 403). Falta hacerlo en esos tres.'],
              ['**Los adjuntos del gasto: media función construida** (14/8/2026, decisión tuya — es trabajo nuevo, no limpieza)', 'La API ya sabe recibir la foto del comprobante, validarla por sus bytes, servirla de forma inerte y negarse a borrarla si el gasto tiene pagos. **La pantalla no la usa: no hay dónde subirla ni dónde verla.** Falta una sección "Comprobante" en el detalle del gasto con un botón para adjuntar y un link para abrirlo. No lo borré porque la mitad cara está hecha y recién hoy se endureció; decidí vos si se termina o si la carga de comprobantes queda solo en Compras.'],
              ['**Sistema: sacar el respaldo de la máquina — 5 minutos y queda cerrado** (14/8/2026, ES TUYO, el código ya está)', 'El `backup.sh` ya deja el dump con permisos cerrados (600, directorio 700) y ya sabe copiarlo afuera; lo único que falta es **decirle adónde**, y eso depende de tu cuenta. Son dos pasos, una sola vez, en el servidor: correr `rclone config` para crear el destino (Drive, S3, lo que uses) y agregarle el nombre a la línea del cron. **Ojo que con Dokploy la línea cambió**: la base vive adentro de un contenedor, así que el script necesita saber cuál (`DOCKER_DB`, más el usuario y el nombre de la base) — en el host ni siquiera existe el `pg_dump`. Copiala del `DEPLOY.md`, no de memoria: va en `/etc/cron.d/`, que **exige el campo de usuario**, y si la ruta o ese campo están mal el cron no corre — y como el aviso lo da el propio script, te quedás sin respaldo Y sin alarma. **Mientras no esté, cada corrida avisa** que el dump quedó solo en ese disco, en vez de terminar con un "OK" que no dice toda la verdad. Y el script deja un `ultimo-ok.txt` con la fecha del último respaldo bueno y si salió o no de la máquina: ese archivo es lo que hay que mirar para saber si el respaldo sigue vivo, porque el VPS no tiene correo configurado y un cron que falla no le avisa a nadie. Está en el checklist del deploy'],
              ['**Deploy: las cuatro contraseñas `1234` de la semilla** (14/8/2026, BLOQUEANTE del primer deploy)', 'La semilla crea cuatro usuarios con la contraseña **`1234`**, y uno de ellos —`Lucas`— es **superadmin**, o sea que puede todo en todos los módulos. Mientras el sistema vivía en la red del local eso era una molestia; con el dominio publicado en internet es la puerta de entrada más barata que existe, y el nombre de los usuarios se ve en el desplegable del propio login. Dos caminos, los dos válidos: **no correr la semilla en producción** (cargar la empresa a mano desde cero), o correrla y **cambiar las cuatro desde Gerencia › Usuarios y roles ANTES de apuntar el dominio**. El sistema exige mínimo 8 caracteres desde el 14/8, pero eso vale para lo que se escribe en la pantalla — la semilla escribe el hash directo y se saltea la validación. Está primero en el checklist del `DEPLOY.md`'],
              ['**Deploy: lo que solo se puede probar en el servidor** (14/8/2026, una prueba de un minuto cada una)', 'Las imágenes de Docker no se pudieron construir en la máquina de desarrollo (tiene Docker instalado pero le falta el subsistema para correrlo), así que hay **dos cosas de la capa Docker que quedan sin confirmar** hasta el primer deploy, las dos con una comprobación rápida. **Una:** que la zona horaria haya quedado adentro del contenedor. Se mira entrando a Cuentas a Pagar **después de las 21:00** — si un gasto que vence hoy aparece como "vencido hace 1 día", falta la zona o falta `tzdata` en la imagen. **La otra:** el fallback de la pantalla. Se entra a cualquier sección interna —`/gastos`, por ejemplo— y se aprieta **F5**: tiene que quedarse ahí. Si da 404, el archivo de configuración del nginx no llegó a la imagen. Todo lo que tenía riesgo del lado del código ya se verificó a mano (migraciones sin las herramientas de desarrollo, la API levantando con el portero cerrado, la pantalla construyendo con las rutas correctas)'],
              ['**Gerencia: la sucursal del turno la elige el propio empleado** (14/8/2026, lo más grande que quedó — DECIDIDO, falta construirlo)', 'En el login solo se valida que la sucursal **exista**: no hay ninguna tabla que diga a qué sucursales pertenece cada usuario. Carla, cajera de Express 3, sale y vuelve a entrar eligiendo "Fontana", y a partir de ahí **para el servidor ES de Fontana**: cierra ese turno con el efectivo que ella declare, le carga movimientos de caja y le ajusta el stock. Todo firmado con su nombre pero en el local de otro. Esto vacía buena parte de `soloSuSucursal`, que es el candado que se puso en Ventas y en Almacén — hoy es una cerradura con la llave puesta del lado del cajero. **El dueño ya decidió lo que faltaba saber (14/8): las cajeras SÍ rotan entre sucursales**, así que es una relación de muchos a muchos —tabla `usuario_sucursales`— y no un campo en el usuario. Lo que queda por construir: la migración, asignar las sucursales de cada uno en Gerencia › Usuarios, y validar la elección en el login (el jefe elige libremente; el cajero, entre las suyas). Ojo con el orden al aplicarlo: si la tabla nace vacía, nadie puede entrar a ningún lado — el alta tiene que sembrar a cada usuario con las sucursales que hoy usa, o el login tiene que tratar "sin ninguna asignada" como "todas" hasta que se carguen'],
              ['**Gerencia: el nombre de usuario se elige de una lista pública** (14/8/2026, decisión de UX)', 'El endpoint del login es público por necesidad —todavía no hay sesión— y ya se le sacó todo lo que se podía (hoy manda **solo id y nombre**: se le quitó `tienePassword`, que decía qué cuentas están sin contraseña y ni siquiera lo usaba la pantalla). Lo que queda es la lista de nombres en sí, y eso **no se puede reducir sin cambiar la pantalla**: hoy elegís tu nombre de un desplegable, que en un mostrador es mucho más cómodo que tipearlo. Si alguna vez te preocupa que la nómina esté a la vista desde internet, el cambio es pasar el usuario a un campo de texto y el endpoint queda solo con las sucursales. Es tu llamada: comodidad diaria contra un dato que igual es semi-público en un negocio de 6 personas'],
              ['**Gerencia: no se pueden ver ni cortar las sesiones abiertas** (14/8/2026, es una función que falta ENTERA)', 'Si sospechás que le robaron el token a alguien, la única forma de cortarlo hoy es **cambiarle la contraseña** (eso sí cierra todas sus sesiones). Tampoco hay tope de sesiones abiertas por persona. **Corrección de lo que decía este mismo pendiente hace unas horas:** yo había anotado que "la función ya está escrita y solo falta exponerla". No era así — la depuración encontró que ese `listarDe` **nunca lo llamó nadie** y que además tenía los argumentos de la comparación de fechas al revés, o sea que nunca se ejecutó ni una vez. Se borró. Cuando se construya la pantalla hay que escribir la consulta de cero, con una prueba que la ejercite: es un endpoint + una columna en Usuarios con "cerrar sesiones"'],
              ['**Gerencia: nada de esto deja registro** (14/8/2026)', 'La sección **Auditoría** del módulo es una de las cinco que están "pronto", así que hoy un cambio de contraseña del dueño, un rol nuevo con permisos de plata o una promoción a superadmin **no aparecen en ningún lado**. Los candados que se acaban de poner impiden que pase; lo que falta es poder ver que se intentó. Es la sección que le da sentido a la palabra "gerencia" y la que más rinde de las cinco pendientes'],
              ['**Web: ¿el sitio debería publicar las promos de mostrador?** (15/8/2026, decisión tuya — quedó postergada a propósito)', 'Salió mirando el código al construir las listas de oferta. El sitio publica **solo las promos que corren sobre TODAS las listas**; una acotada a la lista de mostrador **no se ve**. Y el precio que el sitio muestra ES el de mostrador, así que a primera vista está al revés: la promo del mostrador es justo la que el sitio vende. Puede ser un bug de siempre o puede ser que la vieja tilde se haya usado con otro sentido ("esta promo es solo para el local"). **No lo toqué**: pediste dejarlo como estaba, y la traducción quedó exacta —lo que se publicaba antes se sigue publicando—. Si algún día decidís que sí, son dos líneas (que el sitio muestre toda oferta que alcance a la lista con la que cotiza). Si decidís que la idea era "no publicar", lo correcto es una tilde aparte y explícita —"publicar en el sitio"— en vez de deducirlo de las listas: son dos preguntas distintas y hoy una responde por la otra. Ojo que la regla vive en DOS lugares que tienen que decir lo mismo: `tienda.module` (lo que el sitio muestra) y la pestaña "Ofertas del sitio" del módulo Web (lo que la pantalla promete)'],
              ['**Web: qué debe mostrar "Ofertas del sitio"** (13/8/2026, decisión chica de UX)', 'La pestaña marca "Vigente" mirando solo las fechas desde/hasta, pero el sitio además esconde una oferta si hoy no es uno de sus días o si está apuntada a otra sucursal. Resultado: una promo de fin de semana aparece "Vigente" un miércoles, y una de otra sucursal figura como del sitio aunque la tienda es la Distribuidora. El comentario del código dice "la MISMA regla que aplica el sitio" y no lo es. Alinearlo es fácil (espejar `ofertaVigente` con la sucursal de la tienda); lo que hay que decidir primero es qué querés que diga esa tabla: "todo lo que PODRÍA salir en el sitio" (lo de ahora) o "lo que el sitio muestra ahora mismo, hoy, en esta sucursal". No corre apuro: no afecta ningún precio, el sitio recotiza bien'],
              ['**Web: ¿el catálogo público muestra el stock exacto?** (13/8/2026, decisión del dueño)', 'El sitio manda `disponible` con la cantidad real de la Distribuidora — el auditor lo marcó como inteligencia competitiva servida en JSON. **No lo toqué porque el recorte que propone (`min(disponible, 20)`) rompe el mostrador mayorista:** ese número es el que topea el carrito, así que con 20 nadie podría pedir 50 kg de algo que hay 123. Y para una distribuidora, que el cliente sepa cuánto hay es más bien una función. Es tu llamada: si te preocupa el scraping de la competencia, se puede publicar el número recortado a un techo alto (que igual esconde el "hay 3.000") pero cualquier techo por debajo de un pedido mayorista real lo rechazaría. La parte de rendimiento de ese mismo hallazgo (son ~8 consultas por llamada, sin caché) es el gemelo del pendiente del caché de `GET /ventas/catalogo`: acá es MÁS fácil, porque el pedido revalida el stock al confirmar, así que un caché corto en la tienda es seguro aunque quede un rato viejo'],
              ['**Almacén: activar la clave de servicio de coffit** (13/8/2026, decisión y coordinación tuya)', 'El código ya está: falta **generar el secreto, cargarlo en el .env del servidor y pasárselo a quien mantiene coffit** para que lo mande en la cabecera X-Clave-Servicio. Mientras no lo hagas, coffit sigue entrando con una cuenta del CRM —que es el panel entero— y ese es justamente el riesgo que esto viene a sacar. El contrato ya está escrito con las instrucciones. De paso, avisale que si su cursor guardado es viejo conviene pedir una vez sin desde para reconciliar: hasta hoy el sync podía haberle perdido envíos si alguna vez hubo más de 200 cambios entre dos sincronizaciones.'],
              ['**El `comprometido` no tiene dueño** (13/8/2026, para mirar con calma)', 'La misma coordenada Producto×Sucursal×Presentación×`comprometido` la comparten **tres cosas distintas**: la reserva de una transferencia, la de un presupuesto y la de una incidencia. Nadie anota de quién es cada unidad, así que resolver una incidencia descuenta de ese pozo común sin saber si lo que se está comiendo es la reserva de un remito ya confirmado. El auditor no pudo probarlo sin reproducir una carrera con la base real, y el arreglo de fondo —una columna que diga el origen de cada reserva— es migración y decisión tuya. Lo anoto porque es el tipo de cosa que aparece un día como un descuadre que nadie puede explicar'],
              ['**El presupuesto cotiza distinto que la caja** (13/8/2026, lo más urgente de Ventas)', 'Lo encontró la depuración y **no lo toqué porque cambia plata**. Un presupuesto se guarda con el precio de lista y **sin las ofertas**: si el cliente vio 3 unidades a $2.000 por un 3×2, el papel dice **$3.000** — un 50% más que lo cotizado. Con un precio pisado a mano guarda el de lista, no el pactado. Y al revés, el botón "Cerrar en POS" manda el precio congelado **sin la lista con la que se congeló**, así que el portero nuevo lo compara contra el piso de HOY: si los precios subieron desde la cotización, **el vendedor sin `precio_manual` no puede cerrar el pedido**, que es exactamente la razón de existir del presupuesto. Las dos puntas rompen la misma promesa: el precio garantizado. Hay que decidir si el presupuesto **hereda** las ofertas (pide una columna nueva en `presupuesto_items`, o sea migración) o si se cotiza siempre a lista y la pantalla lo avisa'],
              ['**Tres perillas de Ventas › Configuración que no hacen nada** (13/8/2026)', '`redondeoEfectivo` ("redondear el vuelto"), `lectorHabilitado` y `lectorSufijoEnter` se editan y se guardan, y **ningún código las lee** — cero usos fuera del panel que las muestra. El dueño configura "redondear el vuelto a $10" y no pasa nada. Por cada una hay que decidir: implementarla o sacarla de la pantalla. Dejarla es peor que las dos, porque miente'],
              ['**Cómo se combina un precio de oferta con el descuento del cliente** (13/8/2026)', 'Con la oferta "el kilo a $800" y un cliente con 10%, hoy paga **$700** (los dos descuentos se apilan). Las otras dos lecturas defendibles son $800 (el precio de oferta gana y no se descuenta más) o $720 (el 10% sobre el precio de oferta). Quedó como estaba —$700— para no mover plata sin que lo decidas. Aplica a `precio_fijo`, `pack` y `combo`'],
              ['**`GET /ventas/catalogo` es cuadrático** (13/8/2026)', 'Tres `filter` de array adentro de bucles: con 1.000 productos, 300 paquetes y 2.500 filas de formato son **~5 millones de comparaciones por llamada**, y se llama al abrir el POS, **después de cada venta cobrada**, en cada aviso de precios y en el panel de Ofertas. Indexar por `Map` es mecánico pero toca el camino del precio del paquete fraccionado, así que hay que comparar el JSON antes y después byte a byte. Junto con esto: `GET /presupuestos` se baja **entero con todos sus renglones** en tres paneles (Órdenes web lo recarga cada 30 segundos para contar los pendientes), y faltan cuatro índices — `presupuestos` no tiene **ninguno**, y el `count(*)` que cada navegador pollea cada 30 segundos lo necesita'],
              ['**Anular una cobranza es gratis y anónimo** (13/8/2026)', 'Es el gemelo exacto de anular una venta, que ya pide permiso `devoluciones`, motivo obligatorio y guarda quién y cuándo (migración 0059). Anular una cobranza **sube el saldo del cliente y saca la plata del arqueo de su turno**, y hoy no pide permiso propio, no pide motivo y no deja rastro. Y el rastro que la venta **sí** guarda no se muestra en ninguna pantalla: el detalle dice "esta venta está ANULADA" y no quién, cuándo ni por qué. La auditoría existe en la base y no en la interfaz'],
              ['**Caché de `GET /ventas/catalogo`** (13/8/2026, el único de los 16 que quedó sin hacer)', 'Son **14 consultas por llamada** —entre ellas todos los productos y todo el stock de todas las sucursales— y se llama al abrir el POS, **después de cada venta cobrada**, en cada aviso de precios y en el panel de Ofertas. Un `while true` desde cualquier sesión válida deja las cajas sin poder cobrar. **No lo hice y el motivo importa:** un caché con vencimiento simple (30-60 s) le mostraría al cajero el **stock viejo justo después de vender**, que es exactamente cuando el POS lo recarga. Hacerlo bien pide invalidación de verdad —avisarle al caché cuando se mueve stock, se toca un precio o se edita una oferta—, y eso cruza tres módulos. Junto con esto va el `catalogo()` cuadrático que encontró la depuración (unos 5 millones de comparaciones por llamada con 1.000 productos), porque se arregla en el mismo lugar'],
              ['**¿El cajero puede anular una venta?** (decisión del dueño)', 'Hoy hay una asimetría a propósito, y conviene resolverla: la API pide el permiso **`devoluciones`** (que el rol Cajero TIENE), pero la pantalla muestra el botón Anular **solo a admin y superadmin**. O sea que el servidor lo permitiría y la pantalla no lo ofrece. Se puede: (a) sacarle `devoluciones` al Cajero, y entonces las dos coinciden en NO; o (b) mostrarle el botón, y las dos coinciden en SÍ, con el rastro de `anuladoPor` que ahora existe. Anular saca el efectivo del arqueo, así que la respuesta cambia quién puede tapar un faltante'],
              ['**El fraccionado como DOCUMENTO** (tabla propia)', 'Hoy una tanda de fraccionado es **una línea de texto** en movimientos ("Fraccionó 10 kg en 20×500 g"). De ahí salen cuatro cosas que no se pueden hacer: **reimprimir las etiquetas de esa tanda**, **anular** el fraccionado (un 200 en vez de 20 se arregla con dos ajustes a mano y el rastro se pierde), saber **quién** lo hizo, y cargar **varios productos en una sola sesión** (un día de fraccionado son 12 productos = 12 modales). Con tabla propia (`fraccionamientos` + items, el patrón de transferencias) aparece además el número **FR0012**, que es el candidato natural a LOTE si la etiqueta algún día tiene que ser rótulo legal'],
              ['**El rendimiento del fraccionado no existe**', 'El sistema descuenta exactamente `paquetes × tamaño`: la cuenta es perfecta por definición. En la realidad de 10 kg salen 19 paquetes y queda resto en la balanza, en el envase y en el piso. Hoy esa diferencia hay que cargarla como merma en otra pantalla, o sea que no se carga. Propuesta: un campo **"granel consumido"** (con el teórico puesto) y la diferencia se registra sola como merma con motivo "diferencia de fraccionado FR0012" — y queda la métrica de rendimiento por producto y por persona, que es la que dice si la bolsa vino corta o si alguien trabaja sucio'],
              ['**Fraccionar no le avisa a Vencimientos** (roto hoy)', 'Si el granel tiene registro en el vigía de fechas y se fracciona, el registro sigue apuntando al granel **que ya no está**: al procesarlo, la API corta con "Stock disponible insuficiente" y el vencimiento queda trabado sin explicación. Y del otro lado, los paquetes salen sin fecha. Al fraccionar habría que ofrecer **trasladar la fecha del granel a los paquetes** (proporcional), y de ahí la toma la etiqueta'],
              ['**Los movimientos del Almacén no guardan quién**', 'El fraccionamiento, las mermas y los ajustes cargados desde las pantallas de Almacén viajan **sin `usuarioId`** (los 2 fraccionamientos que hay en la base tienen autor NULL): el modal no lo manda y el store solo lo inyecta en algunas llamadas. Con las mermas valuadas a costo congelado, una baja sin autor es plata que se perdió y nadie firmó'],
              ['**Fraccionar desde el pedido, y el sugerido de los días sin pedido**', 'Desde la lista **Fraccionados** de un envío, el link "Fraccionar" abre el modal con todas las presentaciones en cero: el chico tiene que releer el papel y tipear. Debería llegar con **lo que falta de esa lista** (pedido − stock) y volver ahí al terminar. Y para los días sin pedidos, `stockMin` ya alimenta el sugerido de transferencias: la misma cuenta sobre las presentaciones diría "faltan 30 paquetes de 500 g en Express 2" en vez de que el fraccionador elija de memoria'],
              ['**Sanear los 71 códigos heredados** (la puerta ya está cerrada)', 'Desde el 10/8 un código nuevo **no puede nacer roto**: el campo exige EAN-13 y el botón Generar da uno propio (serie interna, esquivando el prefijo de la balanza). Lo que queda es el **arrastre**: de las 238 presentaciones, **13** tienen 13 dígitos con el verificador mal, **58** no llegan a 13 dígitos (hay de 2, 3 y 4 caracteres) y **4** no tienen nada — se avisan en amarillo y se arreglan de a uno con Generar, pero conviene hacer una pasada. Los cortos son los peores: el POS busca por **sufijo**, así que un código de 3 dígitos puede resolver a otro producto al escanear. Falta también el mismo tratamiento en el **código del producto** y en el del **formato de venta** (ahí hay uno: "54564" en Maiz Frito Original)'],
              ['**Rótulo legal del fraccionado** (si hace falta)', 'La etiqueta de hoy es **interna**: nombre, peso, precio, código y vencimiento. Si alguna vez tiene que cumplir el rótulo del fraccionado, faltan **lote** (sale del documento del punto 1), **RNE/RNPA** —que no existen como campo en Sistema › Empresa— y la razón social en la etiqueta. Decisión del dueño pendiente'],
              ['**Leer los RENGLONES de la factura — la mitad ya está**', '**PDFs digitales: HECHO** (8/8/2026, botón "Leer renglones del PDF" en el paso 2 del alta, receta Bavosi/Tango, gratis y local). Lo que queda EN ESPERA son las **fotos**, que no tienen texto adentro: para esas sigue vigente el modelo de visión, con la misma decisión pendiente del dueño (la imagen sale de la máquina) pero menos volumen y menos costo. Y sumar **recetas de otros proveedores** a medida que lleguen sus PDFs. Ficha: Pendientes › "Leer los renglones de la factura"'],
              ['**Renglones que NO son mercadería** (flete, envases retornables, redondeo)', 'Las facturas los traen y hoy **no se pueden guardar**: `comprobante_items.productoId` es obligatorio. Sin resolverlo, cada factura con flete no cierra contra el total del papel — y es **bloqueante de la lectura automática de renglones**. Decisión de diseño pendiente: un flag de "concepto no inventariable" en el ítem (más honesto) o productos de servicio designados'],
              ['**Conciliar con "Mis Comprobantes" de ARCA**', 'ARCA deja bajar en CSV todas las facturas que cualquier proveedor emitió contra el CUIT de la empresa. Sirve para **encontrar facturas que existen y nunca se cargaron** — cada una es crédito fiscal de IVA no computado y deuda que no figura en la cuenta del proveedor. Es el mismo patrón de "subir un archivo y previsualizar" que ya está construido dos veces'],
              ['**CUIT de los proveedores y de la empresa**', 'El reconocimiento automático de la bandeja va **por CUIT**: los proveedores que no lo tengan cargado llegan sin proveedor y hay que elegirlo a mano. Y el CUIT de la empresa (Sistema › Empresa) todavía es el de prueba `30-71555666-7`: mientras siga así, **toda factura va a mostrar el aviso "no es nuestra"**, que es peor que no avisar — entrena a ignorar los avisos'],
              ['**Sesiones con token — BLOQUEANTE del deploy**', 'El login ya valida contraseña, pero la API sigue abierta: cualquiera que la alcance puede llamar cualquier endpoint. En la red local no duele; al publicar el sitio, la API queda en internet y esto pasa a ser **condición previa**: solo los 4 endpoints públicos de la tienda (catálogo, pedidos, eventos, imágenes) pueden quedar sin token — todo el resto tiene que exigir sesión autenticada ANTES de apuntar el dominio'],
              ['**Anular un comprobante de compra**', 'No hay endpoint todavía. Cuando se haga, tiene que **liberar las imputaciones**: los pagos tomados vuelven a la bandeja con su saldo — anular por arriba dejaría plata aplicada a un documento que ya no existe'],
              ['**Cafetería, fases 2 y 3 (lado coffit)**', 'La fase 1 ya funciona (Almacén › Cafetería, ver su guía). Falta el **importador de remitos en coffit** (fase 2, por archivo, sin API) y la **conexión directa** (fase 3: token con permisos acotados — activa el bloqueante de auth — más el endpoint de confirmación de recepción en el CRM, que le da dueño formal a la merma del viaje)'],
              ['**Nota de DÉBITO de venta**', 'La de crédito ya está (20/8, migración 0076). Falta la de débito, que es lo que corrige una nota de crédito mal emitida o cobra algo que faltó facturar. El enum de la base ya tiene los tres tipos (`nota_debito_a/b/c`) — se agregaron en la misma migración porque recrear el enum es la parte cara; falta el circuito'],
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
              '**PREGUNTA ABIERTA PARA EL DUEÑO — ¿el flete lleva la neutralización del IVA o no?** (19/8/2026, quedó pendiente de responder). Comparando el Aceite de Oliva de CARLOS OLIVAA contra el sistema viejo aparecieron dos cadenas distintas: el **viejo** aplica el flete DESPUÉS del ×1,21, así que le extiende al flete la misma neutralización que a la mercadería negra; el **nuestro** mete el flete entero después (decisión del 19/8: "el flete es ajeno al proveedor, lo pago yo"). La brecha es el **21% del flete** — con $37.800 + 10% son $793,80 por bulto, y en góndola con 50% de markup salen ~$100 de diferencia por unidad (nuestro $5.297 contra $5.197 del viejo). Con la cadena vieja recuperás **el 82,64% del flete** que pagaste; con la nuestra, el 100%. **Las dos preguntas que lo definen: (1) ¿el flete te lo facturan con IVA (que recuperás como crédito fiscal) o lo pagás sin papel? (2) el % de flete que se carga, ¿es lo que sale del bolsillo o el neto sin IVA?** Si el flete viene facturado y el % es lo que se paga en total, **el sistema viejo da exacto** y hay que volver el cálculo a ese orden (diez minutos de trabajo, en `partir()` de `pricing.ts`). Si se paga sin papel, pasa a ser una decisión de precio (góndola más barata contra recuperar el flete entero).',
              '**Los 47 proveedores marcados liquidación/mixto tienen el "Sin factura %" en CERO.** Se importaron el 17/8, antes de que el campo existiera (migración 0072 del 19/8), así que arrancaron todos en 0. Para los **34 de liquidación** no molesta —al elegirlos en un formato el sistema deduce 100 de la condición— pero conviene dejarlo explícito. Los **13 mixtos** SÍ son un problema silencioso: "mixto" no dice cuánto, el formato precarga 0 y el producto queda sin la neutralización, con el precio más caro de lo que debería y sin avisar. Son ALIMENTARIA KONY, ANGIOLA, ARGENDIET, CARILO, CERAL ALIMENTOS DIET, CUARTO CRECIENTE, DOÑA ROSA, GOIPAT, GREEN & CO, OLIVATTO, TAHIEL, TRATENFU y WELLNESS PLUS. Falta que el dueño pase el % real de cada uno.',
              '**FACTURACIÓN ELECTRÓNICA — falta el certificado (fases 6 y 8).** Fases 3, 4, 5 y 7 hechas: el módulo `arca/` (WSAA, WSFE, armado de A/B con IVA discriminado), el enganche con la venta (numeración desde ARCA, serialización, reserva del número y recuperación), la factura impresa con su QR y **las notas de crédito** (20/8, migración 0076). Contra el ARCA de homologación real ya se probó que `FEDummy` responde y que **el WSAA acepta y parsea nuestra firma CMS**. **LO QUE BLOQUEA TODO: el certificado.** Después: **(1)** subirlo al servidor —volumen montado, fuera de la imagen— y cargar las cinco variables `ARCA_*` (documentadas en `.env.example`); **(2)** correr `node dist/arca/probar.js` y que dé OK; **sin eso no se sigue**, porque cualquier bug posterior va a parecer del código cuando es un trámite a medias; **(3)** fase 6, el panel de diagnóstico (entorno bien visible cuando es PRODUCCIÓN, probar conexión, y las trabadas con su reintento); **(4)** fase 8, el pasaje a producción, con el orden del §12 de la guía (limpiar pendientes ANTES de prender el interruptor, y la primera factura real a mano y mirándola). **Dos decisiones del dueño siguen abiertas**: si toda venta se factura o el ticket interno sobrevive, y los datos fiscales reales (hoy Sistema › Empresa tiene datos de ejemplo — "Av. Siempreviva 742"). Mientras tanto el interruptor de ARCA en Configuración va APAGADO.',
              '**Una Factura A a un cliente sin CUIT sale como provisorio, no avisa antes.** Si el cliente está marcado Responsable Inscripto pero no tiene el CUIT cargado, la venta se confirma como ticket provisorio con el motivo ("Una Factura A necesita el CUIT del cliente") y queda en Sin facturar; se arregla cargándole el CUIT a la ficha y apretando Facturar. Funciona, pero sería mejor que el POS lo frenara ANTES de cobrar, cuando el cajero todavía puede pedirle el CUIT al cliente. Queda para cuando moleste.',
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










