#!/usr/bin/env python3
"""Extract 16 normalized spectral-band brightness values for elements 1-99."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from PIL import Image


IMAGE_WIDTH = 975
IMAGE_HEIGHT = 576
GRID_ROWS = 4
GRID_COLUMNS = 25
CELL_WIDTH = 39
CELL_HEIGHT = 144
SPECTRUM_HEIGHT = 119
BAND_COUNT = 16

ELEMENT_SYMBOLS = """
H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn
Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn
Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re
Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es
""".split()

ELEMENT_CATEGORY_SYMBOLS = {
    "nonmetal": "H C N O P S Se".split(),
    "noble gas": "He Ne Ar Kr Xe Rn".split(),
    "alkali metal": "Li Na K Rb Cs Fr".split(),
    "alkaline earth metal": "Be Mg Ca Sr Ba Ra".split(),
    "metalloid": "B Si Ge As Sb Te Po".split(),
    "halogen": "F Cl Br I At".split(),
    "transition metal": (
        "Sc Ti V Cr Mn Fe Co Ni Cu Zn Y Zr Nb Mo Tc Ru Rh Pd Ag Cd "
        "Hf Ta W Re Os Ir Pt Au Hg"
    ).split(),
    "post-transition metal": "Al Ga In Sn Tl Pb Bi".split(),
    "lanthanide": "La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu".split(),
    "actinide": "Ac Th Pa U Np Pu Am Cm Bk Cf Es".split(),
}

_classified_symbols = [
    symbol
    for symbols in ELEMENT_CATEGORY_SYMBOLS.values()
    for symbol in symbols
]
if len(_classified_symbols) != len(set(_classified_symbols)):
    raise RuntimeError("Each element symbol must have exactly one category")
if set(_classified_symbols) != set(ELEMENT_SYMBOLS):
    raise RuntimeError("Element category mapping must cover elements 1-99 exactly")

ELEMENT_CATEGORY_BY_SYMBOL = {
    symbol: category
    for category, symbols in ELEMENT_CATEGORY_SYMBOLS.items()
    for symbol in symbols
}


def parse_args() -> argparse.Namespace:
    directory = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(
        description=(
            "Split each element spectrum into 16 top-to-bottom bands and write "
            "globally normalized brightness aggregates as JSON."
        )
    )
    parser.add_argument(
        "input",
        nargs="?",
        type=Path,
        default=directory / "sp_lores-2.png",
        help="source PNG (default: sp_lores-2.png beside this script)",
    )
    parser.add_argument(
        "output",
        nargs="?",
        type=Path,
        default=directory / "element_color_aggregates.json",
        help="destination JSON (default: element_color_aggregates.json)",
    )
    parser.add_argument(
        "--precision",
        type=int,
        default=6,
        help="decimal places in normalized readings (default: 6)",
    )
    return parser.parse_args()


def band_edges() -> list[float]:
    """Return 16 equal-area edges spanning all 119 spectrum rows."""
    return [
        index * SPECTRUM_HEIGHT / BAND_COUNT for index in range(BAND_COUNT + 1)
    ]


def mean_band_value(
    image: Image.Image,
    grid_row: int,
    grid_column: int,
    local_y_start: float,
    local_y_end: float,
) -> float:
    """Average HSV-style value, area-weighting pixels split by a band edge."""
    x_start = grid_column * CELL_WIDTH
    x_end = x_start + CELL_WIDTH

    value_sum = 0.0
    pixel_area = (x_end - x_start) * (local_y_end - local_y_start)
    pixels = image.load()
    for local_y in range(math.floor(local_y_start), math.ceil(local_y_end)):
        vertical_overlap = min(local_y_end, local_y + 1) - max(
            local_y_start, local_y
        )
        if vertical_overlap <= 0:
            continue
        y = grid_row * CELL_HEIGHT + local_y
        for x in range(x_start, x_end):
            value_sum += max(pixels[x, y]) * vertical_overlap

    return value_sum / (255 * pixel_area)


def extract(image: Image.Image, precision: int) -> dict[str, object]:
    if image.size != (IMAGE_WIDTH, IMAGE_HEIGHT):
        raise ValueError(
            f"Expected {IMAGE_WIDTH}x{IMAGE_HEIGHT}, received "
            f"{image.width}x{image.height}"
        )
    if precision < 0:
        raise ValueError("Precision must be non-negative")
    if len(ELEMENT_SYMBOLS) != 99:
        raise RuntimeError("Element symbol table must contain atomic numbers 1-99")

    rgb_image = image.convert("RGB")
    edges = band_edges()
    raw_elements: list[dict[str, object]] = []

    for atomic_number, symbol in enumerate(ELEMENT_SYMBOLS, start=1):
        zero_based_index = atomic_number - 1
        grid_row = zero_based_index // GRID_COLUMNS
        grid_column = zero_based_index % GRID_COLUMNS
        raw_bands = [
            mean_band_value(
                rgb_image,
                grid_row,
                grid_column,
                edges[band_index],
                edges[band_index + 1],
            )
            for band_index in range(BAND_COUNT)
        ]
        raw_elements.append(
            {
                "atomicNumber": atomic_number,
                "symbol": symbol,
                "elementCategory": ELEMENT_CATEGORY_BY_SYMBOL[symbol],
                "grid": {"row": grid_row + 1, "column": grid_column + 1},
                "rawBands": raw_bands,
            }
        )

    global_maximum = max(
        raw_value
        for element in raw_elements
        for raw_value in element["rawBands"]  # type: ignore[union-attr]
    )
    if global_maximum <= 0:
        raise ValueError("The image contains no non-black spectral data")

    maximum_atomic_number = 0
    maximum_symbol = ""
    maximum_band_index = 0
    elements: list[dict[str, object]] = []

    for element in raw_elements:
        raw_bands = element.pop("rawBands")
        assert isinstance(raw_bands, list)
        aggregates: dict[str, float] = {}
        for band_index, raw_value in enumerate(raw_bands, start=1):
            assert isinstance(raw_value, float)
            if raw_value == global_maximum:
                maximum_atomic_number = int(element["atomicNumber"])
                maximum_symbol = str(element["symbol"])
                maximum_band_index = band_index
            aggregates[f"band_{band_index:02d}"] = round(
                raw_value / global_maximum, precision
            )
        element["colorAggregates"] = aggregates
        elements.append(element)

    bands = []
    for band_index in range(BAND_COUNT):
        start = edges[band_index]
        end = edges[band_index + 1]
        bands.append(
            {
                "key": f"band_{band_index + 1:02d}",
                "midiTrack": band_index + 1,
                "spectrumOrder": band_index + 1,
                "spectrumPositionStart": band_index / BAND_COUNT,
                "spectrumPositionEnd": (band_index + 1) / BAND_COUNT,
                "localPixelYStart": start,
                "localPixelYEndExclusive": end,
                "direction": "top/red toward bottom/blue-violet",
            }
        )

    return {
        "schemaVersion": 2,
        "source": "sp_lores-2.png",
        "grid": {
            "rows": GRID_ROWS,
            "columns": GRID_COLUMNS,
            "occupiedElements": len(ELEMENT_SYMBOLS),
            "emptyCells": [{"row": 4, "column": 25}],
            "cellPixels": {"width": CELL_WIDTH, "height": CELL_HEIGHT},
        },
        "elementClassification": {
            "field": "elementCategory",
            "scheme": "PubChem chemical group/block",
            "source": "https://pubchem.ncbi.nlm.nih.gov/periodic-table/",
            "categories": list(ELEMENT_CATEGORY_SYMBOLS),
            "categoryCounts": {
                category: len(symbols)
                for category, symbols in ELEMENT_CATEGORY_SYMBOLS.items()
            },
            "boundaryConventions": {
                "Po": "metalloid",
                "At": "halogen",
                "Zn, Cd, Hg": "transition metal",
                "La-Lu": "lanthanide",
                "Ac-Es": "actinide",
            },
        },
        "extraction": {
            "bandCount": BAND_COUNT,
            "bandOrder": "top-to-bottom, red-to-blue-violet",
            "spectrumLocalPixelY": {
                "start": 0,
                "endExclusive": SPECTRUM_HEIGHT,
            },
            "excludedLabelLocalPixelY": {
                "start": SPECTRUM_HEIGHT,
                "endExclusive": CELL_HEIGHT,
            },
            "pixelBrightness": "max(red, green, blue) / 255",
            "aggregate": (
                "arithmetic mean of pixel brightness over each band; black pixels "
                "are retained as zero signal"
            ),
            "boundaryPixelTreatment": (
                "fractional-area weighting where an exact 1/16 boundary crosses "
                "a pixel row"
            ),
            "normalization": (
                "each raw aggregate divided by the maximum raw aggregate across "
                "all 99 elements and 16 bands"
            ),
            "globalMaximumRawAggregate": round(global_maximum, 12),
            "globalMaximumLocation": {
                "atomicNumber": maximum_atomic_number,
                "symbol": maximum_symbol,
                "band": f"band_{maximum_band_index:02d}",
            },
            "outputRange": [0, 1],
            "decimalPrecision": precision,
        },
        "bands": bands,
        "elements": elements,
    }


def main() -> None:
    args = parse_args()
    with Image.open(args.input) as image:
        output = extract(image, args.precision)
    args.output.write_text(
        json.dumps(output, indent=2, ensure_ascii=False, allow_nan=False) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(output['elements'])} elements to {args.output}")


if __name__ == "__main__":
    main()
