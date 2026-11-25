use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("4dJoKhvY2XC6WpHv8b7RCHKsTfUpGpELiDjAjf4grcE3");

const MAX_PRODUCTOS: usize = 20;
const MAX_VENTAS_V2: usize = 10;

/// UPDATE 2026-11-21 23:05:00 GMT-0500
#[program]
pub mod registro {
    use super::*; // Importa todos los structs y enums definidos fuera del modulo

    /////////////////////////// INSTRUCCIONES ///////////////////////////
    /////////////////////////// Crear Registro ///////////////////////////
    pub fn crear_registro(context: Context<NuevoRegistro>, nombre_negocio: String) -> Result<()> {
        context.accounts.registro.set_inner(Registro {
            owner: context.accounts.owner.key(),    // caller wallet
            nombre_negocio: nombre_negocio.clone(), // .clone() porque el String se reusa en el msg!
            clientes: Vec::new(), // El negocio nace sin clientes. Guardara PDAs, no structs
            id_counter: 0,        // Contador incremental, asigna un id unico a cada cliente
        }); // Crea el struct del registro, lo serializa y lo guarda en el espacio de la cuenta

        msg!("Registro: {} creado exitosamente!", nombre_negocio); // Log de verificacion

        Ok(())
    }

    /////////////////////////// Nuevo Cliente ///////////////////////////
    // "init" no puede ser condicional: Anchor crea las cuentas antes de entrar al handler.
    // Por eso el alta del cliente es su propia instruccion, separada de registrar_venta.
    pub fn crear_cliente(context: Context<NuevoCliente>, nombre: String) -> Result<()> {
        let cliente_key = context.accounts.cliente.key(); // Se lee ANTES del &mut para no solapar prestamos

        let registro = &mut context.accounts.registro;

        // El id no es un argumento: lo asigna el programa. El contexto ya derivo la cuenta a
        // partir de este mismo valor, asi que aqui solo se confirma en el estado.
        let id_cliente = registro.id_counter + 1;
        registro.id_counter = id_cliente;
        registro.clientes.push(cliente_key); // El registro guarda la PDA del cliente, no sus datos

        context.accounts.cliente.set_inner(Cliente {
            id_cliente,
            nombre: nombre.clone(), // .clone() para no ceder la propiedad porque el String se reusa en el msg!
            compras: 0,             // Nace sin compras: registrar_venta es quien incrementa
            historial: Vec::new(),
        });

        msg!("Cliente {} creado con id: {}", nombre, id_cliente); // Log de verificacion

        Ok(())
    }

    /////////////////////////// Dar de baja Cliente ///////////////////////////
    pub fn eliminar_cliente(context: Context<EliminarCliente>, _id_cliente: u16) -> Result<()> {
        let cliente_key = context.accounts.cliente.key();
        validar_cliente_sin_ventas(
            context.accounts.cliente.compras,
            &context.accounts.cliente.historial,
            &[],
        )?;

        let historial_info = context.accounts.historial_v2.to_account_info();
        let historial_v2_inicializado = if historial_info.owner == &crate::ID {
            let data = historial_info.try_borrow_data()?;
            let mut data_ref: &[u8] = &data;
            let historial = HistorialVentasV2::try_deserialize(&mut data_ref)?;
            require!(
                historial.cliente == cliente_key,
                Errores::HistorialInvalido
            );
            validar_cliente_sin_ventas(0, &[], &historial.ventas)?;
            true
        } else {
            require!(
                historial_info.owner == &system_program::ID && historial_info.data_is_empty(),
                Errores::HistorialInvalido
            );
            false
        };

        quitar_referencia_cliente(&mut context.accounts.registro, cliente_key)?;

        if historial_v2_inicializado {
            cerrar_cuenta_programa(
                &historial_info,
                &context.accounts.owner.to_account_info(),
            )?;
        }

        msg!("Cliente {} dado de baja", context.accounts.cliente.id_cliente);
        Ok(())
    }

