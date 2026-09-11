import { FRONT_LABEL, GLOSS, OFICIO_KEY, RESOURCE_HINT, STAGE_LABEL, NEXT_HITO, STRUCTURE_NAME_UP, VALLEY_NAME } from "@/lib/obra/catalog";
import { clockParts } from "@/lib/obra/format";
import {
  bottleAction,
  bottleGloss,
  bottleneckOf,
  crewHeadcount,
  frontPosting,
  needsStaff,
  peopleOn,
  protoBottle,
  protoRitmo,
  reservaPool,
  ritmoLabel,
  staffGate,
} from "@/lib/obra/sim";
import { useObra } from "@/lib/obra/store";
import type { Oficio, StructureId } from "@/lib/obra/types";
import { STRUCTURE_IDS } from "@/lib/obra/types";
import { Pedidos } from "./Pedidos";

const OFICIOS: { id: Oficio; short: string }[] = [
  { id: "obrero", short: "OBR" },
  { id: "capataz", short: "CAP" },
  { id: "ingeniero", short: "ING" },
  { id: "topografo", short: "TOP" },
];

export function Obra() {
  const game = useObra((s) => s.game);
  const clock = clockParts(game.siteMinutes);
  const opened = STRUCTURE_IDS.filter((id) => game.structures[id].opened);
  const disponibles = game.crews.filter((c) => c.front === "reserva" || c.front === "survey");
  const asignadas = game.crews.filter((c) => c.front !== "reserva" && c.front !== "survey");
  const ensayoOn = game.prototype?.opened && game.prototype.stage !== "conexion";
  const pool = reservaPool(game);

  return (
    <section className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-8">
      <header className="border-b border-ink/20 pb-4">
        <p className="small-caps text-[0.62rem] text-cyan">Cuaderno de obra · {VALLEY_NAME}</p>
        <h2 className="font-serif text-3xl text-ink">La obra</h2>
        <p className="mt-1 font-serif italic text-ink-soft">{clock.label}. El reloj sigue el ritmo del cajetín.</p>
      </header>

      <div className="mt-5 border-b border-rule/70 pb-4">
        <p className="small-caps mb-2 text-[0.58rem] text-ink-soft">Almacén del valle · no esperes al cuello</p>
        <Pedidos />
        <p className="mt-2 font-serif text-sm text-ink-soft">
          Hormigón {Math.round(game.resources.hormigon)} m³ · Acero {Math.round(game.resources.acero)} t
        </p>
      </div>

      <p className="mt-4 small-caps text-[0.58rem] text-ink">
        DISPONIBLES · {pool.obreros} OBR · {pool.capataces} CAP · {pool.ingenieros} ING · {pool.topografos} TOP
      </p>
      <p className="mt-1 font-serif text-xs text-ink-soft">{GLOSS.top}</p>

      {opened.length === 0 && !ensayoOn ? (
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
                <th className="py-2 font-medium">
                  Cuello
                  <span className="mt-0.5 block font-serif text-[0.7rem] font-normal normal-case tracking-normal text-ink-soft">
                    {GLOSS.cuello}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {opened.map((id) => (
                <FrontRow key={id} id={id} />
              ))}
              {ensayoOn ? <EnsayoRow /> : null}
            </tbody>
          </table>
        </div>
      )}

      <CrewBlock
        title="Asignadas"
        crews={asignadas}
        empty={opened.length === 0 && !ensayoOn ? null : "Ninguna cuadrilla en frente."}
      />
      <CrewBlock title="Disponibles" crews={disponibles} empty="Sin personal en reserva." />
    </section>
  );
}

function BottleCell({ bottle }: { bottle: string | null }) {
  const gloss = bottleGloss(bottle);
  const action = bottleAction(bottle);
  return (
    <td className="py-3">
      <p className="small-caps text-[0.58rem] text-rust">{bottle ?? "—"}</p>
      {gloss ? <p className="mt-1 max-w-[16rem] font-serif text-sm leading-snug text-ink-soft">{gloss}</p> : null}
      {action ? <p className="mt-1 font-serif text-sm text-ink">{action}</p> : null}
    </td>
  );
}

