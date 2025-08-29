import React from 'react';
import type { Phrase, Row } from '../types';

interface TrackerGridProps {
  phrase: Phrase;
  currentRow: number;
  currentCol: string;
  playheadRow: number;
  onRowChange: (trackIndex: number, rowIndex: number, field: keyof Row, value: any) => void;
  onCursorMove: (row: number, col: string) => void;
}

const COLUMN_HEADERS = ['Row', 'SL', 'P', 'NN', 'DT', 'GT', 'RT', 'OF', 'PA', 'TS', 'RS', 'FI'];
const COLUMN_KEYS = ['row', 'slice', 'play', 'transpose', 'deltaTicks', 'gateRows', 'retrig', 'offsetMs', 'pan', 'timestretch', 'reverse', 'fileIndex'] as const;

export const TrackerGrid: React.FC<TrackerGridProps> = ({
  phrase,
  currentRow,
  currentCol,
  playheadRow,
  onRowChange,
  onCursorMove
}) => {
  const formatValue = (row: Row, field: keyof Row): string => {
    const value = row[field];
    
    switch (field) {
      case 'slice':
        return value.toString().padStart(2, '0');
      case 'play':
        return value ? '1' : '0';
      case 'transpose':
        return (value as number) === 0 ? '--' : ((value as number) > 0 ? `+${value}` : value.toString());
      case 'deltaTicks':
        return value.toString();
      case 'gateRows':
        return value.toString();
      case 'retrig':
        return value.toString();
      case 'offsetMs':
        return (value as number) === 0 ? '+0' : ((value as number) > 0 ? `+${value}` : value.toString());
      case 'pan':
        return value.toString();
      case 'timestretch':
        return (value as number).toFixed(1);
      case 'reverse':
        return value ? '1' : '0';
      case 'fileIndex':
        return value.toString();
      default:
        return value.toString();
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    const track = phrase.tracks[0]; // For now, work with first track
    if (!track) return;

    const currentRowData = track.rows[currentRow];
    if (!currentRowData) return;

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        onCursorMove(Math.max(0, currentRow - 1), currentCol);
        break;
      case 'ArrowDown':
        event.preventDefault();
        onCursorMove(Math.min(phrase.rows - 1, currentRow + 1), currentCol);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        const currentColIndex = COLUMN_KEYS.indexOf(currentCol as any);
        if (currentColIndex > 0) {
          onCursorMove(currentRow, COLUMN_KEYS[currentColIndex - 1]);
        }
        break;
      case 'ArrowRight':
        event.preventDefault();
        const nextColIndex = COLUMN_KEYS.indexOf(currentCol as any);
        if (nextColIndex < COLUMN_KEYS.length - 1) {
          onCursorMove(currentRow, COLUMN_KEYS[nextColIndex + 1]);
        }
        break;
      case 'p':
      case 'P':
        onRowChange(0, currentRow, 'play', !currentRowData.play);
        break;
      case 'r':
      case 'R':
        onRowChange(0, currentRow, 'reverse', !currentRowData.reverse);
        break;
      case '+':
        if (currentCol === 'transpose') {
          onRowChange(0, currentRow, 'transpose', currentRowData.transpose + 1);
        } else if (currentCol === 'timestretch') {
          onRowChange(0, currentRow, 'timestretch', Math.min(4.0, currentRowData.timestretch + 0.1));
        }
        break;
      case '-':
        if (currentCol === 'transpose') {
          onRowChange(0, currentRow, 'transpose', currentRowData.transpose - 1);
        } else if (currentCol === 'timestretch') {
          onRowChange(0, currentRow, 'timestretch', Math.max(0.1, currentRowData.timestretch - 0.1));
        }
        break;
      default:
        // Handle number input for slice selection
        if (event.key >= '0' && event.key <= '9' && currentCol === 'slice') {
          const sliceNum = parseInt(event.key);
          onRowChange(0, currentRow, 'slice', sliceNum);
        }
        break;
    }
  };

  const renderRow = (rowIndex: number) => {
    const track = phrase.tracks[0]; // For now, work with first track
    if (!track || !track.rows[rowIndex]) return null;
    
    const row = track.rows[rowIndex];
    const isCurrentRow = rowIndex === currentRow;
    const isPlayheadRow = rowIndex === playheadRow;
    
    const rowNumber = (rowIndex + 1).toString().padStart(2, '0');
    
    return (
      <div 
        key={rowIndex} 
        className={`tracker-row ${isCurrentRow ? 'current' : ''} ${isPlayheadRow ? 'playhead' : ''}`}
      >
        <span className="row-number">{rowNumber}</span>
        <span className={`cell ${currentCol === 'slice' && isCurrentRow ? 'cursor' : ''}`}>
          {formatValue(row, 'slice')}
        </span>
        <span className={`cell ${currentCol === 'play' && isCurrentRow ? 'cursor' : ''}`}>
          {formatValue(row, 'play')}
        </span>
        <span className={`cell ${currentCol === 'transpose' && isCurrentRow ? 'cursor' : ''}`}>
          {formatValue(row, 'transpose')}
        </span>
        <span className={`cell ${currentCol === 'deltaTicks' && isCurrentRow ? 'cursor' : ''}`}>
          {formatValue(row, 'deltaTicks')}
        </span>
        <span className={`cell ${currentCol === 'gateRows' && isCurrentRow ? 'cursor' : ''}`}>
          {formatValue(row, 'gateRows')}
        </span>
        <span className={`cell ${currentCol === 'retrig' && isCurrentRow ? 'cursor' : ''}`}>
          {formatValue(row, 'retrig')}
        </span>
        <span className={`cell ${currentCol === 'offsetMs' && isCurrentRow ? 'cursor' : ''}`}>
          {formatValue(row, 'offsetMs')}
        </span>
        <span className={`cell ${currentCol === 'pan' && isCurrentRow ? 'cursor' : ''}`}>
          {formatValue(row, 'pan')}
        </span>
        <span className={`cell ${currentCol === 'timestretch' && isCurrentRow ? 'cursor' : ''}`}>
          {formatValue(row, 'timestretch')}
        </span>
        <span className={`cell ${currentCol === 'reverse' && isCurrentRow ? 'cursor' : ''}`}>
          {formatValue(row, 'reverse')}
        </span>
        <span className={`cell ${currentCol === 'fileIndex' && isCurrentRow ? 'cursor' : ''}`}>
          {formatValue(row, 'fileIndex')}
        </span>
        {isCurrentRow && <span className="cursor-indicator">  {'<-- cursor here'}</span>}
      </div>
    );
  };

  return (
    <div 
      className="tracker-grid"
      tabIndex={0}
      onKeyDown={handleKeyPress}
    >
      <div className="phrase-header">
        Phrase: {phrase.name}  ({phrase.rows} rows)
      </div>
      
      <div className="column-headers">
        {COLUMN_HEADERS.map((header, index) => (
          <span key={index} className="column-header">{header}</span>
        ))}
      </div>
      
      <div className="grid-rows">
        {Array.from({ length: phrase.rows }, (_, i) => renderRow(i))}
      </div>
    </div>
  );
};