    /////////////////////////// Registrar Venta ///////////////////////////
    // id_cliente y sku no se usan en el cuerpo: viajan al contexto para derivar y validar
    // las cuentas. Ver NuevaVenta.
    pub fn registrar_venta(
        context: Context<NuevaVenta>,
        _id_cliente: u16,
        sku: String,
        descripcion: String,
        monto: u32,
    ) -> Result<()> {
        context.accounts.venta.set_inner(Venta {
            sku,
            descripcion,
            monto,
        }); // Serializa y guarda el struct en la cuenta de la venta

        let venta_key = context.accounts.venta.key(); // Se lee ANTES del &mut de cliente

        let cliente = &mut context.accounts.cliente;

        cliente.historial.push(venta_key); // El historial guarda PDAs, no structs completos
        cliente.compras += 1;

        msg!(
            "Venta registrada para el cliente con id: {}",
            cliente.id_cliente
        ); // Log de verificacion

        Ok(())
    }

    /////////////////////////// Hacer Devolucion ///////////////////////////
    // El contexto EliminarVenta lleva "close = owner": la cuenta de la venta se cierra al final
    // y su rent vuelve al owner.
    pub fn hacer_devolucion(
        context: Context<EliminarVenta>,
        _id_cliente: u16,
        sku: String,
    ) -> Result<()> {
        let venta_key = context.accounts.venta.key(); // Se lee ANTES del &mut de cliente

        let cliente = &mut context.accounts.cliente;

        require!(cliente.historial.contains(&venta_key), Errores::NoSKU);
        // La venta existe y pertenece a este cliente (lo garantizan las seeds), pero el historial
        // es el indice de lectura: si la referencia no esta, restar compras lo desincronizaria.

        cliente.historial.retain(|&k| k != venta_key); // Quita la referencia del historial
        cliente.compras -= 1;

        msg!(
            "Venta con sku: {}, devuelta por el cliente con id: {}",
            sku,
            cliente.id_cliente
        );

        Ok(())
    }

    /////////////////////////// Cambiar Monto ///////////////////////////
    // La cuenta de la venta llega ya validada por el contexto: no hay que recorrer ningun vector
    // ni reconstruir la cadena a mano.
    pub fn cambiar_monto(
        context: Context<ModificarVenta>,
        _id_cliente: u16,
        sku: String,
        nuevo_monto: u32,
    ) -> Result<()> {
        let venta = &mut context.accounts.venta;
        let viejo_monto = venta.monto;
        venta.monto = nuevo_monto;

        msg!(
            "El monto de la venta con sku: {}, paso de: {}, a: {}",
            sku,
            viejo_monto,
            nuevo_monto
        );

        Ok(())
    }

    /////////////////////////// Inventario V2 ///////////////////////////

    pub fn inicializar_inventario(context: Context<InicializarInventario>) -> Result<()> {
        context.accounts.inventario.set_inner(Inventario {
            registro: context.accounts.registro.key(),
            productos: Vec::new(),
            siguiente_id_venta: 1,
        });
        Ok(())
    }

    pub fn inicializar_historial_ventas_v2(
        context: Context<InicializarHistorialVentasV2>,
        _id_cliente: u16,
    ) -> Result<()> {
        context.accounts.historial.set_inner(HistorialVentasV2 {
            cliente: context.accounts.cliente.key(),
            ventas: Vec::new(),
        });
        Ok(())
    }

    pub fn crear_producto(
        context: Context<CrearProducto>,
        sku: String,
        descripcion: String,
        precio_unitario: u32,
        stock_inicial: u32,
    ) -> Result<()> {
        validar_sku(&sku)?;
        validar_descripcion(&descripcion)?;
        require!(precio_unitario > 0, Errores::PrecioInvalido);
        require!(
            context.accounts.inventario.productos.len() < MAX_PRODUCTOS,
            Errores::LimiteProductos
        );

        let producto_key = context.accounts.producto.key();
        context.accounts.producto.set_inner(Producto {
            registro: context.accounts.registro.key(),
            sku,
            descripcion,
            precio_unitario,
            stock: stock_inicial,
            activo: true,
        });
        context.accounts.inventario.productos.push(producto_key);
        Ok(())
    }

    pub fn reabastecer_producto(
        context: Context<ModificarProducto>,
        sku: String,
        cantidad: u32,
    ) -> Result<()> {
        validar_sku(&sku)?;
        require!(cantidad > 0, Errores::CantidadInvalida);
        require!(context.accounts.producto.activo, Errores::ProductoInactivo);

        context.accounts.producto.stock = context
            .accounts
            .producto
            .stock
            .checked_add(cantidad)
            .ok_or_else(|| error!(Errores::OverflowStock))?;
        Ok(())
    }

