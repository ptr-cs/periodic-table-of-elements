import rawDataset from "../element_color_aggregates.json";
import { BAND_KEYS, type SpectrumDataset } from "./types";

const dataset = rawDataset as unknown as SpectrumDataset;

if (dataset.elements.length !== 99) {
  throw new Error(`Expected 99 elements, received ${dataset.elements.length}`);
}

if (dataset.bands.length !== BAND_KEYS.length) {
  throw new Error(
    `Expected ${BAND_KEYS.length} spectrum bands, received ${dataset.bands.length}`,
  );
}

dataset.elements.forEach((element, index) => {
  if (element.atomicNumber !== index + 1) {
    throw new Error("Elements must be ordered by consecutive atomic number");
  }

  BAND_KEYS.forEach((bandKey) => {
    const value = element.colorAggregates[bandKey];
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(
        `Invalid ${bandKey} value for ${element.symbol}: ${String(value)}`,
      );
    }
  });
});

export const spectrumDataset = dataset;
export const elements = dataset.elements;

export const ACTIVE_NOTE_COUNT = elements.reduce(
  (count, element) =>
    count +
    BAND_KEYS.filter((bandKey) => element.colorAggregates[bandKey] > 0).length,
  0,
);

export const REST_COUNT = elements.length * BAND_KEYS.length - ACTIVE_NOTE_COUNT;
