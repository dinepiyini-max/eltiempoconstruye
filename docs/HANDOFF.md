# HANDOFF — OBRA / eltiempoconstruye

Live: https://eltiempoconstruye.grok.me
Repo: https://github.com/dinepiyini-max/eltiempoconstruye

Runtime: TypeScript / React. Gana `src/lib/obra/sim.ts` si un texto discrepa.
Libreta: localStorage del navegador. Sin red, sin POST, sin endpoint.

## Este pase (motor + libreta local + repo)

| # | Ítem | Veredicto |
|---|---|---|
| 1 | Draft de la libreta sobrevive PLANO↔OBRA↔CONTRATOS↔ARCHIVO. Dock a la derecha. Tipos BUG·MEJORA·DUDA·NOTA. N pausa el reloj al escribir. NUEVA PARTIDA pregunta conservar notas (default SÍ). | **OK** |
| 2 | Inventario = cuello. Si el stock cubre, no dice FALTA ACERO / FALTA HORMIGÓN. Pedido honesto si aún falta. | **OK** |
| 3 | Cambiar de hoja no gasta horas de sitio. Reloj NORMAL / LENTO / PAUSA. `setPage` toca `realLastSeen`. `applyElapsed` no corre en PAUSA ni con foco en la nota. | **OK** |
| 4 | Un solo plazo de crecida: `floodLine()` → `CRECIDA Q50 · faltan N días` (o hoy / A SALVO / INCUMPLIDO). Cabecera, contratos y ficha leen la misma cifra. | **OK** |
| 5 | Código completo en GitHub `main`. README fusionado (se conserva el título `# eltiempoconstruye`). | **OK** si el commit de este handoff está en `main` |

## Fe del motor (no UI)

| Ítem | Veredicto |
|---|---|
| Reloj NORMAL / LENTO / PAUSA | **OK** |
| Foco libreta = PAUSA | **OK** |
| Asignar personal disabled + razón en una línea si no hay disponibles | **OK** |
| Ficha del plano se reabre (chips + hit 44 px + clic en papel cierra) | **OK** |
| Dos saves `obra.jefe` / `obra.visita`, no se mezclan | **OK** |
| Tope de ausencia 8 h reales | **OK** |
| Tres contratos V1 (camino, puente, muro). Firmar no cobra peaje. | **OK** |
| Libreta sin fetch / POST / endpoint | **OK** |

## No se toca

No idle. No UI dulce. No edificios nuevos. No 4º contrato. No oficios nuevos. No tutorial. No anuncios de personal. No endpoint de libreta.

## Dónde está cada regla

- Reloj, cuellos, pedidos, personal, crecida: `src/lib/obra/sim.ts`
- Pace, foco, cambio de hoja, NUEVA PARTIDA: `src/lib/obra/store.ts`
- Saves: `src/lib/obra/persist.ts` — claves `obra.jefe` / `obra.visita`
- Tests de fe: `src/lib/obra/persist.test.ts` (`npx tsx --test src/lib/obra/persist.test.ts`)
- Dock libreta: `src/components/obra/Libreta.tsx` (siempre montado; draft en estado local)

## FALLA conocida

El badge «Created with Grok / Remix» lo inyecta la plataforma. No se oculta.