    pub fn actualizar_producto(
        context: Context<ModificarProducto>,
        sku: String,
        descripcion: String,
        precio_unitario: u32,
        activo: bool,
    ) -> Result<()> {
        validar_sku(&sku)?;
        validar_descripcion(&descripcion)?;
        require!(precio_unitario > 0, Errores::PrecioInvalido);

        let producto = &mut context.accounts.producto;
        producto.descripcion = descripcion;
        producto.precio_unitario = precio_unitario;
        producto.activo = activo;
        Ok(())
    }

    pub fn registrar_venta_inventario(
        context: Context<NuevaVentaInventario>,
        id_cliente: u16,
        id_venta: u32,
        sku: String,
        cantidad: u32,
    ) -> Result<()> {
        validar_sku(&sku)?;
        require!(cantidad > 0, Errores::CantidadInvalida);
        require!(
            context.accounts.inventario.siguiente_id_venta == id_venta,
            Errores::IdVentaDesactualizado
        );
        require!(
            context.accounts.historial.ventas.len() < MAX_VENTAS_V2,
            Errores::LimiteVentas
        );

        let (producto_activo, producto_sku, stock_actual, precio_unitario, descripcion) = {
            let producto = &context.accounts.producto;
            (
                producto.activo,
                producto.sku.clone(),
                producto.stock,
                producto.precio_unitario,
                producto.descripcion.clone(),
            )
        };
        require!(producto_activo, Errores::ProductoInactivo);
        require!(producto_sku == sku, Errores::ProductoInvalido);
        require!(stock_actual >= cantidad, Errores::StockInsuficiente);

        let total = calcular_total(precio_unitario, cantidad)?;
        let siguiente_id = id_venta
            .checked_add(1)
            .ok_or_else(|| error!(Errores::OverflowIdVenta))?;
        let venta_key = context.accounts.venta.key();

        context.accounts.venta.set_inner(VentaInventario {
            id_venta,
            id_cliente,
            cliente: context.accounts.cliente.key(),
            producto: context.accounts.producto.key(),
            sku,
            descripcion,
            cantidad,
            precio_unitario,
            total,
        });
        context.accounts.producto.stock = stock_actual
            .checked_sub(cantidad)
            .ok_or_else(|| error!(Errores::StockInsuficiente))?;
        context.accounts.inventario.siguiente_id_venta = siguiente_id;
        context.accounts.historial.ventas.push(venta_key);
        Ok(())
    }

    pub fn ajustar_cantidad_venta(
        context: Context<AjustarCantidadVenta>,
        id_venta: u32,
        _id_cliente: u16,
        sku: String,
        nueva_cantidad: u32,
    ) -> Result<()> {
        validar_sku(&sku)?;
        require!(nueva_cantidad > 0, Errores::CantidadInvalida);
        validar_venta_v2(
            &context.accounts.venta,
            context.accounts.cliente.key(),
            context.accounts.producto.key(),
            &sku,
            id_venta,
            _id_cliente,
        )?;

        let cantidad_anterior = context.accounts.venta.cantidad;
        let stock_ajustado = calcular_stock_ajustado(
            context.accounts.producto.stock,
            cantidad_anterior,
            nueva_cantidad,
            context.accounts.producto.activo,
        )?;
        let total = calcular_total(context.accounts.venta.precio_unitario, nueva_cantidad)?;
        context.accounts.producto.stock = stock_ajustado;
        let venta = &mut context.accounts.venta;
        venta.cantidad = nueva_cantidad;
        venta.total = total;
        Ok(())
    }

    pub fn devolver_venta_inventario(
        context: Context<DevolverVentaInventario>,
        id_venta: u32,
        _id_cliente: u16,
        sku: String,
    ) -> Result<()> {
        validar_sku(&sku)?;
        validar_venta_v2(
            &context.accounts.venta,
            context.accounts.cliente.key(),
            context.accounts.producto.key(),
            &sku,
            id_venta,
            _id_cliente,
        )?;

        let venta_key = context.accounts.venta.key();
        require!(
            context.accounts.historial.ventas.contains(&venta_key),
            Errores::NoSKU
        );
        context.accounts.producto.stock = context
            .accounts
            .producto
            .stock
            .checked_add(context.accounts.venta.cantidad)
            .ok_or_else(|| error!(Errores::OverflowStock))?;
        context
            .accounts
            .historial
            .ventas
            .retain(|&key| key != venta_key);
        Ok(())
    }
}

