import { z } from "zod";
import type { SolanaAgentKit } from "solana-agent-kit";
import { getResumenNegocio } from "../tools/resumenNegocio.ts";

const ResumenNegocioAction = {
  name: "REGISTRO_RESUMEN_NEGOCIO",
  description:
    "Consulta en Devnet un resumen de clientes y ventas V1 activas del negocio configurado. No incluye ventas históricas ni Inventario V2 y no realiza escrituras.",
  similes: [
    "resumen del negocio",
    "cuántos clientes tiene mi negocio",
    "cuántas ventas activas hay",
    "mejor cliente por compras activas",
    "dirección de mi registro",
  ],
  examples: [
    [
      {
        input: {},
        output: {
          status: "success",
          result: {
            existe: true,
            negocio: "Tienda Demo",
            total_clientes: 2,
            total_ventas_activas: 3,
            monto_total: 125,
          },
        },
        explanation: "Resumen de cuentas V1 leídas desde Devnet.",
      },
    ],
  ],
  schema: z.object({}),
  handler: async (agent: SolanaAgentKit) => {
    try {
      return { status: "success" as const, result: await getResumenNegocio(agent) };
    } catch (error) {
      return {
        status: "error" as const,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

export default ResumenNegocioAction;
