# HANDOFF — OBRA / eltiempoconstruye

Live: https://eltiempoconstruye.grok.me
Repo: https://github.com/dinepiyini-max/eltiempoconstruye

Runtime: TypeScript / React. Gana `src/lib/obra/sim.ts` si un texto discrepa.
Libreta: localStorage del navegador. Sin red, sin POST, sin endpoint.

## PR1 (este pase)

| # | Ítem | Veredicto |
|---|---|---|
| 1 | LEVANTA EL TERRENO: estado LEVANTANDO… + %; al terminar desaparece TERRENO SIN LEVANTAR; flash en el mapa. | **OK** si el gesto corre en tiempo real con el reloj en PAUSA |
| 2 | Elegir CAMINO/PUENTE/MURO muestra sello FIRMAR CONTRATO + toast «Frente firmado». | **OK** |
| 3 | Hasta firmar el primer frente el reloj está en PAUSA. Luego NORMAL. Texto: «El reloj no espera — tú decides cuándo soltarlo.» | **OK** |
| 4 | Hoja CONTRATOS: 3 tarjetas completas, sin vacío al scroll. | **OK** |
| 5 | Añadir TOP: disabled + «SIN TOP EN RESERVA» si count=0. | **OK** |

## Fe del motor (no UI)

| Ítem | Veredicto |
|---|---|
| Reloj NORMAL / LENTO / PAUSA | **OK** |
| Sin frente firmado = PAUSA forzada | **OK** |
| Foco libreta = PAUSA | **OK** |
| Inventario = cuello | **OK** |
| Un plazo de crecida `floodLine()` | **OK** |
| Libreta local, sin red | **OK** |
| Dos saves `obra.jefe` / `obra.visita` | **OK** |

## No se toca

No idle. No frentes nuevos. No endpoint. No PWA. No seed. No pantalla de victoria. No 4º contrato. No oficios nuevos.

## Dónde está cada regla

- Reloj, cuellos, pedidos, personal, crecida, levante: `src/lib/obra/sim.ts`
- Pace, foco, cambio de hoja, NUEVA PARTIDA: `src/lib/obra/store.ts`
- Saves: `src/lib/obra/persist.ts` — claves `obra.jefe` / `obra.visita`
- Tests: `src/lib/obra/persist.test.ts`

## FALLA conocida

El badge «Created with Grok / Remix» lo inyecta la plataforma. No se oculta.
