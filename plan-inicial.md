# Plan inicial: nuevo despliegue Devnet de RegistroVentasTaller

## 1. Proposito y orden

Este plan establece la identidad y el despliegue on-chain propios del
repositorio nuevo `RegistroVentasTaller`, antes de implementar
[plan-taller1.md](./plan-taller1.md).

Orden de trabajo:

1. Completar este plan: crear un Program ID nuevo, actualizar `declare_id!`,
   desplegar el programa en Devnet y sincronizar el IDL y el cliente frontend.
2. Confirmar que frontend y backend corresponden al despliegue nuevo y crear
   un registro nuevo en Devnet.
3. Solo entonces comenzar [plan-taller1.md](./plan-taller1.md) y conectar el
   agente al registro nuevo.

El repositorio original `RegistroVentas` y `RegistroVentasTaller` son proyectos
distintos. El despliegue anterior y sus cuentas se conservaran intactos; no se
actualizaran ni se reutilizaran como si fueran el despliegue de este repositorio.

## 2. Estado inicial y resultado de ejecucion

- Al iniciar este plan, el repositorio remoto nuevo era
  `https://github.com/mcabanillassalas/RegistroVentasTaller`.
- El backend integrado esta en `backend/src/lib.rs`. Antes del despliegue, ese
  archivo declaraba el Program ID anterior
  `4dJoKhvY2XC6WpHv8b7RCHKsTfUpGpELiDjAjf4grcE3`.
- El frontend contiene V1, Inventario V2 y baja de clientes. El IDL debe
  conservar el esquema que valida `frontend/scripts/contrato-idl.mjs`.
- El repositorio integrado no es necesariamente un proyecto standalone de
  Anchor compatible al importarlo desde su raiz. El README del backend advierte
  que Playground puede requerir importar el backend como subcarpeta o cargar
  sus fuentes por separado.

Resultado de la ejecucion:

- Se desplego en Devnet el Program ID nuevo
  `sACWDFMgns6EKMENP9L9RqnYnY7aANZLU8xHWhawG2k`; Solana Playground mostro
  `Deployment successful`. La firma de esa transaccion no se registro en este
  plan.
- `backend/src/lib.rs`, el IDL local, la configuracion frontend y el cliente
  Codama se sincronizaron con el nuevo Program ID.
- La transaccion del ID anterior documentada en los README pertenece al
  despliegue previo y no verifica el despliegue nuevo.

## 3. Resultado esperado

Al finalizar:

- Existe en Solana Devnet un programa nuevo con un Program ID distinto del
  heredado y del ID de referencia del frontend.
- `declare_id!` coincide exactamente con el Program ID nuevo.
- El binario desplegado se compilo desde el codigo actual de
  `backend/src/lib.rs`.
- Se conserva fuera de GitHub la identidad necesaria para actualizar el nuevo
  programa en el futuro.
- El IDL exportado pertenece a ese despliegue y contiene las instrucciones,
  cuentas y tipos V1/V2 esperados.
- `frontend/idl.json`, el cliente generado y `programa.json` corresponden al
  mismo Program ID.
- La verificacion del frontend pasa.
- Se crea un registro nuevo desde el frontend con la wallet que sera su
  autoridad.
- Se guardan las firmas publicas y evidencias del despliegue y las pruebas.

## 4. Seguridad y decisiones que no se deben mezclar

Hay tres identidades diferentes:

| Identidad | Funcion | Donde se usa |
|---|---|---|
| Program ID | Direccion publica del programa desplegado. | `declare_id!`, Playground, IDL y cliente generado. |
| Autoridad de actualizacion | Wallet autorizada a desplegar futuras versiones. | Solana Playground y la cuenta ProgramData del programa. |
| Autoridad del registro (`owner`) | Wallet que crea y administra el negocio. | Seeds de PDA y operaciones del frontend. |

No asumir que son la misma wallet. La autoridad del registro puede ser una
wallet de practica distinta de la autoridad de actualizacion.

Reglas de seguridad:

- No subir a GitHub la clave del programa, keypairs, frases semilla, wallets
  exportadas ni archivos `.env`.
- El Program ID, el IDL y las firmas de transaccion son publicos y se pueden
  versionar.
- Mantener una copia de respaldo segura de la autoridad de actualizacion y los
  artefactos requeridos para futuros upgrades. No guardarlos en el repositorio.
- Trabajar unicamente en Devnet; no utilizar Mainnet ni fondos reales.
- No generar un nuevo ID durante un intento de upgrade. Un despliegue nuevo y
  un upgrade son operaciones distintas.
