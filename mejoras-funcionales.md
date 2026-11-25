# Mejoras funcionales: control de inventario integrado con ventas

**Estado (22 de noviembre de 2026):** el programa actualizado se confirmó en Devnet, Program ID `4dJoKhvY2XC6WpHv8b7RCHKsTfUpGpELiDjAjf4grcE3`, slot `525118972` ([transacción](https://explorer.solana.com/tx/4T8A3SgWeFvtgYSgQZaRha2BpJj7zDHhhdYt7JqL7gmdWAhigaMc9yV9ooPj1WiKGqNhvr8HxYrAMNzsaqabwNe2?cluster=devnet)). Se reportó que Inventario V2 pudo inicializarse desde el frontend. Los flujos de productos, ventas V2, ajustes, devoluciones y baja aún deben completarse en pruebas manuales de Devnet.

## 1. Objetivo

Agregar un inventario por negocio que permita administrar productos y existencias, y que aplique reglas de stock a las ventas:

- Cada producto tiene SKU, descripción, precio unitario y stock disponible.
- Una venta indica producto y cantidad. El programa comprueba existencias y descuenta el stock en la misma transacción.
- Una devolución cierra la venta activa y repone el stock.
- El frontend permite administrar el catálogo y ver el efecto de cada operación.

Los importes son datos internos del ejercicio. **No representan una transferencia de SOL ni un pago en tokens.**

## Estado actual de la implementación

- El backend Anchor conserva las cuentas e instrucciones V1 y agrega las cuentas e instrucciones V2 descritas abajo. El inventario, productos, ventas y devoluciones usan cuentas independientes para no cambiar la serialización V1.
- Se añadió `eliminar_cliente`: solo permite la baja cuando el cliente no tiene ventas V1 ni V2 activas; quita su referencia del registro, cierra las cuentas Cliente e historial V2 vacío y devuelve sus rentas a la autoridad. El contador de IDs no retrocede.
- El frontend tiene una sección **Inventario** con creación del inventario, catálogo, reabastecimiento, edición/activación, ventas por cantidad, ajuste de cantidad y devolución con reposición de stock. Las ventas V2 guardan el precio vigente al vender.
- En la sección de Registro, cada cliente tiene una acción **Dar de baja** con confirmación; si quedan ventas activas, el programa rechaza la operación.
- El historial V2 se crea automáticamente antes de la primera venta de inventario de cada cliente existente; esa primera operación puede pedir dos firmas (inicializar historial y registrar venta).
- Se añadieron pruebas unitarias de cálculo de total/stock y pruebas de PDA, serialización, roles, límites y traducción de errores.
- Validación local ejecutada: `npm --prefix .\frontend run verificar` (12 pruebas, TypeScript, verificación del contrato y build) y `cargo test` en `backend` (5 pruebas), además de `rustfmt --check`.
- `frontend/idl.json` y el cliente generado incluyen las instrucciones V2, y `frontend/src/config/programa.json` apunta al Program ID desplegado. La firma de upgrade confirma el binario on-chain; si se modifica la interfaz Anchor, vuelve a exportar el IDL del programa desplegado, regenera el cliente y ejecuta `npm run verificar`.
- El siguiente paso es completar las pruebas manuales de Devnet de la sección 9. No hace falta volver a desplegar para probar las funciones ya incluidas.

## 2. Contexto de V1 y restricciones que condicionaron el diseño

- El programa Rust/Anchor conserva las cuentas e instrucciones V1 (`Registro`, `Cliente`, `Venta`) y agrega en paralelo el modelo V2.
- Actualmente `Venta` se deriva por cliente y SKU: `[b"venta", cliente, sku]`. Solo se puede tener una venta activa por SKU y cliente. La segunda venta con `CAF01` produjo el rechazo esperado.
- `Registro` y `Cliente` guardan vectores de direcciones con capacidad limitada. No deben crecer sin límites.
- El cliente de frontend deriva las PDA, crea instrucciones con el cliente generado a partir del IDL y lee los datos desde RPC.
- En Devnet ya hay un despliegue y cuentas de prueba. Cambiar el formato de las cuentas existentes sin una estrategia de compatibilidad puede impedir leerlas.

## 3. Alcance implementado

### Incluye

1. Inicializar un inventario para un registro existente.
2. Crear productos y evitar SKU duplicados dentro del mismo negocio.
3. Reabastecer existencias.
4. Registrar ventas de una o más unidades, validando y descontando stock atómicamente.
5. Permitir varias ventas del mismo SKU para el mismo cliente usando un identificador de venta único.
6. Cambiar la cantidad de una venta ajustando stock y total.
7. Devolver una venta, reponer el stock y cerrar la cuenta de venta.
8. Mostrar productos, existencias, precios y ventas con inventario en la interfaz.
9. Mostrar errores de negocio comprensibles, como “stock insuficiente”.
10. Dar de baja clientes sin ventas activas, cerrar sus cuentas y retirar sus referencias del registro.

### No incluye en esta versión

- Cobros o transferencias de SOL o tokens.
- Descuentos, impuestos, monedas con decimales, múltiples bodegas o movimientos entre negocios.
- Eliminación física de productos. Se desactivan para impedir ventas nuevas sin borrar su información.
- Migración automática de las ventas antiguas al nuevo modelo.

## 4. Modelo de cuentas y PDA implementado

Para evitar romper la serialización de las cuentas actuales, agregar cuentas V2 independientes y **mantener intactos** `Registro`, `Cliente`, `Venta` y las instrucciones actuales.

| Cuenta nueva | PDA | Datos principales |
|---|---|---|
| `Inventario` | `[b"inventario", registro]` | Registro asociado, direcciones de productos con límite fijo, siguiente ID de venta |
| `Producto` | `[b"producto", registro, sku.as_bytes()]` | Registro, SKU, descripción, precio unitario, stock y activo/inactivo |
| `HistorialVentasV2` | `[b"historial_ventas_v2", cliente]` | Cliente asociado y PDA de cada venta V2 activa, con límite fijo |
| `VentaInventario` | `[b"venta_v2", inventario, id_venta.to_le_bytes()]` | ID, cliente, producto/SKU, descripción y precio capturados, cantidad y total |

Decisiones aplicadas:

- Usar límites explícitos: hasta 20 productos por inventario y hasta 10 ventas V2 activas por cliente. Los límites coinciden con `InitSpace` y se validan antes de insertar.
- Mantener SKU en un máximo de 5 bytes UTF-8 y descripción en un máximo de 50 bytes, igual que el contrato actual, salvo que se acuerde cambiar esos límites.
- Usar `u32` para precio unitario, stock y cantidad; calcular y guardar el total en `u64` con operaciones comprobadas. Rechazar cantidades y precios cero.
- Guardar en `VentaInventario` una copia del precio y la descripción al momento de vender. Cambiar el producto después no altera ventas anteriores.
- Usar el contador de `Inventario` para que dos ventas del mismo cliente y SKU tengan distintos `id_venta` y cuentas. Incrementarlo con `checked_add`.
- Mantener el historial V2 separado del historial actual de `Cliente`, porque el lector existente decodifica sus direcciones como cuentas `Venta` V1.
- Inicializar `Inventario` explícitamente para cada registro. `HistorialVentasV2` tiene una instrucción separada y el frontend la ejecuta al registrar la primera venta V2 de cada cliente, también para clientes existentes.
- Validar por PDA y `has_one = owner` que registro, inventario, cliente, producto y firmante pertenecen al mismo negocio/autoridad.

## 5. Instrucciones nuevas del programa implementadas

Los nombres y argumentos siguientes son los del contrato local. El IDL oficial exportado tras despliegue deberá confirmarlos.

### `inicializar_inventario`

- Recibe el registro y crea su PDA `Inventario`.
- Solo la autoridad propietaria del registro puede inicializarlo.
- Rechaza inicializaciones duplicadas.

### `crear_producto`

- Recibe SKU, descripción, precio inicial y stock inicial.
- Crea la PDA `Producto` y agrega su dirección al catálogo de `Inventario`.
- Rechaza SKU repetidos, datos que excedan los límites, precio inválido y catálogo lleno.
- Permite stock inicial cero; en ese caso el producto aparece, pero no se puede vender.

### `reabastecer_producto`

- Recibe una cantidad positiva y aumenta el stock con `checked_add`.
- Rechaza overflow, cantidad cero y productos inactivos.

### `actualizar_producto`

- Permite cambiar descripción, precio futuro y estado activo/inactivo.
- No permite cambiar el stock arbitrariamente: el stock se modifica por reabastecimiento, venta o devolución.
- Desactivar impide ventas nuevas; no impide devolver ventas ya creadas.

### `registrar_venta_inventario`

- Recibe ID de cliente, SKU y cantidad.
- Deriva y valida Registro, Cliente, Inventario y Producto; verifica que el producto esté activo y que haya stock suficiente.
- Calcula el total con aritmética comprobada, crea `VentaInventario`, descuenta stock, incrementa el contador y agrega la venta al historial V2.
- Todas las modificaciones deben ocurrir en una sola instrucción/transacción: si una validación falla, no cambia el stock ni queda una venta parcial.

### `ajustar_cantidad_venta`

- Aumentar cantidad: descuenta del stock la diferencia, si hay existencias.
- Reducir cantidad: devuelve la diferencia al stock con `checked_add`.
- Recalcula el total usando el precio unitario guardado en la venta, no el precio actual del catálogo.
- El cambio de precio de producto es una operación distinta y solo aplica a ventas futuras.

### `devolver_venta_inventario`

- Comprueba la autoridad y la pertenencia de la venta al cliente/producto.
- Repone la cantidad vendida con `checked_add`, quita la PDA del historial V2 y cierra la cuenta de venta.
- La devolución del ejercicio no transfiere dinero al cliente; solo actualiza inventario y datos on-chain.

### `eliminar_cliente`

- Recibe el ID del cliente y deriva su cuenta y la PDA de `HistorialVentasV2`.
- Rechaza la baja si el contador/historial V1 o el historial V2 todavía indican ventas activas.
- Comprueba que el cliente esté referenciado por el registro; elimina esa referencia sin reducir `id_counter`, para no reutilizar la PDA ni el ID de otro cliente.
- Cierra la cuenta `Cliente` y, si existe y está vacía, cierra también `HistorialVentasV2`. La renta recuperada se transfiere a la autoridad del registro.
- La operación es irreversible; el frontend solicita confirmación y muestra el error si hay ventas pendientes.

### Errores de negocio

El programa define errores Anchor para producto inválido/inactivo, stock insuficiente, cantidad inválida, límites de catálogo/historial, overflow de stock/total/ID, venta inválida, cliente con ventas activas y cliente no registrado. El SKU duplicado se bloquea por la PDA `init`; Anchor devuelve el error de cuenta ya inicializada, que el frontend traduce como duplicado/registro previo.

## 6. Frontend implementado

### Lecturas y derivación

- Hay derivadores de PDA para inventario, producto, historial V2 y venta V2, con seeds iguales a Rust.
- Se leen inventario, productos e historial V2 por separado; una `VentaInventario` no se decodifica como `Venta` V1.
- Las ventas V1 e inventario V2 aparecen en secciones distintas para no mezclar esquemas.
- Los datos se refrescan después de confirmar la firma; si la confirmación queda pendiente, se conserva la firma para consultarla en Explorer.

### Acciones y validaciones

- Hay acciones para cada instrucción V2; al registrar la primera venta, el frontend inicializa antes el historial V2 si falta.
- La acción `eliminarCliente` deriva el historial V2 y cierra el cliente solo tras la confirmación del usuario.
- La UI valida bytes UTF-8, cantidades enteras positivas, precio, límites y stock disponible antes de solicitar firma. La validación local complementa, pero nunca sustituye, las validaciones on-chain.
- Los errores definidos en el IDL local se traducen a mensajes en español, incluido el rechazo por stock insuficiente.
- Se indica que los importes son unidades internas y no SOL.

### Interfaz

- Hay una sección **Inventario** accesible desde la navegación.
- Se muestra una tabla con SKU, descripción, precio, stock y estado.
- Hay formularios para crear productos, reabastecer y actualizar/desactivar.
- La venta permite seleccionar cliente/producto, muestra precio y existencias, acepta cantidad y calcula el total estimado.
- Una advertencia de stock insuficiente deshabilita el envío.
- Cada venta V2 muestra cliente, producto, cantidad, precio capturado, total y acciones de ajustar/devolver.
- Se muestran estados de operación, firma, confirmación, enlace a Solana Explorer Devnet y errores traducidos.
- Cada cliente muestra una acción de baja irreversible con confirmación; el programa protege contra clientes con ventas activas.
- Las operaciones V1 y V2 están separadas en secciones.

## 7. IDL y cliente TypeScript

1. Compilar el programa actualizado en Solana Playground.
2. Exportar el IDL del programa desplegado y guardarlo temporalmente en `frontend/tmp-idl/`.
3. Configurar el IDL con su dirección o indicar el Program ID correcto:

   ```powershell
   npm run configurar:idl -- .\tmp-idl\idl-v2.json --program-id TU_PROGRAM_ID_DEVNET
   ```

4. No editar manualmente los archivos generados. Revisar que el cliente generado incluya las cuentas e instrucciones V2, y que el verificador de contrato acepte el nuevo IDL.
5. Mantener el IDL temporal y cualquier wallet/keypair fuera del control de versiones; publicar solo el IDL público y los artefactos generados que el proyecto ya versiona.

## 8. Compatibilidad y despliegue

Las cuentas V1 ya existen en Devnet. No añadir campos directamente a `Registro`, `Cliente` o `Venta` ni cambiar sus seeds sin migración: Anchor podría no poder decodificar los datos existentes y el cliente derivaría direcciones diferentes.

La estrategia recomendada es aditiva:

1. Conservar tipos, seeds e instrucciones V1.
2. Agregar cuentas e instrucciones V2 independientes, vinculadas a los registros/clientes existentes mediante sus PDA.
3. Confirmar que se conserva el Program ID solo si se tiene la autoridad de actualización del programa. Desplegar la actualización y probarla en Devnet con el mismo programa.
4. Si no se puede actualizar ese despliegue o si la compatibilidad no se puede garantizar, desplegar una versión/programa nuevo y usar un registro de prueba nuevo. Actualizar Program ID, IDL y cliente como una sola operación coordinada.
5. No usar fondos reales ni keypairs Mainnet. No incluir frases, claves privadas ni keypair JSON en el repositorio.

## 9. Pruebas y estado de validación

### Backend / on-chain

- Inicializar inventario solo una vez y validar propietario.
- Crear producto, rechazar SKU duplicado y rechazar SKU/descripción fuera de límites.
- Reabastecer correctamente; rechazar cero y overflow.
- Registrar una venta válida: baja el stock, crea una venta y la agrega al historial.
- Registrar otra venta del mismo cliente/SKU: se crea otro ID de venta y baja el stock de nuevo.
- Rechazar venta por stock insuficiente sin modificar ningún estado.
- Ajustar cantidad hacia arriba/abajo y comprobar la diferencia aplicada al stock.
- Devolver venta: sube el stock, desaparece del historial activo y se cierra la cuenta.
- Probar precio actualizado sin cambiar el precio capturado en ventas existentes.
- Rechazar instrucciones de otra autoridad o con cuentas de otro registro/cliente/producto.
- Dar de baja un cliente sin ventas activas; retirar su referencia y cerrar Cliente/historial V2 vacío.
- Rechazar la baja con ventas V1 o V2 activas sin modificar las cuentas.

### Frontend

- La suite local cubre PDA/seeds V2, serialización y roles del builder, validación de cantidades/existencias iniciales, contrato IDL y traducción de errores.
- `npm --prefix .\frontend run verificar` pasó con 11 pruebas, TypeScript, verificación de IDL y build.
- La interfaz se abrió localmente y la navegación a Inventario se comprobó. El upgrade on-chain fue confirmado y se reportó la inicialización del inventario; los demás flujos V2 todavía deben probarse desde la app y verificarse por sus firmas en Explorer.

`cargo test` pasa 3 pruebas de aritmética para total y cambios de stock; `rustfmt --check` también pasó. Las restricciones de cuentas y flujos completos aún requieren pruebas on-chain. El test existente `backend/tests/anchor.test.ts` llama a `initialize`, que no corresponde a RegistroVentas, por lo que no es evidencia del flujo V2.

## 10. Siguientes pasos

1. Ejecutar desde el frontend una prueba controlada de creación de producto y reabastecimiento.
2. Probar ventas V2 con stock suficiente e insuficiente; comprobar que las ventas confirmadas actualizan stock e historial como se espera.
3. Probar ajuste y devolución, verificando el cambio de stock y las firmas en Explorer.
4. Completar pruebas V1 y baja de clientes con cuentas temporales; no probar la baja irreversible con clientes importantes.
5. Si cambia el contrato, exportar el IDL posterior al despliegue, regenerar el cliente y ejecutar `npm --prefix .\frontend run verificar`.
6. Registrar en este documento y en la guía de onboarding las firmas y los resultados observados.

## 11. Criterios de aceptación

- Puedes crear el inventario de un registro y consultar sus productos desde la app.
- Un SKU solo se crea una vez por registro; puedes reabastecerlo y actualizar su precio.
- Una venta de cantidad `N` con stock suficiente crea su propio ID, guarda una copia del precio y deja exactamente `stock - N`.
- Puedes registrar varias ventas del mismo SKU para el mismo cliente; cada venta tiene un ID distinto.
- Una venta que exceda el stock es rechazada on-chain y no cambia producto, historial ni venta.
- Ajustar cantidad calcula la diferencia de stock correctamente.
- Devolver una venta elimina la venta de las activas y repone exactamente sus unidades.
- Solo la autoridad del registro puede administrar productos, vender y devolver.
- La UI muestra errores comprensibles, firmas confirmadas y enlaces de Devnet; no presenta errores de simulación como éxito.
- Las instrucciones V1 siguen siendo compatibles y el flujo base previamente validado no se rompe.
