# Evidencias del Taller 1 - RegistroVentasAgent

Fecha de corte: 26 de noviembre de 2026.

Este documento separa lo que ya fue comprobado de lo que todavía debe
registrarse. No se utiliza LM Studio: la evidencia se realiza con Groq, que fue
el proveedor compatible con tool calling configurado para este proyecto.

## Información del despliegue

- Proyecto: `RegistroVentasAgent`
- Red: Solana Devnet
- Program ID: `4WhJ2JE9sAWfhojrb4UYTA72FuEAPoJXkLeoT3mAiArv`
- Modelo probado: `openai/gpt-oss-120b`
- Proveedor probado: Groq
- Registro consultado: `Cafe WayLearn D1`
- Dirección del registro:
  `AfdeVrAE5GWvpYFK4FCKvErRYq4rneh6WFvJMtkGk2Qc`
- Evidencia visual de build y deploy:
  `evidencias_taller1/build.png`
  y `evidencias_taller1/deploy.png`
- Evidencia visual de registros:
  `evidencias_taller1/registros.png`
- Evidencia visual del agente:
  `evidencias_taller1/agente-interaccion-1.png`
- Transcripción completa:
  `evidencias_taller1/agente-interaccion.md`

## Evidencias completadas

### 1. Despliegue nuevo

Estado: completado.

- El backend declara el nuevo Program ID.
- Se generó y verificó el build.
- Se completó el deploy en Solana Devnet.
- Las capturas se conservan en `evidencias_taller1/build.png` y
  `evidencias_taller1/deploy.png`.

### 2. Sincronización de IDL y cliente

Estado: completado.

- Se importó el IDL exportado.
- Se regeneró el cliente Codama.
- `frontend/idl.json`, `frontend/src/config/programa.json` y el cliente generado
  contienen el mismo Program ID.
- El build y las pruebas del frontend pasaron.

### 3. Preparación e instalación del agente

Estado: completado.

Comprobaciones ejecutadas desde `agent/`:

```powershell
npm install
npm run typecheck
npm test
```

Resultados:

- `npm run typecheck`: sin errores.
- `npm test`: 7 pruebas aprobadas y 0 fallidas.
- Las pruebas cubren configuración de Groq, configuración local, empates y
  ausencia de ventas.

No se realizó ni se requiere LM Studio. El modelo probado fue Groq
`openai/gpt-oss-120b`.

### 4. Consulta directa sin modelo

Estado: completado.

Comando:

```powershell
npm run prueba
```

La herramienta devolvió `existe: true` y consultó datos reales de Devnet:

- Negocio: `Cafe WayLearn D1`
- Clientes: 2
- Ventas V1 activas: 2
- Monto total: 100 unidades
- Bodega Don Pepe: 1 venta activa por 50 unidades
- Ana Torroja: 1 venta activa por 50 unidades
- Resultado: empate entre ambos clientes

Esta lectura confirma que no se inventaron datos y que la suma se calcula en
TypeScript desde las cuentas consultadas.

### 5. Interacción del agente con Groq

Estado: completado.

Comando:

```powershell
npm start
```

Se verificaron estas respuestas:

- El negocio tiene 2 clientes.
- Hay 2 ventas activas.
- Las ventas suman 100 unidades.
- Bodega Don Pepe tiene una venta activa por 50 unidades.
- Ana Torroja tiene una venta activa por 50 unidades.
- Los dos clientes empatan como mejor cliente.

La transcripción está en
`evidencias_taller1/agente-interaccion.md`.

### 6. Alcance de solo lectura

Estado: completado.

- Se registró únicamente el plugin `RegistroVentasPlugin`.
- Se retiraron plugins de trading, tokens, NFTs y administración.
- El agente no usa clave privada ni envía instrucciones on-chain.
- La identidad temporal creada en memoria sirve únicamente para inicializar el
  SDK.

## Evidencias pendientes

Las pruebas pendientes deben realizarse únicamente con cuentas temporales.
No publiques secretos, API keys, `.env.taller1`, keypairs ni frases de
recuperación en las capturas.

### A. Pregunta sobre las ventas de un cliente existente

Estado: pendiente.

Objetivo: comprobar que el modelo identifica las ventas del cliente con
`idCliente` existente y no inventa resultados.

Pasos:

1. Desde `agent/`, ejecuta `npm start`.
2. Pregunta:
   `¿Qué ventas activas tiene el cliente con ID 1?`
