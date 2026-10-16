import "./style.css";
import {
  downloadToneAudio,
  type AudioExportProgress,
} from "./audio-export";
import { ACTIVE_NOTE_COUNT, REST_COUNT, elements } from "./data";
import { downloadMidiFile } from "./midi";
import {
  SpectrumSequencer,
  type PlaybackPosition,
  type PlaybackState,
} from "./sequencer";
import { STEPS_PER_ELEMENT, TRACKS } from "./tracks";
import { DIM_VELOCITY_CUTOFF, DIM_VELOCITY_FLOOR } from "./velocity";

const DEFAULT_BPM = 120;
const DIM_FLOOR_PERCENT = DIM_VELOCITY_FLOOR * 100;
const DIM_CUTOFF_PERCENT = DIM_VELOCITY_CUTOFF * 100;

function formatBrightness(value: number): string {
  if (value === 0) {
    return "REST";
  }
  const percentage = value * 100;
  return `${percentage.toFixed(percentage < 1 ? 2 : 1)}%`;
}

function formatDuration(seconds: number): string {
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  return `${minutes}:${String(rounded % 60).padStart(2, "0")}`;
}

function required<T extends Element>(selector: string, root: ParentNode = document): T {
  const match = root.querySelector<T>(selector);
  if (!match) {
    throw new Error(`Missing required UI element: ${selector}`);
  }
  return match;
}

const app = required<HTMLDivElement>("#app");

const spectrumRule = TRACKS.map(
  (track) => `<span style="--track-color:${track.color}"></span>`,
).join("");

const bandCards = TRACKS.map(
  (track) => `
    <article class="band-card" data-band-card="${track.index}" style="--track-color:${track.color}">
      <div class="band-card__topline">
        <span class="band-card__number">${String(track.index + 1).padStart(2, "0")}</span>
        <span class="band-card__value" data-band-value="${track.index}">0.0%</span>
      </div>
      <div class="band-card__meter" aria-hidden="true">
        <span data-band-meter="${track.index}"></span>
      </div>
      <div class="band-card__name">${track.name}</div>
      <div class="band-card__voice">${track.note} · ${track.oscillatorLabel}</div>
    </article>
  `,
).join("");

const rulerCells = elements
  .map(
    (element, index) => `
      <span
        class="matrix-ruler__cell"
        data-ruler-index="${index}"
        title="${element.atomicNumber} ${element.symbol}"
      >${index % 5 === 0 || index === elements.length - 1 ? element.symbol : ""}</span>
    `,
  )
  .join("");

const matrixRows = TRACKS.map((track) => {
  const cells = elements
    .map((element, elementIndex) => {
      const brightness = element.colorAggregates[track.bandKey];
      const restClass = brightness === 0 ? " is-rest" : "";
      return `
        <div
          class="sequence-cell${restClass}"
          data-element-index="${elementIndex}"
          data-band-index="${track.index}"
          style="--value:${brightness};--track-color:${track.color}"
          title="${element.atomicNumber} ${element.symbol} · ${track.bandKey} · ${formatBrightness(brightness)}"
          aria-hidden="true"
        ><span></span></div>
      `;
    })
    .join("");

  return `
    <div class="matrix-row" data-track-row="${track.index}">
      <div class="lane-label" style="--track-color:${track.color}">
        <span class="lane-label__swatch" aria-hidden="true"></span>
        <span class="lane-label__identity">
          <strong>T${String(track.index + 1).padStart(2, "0")} · ${track.name}</strong>
          <small>${track.bandKey} · ${track.note}</small>
        </span>
        <span class="lane-label__actions">
          <button
            class="lane-toggle"
            type="button"
            data-action="mute"
            data-track-index="${track.index}"
            aria-label="Mute track ${track.index + 1}"
            aria-pressed="false"
          >M</button>
          <button
            class="lane-toggle"
            type="button"
            data-action="solo"
            data-track-index="${track.index}"
            aria-label="Solo track ${track.index + 1}"
            aria-pressed="false"
          >S</button>
        </span>
      </div>
      ${cells}
    </div>
  `;
}).join("");

