import * as readline from "node:readline";
import { HumanMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { Keypair } from "@solana/web3.js";
import { KeypairWallet, SolanaAgentKit } from "solana-agent-kit";
import { z } from "zod";
import {
  cargarVariablesTaller1,
  cargarConfiguracionModelo,
  cargarConfiguracionRegistro,
} from "./configuracion.ts";
import RegistroVentasPlugin from "./plugins/registro-ventas/index.ts";
import { getResumenNegocio } from "./plugins/registro-ventas/tools/resumenNegocio.ts";

const SYSTEM_PROMPT = `Eres un asistente en español para consultar el registro de ventas del proyecto RegistroVentasAgent.
Usa siempre REGISTRO_RESUMEN_NEGOCIO para responder preguntas sobre el estado del negocio; no inventes ni calcules datos por tu cuenta.
La acción lee solo clientes y ventas V1 activas. No representa facturación histórica y no incluye Inventario V2.
Si el registro no existe o la herramienta devuelve un error, explícalo claramente.
Si hay empate en mejor_cliente, menciona a todos los clientes empatados. Si no hay ventas activas, indica que no hay un mejor cliente.
No solicites ni utilices claves privadas, no firmes transacciones y no realices operaciones de escritura.`;

async function main() {
  cargarVariablesTaller1();
  const configuracionRegistro = cargarConfiguracionRegistro();
  const configuracionModelo = cargarConfiguracionModelo();
  const wallet = new KeypairWallet(
    Keypair.generate(),
    configuracionRegistro.rpcUrl,
  );
  const solanaAgent = new SolanaAgentKit(
    wallet,
    configuracionRegistro.rpcUrl,
    {},
  ).use(RegistroVentasPlugin);
  const tools = [
    tool(
      async () =>
        JSON.stringify(await getResumenNegocio(solanaAgent, configuracionRegistro)),
      {
        name: "REGISTRO_RESUMEN_NEGOCIO",
        description:
          "Consulta en Devnet el resumen de clientes y ventas V1 activas del negocio configurado. No escribe ni incluye Inventario V2.",
        schema: z.object({}),
      },
    ),
  ];
  const model = new ChatOpenAI({
    model: configuracionModelo.model,
    apiKey: configuracionModelo.apiKey,
    configuration: { baseURL: configuracionModelo.baseUrl },
    temperature: 0,
  });
  const agent = createReactAgent({
    llm: model,
    tools,
    checkpointSaver: new MemorySaver(),
    messageModifier: SYSTEM_PROMPT,
  });
  const readlineInterface = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("Agente RegistroVentasAgent listo. Escribe 'exit' para salir.");
  console.log(
    `Proveedor LLM: ${
      configuracionModelo.provider === "local"
        ? "local"
        : configuracionModelo.provider === "groq"
          ? "Groq"
          : "OpenAI"
    }.`,
  );
  console.log(
    "Acción disponible:",
    solanaAgent.actions.map((action) => action.name).join(", "),
  );

  try {
    for await (const input of readlineInterface) {
      if (input.trim().toLowerCase() === "exit") break;
      if (!input.trim()) continue;

      try {
        const response = await agent.invoke(
          { messages: [new HumanMessage(input)] },
          { configurable: { thread_id: "registro-ventas-agent" } },
        );
        const lastMessage = response.messages.at(-1);
        const content = lastMessage?.content;
        console.log(
          `\nAgente: ${typeof content === "string" ? content : JSON.stringify(content)}\n`,
        );
      } catch (error) {
        console.error(
          "No se pudo completar la consulta:",
          error instanceof Error ? error.message : error,
        );
      }
    }
  } finally {
    readlineInterface.close();
  }
}

main().catch((error: unknown) => {
  console.error(
    "No se pudo iniciar el agente:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});