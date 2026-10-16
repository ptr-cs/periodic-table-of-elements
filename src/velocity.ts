export const DIM_VELOCITY_FLOOR = 0.1;
export const DIM_VELOCITY_CUTOFF = 0.25;

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
