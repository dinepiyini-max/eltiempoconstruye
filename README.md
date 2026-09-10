# eltiempoconstruye

**OBRA** — lámina de ingeniería viva del Valle del Yuna.

El tiempo construye. Tú decides qué merece ser construido.

- Live: [eltiempoconstruye.grok.me](https://eltiempoconstruye.grok.me)
- Repo: [github.com/dinepiyini-max/eltiempoconstruye](https://github.com/dinepiyini-max/eltiempoconstruye)

## Qué es

Te nombra jefe de obra el Consorcio Municipal del Valle del Yuna. Encargo: conectar la terraza aluvial con el cerro norte **antes de la crecida Q50** (día 12 de sitio). Tres frentes del pliego: camino, puente, muro. No es idle. No hay ranking. Se gana cuando la pieza entra al ARCHIVO.

Hojas: **PLANO · OBRA · CONTRATOS · ARCHIVO**. LIBRETA es un panel de campo, no una hoja.

No hay cuentas. No hay red. El valle vive en el navegador.

## Reloj y fe

- Ritmo **NORMAL / LENTO / PAUSA**. Cambiar de hoja no gasta horas de sitio.
- Escribir en la libreta pausa el reloj.
- Un solo contador: `CRECIDA Q50 · faltan N días`. El plazo de un frente se llama «obra estimada del frente».
- Si hay acero u hormigón, el cuello no dice FALTA. Si la etapa ya pagó el material, inventario 0 tampoco es FALTA.
- Sin personal en disponibles: el botón queda disabled, con la razón en una línea.
- La ficha del plano se reabre siempre (clic en la pieza o en CAMINO / PUENTE / MURO).

## Libreta

Dock a la derecha. Tipos **BUG · MEJORA · DUDA · NOTA**. El draft no se pierde al cambiar de hoja. NUEVA PARTIDA pregunta si conservar las notas. Vive solo en el navegador. Sin red, sin POST.

## Saves

Dos cajas, nunca una: `obra.jefe` y `obra.visita` (`?modo=visita`). Sin cuentas. Sin servidor de partida.

## Motor

TypeScript. El reloj y los cuellos están en [`src/game/sim.ts`](src/game/sim.ts). Persistencia en [`src/game/persist.ts`](src/game/persist.ts). Estado en [`src/game/store.ts`](src/game/store.ts). Tests de fe: [`src/game/faith.test.ts`](src/game/faith.test.ts). Handoff: [`docs/HANDOFF.md`](docs/HANDOFF.md).
