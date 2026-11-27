# Evidencia de interacción del agente — 26 de noviembre de 2026

Validación realizada en `agent/` contra Solana Devnet con Groq. La transcripción
incluye el typecheck, las 7 pruebas automatizadas, la consulta directa y las
preguntas al agente.

PS D:\DevWayLearn\ProyectoTaller1\RegistroVentasAgent\agent> npm run typecheck
npm notice run registro-ventas-agent@1.0.0 typecheck
npm notice run tsc --noEmit -p .
PS D:\DevWayLearn\ProyectoTaller1\RegistroVentasAgent\agent> npm test
npm notice run registro-ventas-agent@1.0.0 test
npm notice run node --import tsx --test tests/*.test.ts
✔ configura OpenAI en línea con el modelo predeterminado (1.4678ms)
✔ configura LM Studio con el endpoint y modelo local (0.246ms)
✔ configura Groq en línea con el modelo predeterminado (0.1469ms)
✔ rechaza el modo OpenAI si falta la API key (0.5469ms)
✔ rechaza Groq si falta su API key (0.1575ms)
✔ suma las ventas activas y conserva a todos los clientes empatados (1.0925ms)
✔ no declara mejor cliente si no hay ventas activas (0.0984ms)
ℹ tests 7
ℹ suites 0
ℹ pass 7
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 6500.4297
PS D:\DevWayLearn\ProyectoTaller1\RegistroVentasAgent\agent> npm run prueba
npm notice run registro-ventas-agent@1.0.0 prueba
npm notice run tsx src/prueba.ts
bigint: Failed to load bindings, pure JS will be used (try npm run rebuild?)
◇ injected env (8) from .env.taller1 // tip: ◈ encrypted .env [www.dotenvx.com]
{
  "existe": true,
  "negocio": "Cafe WayLearn D1",
  "direccion": "AfdeVrAE5GWvpYFK4FCKvErRYq4rneh6WFvJMtkGk2Qc",
  "total_clientes": 2,
  "total_ventas_activas": 2,
  "monto_total": 100,
  "mejor_cliente": {
    "compras": 1,
    "clientes": [
      {
        "direccion": "HGe5UK5q92KEsT62EAESGPhoux9brd7a8QEfpyhtqNdn",
        "idCliente": 1,
        "nombre": "Bodega Don Pepe"
      },
      {
        "direccion": "EpyKgQJsuiFEdm5msRo96eZ3UP57KCXofuFbZVwtRdDz",
        "idCliente": 2,
        "nombre": "Ana Torroja"
      }
    ]
  },
  "clientes": [
    {
      "direccion": "HGe5UK5q92KEsT62EAESGPhoux9brd7a8QEfpyhtqNdn",
      "idCliente": 1,
      "nombre": "Bodega Don Pepe",
      "compras": 1,
      "ventas": [
        {
          "direccion": "9Pn67yC5yDgNHXj9B1Qfvc6ZqjariYryyyW3tj1jREym",
          "sku": "CAF01",
          "descripcion": "Cafe americano",
          "monto": 50
        }
      ],
      "total_ventas_activas": 1,
      "monto_total": 50
    },
    {
      "direccion": "EpyKgQJsuiFEdm5msRo96eZ3UP57KCXofuFbZVwtRdDz",
      "idCliente": 2,
      "nombre": "Ana Torroja",
      "compras": 1,
      "ventas": [
        {
          "direccion": "GvobcgAZjw9C91K1DiscDvc35RkNo8M7FfEP24z56LPp",
          "sku": "CAF01",
          "descripcion": "Cafe americano",
          "monto": 50
        }
      ],
      "total_ventas_activas": 1,
      "monto_total": 50
    }
  ]
}
PS D:\DevWayLearn\ProyectoTaller1\RegistroVentasAgent\agent> npm run start
npm notice run registro-ventas-agent@1.0.0 start
npm notice run tsx src/agent.ts
bigint: Failed to load bindings, pure JS will be used (try npm run rebuild?)
◇ injected env (8) from .env.taller1 // tip: ⌘ multiple files { path: ['.env.local', '.env'] }
Agente RegistroVentasAgent listo. Escribe 'exit' para salir.
Proveedor LLM: Groq.
Acción disponible: REGISTRO_RESUMEN_NEGOCIO
> Cuantos clientes tiene mi negocio?

Agente: Tu negocio **Cafe WayLearn D1** tiene **2 clientes**:

1. **Bodega Don Pepe** (idCliente 1)
2. **Ana Torroja** (idCliente 2)

Ambos tienen 1 venta activa cada uno (Café americano, $50), por lo que están empatados como mejor cliente.

Cuantas ventas activas hay ?

Agente: Hay **2 ventas activas** en total, por un monto total de **$100**:

- **Bodega Don Pepe**: 1 venta activa (Café americano, $50)
- **Ana Torroja**: 1 venta activa (Café americano, $50)

> Cuanto suman las ventas activas ?
>
Agente: Las ventas activas suman **$100** en total:

- Bodega Don Pepe: $50
- Ana Torroja: $50

>