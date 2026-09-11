import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, APPLY_ELAPSED_SKIP_MS, OFFLINE_CAP_MS, SLOT_KEYS, stageIndex } from "./catalog.ts";
import { clockParts } from "./format.ts";
import { FLOOD } from "./pliego.ts";
import { hydrateParsed, migrateLibreta, snapshotState } from "./persist.ts";
import {
  acceptContract,
  applyElapsed,
  bottleneckOf,
  bottleAction,
  bottleGloss,
  composeAbsenceLine,
  composeResumeLine,
  composeCierre,
  crecidaNoNegocia,
  contractClock,
  daysUntilFlood,
  floodLine,
  hasSignedFront,
  isV1Contract,
  orderSupply,
  requirementGap,
  shiftOficio,
  signFirst,
  staffGate,
  startSurvey,
  stepMinutes,
  supplyKindFor,
  tickSurveyReal,
  transferTop,
  v1Complete,
} from "./sim.ts";

describe("persistencia", () => {
  it("rechaza un JSON sin version 1", () => {
    assert.equal(hydrateParsed({}), null);
    assert.equal(hydrateParsed({ version: 2 }), null);
  });

  it("rellena un puente a medias sin romper el resto", () => {
    const parsed = hydrateParsed({
      version: 1,
      structures: { puente: { opened: true, stage: "excavacion" } },
    });
    assert.ok(parsed);
    assert.equal(parsed.structures.puente.opened, true);
    assert.equal(parsed.structures.puente.stage, "excavacion");
    assert.equal(parsed.structures.puente.progress, 0);
    assert.equal(parsed.structures.camino.opened, false);
    assert.equal(parsed.instruction, "dirige");
    assert.equal(parsed.floodStatus, "pendiente");
    assert.ok(parsed.contracts[0]?.purpose);
    assert.equal(parsed.clockPace, "normal");
    assert.equal(parsed.page, "plano");
    assert.equal((parsed as { junk?: unknown }).junk, undefined);
  });

  it("F5 tras firmar no vuelve a Día 01 ni pierde el frente", () => {
    const s = createInitialState();
    s.survey = 1;
    s.instruction = "define";
    signFirst(s, "puente");
    s.siteMinutes = 7 * 60 + 48;
    s.phase = 2;
    const snap = snapshotState(s);
    const round = hydrateParsed(
      JSON.parse(JSON.stringify({ ...snap, junk: 1, evil: { nested: true }, lastNotice: "x" })),
    );
    assert.ok(round);
    assert.equal(round.structures.puente.opened, true);
    assert.equal(round.siteMinutes, s.siteMinutes);
    assert.equal(clockParts(round.siteMinutes).day, clockParts(s.siteMinutes).day);
    assert.equal(round.phase, 2);
    assert.equal(round.instruction, "dirige");
    assert.equal(round.clockPace, "normal");
    assert.equal((round as { junk?: unknown }).junk, undefined);
    assert.equal(round.lastNotice, null);
  });

  it("composeResumeLine nombra día, fase y frentes firmados", () => {
    const s = createInitialState();
    s.survey = 1;
    signFirst(s, "camino");
    signFirst(s, "puente");
    s.phase = 2;
    assert.equal(composeResumeLine(s), "REANUDA · Día 01 · Fase II · firmados: CAMINO, PUENTE");
  });

  it("una etapa ya avanzada se considera pagada", () => {
    const parsed = hydrateParsed({
      version: 1,
      structures: { puente: { opened: true, stage: "armado", progress: 0.4 } },
    });
    assert.equal(parsed?.structures.puente.paidStage, "armado");
    assert.equal(parsed?.structures.camino.paidStage, null);
  });

  it("sin frente firmado el reloj hidrata en pausa", () => {
    const parsed = hydrateParsed({ version: 1, clockPace: "normal", survey: 0 });
    assert.equal(parsed?.clockPace, "pausa");
    assert.equal(hasSignedFront(parsed!), false);
  });

  it("migra la hoja notas/libreta → plano y abre el dock", () => {
    const a = hydrateParsed({ version: 1, page: "notas" });
    assert.equal(a?.page, "plano");
    assert.equal(a?.libretaOpen, true);
    const b = hydrateParsed({ version: 1, page: "libreta" });
    assert.equal(b?.page, "plano");
    assert.equal(b?.libretaOpen, true);
  });

  it("migra notas viejas a libreta", () => {
    const parsed = hydrateParsed({
      version: 1,
      notas: [{ kind: "BUG", line: "el muro", id: "x", siteMinutes: 4, at: 2 }],
    });
    assert.equal(parsed?.libreta.length, 1);
    assert.equal(parsed?.libreta[0]?.line, "el muro");
  });

  it("migra la libreta ignorando basura y acepta NOTA", () => {
    const notes = migrateLibreta([
      { kind: "BUG", line: "  el puente  ", id: "a", siteMinutes: 10, at: 1 },
      { kind: "NOPE", line: "x" },
      { kind: "DUDA", line: "" },
      { kind: "NOTA", line: "campo", id: "n" },
    ]);
    assert.equal(notes.length, 2);
    assert.equal(notes[0]?.kind, "BUG");
    assert.equal(notes[0]?.line, "el puente");
    assert.equal(notes[1]?.kind, "NOTA");
    assert.equal(notes[1]?.line, "campo");
  });
});

