import { CommandCard } from "./CommandCard";
import { EventStrip } from "./EventStrip";
import { FirstGesture } from "./FirstGesture";
import { FrontChips } from "./FrontChips";
import { Leyenda } from "./Leyenda";
import { PliegoStrip } from "./PliegoStrip";
import { TerrainCanvas } from "./TerrainCanvas";

export function Plano() {
  return (
    <section className="relative h-full min-h-0">
      <div className="absolute inset-0">
        <TerrainCanvas />
      </div>
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-2">
            <PliegoStrip />
            <Leyenda />
            <FrontChips />
          </div>
          <div className="flex flex-col items-end gap-2">
            <EventStrip />
            <CommandCard />
          </div>
        </div>
        <FirstGesture />
      </div>
    </section>
  );
}
