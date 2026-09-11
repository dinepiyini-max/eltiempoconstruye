# eltiempoconstruye

**OBRA** — lámina de ingeniería viva del Valle del Yuna.

El tiempo construye. Tú decides qué merece ser construido.

- Live: [eltiempoconstruye.grok.me](https://eltiempoconstruye.grok.me)
- Repo: [github.com/dinepiyini-max/eltiempoconstruye](https://github.com/dinepiyini-max/eltiempoconstruye)

## Qué es

Te nombra jefe de obra el Consorcio Municipal del Valle del Yuna. Encargo: conectar la terraza aluvial con el cerro norte **antes de la crecida Q50** (día 12 de sitio). Tres frentes del pliego: camino, puente, muro. No es idle. No hay ranking. Se gana cuando la pieza entra al ARCHIVO.

Hojas: **PLANO · OBRA · CONTRATOS · ARCHIVO**. LIBRETA es un panel de campo, no una hoja.

Emplazamiento de estudio · no corresponde a un predio real.

## Reloj y fe

- Hasta firmar el primer frente el reloj está en **PAUSA**. Texto: «El reloj no espera — tú decides cuándo soltarlo.» Luego NORMAL.
- Ritmo **NORMAL / LENTO / PAUSA**. Cambiar de hoja no gasta horas de sitio.
- Escribir en la libreta pausa el reloj. Al salir, el ritmo previo.
- Un solo contador: `CRECIDA Q50 · faltan N días`. El plazo de un frente se llama «obra estimada del frente».
- Si hay acero u hormigón para el gesto, el cuello no dice FALTA. Nombra la causa real (lluvia, personal, etapa, lote).
- El material solo baja con un gesto o evento que dice qué y cuánto. El viaje nombra destino (almacén / frente) y por qué no se usa si aplica.
- Sin personal en disponibles: el botón queda disabled, con la razón en una línea. TOP vacío: «SIN TOP EN RESERVA».
- La ficha del plano se reabre siempre (clic en la pieza o en CAMINO / PUENTE / MURO).
- F5 / cerrar 30 s: misma fase, mismo día, mismos frentes. Si localStorage falla, toast.

## Libreta

Dock a la derecha. Tipos **BUG · MEJORA · DUDA · NOTA**. El draft no se pierde al cambiar de hoja. NUEVA PARTIDA pregunta «¿Conservar notas locales?». Vive solo en el navegador. Sin red, sin POST.

## Saves

Dos cajas, nunca una: `obra.jefe` y `obra.visita` (`?modo=visita`). Sin cuentas. Sin servidor de partida.

## Motor

TypeScript. El reloj está en `src/lib/obra/sim.ts`. Persistencia en `src/lib/obra/persist.ts`. El mapa del sistema: `src/lib/obra/index.ts` y `src/lib/obra/ARQUITECTURA.md`. Handoff: [`docs/HANDOFF.md`](docs/HANDOFF.md).
