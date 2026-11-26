import { createSolanaRpc } from "@solana/kit";
import { PublicKey } from "@solana/web3.js";
import type { SolanaAgentKit } from "solana-agent-kit";
import {
  fetchAllCliente,
  fetchAllVenta,
  fetchMaybeRegistro,
  REGISTRO_PROGRAM_ADDRESS,
} from "../../../../../frontend/clients/js/src/generated/index.ts";
import { pdaRegistro } from "../../../../../frontend/src/solana/pdas.ts";
import {
  cargarConfiguracionRegistro,
  type ConfiguracionRegistro,
} from "../../../configuracion.ts";

const DEVNET_GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";

export type VentaResumen = {
  direccion: string;
  sku: string;
  descripcion: string;
  monto: number;
};

export type ClienteResumen = {
  direccion: string;
  idCliente: number;
  nombre: string;
  compras: number;
  total_ventas_activas: number;
  monto_total: number;
  ventas: VentaResumen[];
};

export type ResumenNegocio = {
  existe: true;
  negocio: string;
  direccion: string;
  total_clientes: number;
  total_ventas_activas: number;
  monto_total: number;
  mejor_cliente: {
    compras: number;
    clientes: Pick<ClienteResumen, "direccion" | "idCliente" | "nombre">[];
  } | null;
  clientes: ClienteResumen[];
};

export function construirResumenNegocio(
  negocio: string,
  direccion: string,
  clientes: Omit<ClienteResumen, "total_ventas_activas" | "monto_total">[],
): ResumenNegocio {
  const clientesResumen = clientes.map((cliente) => ({
    ...cliente,
    total_ventas_activas: cliente.ventas.length,
    monto_total: sumarMontos(cliente.ventas),
  }));
  const ventasActivas = clientesResumen.reduce(
    (total, cliente) => total + cliente.total_ventas_activas,
    0,
  );
  const montoTotal = sumarMontos(clientesResumen.flatMap((cliente) => cliente.ventas));
  const comprasMaximas = Math.max(0, ...clientesResumen.map((cliente) => cliente.compras));
  const mejores =
    ventasActivas === 0 || comprasMaximas === 0
      ? null
      : {
          compras: comprasMaximas,
          clientes: clientesResumen
            .filter((cliente) => cliente.compras === comprasMaximas)
            .map(({ direccion: address, idCliente, nombre }) => ({
              direccion: address,
              idCliente,
              nombre,
            })),
        };

  return {
    existe: true,
    negocio,
    direccion,
    total_clientes: clientesResumen.length,
    total_ventas_activas: ventasActivas,
    monto_total: montoTotal,
    mejor_cliente: mejores,
    clientes: clientesResumen,
  };
}

function sumarMontos(ventas: Pick<VentaResumen, "monto">[]): number {
  const total = ventas.reduce((suma, venta) => suma + BigInt(venta.monto), 0n);
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("El monto total excede el rango seguro para JSON.");
  }
  return Number(total);
}

export async function getResumenNegocio(
  agent: SolanaAgentKit,
  configuracion: ConfiguracionRegistro = cargarConfiguracionRegistro(),
) {
  const connection = agent.connection;
  const genesis = await connection.getGenesisHash();
  if (genesis !== DEVNET_GENESIS) {
    throw new Error("La consulta solo está habilitada para Solana Devnet.");
  }

  const programAccount = await connection.getAccountInfo(
    new PublicKey(String(REGISTRO_PROGRAM_ADDRESS)),
    "confirmed",
  );
  if (!programAccount?.executable) {
    throw new Error("El programa Registro no está desplegado en este RPC de Devnet.");
  }

  const direccionRegistro = pdaRegistro(configuracion.negocio, configuracion.owner);
  const rpc = createSolanaRpc(connection.rpcEndpoint);
  const registro = await fetchMaybeRegistro(rpc, direccionRegistro);
  if (!registro.exists) {
    return {
      existe: false as const,
      motivo: "No existe un registro para ese negocio y OWNER en este despliegue.",
      negocio: configuracion.negocio,
      direccion: String(direccionRegistro),
      total_clientes: 0,
      total_ventas_activas: 0,
      monto_total: 0,
      mejor_cliente: null,
      clientes: [],
    };
  }

  if (
    registro.data.nombreNegocio !== configuracion.negocio ||
    String(registro.data.owner) !== String(configuracion.owner)
  ) {
    throw new Error("La cuenta encontrada no coincide con el negocio y OWNER configurados.");
  }

  const cuentasClientes = registro.data.clientes.length
    ? await fetchAllCliente(rpc, registro.data.clientes)
    : [];
  const clientes = await Promise.all(
    cuentasClientes.map(async (cuentaCliente) => {
      const cuentasVentas = cuentaCliente.data.historial.length
        ? await fetchAllVenta(rpc, cuentaCliente.data.historial)
        : [];
      return {
        direccion: String(cuentaCliente.address),
        idCliente: cuentaCliente.data.idCliente,
        nombre: cuentaCliente.data.nombre,
        compras: cuentaCliente.data.compras,
        ventas: cuentasVentas.map((cuentaVenta) => ({
          direccion: String(cuentaVenta.address),
          sku: cuentaVenta.data.sku,
          descripcion: cuentaVenta.data.descripcion,
          monto: cuentaVenta.data.monto,
        })),
      };
    }),
  );

  return construirResumenNegocio(
    registro.data.nombreNegocio,
    String(registro.address),
    clientes,
  );
}
