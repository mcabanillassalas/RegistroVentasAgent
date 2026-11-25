# Plan: integracion del Taller 2 en RegistroVentasTaller

## 1. Objetivo

Agregar cashback con **Token-2022** al proyecto `RegistroVentasTaller`,
integrando una recompensa fungible con las operaciones de venta y devolucion
del registro.

El Taller 2 se ejecutara despues de completar `plan-taller1.md`. La integracion
debe conservar el agente creado en el Taller 1 y ampliar el frontend sin
modificar el programa, el IDL ni el cliente Codama generado.

El despliegue debe seguir usando el nuevo Program ID definido por la nueva
version de `RegistroVentasTaller`. No se reutilizara el Program ID ni las
cuentas de la entrega original `RegistroVentas`.

## 2. Estado actual confirmado

- `frontend/src/components/Registro.tsx` administra registro, clientes, ventas
  V1, correccion de montos, devoluciones y baja de clientes.
- `frontend/src/components/Inventario.tsx` administra el inventario V2.
- `frontend/src/App.tsx` tiene vistas para conexion, registro e inventario.
- `frontend/src/solana/acciones.ts` construye las instrucciones originales.
- `frontend/src/solana/tx.ts` proporciona `aWeb3`, `confirmarEnvio`,
  `traducir` y el envio de una instruccion.
- `frontend/src/solana/pdas.ts` deriva las PDAs V1 y V2.
- `frontend/src/solana/validaciones.ts` valida monto como `u32`.
- `frontend/package.json` todavia no incluye `@solana/spl-token` ni
  `@solana/spl-token-metadata`.
- No existe una carpeta `token/` en `RegistroVentasTaller`.
- El agente del Taller 1 no se considera prerequisito tecnico del Taller 2,
  pero el plan completo si exige terminarlo primero para entregar la nueva
  version como una secuencia ordenada.

## 3. Orden obligatorio

Antes de iniciar este plan:

1. Completar y verificar `plan-taller1.md`.
2. Confirmar el nuevo Program ID de `RegistroVentasTaller`.
3. Confirmar que `declare_id!`, IDL, cliente Codama y
   `frontend/src/config/programa.json` coinciden.
4. Tener un registro nuevo con al menos un cliente y una venta disponible.
5. Tener Solflare o otra wallet compatible con Devnet y SOL de prueba.
6. Tener la direccion publica de una segunda wallet para recibir recompensas.
7. Hacer un commit o guardar el avance antes de crear una rama.
8. Crear la rama `taller-2-cashback`.

No se debe empezar con el Program ID, el despliegue o las cuentas heredadas de
`RegistroVentas`.

## 4. Alcance

### Incluye

- Crear un mint Token-2022 con metadata, dos decimales y reserva inicial.
- Configurar MetadataPointer, PermanentDelegate y una freeze authority nula.
- Emitir 1,000,000 tokens visibles a la ATA de reserva del negocio.
- Crear o reutilizar el mint desde la interfaz.
- Guardar mint y porcentaje en `localStorage` asociado a la wallet.
- Registrar una venta y transferir cashback en una sola transaccion.
- Crear idempotentemente la ATA del cliente.
- Consultar el saldo del cliente sin firma.
- Recuperar el cashback en una devolucion mediante PermanentDelegate.
- Mantener el flujo original cuando no se indica wallet de recompensa.
- Verificar atomo, rechazo y reverso en Devnet.
- Documentar riesgos y limitaciones.

### No incluye

- Modificar Rust, el IDL o el cliente generado.
- Modificar `frontend/src/solana/acciones.ts`.
- Implementar CPI on-chain ni calcular el cashback dentro del programa.
- Implementar cobro real, reembolso en SOL o canje monetario.
- Sustituir el recordatorio del taller por pruebas reales en Devnet.
- Transferir claves privadas o frases semilla al repositorio.

## 5. Mapa del proyecto

### Evento de compra