describe("reloj", () => {
  it("signFirst abre puente con cuadrilla y topógrafo", () => {
    const s = createInitialState();
    s.survey = 1;
    s.instruction = "define";
    const r = signFirst(s, "puente");
    assert.equal(r.ok, true);
    assert.equal(s.structures.puente.opened, true);
    const crew = s.crews.find((c) => c.front === "puente");
    assert.ok(crew);
    assert.ok((crew.topografos ?? 0) >= 1);
    assert.ok((crew.obreros ?? 0) >= 1);
    assert.equal(s.instruction, "dirige");
    const c = s.contracts.find((x) => x.structureId === "puente");
    assert.equal(c?.status, "activo");
    assert.equal(s.clockPace, "normal");
    assert.equal(s.lastNotice, "Frente firmado");
  });

  it("CAMINO PUENTE MURO son el pliego V1", () => {
    assert.equal(isV1Contract("puente"), true);
    assert.equal(isV1Contract("viaducto"), false);
  });

  it("no se firma antes de levantar", () => {
    const s = createInitialState();
    assert.equal(requirementGap(s, "camino"), "Sin levantamiento");
    const r = acceptContract(s, "c-002");
    assert.equal(r.ok, false);
    assert.equal(s.structures.camino.opened, false);
  });

  it("acceptContract V1 es el mismo sello que signFirst", () => {
    const s = createInitialState();
    s.survey = 1;
    s.instruction = "define";
    const money = s.resources.dinero;
    const r = acceptContract(s, "c-003");
    assert.equal(r.ok, true);
    assert.equal(s.structures.puente.opened, true);
    assert.equal(s.resources.dinero, money);
  });

  it("pedir hormigón no espera un cuello", () => {
    const s = createInitialState();
    const before = s.resources.hormigon;
    const money = s.resources.dinero;
    const r = orderSupply(s, "hormigon");
    assert.equal(r.ok, true);
    assert.equal(s.resources.hormigon, before + 20);
    assert.ok(s.resources.dinero < money);
  });

  it("applyElapsed no simula más del tope", () => {
    const s = createInitialState();
    s.survey = 1;
    s.instruction = "define";
    signFirst(s, "puente");
    const before = s.siteMinutes;
    applyElapsed(s, Date.now() + OFFLINE_CAP_MS + 60 * 60 * 1000);
    const advanced = s.siteMinutes - before;
    const capMin = (OFFLINE_CAP_MS / 1000) * 8;
    assert.ok(advanced <= capMin + 1);
    assert.ok(s.absence?.line);
  });

  it("pausa no deja correr applyElapsed", () => {
    const s = createInitialState();
    s.clockPace = "pausa";
    const before = s.siteMinutes;
    applyElapsed(s, Date.now() + 60_000);
    assert.equal(s.siteMinutes, before);
  });

  it("cerrar 30 s no come horas de sitio", () => {
    const s = createInitialState();
    s.survey = 1;
    signFirst(s, "puente");
    const before = s.siteMinutes;
    const now = Date.now();
    s.realLastSeen = now;
    applyElapsed(s, now + 30_000);
    assert.equal(s.siteMinutes, before);
    assert.ok(30_000 < APPLY_ELAPSED_SKIP_MS);
  });

  it("ausencia de día no miente Noche si el turno está abierto", () => {
    const line = composeAbsenceLine([{ name: "Yuna", delta: "esperó" }], false, 1, 1);
    assert.equal(line, "El Yuna siguió.");
    const night = composeAbsenceLine([{ name: "Régimen", delta: "noche" }], false, 1, 1);
    assert.equal(night, "Noche. El turno esperó.");
    const flood = composeAbsenceLine([{ name: "Crecida", delta: "incumplido" }], true, 1, 12);
    assert.equal(flood, "Llegó la crecida. Plazo incumplido.");
  });

  it("partida nueva arranca en pausa hasta el primer sello", () => {
    const s = createInitialState();
    assert.equal(s.clockPace, "pausa");
    assert.equal(hasSignedFront(s), false);
    s.survey = 1;
    s.instruction = "define";
    signFirst(s, "camino");
    assert.equal(s.clockPace, "normal");
    assert.equal(hasSignedFront(s), true);
  });

  it("levantar el terreno termina en pocos minutos de sitio", () => {
    const s = createInitialState();
    startSurvey(s);
    stepMinutes(s, 20);
    assert.equal(s.survey, 1);
    assert.equal(s.instruction, "define");
  });

  it("el levante corre en tiempo real sin gastar minutos de sitio", () => {
    const s = createInitialState();
    const before = s.siteMinutes;
    startSurvey(s);
    assert.equal(s.surveying, true);
    const done = tickSurveyReal(s, 2.4);
    assert.equal(done, true);
    assert.equal(s.survey, 1);
    assert.equal(s.surveying, false);
    assert.equal(s.instruction, "define");
    assert.equal(s.siteMinutes, before);
    assert.equal(s.clockPace, "pausa");
  });

  it("la crecida sella incumplido si el pliego no cerró", () => {
    const s = createInitialState();
    s.survey = 1;
    s.instruction = "define";
    signFirst(s, "camino");
    const need = (FLOOD.day + 1) * 24 * 60 - s.siteMinutes + 10;
    stepMinutes(s, need, { eventBudget: 0 });
    assert.equal(s.floodStatus, "incumplido");
    assert.equal(v1Complete(s), false);
  });

  it("tres frentes conectados antes del día 12 sellan a-salvo", () => {
    const s = createInitialState();
    s.survey = 1;
    for (const id of ["camino", "puente", "muro"] as const) {
      s.structures[id].opened = true;
      s.structures[id].stage = "conexion";
      s.structures[id].progress = 1;
      const c = s.contracts.find((x) => x.structureId === id);
      if (c) {
        c.status = "cumplido";
        c.acceptedDay = 1;
      }
    }
    stepMinutes(s, 1, { eventBudget: 0 });
    assert.equal(v1Complete(s), true);
    assert.equal(s.floodStatus, "a-salvo");
  });

  it("el plazo del contrato muerde", () => {
    const s = createInitialState();
    s.survey = 1;
    signFirst(s, "camino");
    const c = s.contracts.find((x) => x.structureId === "camino");
    assert.ok(c);
    assert.equal(contractClock(s, c).late, false);
    s.siteMinutes = (c.acceptedDay! + c.durationDays + 1) * 24 * 60;
    assert.equal(contractClock(s, c).late, true);
  });

  it("daysUntilFlood y floodLine usan el mismo N", () => {
    const s = createInitialState();
    const n = daysUntilFlood(s);
    assert.equal(n, FLOOD.day - 1);
    assert.equal(floodLine(s), `CRECIDA Q50 · faltan ${n} días`);
    s.siteMinutes = 11 * 24 * 60 + 7 * 60;
    assert.equal(clockParts(s.siteMinutes).day, 12);
    assert.equal(floodLine(s), "CRECIDA Q50 · hoy");
    s.floodStatus = "incumplido";
    assert.equal(floodLine(s), "PLAZO INCUMPLIDO");
  });
});

