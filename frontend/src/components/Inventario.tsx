import { useEffect, useRef, useState } from 'react';
import { address } from '@solana/kit';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import programa from '../config/programa.json';
import { NEGOCIO_INICIAL, UNIDAD_MONTO } from '../config/interfaz';
import {
  leerInventarioV2,
  leerRegistro,
  type InventarioUI,
  type RegistroUI,
} from '../solana/lecturas';
import {
  actualizarProducto,
  ajustarCantidadVentaInventario,
  crearProducto,
  devolverVentaInventario,
  inicializarInventario,
  reabastecerProducto,
  registrarVentaInventario,
} from '../solana/acciones';
import { negocioValido } from '../solana/validaciones';
import {
  ErrorConfirmacionPendiente,
  ErrorTransaccion,
  enlaceTransaccion,
  traducir,
  type OpcionesEnvio,
} from '../solana/tx';

type Operacion = 'producto' | 'reabastecer' | 'actualizar' | 'venta' | 'ajuste';
const operaciones: { id: Operacion; texto: string }[] = [
  { id: 'producto', texto: 'Nuevo producto' },
  { id: 'reabastecer', texto: 'Reabastecer' },
  { id: 'actualizar', texto: 'Editar producto' },
  { id: 'venta', texto: 'Registrar venta' },
  { id: 'ajuste', texto: 'Ajustar venta' },
];