/////////////////////////// Codigos de Error ///////////////////////////
#[error_code]
pub enum Errores {
    #[msg("Error, no eres el owner del registro")]
    NoOwner,
    #[msg("Error, la venta no esta en el historial del cliente")]
    NoSKU,
    #[msg("El SKU debe tener entre 1 y 5 bytes UTF-8")]
    SkuInvalido,
    #[msg("La descripcion debe tener entre 1 y 50 bytes UTF-8")]
    DescripcionInvalida,
    #[msg("El precio debe ser mayor que cero")]
    PrecioInvalido,
    #[msg("La cantidad debe ser mayor que cero")]
    CantidadInvalida,
    #[msg("El inventario pertenece a otro registro")]
    InventarioInvalido,
    #[msg("El producto no corresponde al registro o SKU")]
    ProductoInvalido,
    #[msg("El producto esta inactivo")]
    ProductoInactivo,
    #[msg("No hay existencias suficientes")]
    StockInsuficiente,
    #[msg("Se alcanzo el limite de productos del inventario")]
    LimiteProductos,
    #[msg("Se alcanzo el limite de ventas activas del cliente")]
    LimiteVentas,
    #[msg("El historial no corresponde al cliente")]
    HistorialInvalido,
    #[msg("La venta no corresponde al cliente, producto o identificador")]
    VentaInvalida,
    #[msg("El identificador de venta quedo desactualizado; vuelve a consultar")]
    IdVentaDesactualizado,
    #[msg("Se agotaron los identificadores de venta")]
    OverflowIdVenta,
    #[msg("El total excede el rango soportado")]
    OverflowTotal,
    #[msg("El stock excede el rango soportado")]
    OverflowStock,
    #[msg("No se puede dar de baja un cliente con ventas activas")]
    ClienteConVentas,
    #[msg("El cliente no aparece en el registro")]
    ClienteNoRegistrado,
}

fn validar_sku(sku: &str) -> Result<()> {
    require!(
        !sku.trim().is_empty() && sku.len() <= 5,
        Errores::SkuInvalido
    );
    Ok(())
}

fn validar_descripcion(descripcion: &str) -> Result<()> {
    require!(
        !descripcion.trim().is_empty() && descripcion.len() <= 50,
        Errores::DescripcionInvalida
    );
    Ok(())
}

fn calcular_total(precio_unitario: u32, cantidad: u32) -> Result<u64> {
    require!(precio_unitario > 0, Errores::PrecioInvalido);
    require!(cantidad > 0, Errores::CantidadInvalida);
    u64::from(precio_unitario)
        .checked_mul(u64::from(cantidad))
        .ok_or_else(|| error!(Errores::OverflowTotal))
}

fn calcular_stock_ajustado(
    stock: u32,
    cantidad_anterior: u32,
    nueva_cantidad: u32,
    producto_activo: bool,
) -> Result<u32> {
    require!(nueva_cantidad > 0, Errores::CantidadInvalida);
    if nueva_cantidad > cantidad_anterior {
        require!(producto_activo, Errores::ProductoInactivo);
        stock
            .checked_sub(nueva_cantidad - cantidad_anterior)
            .ok_or_else(|| error!(Errores::StockInsuficiente))
    } else {
        stock
            .checked_add(cantidad_anterior - nueva_cantidad)
            .ok_or_else(|| error!(Errores::OverflowStock))
    }
}

fn validar_cliente_sin_ventas(
    compras: u16,
    historial_v1: &[Pubkey],
    historial_v2: &[Pubkey],
) -> Result<()> {
    require!(
        compras == 0 && historial_v1.is_empty() && historial_v2.is_empty(),
        Errores::ClienteConVentas
    );
    Ok(())
}

fn quitar_referencia_cliente(registro: &mut Registro, cliente: Pubkey) -> Result<()> {
    let indice = registro
        .clientes
        .iter()
        .position(|referencia| *referencia == cliente)
        .ok_or_else(|| error!(Errores::ClienteNoRegistrado))?;
    registro.clientes.remove(indice);
    Ok(())
}