describe("inventario y personal", () => {
  it("pedir acero libera FALTA ACERO cuando el stock cubre", () => {
    const s = createInitialState();
    s.survey = 1;
    s.instruction = "define";
    signFirst(s, "puente");
    s.structures.puente.stage = "armado";
    s.structures.puente.progress = 0;
    s.resources.acero = 0;
    s.slowdowns.push({ target: "puente", minutesLeft: 90, factor: 0, kind: "material" });
    assert.equal(bottleneckOf(s, "puente"), "FALTA ACERO");

    const first = orderSupply(s, "acero");
    assert.equal(s.resources.acero, 8);
    assert.equal(bottleneckOf(s, "puente"), "FALTA ACERO");
    assert.match(s.lastNotice ?? "", /Material recibido · almacén/);
    assert.match(first.unused ?? "", /faltan/);

    const second = orderSupply(s, "acero");
    assert.equal(s.resources.acero, 16);
    assert.notEqual(bottleneckOf(s, "puente"), "FALTA ACERO");
    assert.notEqual(bottleneckOf(s, "puente"), "ARMADO DETENIDO — MATERIAL");
    assert.match(s.lastNotice ?? "", /Material recibido · frente PUENTE/);
    assert.equal(second.received, s.lastNotice);
  });

  it("un slowdown de material no miente si el acero ya alcanza", () => {
    const s = createInitialState();
    s.survey = 1;
    signFirst(s, "puente");
    s.structures.puente.stage = "armado";
    s.structures.puente.progress = 0;
    s.resources.acero = 20;
    s.slowdowns.push({ target: "puente", minutesLeft: 90, factor: 0, kind: "material" });
    assert.notEqual(bottleneckOf(s, "puente"), "FALTA ACERO");
    assert.notEqual(bottleneckOf(s, "puente"), "ARMADO DETENIDO — MATERIAL");
  });

  it("staffGate bloquea sin topógrafo en reserva", () => {
    const s = createInitialState();
    s.survey = 1;
    s.instruction = "define";
    signFirst(s, "camino");
    s.structures.puente.opened = true;
    s.structures.puente.stage = "levantado";
    const idle = s.crews.find((c) => c.front === "reserva");
    assert.ok(idle);
    idle.front = "puente";
    idle.topografos = 0;
    idle.obreros = Math.max(idle.obreros, 2);
    for (const c of s.crews) {
      if (c.front === "reserva") c.topografos = 0;
    }
    assert.equal(bottleneckOf(s, "puente"), "FALTA TOPÓGRAFO");
    const g = staffGate(s, "puente");
    assert.equal(g.ok, false);
    assert.equal(g.reason, "Sin topógrafo en reserva · quita uno de otro frente en OBRA");
  });

  it("quitar el último topógrafo avisa detención", () => {
    const s = createInitialState();
    s.survey = 1;
    signFirst(s, "camino");
    const crew = s.crews.find((c) => c.front === "camino");
    assert.ok(crew);
    while (crew.topografos > 1) shiftOficio(s, crew.id, "topografo", -1);
    shiftOficio(s, crew.id, "topografo", -1);
    assert.equal(s.lastNotice, "Este frente quedará detenido.");
  });

  it("añadir TOP sin reserva queda bloqueado", () => {
    const s = createInitialState();
    s.survey = 1;
    signFirst(s, "camino");
    const crew = s.crews.find((c) => c.front === "camino");
    assert.ok(crew);
    for (const c of s.crews) {
      if (c.front === "reserva") c.topografos = 0;
    }
    shiftOficio(s, crew.id, "topografo", 1);
    assert.equal(s.lastNotice, "SIN TOP EN RESERVA");
  });

  it("si el stock cubre, el cuello no dice FALTA ni Sin hormigón", () => {
    const s = createInitialState();
    s.survey = 1;
    signFirst(s, "puente");
    s.structures.puente.stage = "armado";
    s.structures.puente.progress = 0;
    s.structures.puente.paidStage = null;
    s.resources.acero = 20;
    const bottle = bottleneckOf(s, "puente");
    assert.notEqual(bottle, "FALTA ACERO");
    assert.notEqual(bottle, "ARMADO DETENIDO — MATERIAL");
    assert.doesNotMatch(bottleGloss(bottle) ?? "", /Sin acero no se arma/);
    assert.doesNotMatch(bottleGloss(bottle) ?? "", /Sin hormigón no se vierte/);
  });

  it("pagada la etapa, inventario vacío no miente FALTA", () => {
    const s = createInitialState();
    s.survey = 1;
    signFirst(s, "puente");
    s.structures.puente.stage = "armado";
    s.structures.puente.progress = 0.01;
    s.structures.puente.paidStage = "armado";
    s.resources.acero = 0;
    s.slowdowns.push({ target: "puente", minutesLeft: 90, factor: 0, kind: "material" });
    assert.notEqual(bottleneckOf(s, "puente"), "FALTA ACERO");
    assert.notEqual(bottleneckOf(s, "puente"), "ARMADO DETENIDO — MATERIAL");
  });

  it("cargar acero al frente deja rastro de cantidad", () => {
    const s = createInitialState();
    s.survey = 1;
    s.regime = "siempre";
    signFirst(s, "puente");
    s.structures.puente.stage = "armado";
    s.structures.puente.progress = 0;
    s.structures.puente.paidStage = null;
    s.resources.acero = 20;
    const before = s.resources.acero;
    stepMinutes(s, 8, { eventBudget: 0 });
    assert.equal(s.structures.puente.paidStage, "armado");
    assert.equal(s.resources.acero, before - 14);
    assert.match(s.lastNotice ?? "", /14 t de acero/);
    assert.match(s.lastNotice ?? "", /al frente/);
    assert.notEqual(bottleneckOf(s, "puente"), "FALTA ACERO");
  });

  it("viaje de hormigón nombra destino si nadie lo carga", () => {
    const s = createInitialState();
    const r = orderSupply(s, "hormigon");
    assert.equal(r.ok, true);
    assert.match(s.lastNotice ?? "", /Material recibido · almacén/);
    assert.match(r.unused ?? "", /Aún no se usa/);
  });

  it("transferTop mueve un TOP de→a y avisa el destino", () => {
    const s = createInitialState();
    s.survey = 1;
    signFirst(s, "camino");
    signFirst(s, "puente");
    const r = transferTop(s, "camino", "puente");
    assert.equal(r.ok, true);
    assert.equal(s.lastNotice, "TOP → PUENTE");
    assert.ok(s.crews.some((c) => c.front === "puente" && c.topografos >= 1));
  });
});

