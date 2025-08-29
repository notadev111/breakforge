import type { SampleFile, AudioEvent, FileID, Slice } from '../types';

export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private isInitialized = false;
  private files: Map<FileID, SampleFile> = new Map();
  private masterGain: GainNode | null = null;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.audioContext = new AudioContext();
      
      // Load and register the AudioWorklet
      await this.audioContext.audioWorklet.addModule('/audioWorklet.js');
      
      // Create the worklet node
      this.workletNode = new AudioWorkletNode(this.audioContext, 'breakforge-processor');
      
      // Create master gain
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.8;
      
      // Connect audio graph
      this.workletNode.connect(this.masterGain);
      this.masterGain.connect(this.audioContext.destination);
      
      // Send sample rate to worklet
      this.workletNode.port.postMessage({
        type: 'setSampleRate',
        data: { sampleRate: this.audioContext.sampleRate }
      });
      
      this.isInitialized = true;
      console.log('Audio engine initialized');
    } catch (error) {
      console.error('Failed to initialize audio engine:', error);
      throw error;
    }
  }

  async loadSampleFile(file: File): Promise<SampleFile> {
    if (!this.audioContext) {
      throw new Error('Audio engine not initialized');
    }

    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    
    // Convert AudioBuffer to Float32Arrays
    const channels: Float32Array[] = [];
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
      channels.push(new Float32Array(audioBuffer.getChannelData(i)));
    }

    const sampleFile: SampleFile = {
      id: this.generateFileId(),
      name: file.name,
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels,
      duration: audioBuffer.duration,
      buffer: channels,
      slices: [],
      rootNote: 60 // C4 by default
    };

    // Store file
    this.files.set(sampleFile.id, sampleFile);

    // Transfer buffers to worklet
    if (this.workletNode) {
      // Create transferable buffers
      const transferableBuffers = channels.map(channel => {
        const buffer = new ArrayBuffer(channel.length * 4);
        const view = new Float32Array(buffer);
        view.set(channel);
        return buffer;
      });

      this.workletNode.port.postMessage({
        type: 'setFileBuffer',
        data: {
          fileId: sampleFile.id,
          channels: sampleFile.channels,
          buffers: transferableBuffers.map(buffer => new Float32Array(buffer)),
          sampleRate: sampleFile.sampleRate,
          slices: sampleFile.slices
        }
      }, transferableBuffers);
    }

    return sampleFile;
  }

  autoSlice(fileId: FileID, threshold: number = 0.1, minDistance: number = 0.03): Slice[] {
    const file = this.files.get(fileId);
    if (!file) return [];

    const samples = file.buffer[0]; // Use first channel
    const slices: Slice[] = [];
    const minDistanceSamples = Math.floor(minDistance * file.sampleRate);
    
    // Simple onset detection using energy envelope
    const windowSize = Math.floor(0.01 * file.sampleRate); // 10ms window
    let lastOnset = -minDistanceSamples;

    for (let i = windowSize; i < samples.length - windowSize; i += windowSize) {
      // Calculate energy in current window
      let energy = 0;
      for (let j = i - windowSize; j < i + windowSize; j++) {
        energy += samples[j] * samples[j];
      }
      energy = Math.sqrt(energy / (windowSize * 2));

      // Calculate energy in previous window
      let prevEnergy = 0;
      for (let j = i - windowSize * 2; j < i; j++) {
        prevEnergy += samples[j] * samples[j];
      }
      prevEnergy = Math.sqrt(prevEnergy / windowSize);

      // Detect onset (energy increase above threshold)
      if (energy > prevEnergy + threshold && i - lastOnset > minDistanceSamples) {
        const onsetTime = i / file.sampleRate;
        const slice: Slice = {
          id: slices.length,
          startSec: Math.max(0, onsetTime - 0.005), // 5ms pre-roll
          endSec: Math.min(file.duration, onsetTime + 0.5), // 500ms default length
          label: `Slice ${slices.length + 1}`
        };
        slices.push(slice);
        lastOnset = i;
      }
    }

    // Update slice end times to not overlap
    for (let i = 0; i < slices.length - 1; i++) {
      slices[i].endSec = Math.min(slices[i].endSec, slices[i + 1].startSec - 0.001);
    }

    // Update file slices
    file.slices = slices;

    // Update worklet with new slices
    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: 'setFileBuffer',
        data: {
          fileId: fileId,
          channels: file.channels,
          buffers: file.buffer,
          sampleRate: file.sampleRate,
          slices: slices
        }
      });
    }

    return slices;
  }

  scheduleEvent(event: AudioEvent): void {
    if (!this.workletNode) return;

    this.workletNode.port.postMessage({
      type: 'schedule',
      data: { event }
    });
  }

  setMasterVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  stopAll(): void {
    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: 'stopAll',
        data: {}
      });
    }
  }

  getFile(fileId: FileID): SampleFile | undefined {
    return this.files.get(fileId);
  }

  getAllFiles(): Map<FileID, SampleFile> {
    return new Map(this.files);
  }

  removeFile(fileId: FileID): void {
    this.files.delete(fileId);
  }

  private generateFileId(): string {
    return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  get currentTime(): number {
    return this.audioContext?.currentTime || 0;
  }

  get sampleRate(): number {
    return this.audioContext?.sampleRate || 44100;
  }

  get context(): AudioContext | null {
    return this.audioContext;
  }

  async resume(): Promise<void> {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  async suspend(): Promise<void> {
    if (this.audioContext?.state === 'running') {
      await this.audioContext.suspend();
    }
  }

  dispose(): void {
    this.stopAll();
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.masterGain) {
      this.masterGain.disconnect();
      this.masterGain = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.isInitialized = false;
  }
}