- Instruccion V1: `registrar_venta`.
- Cliente Codama: `getRegistrarVentaInstruction`.
- Importe: `monto: u32`, representado como `number`.
- Formulario: operacion `venta` de `Registro.tsx`.
- Cuentas derivadas: registro, cliente y venta.
- Firmante: wallet del negocio/autoridad del registro.

### Evento de reversión

- Instruccion V1: `hacer_devolucion`.
- Cliente Codama: `getHacerDevolucionInstruction`.
- Cierra la cuenta `Venta`.
- Lee `Venta.monto` antes de cerrar la cuenta.
- Firmante: wallet del negocio/autoridad del registro.
- Delega permanente: permite recuperar tokens desde la ATA del beneficiario
  sin la firma de este.

### Autoridades

- Autoridad del registro: wallet del negocio.
- Mint authority: wallet del negocio.
- Freeze authority: `null`.
- Owner de la ATA de reserva: wallet del negocio.
- Permanent delegate: wallet del negocio.
- Autoridad normal de la ATA del cliente: wallet del cliente.

## 6. Preparacion de carpetas

Se conservara el layout integrado acordado:

```text
RegistroVentasTaller/
├── backend/
├── frontend/
├── agent/
├── token/
├── evidencia/
├── plan-taller1.md
├── plan-taller2.md
├── mejoras-funcionales.md
└── README.md
```

`token/` se utilizara para la copia local de referencia
`Solana-Token-SPL-Template`. Solo se consultara como fuente de funciones.
No se instalaran sus plugins ni se ejecutara como aplicacion independiente.

Las funciones runtime de cashback se integraran en `frontend/src/solana/`, no
en `token/`. De esta forma se reutilizan wallet adapter, Codama, PDPAs,
validaciones y el nuevo Program ID.

## 7. Dependencias

Desde `frontend/`:

```powershell
npm install @solana/spl-token@^0.4.15 @solana/spl-token-metadata@^0.1.6
```

Todas las operaciones de tokens deben usar:

- `TOKEN_2022_PROGRAM_ID`
- `ASSOCIATED_TOKEN_PROGRAM_ID`
- funciones `*Checked` para mint y transfer
- ATA derivada para el mismo mint y programa de tokens

No mezclar el identificador del SPL Token clasico.

## 8. Estructura de archivos objetivo

### Nuevos

- `frontend/src/solana/cashback.ts`
- `frontend/src/solana/lealtad.ts`
- `frontend/src/components/Cashback.tsx`

### Modificados

- `frontend/src/components/Registro.tsx`
- `frontend/src/App.tsx`
- `frontend/package.json`
- `frontend/package-lock.json`
- `README.md` y documentacion de evidencias

### Sin modificar

- `backend/src/lib.rs`
- `frontend/idl.json`
- `frontend/clients/js/src/generated/`
- `frontend/src/solana/acciones.ts`

Si un cambio futuro exige modificar alguno de esos archivos, se detendra la
integracion y se revisara el alcance fuera del Taller 2.

## 9. Implementacion

### Fase A: crear `cashback.ts`

Definir funciones puras que solo construyan instrucciones:

- `DECIMALES = 2`.
- `RESERVA_INICIAL = 1_000_000`.
- `aBase(tokens)`.
- `aTokens(unidadesBase)`.
- `cashbackBase(monto, porcentaje)`.
- `ata(mint, owner)`.
- `tamanoMint(metadata)`.
- `metadataDe(...)`.
- `ixsCrearToken(...)`.
- `ixsCashback(...)`.
- `ixRecuperar(...)`.

Al crear el mint, respetar el orden:

1. `SystemProgram.createAccount`.
2. `createInitializeMetadataPointerInstruction`.
3. `createInitializePermanentDelegateInstruction`.
4. `createInitializeMintInstruction`.
5. `createInitializeInstruction` para metadata.
6. Crear la ATA de reserva de forma idempotente.
7. Ejecutar `mintToChecked`.

El monto de rent debe cubrir el mint de las extensiones mas metadata embebida.

