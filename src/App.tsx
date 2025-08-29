import { useState, useEffect, useRef } from 'react'
import './App.css'

interface RowData {
  sl: number   // slice
  p: number    // play
  nn: number   // note
  dt: number   // delta
  gt: number   // gate
  rt: number   // retrig
  ts: number   // timestretch
  r: number    // reverse
  co: number   // ???
  ve: number   // ???
  fi: number   // file
}

interface SliceMarker {
  position: number // 0-1 normalized position in sample
  sample: number   // actual sample position
}

function App() {
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  const [currentSample, setCurrentSample] = useState<AudioBuffer | null>(null)
  const [sliceMarkers, setSliceMarkers] = useState<SliceMarker[]>([])
  const [currentFileName, setCurrentFileName] = useState<string>('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [playhead, setPlayhead] = useState(0)
  const [cursor, setCursor] = useState({ row: 0, col: 0 })
  const [bpm, setBpm] = useState(140)
  const [phraseLength] = useState(16)
  const [showFileBrowser, setShowFileBrowser] = useState(false)
  const [selectedSliceMarker, setSelectedSliceMarker] = useState(0)
  const [view, setView] = useState<'pattern' | 'waveform'>('pattern')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const playIntervalRef = useRef<number | null>(null)
  const [keysPressed, setKeysPressed] = useState<Set<string>>(new Set())
  const activeSources = useRef<AudioBufferSourceNode[]>([]) // Track active audio sources
  
  const columns = ['sl', 'p', 'nn', 'dt', 'gt', 'rt', 'ts', 'r', 'co', 've', 'fi']
  
  const [rows, setRows] = useState<RowData[]>(() => 
    Array(16).fill(null).map(() => ({
      sl: 0,
      p: 0,
      nn: 0,    // Pitch: 0 = no change, -12 to +12 semitones
      dt: 0,    // Delta ticks: micro-timing
      gt: 16,   // Gate: default to 16 ticks (1 row)
      rt: 0,    // Retrig: 0 = no retrigger
      ts: 128,  // Timestretch: 128 = 1.0x (middle value)
      r: 0,     // Reverse: 0 = normal
      co: 64,   // Cutoff: 64 = middle frequency
      ve: 100,  // Volume: 100 = ~80% volume
      fi: 0     // File index: 0 = first file
    }))
  )

  useEffect(() => {
    const initAudio = async () => {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
        setAudioContext(ctx)
      } catch (error) {
        console.error('Failed to initialize audio context:', error)
      }
    }
    initAudio()
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent key repeat for certain keys
      if (e.repeat && [' ', 'Enter'].includes(e.key)) {
        return
      }
      // Handle file browser toggle (Shift+R) - works in any view
      if (e.shiftKey && (e.key === 'R' || e.key === 'r')) {
        e.preventDefault()
        setShowFileBrowser(prev => !prev)
        return
      }

      // Handle view switching (Tab) - only when not in file browser
      if (e.key === 'Tab' && !showFileBrowser) {
        e.preventDefault()
        setView(prev => prev === 'pattern' ? 'waveform' : 'pattern')
        return
      }

      // If in file browser, only allow specific keys
      if (showFileBrowser) {
        if (e.key === 'l' || e.key === 'L') {
          loadFile()
        }
        return
      }

      // In waveform view, handle slice editing
      if (view === 'waveform') {
        switch(e.key) {
          case 'ArrowLeft':
            e.preventDefault()
            if (e.shiftKey) {
              moveSliceMarker(-1)
            } else {
              setSelectedSliceMarker(Math.max(0, selectedSliceMarker - 1))
            }
            break
          case 'ArrowRight':
            e.preventDefault()
            if (e.shiftKey) {
              moveSliceMarker(1)
            } else {
              setSelectedSliceMarker(Math.min(sliceMarkers.length - 1, selectedSliceMarker + 1))
            }
            break
          case 'Enter':
            e.preventDefault()
            // Test play the selected slice
            testPlaySlice(selectedSliceMarker)
            break
          case ' ':
            e.preventDefault()
            // In waveform view, space only tests current slice (no global play/stop)
            testPlaySlice(selectedSliceMarker)
            break
          case 'Delete':
            e.preventDefault()
            removeSliceMarker()
            break
          case 's':
          case 'S':
            autoSlice()
            break
          case '+':
            e.preventDefault()
            addSliceMarker()
            break
        }
        return
      }

      // Pattern view controls
      switch(e.key) {
        case ' ':
          e.preventDefault()
          // Global play/stop - always works consistently 
          if (isPlaying) {
            stop()
          } else {
            play()
          }
          break
        case 'l':
        case 'L':
          loadFile()
          break
        case 's':
        case 'S':
          autoSlice()
          break
        case 'ArrowUp':
          e.preventDefault()
          moveCursor(-1, 0)
          break
        case 'ArrowDown':
          e.preventDefault()
          moveCursor(1, 0)
          break
        case 'ArrowLeft':
          e.preventDefault()
          moveCursor(0, -1)
          break
        case 'ArrowRight':
          e.preventDefault()
          moveCursor(0, 1)
          break
        case '+':
        case '=':
          e.preventDefault()
          adjustCurrentValue(1)
          break
        case '-':
        case '_':
          e.preventDefault()
          adjustCurrentValue(-1)
          break
        case 'p':
        case 'P':
          if (e.ctrlKey) break
          toggleRowPlay()
          break
        case 'r':
        case 'R':
          if (e.ctrlKey) break
          toggleReverse()
          break
        case 'b':
        case 'B':
          e.preventDefault()
          adjustBPM(e.shiftKey ? -1 : 1)
          break
        default:
          if (e.key >= '0' && e.key <= '9') {
            setValue(parseInt(e.key))
          } else if (e.key.toUpperCase() >= 'A' && e.key.toUpperCase() <= 'F') {
            setValue(10 + (e.key.toUpperCase().charCodeAt(0) - 65))
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [cursor, rows, view, showFileBrowser, selectedSliceMarker, sliceMarkers.length])

  const moveCursor = (dRow: number, dCol: number) => {
    setCursor(prev => ({
      row: Math.max(0, Math.min(phraseLength - 1, prev.row + dRow)),
      col: Math.max(0, Math.min(columns.length - 1, prev.col + dCol))
    }))
  }

  const setValue = (value: number) => {
    const col = columns[cursor.col] as keyof RowData
    setRows(prev => {
      const newRows = [...prev]
      const row = { ...newRows[cursor.row] }
      
      if (col === 'sl' && value < 16) {
        row.sl = value
      } else if (col === 'p') {
        row.p = value > 0 ? 1 : 0
      } else if (col === 'r') {
        row.r = value > 0 ? 1 : 0
      } else {
        (row as any)[col] = value
      }
      
      newRows[cursor.row] = row
      return newRows
    })
  }

  const adjustCurrentValue = (delta: number) => {
    const col = columns[cursor.col] as keyof RowData
    const currentValue = rows[cursor.row][col] as number
    
    setRows(prev => {
      const newRows = [...prev]
      const row = { ...newRows[cursor.row] }
      
      switch (col) {
        case 'sl':
          row.sl = Math.max(0, Math.min(15, currentValue + delta))
          break
        case 'p':
          row.p = currentValue === 0 ? 1 : 0
          break
        case 'nn': // Note/Pitch: -12 to +12 semitones
          row.nn = Math.max(-12, Math.min(12, currentValue + delta))
          break
        case 'dt': // Delta ticks: 0-255
          row.dt = Math.max(0, Math.min(255, currentValue + delta))
          break
        case 'gt': // Gate: 1-255 rows
          row.gt = Math.max(1, Math.min(255, currentValue + delta))
          break
        case 'rt': // Retrig: 0-15
          row.rt = Math.max(0, Math.min(15, currentValue + delta))
          break
        case 'ts': // Timestretch: 0-255 (will map to 0.1x - 4.0x)
          row.ts = Math.max(0, Math.min(255, currentValue + delta))
          break
        case 'r':
          row.r = currentValue === 0 ? 1 : 0
          break
        case 'co': // Let's make this cutoff frequency: 0-127
          row.co = Math.max(0, Math.min(127, currentValue + delta))
          break
        case 've': // Volume/Velocity: 0-127
          row.ve = Math.max(0, Math.min(127, currentValue + delta))
          break
        case 'fi': // File index: 0-15
          row.fi = Math.max(0, Math.min(15, currentValue + delta))
          break
      }
      
      newRows[cursor.row] = row
      return newRows
    })
  }

  const adjustBPM = (delta: number) => {
    setBpm(prev => Math.max(60, Math.min(200, prev + delta)))
  }

  const toggleRowPlay = () => {
    setRows(prev => {
      const newRows = [...prev]
      newRows[cursor.row] = { ...newRows[cursor.row], p: newRows[cursor.row].p ? 0 : 1 }
      return newRows
    })
  }

  const toggleReverse = () => {
    setRows(prev => {
      const newRows = [...prev]
      newRows[cursor.row] = { ...newRows[cursor.row], r: newRows[cursor.row].r ? 0 : 1 }
      return newRows
    })
  }

  const loadFile = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    console.log('Loading file:', file.name)
    
    try {
      if (!audioContext) {
        console.error('Audio context not initialized')
        return
      }

      const arrayBuffer = await file.arrayBuffer()
      console.log('File loaded, decoding audio...')
      
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      
      console.log('Audio decoded:', {
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels,
        length: audioBuffer.length
      })
      
      setCurrentSample(audioBuffer)
      setCurrentFileName(file.name)
      
      // Auto slice when sample is loaded
      console.log('Starting auto-slice...')
      autoSliceFromBuffer(audioBuffer)
      
      // Close file browser after successful load
      setShowFileBrowser(false)
      
    } catch (error) {
      console.error('Load failed:', error)
    }
  }

  // Improved transient detection based on peak-valley analysis
  const autoSliceFromBuffer = (buffer: AudioBuffer) => {
    const channelData = buffer.getChannelData(0)
    const sampleRate = buffer.sampleRate
    const sectionSize = Math.floor(sampleRate * 0.012) // 12ms sections
    const minSliceDistance = Math.floor(sampleRate * 0.1) // 100ms minimum between slices  
    const valleyPeakRatio = 2.5 // Peak must be 2.5x valley (less sensitive)
    
    const markers: SliceMarker[] = []
    
    // Always start with a marker at the beginning
    markers.push({
      position: 0,
      sample: 0
    })
    
    // Step 1: Divide signal into 12ms sections and find max values
    const sectionMaxes: Array<{value: number, position: number}> = []
    
    for (let i = 0; i < channelData.length; i += sectionSize) {
      const endIndex = Math.min(i + sectionSize, channelData.length)
      let maxValue = 0
      let maxPosition = i
      
      for (let j = i; j < endIndex; j++) {
        const absValue = Math.abs(channelData[j])
        if (absValue > maxValue) {
          maxValue = absValue
          maxPosition = j
        }
      }
      
      sectionMaxes.push({value: maxValue, position: maxPosition})
    }
    
    // Step 2: Find peaks and valleys in the max value envelope
    for (let i = 1; i < sectionMaxes.length - 1; i++) {
      const prev = sectionMaxes[i - 1]
      const current = sectionMaxes[i]
      const next = sectionMaxes[i + 1]
      
      // Look for valley-to-peak transitions
      const isValley = prev.value > current.value && next.value > current.value
      const isPeak = prev.value < current.value && next.value < current.value
      
      if (isPeak) {
        // Look back for the preceding valley
        let valleyValue = current.value
        let valleyIndex = i
        
        for (let j = i - 1; j >= 0 && j > i - 5; j--) {
          if (sectionMaxes[j].value < valleyValue) {
            valleyValue = sectionMaxes[j].value
            valleyIndex = j
          }
        }
        
        // Check if peak/valley ratio meets threshold
        const ratio = current.value / (valleyValue + 0.001) // Add small value to avoid division by zero
        
        if (ratio >= valleyPeakRatio) {
          const transientPosition = sectionMaxes[valleyIndex].position
          
          // Check minimum distance from last marker
          const lastMarkerSample = markers[markers.length - 1]?.sample || 0
          
          if (transientPosition - lastMarkerSample > minSliceDistance && markers.length < 16) {
            // Refine transient position with higher resolution (1ms)
            const refinedPosition = refineTransientPosition(
              channelData, 
              transientPosition, 
              Math.floor(sampleRate * 0.001) // 1ms resolution
            )
            
            markers.push({
              position: refinedPosition / channelData.length,
              sample: refinedPosition
            })
          }
        }
      }
    }
    
    console.log(`Detected ${markers.length - 1} transients`)
    setSliceMarkers(markers)
  }
  
  // Refine transient position with higher resolution
  const refineTransientPosition = (channelData: Float32Array, roughPosition: number, resolution: number): number => {
    const searchStart = Math.max(0, roughPosition - resolution * 5)
    const searchEnd = Math.min(channelData.length, roughPosition + resolution * 2)
    
    let maxEnergy = 0
    let bestPosition = roughPosition
    
    for (let i = searchStart; i < searchEnd; i += resolution) {
      const endIndex = Math.min(i + resolution, channelData.length)
      let energy = 0
      
      for (let j = i; j < endIndex; j++) {
        energy += channelData[j] * channelData[j]
      }
      
      if (energy > maxEnergy) {
        maxEnergy = energy
        bestPosition = i
      }
    }
    
    return bestPosition
  }

  const autoSlice = () => {
    if (currentSample) {
      autoSliceFromBuffer(currentSample)
    }
  }

  const togglePlayback = async () => {
    if (isPlaying) {
      stop()
    } else {
      play()
    }
  }

  // Manual slice editing functions
  const moveSliceMarker = (direction: number) => {
    if (!currentSample || selectedSliceMarker >= sliceMarkers.length) return
    
    const marker = sliceMarkers[selectedSliceMarker]
    const sampleRate = currentSample.sampleRate
    const moveAmount = Math.floor(sampleRate * 0.01) // 10ms jumps
    
    const newSample = Math.max(0, Math.min(
      currentSample.length - 1,
      marker.sample + (direction * moveAmount)
    ))
    
    const newMarkers = [...sliceMarkers]
    newMarkers[selectedSliceMarker] = {
      position: newSample / currentSample.length,
      sample: newSample
    }
    
    setSliceMarkers(newMarkers.sort((a, b) => a.sample - b.sample))
  }

  const addSliceMarker = () => {
    if (!currentSample || sliceMarkers.length >= 16) return
    
    // Add marker at 50% position or after current selected marker
    let newSample: number
    if (selectedSliceMarker < sliceMarkers.length - 1) {
      const current = sliceMarkers[selectedSliceMarker]
      const next = sliceMarkers[selectedSliceMarker + 1]
      newSample = Math.floor((current.sample + next.sample) / 2)
    } else {
      newSample = Math.floor(currentSample.length * 0.5)
    }
    
    const newMarker: SliceMarker = {
      position: newSample / currentSample.length,
      sample: newSample
    }
    
    const newMarkers = [...sliceMarkers, newMarker].sort((a, b) => a.sample - b.sample)
    setSliceMarkers(newMarkers)
    setSelectedSliceMarker(newMarkers.indexOf(newMarker))
  }

  const removeSliceMarker = () => {
    if (sliceMarkers.length <= 1 || selectedSliceMarker === 0) return // Can't remove first marker
    
    const newMarkers = sliceMarkers.filter((_, i) => i !== selectedSliceMarker)
    setSliceMarkers(newMarkers)
    setSelectedSliceMarker(Math.max(0, selectedSliceMarker - 1))
  }

  const play = async () => {
    if (!currentSample || !audioContext) return
    
    try {
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }
      
      setIsPlaying(true)
      setPlayhead(cursor.row) // Start from current cursor position
      
      const secondsPerRow = 60.0 / (bpm * 4) // 4 rows per beat
      
      playIntervalRef.current = window.setInterval(() => {
        setPlayhead(prev => {
          const newPlayhead = (prev + 1) % phraseLength
          
          // Play the row
          const rowData = rows[newPlayhead]
          if (rowData.p && sliceMarkers.length > rowData.sl) {
            playSliceFromMarkers(rowData.sl, rowData)
          }
          
          return newPlayhead
        })
      }, secondsPerRow * 1000)
      
    } catch (error) {
      console.error('Play failed:', error)
    }
  }

  const stop = () => {
    // Clear interval first
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current)
      playIntervalRef.current = null
    }
    
    // Stop all active audio sources
    activeSources.current.forEach(source => {
      try {
        source.stop()
      } catch (e) {
        // Source might already be stopped
      }
    })
    activeSources.current = []
    
    // Update state
    setIsPlaying(false)
    setPlayhead(0)
    
    console.log('Playback stopped - all sources cleared')
  }

  const playSliceFromMarkers = (sliceIndex: number, rowData?: RowData) => {
    if (!currentSample || !audioContext || sliceIndex >= sliceMarkers.length) {
      console.log('Cannot play slice:', { 
        hasSample: !!currentSample, 
        hasContext: !!audioContext, 
        sliceIndex, 
        totalSlices: sliceMarkers.length 
      })
      return
    }
    
    try {
      // Ensure audio context is running
      if (audioContext.state === 'suspended') {
        audioContext.resume()
      }
      
      const currentMarker = sliceMarkers[sliceIndex]
      const nextMarker = sliceMarkers[sliceIndex + 1]
      
      const startTime = currentMarker.sample / currentSample.sampleRate
      const endTime = nextMarker 
        ? nextMarker.sample / currentSample.sampleRate 
        : currentSample.duration
      
      const source = audioContext.createBufferSource()
      const gain = audioContext.createGain()
      
      source.buffer = currentSample
      
      // Track this source so we can stop it later
      activeSources.current.push(source)
      
      // Remove from tracking when it ends
      source.onended = () => {
        const index = activeSources.current.indexOf(source)
        if (index > -1) {
          activeSources.current.splice(index, 1)
        }
      }
      
      // Apply pitch/note adjustment
      if (rowData && rowData.nn !== 0) {
        const pitchRatio = Math.pow(2, rowData.nn / 12) // Semitone to frequency ratio
        source.playbackRate.value = pitchRatio
      }
      
      // Apply volume
      if (rowData && rowData.ve > 0) {
        const volume = rowData.ve / 127 // Map 0-127 to 0-1
        gain.gain.value = volume
      } else {
        gain.gain.value = 0.8 // Default volume
      }
      
      source.connect(gain)
      gain.connect(audioContext.destination)
      
      const duration = endTime - startTime
      source.start(audioContext.currentTime, startTime, Math.max(0.01, duration))
      
    } catch (error) {
      console.error('Play slice failed:', error)
    }
  }
  
  // Add a test function to play slice on demand
  const testPlaySlice = (sliceIndex: number) => {
    console.log('Test playing slice:', sliceIndex)
    playSliceFromMarkers(sliceIndex)
  }

  const formatHex = (value: number, pad: number = 2): string => {
    return value.toString(16).toUpperCase().padStart(pad, '0')
  }

  const formatValue = (row: RowData, col: string): string => {
    const value = (row as any)[col]
    switch (col) {
      case 'sl': 
        return formatHex(value, 1)
      case 'p': 
        return value.toString()
      case 'nn': // Note/Pitch: show as +/- semitones
        return value === 0 ? '--' : (value > 0 ? `+${value.toString(16).toUpperCase()}` : value.toString(16).toUpperCase())
      case 'dt': // Delta ticks
        return value === 0 ? '--' : formatHex(value, 2)
      case 'gt': // Gate
        return formatHex(value, 2)
      case 'rt': // Retrig
        return value === 0 ? '--' : formatHex(value, 1)
      case 'ts': // Timestretch: show as factor
        if (value === 0) return '--'
        const factor = 0.1 + (value / 255) * 3.9 // Map 0-255 to 0.1-4.0
        return factor.toFixed(1).substring(0, 3) // Show as "1.0", "2.5", etc
      case 'r': 
        return value.toString()
      case 'co': // Cutoff frequency
        return value === 0 ? '--' : formatHex(value, 2)
      case 've': // Volume/Velocity
        return value === 0 ? '--' : formatHex(value, 2)
      case 'fi': // File index
        return value === 0 ? '--' : formatHex(value, 1)
      default: 
        return value.toString()
    }
  }

  const getCurrentValue = () => {
    const col = columns[cursor.col] as keyof RowData
    return rows[cursor.row][col]
  }

  const generateWaveform = (): string => {
    if (!currentSample) return ' '.repeat(60)
    
    const channelData = currentSample.getChannelData(0)
    const width = 60
    const samplesPerChar = Math.floor(channelData.length / width)
    const chars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']
    
    let waveform = ''
    for (let i = 0; i < width; i++) {
      const startSample = i * samplesPerChar
      const endSample = Math.min(startSample + samplesPerChar, channelData.length)
      
      let maxAmplitude = 0
      for (let j = startSample; j < endSample; j++) {
        maxAmplitude = Math.max(maxAmplitude, Math.abs(channelData[j]))
      }
      
      const charIndex = Math.min(Math.floor(maxAmplitude * chars.length), chars.length - 1)
      waveform += chars[charIndex]
    }
    
    return waveform
  }

  const generateSliceMarkers = (): string => {
    if (!currentSample || sliceMarkers.length === 0) return ' '.repeat(60)
    
    const width = 60
    const markers = ' '.repeat(width).split('')
    
    sliceMarkers.forEach((marker, index) => {
      const position = Math.floor(marker.position * width)
      if (position < width) {
        markers[position] = index === selectedSliceMarker ? '▲' : '^'
      }
    })
    
    return markers.join('')
  }

  const renderWaveformView = () => (
    <div className="pattern-view">
      <div className="pattern-header">
        <span>File: {currentFileName || 'No file loaded'}</span>
      </div>
      
      <div style={{marginBottom: '10px'}}>
        <div>Waveform:</div>
        <div style={{fontFamily: 'monospace'}}>
          ┌{'─'.repeat(60)}┐
        </div>
        <div style={{fontFamily: 'monospace'}}>
          │{generateWaveform()}│
        </div>
        <div style={{fontFamily: 'monospace', opacity: 0.7}}>
          {' ' + generateSliceMarkers()}
        </div>
        <div style={{fontFamily: 'monospace'}}>
          └{'─'.repeat(60)}┘
        </div>
      </div>
      
      <div style={{opacity: 0.6, fontSize: '11px'}}>
        Slices: {sliceMarkers.length} | Selected: {selectedSliceMarker}
        <br />
        ←→: select slice | Shift+←→: move marker | SPACE/Enter: test play | +: add | Del: remove | S: auto-slice
      </div>
    </div>
  )

  const renderFileBrowser = () => (
    <div className="pattern-view">
      <div className="pattern-header">
        <span>FILE BROWSER</span>
      </div>
      
      <div style={{padding: '20px', textAlign: 'center'}}>
        <div>Press L to load file, or click below:</div>
        <br />
        <button 
          onClick={loadFile}
          style={{
            background: 'transparent',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.3)',
            padding: '5px 15px',
            fontFamily: 'monospace',
            cursor: 'pointer'
          }}
        >
          Load Audio File
        </button>
        <br /><br />
        {currentFileName && (
          <div>
            Loaded: {currentFileName}
            <br />
            Slices: {sliceMarkers.length}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="terminal">
      <div className="header">
        <span>BREAKFORGE</span>
        <span>BPM:{bpm} | VIEW:{view.toUpperCase()} | PHRASE:01</span>
      </div>
      
      {showFileBrowser ? renderFileBrowser() : 
       view === 'waveform' ? renderWaveformView() : (
        <div className="pattern-view">
          <div className="pattern-header">
            <span></span>
            <span style={{marginLeft: '10px'}}>SL P  NN DT GT RT TS R  CO VE FI</span>
          </div>
          
          <div className="pattern-rows">
            {rows.map((row, i) => (
              <div 
                key={i} 
                className={`row ${i === cursor.row ? 'current-row' : ''} ${i === playhead && isPlaying ? 'playing-row' : ''}`}
              >
                <div className="row-number">
                  {formatHex(i, 2)}
                </div>
                <div className="row-data">
                  {columns.map((col, j) => (
                    <span 
                      key={col}
                      className={i === cursor.row && j === cursor.col ? 'cursor' : ''}
                    >
                      {formatValue(row, col)}{j < columns.length - 1 ? ' ' : ''}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="footer">
        <div className="status-line">
          <span>Current value: {getCurrentValue()}</span>
          <span>{isPlaying ? `Chain playing (C:05 P:01) (SPACE to stop)` : `Chain stopped`}</span>
          <span>Shift+R: File browser | TAB: Waveform</span>
        </div>
        <div className="controls">
          SPACE: play/stop | L: load | S: slice | ↑↓←→: navigate | 0-F: direct | +/-: adjust | P: play | R: reverse | B: BPM±1
          <br />
          NN: pitch ±12 semitones | VE: volume 0-7F | GT: gate | RT: retrig | TS: timestretch | CO: cutoff
        </div>
      </div>
      
      <input 
        type="file" 
        ref={fileInputRef}
        accept=".wav,.mp3,.m4a,.aac,.ogg" 
        onChange={handleFileChange}
      />
    </div>
  )
}

export default App
