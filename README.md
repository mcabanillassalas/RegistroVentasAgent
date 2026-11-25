# RegistroVentas

Proyecto educativo de registro de ventas en Solana. Este repositorio reúne los dos proyectos originales del bootcamp:

- **Backend:** programa on-chain en Rust y Anchor. Conserva las cuentas e instrucciones de ventas V1 y añade el modelo V2 de inventario, productos y ventas por cantidad.
- **Frontend:** aplicación React, TypeScript y Vite para consultar los registros y administrar ventas e inventario con una wallet.

El backend no es un servidor HTTP: una vez desplegado, sus instrucciones se ejecutan en Solana. El frontend se ejecuta en el navegador y se conecta al programa mediante un RPC.

**Estado actual (22 de noviembre de 2026):** el programa está desplegado en **Solana Devnet** con el Program ID `4dJoKhvY2XC6WpHv8b7RCHKsTfUpGpELiDjAjf4grcE3`. El upgrade de Inventario V2 se confirmó en el slot `525118972`; la [transacción](https://explorer.solana.com/tx/4T8A3SgWeFvtgYSgQZaRha2BpJj7zDHhhdYt7JqL7gmdWAhigaMc9yV9ooPj1WiKGqNhvr8HxYrAMNzsaqabwNe2?cluster=devnet) indica que actualizó ese mismo Program ID. Se reportó una inicialización exitosa de Inventario V2 desde el frontend. Las operaciones posteriores de catálogo, ventas, ajustes, devoluciones y baja todavía requieren completar pruebas manuales en Devnet.

## Antes y después de las mejoras

**Proyecto de partida:** el registro guiado administra negocios, clientes y ventas V1: crea registros y clientes, registra una venta por SKU activo y cliente, permite corregir el importe y devolver la venta. La versión original utilizada como punto de partida no implementaba la baja de clientes; esta función se añadió a este proyecto.

**Estado actual y mejoras propias:** se conserva ese flujo V1 y se agregaron dos mejoras funcionales en backend y frontend: **Inventario V2**, con productos, existencias, ventas por cantidad, ajustes y devoluciones con reposición; y **baja de clientes**, condicionada a que no existan ventas V1 ni V2 activas. La instrucción V2 se encuentra en el programa actualizado de Devnet y se reportó una inicialización exitosa. Los demás recorridos deben validarse manualmente antes de considerarlos plenamente probados.

## Estructura

```text
RegistroVentas/
├── backend/   # Programa Anchor y cliente de Solana Playground
├── frontend/  # Aplicación React/Vite, IDL y cliente TypeScript
├── .gitignore
├── mejoras-funcionales.md # Diseño y límites de las mejoras funcionales
├── flujograma.md # Pasos de despliegue del backend y conexión del frontend
├── README.md
└── evidencia/ # carpeta de capturas de evidencia
```

## Evidencias

En la carpeta **evidencia** se puede apreciar las capturas de las diversas fases
de la implementacion build, deploy, upgrade. Asi como tambien evidencias de las 
nuevas funcionalidades y registro de las transacciones en Solana Explorer.

## Mejoras funcionales: inventario V2 y baja de clientes

Además del flujo base de registro, clientes y ventas, se implementó una segunda versión del modelo para administrar existencias. La V2 agrega cuentas independientes y conserva el esquema y las instrucciones V1, por lo que las ventas antiguas no se migran ni se reinterpretan como ventas de inventario.

### Catálogo y existencias

- Inicializa un inventario asociado a un registro existente.
- Crea productos con SKU, descripción, precio unitario, stock inicial y estado activo/inactivo. El SKU debe caber en 5 bytes UTF-8 y la descripción en 50 bytes; cada inventario admite hasta 20 productos.
- Permite reabastecer productos activos. La suma de stock se valida para evitar desbordamientos.
- Permite actualizar descripción, precio para ventas futuras y estado del producto. Desactivar un producto impide ventas nuevas, pero no bloquea la devolución de ventas existentes.
- Puede crearse un producto con stock inicial cero; no se podrá vender hasta reabastecerlo.

### Ventas vinculadas al inventario

- Registra una venta para un cliente existente, un producto y una cantidad positiva. Si el producto está activo y tiene existencias suficientes, el programa descuenta el stock en la misma instrucción que crea la venta.
- Cada venta V2 recibe un ID único. El mismo cliente puede comprar el mismo SKU en varias ventas V2, a diferencia de la venta V1, que deriva su cuenta por cliente y SKU.
- Guarda en la venta la cantidad, descripción y precio unitario al momento de registrar; el total se calcula con aritmética comprobada y se almacena como `u64`.
- Ajusta la cantidad de una venta: al aumentarla consume solo la diferencia de stock; al reducirla devuelve esa diferencia al inventario. El total conserva el precio capturado originalmente.
- Devuelve una venta activa, la retira del historial V2 y repone sus unidades al stock.
- El historial V2 admite hasta 10 ventas activas por cliente. El frontend lo inicializa automáticamente antes de la primera venta V2 del cliente; esa primera operación puede solicitar una firma para inicializarlo y otra para registrar la venta.

### Interfaz y límites

- La navegación incluye **Inventario**, con catálogo, existencias, acciones para crear/reabastecer/editar productos, formulario de venta y listado de ventas activas.
- La interfaz muestra el precio capturado y total de cada venta, avisa y deshabilita el envío cuando la cantidad supera las existencias, y permite ajustar o devolver ventas.
- Solo la autoridad del registro puede escribir. Las lecturas no requieren firma; las transacciones requieren wallet y SOL de prueba para comisiones y creación de cuentas.
- Los precios y totales son unidades internas del ejercicio: **no se transfieren SOL ni tokens**, y una devolución no realiza un reembolso monetario.

### Baja de clientes

- Permite dar de baja un cliente únicamente cuando no tiene ventas V1 ni V2 activas. Si las hay, el programa rechaza la operación; primero deben cerrarse o devolverse esas ventas.
- La baja quita al cliente del registro y cierra su cuenta on-chain. Si tiene un historial V2 vacío, también se cierra esa cuenta.
- La renta de las cuentas cerradas se devuelve a la autoridad del registro. El contador de IDs no se reduce, por lo que un cliente nuevo nunca reutiliza el ID dado de baja.
- La operación es irreversible y la interfaz solicita confirmación antes de enviarla.

El diseño y las validaciones están documentados con más detalle en [mejoras-funcionales.md](./mejoras-funcionales.md).

Consulta las instrucciones específicas de cada parte:

- [Flujograma completo de despliegue de backend y frontend](./flujograma.md)
- [Backend: importación y uso con Solana Playground](./backend/README.md)
- [Frontend: instalación, desarrollo y configuración del IDL](./frontend/README.md)
- [Guía de pruebas del frontend en Devnet](./frontend/docs/PRUEBAS-MANUALES.md)

## Flujo general

El programa está desplegado en Devnet y se ejecuta en la red; no hay que iniciar un proceso de backend local. Para usarlo:

1. Inicia el frontend desde `frontend/` con `npm run dev`.
2. Abre `http://localhost:5173` y conecta una wallet configurada en Devnet.
3. Usa el Program ID indicado arriba. La wallet necesita SOL de prueba para enviar transacciones y debe ser la autoridad del registro para realizar operaciones de escritura.

El despliegue no se repite al cerrar o reiniciar el frontend. Para cambios futuros del contrato, actualiza el programa existente con su autoridad, verifica la firma y el Program ID en Explorer, y sincroniza el IDL y el cliente TypeScript con ese despliegue.

Para desarrollo local del frontend, abre PowerShell:

```powershell
cd D:\DevWayLearn\proyecto-final\RegistroVentas\frontend
npm ci
npm run verificar
npm run dev
```

Abre `http://localhost:5173`. La configuración predeterminada usa el RPC público de Devnet. Consulta [frontend/README.md](./frontend/README.md) para importar el IDL y los detalles de configuración.

El backend está preparado para Solana Playground. `backend/src/lib.rs` conserva las instrucciones V1 y contiene la implementación V2. `backend/Cargo.toml` permite ejecutar pruebas locales, pero este directorio no es un workspace Anchor completo. El archivo `backend/tests/anchor.test.ts` sigue siendo una plantilla de clase que invoca `initialize`, instrucción que no pertenece a RegistroVentas; no lo uses como prueba de las operaciones V2.

El README del backend importa el repositorio original independiente del programa. En este monorepo, el código está dentro de `backend/`; no asumas que Solana Playground podrá importar el repositorio combinado desde su raíz como si fuera el repositorio standalone. Para desplegar, sigue el enlace del README del backend o publica/importa el backend como repositorio independiente. El monorepo combinado puede seguir siendo el repositorio de entrega.

## Entorno requerido

- Node.js `>=22.12.0 <25` y npm para el frontend.
- Wallet de navegador compatible con Solana y SOL de prueba en Devnet para enviar transacciones.
- Solana Playground y una wallet de prueba en Devnet para compilar y desplegar el programa.

No es necesario dejar un validador local de WSL ejecutándose para utilizar el despliegue de Devnet.

## Seguridad y alcance

- No subas frases de recuperación, claves privadas, archivos de wallet ni keypairs de programa.
- No subas archivos `.env.local` ni otros archivos con configuración privada. El `.env.example` del frontend solo muestra la variable pública de RPC.
- No subas `node_modules`, `dist`, `target`, ledgers de validadores locales ni archivos temporales de desarrollo; están excluidos por `.gitignore`.
- Esta es una base educativa para Devnet, no una aplicación auditada para producción.

## Publicar este monorepo en GitHub

1. En GitHub, crea un repositorio vacío para el proyecto. Para evitar conflictos al primer `push`, no inicialices el remoto con README, `.gitignore` ni licencia.
2. Desde PowerShell, ejecuta en la raíz `D:\DevWayLearn\proyecto-final\RegistroVentas`:

   ```powershell
   git init -b main
   git add README.md mejoras-funcionales.md flujograma.md .gitignore backend frontend
   git status --short
   git diff --cached --stat
   ```

3. Revisa el estado y confirma que no se prepararon claves, wallets, archivos `.env.local`, `node_modules`, `dist` ni `target`. Si todo está correcto:

   ```powershell
   git commit -m "Initial RegistroVentas project"
   git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
   git push -u origin main
   ```

   Reemplaza la URL por la del repositorio vacío que creaste. GitHub autenticará el `push` mediante el navegador o Git Credential Manager; no pongas tokens en el comando ni en archivos del proyecto.

4. Abre la página del repositorio en GitHub y comprueba que aparecen `backend/`, `frontend/`, el README y los archivos de configuración versionados.

Si Git informa que `user.name` o `user.email` no están configurados, configúralos en tu equipo antes del `commit`.
