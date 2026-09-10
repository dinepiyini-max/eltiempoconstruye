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
  const startSurvey = useObra((s) => s.startSurvey);
  const signFirst = useObra((s) => s.signFirst);

  if (!hydrated) return null;

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
    return (
      <div className="pointer-events-auto flex flex-col items-center gap-3">
        <p className="max-w-sm text-center font-serif text-sm italic text-ink">{SCRIPT_60.define}</p>
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5">
          {SEALS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => signFirst(s.id)}
              className="stamp min-h-12 min-w-24 px-3 py-2 text-[0.72rem] tracking-[0.32em]"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
