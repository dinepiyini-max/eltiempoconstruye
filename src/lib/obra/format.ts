export function formatInt(n: number): string {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(
    Math.round(n),
  );
}

export function formatMoney(n: number): string {
  return formatInt(n);
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function clockParts(siteMinutes: number): {
  day: number;
  hour: number;
  minute: number;
  label: string;
  short: string;
} {
  const total = Math.max(0, Math.floor(siteMinutes));
  const day = Math.floor(total / (24 * 60)) + 1;
  const md = total % (24 * 60);
  const hour = Math.floor(md / 60);
  const minute = md % 60;
  return {
    day,
    hour,
    minute,
    label: `DÍA ${pad2(day)}  ·  ${pad2(hour)}:${pad2(minute)}`,
    short: `${pad2(hour)}:${pad2(minute)}`,
  };
}

export function formatHours(h: number): string {
  if (h < 10) return `${h.toFixed(1).replace(".", ",")} h`;
  return `${formatInt(h)} h`;
}

export function difficultyMarks(n: 1 | 2 | 3): string {
  return "I".repeat(n);
}

export function noteMetaLine(n: {
  siteMinutes: number;
  page?: string;
  front?: string | null;
  regime?: string;
  coords?: { x: number; y: number } | null;
}): string {
  const c = clockParts(n.siteMinutes);
  const page = (n.page ?? "plano").toUpperCase();
  const front = n.front ? String(n.front).toUpperCase() : "—";
  const regime = n.regime === "siempre" ? "SIEMPRE" : "TURNO";
  const coords = n.coords ? ` · ${Math.round(n.coords.x)},${Math.round(n.coords.y)}` : "";
  return `${c.label} · ${page} · ${front} · ${regime}${coords}`;
}

export function formatLibretaText(
  notes: {
    kind: string;
    line: string;
    siteMinutes: number;
    page?: string;
    front?: string | null;
    regime?: string;
    coords?: { x: number; y: number } | null;
  }[],
  valley = "Valle del Yuna",
): string {
  const head = `OBRA · ${valley}`;
  if (!notes.length) return `${head}\n\nLibreta vacía.`;
  const body = notes
    .map((n) => `${noteMetaLine(n)}\n${n.kind}\n${n.line}`)
    .join("\n\n");
  return `${head}\n\n${body}\n`;
}

export function formatLibretaMarkdown(
  notes: {
    kind: string;
    line: string;
    siteMinutes: number;
    page?: string;
    front?: string | null;
    regime?: string;
    coords?: { x: number; y: number } | null;
  }[],
  valley = "Valle del Yuna",
): string {
  const head = `# OBRA · ${valley}\n\nLibreta de campo.\n`;
  if (!notes.length) return `${head}\n*Libreta vacía.*\n`;
  const body = notes
    .map((n) => `## ${n.kind}\n\n\`${noteMetaLine(n)}\`\n\n${n.line}\n`)
    .join("\n");
  return `${head}\n${body}`;
}
