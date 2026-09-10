import { STRUCTURE_NAME } from "@/lib/obra/catalog";
import { commandLines } from "@/lib/obra/draw";
import { SCRIPT_60 } from "@/lib/obra/pliego";
import {
  bottleAction,
  bottleGloss,
  contractClock,
  contractFor,
  floodLine,
  isV1Contract,
  needsStaff,
  requirementGap,
  staffGate,
} from "@/lib/obra/sim";
import { useObra } from "@/lib/obra/store";
import { Pedidos } from "./Pedidos";

export function CommandCard() {
  const selected = useObra((s) => s.game.selected);
  const game = useObra((s) => s.game);
  const accept = useObra((s) => s.accept);
  const select = useObra((s) => s.select);
  const staffFront = useObra((s) => s.staffFront);
  if (!selected) return null;
  if (game.instruction === "define") return null;
  const st = game.structures[selected];
  const lines = commandLines(game, selected);
  const contract = contractFor(game, selected);
  const v1 = isV1Contract(selected);
  const gap = !st.opened && v1 ? requirementGap(game, selected) : null;
  const staff = st.opened && needsStaff(game, selected);
  const gate = staff ? staffGate(game, selected) : { ok: true, reason: "" };
  const bottle = gap ?? lines.bottle;
  const gloss = bottleGloss(bottle);
  const action = bottleAction(bottle);
  const canSign =
    v1 &&
    contract &&
    contract.status !== "cumplido" &&
    contract.status !== "activo" &&
    !st.opened &&
    !gap;
  const clock = contract ? contractClock(game, contract) : null;
  const flood = floodLine(game);

  return (
    <aside className="pointer-events-auto w-full max-w-xs border border-ink/20 bg-paper/95 px-3 py-2 shadow-sheet">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="small-caps text-[0.55rem] text-cyan">Nota de plano</p>
          <h2 className="font-serif text-lg leading-tight text-ink">{STRUCTURE_NAME[selected]}</h2>
        </div>
        <button
          type="button"
          className="small-caps min-h-11 px-2 text-[0.55rem] text-ink-soft"
          onClick={() => select(null)}
        >
          Cerrar
        </button>
      </div>

      {contract?.purpose ? (
        <p className="mt-2 font-serif text-sm leading-snug text-ink-soft">{contract.purpose}</p>
      ) : null}

      <dl className="mt-2 space-y-1 text-[0.78rem] text-ink">
        <Row k="Estado" v={lines.stage} />
        <Row k="Cuadrilla" v={lines.crew} />
        <Row k="Dotación" v={lines.people} />
        <Row k="Productividad" v={lines.prod} />
        <Row k="Hito" v={lines.next} />
        <Row k="Cuello" v={bottle ?? "—"} accent={!!bottle} />
        {st.opened ? <Row k="Crecida" v={flood} /> : null}
        {clock && contract?.status === "activo" ? (
          <Row
            k="Obra estimada del frente"
            v={clock.late ? "TARDÍO" : `${clock.remaining} d`}
            accent={clock.late}
          />
        ) : null}
        {contract && (contract.status === "activo" || contract.status === "cumplido") ? (
          <Row
            k={contract.status === "cumplido" ? "Prestigio" : "Prestigio al completar"}
            v={`${contract.prestigio}`}
          />
        ) : null}
      </dl>

      {gloss ? <p className="mt-3 font-serif text-sm leading-snug text-ink-soft">{gloss}</p> : null}
      {action ? <p className="mt-1 font-serif text-sm text-ink">{action}</p> : null}

      {game.lastNotice ? (
        <p className="mt-2 font-serif text-sm leading-snug text-rust">{game.lastNotice}</p>
      ) : null}

      {staff ? (
        <button
          type="button"
          disabled={!gate.ok}
          onClick={() => staffFront(selected)}
          title={gate.ok ? "Asignar desde disponibles" : gate.reason}
          className="small-caps mt-3 min-h-11 w-full border border-ink px-3 text-[0.62rem] text-ink disabled:border-rule disabled:text-faint"
        >
          {gate.ok ? "Asignar desde disponibles" : gate.reason}
        </button>
      ) : null}

      {st.opened ? (
        <div className="mt-3">
          <p className="small-caps mb-1 text-[0.52rem] text-ink-soft">Almacén del valle</p>
          <Pedidos compact />
        </div>
      ) : null}

      {canSign && contract ? (
        <button
          type="button"
          onClick={() => accept(contract.id)}
          className="stamp mt-4 min-h-11 px-3 py-1 text-[0.62rem]"
        >
          {SCRIPT_60.firmar}
        </button>
      ) : null}
    </aside>
  );
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-rule/50 pb-1">
      <dt className="small-caps text-[0.58rem] text-ink-soft">{k}</dt>
      <dd className={`text-right ${accent ? "text-rust" : "text-ink"}`}>{v}</dd>
    </div>
  );
}
