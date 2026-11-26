import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { address, type Address } from "@solana/kit";
import { z } from "zod";

const rutaConfiguracion = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../.env.taller1",
);
let variablesCargadas = false;

const registroSchema = z.object({
  NEGOCIO: z.string().min(1),
  OWNER: z.string().min(1),
  RPC_URL: z.string().url(),
});

const modeloLocalSchema = z.object({
  LLM_MODE: z.literal("local"),
  LLM_BASE_URL: z.string().url(),
  LLM_MODEL: z.string().min(1),
  LLM_API_KEY: z.string().min(1).default("lm-studio"),
});

const modeloOnlineSchema = z.object({
  LLM_MODE: z.literal("online"),
  LLM_PROVIDER: z.literal("openai").optional(),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().min(1).default("gpt-4o-mini"),
});

const modeloGroqSchema = z.object({
  LLM_MODE: z.literal("online"),
  LLM_PROVIDER: z.literal("groq"),
  GROQ_API_KEY: z.string().min(1),
  GROQ_MODEL: z.string().min(1).default("openai/gpt-oss-120b"),
});

const MODELOS_ONLINE = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    schema: modeloOnlineSchema,
  },
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    schema: modeloGroqSchema,
  },
} as const;

function lanzarErrorConfiguracionModelo(issues: z.ZodIssue[]): never {
  const faltantes = issues
    .map((issue) => issue.path.join("."))
    .join(", ");
  throw new Error(`Revisa la configuración del LLM: ${faltantes}.`);
}

function parsearModeloLocal(variables: NodeJS.ProcessEnv): ConfiguracionModelo {
  const resultado = modeloLocalSchema.safeParse(variables);
  if (!resultado.success) lanzarErrorConfiguracionModelo(resultado.error.issues);

  return {
    provider: "local",
    baseUrl: resultado.data.LLM_BASE_URL,
    model: resultado.data.LLM_MODEL,
    apiKey: resultado.data.LLM_API_KEY,
  };
}

function parsearModeloOpenAI(
  variables: NodeJS.ProcessEnv,
): ConfiguracionModelo {
  const resultado = MODELOS_ONLINE.openai.schema.safeParse(variables);
  if (!resultado.success) lanzarErrorConfiguracionModelo(resultado.error.issues);

  return {
    provider: "openai",
    baseUrl: MODELOS_ONLINE.openai.baseUrl,
    model: resultado.data.OPENAI_MODEL,
    apiKey: resultado.data.OPENAI_API_KEY,
  };
}

function parsearModeloGroq(variables: NodeJS.ProcessEnv): ConfiguracionModelo {
  const resultado = MODELOS_ONLINE.groq.schema.safeParse(variables);
  if (!resultado.success) lanzarErrorConfiguracionModelo(resultado.error.issues);

  return {
    provider: "groq",
    baseUrl: MODELOS_ONLINE.groq.baseUrl,
    model: resultado.data.GROQ_MODEL,
    apiKey: resultado.data.GROQ_API_KEY,
  };
}

const proveedoresOnline = {
  openai: parsearModeloOpenAI,
  groq: parsearModeloGroq,
};

const modeloEnLineaSchema = z.object({
  LLM_MODE: z.literal("online"),
  LLM_PROVIDER: z.enum(["openai", "groq"]).default("openai"),
});

const modeloSeleccionSchema = z.discriminatedUnion("LLM_MODE", [
  modeloLocalSchema,
  modeloEnLineaSchema,
]);

export function cargarVariablesTaller1() {
  if (variablesCargadas) return;

  if (existsSync(rutaConfiguracion)) {
    const resultado = dotenv.config({ path: rutaConfiguracion });
    if (resultado.error) throw resultado.error;
  }
  variablesCargadas = true;
}

export type ConfiguracionRegistro = {
  negocio: string;
  owner: Address;
  rpcUrl: string;
};

export function cargarConfiguracionRegistro(): ConfiguracionRegistro {
  cargarVariablesTaller1();
  const resultado = registroSchema.safeParse(process.env);
  if (!resultado.success) {
    const faltantes = resultado.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(`Revisa las variables de lectura: ${faltantes}.`);
  }

  let owner: Address;
  try {
    owner = address(resultado.data.OWNER);
  } catch {
    throw new Error("OWNER debe ser una dirección pública válida de Solana.");
  }

  return {
    negocio: resultado.data.NEGOCIO,
    owner,
    rpcUrl: resultado.data.RPC_URL,
  };
}

export type ConfiguracionModelo = {
  provider: "local" | "openai" | "groq";
  baseUrl: string;
  model: string;
  apiKey: string;
};

export function parsearConfiguracionModelo(
  variables: NodeJS.ProcessEnv,
): ConfiguracionModelo {
  const seleccion = modeloSeleccionSchema.safeParse(variables);
  if (!seleccion.success) {
    lanzarErrorConfiguracionModelo(seleccion.error.issues);
  }

  if (seleccion.data.LLM_MODE === "local") return parsearModeloLocal(variables);

  return proveedoresOnline[seleccion.data.LLM_PROVIDER](variables);
}

export function cargarConfiguracionModelo(): ConfiguracionModelo {
  cargarVariablesTaller1();
  return parsearConfiguracionModelo(process.env);
}
