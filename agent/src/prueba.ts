import { Keypair } from "@solana/web3.js";
import { KeypairWallet, SolanaAgentKit } from "solana-agent-kit";
import {
  cargarConfiguracionRegistro,
  cargarVariablesTaller1,
} from "./configuracion.ts";
import { getResumenNegocio } from "./plugins/registro-ventas/tools/resumenNegocio.ts";

async function main() {
  cargarVariablesTaller1();
  const configuracion = cargarConfiguracionRegistro();
  const wallet = new KeypairWallet(
    Keypair.generate(),
    configuracion.rpcUrl,
  );
  const solanaAgent = new SolanaAgentKit(
    wallet,
    configuracion.rpcUrl,
    {},
  );
  const resumen = await getResumenNegocio(solanaAgent, configuracion);
  console.log(JSON.stringify(resumen, null, 2));
}

main().catch((error: unknown) => {
  console.error(
    "Falló la prueba de lectura directa:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
