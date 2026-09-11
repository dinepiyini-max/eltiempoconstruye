# HANDOFF — OBRA / eltiempoconstruye

Live: https://eltiempoconstruye.grok.me
Repo: https://github.com/dinepiyini-max/eltiempoconstruye

Runtime: TypeScript / React vía AppShell (`src/routes/index.tsx`) + `src/lib/obra/*`.
Gana `src/lib/obra/sim.ts` si un texto discrepa.
Libreta: localStorage del navegador. Sin red, sin POST, sin endpoint.

Canon de este hilo: **no** `src/game`. No se reescribe de cero.

## Pase 6

Commit: https://github.com/dinepiyini-max/eltiempoconstruye/commit/4d7e45df44e88743f38e92bd0105af3d5a0b3945

| # | Ítem | Veredicto |
|---|---|---|
| 1 | Transferir TOP: de→a explícito. Toast `TOP → [frente]`. No ciclar la fila. | **OK** |
| 2 | Toasts partidos: `Material recibido · [destino]` distinto de `Aún no se usa: [cuello]`. | **OK** |
| 3 | Tecla N: dock sin overflow horizontal a 1280×800. | **OK** |
| 4 | Badge fijo `CRECIDA Q50 · faltan N días` visible junto al título. | **OK** |
| 5 | Al reanudar: banner 1 línea (día, fase, frentes firmados). | **OK** |
| 6 | hydrate/persist allowlist. F5 tras firmar no vuelve a Día 01 / partida nueva. | **OK** |

Prueba de fuego: firmar PUENTE → F5 → sigue PUENTE, NORMAL, instrucción `dirige`.

## BETA FINAL

Commit: https://github.com/dinepiyini-max/eltiempoconstruye/commit/6e8a9d57df60627c7995e49994f5eb7c5cb300ff


| # | Ítem | Veredicto |
|---|---|---|
| 1 | Hasta FIRMAR el primer frente el reloj está en PAUSA. Texto: «El reloj no espera — tú decides cuándo soltarlo.» Luego NORMAL. | **OK** |
| 2 | LEVANTA EL TERRENO: LEVANTANDO… + %; al terminar desaparece «TERRENO SIN LEVANTAR»; flash en el mapa. | **OK** |
| 3 | Elegir CAMINO / PUENTE / MURO: sello FIRMAR CONTRATO + toast «Frente firmado». | **OK** |
| 4 | CONTRATOS: 3 tarjetas completas, FIRMAR usable sin clipping. | **OK** |
| 5 | Si hay hormigón/acero suficiente para el gesto, NUNCA «FALTA HORMIGÓN/ACERO» ni «Sin hormigón no se vierte.» El cuello nombra la causa real. `paidStage` evita el falso FALTA tras pagar. | **OK** |
| 6 | Material solo baja con gesto visible o evento que dice qué y cuánto (`lastNotice` / cuerpo del evento). | **OK** |
| 7 | Viaje de material: toast con destino (almacén / frente) y por qué no se usa si aplica. | **OK** |
| 8 | Cambiar hoja no gasta horas. Libreta en foco = PAUSA; al salir, ritmo previo. | **OK** |
| 9 | Añadir TOP disabled + «SIN TOP EN RESERVA» si count=0. | **OK** |
| 10 | Un solo «CRECIDA Q50 · faltan N días». | **OK** |
| 11 | Sin glifos de cimentación / planta / viaducto / ensayo en mapa ni leyenda si no hay sello. | **OK** |
| 12 | Cajetín: «Emplazamiento de estudio · no corresponde a un predio real.» | **OK** |
| 13 | Glosa visible (no solo hover): Q50, TOP, cuello. | **OK** |
| 14 | ARCHIVO vacío: «Aquí irán los frentes cerrados. Aún no hay ninguno.» | **OK** |
| 15 | F5 / cerrar 30 s: misma fase, día, frentes. Si localStorage falla, toast. NUEVA PARTIDA pregunta «¿Conservar notas locales?». Skip de ausencia = 45 s. | **OK** |

## Fe del motor (reglas)

| Ítem | Veredicto |
|---|---|
| Reloj NORMAL / LENTO / PAUSA | **OK** |
| Sin frente firmado = PAUSA forzada | **OK** |
| Foco libreta = PAUSA (no muta `clockPace`) | **OK** |
| Inventario = cuello solo si `paidStage !== stage` | **OK** |
| Un plazo de crecida `floodLine()` | **OK** |
| Libreta local, sin red | **OK** |
| Dos saves `obra.jefe` / `obra.visita` | **OK** |

## No se toca

No idle. No frentes nuevos. No endpoint. No PWA. No seed. No pantalla de victoria. No 4º contrato. No oficios nuevos. No tutorial modal.

## Dónde está cada regla

- Reloj, cuellos, pedidos, personal, crecida, levante, `paidStage`: `src/lib/obra/sim.ts`
- Pace, foco, cambio de hoja, NUEVA PARTIDA, toast de viaje / save-fail: `src/lib/obra/store.ts`
- Saves: `src/lib/obra/persist.ts` — claves `obra.jefe` / `obra.visita`. `saveState` → `boolean`.
- Mapa sin glifos ajenos: `src/lib/obra/draw.ts`
- Tests: `src/lib/obra/persist.test.ts` (33)
- QA Playwright: `artifacts/beta-qa.mjs` (20/20)

## FALLA conocida

El badge «Created with Grok / Remix» lo inyecta la plataforma. No se oculta.
