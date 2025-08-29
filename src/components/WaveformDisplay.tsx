import React from 'react';
import type { SampleFile } from '../types';

interface WaveformDisplayProps {
  file: SampleFile | null;
  width: number;
  selectedMarker: number;
  onMarkerMove: (markerIndex: number, newPosition: number) => void;
  onMarkerAdd: (position: number) => void;
  onMarkerRemove: (markerIndex: number) => void;
}

const AMPLITUDE_CHARS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

export const WaveformDisplay: React.FC<WaveformDisplayProps> = ({
  file,
  width,
  selectedMarker,
  onMarkerMove,
  onMarkerAdd,
  onMarkerRemove
}) => {
  if (!file) {
    return (
      <div className="waveform-display">
        <div className="waveform-container">
          <div className="waveform-border">
            ┌{'─'.repeat(width - 2)}┐
          </div>
          <div className="waveform-empty">
            │{' '.repeat(width - 2)}│
          </div>
          <div className="waveform-border">
            └{'─'.repeat(width - 2)}┘
          </div>
        </div>
        <div className="status">No file loaded</div>
      </div>
    );
  }

  const generateWaveform = (): string => {
    const samples = file.buffer[0]; // Use first channel for display
    const samplesPerChar = Math.floor(samples.length / (width - 2));
    let waveform = '';

    for (let i = 0; i < width - 2; i++) {
      const startSample = i * samplesPerChar;
      const endSample = Math.min(startSample + samplesPerChar, samples.length);
      
      let maxAmplitude = 0;
      for (let j = startSample; j < endSample; j++) {
        maxAmplitude = Math.max(maxAmplitude, Math.abs(samples[j]));
      }
      
      const charIndex = Math.min(
        Math.floor(maxAmplitude * AMPLITUDE_CHARS.length),
        AMPLITUDE_CHARS.length - 1
      );
      waveform += AMPLITUDE_CHARS[charIndex];
    }

    return waveform;
  };

  const generateMarkers = (): string => {
    const markers = ' '.repeat(width - 2);
    const markerArray = markers.split('');
    
    file.slices.forEach((slice, index) => {
      const position = Math.floor((slice.startSec / file.duration) * (width - 2));
      if (position >= 0 && position < width - 2) {
        markerArray[position] = index === selectedMarker ? '▲' : '^';
      }
    });
    
    return markerArray.join('');
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (!file) return;

    switch (event.key) {
      case 'Enter':
        // Add marker at current cursor position
        const cursorPos = 0; // This should be tracked by cursor state
        const timePos = (cursorPos / (width - 2)) * file.duration;
        onMarkerAdd(timePos);
        break;
      case 'ArrowLeft':
        if (event.shiftKey && selectedMarker >= 0) {
          // Move selected marker left
          const currentPos = file.slices[selectedMarker].startSec;
          const newPos = Math.max(0, currentPos - 0.01);
          onMarkerMove(selectedMarker, newPos);
        }
        break;
      case 'ArrowRight':
        if (event.shiftKey && selectedMarker >= 0) {
          // Move selected marker right
          const currentPos = file.slices[selectedMarker].startSec;
          const newPos = Math.min(file.duration, currentPos + 0.01);
          onMarkerMove(selectedMarker, newPos);
        }
        break;
      case 'Delete':
        if (selectedMarker >= 0) {
          onMarkerRemove(selectedMarker);
        }
        break;
    }
  };

  const waveform = generateWaveform();
  const markers = generateMarkers();

  return (
    <div 
      className="waveform-display"
      tabIndex={0}
      onKeyDown={handleKeyPress}
    >
      <div className="file-info">
        File: {file.name} [slice markers: {file.slices.map((_, i) => i === selectedMarker ? '▲' : '|').join('  ')}]
      </div>
      
      <div className="waveform-container">
        <div className="waveform-title">Waveform:</div>
        <div className="waveform-border">
          ┌{'─'.repeat(width - 2)}┐
        </div>
        <div className="waveform-line">
          1: {waveform}
        </div>
        <div className="marker-line">
          {'   ' + markers}  {/* Offset for line number */}
        </div>
        <div className="waveform-border">
          └{'─'.repeat(width - 2)}┘
        </div>
      </div>

      <div className="cursor-info">
        Cursor: row 04  col SL:03  (press ENTER to place marker / SHIFT+←→ move marker)
      </div>
    </div>
  );
};