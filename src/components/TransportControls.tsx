import React from 'react';
import type { Song } from '../types';

interface TransportControlsProps {
  song: Song;
  isPlaying: boolean;
  isRecording: boolean;
  onPlay: () => void;
  onStop: () => void;
  onRecord: () => void;
  onStepPlay: () => void;
  onPlayFromTop: () => void;
  onBpmChange: (bpm: number) => void;
  onRowsPerBeatChange: (rowsPerBeat: number) => void;
}

export const TransportControls: React.FC<TransportControlsProps> = ({
  song,
  isPlaying,
  isRecording,
  onPlay,
  onStop,
  onRecord,
  onStepPlay,
  onPlayFromTop,
  onBpmChange,
  onRowsPerBeatChange
}) => {
  const handleKeyPress = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case ' ':
        event.preventDefault();
        if (isPlaying) {
          onStop();
        } else {
          onPlay();
        }
        break;
      case '.':
        event.preventDefault();
        onStepPlay();
        break;
      case 'Enter':
        if (event.ctrlKey) {
          event.preventDefault();
          onPlayFromTop();
        }
        break;
      case 'r':
      case 'R':
        if (event.ctrlKey) {
          event.preventDefault();
          onRecord();
        }
        break;
    }
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  const currentRowTime = (song.playheadRow / song.rowsPerBeat) * (60 / song.bpm);

  return (
    <div 
      className="transport-controls"
      tabIndex={0}
      onKeyDown={handleKeyPress}
    >
      <div className="transport-header">
        BreakForge - Track 0  | bpm: {song.bpm} | rows/beat: {song.rowsPerBeat} | phrase: {song.currentPhrase}
      </div>
      
      <div className="transport-buttons">
        <button 
          className={`transport-btn ${isPlaying ? 'active' : ''}`}
          onClick={isPlaying ? onStop : onPlay}
        >
          {isPlaying ? '⏸ Stop' : '▶ Play'}
        </button>
        
        <button 
          className="transport-btn"
          onClick={onPlayFromTop}
        >
          ⏮ From Top
        </button>
        
        <button 
          className="transport-btn"
          onClick={onStepPlay}
        >
          ⏭ Step
        </button>
        
        <button 
          className={`transport-btn ${isRecording ? 'recording' : ''}`}
          onClick={onRecord}
        >
          {isRecording ? '⏺ Recording' : '⏺ Record'}
        </button>
      </div>

      <div className="tempo-controls">
        <label>
          BPM:
          <input
            type="number"
            value={song.bpm}
            min={60}
            max={200}
            onChange={(e) => onBpmChange(parseInt(e.target.value))}
            className="tempo-input"
          />
        </label>
        
        <label>
          Rows/Beat:
          <select
            value={song.rowsPerBeat}
            onChange={(e) => onRowsPerBeatChange(parseInt(e.target.value))}
            className="tempo-select"
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={4}>4</option>
            <option value={8}>8</option>
            <option value={16}>16</option>
          </select>
        </label>
      </div>

      <div className="status-info">
        <div className="playback-status">
          Status: {isPlaying ? 'Playing' : 'Stopped'} | 
          playhead row: {song.playheadRow.toString().padStart(2, '0')} | 
          time: {formatTime(currentRowTime)} |
          lookahead: 100ms
        </div>
      </div>

      <div className="transport-hints">
        <div className="hints">
          Hints: TAB switch view (Song/Chain/Phrase/Browser), L = load file, S = auto-slice, R = retrig, G = granular params
        </div>
      </div>
    </div>
  );
};