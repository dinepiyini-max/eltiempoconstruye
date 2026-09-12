# OBRA V2 — FASE A · auditoría

Pase de lectura. **No hay código de juego en este commit.**
Canon: `src/lib/obra/*` + AppShell. Yuna no se borra. No hay editor. No hay muros dibujables.

Live: https://eltiempoconstruye.grok.me
Repo: https://github.com/dinepiyini-max/eltiempoconstruye

## Cadena terreno → archivo (V1, la que V2 hereda)

Una dirección. Si un texto discrepa, gana `sim.ts`.

```
terrain.ts          geometría fija del valle (height, RIVER, CAMINO, MURO). No es save.
        ↓
FirstGesture        LEVANTA EL TERRENO → store.startSurvey → sim.tickSurveyReal
        ↓
draw.ts             lee estado y pinta. No muta. Glifos no-V1 (cimentación/planta/viaducto) solo si opened.
        ↓
pliego.ts           mandante, Q50, tres frentes. catalog.ts: horas, acero, hormigón, salarios.
        ↓
signFirst           sello = contrato. No cobra peaje. Reloj suelta PAUSA → NORMAL.
        ↓
sim.tickFront       una etapa por tick. enterStageCosts descuenta almacén. bottleneckOf nombra el cuello.
        ↓
completeStructure   prestigio, conocimiento, pushPlate → archive[]
        ↓
Archivo.tsx         láminas. CierreLamina.tsx si floodStatus = a-salvo | incumplido.
persist.ts          allowlist version:1 → localStorage obra.jefe | obra.visita
```

Hojas: PLANO · OBRA · CONTRATOS · ARCHIVO. LIBRETA es dock, no hoja.
AppShell monta SimHost + TitleBlock + hojas. `src/routes/index.tsx` solo elige slot jefe/visita.

Hoy **no hay medición**. `STRUCTURE_DEF` trae m³ y t fijos. `totals` acumula lo que el reloj descuenta. El ARCHIVO cita el catálogo, no un takeoff del terreno.

---

## 1) Módulos reutilizables

Puros o de chrome. V2 los llama; no los reescribe.

| Módulo | Qué da a V2 | No hacer |
|---|---|---|
| `terrain.ts` | `height()`, `Pt`, `dist`, `MAP_W/H`, muestreo | no editar `RIVER` / `CAMINO` / `MURO` |
| `format.ts` | reloj, `pad2`, enteros | — |
| `draw.ts` `paletteFrom` | tinta del plano | no meter editor ni hit-test de muro libre |
| `persist.ts` patrón de slot | dos cajas, allowlist, `saveState` → boolean | no ensanchar `version: 1` de Yuna |
| `store.ts` / `SimHost.tsx` | hydrate, catchUp, flush, rAF | no compartir `advance` de Yuna con otro modo |
| `TitleBlock` / `Libreta` / `Toast` / `NuevaPartida` | cajetín, notas, confirmación | no mezclar Q50 ni REANUDA en otro modo |
| `sim.ts` honestidad | `bottleneckOf`, `enterStageCosts`, un tick = una etapa | no tocar lluvia / FALTA / HARD_STOP |
| `pliego.ts` | forma de un encargo (mandante, amenaza, tesis) | no añadir 4º frente al pliego Yuna |
| `types.ts` `ArchivePlate` | sello, materiales, costo, método | campos nuevos = otra placa o otro slot |

No reutilizable como producto V2: `V1_CONTRACT_IDS`, `FLOOD.day = 12`, `settleFlood`, `CierreLamina` (tres frentes / Q50), `STRUCTURE_IDS` extra (cimentación, planta, viaducto) ocultos a propósito.

---

## 2) Qué se extiende vs intacto

**Intacto (contrato Yuna):**

- Polilíneas y `height()` del valle.
- Pliego v1: Camino, Puente, Muro. Texto del cajetín.
- Reloj 8 min de sitio / s, PAUSA hasta el primer sello, NORMAL/LENTO.
- Un solo `floodLine()` / badge Q50. Día 8 «La crecida no negocia.»
- Lluvia: vertido = `LLUVIA — NO SE VIERTE`; resto sigue.
- Persist `obra.jefe` / `obra.visita`, allowlist, F5.
- REANUDA, lámina de cierre, NUEVA PARTIDA (conserva libreta).
- `window.__obra` solo DEV.
- AppShell de las cuatro hojas.

**Se extiende (lado, no encima):**

- Librerías nuevas bajo `src/lib/obra/v2/` (geometry, quantity, cost).
- Un **modo** nuevo, no un 4º contrato del valle.
- Tests propios. Cero cambios a `sim.ts` / `persist.ts` / `draw.ts` / polilíneas.

**No es V2:** editor de trazas, muros dibujables, borrar el Yuna, idle, PWA, seed, oficios nuevos, late-game (planta/viaducto) como producto.

---

## 3) Riesgos

**Reloj.** `store.advance` es el reloj de Yuna. Si NUEVA OBRA vive en el mismo Zustand, un modo pausa o acelera el otro. FASE B: V2 no se engancha a `advance` ni a `siteMinutes` de Yuna.

**F5.** `snapshotState` es allowlist `version: 1`. Un campo nuevo en `GameState` se pierde al guardar. Meter Geometry/Quantity/Cost en `obra.jefe` rompe la prueba de fuego (firmar → F5). FASE B no toca persist. Un slot futuro (`obra.nueva`) sería FASE posterior, no B.