El calculo actual sera seguro para `monto: u32`: usa entero, dos decimales,
redondeo hacia abajo y `bigint` al representar unidades base.

### Fase B: crear `lealtad.ts`

Implementar configuracion en `localStorage`:

- clave: `cashback:<walletNegocio>`
- campos: `mint` y `porcentaje`
- lectura y escritura protegidas ante navegador privado o storage bloqueado

Crear funciones:

- `crearTokenCashback(...)`
- `saldoCashback(...)`
- `registrarVentaConCashback(...)`
- `hacerDevolucionConCashback(...)`

Reutilizar:

- `firmante(wallet)` o el patron equivalente de `acciones.ts`
- `cadena(...)` de `pdas.ts`
- `getRegistrarVentaInstruction`
- `getHacerDevolucionInstruction`
- `fetchMaybeVenta`
- `aWeb3`
- `confirmarEnvio`
- validadores existentes

La venta combinara, en una sola transaccion:

1. instruccion `registrar_venta`
2. ATA idempotente del cliente
3. `transferChecked` desde la reserva

La instruccion del programa debe ser la primera. No enviar cashback en una
segunda transaccion.

Antes de enviar:

- validar porcentaje entre 0 y 100
- rechazar cashback calculado igual a cero
- rechazar una wallet destino igual a la del negocio
- validar una direccion de destino
- comprobar que la reserva alcanza
- comprobar el programa nuevo y Devnet

En la devolucion:

1. leer `Venta.monto` antes de construir la devolucion
2. calcular el cashback usando el porcentaje vigente
3. consultar el saldo actual del cliente
4. recuperar el menor valor entre calculado y disponible
5. incluir la instruccion de devolucion y, si corresponde,
   `ixRecuperar` en la misma transaccion

Si el saldo es cero, ejecutar solamente la devolucion.

### Fase C: crear la vista `Cashback.tsx`

La vista debe permitir:

- crear el mint y la reserva
- mostrar el mint configurado
- mostrar el saldo de reserva
- definir el porcentaje
- pegar el mint de un token ya creado
- consultar el saldo de una wallet sin firma
- mostrar estados, firma y enlace a Explorer
- explicar que PermanentDelegate permite al negocio mover tokens

El mint puede guardarse en `localStorage`; borrar esa configuracion no debe
borrar el mint ni los saldos on-chain.

### Fase D: modificar `Registro.tsx`

Agregar dos estados:

- wallet de recompensa
- mensaje de cashback enviado o recuperado

En venta:

- agregar campo opcional `¿Dónde quieres recibir tu recompensa?`
- si esta vacio, llamar a `registrarVenta` original
- si tiene valor y no existe configuracion, mostrar
  `Configura primero el token en la sección Cashback.`
- si existe configuracion, llamar a
  `registrarVentaConCashback`

En devolucion:

- agregar campo opcional `Wallet que recibió la recompensa`
- si esta vacio, conservar `hacerDevolucion` original
- si tiene valor, usar `hacerDevolucionConCashback`
- mostrar la cantidad recuperada en el aviso de confirmacion

No agregar el beneficiario a la cuenta `Venta`. El taller no conservara un
comprobante on-chain de la relacion venta/cashback.

### Fase E: modificar `App.tsx`

Ampliar el tipo de vista a:

- `conexion`
- `registro`
- `inventario`
- `cashback`

Agregar la seccion `Cashback` al menu, respetando `ocupado` y `soloDia3`.
Integrar el componente sin reemplazar las vistas existentes.

## 10. Validacion local

Desde `frontend/`:

```powershell
npm run verificar
```

El resultado minimo esperado:

- TypeScript sin errores
- pruebas existentes sin fallos
- build exitoso

Mantener el flujo original de ventas sin campo de recompensa como prueba
adicional.

No se considerara verificada la integracion solo por pasar el build.

## 11. Prueba opcional LiteSVM

Es opcional y no sustituye Devnet.

