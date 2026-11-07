export type ScaleMode = "major" | "minor";

export interface MusicKey {
  id: string;
  label: string;
  tonic: string;
  pitchClass: number;
  mode: ScaleMode;
}

export interface TonalSettings {
  keyId: string;
  startingOctave: number;
}

const MAJOR_KEYS = [
  ["C-major", "C major", "C", 0],
  ["Db-major", "D♭ major", "Db", 1],
  ["D-major", "D major", "D", 2],
  ["Eb-major", "E♭ major", "Eb", 3],
  ["E-major", "E major", "E", 4],
  ["F-major", "F major", "F", 5],
  ["F#-major", "F♯ major", "F#", 6],
  ["G-major", "G major", "G", 7],
  ["Ab-major", "A♭ major", "Ab", 8],
  ["A-major", "A major", "A", 9],
  ["Bb-major", "B♭ major", "Bb", 10],
  ["B-major", "B major", "B", 11],
] as const;

const MINOR_KEYS = [
  ["C-minor", "C minor", "C", 0],
  ["C#-minor", "C♯ minor", "C#", 1],
  ["D-minor", "D minor", "D", 2],
  ["Eb-minor", "E♭ minor", "Eb", 3],
  ["E-minor", "E minor", "E", 4],
  ["F-minor", "F minor", "F", 5],
  ["F#-minor", "F♯ minor", "F#", 6],
  ["G-minor", "G minor", "G", 7],
  ["G#-minor", "G♯ minor", "G#", 8],
  ["A-minor", "A minor", "A", 9],
  ["Bb-minor", "B♭ minor", "Bb", 10],
  ["B-minor", "B minor", "B", 11],
] as const;

export const MUSIC_KEYS: readonly MusicKey[] = [
  ...MAJOR_KEYS.map(([id, label, tonic, pitchClass]) => ({
    id,
    label,
    tonic,
    pitchClass,
    mode: "major" as const,
  })),
  ...MINOR_KEYS.map(([id, label, tonic, pitchClass]) => ({
    id,
    label,
    tonic,
    pitchClass,
    mode: "minor" as const,
  })),
];

export const DEFAULT_TONAL_SETTINGS: TonalSettings = {
  keyId: "C-major",
  startingOctave: 2,
};

export const STARTING_OCTAVES = [1, 2, 3, 4, 5] as const;

const SCALE_INTERVALS: Record<ScaleMode, readonly number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};

const CHROMATIC_NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

const NOTE_LETTERS = ["C", "D", "E", "F", "G", "A", "B"] as const;
const NATURAL_PITCH_CLASSES = [0, 2, 4, 5, 7, 9, 11] as const;

export interface ScalePitch {
  note: string;
  toneNote: string;
  midiNote: number;
}

export function getMusicKey(keyId: string): MusicKey {
  return (
    MUSIC_KEYS.find((key) => key.id === keyId) ??
    MUSIC_KEYS.find((key) => key.id === DEFAULT_TONAL_SETTINGS.keyId)!
  );
}

export function getScalePitch(
  settings: TonalSettings,
  scaleDegreeIndex: number,
): ScalePitch {
  const key = getMusicKey(settings.keyId);
  const safeOctave = Math.max(1, Math.min(5, Math.round(settings.startingOctave)));
  const intervals = SCALE_INTERVALS[key.mode];
  const degree = Math.max(0, Math.round(scaleDegreeIndex));
  const scaleOctave = Math.floor(degree / intervals.length);
  const interval = intervals[degree % intervals.length] + scaleOctave * 12;
  const midiNote = (safeOctave + 1) * 12 + key.pitchClass + interval;
  const pitchClass = ((midiNote % 12) + 12) % 12;
  const octave = Math.floor(midiNote / 12) - 1;
  const tonicLetterIndex = NOTE_LETTERS.indexOf(
    key.tonic[0] as (typeof NOTE_LETTERS)[number],
  );
  const scaleDegree = degree % intervals.length;
  const noteLetterIndex = (tonicLetterIndex + scaleDegree) % NOTE_LETTERS.length;
  const noteLetter = NOTE_LETTERS[noteLetterIndex];
  const naturalPitchClass = NATURAL_PITCH_CLASSES[noteLetterIndex];
  let accidentalDistance = pitchClass - naturalPitchClass;
  if (accidentalDistance > 6) accidentalDistance -= 12;
  if (accidentalDistance < -6) accidentalDistance += 12;
  const accidental =
    accidentalDistance > 0
      ? "#".repeat(accidentalDistance)
      : "b".repeat(-accidentalDistance);
  const displayOctave =
    safeOctave + scaleOctave + (noteLetterIndex < tonicLetterIndex ? 1 : 0);

  return {
    note: `${noteLetter}${accidental}${displayOctave}`,
    toneNote: `${CHROMATIC_NOTE_NAMES[pitchClass]}${octave}`,
    midiNote,
  };
}

export function tonalSettingsSlug(settings: TonalSettings): string {
  const key = getMusicKey(settings.keyId);
  return `${key.tonic.replace("#", "sharp").replace("b", "flat")}-${key.mode}-oct${settings.startingOctave}`;
}