fn cerrar_cuenta_programa(cuenta: &AccountInfo, destino: &AccountInfo) -> Result<()> {
    require!(cuenta.key != destino.key, Errores::HistorialInvalido);
    destino.add_lamports(cuenta.lamports())?;
    cuenta.sub_lamports(cuenta.lamports())?;
    cuenta.assign(&system_program::ID);
    cuenta.realloc(0, false)?;
    Ok(())
}

fn validar_venta_v2(
    venta: &VentaInventario,
    cliente: Pubkey,
    producto: Pubkey,
    sku: &str,
    id_venta: u32,
    id_cliente: u16,
) -> Result<()> {
    require!(
        venta.cliente == cliente
            && venta.producto == producto
            && venta.sku == sku
            && venta.id_venta == id_venta
            && venta.id_cliente == id_cliente,
        Errores::VentaInvalida
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn total_usa_aritmetica_u64_y_rechaza_ceros() {
        assert_eq!(
            calcular_total(u32::MAX, u32::MAX).unwrap(),
            u64::from(u32::MAX) * u64::from(u32::MAX)
        );
        assert!(calcular_total(0, 1).is_err());
        assert!(calcular_total(1, 0).is_err());
    }

    #[test]
    fn ajustar_cantidad_aplica_solo_la_diferencia_al_stock() {
        assert_eq!(calcular_stock_ajustado(8, 4, 6, true).unwrap(), 6);
        assert_eq!(calcular_stock_ajustado(8, 4, 2, false).unwrap(), 10);
        assert_eq!(calcular_stock_ajustado(8, 4, 4, false).unwrap(), 8);
    }

    #[test]
    fn ajustar_cantidad_rechaza_stock_insuficiente_inactivo_y_overflow() {
        assert!(calcular_stock_ajustado(3, 4, 8, true).is_err());
        assert!(calcular_stock_ajustado(8, 4, 5, false).is_err());
        assert!(calcular_stock_ajustado(u32::MAX, 2, 1, true).is_err());
    }

    #[test]
    fn baja_solo_permite_cliente_sin_ventas_v1_ni_v2() {
        let venta = Pubkey::new_unique();
        assert!(validar_cliente_sin_ventas(0, &[], &[]).is_ok());
        assert!(validar_cliente_sin_ventas(1, &[], &[]).is_err());
        assert!(validar_cliente_sin_ventas(0, &[venta], &[]).is_err());
        assert!(validar_cliente_sin_ventas(0, &[], &[venta]).is_err());
    }

    #[test]
    fn baja_quita_solo_la_referencia_y_no_reutiliza_el_contador() {
        let cliente = Pubkey::new_unique();
        let otro_cliente = Pubkey::new_unique();
        let mut registro = Registro {
            owner: Pubkey::default(),
            nombre_negocio: "Cafe".to_string(),
            clientes: vec![cliente, otro_cliente],
            id_counter: 2,
        };

        quitar_referencia_cliente(&mut registro, cliente).unwrap();
        assert_eq!(registro.clientes, vec![otro_cliente]);
        assert_eq!(registro.id_counter, 2);
        assert!(quitar_referencia_cliente(&mut registro, cliente).is_err());
    }
}

/////////////////////////// CUENTAS ///////////////////////////
/////////////////////////// Registro ///////////////////////////

#[account]
#[derive(InitSpace)]
pub struct Registro {
    pub owner: Pubkey, // pub: has_one = owner necesita leer este campo desde el contexto

    #[max_len(30)]
    nombre_negocio: String,

    #[max_len(10)] // Guarda PDAs (32 bytes c/u), no structs completos
    clientes: Vec<Pubkey>,

    id_counter: u16,
}

/////////////////////////// Cliente ///////////////////////////

#[account]
#[derive(InitSpace, PartialEq)]
pub struct Cliente {
    id_cliente: u16,

    #[max_len(30)]
    nombre: String,

    compras: u16,

    #[max_len(10)]
    historial: Vec<Pubkey>,
}

/////////////////////////// Venta ///////////////////////////

#[account]
#[derive(InitSpace, PartialEq)]
pub struct Venta {
    #[max_len(5)]
    sku: String,

    #[max_len(50)]
    descripcion: String,

    monto: u32,
}

/////////////////////////// Inventario V2 ///////////////////////////

#[account]
#[derive(InitSpace)]
pub struct Inventario {
    registro: Pubkey,

    #[max_len(20)]
    productos: Vec<Pubkey>,

    siguiente_id_venta: u32,
}

#[account]
#[derive(InitSpace)]
pub struct Producto {
    registro: Pubkey,

    #[max_len(5)]
    sku: String,

    #[max_len(50)]
    descripcion: String,

    precio_unitario: u32,
    stock: u32,
    activo: bool,
}

#[account]
#[derive(InitSpace)]
pub struct HistorialVentasV2 {
    cliente: Pubkey,

    #[max_len(10)]
    ventas: Vec<Pubkey>,
}

#[account]
#[derive(InitSpace)]
pub struct VentaInventario {
    id_venta: u32,
    id_cliente: u16,
    cliente: Pubkey,
    producto: Pubkey,

    #[max_len(5)]
    sku: String,

    #[max_len(50)]
    descripcion: String,

    cantidad: u32,
    precio_unitario: u32,
    total: u64,
}

/////////////////////////// CONTEXTOS ///////////////////////////
/*
La jerarquia del modelo vive en las seeds:

    registro  <- [b"registro", nombre_negocio, owner]
    cliente   <- [b"cliente",  registro, id_cliente]
    venta     <- [b"venta",    cliente,  sku]

Cada cuenta se deriva de su padre, asi que la pertenencia queda garantizada por construccion:
si la direccion coincide, el cliente ES de ese registro. Por eso ya no hace falta recorrer
el vector para validar; los vectores quedan como indice de lectura para el frontend.

El "has_one = owner" cierra la cadena por arriba: comprueba que registro.owner == owner.key(),
es decir, que quien firma es el dueño del registro desde el que se deriva todo lo demas.
*/

/////////////////////////// Nuevo Registro ///////////////////////////
/// Instruccion: crear_registro

#[derive(Accounts)]
#[instruction(nombre_negocio: String)]
pub struct NuevoRegistro<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = Registro::INIT_SPACE + 8,
        seeds = [b"registro", nombre_negocio.as_bytes(), owner.key().as_ref()],
        bump
    )]
    pub registro: Account<'info, Registro>,

    pub system_program: Program<'info, System>,
}

