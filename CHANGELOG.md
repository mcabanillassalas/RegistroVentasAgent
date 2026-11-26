# Changelog

Historial acumulado de los cambios principales de `RegistroVentasAgent`.
No incluye claves, configuraciones privadas ni datos del archivo `.env.taller1`.

## 2026-11-26 — Separación del Taller 1 y actualización de identidad

- Se actualizó la documentación y configuración local para el nombre
  `RegistroVentasAgent`.
- Se actualizaron README, planes del Taller 1, nombre del agente, título del
  frontend y nombres de los paquetes npm.
- El remoto GitHub se configuró con el slug nuevo
  `mcabanillassalas/RegistroVentasAgent`.
- Se retiraron `token/` y `plan-taller2.md`, que pertenecen al Taller 2.
  El trabajo futuro de Token-2022 se realizará en una copia separada llamada
  `RegistroVentasToken`.
- Se agregó este archivo para mantener el historial del proyecto.

## 2026-11-25 a 2026-11-26 — Agente de consulta del Taller 1

- Se adaptó `agent/` a una consulta conversacional de solo lectura para cuentas
  `Registro`, `Cliente` y `Venta` V1 en Solana Devnet.
- Se agregó la herramienta `REGISTRO_RESUMEN_NEGOCIO`, con cálculo de ventas
  activas, montos y mejor cliente, incluyendo manejo de empates y ausencia de
  ventas.
- Se retiraron del flujo activo las capacidades heredadas de Binance,
  exploración general, administración de tokens y NFTs.
- Se configuró la lectura de parámetros desde `.env.taller1`, ignorado por Git.
  El agente no requiere ni usa una clave privada de Solana.
- Se añadió selección de proveedor: OpenAI o Groq en modo online y LM Studio en
  modo local.
- Se cambió el modelo predeterminado de Groq a `openai/gpt-oss-120b`, compatible
  con tool calling, tras el retiro de `llama-3.3-70b-versatile` para cuentas
  Developer.
- Se reemplazó el ejemplo de entorno por valores de muestra y placeholders.

## 2026-11-25 — Sincronización del despliegue Devnet

- Se confirmó el despliegue del programa en Devnet con el Program ID
  `4WhJ2JE9sAWfhojrb4UYTA72FuEAPoJXkLeoT3mAiArv`.
- Se corrigió el ID distinto que había quedado en el IDL y el frontend.
- Se regeneró el cliente Codama y se sincronizaron `frontend/idl.json` y
  `frontend/src/config/programa.json` con la dirección desplegada.
- Se actualizaron los documentos de despliegue para distinguir el programa nuevo
  del despliegue anterior y registraron las capturas de build y deploy.

## Fundación conservada

- El backend Anchor mantiene ventas V1 e incorpora Inventario V2 y baja
  condicionada de clientes.
- El frontend React/Vite consulta y administra el programa desplegado en Devnet
  mediante el cliente TypeScript generado.
- El programa y las cuentas de la entrega original `RegistroVentas` se
  mantienen separados de este despliegue.

## Validación registrada

- Frontend: `npm run verificar` — typecheck, 12 pruebas, comprobación IDL y build
  completados correctamente.
- Agente: `npm run typecheck` y `npm test` — 7 pruebas completadas correctamente.
- Lectura Devnet: un cliente y una venta V1 activa por 50 unidades.
- Modelo: Groq respondió usando el resumen consultado por la herramienta.