app.innerHTML = `
  <header class="hero shell">
    <div class="hero__eyebrow">
      <span>Periodic spectrum</span>
      <span>99 elements / 16 voices</span>
    </div>
    <div class="hero__copy">
      <div>
        <h1>Element Spectrum<br />Sequencer</h1>
        <p>
          Atomic emission colors translated into sixteen independent monophonic tracks.
          Brightness becomes velocity; empty readings remain silent, fixed-position rests.
        </p>
      </div>
      <div class="hero__timing" aria-label="Sequence timing">
        <span class="hero__timing-label">Timing map</span>
        <strong>1 element = 1 measure</strong>
        <span>16 bands = 16 successive sixteenths</span>
      </div>
    </div>
    <div class="spectrum-rule" aria-hidden="true">${spectrumRule}</div>
  </header>

  <main>
    <section class="transport-wrap shell" aria-label="Playback controls">
      <div class="transport">
        <div class="transport__primary">
          <button class="control-button control-button--play" id="play-button" type="button" aria-pressed="false">
            <span class="control-button__icon" id="play-icon" aria-hidden="true">▶</span>
            <span id="play-label">Start audio</span>
          </button>
          <button class="control-button control-button--quiet" id="stop-button" type="button">
            <span aria-hidden="true">■</span>
            <span>Stop</span>
          </button>
        </div>

        <label class="range-control range-control--tempo">
          <span class="range-control__label">Tempo <output id="bpm-output">${DEFAULT_BPM} BPM</output></span>
          <input id="bpm-input" type="range" min="40" max="220" value="${DEFAULT_BPM}" step="1" />
        </label>

        <div class="volume-stack">
          <label class="range-control range-control--volume">
            <span class="range-control__label">Master <output id="volume-output">72%</output></span>
            <input id="volume-input" type="range" min="0" max="100" value="72" step="1" />
          </label>
          <label class="velocity-toggle">
            <input
              id="dim-lift-input"
              type="checkbox"
              role="switch"
              aria-describedby="dim-lift-help"
            />
            <span class="velocity-toggle__switch" aria-hidden="true"></span>
            <span class="velocity-toggle__copy">
              <strong>Lift dim values</strong>
              <small id="dim-lift-help">${DIM_FLOOR_PERCENT}% floor · ${DIM_CUTOFF_PERCENT}%+ unchanged</small>
            </span>
            <span class="velocity-toggle__state" id="dim-lift-state" aria-hidden="true">Off</span>
          </label>
        </div>

        <div class="transport__exports" aria-label="Export options">
          <button
            class="control-button control-button--export control-button--audio"
            id="audio-export-button"
            type="button"
            title="Offline-render a stereo 24-bit WAV. Tries 192 kHz first and falls back if needed."
          >
            <span aria-hidden="true">↓</span>
            <span class="control-button__copy">
              <strong>Export WAV</strong>
              <small>192 kHz · 24-bit</small>
            </span>
          </button>
          <button class="control-button control-button--export" id="export-button" type="button">
            <span aria-hidden="true">↓</span>
            <span>Export MIDI</span>
          </button>
        </div>

        <div class="transport__seek">
          <label for="element-seek" id="seek-label">Element 01 / 99 · H</label>
          <input id="element-seek" type="range" min="0" max="${elements.length - 1}" value="0" step="1" />
          <span id="position-label">Measure 01 · Step 01</span>
        </div>

        <div class="transport__progress" aria-hidden="true">
          <span id="progress-bar"></span>
        </div>

        <div class="transport__status">
          <span class="status-dot" id="status-dot" aria-hidden="true"></span>
          <span id="status-text">Ready — audio starts on first play</span>
          <span id="duration-label">${formatDuration((elements.length * 4 * 60) / DEFAULT_BPM)}</span>
        </div>
      </div>
    </section>

    <section class="current shell" aria-labelledby="current-heading">
      <div class="section-heading">
        <div>
          <span class="section-kicker">Now scanning</span>
          <h2 id="current-heading">Current element</h2>
        </div>
        <p id="current-readout">H · Band 01 of 16</p>
      </div>

      <div class="current__layout">
        <article class="element-card">
          <span class="element-card__atomic" id="current-atomic">01</span>
          <strong class="element-card__symbol" id="current-symbol">H</strong>
          <span class="element-card__category" id="current-category">Nonmetal</span>
          <div class="element-card__meta">
            <span id="current-grid">Grid row 1 · column 1</span>
            <span id="current-band-detail">Band 01 · Ember · C2</span>
          </div>
        </article>
        <div class="band-grid" aria-label="Sixteen aggregate readings for the current element">
          ${bandCards}
        </div>
      </div>
    </section>

    <section class="sequence shell" aria-labelledby="sequence-heading">
      <div class="section-heading section-heading--matrix">
        <div>
          <span class="section-kicker">Full score</span>
          <h2 id="sequence-heading">Brightness matrix</h2>
        </div>
        <p>Click a cell to seek · Mute or solo any lane</p>
      </div>

      <div class="matrix-shell">
        <div class="matrix-scroll" id="matrix-scroll" tabindex="0" aria-label="Scrollable sixteen-track sequence matrix">
          <div class="matrix-ruler">
            <span class="matrix-ruler__corner">Element →</span>
            ${rulerCells}
          </div>
          <div class="matrix-body" id="matrix-body">${matrixRows}</div>
        </div>
      </div>
      <div class="matrix-legend">
        <span><i class="legend-rest"></i> Silence / zero</span>
        <span><i class="legend-signal"></i> Brightness / velocity</span>
        <span>Red → blue-violet, top to bottom</span>
      </div>
    </section>

    <section class="export-summary shell" aria-label="Audio and MIDI export summary">
      <div>
        <span class="section-kicker">Output contract</span>
        <h2>24-bit WAV + Standard MIDI</h2>
      </div>
      <dl>
        <div><dt>WAV target</dt><dd>192 kHz</dd></div>
        <div><dt>WAV depth</dt><dd>24-bit</dd></div>
        <div><dt>MIDI tracks</dt><dd>16</dd></div>
        <div><dt>Active notes</dt><dd>${ACTIVE_NOTE_COUNT.toLocaleString()}</dd></div>
      </dl>
      <p>
        WAV export offline-renders the same Tone.js voices, stereo positions, limiter, master level,
        velocity mapping, and mute/solo mix. It tries 192 kHz first, then safely falls back to the
        highest rate the browser can complete. MIDI export retains all ${REST_COUNT.toLocaleString()}
        timed rests and adds a conductor track for tempo, 4/4 meter, and element markers.
      </p>
    </section>
  </main>

  <footer class="footer shell">
    <span>Source: sp_lores-2.png</span>
    <span id="velocity-mapping">Brightness mapping: linear 0–1 velocity</span>
  </footer>

  <div class="sr-only" id="live-status" aria-live="polite"></div>
`;

