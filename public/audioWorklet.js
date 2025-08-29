class BreakForgeProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    
    this.globalSampleCounter = 0;
    this.eventQueue = [];
    this.voices = Array(64).fill(null).map(() => ({
      active: false,
      startSample: 0,
      readPos: 0,
      playbackMode: 'normal',
      fileId: null,
      sliceId: 0,
      playbackRate: 1.0,
      pan: 0,
      volume: 1.0,
      reverse: false,
      timestretch: 1.0,
      envelope: {
        attack: 0.001,
        decay: 0.1,
        sustain: 0.8,
        release: 0.1,
        stage: 'attack',
        level: 0,
        samplesSinceStart: 0
      },
      sliceBuffer: null,
      sliceLength: 0,
      granular: {
        grainSize: 1024,
        hopIn: 512,
        hopOut: 512,
        windowBuffer: null,
        grains: []
      }
    }));
    
    this.fileBuffers = new Map();
    this.sampleRate = 44100;
    
    this.port.onmessage = this.handleMessage.bind(this);
  }

  handleMessage(event) {
    const { type, data } = event.data;
    
    switch (type) {
      case 'schedule':
        this.eventQueue.push(data.event);
        this.eventQueue.sort((a, b) => a.whenSample - b.whenSample);
        break;
        
      case 'setFileBuffer':
        this.fileBuffers.set(data.fileId, {
          channels: data.channels,
          buffers: data.buffers,
          sampleRate: data.sampleRate,
          slices: data.slices
        });
        break;
        
      case 'setSampleRate':
        this.sampleRate = data.sampleRate;
        break;
        
      case 'stopAll':
        this.voices.forEach(voice => voice.active = false);
        this.eventQueue = [];
        break;
    }
  }

  createWindow(size) {
    const window = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (size - 1))); // Hann window
    }
    return window;
  }

  allocateVoice() {
    for (let i = 0; i < this.voices.length; i++) {
      if (!this.voices[i].active) {
        return i;
      }
    }
    
    // Steal oldest voice
    let oldestIndex = 0;
    let oldestStart = this.voices[0].startSample;
    for (let i = 1; i < this.voices.length; i++) {
      if (this.voices[i].startSample < oldestStart) {
        oldestStart = this.voices[i].startSample;
        oldestIndex = i;
      }
    }
    
    return oldestIndex;
  }

  startVoice(event) {
    const voiceIndex = this.allocateVoice();
    const voice = this.voices[voiceIndex];
    const fileData = this.fileBuffers.get(event.fileId);
    
    if (!fileData) return;
    
    const slice = fileData.slices[event.sliceId];
    if (!slice) return;
    
    voice.active = true;
    voice.startSample = this.globalSampleCounter;
    voice.readPos = slice.startSec * fileData.sampleRate;
    voice.fileId = event.fileId;
    voice.sliceId = event.sliceId;
    voice.playbackRate = event.playbackRate || 1.0;
    voice.pan = event.pan || 0;
    voice.volume = event.volume || 1.0;
    voice.reverse = event.reverse || false;
    voice.timestretch = event.timestretch || 1.0;
    
    // Set up slice buffer
    const startSample = Math.floor(slice.startSec * fileData.sampleRate);
    const endSample = Math.floor(slice.endSec * fileData.sampleRate);
    voice.sliceLength = endSample - startSample;
    
    // Reset envelope
    voice.envelope.stage = 'attack';
    voice.envelope.level = 0;
    voice.envelope.samplesSinceStart = 0;
    
    // Set up granular if needed
    if (voice.timestretch !== 1.0) {
      voice.playbackMode = 'granular';
      voice.granular.grainSize = Math.floor(0.04 * this.sampleRate); // 40ms grains
      voice.granular.hopOut = Math.floor(voice.granular.grainSize * 0.25);
      voice.granular.hopIn = Math.floor(voice.granular.hopOut / voice.timestretch);
      voice.granular.windowBuffer = this.createWindow(voice.granular.grainSize);
      voice.granular.grains = [];
    } else {
      voice.playbackMode = 'normal';
    }
  }

  processVoice(voice, outputs) {
    if (!voice.active) return;
    
    const fileData = this.fileBuffers.get(voice.fileId);
    if (!fileData) {
      voice.active = false;
      return;
    }
    
    const outputL = outputs[0][0];
    const outputR = outputs[0][1];
    const frameCount = outputL.length;
    
    for (let frame = 0; frame < frameCount; frame++) {
      // Update envelope
      this.updateEnvelope(voice);
      
      let sampleL = 0, sampleR = 0;
      
      if (voice.playbackMode === 'normal') {
        // Normal playback
        const readIndex = Math.floor(voice.readPos);
        if (readIndex >= 0 && readIndex < fileData.buffers[0].length) {
          sampleL = fileData.buffers[0][readIndex] * voice.envelope.level;
          if (fileData.channels > 1) {
            sampleR = fileData.buffers[1][readIndex] * voice.envelope.level;
          } else {
            sampleR = sampleL;
          }
          
          voice.readPos += voice.playbackRate * (voice.reverse ? -1 : 1);
        } else {
          voice.active = false;
          break;
        }
      } else {
        // Granular playback - simplified version
        // This is a basic implementation, full granular would be more complex
        const readIndex = Math.floor(voice.readPos);
        if (readIndex >= 0 && readIndex < fileData.buffers[0].length) {
          sampleL = fileData.buffers[0][readIndex] * voice.envelope.level;
          if (fileData.channels > 1) {
            sampleR = fileData.buffers[1][readIndex] * voice.envelope.level;
          } else {
            sampleR = sampleL;
          }
          
          voice.readPos += voice.playbackRate * (voice.reverse ? -1 : 1) / voice.timestretch;
        } else {
          voice.active = false;
          break;
        }
      }
      
      // Apply panning
      const panL = Math.cos((voice.pan + 1) * Math.PI / 4);
      const panR = Math.sin((voice.pan + 1) * Math.PI / 4);
      
      outputL[frame] += sampleL * panL * voice.volume;
      outputR[frame] += sampleR * panR * voice.volume;
    }
  }

  updateEnvelope(voice) {
    const env = voice.envelope;
    const attackSamples = Math.floor(env.attack * this.sampleRate);
    const decaySamples = Math.floor(env.decay * this.sampleRate);
    const releaseSamples = Math.floor(env.release * this.sampleRate);
    
    env.samplesSinceStart++;
    
    switch (env.stage) {
      case 'attack':
        env.level = env.samplesSinceStart / attackSamples;
        if (env.samplesSinceStart >= attackSamples) {
          env.stage = 'decay';
        }
        break;
        
      case 'decay':
        const decayProgress = (env.samplesSinceStart - attackSamples) / decaySamples;
        env.level = 1.0 - decayProgress * (1.0 - env.sustain);
        if (env.samplesSinceStart >= attackSamples + decaySamples) {
          env.stage = 'sustain';
          env.level = env.sustain;
        }
        break;
        
      case 'sustain':
        env.level = env.sustain;
        break;
        
      case 'release':
        const releaseProgress = (env.samplesSinceStart - attackSamples - decaySamples) / releaseSamples;
        env.level = env.sustain * (1.0 - releaseProgress);
        if (releaseProgress >= 1.0) {
          voice.active = false;
        }
        break;
    }
    
    env.level = Math.max(0, Math.min(1, env.level));
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const frameCount = output[0].length;
    
    // Clear output
    for (let channel = 0; channel < output.length; channel++) {
      output[channel].fill(0);
    }
    
    // Process scheduled events
    while (this.eventQueue.length > 0 && 
           this.eventQueue[0].whenSample <= this.globalSampleCounter + frameCount) {
      const event = this.eventQueue.shift();
      this.startVoice(event);
    }
    
    // Process active voices
    for (const voice of this.voices) {
      if (voice.active) {
        this.processVoice(voice, outputs);
      }
    }
    
    this.globalSampleCounter += frameCount;
    
    return true;
  }
}

registerProcessor('breakforge-processor', BreakForgeProcessor);