import * as Tone from "tone";
import { elements } from "./data";
import { NOTE_DURATION, STEPS_PER_ELEMENT, TRACKS } from "./tracks";
import { scaleBrightnessVelocity } from "./velocity";

export type PlaybackState = "stopped" | "playing" | "paused";

export interface PlaybackPosition {
  step: number;
  elementIndex: number;
  bandIndex: number;
}

export interface TrackState {
  muted: boolean;
  soloed: boolean;
}

export interface SequencerCallbacks {
  onPosition: (position: PlaybackPosition) => void;
  onStateChange: (state: PlaybackState) => void;
}

export const TRACK_HEADROOM_DB = -8;
const DEFAULT_MASTER_PERCENT = 72;

export type MonophonicVoice =
  | Tone.Synth
  | Tone.MonoSynth
  | Tone.FMSynth
  | Tone.AMSynth
  | Tone.MembraneSynth;

export function createVoice(index: number): MonophonicVoice {
  switch (index) {
    case 0:
      return new Tone.MonoSynth({
        oscillator: { type: "sawtooth" },
        envelope: { attack: 0.004, decay: 0.08, sustain: 0.18, release: 0.12 },
        filter: { type: "lowpass", Q: 2, rolloff: -24 },
        filterEnvelope: { attack: 0.002, decay: 0.1, sustain: 0.2, release: 0.12, baseFrequency: 90, octaves: 3 },
      });
    case 1:
      return new Tone.Synth({
        oscillator: { type: "fmsawtooth", harmonicity: 1.5, modulationIndex: 3 },
        envelope: { attack: 0.003, decay: 0.09, sustain: 0.12, release: 0.16 },
      });
    case 2:
      return new Tone.FMSynth({
        harmonicity: 3,
        modulationIndex: 4,
        envelope: { attack: 0.002, decay: 0.12, sustain: 0.05, release: 0.16 },
        modulationEnvelope: { attack: 0.002, decay: 0.08, sustain: 0, release: 0.1 },
      });
    case 3:
      return new Tone.AMSynth({
        harmonicity: 2,
        oscillator: { type: "triangle" },
        envelope: { attack: 0.002, decay: 0.08, sustain: 0.08, release: 0.12 },
        modulationEnvelope: { attack: 0.002, decay: 0.06, sustain: 0, release: 0.08 },
      });
    case 4:
      return new Tone.FMSynth({
        harmonicity: 1.4,
        modulationIndex: 8,
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.16, sustain: 0.03, release: 0.22 },
        modulationEnvelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.18 },
      });
    case 5:
      return new Tone.AMSynth({
        harmonicity: 1.5,
        oscillator: { type: "sawtooth" },
        envelope: { attack: 0.015, decay: 0.08, sustain: 0.24, release: 0.14 },
        modulationEnvelope: { attack: 0.01, decay: 0.1, sustain: 0.15, release: 0.12 },
      });
    case 6:
      return new Tone.Synth({
        oscillator: { type: "triangle8" },
        envelope: { attack: 0.002, decay: 0.12, sustain: 0.1, release: 0.2 },
      });
    case 7:
      return new Tone.MonoSynth({
        oscillator: { type: "square" },
        envelope: { attack: 0.008, decay: 0.06, sustain: 0.3, release: 0.1 },
        filter: { type: "lowpass", Q: 1.4, rolloff: -12 },
        filterEnvelope: { attack: 0.006, decay: 0.08, sustain: 0.4, release: 0.1, baseFrequency: 260, octaves: 2.5 },
      });
    case 8:
      return new Tone.FMSynth({
        harmonicity: 5,
        modulationIndex: 2.2,
        envelope: { attack: 0.001, decay: 0.09, sustain: 0.02, release: 0.1 },
        modulationEnvelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.07 },
      });
    case 9:
      return new Tone.MembraneSynth({
        pitchDecay: 0.025,
        octaves: 5,
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.11, sustain: 0, release: 0.08 },
      });
    case 10:
      return new Tone.FMSynth({
        harmonicity: 2,
        modulationIndex: 2.6,
        oscillator: { type: "triangle" },
        envelope: { attack: 0.004, decay: 0.1, sustain: 0.13, release: 0.18 },
        modulationEnvelope: { attack: 0.004, decay: 0.09, sustain: 0.05, release: 0.12 },
      });
    case 11:
      return new Tone.MonoSynth({
        oscillator: { type: "square4" },
        envelope: { attack: 0.012, decay: 0.08, sustain: 0.2, release: 0.14 },
        filter: { type: "bandpass", Q: 2.8, rolloff: -12 },
        filterEnvelope: { attack: 0.01, decay: 0.08, sustain: 0.25, release: 0.12, baseFrequency: 520, octaves: 1.7 },
      });
    case 12:
      return new Tone.Synth({
        oscillator: { type: "fatsine", count: 3, spread: 18 },
        envelope: { attack: 0.045, decay: 0.08, sustain: 0.35, release: 0.24 },
      });
    case 13:
      return new Tone.AMSynth({
        harmonicity: 1.01,
        oscillator: { type: "sine" },
        modulation: { type: "triangle" },
        envelope: { attack: 0.035, decay: 0.1, sustain: 0.3, release: 0.22 },
        modulationEnvelope: { attack: 0.025, decay: 0.12, sustain: 0.25, release: 0.2 },
      });
    case 14:
      return new Tone.FMSynth({
        harmonicity: 6,
        modulationIndex: 5,
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.13, sustain: 0.02, release: 0.2 },
        modulationEnvelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.16 },
      });
    default:
      return new Tone.MonoSynth({
        oscillator: { type: "fmsquare", harmonicity: 2, modulationIndex: 2 },
        envelope: { attack: 0.006, decay: 0.07, sustain: 0.2, release: 0.16 },
        filter: { type: "highpass", Q: 1.2, rolloff: -12 },
        filterEnvelope: { attack: 0.004, decay: 0.08, sustain: 0.2, release: 0.14, baseFrequency: 350, octaves: 2.2 },
      });
  }
}

