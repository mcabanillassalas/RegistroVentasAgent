import type { SolanaAgentKit } from "solana-agent-kit";
import ResumenNegocioAction from "./actions/resumenNegocio.ts";
import { getResumenNegocio } from "./tools/resumenNegocio.ts";

const RegistroVentasPlugin = {
  name: "registro-ventas",
  methods: { getResumenNegocio },
  actions: [ResumenNegocioAction],
  initialize(_agent: SolanaAgentKit) {},
};

export default RegistroVentasPlugin;
