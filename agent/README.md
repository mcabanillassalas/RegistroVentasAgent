# Agente de consulta de RegistroVentasAgent

Agente de terminal de solo lectura para consultar en Solana Devnet el registro
configurado, sus clientes y sus ventas activas V1. La herramienta disponible es
`REGISTRO_RESUMEN_NEGOCIO`. No consulta Inventario V2 ni representa ventas
históricas o transferencias monetarias.

## Requisitos

- Node.js `>=22.12.0` y npm.
- Un registro V1 creado en Devnet desde el frontend de este proyecto.
- Para modo en línea: una API key de OpenAI o de Groq y un modelo compatible
  con llamadas a herramientas.
- Para modo local: LM Studio, un modelo compatible cargado y su servidor
  compatible con OpenAI activo.

## Instalación y configuración

Desde PowerShell, en la carpeta `agent/`:

```powershell
npm install
Copy-Item .env.example .env.taller1
```

Edita `.env.taller1` con los datos públicos del registro. La configuración de
ejemplo selecciona OpenAI en línea:

```env
NEGOCIO=Nombre exacto del registro
OWNER=Direccion publica que creo el registro
RPC_URL=https://api.devnet.solana.com

LLM_MODE=online
LLM_PROVIDER=openai
OPENAI_API_KEY=tu-api-key-de-openai
OPENAI_MODEL=gpt-4o-mini
```

`NEGOCIO` debe coincidir exactamente con el nombre guardado on-chain y `OWNER`
es la dirección pública de la autoridad del registro, no el Program ID. El
agente carga exclusivamente `.env.taller1`; no carga el `.env` heredado que
pudiera existir en esta carpeta. No se necesita ni se utiliza
`SOLANA_PRIVATE_KEY`.

`LLM_MODE` selecciona `online` o `local`. En modo en línea, `LLM_PROVIDER`
selecciona OpenAI o Groq. Para usar Groq, cambia la configuración online por:

```env
LLM_MODE=online
LLM_PROVIDER=groq
GROQ_API_KEY=tu-api-key-de-groq
GROQ_MODEL=openai/gpt-oss-120b
```

Puedes crear la clave de Groq en [Groq Console](https://console.groq.com/keys).
El modelo predeterminado es `openai/gpt-oss-120b`, compatible con tool calling.
El modelo anterior `llama-3.3-70b-versatile` fue retirado para cuentas
Developer de Groq el 16 de agosto de 2026.
Para cambiar al modo local con LM Studio, reemplaza la configuración del modelo
por:

```env
LLM_MODE=local
LLM_BASE_URL=http://localhost:1234/v1
LLM_MODEL=identificador-exacto-del-modelo-cargado
LLM_API_KEY=lm-studio
```

Las claves `OPENAI_API_KEY` y `GROQ_API_KEY` son secretas; guárdalas solo en
`.env.taller1` y no las agregues a Git. En modo online, el contenido de las
consultas y los resultados de la herramienta se envían al proveedor
seleccionado. Revisa sus límites y condiciones de uso; el acceso a la API de
OpenAI se configura por separado del inicio de sesión de ChatGPT. En modo
local, el endpoint es LM Studio y no se envía el contenido a OpenAI ni a Groq.

## Verificación y ejecución

```powershell
npm run typecheck
npm test
npm run prueba
npm start
```

`npm run prueba` realiza una consulta directa sin modelo y requiere que exista
el registro en Devnet y que `NEGOCIO` y `OWNER` sean correctos. `npm start`
inicia la conversación; escribe `exit` para salir. Ejemplos:

- ¿Cuántos clientes tiene mi negocio?
- ¿Cuántas ventas V1 activas hay y cuánto suman?
- ¿Qué cliente tiene más compras?
- ¿Cuál es la dirección del registro?

## Alcance y seguridad

- Verifica que el RPC sea Devnet y que el programa configurado esté desplegado.
- Lee el registro, las cuentas de clientes y las ventas V1 activas.
- Calcula los totales en TypeScript; un empate se informa sin elegir un ganador
  único y, sin ventas activas, no se declara un mejor cliente.
- Genera una wallet efímera en memoria para inicializar `SolanaAgentKit`; no
  firma transacciones ni envía instrucciones.
- No tiene plugins activos para trading, transferencias, tokens o NFTs.
- `.env.taller1`, `.env` y las dependencias instaladas están excluidos de Git.
