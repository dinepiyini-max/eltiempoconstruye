# Arquitectura de OBRA

Este archivo es el mapa para quien hereda el código. El **runtime es TypeScript**
(`sim.ts`). El preview del producto no ejecuta Python. Las reglas de abajo están
escritas como spec legible — si sim.ts y este texto discrepan, gana `sim.ts`.

## Por qué existe el valle

El Consorcio Municipal del Valle del Yuna te nombra jefe de obra. Encargo:
conectar la terraza aluvial con el cerro norte **antes de la crecida Q50**
(día 12 de sitio). Tres frentes del pliego: camino, puente, muro.

Tesis: *el tiempo construye; tú decides qué merece ser construido.*

## Capas (una dirección)

```
UI (React)  →  store.ts  →  sim.ts  →  GameState
                 │
                 └── persist.ts  →  localStorage (obra.jefe | obra.visita)
```

- `draw.ts` lee estado y pinta. No muta.
- `catalog.ts` / `pliego.ts` son constantes. No mutan.
- `terrain.ts` es geometría. No es save.

## Reloj

```python
# spec — implementado en sim.stepMinutes / store.advance
SITE_MINUTES_PER_REAL_SECOND = 8
OFFLINE_CAP_HOURS = 8

def advance(dt_sec):
    dt = min(dt_sec, 0.1)
    site_remainder += dt * 8
    whole = floor(site_remainder)
    if whole:
        site_remainder -= whole
        step_minutes(state, whole)

def step_minutes(state, minutes):
    for _ in range(minutes):
        tick_survey()
        for frente in STRUCTURE_IDS:
            tick_front(frente)
        refresh_contracts()
        settle_flood()   # a-salvo si 3 frentes conectados antes del día 12
                         # incumplido si llega el día 12 sin ellos
```

Pestaña oculta: `flush` (salva). Pestaña visible otra vez: `applyElapsed`
(el valle siguió, tope 8 h reales).

## Pedidos (hormigón / acero)

No es idle. Cada viaje cuesta dinero. El botón vive **siempre** en el cajetín
(hormigón y acero del HUD), no solo cuando un cuello dice FALTA HORMIGÓN.

```python
def order_supply(state, kind):  # "hormigon" | "acero"
    spec = SUPPLY[kind]
    if state.dinero < spec.cost:
        return False
    state.dinero -= spec.cost
    state[kind] += spec.qty
    return True
```

Sin hormigón no se entra a `estructura`. Sin acero no se entra a `armado`.
Eso es un tope duro (`HARD_STOP`), no un texto decorativo. El cuello solo
dice FALTA si `paidStage !== stage` y el almacén no cubre. Pagada la etapa,
el inventario vacío no miente FALTA. Cada cargo deja `lastNotice` con
cantidad; cada viaje nombra destino (almacén / frente).

## Contratos = frentes del pliego

CAMINO / PUENTE / MURO son los mismos sellos del primer minuto. Firmar en
CONTRATOS llama a `signFirst` (no cobra peaje). El costo listado es presupuesto.
El dinero se gasta en nómina y pedidos.

Un contrato está `bloqueado` hasta `LEVANTA EL TERRENO`. Luego `disponible`.
Al sello: `activo`. Al `conexion`: `cumplido` y lámina en ARCHIVO.

`durationDays` muerde: si cierras después del plazo, el prestigio se parte
y la lámina lleva sello TARDÍO.

## Crecida

`floodStatus`: `pendiente` → `a-salvo` | `incumplido`.

No es game-over. Si incumples, el ritmo baja (`× 0.62`) y sale la lámina de
cierre (panel: sello, día, prestigio, frentes, una frase, NUEVA PARTIDA).
SEGUIR deja ver el valle. NUEVA PARTIDA reinicia y **conserva la libreta**.

Día 8: si menos de dos frentes pasaron excavación, banner «La crecida no negocia.»
Alcance v1 (cajetín): Camino, Puente y Muro. Ampliar la obra = versión posterior.

## Dos cajas

| slot   | clave         | quién            |
|--------|---------------|------------------|
| jefe   | `obra.jefe`   | la partida real  |
| visita | `obra.visita` | `?modo=visita`   |

`saveState` nunca escribe la otra. Un visitante no puede borrar al jefe.

## Libreta

Hoja de campo del jefe: `BUG` | `MEJORA` | `DUDA` + una línea + reloj de sitio.
COPIAR / VACIAR (confirma). En visita escribe la caja visita. Jefe puede
TRAER NOTAS DE VISITA. NUEVA PARTIDA no la borra.

## Inspección

```
window.__obra.get()
window.__obra.slot()
window.__obra.keys()
```
