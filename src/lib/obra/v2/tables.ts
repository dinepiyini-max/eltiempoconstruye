/**
 * Tablas V2. No son STRUCTURE_DEF. No son el pliego del Yuna.
 * Geometry/Quantity/Cost leen de aquí.
 */

export const V2_SCALE_M_PER_UNIT = 2;

export type V2Kind = "via" | "contencion" | "losa";

/** Sección teórica (m). Independiente del catálogo Yuna. */
export const V2_SECTIONS: Record<
  V2Kind,
  { cutWidthM: number; hormigonM2: number; steelTPerM3: number }
> = {
  via: { cutWidthM: 8, hormigonM2: 1.32, steelTPerM3: 0.035 },
  contencion: { cutWidthM: 2.2, hormigonM2: 1.92, steelTPerM3: 0.09 },
  losa: { cutWidthM: 5, hormigonM2: 2.56, steelTPerM3: 0.12 },
};

export const V2_UNIT_PRICES = {
  excavacion: { price: 180, unit: "m³", label: "excavación" },
  hormigon: { price: 4200, unit: "m³", label: "Hormigón" },
  acero: { price: 62000, unit: "t", label: "Acero est." },
  block6: { price: 28, unit: "u", label: 'Block 6"' },
  mortero: { price: 1800, unit: "m³", label: "Mortero" },
  albanil: { price: 450, unit: "m²", label: "Mano de obra albañil" },
} as const;

export type V2PriceKey = keyof typeof V2_UNIT_PRICES;

/** Lámina vacía del editor. Metros, no unidades del valle. */
export const V2_SHEET = { widthM: 24, heightM: 16 } as const;

/** Muro de fábrica. Alto y bloque para el takeoff mínimo. */
export const V2_MURO = {
  altoM: 2.4,
  espesorM: 0.2,
  minLargoM: 0.3,
  blockFaceM2: 0.08,
  /** m³ de mortero por m² de muro neto. Juego, no ERP. */
  morteroM3PerM2: 0.02,
} as const;

/** Vanos sobre muro. Ancho por defecto: puerta 0.90 m, ventana 1.20 m. */
export const V2_HUECO = {
  puerta: { anchoM: 0.9, altoM: 2.1 },
  ventana: { anchoM: 1.2, altoM: 1.2 },
  minJambaM: 0.08,
} as const;

/** FASE F — estructura mínima. Precios de juego, no ERP. */
export const V2_COLUMNA = {
  ladoM: 0.3,
  altoM: 2.4,
  steelTPerM3: 0.09,
} as const;

export const V2_ZAPATA = {
  ladoM: 0.8,
  cantoM: 0.4,
  snapM: 0.5,
  steelTPerM3: 0.04,
} as const;

export const V2_VIGA = {
  anchoM: 0.2,
  cantoM: 0.3,
  minLargoM: 0.3,
  steelTPerM3: 0.12,
} as const;

export const V2_LOSA_PLANTA = {
  espesorM: 0.12,
  minAreaM2: 0.4,
  steelTPerM3: 0.1,
} as const;

/** Reloj de lámina. No es siteMinutes. */
export const V2_RETRABAJO = { factor: 0.08 } as const;