/////////////////////////// Nuevo Cliente ///////////////////////////
/// Instruccion: crear_cliente

#[derive(Accounts)]
pub struct NuevoCliente<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut, has_one = owner @ Errores::NoOwner)]
    pub registro: Account<'info, Registro>,

    #[account(
        init,
        payer = owner,
        space = Cliente::INIT_SPACE + 8,
        // El id sale del contador del propio registro: el programa lo asigna, nadie lo envia.
        // to_le_bytes() porque un u16 no tiene as_bytes(): ese metodo es de String/str
        seeds = [b"cliente", registro.key().as_ref(), (registro.id_counter + 1).to_le_bytes().as_ref()],
        bump
    )]
    pub cliente: Account<'info, Cliente>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(id_cliente: u16)]
pub struct EliminarCliente<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut, has_one = owner @ Errores::NoOwner)]
    pub registro: Account<'info, Registro>,

    #[account(
        mut,
        close = owner,
        seeds = [b"cliente", registro.key().as_ref(), id_cliente.to_le_bytes().as_ref()],
        bump
    )]
    pub cliente: Account<'info, Cliente>,

    /// CHECK: la PDA se valida aquí; el historial, si existe, se deserializa y valida en el handler.
    #[account(
        mut,
        seeds = [b"historial_ventas_v2", cliente.key().as_ref()],
        bump
    )]
    pub historial_v2: UncheckedAccount<'info>,
}

/////////////////////////// Nueva Venta ///////////////////////////
/// Instruccion: registrar_venta

#[derive(Accounts)]
#[instruction(id_cliente: u16, sku: String)]
pub struct NuevaVenta<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(has_one = owner @ Errores::NoOwner)]
    pub registro: Account<'info, Registro>, // Sin mut: solo se lee para derivar al cliente

    #[account(
        mut,
        seeds = [b"cliente", registro.key().as_ref(), id_cliente.to_le_bytes().as_ref()],
        bump
    )]
    pub cliente: Account<'info, Cliente>,

    #[account(
        init,
        payer = owner,
        space = Venta::INIT_SPACE + 8,
        // El SKU entra en los seeds: un cliente no puede repetir el mismo producto
        seeds = [b"venta", cliente.key().as_ref(), sku.as_bytes()],
        bump
    )]
    pub venta: Account<'info, Venta>,

    pub system_program: Program<'info, System>,
}