**Q50.** Un segundo plazo o un segundo sello en el cajetín viola «un solo CRECIDA Q50». NUEVA OBRA no reusa `floodLine` ni el badge.

**Lluvia.** El orden en `bottleneckOf` (lluvia de vertido **antes** de FALTA HORMIGÓN) es fe del motor. Un takeoff V2 que descuente hormigón en `estructura` bajo lluvia reabre G+H. Quantity/Cost de V2 no llaman `enterStageCosts`.

**Lámina.** `CierreLamina` / `composeCierre` asumen tres frentes V1 y `floodStatus`. Un presupuesto V2 no es OBRA A SALVO. ARCHIVO de Yuna no recibe placas V2 en B.

Otros: `resetValley` borra el valle y conserva notas — no debe borrar un modo que no es el valle. `draw.ts` + hit-test del canvas: un editor aquí pisa el plano Yuna.

---

## 4) Dónde encajar Geometry / Quantity / Cost

Cadena V2 deseada, **paralela** a la de Yuna:

```
terrain.height + polilínea     →  Geometry (medir)
        ↓
largo / sección / corte-terraplén  →  Quantity (takeoff m³, t)
        ↓
takeoff × precios unitarios    →  Cost (presupuesto)
        ↓
(más adelante) placa de archivo del modo nuevo
```

| Capa | Sitio | Entrada | Salida | No entra |
|---|---|---|---|---|
| **Geometry** | `src/lib/obra/v2/geometry.ts` | `Pt[]`, `height(x,y)` | largo, cotas, área, corte/terraplén (números) | React, save, hit-test |
| **Quantity** | `src/lib/obra/v2/quantity.ts` | resultado Geometry + tablas V2 propias | m³ excavación, m³ hormigón, t acero | `STRUCTURE_DEF` de Yuna, `resources.*` |
| **Cost** | `src/lib/obra/v2/cost.ts` | Quantity + precios V2 | presupuesto, unitarios, subtotales | `resources.dinero`, nómina Yuna |

Yuna hoy: Quantity ≈ constantes de `catalog.ts`; Cost ≈ salarios + `SUPPLY` + `costAccrued`. Eso se queda. V2 no sustituye el almacén del cajetín.

Las tablas V2 (rendimientos, precios) viven en `v2/`, no en `pliego.ts`.

---

## 5) Yuna = contrato; NUEVA OBRA = modo nuevo

**Yuna es un contrato cerrado.** El Consorcio ya encargó camino, puente y muro contra la Q50. Ampliar ese pliego es versión posterior del *valle*, no V2. El río no se borra. El muro del cerro no se redibuja.

**NUEVA OBRA es otro modo.** Misma tesis (*el tiempo construye*), otra pieza, otro encargo. Como `?modo=visita` es otra caja y no pisa `obra.jefe`, NUEVA OBRA no pisa el pliego V1.

| | Yuna (contrato) | NUEVA OBRA (modo) |
|---|---|---|
| Save | `obra.jefe` / `obra.visita` | no en FASE B; luego caja propia |
| Reloj | sitio del valle, Q50 día 12 | no comparte `advance` |
| Terreno | `terrain.ts` tal cual | puede *leer* `height()`; no reescribe el mapa |
| Frentes | 3 sellos | no es un 4º sello en CONTRATOS |
| Cierre | OBRA A SALVO / PLAZO INCUMPLIDO | no esa lámina |
| NUEVA PARTIDA | reinicia el valle | no borra el modo nuevo |

FASE B no añade la UI del modo. Solo deja las tres librerías listas para que el modo no nazca dentro de `sim.ts`.

---

## 6) Plan FASE B (≤15 líneas)

1. Crear `src/lib/obra/v2/{geometry,quantity,cost}.ts` — funciones puras, sin React ni `localStorage`.
2. `geometry`: largo de `Pt[]`, muestras de `height()`, corte/terraplén numérico; fixtures = copias de prueba, **no** mutar `RIVER`/`MURO`.
3. `quantity`: takeoff desde Geometry con tablas propias en `v2/tables.ts`.
4. `cost`: takeoff × unitarios → presupuesto; no toca `resources.dinero`.
5. Tests node en `src/lib/obra/v2/*.test.ts` (largo > 0, m³ ≥ 0, costo = Σ qty×precio).
6. **Cero** edits a `sim.ts`, `persist.ts`, `draw.ts`, `terrain.ts`, `store.ts`, AppShell, pliego Yuna.
7. Un test de regresión: hydratar un save Yuna V1 sigue igual (día, frentes, Q50).
8. Export barril `src/lib/obra/v2/index.ts`. Nada en `window`. Nada en `STRUCTURE_IDS`.
9. Sin UI, sin editor, sin hit-test nuevo, sin 4º contrato, sin C+.
10. Parar. El modo NUEVA OBRA (ruta, slot, lámina) no es FASE B.

---

## Fuera de alcance (recordatorio)

No editor. No muros dibujables. No borrar Yuna. No idle. No endpoint. No PWA. No seed. No late-game. No oficios. No `__obra`. No ensanchar persist Yuna. No REANUDA. No badge Q50. No FASE C+.
