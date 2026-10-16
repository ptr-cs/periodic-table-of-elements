import { Midi } from "@tonejs/midi";
import { BAND_KEYS, type ElementRecord } from "./types";
import { STEPS_PER_ELEMENT, TRACKS } from "./tracks";
import { scaleBrightnessVelocity } from "./velocity";

const NOTE_GATE = 0.9;
const MIDI_VELOCITY_STEPS = 127;

export interface MidiExportSummary {
  bytes: Uint8Array;
  filename: string;
  noteCount: number;
  instrumentTrackCount: number;
  durationSeconds: number;
}

export interface MidiExportOptions {
  liftDimValues?: boolean;
}

function midiVelocity(brightness: number): number {
  if (brightness <= 0) {
    return 0;
  }

  const quantized = Math.max(
    1,
    Math.round(Math.min(1, brightness) * MIDI_VELOCITY_STEPS),
  );
  return quantized / MIDI_VELOCITY_STEPS;
}

export function createMidiFile(
  elements: readonly ElementRecord[],
  bpm: number,
  options: MidiExportOptions = {},
): MidiExportSummary {
  const midi = new Midi();
  midi.name = "Periodic Table Color Sonification";
  midi.header.setTempo(bpm);
  midi.header.timeSignatures.push({
    ticks: 0,
    timeSignature: [4, 4],
  });
  midi.header.keySignatures.push({
    ticks: 0,
    key: "C",
    scale: "major",
  });

  const stepTicks = midi.header.ppq / 4;
  const durationTicks = Math.round(stepTicks * NOTE_GATE);
  const totalTicks = elements.length * STEPS_PER_ELEMENT * stepTicks;
  let noteCount = 0;

  elements.forEach((element, elementIndex) => {
    midi.header.meta.push({
      ticks: elementIndex * STEPS_PER_ELEMENT * stepTicks,
      type: "marker",
      text: `${String(element.atomicNumber).padStart(2, "0")} ${element.symbol} · ${element.elementCategory}`,
    });
  });
  midi.header.meta.push({
    ticks: totalTicks,
    type: "marker",
    text: "Sequence end",
  });

  TRACKS.forEach((config, bandIndex) => {
    const track = midi.addTrack();
    track.name = `${String(config.index + 1).padStart(2, "0")} ${config.bandKey} · ${config.name}`;
    track.channel = config.index;
    track.instrument.number = config.midiProgram;

    elements.forEach((element, elementIndex) => {
      const brightness = element.colorAggregates[BAND_KEYS[bandIndex]];

      // Zero is a fixed-position rest. It does not collapse the timeline.
      if (brightness === 0) {
        return;
      }

      track.addNote({
        midi: config.midiNote,
        ticks: (elementIndex * STEPS_PER_ELEMENT + bandIndex) * stepTicks,
        durationTicks,
        velocity: midiVelocity(
          scaleBrightnessVelocity(brightness, options.liftDimValues ?? false),
        ),
      });
      noteCount += 1;
    });

    // Hold every track to the nominal sequence end and release lingering notes.
    track.addCC({
      number: 123,
      ticks: totalTicks,
      value: 0,
    });
  });

  midi.header.update();
  const bytes = Uint8Array.from(midi.toArray());
  const safeBpm = Math.round(bpm);

  return {
    bytes,
    filename: `periodic-spectrum-${safeBpm}bpm.mid`,
    noteCount,
    instrumentTrackCount: TRACKS.length,
    durationSeconds: (elements.length * 4 * 60) / bpm,
  };
}

export function downloadMidiFile(
  elements: readonly ElementRecord[],
  bpm: number,
  options: MidiExportOptions = {},
): MidiExportSummary {
  const summary = createMidiFile(elements, bpm, options);
  const arrayBuffer = new ArrayBuffer(summary.bytes.byteLength);
  new Uint8Array(arrayBuffer).set(summary.bytes);
  const blob = new Blob([arrayBuffer], { type: "audio/midi" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = summary.filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return summary;
}