const playButton = required<HTMLButtonElement>("#play-button");
const playIcon = required<HTMLSpanElement>("#play-icon");
const playLabel = required<HTMLSpanElement>("#play-label");
const stopButton = required<HTMLButtonElement>("#stop-button");
const audioExportButton = required<HTMLButtonElement>("#audio-export-button");
const exportButton = required<HTMLButtonElement>("#export-button");
const bpmInput = required<HTMLInputElement>("#bpm-input");
const bpmOutput = required<HTMLOutputElement>("#bpm-output");
const volumeInput = required<HTMLInputElement>("#volume-input");
const volumeOutput = required<HTMLOutputElement>("#volume-output");
const dimLiftInput = required<HTMLInputElement>("#dim-lift-input");
const dimLiftState = required<HTMLSpanElement>("#dim-lift-state");
const velocityMapping = required<HTMLSpanElement>("#velocity-mapping");
const elementSeek = required<HTMLInputElement>("#element-seek");
const seekLabel = required<HTMLLabelElement>("#seek-label");
const positionLabel = required<HTMLSpanElement>("#position-label");
const progressBar = required<HTMLSpanElement>("#progress-bar");
const statusText = required<HTMLSpanElement>("#status-text");
const statusDot = required<HTMLSpanElement>("#status-dot");
const durationLabel = required<HTMLSpanElement>("#duration-label");
const liveStatus = required<HTMLDivElement>("#live-status");
const matrixBody = required<HTMLDivElement>("#matrix-body");
const matrixScroll = required<HTMLDivElement>("#matrix-scroll");