export class SpectrumSequencer {
  private readonly callbacks: SequencerCallbacks;
  private readonly trackStates: TrackState[] = TRACKS.map(() => ({
    muted: false,
    soloed: false,
  }));

  private voices: MonophonicVoice[] = [];
  private channels: Tone.Channel[] = [];
  private master: Tone.Volume | null = null;
  private limiter: Tone.Limiter | null = null;
  private initialized = false;
  private state: PlaybackState = "stopped";
  private bpm = 120;
  private masterPercent = DEFAULT_MASTER_PERCENT;
  private liftDimValues = false;
  private pendingElementIndex = 0;
  private lastEmittedStep = -1;
  private animationFrame = 0;

  constructor(callbacks: SequencerCallbacks) {
    this.callbacks = callbacks;
  }

  get playbackState(): PlaybackState {
    return this.state;
  }

  get tempo(): number {
    return this.bpm;
  }

  get totalSteps(): number {
    return elements.length * STEPS_PER_ELEMENT;
  }

  async togglePlayback(): Promise<void> {
    if (this.state === "playing") {
      this.pause();
      return;
    }

    await Tone.start();
    this.initializeAudio();
    const transport = Tone.getTransport();
    const totalTicks = this.totalSteps * this.stepTicks();

    if (Number(transport.ticks) >= totalTicks) {
      transport.ticks = 0;
      this.pendingElementIndex = 0;
    } else if (this.state === "stopped") {
      transport.ticks = this.pendingElementIndex * STEPS_PER_ELEMENT * this.stepTicks();
    }

    transport.start("+0.05");
    this.setState("playing");
    this.startPositionLoop();
  }

  pause(): void {
    if (!this.initialized || this.state !== "playing") {
      return;
    }
    Tone.getTransport().pause();
    this.releaseVoices();
    this.setState("paused");
    this.stopPositionLoop();
    this.emitCurrentPosition(true);
  }

  stop(): void {
    if (this.initialized) {
      const transport = Tone.getTransport();
      transport.stop();
      transport.ticks = 0;
      this.releaseVoices();
    }
    this.pendingElementIndex = 0;
    this.setState("stopped");
    this.stopPositionLoop();
    this.emitPosition(0, true);
  }

  seekToElement(elementIndex: number): void {
    const nextIndex = Math.max(0, Math.min(elements.length - 1, Math.round(elementIndex)));
    this.pendingElementIndex = nextIndex;
    const nextStep = nextIndex * STEPS_PER_ELEMENT;

    if (this.initialized) {
      Tone.getTransport().ticks = nextStep * this.stepTicks();
      this.releaseVoices();
    }
    this.emitPosition(nextStep, true);
  }

  setBpm(nextBpm: number): void {
    this.bpm = Math.max(40, Math.min(220, Math.round(nextBpm)));
    if (this.initialized) {
      Tone.getTransport().bpm.value = this.bpm;
    }
  }

  setMasterVolume(percent: number): void {
    this.masterPercent = Math.max(0, Math.min(100, percent));
    const normalized = this.masterPercent / 100;
    const decibels = normalized === 0 ? -Infinity : Tone.gainToDb(normalized);
    this.master?.volume.rampTo(decibels, 0.04);
  }

  setDimValueLift(enabled: boolean): void {
    this.liftDimValues = enabled;
  }

  toggleMute(trackIndex: number): TrackState {
    this.trackStates[trackIndex].muted = !this.trackStates[trackIndex].muted;
    this.applyTrackAudibility();
    return { ...this.trackStates[trackIndex] };
  }