1. Crear `.prueba/cashback.litesvm.test.ts`.
2. Instalar temporalmente `litesvm@1.6.2`.
3. Adaptar el caso de venta a `getRegistrarVentaInstruction`,
   `aWeb3` y `cadena`.
4. Ejecutar la prueba.
5. Eliminar `.prueba/` o ignorarla antes del commit.

Los resultados deben distinguirse de la ejecucion real con el programa
desplegado.

## 12. Prueba completa en Devnet

Usar un mint nuevo y una wallet cliente sin ATA o con saldo conocido.

| Paso | Accion | Verificacion |
|---|---|---|
| 1 | Crear mint y reserva | Mint visible, dos decimales, metadata, PermanentDelegate y 1,000,000 tokens |
| 2 | Fijar porcentaje en 5 % | En la UI una compra de 100 muestra 5 tokens |
| 3 | Registrar venta de monto 45 con wallet cliente | Se crea la venta y se envian 2.25 tokens |
| 4 | Consultar saldo cliente | El saldo muestra 2.25 si inicio en cero |
| 5 | Repetir el mismo cliente/SKU con recompensa | Rechazo por venta duplicada y saldo sin cambio |
| 6 | Devolver la venta indicando el mismo beneficiario | Se cierra Venta y se recuperan hasta 2.25 tokens |
| 7 | Registrar venta sin wallet de recompensa | Funciona el flujo original sin cashback |
| 8 | Probar reserva insuficiente | Rechazo local o red; no confirmar ninguna venta |

En Explorer revisar:

- instruccion de `registrar_venta`
- creacion idempotente de ATA
- `TransferChecked` de Token-2022
- firmante de la wallet del negocio
- cuentas de origen y destino
- estado `err: null`

Identificar si cada rechazo ocurrio por validacion local, simulacion o
ejecucion on-chain.

## 13. Seguridad y limites

- PermanentDelegate permite al negocio mover tokens de cualquier ATA de ese
  mint, no solo en devoluciones.
- La wallet del cliente no firma al recibir ni al recuperar.
- El beneficiario no queda registrado on-chain en la cuenta `Venta`.
- El monto corregido no ajusta cashback ya enviado.
- Cambiar el porcentaje afecta una devolucion futura.
- Cambiar mint, wallet beneficiaria o porcentaje invalida la prueba controlada.
- `localStorage` no es almacenamiento on-chain ni respaldo.
- El cashback no representa SOL ni un reembolso garantizado.
- El programa no exige cashback ni verifica el porcentaje.

Antes de entregar, documentar estas limitaciones sin presentarlas como defectos
ocultos.

## 14. Evidencias

Conservar en `evidencia/`:

- direccion del mint
- transaccion de creacion y emision
- transaccion de venta con cashback
- transaccion de devolucion con recuperacion
- captura de los saldos antes y despues
- captura de la vista Cashback
- captura de la consulta sin firma
- rechazo por duplicado
- rechazo por reserva insuficiente si se prueba
- comando `npm run verificar`
- resultados de LiteSVM si se ejecuta

No incluir:

- `.env`
- claves privadas
- keypairs de mint
- frases semilla
- capturas de credenciales

## 15. Criterios de aceptacion

- `plan-taller1.md` esta completo antes de iniciar.
- `RegistroVentasTaller` usa el nuevo Program ID acordado.
- `frontend/` compila y pasa sus pruebas existentes.
- Existe el mint Token-2022 con metadata y PermanentDelegate.
- La reserva se emitio una sola vez al crear el mint.
- La venta con recompensa usa una unica transaccion.
- La ATA del cliente se crea idempotentemente.
- El monto 45 al 5 % produce 225 unidades base o 2.25 tokens.
- Los rechazos no cambian venta ni saldo.
- La devolucion recupera como maximo el saldo disponible.
- Una venta sin wallet de recompensa conserva el flujo original.
- No se modificaron Rust, IDL, cliente generado ni `acciones.ts`.
- El proyecto explica las limitaciones de configuracion y confianza.
- Las evidencias son reales y no contienen secretos.
