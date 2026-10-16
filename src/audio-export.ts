import * as Tone from "tone";
import { elements } from "./data";
import {
  createVoice,
  TRACK_HEADROOM_DB,
  type TrackState,
} from "./sequencer";
import { NOTE_DURATION, STEPS_PER_ELEMENT, TRACKS } from "./tracks";
import { scaleBrightnessVelocity } from "./velocity";

const PREFERRED_SAMPLE_RATES = [192_000, 96_000, 48_000, 44_100] as const;
const WAV_BIT_DEPTH = 24;
const CHANNEL_COUNT = 2;
const RELEASE_TAIL_SECONDS = 0.5;
const ENCODE_YIELD_FRAMES = 262_144;

export type AudioExportPhase = "checking" | "rendering" | "encoding";

export interface AudioExportProgress {
  phase: AudioExportPhase;
  sampleRate: number;
}

export interface AudioExportOptions {
  bpm: number;
  masterPercent: number;
  liftDimValues: boolean;
  trackStates: readonly TrackState[];
  onProgress?: (progress: AudioExportProgress) => void;
}

export interface AudioExportSummary {
  filename: string;
  sampleRate: number;
  bitDepth: number;
  channelCount: number;
  durationSeconds: number;
  bytes: number;
}

function browserSupportsSampleRate(sampleRate: number): boolean {
  try {
    const context = new OfflineAudioContext(1, 1, sampleRate);
    return context.sampleRate === sampleRate;
  } catch {
    return false;
  }
}

function renderDurationSeconds(bpm: number): number {
  return (elements.length * 4 * 60) / bpm + RELEASE_TAIL_SECONDS;
}

async function renderToneMix(
  sampleRate: number,
  options: AudioExportOptions,
): Promise<AudioBuffer> {
  const duration = renderDurationSeconds(options.bpm);
  const hasSolo = options.trackStates.some((track) => track.soloed);

  const rendered = await Tone.Offline(
    (context) => {
      context.transport.timeSignature = 4;
      context.transport.bpm.value = options.bpm;

      const limiter = new Tone.Limiter(-1).toDestination();
      const master = new Tone.Volume().connect(limiter);
      const gain = Math.max(0, Math.min(100, options.masterPercent)) / 100;
      master.volume.value = gain === 0 ? -Infinity : Tone.gainToDb(gain);

      const channels = TRACKS.map((track, index) => {
        const channel = new Tone.Channel({
          pan: track.pan,
          volume: TRACK_HEADROOM_DB,
        }).connect(master);
        const state = options.trackStates[index] ?? {
          muted: false,
          soloed: false,
        };
        channel.mute = state.muted || (hasSolo && !state.soloed);
        return channel;
      });
      const voices = TRACKS.map((_, index) =>
        createVoice(index).connect(channels[index]),
      );
      const sixteenthSeconds = 60 / options.bpm / 4;

      TRACKS.forEach((track, bandIndex) => {
        elements.forEach((element, elementIndex) => {
          const brightness = element.colorAggregates[track.bandKey];
          if (brightness === 0) {
            return;
          }

          const step = elementIndex * STEPS_PER_ELEMENT + bandIndex;
          voices[bandIndex].triggerAttackRelease(
            track.note,
            NOTE_DURATION,
            step * sixteenthSeconds,
            scaleBrightnessVelocity(brightness, options.liftDimValues),
          );
        });
      });
    },
    duration,
    CHANNEL_COUNT,
    sampleRate,
  );

  const audioBuffer = rendered.get();
  if (!audioBuffer) {
    throw new Error("Tone.js returned an empty offline audio buffer.");
  }
  return audioBuffer;
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

async function encodePcm24Wav(audioBuffer: AudioBuffer): Promise<Blob> {
  const bytesPerSample = WAV_BIT_DEPTH / 8;
  const blockAlign = audioBuffer.numberOfChannels * bytesPerSample;
  const dataBytes = audioBuffer.length * blockAlign;
  const wav = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(wav);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, audioBuffer.numberOfChannels, true);
  view.setUint32(24, audioBuffer.sampleRate, true);
  view.setUint32(28, audioBuffer.sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, WAV_BIT_DEPTH, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataBytes, true);

  const channels = Array.from(
    { length: audioBuffer.numberOfChannels },
    (_, channel) => audioBuffer.getChannelData(channel),
  );
  let offset = 44;

  for (let frame = 0; frame < audioBuffer.length; frame += 1) {
    for (let channel = 0; channel < channels.length; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channels[channel][frame]));
      const signed =
        sample < 0
          ? Math.round(sample * 0x800000)
          : Math.round(sample * 0x7fffff);
      const encoded = signed < 0 ? signed + 0x1000000 : signed;
      view.setUint8(offset, encoded & 0xff);
      view.setUint8(offset + 1, (encoded >>> 8) & 0xff);
      view.setUint8(offset + 2, (encoded >>> 16) & 0xff);
      offset += bytesPerSample;
    }

    if (frame > 0 && frame % ENCODE_YIELD_FRAMES === 0) {
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
    }
  }

  return new Blob([wav], { type: "audio/wav" });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function downloadToneAudio(
  options: AudioExportOptions,
): Promise<AudioExportSummary> {
  let lastError: unknown;

  for (const sampleRate of PREFERRED_SAMPLE_RATES) {
    options.onProgress?.({ phase: "checking", sampleRate });
    if (!browserSupportsSampleRate(sampleRate)) {
      continue;
    }

    try {
      options.onProgress?.({ phase: "rendering", sampleRate });
      const audioBuffer = await renderToneMix(sampleRate, options);
      options.onProgress?.({ phase: "encoding", sampleRate });
      const wav = await encodePcm24Wav(audioBuffer);
      const rateLabel = `${Math.round(sampleRate / 1000)}khz`;
      const filename = `periodic-spectrum-${Math.round(options.bpm)}bpm-${rateLabel}-${WAV_BIT_DEPTH}bit.wav`;
      downloadBlob(wav, filename);

      return {
        filename,
        sampleRate,
        bitDepth: WAV_BIT_DEPTH,
        channelCount: audioBuffer.numberOfChannels,
        durationSeconds: audioBuffer.duration,
        bytes: wav.size,
      };
    } catch (error) {
      console.warn(`Audio render at ${sampleRate} Hz failed; trying a lower rate.`, error);
      lastError = error;
    }
  }

  throw new Error(
    "This browser could not complete an offline WAV render at any supported sample rate.",
    { cause: lastError },
  );
}
