import { LOW_MID_TRACK_INDICES } from "./tracks";

export const LOW_MID_PEAK_FRACTION = 0.5;
export const LOW_MID_COMPRESSION_RATIO = Number.POSITIVE_INFINITY;

/** Limit positive low-mid velocities above their pooled median without changing the input. */
export function applyLowMidCompression(
  levels: readonly (readonly number[])[],
): number[][] {
  const compressedLevels = levels.map((row) => [...row]);
  const activeLevelsDb: number[] = [];

  for (const row of levels) {
    for (const trackIndex of LOW_MID_TRACK_INDICES) {
      const level = row[trackIndex];
      if (Number.isFinite(level) && level > 0) {
        activeLevelsDb.push(20 * Math.log10(level));
      }
    }
  }

  if (activeLevelsDb.length < 2) {
    return compressedLevels;
  }

  activeLevelsDb.sort((left, right) => left - right);
  const position = (activeLevelsDb.length - 1) * (1 - LOW_MID_PEAK_FRACTION);
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const thresholdDb = activeLevelsDb[lowerIndex]
    + (activeLevelsDb[upperIndex] - activeLevelsDb[lowerIndex]) * (position - lowerIndex);

  levels.forEach((row, elementIndex) => {
    for (const trackIndex of LOW_MID_TRACK_INDICES) {
      const level = row[trackIndex];
      if (!Number.isFinite(level) || level <= 0) {
        continue;
      }
      const levelDb = 20 * Math.log10(level);
      if (levelDb <= thresholdDb) {
        continue;
      }

      const compressedDb = thresholdDb + (levelDb - thresholdDb) / LOW_MID_COMPRESSION_RATIO;
      const compressedLevel = 10 ** (compressedDb / 20);
      compressedLevels[elementIndex][trackIndex] = Number.isFinite(compressedLevel)
        ? Math.max(0, Math.min(level, compressedLevel))
        : level;
    }
  });

  return compressedLevels;
}
