# HANDOFF — OBRA / eltiempoconstruye

Live: https://eltiempoconstruye.grok.me
Repo: https://github.com/dinepiyini-max/eltiempoconstruye

Runtime: TypeScript / React. Gana `src/game/sim.ts` si un texto discrepa.
Libreta: localStorage del navegador. Sin red, sin POST, sin endpoint.

## Este pase (motor + libreta local + repo)

| # | Ítem | Veredicto |
|---|---|---|
| 1 | Draft de la libreta sobrevive cerrar el dock y cambiar de hoja. Dock a la derecha. Tipos BUG·MEJORA·DUDA·NOTA. Foco en el campo pausa el reloj. NUEVA PARTIDA pregunta conservar notas (default SÍ). | **OK** |
| 2 | Inventario = cuello. Si el stock cubre, no dice FALTA ACERO / FALTA HORMIGÓN. Si `paidStage` es la etapa actual, inventario 0 tampoco es FALTA. Pedido honesto si aún falta. | **OK** |
| 3 | Cambiar de hoja no gasta horas de sitio. Reloj NORMAL / LENTO / PAUSA. `setPage` no llama `advanceMinutes`. | **OK** |
| 4 | Un solo plazo de crecida: `floodLine()` → `CRECIDA Q50 · faltan N días` (o hoy / OBRA A SALVO / PLAZO INCUMPLIDO). Solo el cajetín lo muestra. | **OK** |
| 5 | Código completo en GitHub `main`. README fusionado (se conserva el título `# eltiempoconstruye`). | **OK** si el commit de este handoff está en `main` |

## Fe del motor (no UI)

| Ítem | Veredicto |
|---|---|
| Reloj NORMAL / LENTO / PAUSA | **OK** |
| Foco libreta = PAUSA | **OK** |
| Asignar personal disabled + razón en una línea si no hay disponibles | **OK** |
| Ficha del plano se reabre (plano montado, `selected` sobrevive) | **OK** |
| Dos saves `obra.jefe` / `obra.visita`, no se mezclan | **OK** |
| Tope de ausencia 8 h reales | **OK** |
| Tres contratos V1 (camino, puente, muro). Firmar no cobra peaje. | **OK** |
| Libreta sin fetch / POST / endpoint | **OK** |

## No se toca

No idle. No UI dulce. No edificios nuevos. No 4º contrato. No oficios nuevos. No tutorial. No anuncios de personal. No endpoint de libreta.

## Dónde está cada regla

- Reloj, cuellos, pedidos, personal, crecida: `src/game/sim.ts`
- Pace, foco, cambio de hoja, NUEVA PARTIDA: `src/game/store.ts`
- Saves y draft: `src/game/persist.ts` — claves `obra.jefe` / `obra.visita` / `obra.{slot}.draft`
- Tests de fe: `src/game/faith.test.ts` (`node --experimental-strip-types --test src/game/faith.test.ts`)
- Dock libreta: `src/components/obra/libreta.tsx` (draft en localStorage)

## FALLA conocida

El badge «Created with Grok / Remix» lo inyecta la plataforma. No se oculta.
