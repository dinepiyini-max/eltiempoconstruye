# HANDOFF — OBRA / eltiempoconstruye

Live: https://eltiempoconstruye.grok.me
Repo: https://github.com/dinepiyini-max/eltiempoconstruye

Runtime: TypeScript / React vía AppShell (`src/routes/index.tsx`) + `src/lib/obra/*`.
Gana `src/lib/obra/sim.ts` si un texto discrepa.
Libreta: localStorage del navegador. Sin red, sin POST, sin endpoint.

Canon de este hilo: **no** `src/game`. No se reescribe de cero.

## FASE 1 — salida de beta

Commit: https://github.com/dinepiyini-max/eltiempoconstruye/commit/5293a0fb8788b383a4414268ab0d3272b3d193b5
Live bundle al verificar: `routes-DL6-SBK1.js`

1. Cajetín, 1 línea: `Pliego v1 · Camino, Puente y Muro. Ampliar la obra = versión posterior.`
2. Lámina de cierre (panel, no fireworks): `OBRA A SALVO` o `PLAZO INCUMPLIDO` + día, prestigio, frentes + 1 frase + NUEVA PARTIDA. SEGUIR deja ver el valle.
3. Día 8, si <2 frentes pasada excavación: banner `La crecida no negocia.`

No se tocó: persist, REANUDA, badge Q50, `__obra`, idle, PWA, 4º contrato.

Prueba en live (grok.me), 11 sep 2026:
- Alcance visible sin hover.
- Reloj cruzando el día 12 con el pliego abierto → lámina PLAZO INCUMPLIDO + NUEVA PARTIDA.
- Reloj cruzando el día 8 con 1 frente en excavación → banner «La crecida no negocia.»
- NUEVA PARTIDA desde la lámina cierra el panel y reinicia el valle.

| # | Ítem | Preview | Live grok.me |
|---|---|---|---|
| 1 | Alcance v1 visible en el cajetín | **OK** | **OK** |
| 2 | Lámina al ganar o al vencer el plazo; NUEVA PARTIDA desde la lámina | **OK** | **OK** |
| 3 | Aviso día 8 si <2 frentes pasada excavación | **OK** | **OK** |

## Este pase (FASE 0)

1. `window.__obra` solo si `import.meta.env.DEV` (import dinámico de `inspect-obra.ts`). En prod no existe. Solo `get` / `slot` / `keys`. Sin mutators.
2. Banner REANUDA (JEFE): `hydrate` con save siempre setea `resumeLine`. Encima de OBRA. Texto `REANUDA · Día NN · Fase X · firmados: …`. Visible ≥ 8 s. Solo **CERRAR / ×**. Click en el cajetín no lo tira. Hard reload lo vuelve a mostrar.






| # | Ítem | Build prod / preview | Live grok.me |
|---|---|---|---|
| A | `typeof window.__obra === "undefined"` en prod | **OK** | **FALLA** — grok.me aún expone el hook (bundle `routes-CEbVtfy4.js`). Este commit lo saca del grafo de prod. |
| B | JEFE: firmar → F5 → banner ≥ 8 s + CERRAR | **OK** | **OK** |
| C | hard reload → banner otra vez | **OK** | **OK** |





## Pase 6


Commit: https://github.com/dinepiyini-max/eltiempoconstruye/commit/84431440fd8fd0d6379b547168a6cc119f9f7fd9

Código en `main` y en la lámina de este chat. grok.me, al momento de esta prueba, seguía sirviendo BETA FINAL (`/assets/routes-C2SFPbA8.js`). El veredicto **en vivo** es el de grok.me.

| # | Ítem | Repo / preview | Live grok.me |
|---|---|---|---|
| 1 | Transferir TOP: de→a explícito. Toast `TOP → [frente]`. No ciclar la fila. | **OK** | **FALLA** — sigue «cambiar frente», no hay `transferTop` |
| 2 | Toasts partidos: `Material recibido · [destino]` distinto de `Aún no se usa: [cuello]`. | **OK** | **FALLA** — un solo toast «Llegó un viaje de hormigón…» |
| 3 | Tecla N: dock sin overflow horizontal a 1280×800. | **OK** | **OK** |
| 4 | Badge fijo `CRECIDA Q50 · faltan N días` visible junto al título. | **OK** | **FALLA** — el sello sigue rotado, no `stamp-flat` |
| 5 | Al reanudar: banner 1 línea (día, fase, frentes firmados). | **OK** | **FALLA** — no hay REANUDA |
| 6 | hydrate/persist allowlist. F5 tras firmar no vuelve a Día 01 / partida nueva. | **OK** | **OK** (persistencia BETA FINAL ya lo cubría) |

Prueba de fuego (repo): firmar PUENTE → F5 → sigue PUENTE, NORMAL, instrucción `dirige`.
Prueba de fuego (live): **OK** — no vuelve a Día 01.

Cuando la plataforma reconstruya grok.me con este commit, 1–5 deben pasar al mismo nivel que el preview.

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

No idle. No frentes nuevos. No endpoint. No PWA. No seed. No 4º contrato. No oficios nuevos. No tutorial modal.

## Dónde está cada regla

- Reloj, cuellos, pedidos, personal, crecida, levante, `paidStage`, `transferTop`, `composeResumeLine`, `composeCierre`, `crecidaNoNegocia`: `src/lib/obra/sim.ts`
- Pace, foco, cambio de hoja, NUEVA PARTIDA, toast de viaje / save-fail / TOP: `src/lib/obra/store.ts`
- Saves: `src/lib/obra/persist.ts` — claves `obra.jefe` / `obra.visita`. `snapshotState` allowlist. `saveState` → `boolean`.
- Mapa sin glifos ajenos: `src/lib/obra/draw.ts`
- Tests: `src/lib/obra/persist.test.ts` (41)
- QA Playwright: `artifacts/pass6-qa.mjs` (8/8 en preview)

## FALLA conocida

El badge «Created with Grok / Remix» lo inyecta la plataforma. No se oculta.
grok.me puede ir detrás de `main` hasta el próximo rebuild.
