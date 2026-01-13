# BreakForge - ASCII Drum Tracker

A modern web based drum tracker inspired by classic amiga trackers, built with React, TypeScript, and Web Audio API. Features ASCII waveform display, sample accurate scheduling, and granular timestretch.

## Features

- **Terminal UI**: Keyboard only navigation with ASCII waveform display
- **Sample loading & auto-slicing**: Transient detection with manual adjustment
- **Pattern sequencing**: 8 tracks × 16 rows with extensive per-step parameters
- **Sample-accurate scheduling**: AudioWorklet-based engine with lookahead
- **Granular timestretch**: Real-time stretch without pitch shift
- **Voice pooling**: Efficient voice management with ADSR envelopes
- **Multiple views**: Song, Chain, Phrase, Browser, Mixer, Settings

## Quick Start

1. **Install dependencies:**
   ```bash
   cd breakforge
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Open in browser:** Navigate to http://localhost:5173

## UI Layout

```
BreakForge - Track 0  | bpm: 140 | rows/beat:4 | phrase: A (16 rows)
File: jungle_break_01.wav   [slice markers: |  |   |    |  |  ]
Waveform:
   ┌────────────────────────────────────────────────────────────┐
1: ▂▁▂▁▂▃▂▁▁▁▂▃▂▁▂▁▁▂▁▂▁▂▃▂▁▂▁▁▂▁▂▁▂▁▂▁▂▁
             ^    ^       ^  ^    ^     ^     ^  <--- slice markers
   └────────────────────────────────────────────────────────────┘

Phrase: A  (16 rows)
Row  SL  P  NN  DT  GT  RT  OF  PA  TS  RS  FI
01   00  1  --  0   2   0   +0  0   0.8  0   0
02   02  1  --  0   2   0   +0  0   1.0  0   0
03   05  1  --  -1  1   3   -5  0   1.0  1   0
04   00  1  --  0   4   0   +3  -5  1.2  0   0   <-- cursor here
```

## Key Bindings

### Navigation
- **↑ ↓ ← →**: Move cursor
- **PgUp/PgDn**: Move phrase pages
- **TAB**: Cycle views (Song/Chain/Phrase/Browser/Mixer/Settings)

### Playback
- **Space**: Play/Stop
- **Ctrl+Enter**: Play from top
- **.**: Step-play (advance one row)

### Sample Management
- **L**: Load sample
- **S**: Auto-slice current file
- **Enter**: Assign file to current track (in Browser view)

### Editing
- **P**: Toggle Play flag
- **0-9**: Set slice number
- **+/-**: Transpose up/down, or adjust timestretch
- **R**: Toggle reverse

### Slicing
- **Shift+←/→**: Move selected slice marker
- **Enter**: Add/remove slice marker
- **Delete**: Remove selected marker

## Column Reference

- **SL**: Slice index (0-99)
- **P**: Play flag (0/1)
- **NN**: Note/transposition (-24 to +24 semitones)
- **DT**: Delta ticks (micro-timing offset)
- **GT**: Gate rows (length in rows)
- **RT**: Retrigger count
- **OF**: Offset ms (micro-offset into slice)
- **PA**: Pan (-1.0 to 1.0)
- **TS**: Timestretch factor (0.1 to 4.0)
- **RS**: Reverse flag (0/1)
- **FI**: File index

## Workflow Example

1. **Load a break**: Press TAB → Browser, then L to load a drum break
2. **Auto-slice**: Press S to auto-detect transients
3. **Create pattern**: TAB → Phrase view, use numbers 0-9 to set slice indices
4. **Enable playback**: Press P on rows you want to play
5. **Add groove**: Use OF (offset) and DT (delta ticks) for micro-timing
6. **Add retrigs**: Set RT column for stutter effects
7. **Stretch slices**: Use TS for granular timestretch
8. **Play**: Press Space to start playback

## Architecture

### Audio Engine
- **AudioWorklet**: Sample-accurate processing in audio thread
- **Scheduler**: Main thread schedules events with 100ms lookahead
- **Voice Pool**: 64 voices with ADSR envelopes and granular processing

### Data Flow
1. Main thread computes row timing and sends events to AudioWorklet
2. AudioWorklet queues events and triggers voices sample-accurately
3. Each voice processes audio with granular engine if timestretch ≠ 1.0
4. Voices are mixed and sent to master output

### Granular Engine
- **Grain Size**: 25-80ms for drums, configurable
- **Overlap**: 50-75% overlap between grains
- **Window**: Hann window to prevent clicking
- **Stretch Factor**: Controls hop size ratio for time scaling

## File Structure

```
src/
├── components/          # React components
│   ├── WaveformDisplay.tsx
│   ├── TrackerGrid.tsx
│   ├── TransportControls.tsx
│   └── SampleBrowser.tsx
├── audio/              # Audio engine
│   ├── AudioEngine.ts
│   └── Scheduler.ts
├── types/              # TypeScript definitions
│   └── index.ts
├── App.tsx             # Main application
└── App.css            # ASCII-style theming
public/
└── audioWorklet.js     # AudioWorklet processor
```

## Browser Compatibility

- **Chrome/Edge**: Full support
- **Firefox**: Experimental (AudioWorklet support varies)
- **Safari**: Limited (AudioWorklet availability)

## Development

### Build
```bash
npm run build
```

### Preview
```bash
npm run preview
```

## Performance Tips

- Limit simultaneous voices (default: 64)
- Use smaller grain sizes for better CPU performance
- Pre-load samples before playback
- Monitor CPU usage in complex patterns

## Future Features (Roadmap)

### Phase 1 (Core MVP)
- ✅ Basic scheduling and sample playback
- ✅ Auto-slice and manual slice adjustment
- ✅ Pattern grid editing
- 🔄 Voice pooling optimization

### Phase 2 (Creative Features)  
- 🔄 Advanced granular parameters
- ⏳ Probability column
- ⏳ Chain view for song arrangement
- ⏳ Effects sends (reverb, delay, filter)

### Phase 3 (Production)
- ⏳ Save/load songs (JSON format)
- ⏳ Export to WAV
- ⏳ MIDI input for live recording
- ⏳ Live performance mode

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

---

*Built with the classic tracker aesthetic in mind - where every character counts and the music flows through text.*