- No continuar si Playground muestra un ID que no coincide con
  `declare_id!`.

## 5. Fase 0: preparar la copia publicada

Desde la raiz local de `RegistroVentasTaller`:

1. Confirmar que el repositorio local apunta al repositorio GitHub nuevo:

   ```powershell
   git remote -v
   ```

   Se espera `https://github.com/mcabanillassalas/RegistroVentasTaller.git`.

2. Confirmar que se trabaja directamente en `main` y guardar los cambios
   existentes antes de continuar:

   ```powershell
   git status --short --branch
   git pull --ff-only origin main
   ```

3. Continuar el trabajo en `main`; no hace falta crear una rama aparte para
   esta copia del proyecto. Publicar los commits en `origin main` despues de
   revisar los cambios.

4. No incluir archivos generados ni secretos. La raiz `.gitignore` ya excluye
   `.env`, `node_modules/`, `dist/`, `target/`, `tmp-idl/` y keypairs comunes.
   Revisar igualmente cada staging antes de publicar.

Si el arbol no esta limpio, conservar el trabajo existente; no usar `reset`,
`checkout` destructivo ni eliminar cambios para poder cambiar de rama.

## 6. Fase 1: comprobar el codigo que se va a desplegar

Antes de crear una identidad:

1. Leer `backend/src/lib.rs` completo o inspeccionar las instrucciones y
   cuentas relevantes.
2. Confirmar que el archivo contiene:
   - las instrucciones V1 que usa la aplicacion;
   - las instrucciones y cuentas de Inventario V2;
   - `eliminar_cliente`;
   - la version mas reciente incluida en el repositorio.
3. Confirmar que el nombre del programa Anchor esperado sigue siendo `registro`.
4. Revisar `backend/Cargo.toml` y la configuracion real que utilizara
   Playground.
5. No importar en Playground el repositorio original de clase ni una copia
   anterior de `RegistroVentas`.

El README de `backend/` documenta el flujo de Playground y advierte que el
monorepo no debe tratarse como el repositorio backend standalone original.
Importar `RegistroVentasTaller` desde su raiz no garantiza que Playground
cargue el archivo correcto. Se debe importar la subcarpeta backend si el flujo
de Playground la soporta, o cargar/copiar las fuentes del backend segun el
flujo soportado por Playground y verificar el contenido despues de importarlo.

Si el entorno no puede compilar el proyecto o no queda claro que fuentes estan
cargadas, detenerse y resolverlo antes de generar/deployar. No corregir
versiones de Anchor al azar ni desplegar una copia incompleta.

## 7. Fase 2: generar el nuevo Program ID

1. Abrir Solana Playground: <https://beta.solpg.io/>.
2. Importar o cargar el backend de este repositorio, no el codigo del programa
   original.
3. Guardar una copia de trabajo en Playground con un nombre que identifique
   `RegistroVentasTaller`.
4. Crear una identidad/program keypair nueva para un **programa nuevo**.
   No usar la identidad del programa original ni un keypair compartido.
5. Registrar el Program ID publico que corresponde a esa identidad.
6. Confirmar que es diferente de:
   - `4dJoKhvY2XC6WpHv8b7RCHKsTfUpGpELiDjAjf4grcE3`, ID del programa anterior;
   - `38oTMyvUTmqkBQeMiuok5F2mPjp9dVadWdBeQTDNmTUY`, ID de referencia que el
     verificador local trata como referencia.
7. Conservar con seguridad y fuera del repositorio cualquier keypair o
   capacidad necesaria para futuras actualizaciones.

Si Playground dispone de la accion `Change program ID`, verificar que el
resultado indique el ID actualizado esperado. No basta con que el campo de
texto muestre una direccion.

## 8. Fase 3: sincronizar `declare_id!` y publicar el codigo

1. En `backend/src/lib.rs`, reemplazar unicamente el valor de `declare_id!`
   por el Program ID nuevo obtenido en la fase anterior:

   ```rust
   declare_id!("NUEVO_PROGRAM_ID");
   ```

2. Revisar que no haya otro `declare_id!` contradictorio en los archivos del
   codigo fuente que se desplegara.
3. No modificar cuentas, seeds, instrucciones, serializacion ni logica del
   programa como parte de esta fase.
4. Guardar el cambio, revisar el diff y confirmar que solo contiene el ID nuevo
   y cambios directamente requeridos para prepararlo.
