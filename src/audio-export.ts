import * as Tone from "tone";
import { createOutputReverb, REVERB_TAIL_SECONDS } from "./audio-effects";
import { elements } from "./data";
import {
  DEFAULT_TONAL_SETTINGS,
  tonalSettingsSlug,
  type TonalSettings,
} from "./music";
import {
  createVoice,
  TRACK_HEADROOM_DB,
  type TrackState,
} from "./sequencer";
import {
  createTrackPitches,
  NOTE_DURATION,
  STEPS_PER_ELEMENT,
  TRACKS,
} from "./tracks";
import { createSequenceVelocities } from "./velocity";
import { encodePcm24Wav } from "./wav-encoder";

export const AUDIO_SAMPLE_RATES = [192_000, 96_000, 48_000, 44_100] as const;
export type AudioSampleRate = (typeof AUDIO_SAMPLE_RATES)[number];

const WAV_BIT_DEPTH = 24;
const CHANNEL_COUNT = 2;
const RELEASE_TAIL_SECONDS = 0.5;

export type AudioExportPhase = "checking" | "rendering" | "encoding";

export interface AudioExportProgress {
  phase: AudioExportPhase;
  sampleRate: number;
  fraction?: number;
}

export interface AudioExportOptions {
  bpm: number;
  masterPercent: number;
  reverbEnabled: boolean;
  compressLowMids: boolean;
  sampleRate?: AudioSampleRate;
  liftDimValues: boolean;
  compressLatePeaks: boolean;
  trackStates: readonly TrackState[];
  tonalSettings?: TonalSettings;
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

function renderDurationSeconds(bpm: number, reverbEnabled: boolean): number {
  return (elements.length * 4 * 60) / bpm
    + RELEASE_TAIL_SECONDS
    + (reverbEnabled ? REVERB_TAIL_SECONDS : 0);
}

async function renderToneMix(
  sampleRate: number,
  options: AudioExportOptions,
): Promise<AudioBuffer> {
  const duration = renderDurationSeconds(options.bpm, options.reverbEnabled);
  const hasSolo = options.trackStates.some((track) => track.soloed);
  const tonalSettings = options.tonalSettings ?? DEFAULT_TONAL_SETTINGS;
  const trackPitches = createTrackPitches(tonalSettings);
  const elementVelocities = createSequenceVelocities(
    elements.map((element) => TRACKS.map((track) => element.colorAggregates[track.bandKey])),
    options,
  );

  const context = new Tone.OfflineContext(CHANNEL_COUNT, duration, sampleRate);
  const originalContext = Tone.getContext();
  const nodes: Tone.ToneAudioNode[] = [];
  const own = <T extends Tone.ToneAudioNode>(node: T): T => {
    nodes.push(node);
    return node;
  };
  let progressTimer: number | undefined;

  try {
    let reverb: Tone.Reverb | undefined;
    Tone.setContext(context);
    try {
      context.transport.timeSignature = 4;
      context.transport.bpm.value = options.bpm;

      const limiter = own(new Tone.Limiter(-1)).toDestination();
      const master = own(new Tone.Volume()).connect(limiter);
      if (options.reverbEnabled) {
        reverb = own(createOutputReverb()).connect(master);
      }
      const gain = Math.max(0, Math.min(100, options.masterPercent)) / 100;
      master.volume.value = gain === 0 ? -Infinity : Tone.gainToDb(gain);

      const sixteenthSeconds = 60 / options.bpm / 4;

      TRACKS.forEach((track, bandIndex) => {
        const index = track.index;
        const state = options.trackStates[index] ?? {
          muted: false,
          soloed: false,
        };
        if (
          gain === 0 || state.muted || (hasSolo && !state.soloed)
          || !elementVelocities.some((velocities) => velocities[bandIndex] > 0)
        ) {
          return;
        }
        const channel = own(new Tone.Channel({
          pan: track.pan,
          volume: TRACK_HEADROOM_DB,
        })).connect(reverb ?? master);
        const voice = own(createVoice(bandIndex)).connect(channel);

        elements.forEach((_element, elementIndex) => {
          const velocity = elementVelocities[elementIndex][bandIndex];
          if (velocity === 0) {
            return;
          }

          const step = elementIndex * STEPS_PER_ELEMENT + bandIndex;
          voice.triggerAttackRelease(
            trackPitches[bandIndex].toneNote,
            NOTE_DURATION,
            step * sixteenthSeconds,
            velocity,
          );
        });
      });
    } finally {
      Tone.setContext(originalContext);
    }
    await reverb?.ready;
    progressTimer = window.setInterval(() => {
      options.onProgress?.({
        phase: "rendering",
        sampleRate,
        fraction: Math.min(1, context.rawContext.currentTime / duration),
      });
    }, 500);

    // All notes are already scheduled. Preserve Tone's source-stop callbacks
    // without its once-per-audio-second timer waits, which background tabs throttle.
    const rendered = await context.render(false);
    const audioBuffer = rendered.get();
    if (!audioBuffer) {
      throw new Error("Tone.js returned an empty offline audio buffer.");
    }
    rendered.dispose();
    return audioBuffer;
  } finally {
    window.clearInterval(progressTimer);
    nodes.reverse().forEach((node) => node.dispose());
    context.dispose();
  }
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

  const firstRate = AUDIO_SAMPLE_RATES.indexOf(options.sampleRate ?? AUDIO_SAMPLE_RATES[0]);
  for (const sampleRate of AUDIO_SAMPLE_RATES.slice(Math.max(0, firstRate))) {
    options.onProgress?.({ phase: "checking", sampleRate });
    if (!browserSupportsSampleRate(sampleRate)) {
      continue;
    }

    try {
      options.onProgress?.({ phase: "rendering", sampleRate, fraction: 0 });
      const audioBuffer = await renderToneMix(sampleRate, options);
      const wav = await encodePcm24Wav(audioBuffer, (completedFrames, totalFrames) => {
        options.onProgress?.({
          phase: "encoding",
          sampleRate,
          fraction: completedFrames / totalFrames,
        });
      });
      const rateLabel = `${sampleRate / 1000}khz`;
      const tonalSettings = options.tonalSettings ?? DEFAULT_TONAL_SETTINGS;
      const filename = `periodic-spectrum-${Math.round(options.bpm)}bpm-${tonalSettingsSlug(tonalSettings)}-${rateLabel}-${WAV_BIT_DEPTH}bit.wav`;
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
