# Plan: integracion del Taller 1 en RegistroVentasTaller

## 1. Objetivo

Crear la nueva version de `RegistroVentasTaller` con un agente de terminal llamado
`REGISTRO_RESUMEN_NEGOCIO`, capaz de consultar en Solana Devnet el estado activo
del registro, sus clientes y sus ventas V1.

El agente sera exclusivamente de lectura. No utilizara la clave privada de la
autoridad, no enviara instrucciones on-chain, no transferira activos y no expone
operaciones de escritura.

Este plan parte de que `RegistroVentasTaller` es un proyecto nuevo respecto al
repositorio original `RegistroVentas`, aunque conserve su codigo. El backend ya
se desplego con un Program ID propio y un `declare_id!` sincronizado; el agente
de lectura descrito aqui todavia esta pendiente.

## 2. Estado al 25 de noviembre de 2026

- `backend/src/lib.rs` conserva V1, agrega Inventario V2 y declara el nuevo
  Program ID `sACWDFMgns6EKMENP9L9RqnYnY7aANZLU8xHWhawG2k`.
- El despliegue de este programa en Devnet fue reportado como exitoso por
  Solana Playground.
- `frontend/idl.json`, `frontend/src/config/programa.json` y el cliente Codama
  generado están sincronizados con ese Program ID.
- `frontend/src/solana/pdas.ts` deriva las PDAs existentes.
- La carpeta `agent/` ya contiene una copia adaptada del repositorio
  `WayLearn-Solana-Agent`. Todavia contiene plugins originales de Binance,
  Solana manager y Solana reader, por lo que no esta adaptada al alcance del
  Taller 1.

## 3. Alcance de esta fase

### Incluye

- Crear o confirmar un despliegue Devnet nuevo del programa.
- Actualizar `declare_id!`, el build, el IDL y el cliente Codama.
- Limpiar `agent/` para conservar solo la integracion de consulta.
- Agregar una tool que consulte `Registro -> Cliente -> Venta` por Devnet.
- Agregar una action `REGISTRO_RESUMEN_NEGOCIO`.
- Configurar las variables `NEGOCIO`, `OWNER`, `RPC_URL` y las variables del
  modelo local.
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
- `LLM_BASE_URL`: URL del proveedor compatible con Chat Completions.
- `LLM_MODEL`: identificador exacto del modelo cargado.
- `LLM_API_KEY`: credencial no secreta para LM Studio o secreto externo para
  una API remota.

`LLM_API_KEY` nunca debe aparecer en archivos versionados ni en capturas.

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
RegistroVentasTaller/
├── backend/
├── frontend/
├── agent/
│   ├── .env.example
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

La carpeta `.env` real de `agent/` quedara ignorada por Git.

## 7. Implementacion por fases

### Fase A: limpieza y configuracion independiente

1. Revisar y proteger `agent/.env` actual.
2. No conservar claves privadas ni credenciales heredadas.
3. Eliminar del `agent.ts` activo Binance, Solana manager y demas plugins.
4. Crear `agent/.env.example` sin secretos.
5. Crear `agent/.gitignore` con `node_modules/` y `.env`.
6. Configurar un paquete Node independiente con ESM y `tsx`.
7. Mantener dependencias de LangChain, Solana kit, web3.js, dotenv y zod.

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
5. Configurar el modelo desde `LLM_BASE_URL` y `LLM_MODEL`.
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
2. `npx tsc -p .`
3. `npx tsx src/prueba.ts`

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
5. Modelo cargado sin soporte real de tool calling.
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
- captura de LM Studio mostrando el modelo cargado
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

Registrar explicitamente que `RegistroVentasTaller` usa un nuevo Program ID y
que no espera compartir cuentas con `RegistroVentas`.

## 12. Criterios de aceptacion

- Existe un despliegue Devnet nuevo con un Program ID distinto del original.
- `declare_id!`, IDL, Codama y `programa.json` usan el mismo Program ID.
- `agent/` ya no activa plugins de trading o escritura.
- `npx tsc -p .` pasa desde `agent/`.
- La prueba directa obtiene datos reales del nuevo registro.
- La action aparece como `REGISTRO_RESUMEN_NEGOCIO`.
- El modelo usa la tool en lugar de inventar datos.
- Los totales coinciden con clientes y ventas V1 activos.
- El caso sin registro comunica inexistencia sin inventar resultados.
- El repositorio no incluye secretos ni variables reales.
- README y evidencias permiten reproducir la integracion.

