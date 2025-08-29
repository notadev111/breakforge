import React, { useState, useRef } from 'react';
import type { SampleFile, FileID } from '../types';

interface SampleBrowserProps {
  files: Map<FileID, SampleFile>;
  selectedFileId: FileID | null;
  onFileLoad: (file: File) => Promise<void>;
  onFileSelect: (fileId: FileID) => void;
  onFileAssign: (fileId: FileID, trackIndex: number) => void;
  onAutoSlice: (fileId: FileID) => void;
  currentTrack: number;
}

export const SampleBrowser: React.FC<SampleBrowserProps> = ({
  files,
  selectedFileId,
  onFileLoad,
  onFileSelect,
  onFileAssign,
  onAutoSlice,
  currentTrack
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyPress = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'l':
      case 'L':
        event.preventDefault();
        fileInputRef.current?.click();
        break;
      case 'Enter':
        if (selectedFileId) {
          onFileAssign(selectedFileId, currentTrack);
        }
        break;
      case 's':
      case 'S':
        if (selectedFileId) {
          onAutoSlice(selectedFileId);
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        navigateFiles(-1);
        break;
      case 'ArrowDown':
        event.preventDefault();
        navigateFiles(1);
        break;
    }
  };

  const navigateFiles = (direction: number) => {
    const fileIds = Array.from(files.keys());
    if (fileIds.length === 0) return;

    if (!selectedFileId) {
      onFileSelect(fileIds[0]);
      return;
    }

    const currentIndex = fileIds.indexOf(selectedFileId);
    const newIndex = Math.max(0, Math.min(fileIds.length - 1, currentIndex + direction));
    onFileSelect(fileIds[newIndex]);
  };

  const handleFileInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      alert('Please select an audio file');
      return;
    }

    setIsLoading(true);
    try {
      await onFileLoad(file);
    } catch (error) {
      console.error('Error loading file:', error);
      alert('Error loading file');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  // const formatFileSize = (bytes: number): string => {
  //   if (bytes < 1024) return `${bytes} B`;
  //   if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  //   return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  // };

  const selectedFile = selectedFileId ? files.get(selectedFileId) : null;

  return (
    <div 
      className="sample-browser"
      tabIndex={0}
      onKeyDown={handleKeyPress}
    >
      <div className="browser-header">
        <h3>Sample Browser</h3>
        <div className="browser-stats">
          {files.size} files loaded
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileInput}
        style={{ display: 'none' }}
      />

      <div className="browser-controls">
        <button 
          className="browser-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : 'L - Load File'}
        </button>
        
        <button 
          className="browser-btn"
          onClick={() => selectedFileId && onAutoSlice(selectedFileId)}
          disabled={!selectedFileId}
        >
          S - Auto Slice
        </button>

        <button 
          className="browser-btn"
          onClick={() => selectedFileId && onFileAssign(selectedFileId, currentTrack)}
          disabled={!selectedFileId}
        >
          Enter - Assign to Track {currentTrack}
        </button>
      </div>

      <div className="file-list">
        {files.size === 0 ? (
          <div className="empty-state">
            <div>No files loaded</div>
            <div>Press 'L' to load a file</div>
          </div>
        ) : (
          Array.from(files.entries()).map(([fileId, file]) => (
            <div
              key={fileId}
              className={`file-item ${selectedFileId === fileId ? 'selected' : ''}`}
              onClick={() => onFileSelect(fileId)}
            >
              <div className="file-name">{file.name}</div>
              <div className="file-details">
                {formatDuration(file.duration)} | 
                {file.sampleRate}Hz | 
                {file.channels}ch | 
                {file.slices.length} slices
              </div>
            </div>
          ))
        )}
      </div>

      {selectedFile && (
        <div className="file-details-panel">
          <div className="details-header">File Details</div>
          <div className="details-grid">
            <div>Name: {selectedFile.name}</div>
            <div>Duration: {formatDuration(selectedFile.duration)}</div>
            <div>Sample Rate: {selectedFile.sampleRate} Hz</div>
            <div>Channels: {selectedFile.channels}</div>
            <div>Slices: {selectedFile.slices.length}</div>
            {selectedFile.rootNote && (
              <div>Root Note: {selectedFile.rootNote}</div>
            )}
          </div>
          
          {selectedFile.slices.length > 0 && (
            <div className="slices-list">
              <div className="slices-header">Slices:</div>
              {selectedFile.slices.map((slice, index) => (
                <div key={slice.id} className="slice-item">
                  {index.toString().padStart(2, '0')}: {formatDuration(slice.startSec)} - {formatDuration(slice.endSec)}
                  {slice.label && ` (${slice.label})`}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="browser-hints">
        <div>L = Load file, ↑↓ = Navigate, Enter = Assign to track, S = Auto-slice</div>
      </div>
    </div>
  );
};