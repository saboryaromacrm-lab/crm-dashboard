/**
 * LA MISMA PANTALLA, CONTADA DESDE LOS DOS LADOS.
 * ============================================================================
 * La cafetería (coffit) y la distribuidora comparten los mismos documentos,
 * pero no la misma frase: lo que para una es una SALIDA, para la otra es un
 * RECIBIDO, y al revés. Antes todo estaba escrito desde la distribuidora, así
 * que la persona del café leía "le mandamos" hablando de ella en tercera
 * persona y tenía que traducir mentalmente cada pantalla.
 *
 * Es UN diccionario y no ochenta `if` repartidos. Cada pantalla pide el texto
 * y no pregunta quién está mirando: si mañana hay una tercera voz se agrega
 * una columna acá y no se toca ningún componente.
 *
 * LO QUE NO CAMBIA es todo lo demás: los códigos (`CAF` sale, `RCA` entra),
 * los datos, los permisos y la sincronización con coffit. Es cómo se lee, no
 * qué pasa.
 */

/**
 * ¿Quién está mirando? El que puede cargar entradas pero NO operar la sección
 * completa es el café: la distribuidora tiene `almacen.cafeteria`, que es la
 * llave de las salidas — las que egresan stock real de sus depósitos.
 */
export const esVozDelCafe = (can) => can('almacen.cafeteria-entradas') && !can('almacen.cafeteria');

/* La distribuidora: "yo le mando al café, el café me manda a mí". */
const CASA = {
  seccion: 'Cafetería',
  titulo: 'Cafetería',
  desc: 'El puente con coffit, en los dos sentidos: le mandamos mercadería a costo, y ella nos manda lo que elabora para vender en el mostrador. Acá no hay existencias del café: su stock lo maneja coffit.',

  tabPedidos: 'Pedidos',
  tabSalida: 'Le mandamos',
  tabEntrada: 'Nos mandó',
  tabDeposito: 'Depósito del café',
  depositoSub: 'Mercadería de uso exclusivo de la cafetería guardada en las sucursales. Ya es del café —se le imputó al comprarla— y sale cuando él la pide. Valuada al costo de hoy.',
  depositoVacio: 'No hay mercadería exclusiva del café en stock. Lo que se compre de un artículo marcado «uso exclusivo de Cafetería» aparece acá.',
  depositoBtn: null,

  btnSalida: '+ Nuevo envío',
  btnEntrada: '+ Envío de la cafetería',

  statSalida: 'Le mandamos (a costo)',
  statEntrada: 'Nos mandó',
  saldoCasa: 'Saldo a favor de la distribuidora',
  saldoCafe: 'Saldo a favor de la cafetería',
  costoTotal: 'Le mandamos + gastos',

  colSucEntrada: 'Llegó a',
  colSucSalida: 'Salió de',
  metricaSalida: 'Lo que le mandamos',
  metricaEntrada: 'Lo que nos mandó',

  altaEntradaTitulo: 'Envío DE la cafetería a una sucursal',
  altaEntradaSub: 'La mercadería INGRESA al stock de la sucursal que elijas y queda lista para vender en el mostrador, al costo que declares',
  altaEntradaSuc: 'Llega a la sucursal',
  detalleEntrada: 'Envío DE la cafetería',
  detalleSalida: 'Envío a Cafetería',
  okEntrada: (cod, monto) => `${cod} recibido · ${monto}. Ya está en el stock de la sucursal y se puede vender.`,

  pedidoSeccion: 'Pedido a la distribuidora',
  pedidoTitulo: 'Pedido a la distribuidora',
  pedidoSub: 'Armá el pedido de mercadería del café y seguile el estado. El detalle final es el del envío que lo cumple.',
  pedidoAltaTitulo: 'Pedido a la distribuidora',
  pedidoSucLabel: 'A qué sucursal se lo pedís',
  pedidoColSuc: 'Se lo pedimos a',

  prodSeccion: 'Productos Coffit',
  prodTitulo: 'Productos Coffit',
  prodSub: 'Lo que la cafetería elabora y manda a las sucursales para vender en el mostrador. Los da de alta ella misma: no se compran, así que no llevan proveedor ni formato de compra.',
  prodBtn: '+ Nuevo producto de la cafetería',
  prodVacio: 'La cafetería todavía no cargó ningún producto.',
};

