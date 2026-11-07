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
- The optional **Compress late peaks** switch leaves beat 1 unchanged, then
  applies downward compression to the loudest 25% of active notes in the rest
  of each element's measure. The post-beat-1 peak is reduced by 25%; nearby
  notes are limited as needed so none can exceed the new peak ceiling.
- An exact zero is a rest. Its time slot is retained, so later bands never
  move earlier to fill the silence.
- The default tempo is 120 BPM and can be changed during playback.
- The **Reverb** switch controls subtle ambience for playback and WAV exports
  with a 10% wet mix and a 0.8-second decay. It is on by default and can be
  toggled during playback.
- **Limit low mids** applies ∞:1 compression to the loudest 50% of active
  note levels on tracks 12–15: F3, G3, A3, and B3 at the default C-major key
  and starting octave 2. A shared threshold is the 50th percentile of those
  notes' mapped levels in decibels across the whole piece; rests are excluded.
  Velocities below that threshold pass unchanged. Higher velocities are replaced
  by the threshold velocity, with no makeup gain. Tied velocities receive equal
  treatment. The new velocities are sent directly to the synths and included
  in MIDI exports, so velocity-sensitive timbres respond to the limited values.
  The switch is on by default and follows those tracks when key or octave
  changes. It runs after dim-value lift and late-peak compression, using the
  same velocity mapping in playback, WAV export, and MIDI export.
- The key control provides all 12 major and 12 minor keys. Melodic tracks
  ascend through consecutive scale degrees from the selected starting octave;
  the General MIDI percussion track remains fixed.
- The starting octave can be set from octave 1 through octave 5. Key and
  octave changes affect live playback and both export formats.

## MIDI export

The export is a Type 1 Standard MIDI File with 16 instrument tracks plus a
conductor/meta track. It includes the selected tempo, a 4/4 time signature,
one marker per element, the selected major or minor key signature, and 16
independent MIDI channels. Positive values are quantized to MIDI's 7-bit
velocity range with a minimum velocity of 1; zeros remain rests. MIDI export
uses the same tempo, key, starting octave, low-mid limiting, dim-value lift, and late-peak
compression settings as browser playback.

Track 10 intentionally uses General MIDI channel 10 as a percussion voice.
All other tracks include General MIDI program hints; exact Tone.js timbres are
browser synthesis settings and are not embedded in MIDI.

## WAV audio export

The WAV export recreates the Tone.js master mix in an offline audio context and
encodes it as stereo 24-bit PCM. It includes the selected tempo, key, starting
octave, master level, low-mid limiting, dim-value lift and late-peak compression
settings, stereo panning, the reverb switch setting, limiter, and current
mute/solo state. When reverb is on, the render includes its full tail after the
sequence ends.

The sample-rate control offers 192 kHz (default), 96 kHz, 48 kHz, and 44.1 kHz;
all options remain stereo 24-bit PCM. If the selected rate is unsupported or
the browser cannot allocate the full render, it retries at the remaining lower
rates in that order. A 4:57 export at 192 kHz contains about 57 million stereo
frames and 342 MB of WAV data before the release/reverb tail. Choosing 48 kHz
reduces the sample count and file size to one quarter.

Export status shows rendering/encoding percentages and elapsed time. Rendering
omits inaudible tracks and bypasses reverb when it is off. WAV encoding runs in
a worker with bounded chunks to avoid extra full-file allocations and keep the
interface responsive; a chunked fallback supports browsers that block workers.
Neither path waits for animation frames, so encoding can finish in a background
tab. High-rate synthesis can still take several minutes on longer sequences.

## Analysis Image

<img width="975" height="576" alt="sp_lores-2" src="https://github.com/user-attachments/assets/9f86784c-231c-4be8-89af-87858de974b9" />