const currentAtomic = required<HTMLSpanElement>("#current-atomic");
const currentSymbol = required<HTMLElement>("#current-symbol");
const currentCategory = required<HTMLSpanElement>("#current-category");
const currentGrid = required<HTMLSpanElement>("#current-grid");
const currentBandDetail = required<HTMLSpanElement>("#current-band-detail");
const currentReadout = required<HTMLParagraphElement>("#current-readout");

const cellsByElement = Array.from({ length: elements.length }, () => [] as HTMLElement[]);
const cellsByStep = new Map<string, HTMLElement>();
document.querySelectorAll<HTMLElement>(".sequence-cell").forEach((cell) => {
  const elementIndex = Number(cell.dataset.elementIndex);
  const bandIndex = Number(cell.dataset.bandIndex);
  cellsByElement[elementIndex].push(cell);
  cellsByStep.set(`${elementIndex}:${bandIndex}`, cell);
});

const rulerByElement = Array.from(
  document.querySelectorAll<HTMLElement>("[data-ruler-index]"),
);
const bandCardElements = Array.from(
  document.querySelectorAll<HTMLElement>("[data-band-card]"),
);

let currentPosition: PlaybackPosition = { step: 0, elementIndex: 0, bandIndex: 0 };
let previousElementIndex = -1;
let previousBandIndex = -1;
let hasStartedAudio = false;

function updatePlaybackState(state: PlaybackState): void {
  const playing = state === "playing";
  playButton.setAttribute("aria-pressed", String(playing));
  playButton.classList.toggle("is-playing", playing);
  playIcon.textContent = playing ? "Ⅱ" : "▶";
  playLabel.textContent = playing ? "Pause" : hasStartedAudio ? "Play" : "Start audio";
  statusDot.dataset.state = state;

  if (state === "playing") {
    hasStartedAudio = true;
    statusText.textContent = dimLiftInput.checked
      ? "Playing — dim note velocities are lifted"
      : "Playing — brightness is mapped to note velocity";
    liveStatus.textContent = "Playback started";
  } else if (state === "paused") {
    statusText.textContent = "Paused — position retained";
    liveStatus.textContent = "Playback paused";
  } else {
    statusText.textContent = hasStartedAudio ? "Stopped" : "Ready — audio starts on first play";
  }
}

function updateElementPanel(elementIndex: number): void {
  const element = elements[elementIndex];
  currentAtomic.textContent = String(element.atomicNumber).padStart(2, "0");
  currentSymbol.textContent = element.symbol;
  currentCategory.textContent = element.elementCategory;
  currentGrid.textContent = `Grid row ${element.grid.row} · column ${element.grid.column}`;
  seekLabel.textContent = `Element ${String(element.atomicNumber).padStart(2, "0")} / 99 · ${element.symbol}`;
  elementSeek.value = String(elementIndex);

  TRACKS.forEach((track) => {
    const value = element.colorAggregates[track.bandKey];
    const valueElement = required<HTMLElement>(`[data-band-value="${track.index}"]`);
    const meterElement = required<HTMLElement>(`[data-band-meter="${track.index}"]`);
    valueElement.textContent = formatBrightness(value);
    meterElement.style.transform = `scaleX(${value})`;
    bandCardElements[track.index].classList.toggle("is-rest", value === 0);
  });
}

