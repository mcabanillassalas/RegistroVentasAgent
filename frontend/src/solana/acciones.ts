import { address, createNoopSigner, type Address } from '@solana/kit';
import type { Connection } from '@solana/web3.js';
import {
  getCrearRegistroInstruction, getCrearClienteInstruction,
  getEliminarClienteInstruction,
  getRegistrarVentaInstruction, getCambiarMontoInstruction, getHacerDevolucionInstruction,
  getInicializarInventarioInstruction, getInicializarHistorialVentasV2Instruction,
  getCrearProductoInstruction, getReabastecerProductoInstruction, getActualizarProductoInstruction,
  getRegistrarVentaInventarioInstruction, getAjustarCantidadVentaInstruction,
  getDevolverVentaInventarioInstruction, fetchMaybeInventario, fetchMaybeHistorialVentasV2,
} from '../../clients/js/src/generated';
import { rpc } from './conexion';
import { cadena, pdaCliente, pdaHistorialVentasV2, pdaInventario, pdaProducto, pdaRegistro, pdaVentaInventario } from './pdas';
import { siguienteId } from './lecturas';
import { enviar, type WalletFirma, type OpcionesEnvio } from './tx';
import { comprobarConfiguracion } from './seguridad';
import { negocioValido, nombreValido, skuValido, descripcionValida, idValido, montoValido, cantidadValida, precioUnitarioValido, stockInicialValido } from './validaciones';

export function direccionDe(wallet: Pick<WalletFirma, 'publicKey'>): Address {
  if (!wallet.publicKey) throw new Error('Conecta tu wallet primero.');
  return address(wallet.publicKey.toBase58());
}

function firmante(wallet: WalletFirma) {
  comprobarConfiguracion();
  // Representa la identidad que la wallet firmará después; no contiene claves.
  // Los roles finales los establece el builder generado del cliente actual.
  return createNoopSigner(direccionDe(wallet));
}

/** Ejemplo resuelto: identidad, cuentas, instrucción y envío. */
export async function crearRegistro(wallet: WalletFirma, connection: Connection, nombreNegocio: string, opciones?: OpcionesEnvio): Promise<string> {
  nombreNegocio = negocioValido(nombreNegocio);
  const owner = firmante(wallet);
  const registro = pdaRegistro(nombreNegocio, owner.address);
  const ix = getCrearRegistroInstruction({ owner, registro, nombreNegocio });
  return enviar(ix, wallet, connection, opciones);
}

/** Ejercicio 1 del día 4: crear la cuenta Cliente y actualizar Registro. */
export async function crearCliente(wallet: WalletFirma, connection: Connection, nombreNegocio: string, nombre: string, opciones?: OpcionesEnvio): Promise<string> {
  nombreNegocio = negocioValido(nombreNegocio);
  nombre = nombreValido(nombre);
  const owner = firmante(wallet);
  const registro = pdaRegistro(nombreNegocio, owner.address);
  const id = await siguienteId(nombreNegocio, owner.address);
  const cliente = pdaCliente(registro, id);
  const ix = getCrearClienteInstruction({ owner, registro, cliente, nombre });
  return enviar(ix, wallet, connection, opciones);
}

export async function eliminarCliente(
  wallet: WalletFirma, connection: Connection, nombreNegocio: string,
  idCliente: number, opciones?: OpcionesEnvio,
): Promise<string> {
  nombreNegocio = negocioValido(nombreNegocio);
  idCliente = idValido(idCliente);
  const owner = firmante(wallet);
  const registro = pdaRegistro(nombreNegocio, owner.address);
  const cliente = pdaCliente(registro, idCliente);
  const historialV2 = pdaHistorialVentasV2(cliente);
  const ix = getEliminarClienteInstruction({
    owner, registro, cliente, historialV2, idCliente,
  });
  return enviar(ix, wallet, connection, opciones);
}