export function Inventario({ onCambio, onOcupado }: { onCambio: () => void; onOcupado: (valor: boolean) => void }) {
  const wallet = useWallet();
  const { connection } = useConnection();
  const walletDireccion = wallet.publicKey?.toBase58() ?? '';
  const [negocio, setNegocio] = useState(NEGOCIO_INICIAL);
  const [autoridad, setAutoridad] = useState(walletDireccion);
  const [registro, setRegistro] = useState<RegistroUI | null>(null);
  const [inventario, setInventario] = useState<InventarioUI | null>(null);
  const [consultado, setConsultado] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const [errorLectura, setErrorLectura] = useState('');
  const [op, setOp] = useState<Operacion>('producto');
  const [sku, setSku] = useState('CAF02');
  const [descripcion, setDescripcion] = useState('Cafe latte');
  const [precio, setPrecio] = useState('60');
  const [cantidad, setCantidad] = useState('10');
  const [clienteId, setClienteId] = useState('');
  const [ventaSeleccionada, setVentaSeleccionada] = useState('');
  const [productoActivo, setProductoActivo] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [fase, setFase] = useState('');
  const [firma, setFirma] = useState('');
  const [firmaFallida, setFirmaFallida] = useState('');
  const [errorOperacion, setErrorOperacion] = useState('');
  const [aviso, setAviso] = useState('');
  const secuencia = useRef(0);
  const contexto = useRef('');
  contexto.current = negocio + '|' + autoridad;

  useEffect(() => { setAutoridad(walletDireccion); }, [walletDireccion]);
  useEffect(() => {
    secuencia.current += 1;
    setRegistro(null);
    setInventario(null);
    setConsultado(false);
    setErrorLectura('');
    setFirma('');
    setFirmaFallida('');
    setErrorOperacion('');
    setAviso('');
  }, [negocio, autoridad]);
  useEffect(() => { onOcupado(ocupado); return () => onOcupado(false); }, [ocupado, onOcupado]);

  async function cargar(nombreNegocio = negocio, owner = autoridad) {
    const clave = nombreNegocio + '|' + owner;
    const turno = ++secuencia.current;
    setLeyendo(true);
    setErrorLectura('');
    try {
      const datos = await leerRegistro(negocioValido(nombreNegocio), address(owner.trim()));
      const existencias = datos
        ? await leerInventarioV2(datos.direccion, datos.clientes)
        : null;
      if (turno === secuencia.current && contexto.current === clave) {
        setRegistro(datos);
        setInventario(existencias);
        setConsultado(true);
      }
    } catch (error) {
      if (turno === secuencia.current) setErrorLectura(traducir(error));
      throw error;
    } finally {
      if (turno === secuencia.current) setLeyendo(false);
    }
  }

  function opcionesEnvio(): OpcionesEnvio {
    return {
      onEstado: (estado) => setFase(
        estado === 'firma'
          ? 'Revisa la solicitud en tu wallet…'
          : 'Esperando confirmación de la red…'
      ),
    };
  }

  function iniciarOperacion() {
    setOcupado(true);
    setFase('Preparando operación…');
    setFirma('');
    setFirmaFallida('');
    setErrorOperacion('');
    setAviso('');
  }

  function reportarError(error: unknown) {
    setFase('');
    setErrorOperacion(traducir(error));
    if (error instanceof ErrorTransaccion || error instanceof ErrorConfirmacionPendiente) {
      setFirmaFallida(error.firma);
    }
  }

  async function refrescarTrasOperacion(firmaConfirmada: string) {
    setFirma(firmaConfirmada);
    setFase('Operación confirmada correctamente.');
    onCambio();
    try {
      await cargar(negocio.trim(), walletDireccion);
    } catch {
      setAviso('La operación se confirmó, pero no pudimos actualizar los datos. Pulsa Consultar inventario para volver a leerlos.');
    }
  }

  async function ejecutar(evento: React.FormEvent) {
    evento.preventDefault();
    iniciarOperacion();
    const opciones = opcionesEnvio();
    try {
      const numeroCantidad = Number(cantidad);
      const numeroPrecio = Number(precio);
      let resultado: string;
      switch (op) {
        case 'producto':
          resultado = await crearProducto(wallet, connection, negocio, sku, descripcion, numeroPrecio, numeroCantidad, opciones);
          break;
        case 'reabastecer':
          resultado = await reabastecerProducto(wallet, connection, negocio, sku, numeroCantidad, opciones);
          break;
        case 'actualizar':
          resultado = await actualizarProducto(wallet, connection, negocio, sku, descripcion, numeroPrecio, productoActivo, opciones);
          break;
        case 'venta':
          resultado = await registrarVentaInventario(wallet, connection, negocio, Number(clienteId), sku, numeroCantidad, opciones);
          break;
        case 'ajuste': {
          const venta = ventaPorClave(ventaSeleccionada);
          if (!venta) throw new Error('Selecciona una venta activa para ajustar.');
          resultado = await ajustarCantidadVentaInventario(wallet, connection, negocio, venta.idCliente, venta.idVenta, venta.sku, numeroCantidad, opciones);
          break;
        }
      }
      await refrescarTrasOperacion(resultado);
    } catch (error) {
      reportarError(error);
    } finally {
      setOcupado(false);
    }
  }

  function ventaPorClave(clave: string) {
    return inventario?.ventas.find((venta) => `${venta.idCliente}:${venta.idVenta}` === clave);
  }

  async function devolver(venta: NonNullable<InventarioUI>['ventas'][number]) {
    iniciarOperacion();
    try {
      const resultado = await devolverVentaInventario(
        wallet, connection, negocio, venta.idCliente, venta.idVenta, venta.sku, opcionesEnvio()
      );
      await refrescarTrasOperacion(resultado);
    } catch (error) {
      reportarError(error);
    } finally {
      setOcupado(false);
    }
  }

  function seleccionarProducto(productoSku: string, accion: 'reabastecer' | 'actualizar') {
    const producto = inventario?.productos.find((item) => item.sku === productoSku);
    if (!producto) return;
    setSku(producto.sku);
    setDescripcion(producto.descripcion);
    setPrecio(String(producto.precioUnitario));
    setProductoActivo(producto.activo);
    setCantidad('1');
    setOp(accion);
    setFirma('');
    setErrorOperacion('');
    setFirmaFallida('');
    setFase('');
  }

  const productoSeleccionado = inventario?.productos.find((producto) => producto.sku === sku);
  const ventaActual = ventaPorClave(ventaSeleccionada);
  const esOtraAutoridad = !!autoridad.trim() && autoridad.trim() !== walletDireccion;
  const permiteEscribir = !programa.esReferencia && !!wallet.publicKey && !esOtraAutoridad;
  const clientesDisponibles = registro?.clientes ?? [];
  const productosActivos = inventario?.productos.filter((producto) => producto.activo) ?? [];
  const cantidadNumero = Number(cantidad);
  const ventaSinStock = op === 'venta'
    && !!productoSeleccionado
    && Number.isInteger(cantidadNumero)
    && cantidadNumero > productoSeleccionado.stock;
  const productoAjuste = ventaActual
    ? inventario?.productos.find((producto) => producto.sku === ventaActual.sku)
    : undefined;
  const ventasActivasCliente = inventario?.ventas.filter(
    (venta) => String(venta.idCliente) === clienteId
  ).length ?? 0;
  const limiteProductosAlcanzado = (inventario?.productos.length ?? 0) >= 20;
  const limiteVentasClienteAlcanzado = op === 'venta' && !!clienteId && ventasActivasCliente >= 10;
  const ajusteSinStock = op === 'ajuste'
    && !!ventaActual
    && !!productoAjuste
    && Number.isInteger(cantidadNumero)
    && cantidadNumero > ventaActual.cantidad
    && cantidadNumero - ventaActual.cantidad > productoAjuste.stock;
  const ajusteProductoInactivo = op === 'ajuste'
    && !!ventaActual
    && !!productoAjuste
    && cantidadNumero > ventaActual.cantidad
    && !productoAjuste.activo;
  const totalEstimado = productoSeleccionado && Number.isInteger(cantidadNumero) && cantidadNumero > 0
    ? (BigInt(productoSeleccionado.precioUnitario) * BigInt(cantidadNumero)).toLocaleString('es-MX')
    : '—';

  return <>
    <div className="section-heading"><div><p className="eyebrow">CATÁLOGO · EXISTENCIAS · VENTAS</p><h2>Inventario y ventas</h2></div><span className="tag">Control de existencias V2</span></div>
    {programa.esReferencia && <aside className="notice information"><strong>Configura tu programa para comenzar.</strong><p>El IDL actual es de referencia. Importa el IDL exportado desde tu programa desplegado para consultar o modificar inventario.</p></aside>}
    <section className="panel lookup-panel">
      <div className="panel-heading"><h3>Localizar el negocio</h3><span className="small-note">Lectura sin firma</span></div>
      <div className="lookup-fields">
        <label>Nombre exacto del negocio<input value={negocio} disabled={ocupado} onChange={(e) => setNegocio(e.target.value)} placeholder="Cafe WayLearn D1" /></label>
        <label>Dirección de la autoridad<input value={autoridad} disabled={ocupado} onChange={(e) => setAutoridad(e.target.value)} placeholder="Conecta tu wallet o pega una dirección pública" spellCheck={false} autoComplete="off" /></label>
        <button className="button secondary" disabled={leyendo || ocupado || programa.esReferencia || !negocio.trim() || !autoridad.trim()} onClick={() => void cargar().catch(() => {})}>{leyendo ? 'Consultando…' : 'Consultar inventario'}</button>
      </div>
      <p className="help">El inventario pertenece al registro localizado. Puedes consultar otra autoridad en modo lectura.</p>
      {errorLectura && <p className="notice error" role="alert">{errorLectura}</p>}
    </section>

    {!registro && <section className="panel empty-state">
      <span className="empty-symbol">▦</span>
      <h4>{consultado ? 'Primero crea el registro del negocio' : 'El catálogo aparecerá aquí'}</h4>
      <p>{consultado ? 'El inventario V2 se crea sobre un registro existente. Usa la sección Registro de ventas para crear uno.' : 'Consulta el negocio para ver su catálogo, existencias y ventas de inventario.'}</p>
    </section>}

    {registro && !inventario && <section className="panel inventory-init">
      <div className="panel-heading"><h3>Inventario todavía no inicializado</h3><span className="small-note">Una sola vez por negocio</span></div>
      <p className="help">La creación añade una cuenta V2 independiente y conserva las cuentas e historial del registro actual.</p>
      {permiteEscribir
        ? <button className="button primary inventory-init-button" disabled={ocupado} onClick={async () => {
          iniciarOperacion();
          try {
            const resultado = await inicializarInventario(wallet, connection, negocio, opcionesEnvio());
            await refrescarTrasOperacion(resultado);
          } catch (error) {
            reportarError(error);
          } finally {
            setOcupado(false);
          }
        }}>{ocupado ? 'Operación en curso…' : 'Inicializar inventario'}</button>
        : <p className="notice subtle">Conecta la wallet que controla este registro para inicializar el inventario.</p>}
    </section>}

    {registro && inventario && <>
      <div className="registry-summary inventory-summary">
        <div><span className="label">Negocio</span><strong>{registro.nombreNegocio}</strong></div>
        <div><span className="label">Productos</span><strong>{inventario.productos.length}</strong></div>
        <div><span className="label">Próximo ID de venta</span><strong>{inventario.siguienteIdVenta}</strong></div>
      </div>
      <details className="technical-details"><summary>Dirección del inventario</summary><code className="address">{inventario.direccion}</code></details>
      <div className="workspace-grid">
        <section className="panel products-panel">
          <div className="panel-heading"><h3>Catálogo de productos</h3><span className="count">{inventario.productos.length} productos</span></div>
          {inventario.productos.length === 0
            ? <div className="empty-state"><span className="empty-symbol">▦</span><h4>Catálogo vacío</h4><p>Crea un producto para controlar sus existencias y poder registrar ventas por cantidad.</p></div>
            : <div className="table-wrap"><table><thead><tr><th>Producto</th><th className="numeric">Precio</th><th className="numeric">Stock</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
              {inventario.productos.map((producto) => <tr key={producto.direccion}>
                <td><strong>{producto.descripcion}</strong><br/><code>{producto.sku}</code></td>
                <td className="numeric">{producto.precioUnitario.toLocaleString('es-MX')} <small>{UNIDAD_MONTO}</small></td>
                <td className="numeric">{producto.stock}</td>
                <td>{producto.activo ? 'Activo' : 'Inactivo'}</td>
                <td className="row-actions">
                  <button className="text-button" disabled={ocupado || !permiteEscribir || !producto.activo} onClick={() => seleccionarProducto(producto.sku, 'reabastecer')}>Abastecer</button>
                  <button className="text-button" disabled={ocupado || !permiteEscribir} onClick={() => seleccionarProducto(producto.sku, 'actualizar')}>Editar</button>
                </td>
              </tr>)}
            </tbody></table></div>}
        </section>

        <section className="panel operations-panel inventory-operations">
          <div className="panel-heading"><h3>Operaciones</h3><span className="small-note">Con firma</span></div>
          <div className="operation-tabs">{operaciones.map((item) => <button key={item.id} className={op === item.id ? 'active' : ''} disabled={ocupado} onClick={() => { setOp(item.id); setFirma(''); setErrorOperacion(''); setFirmaFallida(''); setFase(''); }}>{item.texto}</button>)}</div>
          <form onSubmit={(evento) => void ejecutar(evento)}>
            <fieldset disabled={ocupado || !permiteEscribir}>
              {(op === 'producto' || op === 'reabastecer' || op === 'actualizar') && <label>SKU
                {op === 'producto'
                  ? <input value={sku} maxLength={5} onChange={(e) => setSku(e.target.value)} required />
                  : <select value={sku} onChange={(e) => setSku(e.target.value)} required>{inventario.productos.filter((producto) => op !== 'reabastecer' || producto.activo).map((producto) => <option key={producto.direccion} value={producto.sku}>{producto.sku} · {producto.descripcion}</option>)}</select>}
              </label>}
              {(op === 'producto' || op === 'actualizar') && <>
                <label>Descripción<input value={descripcion} maxLength={50} onChange={(e) => setDescripcion(e.target.value)} required /></label>
                <label>Precio unitario<input type="number" min="1" max="4294967295" step="1" value={precio} onChange={(e) => setPrecio(e.target.value)} required /></label>
              </>}
              {(op === 'producto' || op === 'reabastecer') && <label>{op === 'producto' ? 'Existencia inicial' : 'Cantidad a agregar'}<input type="number" min={op === 'producto' ? '0' : '1'} max="4294967295" step="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} required /></label>}
              {op === 'producto' && limiteProductosAlcanzado && <p className="notice subtle">El catálogo ya alcanzó el límite de 20 productos.</p>}
              {op === 'actualizar' && <label className="checkbox-field"><input type="checkbox" checked={productoActivo} onChange={(e) => setProductoActivo(e.target.checked)} /> Producto activo para nuevas ventas</label>}
              {op === 'venta' && <>
                <label>Cliente<select value={clienteId} onChange={(e) => setClienteId(e.target.value)} required><option value="">Selecciona un cliente</option>{clientesDisponibles.map((cliente) => <option key={cliente.direccion} value={cliente.idCliente}>#{cliente.idCliente} · {cliente.nombre}</option>)}</select></label>
                {limiteVentasClienteAlcanzado && <p className="notice subtle">Este cliente ya tiene 10 ventas V2 activas. Devuelve una venta antes de registrar otra.</p>}
                <label>Producto<select value={sku} onChange={(e) => setSku(e.target.value)} required><option value="">Selecciona un producto</option>{productosActivos.map((producto) => <option key={producto.direccion} value={producto.sku}>{producto.sku} · {producto.descripcion} · stock {producto.stock}</option>)}</select></label>
                <label>Cantidad<input type="number" min="1" max="4294967295" step="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} required /></label>
                <p className="help">Total estimado: <strong>{totalEstimado} {UNIDAD_MONTO}</strong>. No representa una transferencia de SOL.</p>
                {ventaSinStock && <p className="notice error" role="alert">Stock insuficiente: hay {productoSeleccionado?.stock} unidades disponibles.</p>}
              </>}
              {op === 'ajuste' && <>
                <label>Venta activa<select value={ventaSeleccionada} onChange={(e) => {
                  const clave = e.target.value;
                  setVentaSeleccionada(clave);
                  const venta = ventaPorClave(clave);
                  if (venta) setCantidad(String(venta.cantidad));
                }} required><option value="">Selecciona una venta</option>{inventario.ventas.map((venta) => <option key={`${venta.idCliente}:${venta.idVenta}`} value={`${venta.idCliente}:${venta.idVenta}`}>Venta #{venta.idVenta} · cliente #{venta.idCliente} · {venta.sku}</option>)}</select></label>
                <label>Nueva cantidad<input type="number" min="1" max="4294967295" step="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} required /></label>
                {ventaActual && <p className="help">Reducir cantidad repone stock; aumentarla consume existencias adicionales.</p>}
                {ajusteSinStock && <p className="notice error" role="alert">Stock insuficiente para aumentar esta venta. Hay {productoAjuste?.stock} unidades disponibles para agregar.</p>}
                {ajusteProductoInactivo && <p className="notice subtle">No se puede aumentar una venta de un producto inactivo. Reactiva el producto antes de aumentar la cantidad.</p>}
              </>}
              {op === 'actualizar' && <p className="help">Desactivar un producto impide ventas nuevas; las ventas existentes aún pueden devolverse o ajustarse.</p>}
              <button className="button primary" type="submit" disabled={
                ocupado
                || !permiteEscribir
                || (op === 'producto' && limiteProductosAlcanzado)
                || limiteVentasClienteAlcanzado
                || ventaSinStock
                || ajusteSinStock
                || ajusteProductoInactivo
                || (op === 'venta' && (!clientesDisponibles.length || !productosActivos.length))
                || (op === 'ajuste' && !inventario.ventas.length)
              }>{ocupado ? 'Operación en curso…' : operaciones.find((item) => item.id === op)!.texto}</button>
            </fieldset>
          </form>
          {!wallet.publicKey && <p className="help">Conecta tu wallet para modificar el inventario.</p>}
          {esOtraAutoridad && wallet.publicKey && <p className="notice subtle">Estás consultando otra autoridad. Para escribir, utiliza el registro de la wallet conectada.</p>}
          {ocupado && <p className="notice information" role="status">{fase}</p>}
          {firma && <p className="notice success" role="status"><strong>Operación confirmada.</strong><br/><a href={enlaceTransaccion(firma)} target="_blank" rel="noreferrer">Ver transacción en Explorer</a></p>}
          {errorOperacion && <p className="notice error" role="alert">{errorOperacion}{firmaFallida && <><br/><a href={enlaceTransaccion(firmaFallida)} target="_blank" rel="noreferrer">Revisar transacción en Explorer</a></>}</p>}
          {aviso && <p className="notice subtle">{aviso}</p>}
        </section>
      </div>

      <section className="panel sales-panel">
        <div className="panel-heading"><h3>Ventas activas</h3><span className="count">{inventario.ventas.length} ventas</span></div>
        {inventario.ventas.length === 0 ? <p className="empty-line">Todavía no hay ventas de inventario.</p> : <div className="table-wrap"><table><thead><tr><th>ID</th><th>Cliente</th><th>Producto</th><th className="numeric">Cantidad</th><th className="numeric">Precio capturado</th><th className="numeric">Total</th><th>Acciones</th></tr></thead><tbody>
          {inventario.ventas.map((venta) => <tr key={venta.direccion}>
            <td>#{venta.idVenta}</td>
            <td>{registro.clientes.find((cliente) => cliente.idCliente === venta.idCliente)?.nombre ?? `#${venta.idCliente}`}</td>
            <td><code>{venta.sku}</code><br/><small>{venta.descripcion}</small></td>
            <td className="numeric">{venta.cantidad}</td>
            <td className="numeric">{venta.precioUnitario.toLocaleString('es-MX')} <small>{UNIDAD_MONTO}</small></td>
            <td className="numeric">{venta.total.toLocaleString('es-MX')} <small>{UNIDAD_MONTO}</small></td>
            <td className="row-actions">
              <button className="text-button" disabled={ocupado || !permiteEscribir} onClick={() => {
                setVentaSeleccionada(`${venta.idCliente}:${venta.idVenta}`);
                setCantidad(String(venta.cantidad));
                setOp('ajuste');
              }}>Ajustar</button>
              <button className="text-button danger-button" disabled={ocupado || !permiteEscribir} onClick={() => void devolver(venta)}>Devolver</button>
            </td>
          </tr>)}
        </tbody></table></div>}
        <p className="help">Una devolución elimina la venta activa y repone sus unidades al stock; no realiza un reembolso de SOL.</p>
      </section>
    </>}
    {ocupado && !inventario && <p className="notice information" role="status">{fase}</p>}
    {errorOperacion && !inventario && <p className="notice error" role="alert">{errorOperacion}{firmaFallida && <><br/><a href={enlaceTransaccion(firmaFallida)} target="_blank" rel="noreferrer">Revisar transacción en Explorer</a></>}</p>}
    {aviso && !inventario && <p className="notice subtle">{aviso}</p>}
  </>;
}