5. Publicar en GitHub los cambios de `main`:

   ```powershell
   git add backend/src/lib.rs
   git diff --cached --check
   git diff --cached
   git commit -m "Configura nuevo Program ID para RegistroVentasTaller"
   git push origin main
   ```

   Si se hicieron otros cambios de preparacion necesarios, revisarlos y
   prepararlos de forma explicita; no agregar secretos o archivos temporales.

6. Importar/actualizar en Playground la version subida y verificar que su
   `src/lib.rs` contiene exactamente el mismo `declare_id!`.

No hacer deploy hasta comprobar el ID y el codigo cargados en Playground.

## 9. Fase 4: compilar y desplegar el programa nuevo

1. En Playground, confirmar la red **Devnet**.
2. Confirmar que la wallet conectada es la autoridad correcta para el deploy.
3. Confirmar que el Program ID de Playground y `declare_id!` son iguales.
4. Ejecutar **Build/Compile**.
5. Si falla:
   - leer el primer error de compilacion;
   - comprobar que el backend correcto fue importado;
   - revisar las versiones/configuracion del entorno;
   - no pulsar Deploy y no alterar el programa a ciegas.
6. Solo con build exitoso, seleccionar **Deploy** para crear el programa nuevo.
   No seleccionar Upgrade para el ID heredado.
7. Revisar en la wallet la transaccion y firmar solo si red e ID son correctos.
8. Esperar confirmacion y guardar la firma publica de despliegue.
9. Abrir el Program ID en Solana Explorer con `cluster=devnet` y verificar que:
   - la cuenta del programa existe y es ejecutable;
   - la transaccion corresponde al ID nuevo;
   - el programa esta en Devnet.

Una confirmacion visual de Playground no sustituye la verificacion de la firma
y del Program ID en Explorer.

## 10. Fase 5: exportar y validar el IDL

1. Exportar desde Playground el IDL generado para el programa que se acaba de
   desplegar.
2. Guardarlo temporalmente en `frontend/tmp-idl/registro.json`. `tmp-idl/` esta
   ignorado por Git.
3. Comprobar que el IDL incluya:
   - address/Program ID del despliegue nuevo, cuando Playground lo exporte;
   - instrucciones V1 y V2 que usa la aplicacion;
   - `eliminarCliente`;
   - cuentas y campos esperados para `Registro`, `Cliente`, `Venta`,
     `Inventario`, `Producto`, `HistorialVentasV2` y `VentaInventario`;
   - errores del programa.
4. Si el IDL tiene una address, contrastarla con el Program ID de Playground.
   No sobrescribir una address distinta mediante una opcion de CLI.
5. Si el IDL no incluye address, pasar explicitamente el nuevo Program ID al
   configurador.

El IDL publico puede agregarse al repositorio despues de validar. No versionar
el archivo temporal original si contiene artefactos ajenos o datos locales.

## 11. Fase 6: importar IDL y regenerar Codama

Desde PowerShell, en la carpeta `frontend`:

```powershell
Set-Location D:\DevWayLearn\ProyectoTaller\RegistroVentasTaller\frontend
npm run configurar:idl -- .\tmp-idl\registro.json
```

Solo si el IDL no incluye address, usar:

```powershell
npm run configurar:idl -- .\tmp-idl\registro.json --program-id NUEVO_PROGRAM_ID
```

El script:

- valida que el programa y sus cuentas/instrucciones coincidan con el contrato
  que espera esta app;
- respalda el IDL local previo en `.aula/respaldos/`;
- reemplaza `frontend/idl.json`;
- regenera `frontend/clients/js/`;
- actualiza `frontend/src/config/programa.json`.

No editar manualmente Codama ni `programa.json` como sustituto de la
importacion. Si solo se requiere regenerar a partir del `idl.json` ya
importado, ejecutar:

```powershell
npm run cliente
```

## 12. Fase 7: verificaciones previas al Taller 1

Desde `frontend/`:

```powershell
npm run comprobar:idl
npm run verificar
```

Confirmar todos los puntos:

1. `frontend/idl.json` contiene el IDL recien exportado.
2. `frontend/src/config/programa.json` indica el Program ID nuevo y
   `"esReferencia": false`.
3. `REGISTRO_PROGRAM_ADDRESS` exportado por Codama coincide con
   `programa.json`.
4. El Program ID no coincide con el ID antiguo ni con el ID de referencia.
5. Las pruebas, typecheck y build pasan.
6. La app muestra Devnet y el programa configurado, no el modo de referencia.
7. La prueba de lectura de la cuenta del programa en Devnet es satisfactoria.