/** Ejercicio 2: mismo patrón con una Venta que depende del Cliente. */
export async function registrarVenta(wallet: WalletFirma, connection: Connection, nombreNegocio: string, idCliente: number, sku: string, descripcion: string, monto: number, opciones?: OpcionesEnvio): Promise<string> {
  nombreNegocio = negocioValido(nombreNegocio);
  idCliente = idValido(idCliente);
  sku = skuValido(sku);
  descripcion = descripcionValida(descripcion);
  monto = montoValido(monto);
  const owner = firmante(wallet);
  const { registro, cliente, venta } = cadena(nombreNegocio, owner.address, idCliente, sku);
  const ix = getRegistrarVentaInstruction({ owner, registro, cliente, venta, idCliente, sku, descripcion, monto });
  return enviar(ix, wallet, connection, opciones);
}

export async function cambiarMonto(wallet: WalletFirma, connection: Connection, nombreNegocio: string, idCliente: number, sku: string, nuevoMonto: number, opciones?: OpcionesEnvio): Promise<string> {
  nombreNegocio = negocioValido(nombreNegocio);
  idCliente = idValido(idCliente);
  sku = skuValido(sku);
  nuevoMonto = montoValido(nuevoMonto);
  const owner = firmante(wallet);
  const { registro, cliente, venta } = cadena(nombreNegocio, owner.address, idCliente, sku);
  const ix = getCambiarMontoInstruction({ owner, registro, cliente, venta, idCliente, sku, nuevoMonto });
  return enviar(ix, wallet, connection, opciones);
}

export async function hacerDevolucion(wallet: WalletFirma, connection: Connection, nombreNegocio: string, idCliente: number, sku: string, opciones?: OpcionesEnvio): Promise<string> {
  nombreNegocio = negocioValido(nombreNegocio);
  idCliente = idValido(idCliente);
  sku = skuValido(sku);
  const owner = firmante(wallet);
  const { registro, cliente, venta } = cadena(nombreNegocio, owner.address, idCliente, sku);
  const ix = getHacerDevolucionInstruction({ owner, registro, cliente, venta, idCliente, sku });
  return enviar(ix, wallet, connection, opciones);
}

export async function inicializarInventario(wallet: WalletFirma, connection: Connection, nombreNegocio: string, opciones?: OpcionesEnvio): Promise<string> {
  nombreNegocio = negocioValido(nombreNegocio);
  const owner = firmante(wallet);
  const registro = pdaRegistro(nombreNegocio, owner.address);
  const inventario = pdaInventario(registro);
  const ix = getInicializarInventarioInstruction({ owner, registro, inventario });
  return enviar(ix, wallet, connection, opciones);
}

export async function crearProducto(
  wallet: WalletFirma, connection: Connection, nombreNegocio: string,
  sku: string, descripcion: string, precioUnitario: number, stockInicial: number,
  opciones?: OpcionesEnvio,
): Promise<string> {
  nombreNegocio = negocioValido(nombreNegocio);
  sku = skuValido(sku);
  descripcion = descripcionValida(descripcion);
  precioUnitario = precioUnitarioValido(precioUnitario);
  stockInicial = stockInicialValido(stockInicial);
  const owner = firmante(wallet);
  const registro = pdaRegistro(nombreNegocio, owner.address);
  const inventario = pdaInventario(registro);
  const producto = pdaProducto(registro, sku);
  const ix = getCrearProductoInstruction({
    owner, registro, inventario, producto, sku, descripcion, precioUnitario, stockInicial,
  });
  return enviar(ix, wallet, connection, opciones);
}

export async function reabastecerProducto(
  wallet: WalletFirma, connection: Connection, nombreNegocio: string,
  sku: string, cantidad: number, opciones?: OpcionesEnvio,
): Promise<string> {
  nombreNegocio = negocioValido(nombreNegocio);
  sku = skuValido(sku);
  cantidad = cantidadValida(cantidad);
  const owner = firmante(wallet);
  const registro = pdaRegistro(nombreNegocio, owner.address);
  const producto = pdaProducto(registro, sku);
  const ix = getReabastecerProductoInstruction({ owner, registro, producto, sku, cantidad });
  return enviar(ix, wallet, connection, opciones);
}

export async function actualizarProducto(
  wallet: WalletFirma, connection: Connection, nombreNegocio: string,
  sku: string, descripcion: string, precioUnitario: number, activo: boolean,
  opciones?: OpcionesEnvio,
): Promise<string> {
  nombreNegocio = negocioValido(nombreNegocio);
  sku = skuValido(sku);
  descripcion = descripcionValida(descripcion);
  precioUnitario = precioUnitarioValido(precioUnitario);
  const owner = firmante(wallet);
  const registro = pdaRegistro(nombreNegocio, owner.address);
  const producto = pdaProducto(registro, sku);
  const ix = getActualizarProductoInstruction({ owner, registro, producto, sku, descripcion, precioUnitario, activo });
  return enviar(ix, wallet, connection, opciones);
}

