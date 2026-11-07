import { applyLowMidCompression } from "./low-mid-compression";

export interface VelocityMappingOptions {
  liftDimValues?: boolean;
  compressLatePeaks?: boolean;
  compressLowMids?: boolean;
}

export const DIM_VELOCITY_FLOOR = 0.1;
export const DIM_VELOCITY_CUTOFF = 0.25;
export const LATE_PEAK_START_STEP = 4;
export const LATE_PEAK_FRACTION = 0.25;
export const LATE_PEAK_REDUCTION = 0.25;

/**
 * Converts normalized brightness to note velocity.
 *
 * With the dim-value lift enabled, positive values below the cutoff are
 * remapped into the floor-to-cutoff range. Zero remains silence, and values
 * at or above the cutoff retain their original velocity.
 */
export function scaleBrightnessVelocity(
  brightness: number,
  liftDimValues: boolean,
): number {
  const normalized = Math.max(0, Math.min(1, brightness));

  if (
    !liftDimValues ||
    normalized === 0 ||
    normalized >= DIM_VELOCITY_CUTOFF
  ) {
    return normalized;
  }

  return (
    DIM_VELOCITY_FLOOR +
    (DIM_VELOCITY_CUTOFF - DIM_VELOCITY_FLOOR) *
      (normalized / DIM_VELOCITY_CUTOFF)
  );
}

/**
 * Applies the element-level velocity mapping used by playback and exports.
 *
 * When late-peak compression is enabled, beat 1 (steps 0–3) remains intact.
 * For the remaining active notes, a downward compressor starts at the lower
 * edge of the loudest quartile and maps the original peak to 75% of its former
 * value. If nearby notes sit above that safety ceiling, they are limited too,
 * ensuring that the post-beat-1 peak is always reduced by a full 25%.
 */
export function createElementVelocities(
  brightnessValues: readonly number[],
  liftDimValues: boolean,
  compressLatePeaks: boolean,
): readonly number[] {
  const velocities = brightnessValues.map((brightness) =>
    scaleBrightnessVelocity(brightness, liftDimValues),
  );

  if (!compressLatePeaks) {
    return velocities;
  }

  const lateNotes = velocities
    .map((velocity, index) => ({ index, velocity }))
    .filter(
      ({ index, velocity }) =>
        index >= LATE_PEAK_START_STEP && velocity > 0,
    )
    .sort(
      (left, right) =>
        right.velocity - left.velocity || left.index - right.index,
    );

  if (lateNotes.length === 0) {
    return velocities;
  }

  const loudestNoteCount = Math.max(
    1,
    Math.ceil(lateNotes.length * LATE_PEAK_FRACTION),
  );
  const originalPeak = lateNotes[0].velocity;
  const peakCeiling = originalPeak * (1 - LATE_PEAK_REDUCTION);
  const quartileBoundary = lateNotes[loudestNoteCount]?.velocity ?? 0;
  const compressionStart = Math.min(quartileBoundary, peakCeiling);
  const inputRange = originalPeak - compressionStart;
  const outputRange = peakCeiling - compressionStart;

  return velocities.map((velocity, index) => {
    if (
      index < LATE_PEAK_START_STEP ||
      velocity <= compressionStart ||
      velocity === 0
    ) {
      return velocity;
    }

    if (inputRange <= 0) {
      return Math.min(velocity, peakCeiling);
    }

    return (
      compressionStart +
      ((velocity - compressionStart) / inputRange) * outputRange
    );
  });
}
export function createSequenceVelocities(
  brightnessRows: readonly (readonly number[])[],
  options: VelocityMappingOptions = {},
): readonly (readonly number[])[] {
  const velocities = brightnessRows.map((row) => createElementVelocities(
    row,
    options.liftDimValues ?? false,
    options.compressLatePeaks ?? false,
  ));
  return (options.compressLowMids ?? true)
    ? applyLowMidCompression(velocities)
    : velocities;
}