describe("claves de save", () => {
  it("jefe y visita no comparten clave", () => {
    assert.notEqual(SLOT_KEYS.jefe.live, SLOT_KEYS.visita.live);
    assert.equal(SLOT_KEYS.jefe.live, "obra.jefe");
    assert.equal(SLOT_KEYS.visita.live, "obra.visita");
  });
});

describe("salida de beta · pliego v1", () => {
  it("día 1 no avisa la crecida", () => {
    const s = createInitialState();
    s.survey = 1;
    signFirst(s, "camino");
    assert.equal(crecidaNoNegocia(s), false);
    assert.equal(composeCierre(s), null);
  });

  it("día 8 con menos de dos frentes pasada excavación avisa", () => {
    const s = createInitialState();
    s.survey = 1;
    signFirst(s, "camino");
    s.structures.camino.stage = "excavacion";
    s.siteMinutes = 7 * 24 * 60;
    assert.equal(clockParts(s.siteMinutes).day, 8);
    assert.equal(crecidaNoNegocia(s), true);
    s.structures.puente.opened = true;
    s.structures.puente.stage = "armado";
    assert.equal(crecidaNoNegocia(s), true);
    s.structures.muro.opened = true;
    s.structures.muro.stage = "armado";
    assert.equal(crecidaNoNegocia(s), false);
  });

  it("dos frentes en armado el día 8 no avisan", () => {
    const s = createInitialState();
    s.survey = 1;
    s.siteMinutes = 7 * 24 * 60;
    s.structures.camino.opened = true;
    s.structures.camino.stage = "armado";
    s.structures.puente.opened = true;
    s.structures.puente.stage = "conexion";
    assert.equal(crecidaNoNegocia(s), false);
  });

  it("lámina a-salvo nombra sello, día, prestigio y frentes", () => {
    const s = createInitialState();
    s.survey = 1;
    s.prestigio = 33;
    for (const id of ["camino", "puente", "muro"] as const) {
      s.structures[id].opened = true;
      s.structures[id].stage = "conexion";
      s.structures[id].progress = 1;
    }
    s.floodStatus = "a-salvo";
    const sheet = composeCierre(s);
    assert.ok(sheet);
    assert.equal(sheet.stamp, "OBRA A SALVO");
    assert.equal(sheet.day, 1);
    assert.equal(sheet.prestigio, 33);
    assert.match(sheet.fronts, /CAMINO CONECTADO/);
    assert.match(sheet.fronts, /PUENTE CONECTADO/);
    assert.match(sheet.fronts, /MURO CONECTADO/);
    assert.match(sheet.phrase, /tres frentes/);
  });

  it("lámina incumplido y el aviso del día 8 no conviven", () => {
    const s = createInitialState();
    s.survey = 1;
    s.siteMinutes = 11 * 24 * 60;
    s.floodStatus = "incumplido";
    s.structures.camino.opened = true;
    s.structures.camino.stage = "excavacion";
    const sheet = composeCierre(s);
    assert.ok(sheet);
    assert.equal(sheet.stamp, "PLAZO INCUMPLIDO");
    assert.match(sheet.phrase, /crecida llegó/);
    assert.equal(crecidaNoNegocia(s), false);
  });
});

