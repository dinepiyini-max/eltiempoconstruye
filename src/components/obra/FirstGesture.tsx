import { SCRIPT_60 } from "@/lib/obra/pliego";
import { useObra } from "@/lib/obra/store";
import { V1_CONTRACT_IDS } from "@/lib/obra/types";

const SEALS: { id: (typeof V1_CONTRACT_IDS)[number]; label: string }[] = [
  { id: "camino", label: "CAMINO" },
  { id: "puente", label: "PUENTE" },
  { id: "muro", label: "MURO" },
];

export function FirstGesture() {
  const hydrated = useObra((s) => s.hydrated);
  const survey = useObra((s) => s.game.survey);
  const surveying = useObra((s) => s.game.surveying);
  const instruction = useObra((s) => s.game.instruction);
  const selected = useObra((s) => s.game.selected);
  const startSurvey = useObra((s) => s.startSurvey);
  const signFirst = useObra((s) => s.signFirst);
  const select = useObra((s) => s.select);

  if (!hydrated) return null;

  if (survey < 1 && surveying) {
    const pct = Math.round(survey * 100);
    return (
      <div className="pointer-events-none flex justify-center">
        <p className="small-caps border border-stamp bg-paper/95 px-4 py-2 text-[0.72rem] tracking-[0.28em] text-stamp">
          {SCRIPT_60.levantando}… {pct}%
        </p>
      </div>
    );
  }

  if (survey < 1 && !surveying) {
    return (
      <div className="pointer-events-auto flex justify-center">
        <button
          type="button"
          onClick={startSurvey}
          className="stamp min-h-12 px-4 py-2 text-[0.72rem] tracking-[0.28em]"
        >
          {SCRIPT_60.levanta}
        </button>
      </div>
    );
  }

  if (instruction === "define") {
    const pending = selected && (V1_CONTRACT_IDS as readonly string[]).includes(selected) ? selected : null;
    return (
      <div className="pointer-events-auto flex flex-col items-center gap-3">
        <p className="max-w-sm text-center font-serif text-sm italic text-ink">{SCRIPT_60.define}</p>
        <p className="max-w-sm text-center font-serif text-sm italic text-ink-soft">{SCRIPT_60.hold}</p>
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5">
          {SEALS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => select(s.id)}
              aria-pressed={pending === s.id}
              className={`stamp min-h-12 min-w-24 px-3 py-2 text-[0.72rem] tracking-[0.32em] ${
                pending === s.id ? "bg-paper" : "opacity-80"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        {pending ? (
          <button
            type="button"
            onClick={() => signFirst(pending)}
            className="stamp min-h-12 px-5 py-2 text-[0.78rem] tracking-[0.28em]"
          >
            {SCRIPT_60.firmar}
          </button>
        ) : null}
      </div>
    );
  }

  return null;
}