function updatePosition(position: PlaybackPosition): void {
  currentPosition = position;
  const element = elements[position.elementIndex];
  const track = TRACKS[position.bandIndex];
  const brightness = element.colorAggregates[track.bandKey];

  if (previousElementIndex !== position.elementIndex) {
    if (previousElementIndex >= 0) {
      cellsByElement[previousElementIndex].forEach((cell) =>
        cell.classList.remove("is-current-element"),
      );
      rulerByElement[previousElementIndex]?.classList.remove("is-current");
    }
    cellsByElement[position.elementIndex].forEach((cell) =>
      cell.classList.add("is-current-element"),
    );
    rulerByElement[position.elementIndex]?.classList.add("is-current");
    updateElementPanel(position.elementIndex);

    if (sequencer.playbackState === "playing") {
      const activeCell = cellsByElement[position.elementIndex][0];
      const left = activeCell.offsetLeft;
      const right = left + activeCell.offsetWidth;
      const visibleLeft = matrixScroll.scrollLeft + 190;
      const visibleRight = matrixScroll.scrollLeft + matrixScroll.clientWidth;
      if (left < visibleLeft || right > visibleRight) {
        matrixScroll.scrollTo({
          left: Math.max(0, left - matrixScroll.clientWidth / 2),
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
        });
      }
    }
  }

  if (previousElementIndex >= 0 && previousBandIndex >= 0) {
    cellsByStep
      .get(`${previousElementIndex}:${previousBandIndex}`)
      ?.classList.remove("is-current-step");
    bandCardElements[previousBandIndex]?.classList.remove("is-active");
  }
  cellsByStep
    .get(`${position.elementIndex}:${position.bandIndex}`)
    ?.classList.add("is-current-step");
  bandCardElements[position.bandIndex]?.classList.add("is-active");

  currentBandDetail.textContent = `Band ${String(track.index + 1).padStart(2, "0")} · ${track.name} · ${track.note}`;
  currentReadout.textContent = `${element.symbol} · Band ${String(track.index + 1).padStart(2, "0")} of 16 · ${formatBrightness(brightness)}`;
  positionLabel.textContent = `Measure ${String(position.elementIndex + 1).padStart(2, "0")} · Step ${String(position.bandIndex + 1).padStart(2, "0")}`;
  progressBar.style.transform = `scaleX(${(position.step + 1) / (elements.length * STEPS_PER_ELEMENT)})`;

  previousElementIndex = position.elementIndex;
  previousBandIndex = position.bandIndex;
}

const sequencer = new SpectrumSequencer({
  onPosition: updatePosition,
  onStateChange: updatePlaybackState,
});
sequencer.setBpm(DEFAULT_BPM);
sequencer.setDimValueLift(dimLiftInput.checked);
updatePosition(currentPosition);

playButton.addEventListener("click", async () => {
  playButton.disabled = true;
  try {
    await sequencer.togglePlayback();
  } catch (error) {
    console.error(error);
    statusText.textContent = "Audio could not start in this browser";
    liveStatus.textContent = "Audio could not start";
  } finally {
    playButton.disabled = false;
  }
});

stopButton.addEventListener("click", () => {
  sequencer.stop();
  liveStatus.textContent = "Playback stopped and reset";
});

bpmInput.addEventListener("input", () => {
  const bpm = Number(bpmInput.value);
  sequencer.setBpm(bpm);
  bpmOutput.value = `${bpm} BPM`;
  durationLabel.textContent = formatDuration((elements.length * 4 * 60) / bpm);
});

volumeInput.addEventListener("input", () => {
  const percent = Number(volumeInput.value);
  sequencer.setMasterVolume(percent);
  volumeOutput.value = `${percent}%`;
});

dimLiftInput.addEventListener("change", () => {
  const enabled = dimLiftInput.checked;
  sequencer.setDimValueLift(enabled);
  dimLiftState.textContent = enabled ? "On" : "Off";
  velocityMapping.textContent = enabled
    ? `Brightness mapping: ${DIM_FLOOR_PERCENT}% dim floor · ${DIM_CUTOFF_PERCENT}%+ unchanged`
    : "Brightness mapping: linear 0–1 velocity";
  statusText.textContent = enabled
    ? `Dim-value lift on — positive values below ${DIM_CUTOFF_PERCENT}% are raised`
    : "Dim-value lift off — linear brightness velocity restored";
  liveStatus.textContent = `Dim-value lift ${enabled ? "enabled" : "disabled"}`;
});