describe("lluvia y etapas", () => {
  it("lluvia en vertido nombra lluvia, no FALTA HORMIGÓN", () => {
    const s = createInitialState();
    s.survey = 1;
    signFirst(s, "puente");
    s.structures.puente.stage = "estructura";
    s.structures.puente.progress = 0;
    s.structures.puente.paidStage = null;
    s.resources.hormigon = 0;
    s.slowdowns.push({ target: "puente", minutesLeft: 120, factor: 0.52, kind: "lluvia" });
    assert.equal(bottleneckOf(s, "puente"), "LLUVIA — NO SE VIERTE");
    assert.equal(supplyKindFor(bottleneckOf(s, "puente")), null);
    assert.match(bottleAction(bottleneckOf(s, "puente")) ?? "", /vertido espera/i);
  });

  it("con hormigón en almacén la lluvia de vertido sigue nombrando lluvia", () => {
    const s = createInitialState();
    s.survey = 1;
    signFirst(s, "puente");
    s.structures.puente.stage = "estructura";
    s.structures.puente.paidStage = "estructura";
    s.resources.hormigon = 80;
    s.slowdowns.push({ target: "puente", minutesLeft: 120, factor: 0.52, kind: "lluvia" });
    assert.equal(bottleneckOf(s, "puente"), "LLUVIA — NO SE VIERTE");
  });

  it("lluvia en excavación no detiene el frente ni pide hormigón", () => {
    const s = createInitialState();
    s.survey = 1;
    signFirst(s, "muro");
    s.structures.muro.stage = "excavacion";
    s.structures.muro.paidStage = "excavacion";
    s.slowdowns.push({ target: "muro", minutesLeft: 120, factor: 0.52, kind: "lluvia" });
    assert.equal(bottleneckOf(s, "muro"), "LLUVIA EN ESTE FRENTE");
    assert.equal(supplyKindFor(bottleneckOf(s, "muro")), null);
    assert.match(bottleAction(bottleneckOf(s, "muro")) ?? "", /no hay que parar/i);
  });

  it("muro no salta armado sin acero", () => {
    const s = createInitialState();
    s.survey = 1;
    s.regime = "siempre";
    signFirst(s, "muro");
    const crew = s.crews.find((c) => c.front === "muro");
    assert.ok(crew);
    crew.obreros = 80;
    crew.capataces = 10;
    crew.ingenieros = 3;
    crew.topografos = 2;
    s.structures.muro.stage = "excavacion";
    s.structures.muro.progress = 0.99;
    s.structures.muro.paidStage = "excavacion";
    s.resources.acero = 0;
    s.resources.hormigon = 0;
    stepMinutes(s, 60, { eventBudget: 0 });
    const landed = s.structures.muro.stage;
    assert.ok(stageIndex(landed) <= stageIndex("armado"), landed);
    assert.notEqual(landed, "encofrado");
    assert.notEqual(landed, "estructura");
    assert.notEqual(landed, "conexion");
    if (stageIndex(landed) === stageIndex("armado")) {
      assert.equal(bottleneckOf(s, "muro"), "FALTA ACERO");
      assert.equal(s.structures.muro.progress, 0);
    }
  });
});

afterEach(() => {
  /* no global leak */
});