function FrontRow({ id }: { id: StructureId }) {
  const game = useObra((s) => s.game);
  const staffFront = useObra((s) => s.staffFront);
  const st = game.structures[id];
  const people = peopleOn(game, id);
  const bottle = bottleneckOf(game, id);
  const crew = game.crews.find((c) => c.front === id);
  const staff = needsStaff(game, id);
  const gate = staff ? staffGate(game, id) : { ok: true, reason: "" };

  return (
    <tr className="border-b border-rule/70 align-top">
      <td className="py-3 pr-3 font-sans tracking-wide text-ink">
        {crew ? `${crew.name}` : "—"}
        {crew ? <span className="mt-1 block small-caps text-[0.52rem] text-ink-soft">{frontPosting(id)}</span> : null}
      </td>
      <td className="py-3 pr-3 small-caps text-[0.62rem]">{STRUCTURE_NAME_UP[id]}</td>
      <td className="py-3 pr-3 tabular-nums text-ink">
        <span title={RESOURCE_HINT.OBR}>{people.obreros} OBR</span>
        {" · "}
        <span title={RESOURCE_HINT.CAP}>{people.capataces} CAP</span>
        {" · "}
        <span title={RESOURCE_HINT.ING}>{people.ingenieros} ING</span>
        {" · "}
        <span title={RESOURCE_HINT.TOP}>{people.topografos} TOP</span>
        {staff ? (
          <button
            type="button"
            disabled={!gate.ok}
            onClick={() => staffFront(id)}
            title={gate.ok ? "Asignar desde disponibles" : gate.reason}
            className="small-caps mt-1 block min-h-11 text-left text-[0.55rem] text-rust disabled:text-faint"
          >
            {gate.ok ? "Asignar desde disponibles" : gate.reason}
          </button>
        ) : null}
      </td>
      <td className="py-3 pr-3 small-caps text-[0.58rem] text-cyan">{ritmoLabel(game, id)}</td>
      <td className="py-3 pr-3 small-caps text-[0.58rem]">{STAGE_LABEL[st.stage]}</td>
      <td className="py-3 pr-3 small-caps text-[0.58rem] text-ink-soft">{NEXT_HITO[st.stage]}</td>
      <BottleCell bottle={bottle} />
    </tr>
  );
}

function EnsayoRow() {
  const game = useObra((s) => s.game);
  const proto = game.prototype;
  if (!proto) return null;
  const people = peopleOn(game, "ensayo");
  const crew = game.crews.find((c) => c.front === "ensayo");
  return (
    <tr className="border-b border-rule/70 align-top">
      <td className="py-3 pr-3 font-sans tracking-wide text-ink">{crew?.name ?? "—"}</td>
      <td className="py-3 pr-3 small-caps text-[0.62rem]">ENSAYO · {proto.name.toUpperCase()}</td>
      <td className="py-3 pr-3 tabular-nums text-ink">
        {people.obreros} OBR · {people.capataces} CAP · {people.ingenieros} ING · {people.topografos} TOP
      </td>
      <td className="py-3 pr-3 small-caps text-[0.58rem] text-cyan">{protoRitmo(game)}</td>
      <td className="py-3 pr-3 small-caps text-[0.58rem]">{STAGE_LABEL[proto.stage]}</td>
      <td className="py-3 pr-3 small-caps text-[0.58rem] text-ink-soft">{NEXT_HITO[proto.stage]}</td>
      <BottleCell bottle={protoBottle(game)} />
    </tr>
  );
}

function CrewBlock({
  title,
  crews,
  empty,
}: {
  title: string;
  crews: { id: string }[];
  empty: string | null;
}) {
  const game = useObra((s) => s.game);
  const list = game.crews.filter((c) => crews.some((x) => x.id === c.id));

  return (
    <section className="mt-10">
      <h3 className="small-caps border-b border-ink/20 pb-1 text-[0.62rem] text-ink">{title}</h3>
      {list.length === 0 ? (
        empty ? <p className="mt-3 font-serif italic text-ink-soft">{empty}</p> : null
      ) : (
        <ul className="mt-2">
          {list.map((crew) => (
            <CrewRow key={crew.id} id={crew.id} />
          ))}
        </ul>
      )}
    </section>
  );
}

function CrewRow({ id }: { id: string }) {
  const game = useObra((s) => s.game);
  const shift = useObra((s) => s.shift);
  const cycleFront = useObra((s) => s.cycleFront);
  const crew = game.crews.find((c) => c.id === id);
  if (!crew) return null;
  const heads = crewHeadcount(crew);
  const pool = reservaPool(game);
  const noTop = pool.topografos < 1;

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-rule/70 py-2">
      <div className="min-w-0">
        <p className="font-sans tracking-wide text-ink">{crew.name}</p>
        <button
          type="button"
          onClick={() => cycleFront(crew.id)}
          className="small-caps min-h-11 text-[0.58rem] text-cyan"
        >
          {frontPosting(crew.front)} · {FRONT_LABEL[crew.front]} · {heads} · cambiar frente
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {OFICIOS.map((o) => {
          const n = crew[OFICIO_KEY[o.id]];
          const addTopLocked = o.id === "topografo" && noTop;
          return (
            <div key={o.id} className="flex items-center" title={RESOURCE_HINT[o.short]}>
              <span className="small-caps mr-1 w-8 text-[0.52rem] text-ink-soft">{o.short}</span>
              <button
                type="button"
                className="min-h-11 min-w-11 text-lg text-ink-soft"
                onClick={() => shift(crew.id, o.id, -1)}
                aria-label={`Quitar ${o.short}`}
              >
                −
              </button>
              <span className="w-5 text-center tabular-nums">{n}</span>
              <button
                type="button"
                disabled={addTopLocked}
                className="min-h-11 min-w-11 text-lg text-ink-soft disabled:text-faint"
                onClick={() => shift(crew.id, o.id, 1)}
                aria-label={addTopLocked ? "SIN TOP EN RESERVA" : `Añadir ${o.short}`}
                title={addTopLocked ? "SIN TOP EN RESERVA" : `Añadir ${o.short}`}
              >
                +
              </button>
              {addTopLocked ? (
                <span className="small-caps ml-1 max-w-[7.5rem] text-[0.48rem] leading-tight text-faint">
                  SIN TOP EN RESERVA
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </li>
  );
}