/////////////////////////// Modificar Venta ///////////////////////////
/// Instruccion: cambiar_monto

#[derive(Accounts)]
#[instruction(id_cliente: u16, sku: String)]
pub struct ModificarVenta<'info> {
    pub owner: Signer<'info>,

    #[account(has_one = owner @ Errores::NoOwner)]
    pub registro: Account<'info, Registro>,

    #[account(
        seeds = [b"cliente", registro.key().as_ref(), id_cliente.to_le_bytes().as_ref()],
        bump
    )]
    pub cliente: Account<'info, Cliente>, // Sin mut: solo se lee, para derivar la venta

    #[account(
        mut,
        seeds = [b"venta", cliente.key().as_ref(), sku.as_bytes()],
        bump
    )]
    pub venta: Account<'info, Venta>,
}

/////////////////////////// Eliminar Venta ///////////////////////////
/// Instruccion: hacer_devolucion -> cierra la cuenta

#[derive(Accounts)]
#[instruction(id_cliente: u16, sku: String)]
pub struct EliminarVenta<'info> {
    #[account(mut)]
    pub owner: Signer<'info>, // mut: recibe el rent de la cuenta cerrada

    #[account(has_one = owner @ Errores::NoOwner)]
    pub registro: Account<'info, Registro>, // Sin mut: el registro no cambia en una devolucion

    #[account(
        mut,
        seeds = [b"cliente", registro.key().as_ref(), id_cliente.to_le_bytes().as_ref()],
        bump
    )]
    pub cliente: Account<'info, Cliente>,

    #[account(
        mut,
        close = owner,
        seeds = [b"venta", cliente.key().as_ref(), sku.as_bytes()],
        bump
    )]
    pub venta: Account<'info, Venta>,
}

/////////////////////////// Contextos Inventario V2 ///////////////////////////

#[derive(Accounts)]
pub struct InicializarInventario<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(has_one = owner @ Errores::NoOwner)]
    pub registro: Account<'info, Registro>,

    #[account(
        init,
        payer = owner,
        space = Inventario::INIT_SPACE + 8,
        seeds = [b"inventario", registro.key().as_ref()],
        bump
    )]
    pub inventario: Account<'info, Inventario>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(id_cliente: u16)]
pub struct InicializarHistorialVentasV2<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(has_one = owner @ Errores::NoOwner)]
    pub registro: Account<'info, Registro>,

    #[account(
        seeds = [b"cliente", registro.key().as_ref(), id_cliente.to_le_bytes().as_ref()],
        bump
    )]
    pub cliente: Account<'info, Cliente>,

    #[account(
        init,
        payer = owner,
        space = HistorialVentasV2::INIT_SPACE + 8,
        seeds = [b"historial_ventas_v2", cliente.key().as_ref()],
        bump
    )]
    pub historial: Account<'info, HistorialVentasV2>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(sku: String)]
pub struct CrearProducto<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(has_one = owner @ Errores::NoOwner)]
    pub registro: Account<'info, Registro>,

    #[account(
        mut,
        seeds = [b"inventario", registro.key().as_ref()],
        bump,
        constraint = inventario.registro == registro.key() @ Errores::InventarioInvalido
    )]
    pub inventario: Account<'info, Inventario>,

    #[account(
        init,
        payer = owner,
        space = Producto::INIT_SPACE + 8,
        seeds = [b"producto", registro.key().as_ref(), sku.as_bytes()],
        bump
    )]
    pub producto: Account<'info, Producto>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(sku: String)]
pub struct ModificarProducto<'info> {
    pub owner: Signer<'info>,

    #[account(has_one = owner @ Errores::NoOwner)]
    pub registro: Account<'info, Registro>,

    #[account(
        mut,
        seeds = [b"producto", registro.key().as_ref(), sku.as_bytes()],
        bump,
        constraint = producto.registro == registro.key() @ Errores::ProductoInvalido
    )]
    pub producto: Account<'info, Producto>,
}

