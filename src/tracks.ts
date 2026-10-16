import type { BandKey } from "./types";

export interface TrackConfig {
  index: number;
  bandKey: BandKey;
  name: string;
  color: string;
  note: string;
  midiNote: number;
  midiProgram: number;
  oscillatorLabel: string;
  pan: number;
}

export const TRACKS = [
  { index: 0, bandKey: "band_01", name: "Ember", color: "#ff4d5e", note: "C2", midiNote: 36, midiProgram: 38, oscillatorLabel: "Saw bass", pan: -0.7 },
  { index: 1, bandKey: "band_02", name: "Vermilion", color: "#ff654b", note: "D2", midiNote: 38, midiProgram: 81, oscillatorLabel: "FM lead", pan: 0.45 },
  { index: 2, bandKey: "band_03", name: "Tangerine", color: "#ff7b3f", note: "E2", midiNote: 40, midiProgram: 12, oscillatorLabel: "Marimba FM", pan: -0.35 },
  { index: 3, bandKey: "band_04", name: "Amber", color: "#ff9638", note: "G2", midiNote: 43, midiProgram: 24, oscillatorLabel: "AM pluck", pan: 0.65 },
  { index: 4, bandKey: "band_05", name: "Gold", color: "#ffb52e", note: "A2", midiNote: 45, midiProgram: 14, oscillatorLabel: "Bell FM", pan: -0.55 },
  { index: 5, bandKey: "band_06", name: "Citrine", color: "#e3cf35", note: "C3", midiNote: 48, midiProgram: 69, oscillatorLabel: "AM reed", pan: 0.3 },
  { index: 6, bandKey: "band_07", name: "Lime", color: "#afd448", note: "D3", midiNote: 50, midiProgram: 11, oscillatorLabel: "Triangle glass", pan: -0.2 },
  { index: 7, bandKey: "band_08", name: "Leaf", color: "#73d66b", note: "E3", midiNote: 52, midiProgram: 16, oscillatorLabel: "Filtered organ", pan: 0.55 },
  { index: 8, bandKey: "band_09", name: "Emerald", color: "#3acb91", note: "G3", midiNote: 55, midiProgram: 108, oscillatorLabel: "Kalimba FM", pan: -0.45 },
  { index: 9, bandKey: "band_10", name: "Teal", color: "#22c1b2", note: "C2", midiNote: 42, midiProgram: 0, oscillatorLabel: "Spectrum drum", pan: 0 },
  { index: 10, bandKey: "band_11", name: "Cyan", color: "#25b5d8", note: "C4", midiNote: 60, midiProgram: 5, oscillatorLabel: "Electric FM", pan: 0.35 },
  { index: 11, bandKey: "band_12", name: "Azure", color: "#3e9cf3", note: "D4", midiNote: 62, midiProgram: 71, oscillatorLabel: "Square reed", pan: -0.6 },
  { index: 12, bandKey: "band_13", name: "Cobalt", color: "#637ff7", note: "E4", midiNote: 64, midiProgram: 89, oscillatorLabel: "Warm fat pad", pan: 0.5 },
  { index: 13, bandKey: "band_14", name: "Indigo", color: "#8068ed", note: "G4", midiNote: 67, midiProgram: 52, oscillatorLabel: "AM choir", pan: -0.3 },
  { index: 14, bandKey: "band_15", name: "Violet", color: "#9a59df", note: "A4", midiNote: 69, midiProgram: 10, oscillatorLabel: "Music box FM", pan: 0.7 },
  { index: 15, bandKey: "band_16", name: "Amethyst", color: "#b149d0", note: "C5", midiNote: 72, midiProgram: 87, oscillatorLabel: "Bright mono", pan: -0.1 },
] as const satisfies readonly TrackConfig[];

export const STEPS_PER_ELEMENT = TRACKS.length;
export const NOTE_DURATION = "16n";