3. Verifica contra `npm run prueba` que la respuesta corresponda a:
   - Bodega Don Pepe.
   - `CAF01`: Café americano.
   - monto activo: 50 unidades.
4. Conservar una captura que muestre la pregunta y la respuesta.

Resultado esperado: el agente identifica únicamente la venta activa consultada
para el cliente 1. No debe mostrar ventas históricas ni movimientos del frontend.

Archivo sugerido:
`evidencias_taller1/agente-cliente-id.png`

### B. Pregunta por la dirección del registro

Estado: pendiente.

Pasos:

1. Ejecuta `npm start`.
2. Pregunta:
   `¿Cuál es la dirección de mi registro?`
3. Compara la respuesta con:
   `AfdeVrAE5GWvpYFK4FCKvErRYq4rneh6WFvJMtkGk2Qc`
4. Conservar una captura sin ocultar la dirección pública.

Resultado esperado: la dirección debe ser exactamente la devuelta por
`REGISTRO_RESUMEN_NEGOCIO`.

Archivo sugerido:
`evidencias_taller1/agente-direccion-registro.png`

### C. Caso sin registro

Estado: pendiente.

Objetivo: comprobar que el agente no inventa clientes ni totales cuando el
nombre no corresponde a un registro existente.

Pasos:

1. Haz una copia de seguridad temporal de `.env.taller1`.
2. Cambia únicamente `NEGOCIO` por un nombre comprobablemente inexistente,
   por ejemplo `Negocio Inexistente Taller 1`.
3. Conserva el mismo `OWNER` y `RPC_URL`.
4. Ejecuta:

```powershell
npm run prueba
```

Resultado directo esperado:

```json
{
  "existe": false
}
```

5. Ejecuta `npm start` y pregunta:
   `¿Cuántos clientes tiene mi negocio?`
6. Verifica que comunique que no existe el registro y que no presente clientes,
   ventas ni monto.
7. Restaura inmediatamente el `NEGOCIO=Cafe WayLearn D1` original.
8. Ejecuta otra vez `npm run prueba` para confirmar que la lectura válida volvió.

Conservar el texto de la prueba directa y una captura de la conversación, sin
mostrar API keys ni el archivo `.env.taller1`.

Archivos sugeridos:

- `evidencias_taller1/prueba-sin-registro.txt`
- `evidencias_taller1/agente-sin-registro.png`

### D. Caso con autoridad incorrecta

Estado: pendiente.

Objetivo: confirmar que el nombre y la autoridad forman la misma semilla usada
por el programa.

Pasos:

1. Guarda una copia temporal del `.env.taller1`.
2. Cambia temporalmente `OWNER` por una dirección pública válida pero que no sea
   la autoridad del registro.
3. Conserva el `NEGOCIO` original y el RPC de Devnet.
4. Ejecuta `npm run prueba`.
5. Registra el resultado `existe: false` y el motivo.
6. Restaura el `OWNER` original.
7. Ejecuta nuevamente `npm run prueba` y confirma `existe: true`.

No uses una clave privada ni publiques el contenido completo del archivo.
`OWNER` es una dirección pública, no una clave privada ni el Program ID.

Archivos sugeridos:

- `evidencias_taller1/prueba-owner-incorrecto.txt`
- `evidencias_taller1/restauracion-owner.txt`

### E. Caso con RPC inaccesible

Estado: pendiente.

Objetivo: confirmar el comportamiento ante una falla de conexión.

Pasos:

1. Guarda una copia temporal del `.env.taller1`.
2. Cambia temporalmente `RPC_URL` por una dirección válida en formato pero
   inaccesible, por ejemplo un puerto local sin servidor:
   `http://127.0.0.1:9999`.
3. Ejecuta `npm run prueba`.
4. Conserva el mensaje de error o interrupción de conexión.
5. Restaura `RPC_URL=https://api.devnet.solana.com`.
6. Ejecuta `npm run prueba` y confirma nuevamente `existe: true`.

No modifiques permanentemente el archivo ni captures API keys.

Archivos sugeridos:

- `evidencias_taller1/prueba-rpc-inaccesible.txt`
- `evidencias_taller1/restauracion-rpc.txt`

### F. Cambio de monto V1

Estado: pendiente.

Objetivo: demostrar que la lectura responde al nuevo estado activo después de
modificar una venta desde el frontend.

Requisitos previos:

- Usar una wallet de prueba.
- Usar una cuenta temporal creada para esta evidencia.
- Tener SOL de prueba.
- La operación de escritura debe hacerse desde el frontend.

