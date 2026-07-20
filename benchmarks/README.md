# Kanji Framework — Performance Benchmarks

Este documento recopila las pruebas de rendimiento y latencia del framework, comparándolas con los objetivos definidos en [ARCHITECTURE.md](file:///home/seba/Documentos/trabajo/arsian/kanji-v1/docs/context/ARCHITECTURE.md).

---

## Entorno de Pruebas

* **CPU:** Intel(R) Core(TM) i5-1135G7 @ 2.40GHz (4 cores / 8 threads)
* **OS:** Linux x64
* **Runtime:** Bun v1.3.14 (nativo)
* **Motor HTTP:** Hono + Kanji DI Container & Middleware Gateway

---

## Resultados de Latencia

Las pruebas fueron ejecutadas utilizando la librería de benchmarking de alta precisión `mitata` contra endpoints reales simulando peticiones HTTP con payload JSON:

| Operación / Endpoint | Tiempo Promedio por Iteración | Rango (Min ... Max) | p75 | p99 |
|---|---|---|---|---|
| **GET /users** (Simple Request) | **17.60 µs** | 8.51 µs … 1.54 ms | 17.82 µs | 55.76 µs |
| **POST /users** (Zod Validation) | **17.18 µs** | 15.23 µs … 19.61 µs | 17.68 µs | 18.52 µs |

---

## Comparación de Performance vs Targets

| Métrica | Target Arquitectónico | Resultado Obtenido | Estado |
|---|---|---|---|
| **Latencia de Inicio (Startup)** | `< 50ms` | **~10ms** | 🟢 Cumplido |
| **Sobrecarga de Middleware / Route Mapping** | `< 1ms` | **< 0.02ms (17.6 µs)** | 🟢 Cumplido |
| **Validación de Contratos Zod** | `< 5ms` | **< 0.02ms (17.1 µs)** | 🟢 Cumplido |

### Conclusiones
El rendimiento de Kanji se beneficia de la arquitectura basada en Hono y la compilación/resolución estática en tiempo de bootstrap del contenedor DI. La validación en tiempo de ejecución de esquemas complejos de Zod tiene un impacto prácticamente imperceptible, operando muy por debajo de los límites objetivo definidos en la especificación.