/* El café: "yo le mando a Sabor y Aroma, Sabor y Aroma me manda a mí". */
const CAFE = {
  seccion: 'Sabor y Aroma',
  titulo: 'Sabor y Aroma',
  desc: 'Tu puente con Sabor y Aroma, en los dos sentidos: vos les mandás lo que elaborás para que lo vendan en el mostrador, y ellos te mandan la mercadería que les pedís. Tu propio stock lo seguís manejando en coffit.',

  tabPedidos: 'Mis pedidos',
  tabSalida: 'Recibidos de Sabor y Aroma',
  tabEntrada: 'Envíos a Sabor y Aroma',
  tabDeposito: 'Disponible en depósito',
  depositoSub: 'Lo que Sabor y Aroma compró para vos y tiene guardado. Ya es tuyo: pedilo cuando lo necesites y te lo mandan.',
  depositoVacio: 'No hay nada guardado para vos ahora mismo.',
  depositoBtn: 'Pedir de acá',

  btnSalida: null,
  btnEntrada: '+ Nuevo envío a Sabor y Aroma',

  statSalida: 'Recibido de Sabor y Aroma',
  statEntrada: 'Les mandaste',
  saldoCasa: 'Saldo a favor de Sabor y Aroma',
  saldoCafe: 'Saldo a tu favor',
  costoTotal: 'Recibido + gastos',

  colSucEntrada: 'Se lo mandaste a',
  colSucSalida: 'Te lo mandó',
  metricaSalida: 'Lo que te mandaron',
  metricaEntrada: 'Lo que mandaste',

  altaEntradaTitulo: 'Nuevo envío a Sabor y Aroma',
  altaEntradaSub: 'Lo que mandás INGRESA al stock de la sucursal que elijas y queda listo para que lo vendan en el mostrador, al costo que declares',
  altaEntradaSuc: 'A qué sucursal se lo mandás',
  detalleEntrada: 'Envío a Sabor y Aroma',
  detalleSalida: 'Recibido de Sabor y Aroma',
  okEntrada: (cod, monto) => `${cod} enviado · ${monto}. Ya está en el stock de la sucursal y lo pueden vender.`,

  pedidoSeccion: 'Pedido a Sabor y Aroma',
  pedidoTitulo: 'Pedido a Sabor y Aroma',
  pedidoSub: 'Pedí la mercadería que necesitás y seguile el estado. Elegí a qué sucursal se la pedís: vas a ver lo que ESA sucursal tiene, y de ahí sale lo que te manden.',
  pedidoAltaTitulo: 'Pedido a Sabor y Aroma',
  pedidoSucLabel: 'A qué sucursal se lo pedís',
  pedidoColSuc: 'Se lo pedís a',

  prodSeccion: 'Mis productos',
  prodTitulo: 'Mis productos',
  prodSub: 'Lo que elaborás y mandás a las sucursales. Cargalo acá una vez —nombre y precio— y ya lo podés mandar. No lleva proveedor ni costo de compra: el costo lo declarás en cada envío.',
  prodBtn: '+ Nuevo producto',
  prodVacio: 'Todavía no cargaste ninguno. "+ Nuevo producto" carga el primero.',
};

/** El diccionario que corresponde a quien está mirando. */
export const vozCafeteria = (soyElCafe) => (soyElCafe ? CAFE : CASA);

/* ==================================================================== *
 * HACE CUÁNTO NO SE TOCA UN NÚMERO
 * ==================================================================== *
 * Un costo que nadie movió en cuatro meses se muestra igual de seguro que uno
 * de ayer, y de ahí sale una rentabilidad que miente sin que nada avise. Con
 * la inflación de acá, "viejo" llega rápido: al mes ya conviene mirarlo, a los
 * tres ya es casi seguro que está mal.
 *
 * Devuelve el texto y el tono, juntos, porque son la misma decisión: separar
 * "cuántos días" de "esto está viejo" habría dejado dos reglas que algún día
 * no coinciden.
 */
export function antiguedad(dias) {
  if (dias == null) return { texto: 'nunca', tono: 'mal', nunca: true };
  if (dias === 0) return { texto: 'hoy', tono: 'ok' };
  if (dias === 1) return { texto: 'ayer', tono: 'ok' };
  if (dias < 30) return { texto: `hace ${dias} días`, tono: 'ok' };
  const meses = Math.floor(dias / 30);
  const texto = meses === 1 ? 'hace 1 mes' : `hace ${meses} meses`;
  return { texto, tono: dias > 90 ? 'mal' : 'aviso' };
}
