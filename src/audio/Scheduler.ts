import { AudioEngine } from './AudioEngine';
import type { Song, AudioEvent } from '../types';

export class Scheduler {
  private audioEngine: AudioEngine;
  private isRunning = false;
  private intervalId: number | null = null;
  private nextRowTime = 0;
  private nextRow = 0;
  private lookahead = 0.1; // 100ms lookahead
  private updateInterval = 0.025; // 25ms update interval
  private song: Song | null = null;

  constructor(audioEngine: AudioEngine) {
    this.audioEngine = audioEngine;
  }

  setSong(song: Song): void {
    this.song = song;
  }

  start(): void {
    if (this.isRunning || !this.song) return;

    this.isRunning = true;
    this.nextRow = this.song.playheadRow;
    this.nextRowTime = this.audioEngine.currentTime;
    
    this.intervalId = window.setInterval(() => {
      this.tick();
    }, this.updateInterval * 1000);

    console.log('Scheduler started');
  }

  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.audioEngine.stopAll();
    console.log('Scheduler stopped');
  }

  playFromTop(): void {
    if (!this.song) return;
    
    this.song.playheadRow = 0;
    this.nextRow = 0;
    this.nextRowTime = this.audioEngine.currentTime;
    
    if (!this.isRunning) {
      this.start();
    }
  }

  stepPlay(): void {
    if (!this.song) return;

    // Play current row and advance
    this.playRow(this.song.playheadRow, this.audioEngine.currentTime);
    this.song.playheadRow = (this.song.playheadRow + 1) % (this.getCurrentPhrase()?.rows || 16);
  }

  private tick(): void {
    if (!this.song || !this.isRunning) return;

    const now = this.audioEngine.currentTime;
    const phrase = this.getCurrentPhrase();
    
    if (!phrase) return;

    // Schedule events up to lookahead time
    while (this.nextRowTime < now + this.lookahead) {
      this.playRow(this.nextRow, this.nextRowTime);
      
      // Advance to next row
      this.nextRow = (this.nextRow + 1) % phrase.rows;
      this.song.playheadRow = this.nextRow;
      this.nextRowTime += this.getSecondsPerRow();
    }
  }

  private playRow(rowIndex: number, whenTime: number): void {
    if (!this.song) return;

    const phrase = this.getCurrentPhrase();
    if (!phrase) return;

    // Play all tracks for this row
    phrase.tracks.forEach((track, trackIndex) => {
      if (trackIndex >= track.rows.length) return;
      
      const row = track.rows[rowIndex];
      if (!row || !row.play) return;

      // Get file data
      const file = this.audioEngine.getFile(row.fileIndex);
      if (!file) return;

      // Get slice data
      const slice = file.slices[row.slice];
      if (!slice) return;

      // Calculate timing
      const rowDuration = this.getSecondsPerRow();
      const deltaTicks = row.deltaTicks || 0;
      const offsetMs = row.offsetMs || 0;
      const tickDuration = rowDuration / 96; // Assuming 96 ticks per row
      
      const eventTime = whenTime + (deltaTicks * tickDuration) + (offsetMs / 1000);
      const eventSample = Math.floor(eventTime * this.audioEngine.sampleRate);

      // Calculate playback parameters
      const playbackRate = Math.pow(2, row.transpose / 12);
      const pan = Math.max(-1, Math.min(1, row.pan));
      const volume = track.volume * (track.muted ? 0 : 1);

      // Create audio event
      const event: AudioEvent = {
        whenSample: eventSample,
        fileId: row.fileIndex,
        sliceId: row.slice,
        sliceStartSample: Math.floor(slice.startSec * file.sampleRate),
        sliceLenSamples: Math.floor((slice.endSec - slice.startSec) * file.sampleRate),
        playbackRate: playbackRate,
        pan: pan,
        volume: volume,
        reverse: row.reverse,
        timestretch: row.timestretch,
        retrig: row.retrig,
        offsetSamples: Math.floor((row.offsetMs / 1000) * file.sampleRate)
      };

      // Schedule the event
      this.audioEngine.scheduleEvent(event);

      // Handle retriggering
      if (row.retrig > 0) {
        const retrigInterval = rowDuration / row.retrig;
        for (let i = 1; i < row.retrig; i++) {
          const retrigTime = eventTime + (i * retrigInterval);
          const retrigEvent: AudioEvent = {
            ...event,
            whenSample: Math.floor(retrigTime * this.audioEngine.sampleRate)
          };
          this.audioEngine.scheduleEvent(retrigEvent);
        }
      }
    });
  }

  private getCurrentPhrase() {
    if (!this.song) return null;
    return this.song.phrases.find(p => p.id === this.song!.currentPhrase);
  }

  private getSecondsPerRow(): number {
    if (!this.song) return 0;
    return 60 / this.song.bpm / this.song.rowsPerBeat;
  }

  setBPM(bpm: number): void {
    if (this.song) {
      this.song.bpm = Math.max(60, Math.min(200, bpm));
    }
  }

  setRowsPerBeat(rowsPerBeat: number): void {
    if (this.song) {
      this.song.rowsPerBeat = rowsPerBeat;
    }
  }

  get isPlaying(): boolean {
    return this.isRunning;
  }

  get currentRow(): number {
    return this.song?.playheadRow || 0;
  }
}