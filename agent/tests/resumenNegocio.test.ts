import assert from "node:assert/strict";
import { test } from "node:test";
import { construirResumenNegocio } from "../src/plugins/registro-ventas/tools/resumenNegocio.ts";

test("suma las ventas activas y conserva a todos los clientes empatados", () => {
  const resumen = construirResumenNegocio("Tienda", "registro-address", [
    {
      direccion: "cliente-1",
      idCliente: 1,
      nombre: "Ana",
      compras: 2,
      ventas: [
        { direccion: "venta-1", sku: "A", descripcion: "A", monto: 40 },
        { direccion: "venta-2", sku: "B", descripcion: "B", monto: 15 },
      ],
    },
    {
      direccion: "cliente-2",
      idCliente: 2,
      nombre: "Luis",
      compras: 2,
      ventas: [{ direccion: "venta-3", sku: "C", descripcion: "C", monto: 70 }],
    },
  ]);

  assert.equal(resumen.total_clientes, 2);
  assert.equal(resumen.total_ventas_activas, 3);
  assert.equal(resumen.monto_total, 125);
  assert.deepEqual(
    resumen.mejor_cliente?.clientes.map((cliente) => cliente.nombre),
    ["Ana", "Luis"],
  );
});

test("no declara mejor cliente si no hay ventas activas", () => {
  const resumen = construirResumenNegocio("Tienda", "registro-address", [
    {
      direccion: "cliente-1",
      idCliente: 1,
      nombre: "Ana",
      compras: 0,
      ventas: [],
    },
  ]);

  assert.equal(resumen.total_ventas_activas, 0);
  assert.equal(resumen.monto_total, 0);
  assert.equal(resumen.mejor_cliente, null);
});