elementSeek.addEventListener("input", () => {
  sequencer.seekToElement(Number(elementSeek.value));
});

exportButton.addEventListener("click", () => {
  try {
    const summary = downloadMidiFile(elements, sequencer.tempo, {
      liftDimValues: dimLiftInput.checked,
    });
    statusText.textContent = `Exported ${summary.filename} · ${summary.noteCount.toLocaleString()} notes`;
    liveStatus.textContent = `MIDI exported with ${summary.instrumentTrackCount} instrument tracks`;
  } catch (error) {
    console.error(error);
    statusText.textContent = "MIDI export failed";
    liveStatus.textContent = "MIDI export failed";
  }
});

function updateAudioExportProgress(progress: AudioExportProgress): void {
  const rate = `${Math.round(progress.sampleRate / 1000)} kHz`;
  if (progress.phase === "checking") {
    statusText.textContent = `Checking ${rate} offline audio support…`;
  } else if (progress.phase === "rendering") {
    statusText.textContent = `Rendering ${rate} Tone.js mix — this may take a minute`;
  } else {
    statusText.textContent = `Encoding ${rate} · 24-bit stereo WAV…`;
  }
}

audioExportButton.addEventListener("click", async () => {
  if (sequencer.playbackState === "playing") {
    sequencer.pause();
  }

  audioExportButton.disabled = true;
  audioExportButton.setAttribute("aria-busy", "true");
  playButton.disabled = true;
  exportButton.disabled = true;
  liveStatus.textContent = "Audio export started";

  try {
    const summary = await downloadToneAudio({
      bpm: sequencer.tempo,
      masterPercent: Number(volumeInput.value),
      liftDimValues: dimLiftInput.checked,
      trackStates: TRACKS.map((track) => sequencer.getTrackState(track.index)),
      onProgress: updateAudioExportProgress,
    });
    const sizeMiB = summary.bytes / 1024 / 1024;
    const rate = `${Math.round(summary.sampleRate / 1000)} kHz`;
    statusText.textContent = `Exported ${rate} · ${summary.bitDepth}-bit WAV · ${sizeMiB.toFixed(1)} MiB`;
    liveStatus.textContent = `WAV exported at ${rate} and ${summary.bitDepth}-bit depth`;
  } catch (error) {
    console.error(error);
    statusText.textContent = "WAV export failed — try closing other tabs or using a lower-memory browser";
    liveStatus.textContent = "WAV audio export failed";
  } finally {
    audioExportButton.disabled = false;
    audioExportButton.removeAttribute("aria-busy");
    playButton.disabled = false;
    exportButton.disabled = false;
  }
});

matrixBody.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const actionButton = target.closest<HTMLButtonElement>("[data-action]");

  if (actionButton) {
    const trackIndex = Number(actionButton.dataset.trackIndex);
    const action = actionButton.dataset.action;
    const state =
      action === "mute"
        ? sequencer.toggleMute(trackIndex)
        : sequencer.toggleSolo(trackIndex);
    actionButton.setAttribute(
      "aria-pressed",
      String(action === "mute" ? state.muted : state.soloed),
    );
    actionButton.classList.toggle(
      "is-active",
      action === "mute" ? state.muted : state.soloed,
    );
    return;
  }

  const cell = target.closest<HTMLElement>("[data-element-index]");
  if (cell) {
    sequencer.seekToElement(Number(cell.dataset.elementIndex));
  }
});

window.addEventListener("keydown", (event) => {
  const target = event.target as HTMLElement;
  const isControl = target.matches("button, input, select, textarea, a");
  if (event.code === "Space" && !isControl) {
    event.preventDefault();
    void sequencer.togglePlayback();
  }
});

window.addEventListener("beforeunload", () => sequencer.dispose());

if (import.meta.hot) {
  import.meta.hot.dispose(() => sequencer.dispose());
}
