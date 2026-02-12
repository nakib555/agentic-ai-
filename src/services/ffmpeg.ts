import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

class FFmpegService {
  private ffmpeg: FFmpeg | null = null;
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;

  private async load() {
    if (this.isLoaded) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      this.ffmpeg = new FFmpeg();
      
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
      
      try {
        await this.ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        this.isLoaded = true;
        console.log('[FFmpeg] Loaded successfully');
      } catch (e) {
        console.error('[FFmpeg] Failed to load:', e);
        this.ffmpeg = null;
        this.loadPromise = null;
        throw e;
      }
    })();

    return this.loadPromise;
  }

  public async convertToMP4(file: File, onProgress: (p: number) => void): Promise<File> {
    await this.load();
    if (!this.ffmpeg) throw new Error("FFmpeg not loaded");

    const { name } = file;
    const outputName = 'output.mp4';

    await this.ffmpeg.writeFile(name, await fetchFile(file));

    this.ffmpeg.on('progress', ({ progress }: { progress: number }) => {
      onProgress(Math.round(progress * 100));
    });

    // -preset ultrafast for speed, -crf 23 for decent quality
    await this.ffmpeg.exec(['-i', name, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', outputName]);

    const data = await this.ffmpeg.readFile(outputName);
    const newBlob = new Blob([data], { type: 'video/mp4' });
    
    // Cleanup
    await this.ffmpeg.deleteFile(name);
    await this.ffmpeg.deleteFile(outputName);

    return new File([newBlob], `${name.split('.')[0]}.mp4`, { type: 'video/mp4' });
  }

  public async convertToMP3(file: File, onProgress: (p: number) => void): Promise<File> {
    await this.load();
    if (!this.ffmpeg) throw new Error("FFmpeg not loaded");

    const { name } = file;
    const outputName = 'output.mp3';

    await this.ffmpeg.writeFile(name, await fetchFile(file));

    this.ffmpeg.on('progress', ({ progress }: { progress: number }) => {
      onProgress(Math.round(progress * 100));
    });

    await this.ffmpeg.exec(['-i', name, outputName]);

    const data = await this.ffmpeg.readFile(outputName);
    const newBlob = new Blob([data], { type: 'audio/mpeg' });

    // Cleanup
    await this.ffmpeg.deleteFile(name);
    await this.ffmpeg.deleteFile(outputName);

    return new File([newBlob], `${name.split('.')[0]}.mp3`, { type: 'audio/mpeg' });
  }

  public async compressVideo(file: File, onProgress: (p: number) => void): Promise<File> {
    await this.load();
    if (!this.ffmpeg) throw new Error("FFmpeg not loaded");

    const { name } = file;
    const outputName = 'compressed.mp4';

    await this.ffmpeg.writeFile(name, await fetchFile(file));

    this.ffmpeg.on('progress', ({ progress }: { progress: number }) => {
      onProgress(Math.round(progress * 100));
    });

    // Reduce scale to 720p if larger, and lower bitrate/CRF
    await this.ffmpeg.exec([
        '-i', name, 
        '-vf', 'scale=-2:720', // Scale height to 720p, keep aspect ratio
        '-c:v', 'libx264', 
        '-crf', '28', // Higher CRF = Lower quality/Lower size
        '-preset', 'veryfast', 
        outputName
    ]);

    const data = await this.ffmpeg.readFile(outputName);
    const newBlob = new Blob([data], { type: 'video/mp4' });

    // Cleanup
    await this.ffmpeg.deleteFile(name);
    await this.ffmpeg.deleteFile(outputName);

    return new File([newBlob], `compressed_${name.split('.')[0]}.mp4`, { type: 'video/mp4' });
  }

  public async convertToGIF(file: File, onProgress: (p: number) => void): Promise<File> {
    await this.load();
    if (!this.ffmpeg) throw new Error("FFmpeg not loaded");

    const { name } = file;
    const outputName = 'output.gif';

    await this.ffmpeg.writeFile(name, await fetchFile(file));

    this.ffmpeg.on('progress', ({ progress }: { progress: number }) => {
      onProgress(Math.round(progress * 100));
    });

    // 10fps, scale to 320 width for reasonable GIF size
    await this.ffmpeg.exec(['-i', name, '-vf', 'fps=10,scale=320:-1:flags=lanczos', outputName]);

    const data = await this.ffmpeg.readFile(outputName);
    const newBlob = new Blob([data], { type: 'image/gif' });

    // Cleanup
    await this.ffmpeg.deleteFile(name);
    await this.ffmpeg.deleteFile(outputName);

    return new File([newBlob], `${name.split('.')[0]}.gif`, { type: 'image/gif' });
  }
}

export const ffmpegService = new FFmpegService();