async function obtenerSiguienteIdVenta(registro: Address): Promise<number> {
  const inventario = await fetchMaybeInventario(rpc, pdaInventario(registro));
  if (!inventario.exists) throw new Error('Inicializa el inventario antes de registrar ventas.');
  return inventario.data.siguienteIdVenta;
}

export async function registrarVentaInventario(
  wallet: WalletFirma, connection: Connection, nombreNegocio: string,
  idCliente: number, sku: string, cantidad: number, opciones?: OpcionesEnvio,
): Promise<string> {
  nombreNegocio = negocioValido(nombreNegocio);
  idCliente = idValido(idCliente);
  sku = skuValido(sku);
  cantidad = cantidadValida(cantidad);
  const owner = firmante(wallet);
  const registro = pdaRegistro(nombreNegocio, owner.address);
  const cliente = pdaCliente(registro, idCliente);
  const inventario = pdaInventario(registro);
  const producto = pdaProducto(registro, sku);
  const historial = pdaHistorialVentasV2(cliente);
  const idVenta = await obtenerSiguienteIdVenta(registro);
  const cuentaHistorial = await fetchMaybeHistorialVentasV2(rpc, historial);
  if (!cuentaHistorial.exists) {
    const inicializar = getInicializarHistorialVentasV2Instruction({
      owner, registro, cliente, historial, idCliente,
    });
    await enviar(inicializar, wallet, connection, opciones);
  }
  const venta = pdaVentaInventario(inventario, idVenta);
  const ix = getRegistrarVentaInventarioInstruction({
    owner, registro, cliente, inventario, producto, historial, venta,
    idCliente, idVenta, sku, cantidad,
  });
  return enviar(ix, wallet, connection, opciones);
}

export async function ajustarCantidadVentaInventario(
  wallet: WalletFirma, connection: Connection, nombreNegocio: string,
  idCliente: number, idVenta: number, sku: string, nuevaCantidad: number,
  opciones?: OpcionesEnvio,
): Promise<string> {
  nombreNegocio = negocioValido(nombreNegocio);
  idCliente = idValido(idCliente);
  idVenta = cantidadValida(idVenta);
  sku = skuValido(sku);
  nuevaCantidad = cantidadValida(nuevaCantidad);
  const owner = firmante(wallet);
  const registro = pdaRegistro(nombreNegocio, owner.address);
  const cliente = pdaCliente(registro, idCliente);
  const inventario = pdaInventario(registro);
  const producto = pdaProducto(registro, sku);
  const historial = pdaHistorialVentasV2(cliente);
  const venta = pdaVentaInventario(inventario, idVenta);
  const ix = getAjustarCantidadVentaInstruction({
    owner, registro, cliente, inventario, producto, historial, venta,
    idVenta, idCliente, sku, nuevaCantidad,
  });
  return enviar(ix, wallet, connection, opciones);
}

export async function devolverVentaInventario(
  wallet: WalletFirma, connection: Connection, nombreNegocio: string,
  idCliente: number, idVenta: number, sku: string, opciones?: OpcionesEnvio,
): Promise<string> {
  nombreNegocio = negocioValido(nombreNegocio);
  idCliente = idValido(idCliente);
  idVenta = cantidadValida(idVenta);
  sku = skuValido(sku);
  const owner = firmante(wallet);
  const registro = pdaRegistro(nombreNegocio, owner.address);
  const cliente = pdaCliente(registro, idCliente);
  const inventario = pdaInventario(registro);
  const producto = pdaProducto(registro, sku);
  const historial = pdaHistorialVentasV2(cliente);
  const venta = pdaVentaInventario(inventario, idVenta);
  const ix = getDevolverVentaInventarioInstruction({
    owner, registro, cliente, inventario, producto, historial, venta,
    idVenta, idCliente, sku,
  });
  return enviar(ix, wallet, connection, opciones);
}
