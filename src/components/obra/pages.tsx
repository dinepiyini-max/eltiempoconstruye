import { COPY, HINTS, MANDANTE, PLIEGO_BULLETS, ROLE_PLURAL, STAGE_LABEL, STAGE_NEXT, STRUCT_NAME, STRUCT_SHORT, VALLE } from "@/game/catalog";
import {
  bottle,
  bottleAct,
  bottleHint,
  clockOf,
  crewAt,
  crewHeadcount,
  fmt,
  frontDue,
  gateHint,
  gateOf,
  pliegoDone,
  rateLine,
  reserve,
  staffCheck,
  whereFront,
} from "@/game/sim";
import { useObra } from "@/game/store";
import { STRUCTURE_IDS, type Bottle, type Contract, type Role, type StructureId } from "@/game/types";
import { Almacen, ArchiveMark, Cell, NuevaPartida } from "./widgets";

const STATUS: Record<Contract["status"], string> = {
  bloqueado: "BLOQUEADO",
  disponible: "PROPUESTO",
  activo: "EN OBRA",
  cumplido: "CERRADO",
};

const ROLES: { id: Role; short: string }[] = [
  { id: "obrero", short: "OBR" },
  { id: "capataz", short: "CAP" },
  { id: "ingeniero", short: "ING" },
  { id: "topografo", short: "TOP" },
];

function BottleCell({ b }: { b: Bottle | null }) {
  const hint = bottleHint(b);
  const act = bottleAct(b);
  return (
    <td className="py-3">
      <p className="small-caps text-[0.58rem] text-rust">{b ?? "—"}</p>
      {hint ? (
        <p className="mt-1 max-w-[16rem] font-serif text-sm leading-snug text-ink-soft">
          {hint}
        </p>
      ) : null}
      {act ? <p className="mt-1 font-serif text-sm text-ink">{act}</p> : null}
    </td>
  );
}

function FrontRow({ id }: { id: StructureId }) {
  const game = useObra((s) => s.game);
  const staff = useObra((s) => s.staffFront);
  const s = game.structures[id];
  const r = crewAt(game, id);
  const b = bottle(game, id);
  const crew = game.crews.find((c) => c.front === id);
  const need = staffCheck(game, id).ok || bottle(game, id) === "SIN CUADRILLA" || bottle(game, id) === "FALTA TOPÓGRAFO" || bottle(game, id) === "FALTAN OBREROS";
  const chk = need ? staffCheck(game, id) : { ok: true, reason: "" };
  const showAssign =
    b === "SIN CUADRILLA" || b === "FALTA TOPÓGRAFO" || b === "FALTAN OBREROS";
  return (
    <tr className="border-b border-rule/70 align-top">
      <td className="py-3 pr-3 font-sans tracking-wide text-ink">
        {crew ? crew.name : "—"}
        {crew ? (
          <span className="mt-1 block small-caps text-[0.52rem] text-ink-soft">
            {whereFront(id)}
          </span>
        ) : null}
      </td>
      <td className="py-3 pr-3 small-caps text-[0.62rem]">{STRUCT_SHORT[id]}</td>
      <td className="py-3 pr-3 tabular-nums text-ink">
        <span title={HINTS.OBR}>{r.obreros} OBR</span>
        {" · "}
        <span title={HINTS.CAP}>{r.capataces} CAP</span>
        {" · "}
        <span title={HINTS.ING}>{r.ingenieros} ING</span>
        {" · "}
        <span title={HINTS.TOP}>{r.topografos} TOP</span>
        {showAssign ? (
          <button
            type="button"
            disabled={!chk.ok}
            onClick={() => staff(id)}
            title={chk.ok ? "Asignar desde disponibles" : chk.reason}
            className="small-caps mt-1 block min-h-11 text-left text-[0.55rem] text-rust disabled:text-faint"
          >
            {chk.ok ? "Asignar desde disponibles" : chk.reason}
          </button>
        ) : null}
      </td>
      <td className="py-3 pr-3 small-caps text-[0.58rem] text-cyan">{rateLine(game, id)}</td>
      <td className="py-3 pr-3 small-caps text-[0.58rem]">{STAGE_LABEL[s.stage]}</td>
      <td className="py-3 pr-3 small-caps text-[0.58rem] text-ink-soft">{STAGE_NEXT[s.stage]}</td>
      <BottleCell b={b} />
    </tr>
  );
}

