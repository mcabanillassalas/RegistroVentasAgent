# Plan: integracion del Taller 1 en RegistroVentasAgent

## 1. Objetivo

Crear la nueva version de `RegistroVentasAgent` con un agente de terminal llamado
`REGISTRO_RESUMEN_NEGOCIO`, capaz de consultar en Solana Devnet el estado activo
del registro, sus clientes y sus ventas V1.

El agente sera exclusivamente de lectura. No utilizara la clave privada de la
autoridad, no enviara instrucciones on-chain, no transferira activos y no expone
operaciones de escritura.

Este plan describe la integracion del Taller 1 en `RegistroVentasAgent`, separada
del repositorio original `RegistroVentas`. El backend tiene su propio Program
ID y un `declare_id!` sincronizado; el agente de solo lectura ya esta
implementado y su consulta en Devnet y llamada a la herramienta con Groq fueron
validadas.

## 2. Estado al 26 de noviembre de 2026

- `backend/src/lib.rs` conserva V1, agrega Inventario V2 y declara el nuevo
  Program ID `sACWDfMgns6EKMENP9L9RqnYnY7aANZLU8xHWhaWG2k`.
- El despliegue de este programa en Devnet fue confirmado en la transacción
  `3oHim4Ez7dc8MsWkcxJENifJXDhKyHutbs5UvGqkHKp87ybsDsRFdS9muL9QSgoTjWhHmjAQZ99hMqSNZyhW6wXH`
  ([Explorer](https://explorer.solana.com/tx/3oHim4Ez7dc8MsWkcxJENifJXDhKyHutbs5UvGqkHKp87ybsDsRFdS9muL9QSgoTjWhHmjAQZ99hMqSNZyhW6wXH?cluster=devnet)).
- `frontend/idl.json`, `frontend/src/config/programa.json` y el cliente Codama
  generado están sincronizados con ese Program ID.
- `frontend/src/solana/pdas.ts` deriva las PDAs existentes.
- `agent/` ya esta adaptado al alcance del Taller 1: se retiraron los plugins
  heredados de Binance, tokens, NFTs y exploracion general, y se implemento la
  consulta de solo lectura de cuentas V1.
- El agente tiene configuracion separada en `.env.taller1`; el `.env` heredado
  se conserva intacto, se ignora en Git y no se carga.
- `npm run typecheck` y `npm test` pasan. La lectura directa en Devnet encontró
  `Cafe WayLearn D1`, un cliente y una venta V1 activa por 50 unidades.
- El modelo Groq `openai/gpt-oss-120b` respondió correctamente a una consulta y
  usó la herramienta `REGISTRO_RESUMEN_NEGOCIO`.

## 3. Alcance de esta fase

### Incluye

- Crear o confirmar un despliegue Devnet nuevo del programa.
- Actualizar `declare_id!`, el build, el IDL y el cliente Codama.
- Limpiar `agent/` para conservar solo la integracion de consulta.
- Agregar una tool que consulte `Registro -> Cliente -> Venta` por Devnet.
- Agregar una action `REGISTRO_RESUMEN_NEGOCIO`.
- Configurar las variables `NEGOCIO`, `OWNER`, `RPC_URL` y seleccionar mediante
  `LLM_MODE` entre local (LM Studio) y online; en modo online elegir OpenAI o
  Groq con `LLM_PROVIDER`.
- Verificar la lectura directa sin IA.
- Comparar la respuesta del modelo contra el JSON real.
- Documentar instalacion, ejecucion, prueba y evidencias.

### No incluye

- Cambiar Rust o agregar nuevas instrucciones on-chain.
- Exponer operaciones V2 en el agente.
- Exponer escritura, transferencia de SOL, transferencias de tokens o keypairs.
- Copiar `.env`, frases de recuperacion, claves privadas o credenciales.
- Tratar `monto_total` como facturacion historica o saldo de una wallet.

## 4. Identidad y despliegue nuevo

### 4.1 Crear identidad nueva

1. Generar una identidad nueva del programa solo si no existe una ya definida
   para esta entrega.
2. Obtener su Program ID y conservar el keypair fuera de Git.
3. Verificar que no sea el Program ID heredado.
4. Reemplazar el valor actual de `declare_id!` en `backend/src/lib.rs`.

La autoridad del negocio y la autoridad del programa son conceptos distintos:

- `OWNER` identifica la wallet que crea el `Registro` y participa en su PDA.
- El Program ID identifica el programa desplegado.
- No deben confundirse ni sustituirse entre si.

### 4.2 Compilar y desplegar

1. Confirmar que el codigo compile con el nuevo `declare_id!`.
2. Desplegar como programa nuevo en Solana Devnet.
3. Guardar la firma de despliegue y verificar el Program ID en Solana Explorer.
4. Exportar el IDL generado por ese despliegue.
5. No reutilizar cuentas ni PDAs del despliegue anterior.
6. Crear desde el frontend un registro nuevo asociado al nuevo Program ID.

La cuenta de autoridad utilizada para desplegar no debe convertirse en la clave
del agente. Las lecturas usaran una wallet efimera creada en memoria.

### 4.3 Sincronizar frontend e IDL

Desde `frontend/`:

1. Guardar temporalmente el IDL exportado fuera de rutas versionadas o dentro
   de una carpeta temporal ignorada.
2. Ejecutar:
   `npm run configurar:idl -- ./ruta/al-idl.json --program-id NUEVO_PROGRAM_ID`
   solo si el IDL no identifica correctamente el nuevo programa.
3. Ejecutar `npm run cliente`.
4. Ejecutar `npm run comprobar:idl`.
5. Verificar que `REGISTRO_PROGRAM_ADDRESS` del cliente coincide con el nuevo
   Program ID.
6. Verificar que `frontend/src/config/programa.json` tenga el nuevo valor y
   `"esReferencia": false`.
7. Ejecutar `npm run verificar`.

El cliente generado no debe editarse manualmente. Cualquier cambio posterior
del contrato requiere regenerar el IDL y el cliente.

## 5. Mapa objetivo del agente

### 5.1 Jerarquia V1

- Cuenta raiz: `Registro`
- Seeds: `[b"registro", nombreNegocio, owner]`
- Campo hijo: `Registro.clientes`
- Cuenta hija: `Cliente`
- Seeds: `[b"cliente", registro, idCliente.to_le_bytes()]`
- Campo hijo: `Cliente.historial`
- Cuenta nieta: `Venta`
- Seeds: `[b"venta", cliente, sku]`

### 5.2 Variables de entorno

- `NEGOCIO`: nombre exacto del registro, incluyendo mayusculas y espacios.
- `OWNER`: wallet publica usada por el despliegue nuevo al crear el registro.
- `RPC_URL`: endpoint Devnet accesible desde el proceso Node.
- `LLM_MODE`: `local` para LM Studio o `online` para un proveedor remoto.
- `LLM_PROVIDER`: `openai` o `groq` cuando `LLM_MODE=online`; si se omite, se
  usa OpenAI.
- En modo `local`: `LLM_BASE_URL`, `LLM_MODEL` y `LLM_API_KEY`.
- En modo `online` con OpenAI: `OPENAI_API_KEY` y opcionalmente `OPENAI_MODEL`
  (por defecto, `gpt-4o-mini`).
- En modo `online` con Groq: `GROQ_API_KEY` y opcionalmente `GROQ_MODEL` (por
  defecto, `openai/gpt-oss-120b`, compatible con tool calling).

Las claves `OPENAI_API_KEY`, `GROQ_API_KEY` y `LLM_API_KEY` nunca deben aparecer
en archivos versionados ni en capturas. En modo online, las consultas y los
datos devueltos por la tool se envian al proveedor seleccionado.

### 5.3 Datos que devuelve la tool

- `existe`
- `motivo`, si el registro no existe
- `negocio`
- `direccion`
- `total_clientes`
- `total_ventas_activas`
- `monto_total`
- `mejor_cliente`
- detalle de cada cliente
- ventas V1 activas de cada cliente

La tool no debe sumar en el modelo: todas las cuentas y calculos se realizan
en TypeScript.

## 6. Estructura objetivo de `agent/`

Se conservara la carpeta ya integrada y se eliminara del flujo activo todo
plugin que no pertenezca al Taller 1:

```text
RegistroVentasAgent/
├── backend/
├── frontend/
├── agent/
│   ├── .env.example
│   ├── .env.taller1 (local, ignorado)
│   ├── .gitignore
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── agent.ts
│       ├── prueba.ts
│       └── plugins/
│           └── registro-ventas/
│               ├── index.ts
│               ├── actions/
│               │   └── resumenNegocio.ts
│               └── tools/
│                   └── resumenNegocio.ts
├── plan.md
└── README.md
```

El archivo `.env` heredado no se modifica ni se carga. La configuracion de este
taller se guarda en `.env.taller1`, ignorado por Git.

## 7. Implementacion por fases

### Fase A: limpieza y configuracion independiente

1. Proteger `agent/.env` actual sin leerlo, copiarlo ni modificarlo.
2. No cargar claves privadas ni credenciales heredadas desde ese archivo.
3. Eliminar del `agent.ts` activo Binance, Solana manager y demas plugins.
4. Crear `agent/.env.example` sin secretos.
5. Crear `agent/.gitignore` con `node_modules/`, `.env` y `.env.taller1`.
6. Configurar un paquete Node independiente con ESM y `tsx`.
7. Mantener dependencias de LangChain, Solana kit, web3.js, dotenv y zod.
8. Cargar solo `.env.taller1` para evitar importar variables del `.env`
   heredado.

### Fase B: crear el plugin de Registro de Ventas

1. Crear `src/plugins/registro-ventas/tools/resumenNegocio.ts`.
2. Importar desde `frontend/clients/js/src/generated/`:
   `fetchMaybeRegistro`, `fetchAllCliente` y `fetchAllVenta`.
3. Importar `pdaRegistro` desde `frontend/src/solana/pdas.ts`.
4. Convertir `Address` a los tipos adecuados de `@solana/kit`.
5. Crear el RPC con `agent.connection.rpcEndpoint`.
6. Derivar la PDA usando nombre y owner.
7. Consultar el registro con `fetchMaybeRegistro`.
8. Si no existe, devolver `{ existe: false, motivo }`.
9. Recorrer los clientes desde `registro.data.clientes`.
10. Leer las ventas activas desde `cliente.data.historial`.
11. Calcular:
    - total de clientes
    - total de ventas activas
    - monto total de esas ventas
    - mejor cliente por `compras`
12. Devolver direcciones y campos como strings simples.
13. No usar objetos Codama ni discriminadores dentro del JSON final.

No se deben leer `Inventario`, `Producto`, `HistorialVentasV2` ni
`VentaInventario` para la tool base del Taller 1.

### Fase C: definir la action

1. Crear `actions/resumenNegocio.ts`.
2. Registrar el nombre exacto `REGISTRO_RESUMEN_NEGOCIO`.
3. Indicar que consulta el estado activo y que no representa ventas historicas.
4. Usar `z.object({})`, porque las seeds vienen de `.env`.
5. Implementar el handler con `status: "success"` o `status: "error"`.
6. Crear `plugins/registro-ventas/index.ts`.
7. Registrar solo el metodo y la action del plugin.

### Fase D: adaptar el agente ReAct

1. Crear una wallet temporal con `Keypair.generate()`.
2. No leer ni solicitar `SOLANA_PRIVATE_KEY`.
3. Inicializar `SolanaAgentKit` con el RPC Devnet.
4. Registrar solamente `RegistroVentasPlugin`.
5. Configurar `ChatOpenAI` desde `LLM_MODE` y `LLM_PROVIDER`, validando LM
   Studio local y las API en linea de OpenAI y Groq.
6. Crear el agente ReAct con una herramienta y MemorySaver.
7. Indicar al modelo que debe llamar la tool y no inventar datos.
8. Preservar el comportamiento de empates y cero ventas.
9. Responder en espanol.

## 8. Tipos y conversiones

Los campos V1 confirmados son:

- `idCliente`: `u16`, number.
- `compras`: `u16`, number.
- `idCounter`: `u16`, number.
- `monto`: `u32`, number.
- nombres, SKU y descripcion: string.
- direcciones: `Address` de `@solana/kit`.

No hay montos V1 como `bigint`. Si se amplian las herramientas a campos V2,
se debera revisar especialmente `u64` y convertirlos conservando precision
antes de serializarlos.

La salida de la tool debe ser JSON serializable. Cada direccion se convertira
mediante `toBase58()` o se conservara como string de Codama segun el tipo real
de la cuenta.

## 9. Validacion obligatoria

### 9.1 Validacion local

Dentro de `agent/`:

1. `npm install`
2. `npm run typecheck`
3. `npm test`
4. `npm run prueba` (requiere `.env.taller1` y un registro creado en Devnet)

La prueba directa debe devolver:

- `existe: true`
- el nombre exacto del negocio
- la direccion del nuevo registro
- el numero real de clientes
- el numero real de ventas V1 activas
- el monto calculado
- el mejor cliente segun `compras`

Si `existe: false`, revisar antes de continuar:

- nombre exacto de `NEGOCIO`
- valor exacto de `OWNER`
- RPC configurado
- nuevo Program ID
- existencia real de la cuenta en Devnet

### 9.2 Validacion del modelo

Ejecutar `npm start` y contrastar estas preguntas:

- ¿Cuantos clientes tiene mi negocio?
- ¿Cuantas ventas activas hay y cuanto suman?
- ¿Que ventas tiene el cliente con ID existente?
- ¿Que cliente tiene mas ventas activas?
- ¿Cual es la direccion del registro?

Se debe verificar que:

- el modelo solicite `REGISTRO_RESUMEN_NEGOCIO`
- el JSON mostrado sea igual al obtenido por `prueba.ts`
- no se inventen datos
- los empates se presenten sin un ganador unico
- cero ventas no produzca un cliente destacado

### 9.3 Casos de prueba

1. Registro existente con al menos un cliente y una venta activa.
2. Nombre de negocio inexistente.
3. Autoridad incorrecta.
4. RPC inaccesible.
5. Modelo seleccionado sin soporte real de tool calling (local o OpenAI).
6. Cambio de monto V1 desde el frontend y nueva consulta directa.
7. Devolucion V1 en el frontend y comprobacion de que la venta deja de contar.

Los casos de cambio deben realizarse solo con cuentas temporales y con la
confirmacion del usuario.

## 10. Evidencias

Conservar, sin secretos:

- captura o archivo de texto de `prueba.ts`
- captura de las preguntas al agente
- firma o enlace al despliegue nuevo
- captura del IDL o cliente verificando el nuevo Program ID
- resultado del caso sin registro
- resultado de una devolucion o cambio de monto si se realiza
- evidencia del modelo cargado en LM Studio o de la seleccion de OpenAI/Groq, sin
  mostrar claves ni datos de autenticacion
- capturas de terminal de `tsc`, prueba directa y agente

No conservar en Git ni adjuntar en las evidencias:

- `agent/.env`
- claves privadas
- keypairs del programa
- keypairs de wallet
- API keys
- frases de recuperacion

## 11. Documentacion final

Actualizar:

- `README.md` del repositorio con los dos flujos de instalacion:
  frontend/backend y agente.
- `agent/README.md` con variables, ejecucion y alcance de lectura.
- `mejoras-funcionales.md` solo si se documenta una mejora adicional real.
- `.gitignore` para excluir `.env`, node_modules, dist, target y temporales.

Registrar explicitamente que `RegistroVentasAgent` usa un nuevo Program ID y
que no espera compartir cuentas con `RegistroVentas`.

## 12. Criterios de aceptacion

- Existe un despliegue Devnet nuevo con un Program ID distinto del original.
- `declare_id!`, IDL, Codama y `programa.json` usan el mismo Program ID.
- `agent/` ya no activa plugins de trading o escritura.
- `npm run typecheck` y `npm test` pasan desde `agent/`.
- La prueba directa obtiene los datos reales del registro Devnet configurado en
  `.env.taller1`.
- La action aparece como `REGISTRO_RESUMEN_NEGOCIO`.
- El modelo usa la tool en lugar de inventar datos.
- Los totales coinciden con clientes y ventas V1 activos.
- El caso sin registro comunica inexistencia sin inventar resultados.
- El repositorio no incluye secretos ni variables reales.
- README y evidencias permiten reproducir la integracion.

Estado de ejecución (26 de noviembre de 2026): la lectura directa y la llamada
del agente a Groq se completaron correctamente con el registro Devnet del
usuario. La configuración privada permanece local y no se documenta aquí.

