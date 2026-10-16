<img width="3840" height="2160" alt="periodic table of elements preview" src="https://github.com/user-attachments/assets/95dd3476-a4c6-4e10-8750-2063c64016ba" />

# Element Spectrum Sequencer

A local Vite + TypeScript application that sonifies the 16 normalized color
aggregates in `element_color_aggregates.json` with Tone.js and exports the same
sequence as high-resolution WAV audio or a Standard MIDI File.

## Run locally

```sh
npm install
npm run dev
```

Create a production build with:

```sh
npm run build
```

## Sequence model

- Elements are read in atomic-number order from H through Es.
- One element occupies one 4/4 measure.
- `band_01` through `band_16` occupy the measure's 16 successive
  sixteenth-note positions.
- Each band has its own monophonic Tone.js voice and MIDI track.
- A positive aggregate produces a note whose linear velocity equals the
  normalized brightness value.
- The optional **Lift dim values** switch gives positive readings below 0.25
  a 0.10 velocity floor, blends smoothly back to the source value at 0.25,
  and leaves all brighter readings unchanged.
- An exact zero is a rest. Its time slot is retained, so later bands never
  move earlier to fill the silence.
- The default tempo is 120 BPM and can be changed during playback.

## MIDI export

The export is a Type 1 Standard MIDI File with 16 instrument tracks plus a
conductor/meta track. It includes the selected tempo, a 4/4 time signature,
one marker per element, and 16 independent MIDI channels. Positive values are
quantized to MIDI's 7-bit velocity range with a minimum velocity of 1; zeros
remain rests. MIDI export uses the same dim-value lift setting as browser
playback.

Track 10 intentionally uses General MIDI channel 10 as a percussion voice.
All other tracks include General MIDI program hints; exact Tone.js timbres are
browser synthesis settings and are not embedded in MIDI.

## WAV audio export

The WAV export recreates the Tone.js master mix in an offline audio context and
encodes it as stereo 24-bit PCM. It includes the selected tempo, master level,
dim-value lift setting, stereo panning, limiter, and current mute/solo state.

The renderer requests 192 kHz first. If that sample rate is unsupported or the
browser cannot allocate the full render, it retries at 96 kHz, 48 kHz, and
44.1 kHz in that order. A 192 kHz export of the default 120 BPM sequence is
roughly 218 MiB, so rendering may take a while and needs substantial memory.