function CrewCard({ id }: { id: string }) {
  const game = useObra((s) => s.game);
  const shift = useObra((s) => s.shift);
  const cycle = useObra((s) => s.cycleFront);
  const c = game.crews.find((x) => x.id === id);
  if (!c) return null;
  const n = crewHeadcount(c);
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-rule/70 py-2">
      <div className="min-w-0">
        <p className="font-sans tracking-wide text-ink">{c.name}</p>
        <button
          type="button"
          onClick={() => cycle(c.id)}
          className="small-caps min-h-11 text-[0.58rem] text-cyan"
        >
          {whereFront(c.front)} · {c.front === "reserva" ? "DISPONIBLES" : c.front.toUpperCase()} · {n} · cambiar frente
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {ROLES.map((r) => {
          const v = c[ROLE_PLURAL[r.id]];
          return (
            <div key={r.id} className="flex items-center" title={HINTS[r.short]}>
              <span className="small-caps mr-1 w-8 text-[0.52rem] text-ink-soft">{r.short}</span>
              <button
                type="button"
                className="min-h-11 min-w-11 text-lg text-ink-soft"
                onClick={() => shift(c.id, r.id, -1)}
                aria-label={`Quitar ${r.short}`}
              >
                −
              </button>
              <span className="w-5 text-center tabular-nums">{v}</span>
              <button
                type="button"
                className="min-h-11 min-w-11 text-lg text-ink-soft"
                onClick={() => shift(c.id, r.id, 1)}
                aria-label={`Añadir ${r.short}`}
              >
                +
              </button>
            </div>
          );
        })}
      </div>
    </li>
  );
}