Pasos:

1. Desde el frontend, abre una venta V1 temporal y registra el monto anterior.
2. Ejecuta `npm run prueba` desde `agent/` y guarda el monto antes del cambio.
3. Desde el frontend, cambia el monto de la venta V1.
4. Firma y espera la confirmación de la transacción.
5. Abre la transacción en Solana Explorer Devnet y conserva el enlace.
6. Ejecuta nuevamente `npm run prueba`.
7. Confirma que `monto_total` y el monto de la venta cambien al nuevo valor.
8. Opcionalmente ejecuta `npm start` y pregunta:
   `¿Cuánto suman las ventas activas?`
9. Conserva el resultado de ambas consultas.

Resultado esperado: el monto cambia, pero los totales de clientes y cantidad de
ventas activas permanecen iguales si no se creó ni devolvió ninguna venta.

Archivos sugeridos:

- `evidencias_taller1/monto-v1-antes.txt`
- `evidencias_taller1/monto-v1-despues.txt`
- `evidencias_taller1/monto-v1-explorer.txt`
- `evidencias_taller1/agente-monto-v1.png`

### G. Devolución V1

Estado: pendiente.

Objetivo: comprobar que una devolución elimina la venta del estado activo y
modifica los totales consultados.

Requisitos previos:

- Crear una venta V1 temporal.
- Usar una wallet de prueba y confirmar la transacción.
- No probar con datos reales o importantes.

Pasos:

1. Ejecuta `npm run prueba` y guarda el número de ventas y el monto anteriores.
2. Desde el frontend, devuelve la venta V1 temporal.
3. Confirma la operación y espera la confirmación on-chain.
4. Conserva la firma o enlace de Explorer.
5. Ejecuta nuevamente `npm run prueba`.
6. Confirma que:
   - disminuya `total_ventas_activas`;
   - disminuya `monto_total`;
   - la venta devuelta ya no aparezca en el cliente;
   - el mejor cliente se recalcule según las ventas activas restantes.
7. Opcionalmente pregunta al agente:
   `¿Cuántas ventas activas hay y cuánto suman?`

Archivos sugeridos:

- `evidencias_taller1/devolucion-v1-antes.txt`
- `evidencias_taller1/devolucion-v1-despues.txt`
- `evidencias_taller1/devolucion-v1-explorer.txt`
- `evidencias_taller1/agente-devolucion-v1.png`

### H. Estado sin ventas activas

Estado: parcialmente cubierto por pruebas unitarias y pendiente on-chain si se
desea conservar evidencia adicional.

La prueba automatizada verifica que no se declare mejor cliente cuando todas las
compras son cero. Para evidenciarlo on-chain:

1. Usa el registro y cuentas temporales.
2. Devuelve todas las ventas V1 activas del cliente temporal.
3. Ejecuta `npm run prueba`.
4. Verifica `total_ventas_activas: 0`, `monto_total: 0` y ausencia de
   `mejor_cliente` destacado según la implementación real.
5. Pregunta al agente:
   `¿Qué cliente tiene más ventas activas?`
6. Conserva la respuesta indicando que no existe un ganador único.

Archivo sugerido:
`evidencias_taller1/prueba-sin-ventas.txt`

## Seguridad de las evidencias

Antes de subir o entregar imágenes y textos:

- No adjuntes `.env`, `.env.taller1` ni archivos de configuración con secretos.
- No adjuntes API keys, tokens de proveedor ni frases de recuperación.
- No adjuntes keypairs de programa o wallet.
- Confirma que las direcciones visibles sean públicas y correspondan a cuentas
  temporales o públicas.
- Restaura siempre los valores originales de `NEGOCIO`, `OWNER` y `RPC_URL`
  después de una prueba negativa.
- Ejecuta `npm run prueba` al terminar y confirma que vuelve `existe: true`.

## Criterio de cierre

El Taller 1 tendrá evidencia completa de su recorrido básico cuando este
documento quede actualizado con:

- Capturas o textos de las pruebas pendientes.
- Confirmación del caso sin registro.
- Confirmación del caso con autoridad incorrecta.
- Confirmación del comportamiento ante RPC inaccesible.
- Pregunta al agente sobre un cliente existente.
- Pregunta por la dirección del registro.
- Evidencia opcional del cambio de monto y devolución V1.

LM Studio no forma parte de este plan de evidencia. Groq es el proveedor
online utilizado y documentado.