Si el configurador rechaza el IDL por esquema, parar y revisar si se desplego
una compilacion vieja o incorrecta. No eliminar validaciones ni editar los
archivos generados para forzar el proceso.

## 13. Fase 8: crear datos nuevos para el proyecto

1. Iniciar el frontend:

   ```powershell
   npm run dev
   ```

2. Abrir la app en una pestana normal del navegador y conectar una wallet de
   practica con SOL de Devnet.
3. Usar esa wallet como autoridad del nuevo registro, salvo que se haya elegido
   y documentado otra wallet publica.
4. Crear un registro nuevo, un cliente y una venta V1 de prueba.
5. Guardar el nombre exacto del negocio y la direccion publica de la autoridad;
   estos valores seran necesarios para localizar el registro desde el agente.
6. Confirmar las transacciones en Explorer antes de considerarlas exitosas.
7. No esperar que el nuevo frontend vea los datos de las cuentas del programa
   anterior. El cambio de Program ID cambia las PDAs; no existe migracion
   automatica.

La wallet de Solana Playground que despliega el programa no tiene que ser la
wallet que crea el registro, y no se debe exportar una clave privada para
conectar ambas.

## 14. Actualizar documentacion del repositorio

Cuando el despliegue y la sincronizacion del frontend hayan sido verificados:

1. Actualizar las referencias de estado actual y Program ID en:
   - `README.md`
   - `backend/README.md`
   - `frontend/README.md`
   - `flujograma.md`
   - `frontend/docs/IDL-Y-PLAYGROUND.md`
   - `frontend/docs/PRUEBAS-MANUALES.md`
   - `mejoras-funcionales.md`
2. Identificar claramente las firmas y datos de prueba nuevos.
3. Conservar referencias al ID anterior solo cuando sean historia/documentacion
   del proyecto original, etiquetadas como tales.
4. Actualizar `plan-taller1.md` para quitar el lenguaje de "ID por desplegar"
   y registrar el Program ID nuevo verificado.
5. No afirmar que una prueba manual paso si no se ejecuto.

La busqueda final del ID heredado ayuda a encontrar referencias pendientes:

```powershell
git grep "4dJoKhvY2XC6WpHv8b7RCHKsTfUpGpELiDjAjf4grcE3"
```

Cada coincidencia debe ser reemplazada o etiquetada como referencia historica.

## 15. Publicar y cerrar el prerrequisito

Antes de integrar el agente:

1. Revisar cambios, IDL y archivos generados:

   ```powershell
   git status --short
   git diff --check
   git diff
   ```

2. Confirmar que no se prepararon:
   - keypairs o wallets;
   - `.env` o credenciales;
   - `frontend/tmp-idl/`;
   - `node_modules`, `dist`, `target` o ledgers.
3. Agregar explicitamente fuentes, IDL publico, cliente, configuracion,
   documentacion y evidencias solicitadas.
4. Crear commits descriptivos directamente en `main` y publicarlos despues de
   revisar:

   ```powershell
   git add backend/src/lib.rs frontend/idl.json frontend/clients/js frontend/src/config/programa.json
   git diff --cached --check
   git status --short
   git commit -m "Despliega RegistroVentasTaller con nuevo Program ID"
   git push
   ```

   Incluir en el commit solo archivos que aparezcan en el diff revisado; los
   comandos son una guia, no una invitacion a agregar ciegamente otros cambios.

5. Verificar el commit y la rama `main` remota en GitHub.
6. Marcar este plan como terminado solo cuando Program ID, `declare_id!`,
   despliegue, IDL, Codama, frontend, pruebas y documentacion esten sincronizados.

## 16. Criterios de aceptacion

- El programa nuevo se desplego en Devnet, no en Mainnet.
- El nuevo Program ID es distinto del programa original y del ID de referencia.
- `declare_id!`, Playground, firma de despliegue, IDL, Codama y
  `programa.json` coinciden.
- La fuente desplegada es la version actual de `backend/src/lib.rs`.
- Las cuentas del proyecto original permanecen intactas.
- Se creo un registro nuevo para `RegistroVentasTaller`.
- `npm run comprobar:idl` y `npm run verificar` terminan correctamente.
- El repositorio no contiene llaves ni artefactos temporales.
- La documentacion diferencia el despliegue nuevo del historico.
- Solo despues de cumplir estos criterios comienza la implementacion de
  [plan-taller1.md](./plan-taller1.md).