function CrewList({
  title,
  ids,
  empty,
}: {
  title: string;
  ids: string[];
  empty: string | null;
}) {
  return (
    <section className="mt-10">
      <h3 className="small-caps border-b border-ink/20 pb-1 text-[0.62rem] text-ink">{title}</h3>
      {ids.length === 0 ? (
        empty ? <p className="mt-3 font-serif italic text-ink-soft">{empty}</p> : null
      ) : (
        <ul className="mt-2">
          {ids.map((id) => (
            <CrewCard key={id} id={id} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function ObraPage() {
  const game = useObra((s) => s.game);
  const t = clockOf(game.siteMinutes);
  const open = STRUCTURE_IDS.filter((id) => game.structures[id].opened);
  const idle = game.crews.filter((c) => c.front === "reserva" || c.front === "survey");
  const busy = game.crews.filter((c) => c.front !== "reserva" && c.front !== "survey");
  const r = reserve(game);
  return (
    <section className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-8">
      <header className="border-b border-ink/20 pb-4">
        <p className="small-caps text-[0.62rem] text-cyan">Cuaderno de obra · {VALLE}</p>
        <h2 className="font-serif text-3xl text-ink">La obra</h2>
        <p className="mt-1 font-serif italic text-ink-soft">
          {t.label}. El reloj sigue el ritmo del cajetín.
        </p>
      </header>
      <div className="mt-5 border-b border-rule/70 pb-4">
        <p className="small-caps mb-2 text-[0.58rem] text-ink-soft">
          Almacén del valle · no esperes al cuello
        </p>
        <Almacen />
        <p className="mt-2 font-serif text-sm text-ink-soft">
          Hormigón {Math.round(game.resources.hormigon)} m³ · Acero {Math.round(game.resources.acero)} t
        </p>
      </div>
      <p className="mt-4 small-caps text-[0.58rem] text-ink">
        DISPONIBLES · {r.obreros} OBR · {r.capataces} CAP · {r.ingenieros} ING · {r.topografos} TOP
      </p>
      {open.length === 0 ? (
        <p className="mt-10 small-caps text-[0.72rem] tracking-[0.28em] text-ink">Ningún frente.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <caption className="sr-only">Frentes de obra</caption>
            <thead>
              <tr className="small-caps border-b border-ink/30 text-[0.55rem] text-ink-soft">
                <th className="py-2 pr-3 font-medium">Cuadrilla</th>
                <th className="py-2 pr-3 font-medium">Frente</th>
                <th className="py-2 pr-3 font-medium">Dotación</th>
                <th className="py-2 pr-3 font-medium">Productividad</th>
                <th className="py-2 pr-3 font-medium">Estado</th>
                <th className="py-2 pr-3 font-medium">Hito</th>
                <th className="py-2 font-medium">Cuello</th>
              </tr>
            </thead>
            <tbody>
              {open.map((id) => (
                <FrontRow key={id} id={id} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <CrewList
        title="Asignadas"
        ids={busy.map((c) => c.id)}
        empty={open.length === 0 ? null : "Ninguna cuadrilla en frente."}
      />
      <CrewList
        title="Disponibles"
        ids={idle.map((c) => c.id)}
        empty="Sin personal en reserva."
      />
    </section>
  );
}

function ContractCard({ contract, index }: { contract: Contract; index: number }) {
  const game = useObra((s) => s.game);
  const accept = useObra((s) => s.accept);
  const gate =
    contract.status === "activo" || contract.status === "cumplido"
      ? null
      : gateOf(game, contract.structureId);
  const can = contract.status === "disponible" && !gate;
  const hint = gateHint(gate);
  const due = frontDue(game, contract);
  const s = game.structures[contract.structureId];
  const b = contract.status === "activo" ? bottle(game, contract.structureId) : null;
  const act = bottleAct(b);
  const est = `${contract.durationDays} días · obra estimada del frente`;
  return (
    <li className="border-b border-rule/90 py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="small-caps text-[0.6rem] text-ink-soft">
          Contrato {String(index).padStart(3, "0")}
        </p>
        <p className="small-caps text-[0.6rem] text-stamp">{STATUS[contract.status]}</p>
      </div>
      <h3 className="mt-1 font-serif text-2xl text-ink">{contract.title}</h3>
      <p className="mt-1 max-w-prose font-serif text-[1.02rem] leading-snug text-ink-soft">
        {contract.body}
      </p>
      <p className="mt-3 font-serif text-sm leading-snug text-ink">{contract.purpose}</p>
      <p className="mt-1 font-serif text-sm italic leading-snug text-stamp">{contract.threat}</p>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        <Cell k="Presupuesto" v={fmt(contract.cost)} />
        <Cell k="Obra estimada del frente" v={est} />
        <Cell k="Dificultad" v={"I".repeat(contract.difficulty)} />
        <Cell
          k="Prestigio"
          v={`${contract.prestigio}${contract.status === "cumplido" ? " · ganado" : ""}`}
        />
        <Cell k="Pieza" v={STRUCT_NAME[contract.structureId]} />
        {contract.status === "activo" ? (
          <>
            <Cell k="Hito" v={`${STAGE_LABEL[s.stage]} → ${STAGE_NEXT[s.stage]}`} />
            <Cell k="Cuello" v={b ?? "—"} />
            <Cell
              k="Plazo del frente"
              v={
                due.dueDay == null
                  ? est
                  : due.late
                    ? `TARDÍO · debía el día ${due.dueDay}`
                    : `${due.remaining} d · vence día ${due.dueDay}`
              }
            />
          </>
        ) : null}
      </dl>
      {act ? <p className="mt-2 font-serif text-sm text-ink">{act}</p> : null}
      {gate ? <p className="mt-3 small-caps text-[0.6rem] text-rust">{gate}</p> : null}
      {hint ? (
        <p className="mt-2 max-w-prose font-serif text-sm leading-snug text-ink-soft">{hint}</p>
      ) : null}
      {can ? (
        <button
          type="button"
          onClick={() => accept(contract.id)}
          className="stamp mt-5 min-h-11 px-4 py-1 text-[0.68rem]"
        >
          {COPY.merece}
        </button>
      ) : null}
      {contract.status === "activo" || contract.status === "cumplido" ? (
        <p className="stamp mt-5 inline-block px-3 py-1 text-[0.62rem] opacity-80">
          {STATUS[contract.status]}
        </p>
      ) : null}
    </li>
  );
}

export function ContratosPage() {
  const contracts = useObra((s) => s.game.contracts);
  const prestigio = useObra((s) => s.game.prestigio);
  return (
    <section className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-8">
      <header className="border-b border-ink/20 pb-4">
        <p className="small-caps text-[0.62rem] text-cyan">
          Pliego · {VALLE} · {MANDANTE}
        </p>
        <h2 className="font-serif text-3xl text-ink">Contratos</h2>
        <p className="mt-1 font-serif italic text-ink-soft">
          Tres encargos del mismo pliego. Prestigio {fmt(prestigio)}.
        </p>
        <ol className="mt-4 space-y-1 border-t border-rule/70 pt-3">
          {PLIEGO_BULLETS.map((b) => (
            <li key={b} className="font-serif text-sm leading-snug text-ink-soft">
              {b}
            </li>
          ))}
        </ol>
      </header>
      <ol className="mt-2">
        {contracts.map((c, i) => (
          <ContractCard key={c.id} contract={c} index={i + 1} />
        ))}
      </ol>
    </section>
  );
}

function Cierre() {
  const game = useObra((s) => s.game);
  const t = clockOf(game.siteMinutes);
  const safe = game.floodStatus === "a-salvo";
  const late = game.floodStatus === "incumplido";
  return (
    <article className="mt-8 border border-ink/30 bg-paper p-5">
      <p className="small-caps text-[0.6rem] text-cyan">Lámina de cierre · {VALLE}</p>
      <h3 className="mt-2 font-serif text-2xl text-ink">
        {safe ? "El pliego se cumplió." : late ? "La crecida llegó antes." : "El valle aún espera."}
      </h3>
      <p className="mt-2 font-serif italic text-ink-soft">
        El tiempo construye. Tú decides qué merece ser construido.
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Cell k="Día de sitio" v={t.label} />
        <Cell k="Prestigio" v={fmt(game.prestigio)} />
        <Cell k="Hormigón vertido" v={`${fmt(game.totals.hormigon)} m³`} />
        <Cell k="Acero armado" v={`${fmt(game.totals.acero)} t`} />
      </dl>
      {safe ? (
        <p className="stamp mt-5 inline-block px-3 py-1 text-[0.62rem]">OBRA A SALVO</p>
      ) : late ? (
        <p className="stamp mt-5 inline-block px-3 py-1 text-[0.62rem]">PLAZO INCUMPLIDO</p>
      ) : null}
      <div className="mt-6">
        <NuevaPartida />
      </div>
    </article>
  );
}

export function ArchivoPage() {
  const archive = useObra((s) => s.game.archive);
  const prestigio = useObra((s) => s.game.prestigio);
  const flood = useObra((s) => s.game.floodStatus);
  const game = useObra((s) => s.game);
  const show = flood !== "pendiente" || pliegoDone(game);
  return (
    <section className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-8">
      <header className="border-b border-ink/20 pb-4">
        <p className="small-caps text-[0.62rem] text-cyan">
          Museo · {VALLE} · {MANDANTE}
        </p>
        <h2 className="font-serif text-3xl text-ink">Archivo</h2>
        <p className="mt-1 font-serif italic text-ink-soft">
          Lo que terminas aquí permanece. Prestigio {fmt(prestigio)}.
        </p>
        <div className="mt-3">
          <NuevaPartida />
        </div>
      </header>
      {show ? <Cierre /> : null}
      {archive.length === 0 ? (
        <p className="mt-24 text-center small-caps text-[0.78rem] tracking-[0.32em] text-ink">
          Aún no hay obra terminada
        </p>
      ) : (
        <ol className="mt-8 grid gap-6 sm:grid-cols-2">
          {archive.map((a) => (
            <li key={a.id} className="border border-ink/20 bg-paper p-4">
              <div className="flex items-baseline justify-between">
                <p className="small-caps text-[0.58rem] text-cyan">Lámina {a.id}</p>
                <p className="small-caps text-[0.58rem] text-ink-soft">{a.completedClock}</p>
              </div>
              <h3 className="mt-2 font-serif text-2xl text-ink">{a.name}</h3>
              {a.seal ? (
                <p className="stamp mt-2 inline-block px-2 py-0.5 text-[0.5rem]">
                  {a.seal === "a-salvo"
                    ? "OBRA A SALVO"
                    : a.seal === "incumplido"
                      ? "PLAZO INCUMPLIDO"
                      : "TARDÍO"}
                </p>
              ) : null}
              <ArchiveMark id={a.structureId} />
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between gap-3 border-b border-rule/60 pb-1">
                  <dt className="small-caps text-[0.55rem] text-ink-soft">Método</dt>
                  <dd className="text-right text-ink">{a.method}</dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-rule/60 pb-1">
                  <dt className="small-caps text-[0.55rem] text-ink-soft">Materiales</dt>
                  <dd className="text-right text-ink">{a.materials}</dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-rule/60 pb-1">
                  <dt className="small-caps text-[0.55rem] text-ink-soft">Mano de obra</dt>
                  <dd className="text-right text-ink">{a.workforce}</dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-rule/60 pb-1">
                  <dt className="small-caps text-[0.55rem] text-ink-soft">Costo</dt>
                  <dd className="text-right text-ink">{fmt(a.cost)}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
