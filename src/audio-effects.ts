import * as Tone from "tone";

const REVERB_DECAY_SECONDS = 0.8;
const REVERB_PRE_DELAY_SECONDS = 0.01;

export const REVERB_TAIL_SECONDS = REVERB_DECAY_SECONDS + REVERB_PRE_DELAY_SECONDS;
export const REVERB_WET_MIX = 0.1;

export function createOutputReverb(enabled = true): Tone.Reverb {
  return new Tone.Reverb({
    decay: REVERB_DECAY_SECONDS,
    preDelay: REVERB_PRE_DELAY_SECONDS,
    wet: enabled ? REVERB_WET_MIX : 0,
  });
}
