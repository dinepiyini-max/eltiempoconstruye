import { NEXT_HITO, STAGE_LABEL, STRUCTURE_NAME, VALLEY_NAME } from "@/lib/obra/catalog";
import { difficultyMarks, formatInt } from "@/lib/obra/format";
import { MANDANTE, PLIEGO_LINES, SCRIPT_60 } from "@/lib/obra/pliego";
import {
  bottleneckOf,
  bottleAction,
  contractClock,
  floodLine,
  gapGloss,
  requirementGap,
} from "@/lib/obra/sim";
import { useObra } from "@/lib/obra/store";
import type { Contract } from "@/lib/obra/types";

const STATUS: Record<Contract["status"], string> = {
  bloqueado: "BLOQUEADO",
  disponible: "PROPUESTO",
  activo: "EN OBRA",
  cumplido: "CERRADO",
};

export function Contratos() {
  const contracts = useObra((s) => s.game.contracts);
  const prestigio = useObra((s) => s.game.prestigio);
  const game = useObra((s) => s.game);
  const flood = floodLine(game);

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col px-4 py-4 sm:px-8">
      <header className="border-b border-ink/20 pb-3">
        <p className="small-caps text-[0.62rem] text-cyan">
          Pliego · {VALLEY_NAME} · {MANDANTE}
        </p>
        <h2 className="font-serif text-3xl text-ink">Contratos</h2>
        <p className="mt-1 font-serif italic text-ink-soft">
          Tres encargos del mismo pliego. Prestigio {formatInt(prestigio)}.
        </p>
        <p className="mt-2 small-caps text-[0.6rem] text-stamp">{flood}</p>
        <p className="mt-2 font-serif text-sm leading-snug text-ink-soft">{PLIEGO_LINES[2]}</p>
      </header>
      <ol className="mt-3 flex flex-col gap-3 pb-8">
        {contracts.map((c, i) => (
          <ContractBlock key={c.id} contract={c} index={i + 1} />
        ))}
      </ol>
    </section>
  );
}

function ContractBlock({ contract, index }: { contract: Contract; index: number }) {
  const game = useObra((s) => s.game);
  const accept = useObra((s) => s.accept);
  const gap =
    contract.status === "activo" || contract.status === "cumplido"
      ? null
      : requirementGap(game, contract.structureId);
  const canSign = contract.status === "disponible" && !gap;
  const gloss = gapGloss(gap);
  const clock = contractClock(game, contract);
  const st = game.structures[contract.structureId];
  const bottle = contract.status === "activo" ? bottleneckOf(game, contract.structureId) : null;
  const action = bottleAction(bottle);
  const flood = floodLine(game);
  const estimado = `${contract.durationDays} días · obra estimada del frente`;

  return (
    <li className="border border-ink/20 bg-paper px-4 py-4 shadow-sheet">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="small-caps text-[0.6rem] text-ink-soft">Contrato {String(index).padStart(3, "0")}</p>
        <p className="small-caps text-[0.6rem] text-stamp">{STATUS[contract.status]}</p>
      </div>
      <h3 className="mt-1 font-serif text-2xl text-ink">{contract.title}</h3>
      <p className="mt-1 max-w-prose font-serif text-[1.02rem] leading-snug text-ink-soft">{contract.body}</p>
      <p className="mt-3 font-serif text-sm leading-snug text-ink">{contract.purpose}</p>
      <p className="mt-1 font-serif text-sm italic leading-snug text-stamp">{contract.threat}</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        <Item k="Presupuesto" v={formatInt(contract.cost)} />
        <Item k="Obra estimada del frente" v={estimado} />
        <Item k="Crecida" v={flood} />
        <Item k="Dificultad" v={difficultyMarks(contract.difficulty)} />
        <Item k="Prestigio" v={`${contract.prestigio}${contract.status === "cumplido" ? " · ganado" : ""}`} />
        <Item k="Pieza" v={STRUCTURE_NAME[contract.structureId]} />
        {contract.status === "activo" ? (
          <>
            <Item k="Hito" v={`${STAGE_LABEL[st.stage]} → ${NEXT_HITO[st.stage]}`} />
            <Item k="Cuello" v={bottle ?? "—"} />
            <Item
              k="Plazo del frente"
              v={
                clock.dueDay != null
                  ? clock.late
                    ? `TARDÍO · debía el día ${clock.dueDay}`
                    : `${clock.remaining} d · vence día ${clock.dueDay}`
                  : estimado
              }
            />
          </>
        ) : null}
      </dl>
      {action ? <p className="mt-2 font-serif text-sm text-ink">{action}</p> : null}
      {gap ? <p className="mt-3 small-caps text-[0.6rem] text-rust">{gap}</p> : null}
      {gloss ? <p className="mt-2 max-w-prose font-serif text-sm leading-snug text-ink-soft">{gloss}</p> : null}
      {canSign ? (
        <button
          type="button"
          onClick={() => accept(contract.id)}
          className="stamp mt-4 min-h-11 px-4 py-1 text-[0.68rem]"
        >
          {SCRIPT_60.firmar}
        </button>
      ) : null}
      {contract.status === "activo" || contract.status === "cumplido" ? (
        <p className="stamp mt-4 inline-block px-3 py-1 text-[0.62rem] opacity-80">{STATUS[contract.status]}</p>
      ) : null}
    </li>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="small-caps text-[0.55rem] text-ink-soft">{k}</dt>
      <dd className="tabular-nums text-ink">{v}</dd>
    </div>
  );
}
