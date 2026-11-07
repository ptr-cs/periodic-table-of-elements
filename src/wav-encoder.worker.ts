export interface EncodeWavChunkRequest {
  channels: Float32Array<ArrayBuffer>[];
}

export interface EncodeWavChunkResponse {
  pcm: ArrayBuffer;
}

export function encodePcm24Chunk(channels: readonly Float32Array[]): ArrayBuffer {
  const frames = channels[0]?.length ?? 0;
  const pcm = new Uint8Array(frames * channels.length * 3);
  let offset = 0;

  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < channels.length; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channels[channel][frame]));
      const signed = Math.round(sample * (sample < 0 ? 0x800000 : 0x7fffff));
      pcm[offset++] = signed & 0xff;
      pcm[offset++] = (signed >>> 8) & 0xff;
      pcm[offset++] = (signed >>> 16) & 0xff;
    }
  }

  return pcm.buffer;
}

// This module is also imported by the main-thread fallback encoder.
if (typeof document === "undefined" && typeof self !== "undefined") {
  const scope = self as unknown as {
    onmessage: ((event: MessageEvent<EncodeWavChunkRequest>) => void) | null;
    postMessage: (message: EncodeWavChunkResponse, transfer: Transferable[]) => void;
  };
  scope.onmessage = ({ data }) => {
    const pcm = encodePcm24Chunk(data.channels);
    scope.postMessage({ pcm }, [pcm]);
  };
}
