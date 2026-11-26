import assert from "node:assert/strict";
import { test } from "node:test";
import { parsearConfiguracionModelo } from "../src/configuracion.ts";

test("configura OpenAI en línea con el modelo predeterminado", () => {
  const configuracion = parsearConfiguracionModelo({
    LLM_MODE: "online",
    OPENAI_API_KEY: "test-key",
  });

  assert.deepEqual(configuracion, {
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    apiKey: "test-key",
  });
});

test("configura LM Studio con el endpoint y modelo local", () => {
  const configuracion = parsearConfiguracionModelo({
    LLM_MODE: "local",
    LLM_BASE_URL: "http://localhost:1234/v1",
    LLM_MODEL: "modelo-local",
  });

  assert.deepEqual(configuracion, {
    provider: "local",
    baseUrl: "http://localhost:1234/v1",
    model: "modelo-local",
    apiKey: "lm-studio",
  });
});

test("configura Groq en línea con el modelo predeterminado", () => {
  const configuracion = parsearConfiguracionModelo({
    LLM_MODE: "online",
    LLM_PROVIDER: "groq",
    GROQ_API_KEY: "groq-test-key",
  });

  assert.deepEqual(configuracion, {
    provider: "groq",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "openai/gpt-oss-120b",
    apiKey: "groq-test-key",
  });
});

test("rechaza el modo OpenAI si falta la API key", () => {
  assert.throws(
    () => parsearConfiguracionModelo({ LLM_MODE: "online" }),
    /OPENAI_API_KEY/,
  );
});

test("rechaza Groq si falta su API key", () => {
  assert.throws(
    () =>
      parsearConfiguracionModelo({
        LLM_MODE: "online",
        LLM_PROVIDER: "groq",
      }),
    /GROQ_API_KEY/,
  );
});
