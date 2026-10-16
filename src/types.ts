export const BAND_KEYS = [
  "band_01",
  "band_02",
  "band_03",
  "band_04",
  "band_05",
  "band_06",
  "band_07",
  "band_08",
  "band_09",
  "band_10",
  "band_11",
  "band_12",
  "band_13",
  "band_14",
  "band_15",
  "band_16",
] as const;

export type BandKey = (typeof BAND_KEYS)[number];

export type ElementCategory =
  | "nonmetal"
  | "noble gas"
  | "alkali metal"
  | "alkaline earth metal"
  | "metalloid"
  | "halogen"
  | "transition metal"
  | "post-transition metal"
  | "lanthanide"
  | "actinide";

export interface ElementRecord {
  atomicNumber: number;
  symbol: string;
  elementCategory: ElementCategory;
  grid: {
    row: number;
    column: number;
  };
  colorAggregates: Record<BandKey, number>;
}

export interface BandMetadata {
  key: BandKey;
  midiTrack: number;
  spectrumOrder: number;
  spectrumPositionStart: number;
  spectrumPositionEnd: number;
  localPixelYStart: number;
  localPixelYEndExclusive: number;
  direction: string;
}

export interface SpectrumDataset {
  schemaVersion: number;
  source: string;
  grid: {
    rows: number;
    columns: number;
    occupiedElements: number;
  };
  extraction: {
    bandCount: number;
    bandOrder: string;
  };
  bands: BandMetadata[];
  elements: ElementRecord[];
}
