import {
  encodePcm24Chunk,
  type EncodeWavChunkRequest,
  type EncodeWavChunkResponse,
} from "./wav-encoder.worker";

const CHUNK_FRAMES = 262_144;
const BYTES_PER_SAMPLE = 3;

type EncodingProgress = (completedFrames: number, totalFrames: number) => void;

function createWavHeader(audioBuffer: AudioBuffer): ArrayBuffer {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const blockAlign = audioBuffer.numberOfChannels * BYTES_PER_SAMPLE;
  const dataBytes = audioBuffer.length * blockAlign;
  if (dataBytes > 0xffffffff - 36) {
    throw new Error("This audio exceeds the WAV file format's 4 GiB size limit.");
  }
  const writeAscii = (offset: number, text: string): void => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, audioBuffer.numberOfChannels, true);
  view.setUint32(24, audioBuffer.sampleRate, true);
  view.setUint32(28, audioBuffer.sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, BYTES_PER_SAMPLE * 8, true);
  writeAscii(36, "data");
  view.setUint32(40, dataBytes, true);
  return header;
}

function copyChunk(audioBuffer: AudioBuffer, start: number): Float32Array<ArrayBuffer>[] {
  const frames = Math.min(CHUNK_FRAMES, audioBuffer.length - start);
  return Array.from({ length: audioBuffer.numberOfChannels }, (_, channel) => {
    const samples = new Float32Array(frames);
    audioBuffer.copyFromChannel(samples, channel, start);
    return samples;
  });
}

async function encodeWithWorker(
  worker: Worker,
  audioBuffer: AudioBuffer,
  header: ArrayBuffer,
  onProgress?: EncodingProgress,
): Promise<Blob> {
  const parts: BlobPart[] = [header];
  for (let start = 0; start < audioBuffer.length; start += CHUNK_FRAMES) {
    const channels = copyChunk(audioBuffer, start);
    const frames = channels[0].length;
    const pcm = await new Promise<ArrayBuffer>((resolve, reject) => {
      worker.onmessage = ({ data }: MessageEvent<EncodeWavChunkResponse>) => resolve(data.pcm);
      worker.onerror = (event) => {
        event.preventDefault();
        reject(new Error(event.message || "WAV encoder worker failed."));
      };
      worker.onmessageerror = () => reject(new Error("WAV encoder worker returned invalid data."));
      const request: EncodeWavChunkRequest = { channels };
      worker.postMessage(request, channels.map((channel) => channel.buffer));
    });
    parts.push(new Blob([pcm]));
    onProgress?.(start + frames, audioBuffer.length);
  }
  return new Blob(parts, { type: "audio/wav" });
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      channel.port2.close();
      resolve();
    };
    channel.port2.postMessage(null);
  });
}

async function encodeOnMainThread(
  audioBuffer: AudioBuffer,
  header: ArrayBuffer,
  onProgress?: EncodingProgress,
): Promise<Blob> {
  const parts: BlobPart[] = [header];
  for (let start = 0; start < audioBuffer.length; start += CHUNK_FRAMES) {
    const channels = copyChunk(audioBuffer, start);
    const pcm = encodePcm24Chunk(channels);
    parts.push(new Blob([pcm]));
    onProgress?.(start + channels[0].length, audioBuffer.length);
    await yieldToBrowser();
  }
  return new Blob(parts, { type: "audio/wav" });
}

export async function encodePcm24Wav(
  audioBuffer: AudioBuffer,
  onProgress?: EncodingProgress,
): Promise<Blob> {
  const header = createWavHeader(audioBuffer);
  onProgress?.(0, audioBuffer.length);

  if (typeof Worker !== "undefined") {
    let worker: Worker | undefined;
    try {
      worker = new Worker(new URL("./wav-encoder.worker.ts", import.meta.url), { type: "module" });
      return await encodeWithWorker(worker, audioBuffer, header, onProgress);
    } catch {
      // Restricted browsers can still encode in bounded main-thread chunks.
    } finally {
      worker?.terminate();
    }
  }

  return encodeOnMainThread(audioBuffer, header, onProgress);
}