#[derive(Accounts)]
#[instruction(id_cliente: u16, id_venta: u32, sku: String, cantidad: u32)]
pub struct NuevaVentaInventario<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(has_one = owner @ Errores::NoOwner)]
    pub registro: Account<'info, Registro>,

    #[account(
        seeds = [b"cliente", registro.key().as_ref(), id_cliente.to_le_bytes().as_ref()],
        bump
    )]
    pub cliente: Account<'info, Cliente>,

    #[account(
        mut,
        seeds = [b"inventario", registro.key().as_ref()],
        bump,
        constraint = inventario.registro == registro.key() @ Errores::InventarioInvalido
    )]
    pub inventario: Account<'info, Inventario>,

    #[account(
        mut,
        seeds = [b"producto", registro.key().as_ref(), sku.as_bytes()],
        bump,
        constraint = producto.registro == registro.key() @ Errores::ProductoInvalido
    )]
    pub producto: Account<'info, Producto>,

    #[account(
        mut,
        seeds = [b"historial_ventas_v2", cliente.key().as_ref()],
        bump,
        constraint = historial.cliente == cliente.key() @ Errores::HistorialInvalido
    )]
    pub historial: Account<'info, HistorialVentasV2>,

    #[account(
        init,
        payer = owner,
        space = VentaInventario::INIT_SPACE + 8,
        seeds = [b"venta_v2", inventario.key().as_ref(), id_venta.to_le_bytes().as_ref()],
        bump
    )]
    pub venta: Account<'info, VentaInventario>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(id_venta: u32, id_cliente: u16, sku: String)]
pub struct AjustarCantidadVenta<'info> {
    pub owner: Signer<'info>,

    #[account(has_one = owner @ Errores::NoOwner)]
    pub registro: Account<'info, Registro>,

    #[account(
        seeds = [b"cliente", registro.key().as_ref(), id_cliente.to_le_bytes().as_ref()],
        bump
    )]
    pub cliente: Account<'info, Cliente>,

    #[account(
        seeds = [b"inventario", registro.key().as_ref()],
        bump,
        constraint = inventario.registro == registro.key() @ Errores::InventarioInvalido
    )]
    pub inventario: Account<'info, Inventario>,

    #[account(
        mut,
        seeds = [b"producto", registro.key().as_ref(), sku.as_bytes()],
        bump,
        constraint = producto.registro == registro.key() @ Errores::ProductoInvalido
    )]
    pub producto: Account<'info, Producto>,

    #[account(
        seeds = [b"historial_ventas_v2", cliente.key().as_ref()],
        bump,
        constraint = historial.cliente == cliente.key() @ Errores::HistorialInvalido
    )]
    pub historial: Account<'info, HistorialVentasV2>,

    #[account(
        mut,
        seeds = [b"venta_v2", inventario.key().as_ref(), id_venta.to_le_bytes().as_ref()],
        bump
    )]
    pub venta: Account<'info, VentaInventario>,
}

#[derive(Accounts)]
#[instruction(id_venta: u32, id_cliente: u16, sku: String)]
pub struct DevolverVentaInventario<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(has_one = owner @ Errores::NoOwner)]
    pub registro: Account<'info, Registro>,

    #[account(
        seeds = [b"cliente", registro.key().as_ref(), id_cliente.to_le_bytes().as_ref()],
        bump
    )]
    pub cliente: Account<'info, Cliente>,

    #[account(
        seeds = [b"inventario", registro.key().as_ref()],
        bump,
        constraint = inventario.registro == registro.key() @ Errores::InventarioInvalido
    )]
    pub inventario: Account<'info, Inventario>,

    #[account(
        mut,
        seeds = [b"producto", registro.key().as_ref(), sku.as_bytes()],
        bump,
        constraint = producto.registro == registro.key() @ Errores::ProductoInvalido
    )]
    pub producto: Account<'info, Producto>,

    #[account(
        mut,
        seeds = [b"historial_ventas_v2", cliente.key().as_ref()],
        bump,
        constraint = historial.cliente == cliente.key() @ Errores::HistorialInvalido
    )]
    pub historial: Account<'info, HistorialVentasV2>,

    #[account(
        mut,
        close = owner,
        seeds = [b"venta_v2", inventario.key().as_ref(), id_venta.to_le_bytes().as_ref()],
        bump
    )]
    pub venta: Account<'info, VentaInventario>,
}
