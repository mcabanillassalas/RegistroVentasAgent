import type { Address } from "@solana/kit";

import {
  fetchAllCliente,
  fetchAllVenta,
  fetchAllProducto,
  fetchAllVentaInventario,
  fetchMaybeHistorialVentasV2,
  fetchMaybeInventario,
  fetchMaybeRegistro,
} from "../../clients/js/src/generated";
import { rpc } from "./conexion";
import { pdaHistorialVentasV2, pdaInventario, pdaRegistro } from "./pdas";

/*
LECTURAS — ya resueltas

Leer no necesita wallet ni firma: solo el rpc. Estas funciones vienen escritas
para que el dia 4 puedas concentrarte en la escritura.

Fijate en la forma del resultado: fetchX devuelve { address, data, lamports... }
y los campos de la cuenta estan dentro de .data, nunca sueltos en la raiz.
*/

export type ClienteUI = {
  direccion: Address;
  idCliente: number;
  nombre: string;
  compras: number;
  ventas: { direccion: Address; sku: string; descripcion: string; monto: number }[];
};

export type RegistroUI = {
  direccion: Address;
  nombreNegocio: string;
  idCounter: number;
  clientes: ClienteUI[];
};

export type InventarioUI = {
  direccion: Address;
  siguienteIdVenta: number;
  productos: {
    direccion: Address;
    sku: string;
    descripcion: string;
    precioUnitario: number;
    stock: number;
    activo: boolean;
  }[];
  ventas: {
    direccion: Address;
    idVenta: number;
    idCliente: number;
    sku: string;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    total: bigint;
  }[];
};

/*
Tres niveles de cuentas, tres niveles de lectura: el registro guarda las
direcciones de sus clientes, y cada cliente las de sus ventas. Esa es la
contrapartida del modelo: una cuenta por entidad se paga con una lectura
por entidad.

fetchMaybe... no lanza si la cuenta no existe: devuelve exists: false. Es lo
que quieres cuando el usuario todavia no ha creado su registro.
*/
export async function leerRegistro(
  nombreNegocio: string,
  owner: Address
): Promise<RegistroUI | null> {
  const direccion = pdaRegistro(nombreNegocio, owner);
  const cuenta = await fetchMaybeRegistro(rpc, direccion);

  if (!cuenta.exists) return null;

  const clientes = cuenta.data.clientes.length
    ? await fetchAllCliente(rpc, cuenta.data.clientes)
    : [];

  const conVentas = await Promise.all(
    clientes.map(async (c) => {
      const ventas = c.data.historial.length
        ? await fetchAllVenta(rpc, c.data.historial)
        : [];
      return {
        direccion: c.address,
        idCliente: c.data.idCliente,
        nombre: c.data.nombre,
        compras: c.data.compras,
        ventas: ventas.map((v) => ({
          direccion: v.address,
          sku: v.data.sku,
          descripcion: v.data.descripcion,
          monto: v.data.monto,
        })),
      };
    })
  );

  return {
    direccion,
    nombreNegocio: cuenta.data.nombreNegocio,
    idCounter: cuenta.data.idCounter,
    clientes: conVentas,
  };
}

/*
El id del cliente nuevo sale del contador del registro.

El programa es quien lo asigna; esta lectura no se lo manda. Hace falta porque
el id entra en las semillas, y una transaccion de Solana declara por adelantado
todas las cuentas que va a tocar: hay que saber la direccion ANTES de firmar.
*/
export async function siguienteId(
  nombreNegocio: string,
  owner: Address
): Promise<number> {
  const cuenta = await fetchMaybeRegistro(rpc, pdaRegistro(nombreNegocio, owner));
  if (!cuenta.exists) throw new Error("Ese registro no existe todavia.");
  if (cuenta.data.clientes.length >= 10) throw new Error("El registro alcanzó las 10 referencias de clientes previstas para el ejercicio.");
  if (cuenta.data.idCounter >= 65_535) throw new Error("Se agotaron los identificadores u16 del registro.");
  return cuenta.data.idCounter + 1;
}

export async function leerInventarioV2(
  direccionRegistro: Address,
  clientes: Pick<ClienteUI, "direccion" | "idCliente">[]
): Promise<InventarioUI | null> {
  const direccion = pdaInventario(direccionRegistro);
  const cuenta = await fetchMaybeInventario(rpc, direccion);
  if (!cuenta.exists) return null;

  const productos = cuenta.data.productos.length
    ? await fetchAllProducto(rpc, cuenta.data.productos)
    : [];
  const historiales = await Promise.all(
    clientes.map(async (cliente) => ({
      idCliente: cliente.idCliente,
      cuenta: await fetchMaybeHistorialVentasV2(
        rpc,
        pdaHistorialVentasV2(cliente.direccion)
      ),
    }))
  );
  const ventasPorCliente = await Promise.all(
    historiales.map(async ({ idCliente, cuenta: historial }) => ({
      idCliente,
      ventas: historial.exists && historial.data.ventas.length
        ? await fetchAllVentaInventario(rpc, historial.data.ventas)
        : [],
    }))
  );

  return {
    direccion,
    siguienteIdVenta: cuenta.data.siguienteIdVenta,
    productos: productos.map((producto) => ({
      direccion: producto.address,
      sku: producto.data.sku,
      descripcion: producto.data.descripcion,
      precioUnitario: producto.data.precioUnitario,
      stock: producto.data.stock,
      activo: producto.data.activo,
    })),
    ventas: ventasPorCliente.flatMap(({ idCliente, ventas }) =>
      ventas.map((venta) => ({
        direccion: venta.address,
        idVenta: venta.data.idVenta,
        idCliente,
        sku: venta.data.sku,
        descripcion: venta.data.descripcion,
        cantidad: venta.data.cantidad,
        precioUnitario: venta.data.precioUnitario,
        total: venta.data.total,
      }))
    ),
  };
}
