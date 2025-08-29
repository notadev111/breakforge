export type FileID = string;

export interface SampleFile {
  id: FileID;
  name: string;
  sampleRate: number;
  channels: number;
  duration: number;
  buffer: Float32Array[];
  slices: Slice[];
  rootNote?: number;
}

export interface Slice {
  id: number;
  startSec: number;
  endSec: number;
  label?: string;
}

export interface Row {
  slice: number;       // SL slice index
  play: boolean;       // P
  transpose: number;   // NN in semitones
  deltaTicks: number;  // DT - micro offset in ticks
  gateRows: number;    // GT - how many rows long
  retrig: number;      // RT - retrig every N ticks
  offsetMs: number;    // OF - micro offset ms into slice
  pan: number;         // PA - -1..1
  timestretch: number; // TS - factor (1.0 = original length)
  reverse: boolean;    // RS
  fileIndex: FileID;   // FI
}

export interface Track {
  id: string;
  name: string;
  fileId: FileID;
  rows: Row[];
  volume: number;
  muted: boolean;
  solo: boolean;
}

export interface Phrase {
  id: string;
  name: string;
  rows: number;
  tracks: Track[];
}

export interface Chain {
  id: string;
  name: string;
  phraseIds: string[];
}

export interface Song {
  id: string;
  name: string;
  bpm: number;
  rowsPerBeat: number;
  phrases: Phrase[];
  chains: Chain[];
  files: Map<FileID, SampleFile>;
  currentPhrase: string;
  currentTrack: number;
  currentRow: number;
  isPlaying: boolean;
  playheadRow: number;
}

export interface AudioEvent {
  whenSample: number;
  fileId: FileID;
  sliceId: number;
  sliceStartSample: number;
  sliceLenSamples: number;
  playbackRate: number;
  pan: number;
  volume: number;
  reverse: boolean;
  timestretch: number;
  retrig: number;
  offsetSamples: number;
}

export interface Voice {
  active: boolean;
  startSample: number;
  readPos: number;
  playbackMode: 'normal' | 'granular';
  fileId: FileID;
  sliceId: number;
  playbackRate: number;
  pan: number;
  volume: number;
  reverse: boolean;
  timestretch: number;
  envelope: {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
    stage: 'attack' | 'decay' | 'sustain' | 'release';
    level: number;
  };
}

export interface GranularParams {
  grainSize: number;    // in ms
  overlap: number;      // 0-1
  hopOut: number;
  hopIn: number;
}

export type ViewMode = 'Song' | 'Chain' | 'Phrase' | 'Browser' | 'Mixer' | 'Settings';

export interface AppState {
  song: Song;
  currentView: ViewMode;
  cursor: {
    row: number;
    col: string;
  };
  selectedSlice: number;
  audioContext: AudioContext | null;
  isRecording: boolean;
}

export interface WaveformDisplay {
  width: number;
  height: number;
  samples: number[];
  sliceMarkers: number[];
  selectedMarker: number;
}