  toggleSolo(trackIndex: number): TrackState {
    this.trackStates[trackIndex].soloed = !this.trackStates[trackIndex].soloed;
    this.applyTrackAudibility();
    return { ...this.trackStates[trackIndex] };
  }

  getTrackState(trackIndex: number): TrackState {
    return { ...this.trackStates[trackIndex] };
  }

  dispose(): void {
    this.stopPositionLoop();
    if (this.initialized) {
      const transport = Tone.getTransport();
      transport.stop();
      transport.cancel(0);
    }
    this.voices.forEach((voice) => voice.dispose());
    this.channels.forEach((channel) => channel.dispose());
    this.master?.dispose();
    this.limiter?.dispose();
    this.voices = [];
    this.channels = [];
    this.master = null;
    this.limiter = null;
    this.initialized = false;
  }

  private initializeAudio(): void {
    if (this.initialized) {
      return;
    }

    const transport = Tone.getTransport();
    transport.cancel(0);
    transport.timeSignature = 4;
    transport.bpm.value = this.bpm;

    this.limiter = new Tone.Limiter(-1).toDestination();
    this.master = new Tone.Volume().connect(this.limiter);
    this.setMasterVolume(this.masterPercent);

    this.channels = TRACKS.map((config) =>
      new Tone.Channel({
        pan: config.pan,
        volume: TRACK_HEADROOM_DB,
      }).connect(this.master!),
    );
    this.voices = TRACKS.map((_, index) =>
      createVoice(index).connect(this.channels[index]),
    );
    this.applyTrackAudibility();

    TRACKS.forEach((config, bandIndex) => {
      elements.forEach((element, elementIndex) => {
        const brightness = element.colorAggregates[config.bandKey];

        // Exact zero is silence, but its sixteenth-note position remains reserved.
        if (brightness === 0) {
          return;
        }

        const step = elementIndex * STEPS_PER_ELEMENT + bandIndex;
        transport.schedule((time) => {
          this.voices[bandIndex].triggerAttackRelease(
            config.note,
            NOTE_DURATION,
            time,
            scaleBrightnessVelocity(brightness, this.liftDimValues),
          );
        }, `${step * this.stepTicks()}i`);
      });
    });

    transport.schedule((time) => {
      Tone.getDraw().schedule(() => this.finishPlayback(), time);
    }, `${this.totalSteps * this.stepTicks()}i`);

    this.initialized = true;
  }

  private finishPlayback(): void {
    if (!this.initialized) {
      return;
    }
    const transport = Tone.getTransport();
    transport.stop();
    transport.ticks = 0;
    this.releaseVoices();
    this.pendingElementIndex = 0;
    this.setState("stopped");
    this.stopPositionLoop();
    this.emitPosition(0, true);
  }

  private stepTicks(): number {
    return Tone.getTransport().PPQ / 4;
  }

  private startPositionLoop(): void {
    this.stopPositionLoop();
    const update = () => {
      this.emitCurrentPosition(false);
      if (this.state === "playing") {
        this.animationFrame = window.requestAnimationFrame(update);
      }
    };
    this.animationFrame = window.requestAnimationFrame(update);
  }

  private stopPositionLoop(): void {
    if (this.animationFrame !== 0) {
      window.cancelAnimationFrame(this.animationFrame);
      this.animationFrame = 0;
    }
  }

  private emitCurrentPosition(force: boolean): void {
    if (!this.initialized) {
      this.emitPosition(this.pendingElementIndex * STEPS_PER_ELEMENT, force);
      return;
    }

    const rawStep = Math.floor(Number(Tone.getTransport().ticks) / this.stepTicks());
    this.emitPosition(Math.max(0, Math.min(this.totalSteps - 1, rawStep)), force);
  }

  private emitPosition(step: number, force: boolean): void {
    if (!force && step === this.lastEmittedStep) {
      return;
    }
    this.lastEmittedStep = step;
    const elementIndex = Math.floor(step / STEPS_PER_ELEMENT);
    const bandIndex = step % STEPS_PER_ELEMENT;
    this.pendingElementIndex = elementIndex;
    this.callbacks.onPosition({ step, elementIndex, bandIndex });
  }

  private setState(state: PlaybackState): void {
    if (state === this.state) {
      return;
    }
    this.state = state;
    this.callbacks.onStateChange(state);
  }

  private releaseVoices(): void {
    const releaseTime = Tone.now();
    this.voices.forEach((voice) => voice.triggerRelease(releaseTime));
  }

  private applyTrackAudibility(): void {
    const hasSolo = this.trackStates.some((track) => track.soloed);
    this.channels.forEach((channel, index) => {
      const state = this.trackStates[index];
      channel.mute = state.muted || (hasSolo && !state.soloed);
    });
  }
}
