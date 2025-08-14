/**
 * Guitar Tab Web Player - Audio Synthesis Engine
 * Web Audio API implementation of Karplus-Strong guitar synthesis
 * Based on GuitarTabEditor's GuitarSynthesiser and GuitarVoice classes
 */

class GuitarAudioEngine {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.activeVoices = new Map();
        this.activeOscillators = new Set();
        this.isInitialized = false;
        
        // Standard guitar tuning (MIDI notes): E4, B3, G3, D3, A2, E2
        this.standardTuning = [64, 59, 55, 50, 45, 40];
        
        // String characteristics for realistic guitar behavior (much longer sustain)
        this.stringCharacteristics = [
            { damping: 0.9995, tension: 1.0, pluckPos: 0.3, isWound: false }, // High E
            { damping: 0.9996, tension: 1.0, pluckPos: 0.3, isWound: false }, // B  
            { damping: 0.9997, tension: 1.0, pluckPos: 0.3, isWound: false }, // G
            { damping: 0.9998, tension: 1.0, pluckPos: 0.3, isWound: true },  // D
            { damping: 0.9998, tension: 1.0, pluckPos: 0.3, isWound: true },  // A
            { damping: 0.9999, tension: 1.0, pluckPos: 0.3, isWound: true }   // Low E
        ];
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            // Create audio context
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
            
            // Create master gain
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = 0.3;
            this.masterGain.connect(this.audioContext.destination);
            
            this.isInitialized = true;
            
        } catch (error) {
            console.error('Failed to initialize audio:', error);
            throw error;
        }
    }

    async ensureAudioContext() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        // Resume context if suspended (required for user interaction)
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    /**
     * Convert guitar string and fret to MIDI note number
     */
    noteEventToMidiNote(noteEvent) {
        if (noteEvent.fret < 0 || noteEvent.string < 0 || noteEvent.string >= 6) {
            return -1;
        }
        return this.standardTuning[noteEvent.string] + noteEvent.fret;
    }

    /**
     * Play a note with specified timing
     */
    async playNote(noteEvent, startTime = 0, duration = 1.0) {
        await this.ensureAudioContext();
        
        const midiNote = this.noteEventToMidiNote(noteEvent);
        if (midiNote < 0) return;
        
        const actualStartTime = this.audioContext.currentTime + startTime;
        const velocity = 0.8; // Default velocity
        
        
        // TEST: Use simple oscillator first to verify Web Audio works
        if (false) { // Change to true to test oscillators
            this.playOscillatorNote(midiNote, actualStartTime, duration);
            return;
        }
        
        // Try simpler guitar synthesis approach
        this.playSimpleGuitarNote(midiNote, actualStartTime, duration, noteEvent.string);
        
        // Clean up tracking after note ends  
        setTimeout(() => {
            this.activeVoices.delete(midiNote);
        }, (duration + 2) * 1000); // Extra time for decay
    }

    /**
     * More realistic guitar synthesis using multiple harmonics
     */
    playSimpleGuitarNote(midiNote, startTime, duration, stringIndex) {
        const frequency = 440.0 * Math.pow(2, (midiNote - 69) / 12.0);
        const stringChar = this.stringCharacteristics[stringIndex];
        
        // Create a mix gain node for all oscillators
        const mixGain = this.audioContext.createGain();
        mixGain.gain.value = 0.3;
        
        // Create multiple oscillators for harmonic content (more guitar-like)
        const harmonics = [
            { freq: frequency, amp: 1.0, type: 'triangle' },      // Fundamental (warmer than sawtooth)
            { freq: frequency * 2, amp: 0.6, type: 'sine' },     // 2nd harmonic
            { freq: frequency * 3, amp: 0.3, type: 'sine' },     // 3rd harmonic  
            { freq: frequency * 4, amp: 0.15, type: 'sine' },    // 4th harmonic
            { freq: frequency * 5, amp: 0.1, type: 'sine' }      // 5th harmonic
        ];
        
        // Create each harmonic oscillator
        harmonics.forEach((harmonic, index) => {
            const oscillator = this.audioContext.createOscillator();
            const harmonicGain = this.audioContext.createGain();
            
            oscillator.frequency.value = harmonic.freq;
            oscillator.type = harmonic.type;
            
            // Adjust harmonic amplitude based on string characteristics
            let harmonicAmp = harmonic.amp;
            if (stringChar.isWound && index > 1) {
                harmonicAmp *= 0.7; // Wound strings have fewer high harmonics
            }
            
            harmonicGain.gain.value = harmonicAmp;
            
            oscillator.connect(harmonicGain);
            harmonicGain.connect(mixGain);
            
            // Track oscillator for emergency stop
            this.activeOscillators.add(oscillator);
            oscillator.start(startTime);
            oscillator.stop(startTime + duration);
            
            // Don't remove from tracking until manually stopped
            // (so we can call stop() on them if user presses stop)
            oscillator.addEventListener('ended', () => {
                this.activeOscillators.delete(oscillator);
            });
        });
        
        // Create two filters in series for more natural rolloff
        const filter1 = this.audioContext.createBiquadFilter();
        filter1.type = 'lowpass';
        filter1.frequency.value = frequency * (stringChar.isWound ? 4 : 6);
        filter1.Q.value = 1.5;
        
        const filter2 = this.audioContext.createBiquadFilter(); 
        filter2.type = 'highpass';
        filter2.frequency.value = frequency * 0.5; // Remove some low end
        filter2.Q.value = 0.7;
        
        // Create more realistic guitar envelope
        const envelope = this.audioContext.createGain();
        const sustainLevel = stringChar.damping * 0.25;
        
        // Guitar-like envelope: sharp attack, quick initial decay, longer sustain
        envelope.gain.setValueAtTime(0, startTime);
        envelope.gain.linearRampToValueAtTime(1.0, startTime + 0.002); // Very fast pluck attack
        envelope.gain.exponentialRampToValueAtTime(0.4, startTime + 0.05); // Initial decay
        envelope.gain.exponentialRampToValueAtTime(sustainLevel, startTime + 0.2); // Sustain level
        envelope.gain.exponentialRampToValueAtTime(0.001, startTime + duration); // Final release
        
        // Add subtle vibrato for realism (very subtle)
        const vibrato = this.audioContext.createOscillator();
        const vibratoGain = this.audioContext.createGain();
        
        vibrato.frequency.value = 4.5; // 4.5 Hz vibrato
        vibrato.type = 'sine';
        vibratoGain.gain.value = frequency * 0.005; // Very subtle pitch modulation
        
        vibrato.connect(vibratoGain);
        
        // Track vibrato oscillator too
        this.activeOscillators.add(vibrato);
        
        vibrato.start(startTime + 0.1); // Start vibrato after attack
        vibrato.stop(startTime + duration);
        
        vibrato.addEventListener('ended', () => {
            this.activeOscillators.delete(vibrato);
        });
        
        // Connect the audio chain through a stoppable gain node
        const stoppableGain = this.audioContext.createGain();
        stoppableGain.gain.value = 1.0;
        
        mixGain.connect(filter1);
        filter1.connect(filter2);
        filter2.connect(envelope);
        envelope.connect(stoppableGain);
        stoppableGain.connect(this.masterGain);
        
        // Store the stoppable gain for emergency stop
        const noteId = `${midiNote}-${startTime}`;
        this.activeVoices.set(noteId, stoppableGain);
        
        // Clean up gain node when note ends
        setTimeout(() => {
            this.activeVoices.delete(noteId);
        }, (duration + 0.5) * 1000);
        
    }

    /**
     * Simple oscillator test to verify Web Audio API works
     */
    playOscillatorNote(midiNote, startTime, duration) {
        const frequency = 440.0 * Math.pow(2, (midiNote - 69) / 12.0);
        
        const oscillator = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'sawtooth';
        
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.3, startTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        
        oscillator.connect(gain);
        gain.connect(this.masterGain);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
        
    }

    stopAllNotes() {
        if (!this.audioContext) return;
        const t = this.audioContext.currentTime;
        
        // NEW: hard mute master immediately
        try {
            this.masterGain.gain.cancelScheduledValues(t);
            this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, t);
            this.masterGain.gain.linearRampToValueAtTime(0.0001, t + 0.01);
        } catch {}
        
        // Stop all active oscillators (even those scheduled in the future)
        for (const osc of this.activeOscillators) {
            try { osc.stop(t); } catch {}
        }
        this.activeOscillators.clear();
        
        // NEW: zero any per-note gain "bypasses" so tails die instantly
        for (const g of this.activeVoices.values()) {
            try {
                g.gain.cancelScheduledValues(t);
                g.gain.setValueAtTime(0, t);
            } catch {}
        }
        this.activeVoices.clear();
        
    }

    emergencyStop() {
        // Do nothing - stopping will be handled by creating new instances
    }

    /**
     * Set master volume (0.0 to 1.0)
     */
    setMasterVolume(volume) {
        if (this.masterGain && this.audioContext) {
            const currentTime = this.audioContext.currentTime;
            this.masterGain.gain.cancelScheduledValues(currentTime);
            this.masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), currentTime);
        }
    }
    
    /**
     * Resume audio context and restore master volume for new playback
     */
    async resumeAudio() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        
        // Restore master volume
        this.setMasterVolume(0.3);
    }
}

/**
 * Individual guitar voice using Karplus-Strong synthesis
 * Web Audio API implementation of GuitarVoice class
 */
class GuitarVoice {
    constructor(audioContext, destination) {
        this.audioContext = audioContext;
        this.destination = destination;
        
        // String parameters (much longer sustain)
        this.dampingFactor = 0.9995;
        this.tensionFactor = 1.0;
        this.pluckPosition = 0.3;
        this.isWound = false;
        
        // Audio nodes
        this.gainNode = null;
        this.scriptProcessor = null;
        this.delayLine = null;
        this.delayLineSize = 0;
        this.writeIndex = 0;
        
        // State
        this.isPlaying = false;
        this.baseFrequency = 440.0;
        this.lastOutput = 0.0;
    }

    setStringParameters(damping, tension, pluckPos, isWound) {
        this.dampingFactor = damping;
        this.tensionFactor = tension;
        this.pluckPosition = pluckPos;
        this.isWound = isWound;
    }

    startNote(midiNote, velocity, startTime) {
        // Convert MIDI note to frequency
        this.baseFrequency = 440.0 * Math.pow(2, (midiNote - 69) / 12.0);
        
        // Calculate delay line size for Karplus-Strong (ensure minimum size for sustain)
        const sampleRate = this.audioContext.sampleRate;
        this.delayLineSize = Math.max(64, Math.round(sampleRate / this.baseFrequency));
        
        // Initialize delay line with noise burst (pluck simulation)
        this.delayLine = new Float32Array(this.delayLineSize);
        this.fillInitialNoise(velocity);
        this.writeIndex = 0;
        
        // Create audio nodes
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.setValueAtTime(0, startTime);
        this.gainNode.gain.linearRampToValueAtTime(velocity * 0.3, startTime + 0.005);
        this.gainNode.connect(this.destination);
        
        // Create script processor for Karplus-Strong synthesis
        const bufferSize = 4096; // Increase buffer size for stability
        this.scriptProcessor = this.audioContext.createScriptProcessor(bufferSize, 0, 1);
        this.scriptProcessor.onaudioprocess = (event) => this.processAudio(event);
        
        // Important: Connect to a dummy destination to keep it alive
        const silentGain = this.audioContext.createGain();
        silentGain.gain.value = 0;
        this.scriptProcessor.connect(silentGain);
        silentGain.connect(this.audioContext.destination);
        
        // Also connect to our gain node for actual output
        this.scriptProcessor.connect(this.gainNode);
        
        this.isPlaying = true;
        
        
        // Debug: Check initial delay line content
        const maxInitial = Math.max(...Array.from(this.delayLine));
    }

    stopNote(stopTime) {
        if (!this.gainNode) return;
        
        // Fade out
        this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, stopTime);
        this.gainNode.gain.exponentialRampToValueAtTime(0.001, stopTime + 0.1);
        
        // Clean up after fade
        setTimeout(() => {
            this.cleanup();
        }, 200);
    }

    fillInitialNoise(velocity) {
        // Create initial noise burst to simulate string pluck
        const pluckSamples = Math.floor(this.delayLineSize * this.pluckPosition);
        
        for (let i = 0; i < this.delayLineSize; i++) {
            if (i < pluckSamples) {
                // High frequency content at pluck position - increased amplitude
                this.delayLine[i] = (Math.random() * 2 - 1) * velocity * 0.8;
            } else {
                // Lower amplitude after pluck point but still substantial
                this.delayLine[i] = (Math.random() * 2 - 1) * velocity * 0.4;
            }
        }
    }

    processAudio(event) {
        if (!this.isPlaying || !this.delayLine) {
            // Fill with silence if not playing
            const outputBuffer = event.outputBuffer;
            const outputData = outputBuffer.getChannelData(0);
            for (let i = 0; i < outputData.length; i++) {
                outputData[i] = 0;
            }
            return;
        }
        
        const outputBuffer = event.outputBuffer;
        const outputData = outputBuffer.getChannelData(0);
        
        for (let sample = 0; sample < outputBuffer.length; sample++) {
            // Read from delay line at current position
            const currentSample = this.delayLine[this.writeIndex];
            
            // Get next sample for averaging
            const nextIndex = (this.writeIndex + 1) % this.delayLineSize;
            const nextSample = this.delayLine[nextIndex];
            
            // Karplus-Strong low-pass filter: average current and next sample
            let filteredSample = (currentSample + nextSample) * 0.5;
            
            // Apply damping
            filteredSample *= this.dampingFactor;
            
            // Apply additional filtering for wound strings
            if (this.isWound) {
                filteredSample = this.applyWoundStringFilter(filteredSample);
            }
            
            // Write filtered sample back to delay line
            this.delayLine[this.writeIndex] = filteredSample;
            
            // Output the current sample
            outputData[sample] = currentSample;
            
            // Advance to next position in delay line
            this.writeIndex = (this.writeIndex + 1) % this.delayLineSize;
        }
        
        // Debug: Check if we're producing non-zero output
        const maxSample = Math.max(...outputData);
    }

    applyWoundStringFilter(input) {
        // Additional filtering for wound strings (more damping)
        const filtered = 0.7 * input + 0.3 * this.lastOutput;
        this.lastOutput = filtered;
        return filtered;
    }

    cleanup() {
        this.isPlaying = false;
        
        if (this.scriptProcessor) {
            this.scriptProcessor.disconnect();
            this.scriptProcessor = null;
        }
        
        if (this.gainNode) {
            this.gainNode.disconnect();
            this.gainNode = null;
        }
        
        this.delayLine = null;
    }
}

/**
 * Sequencer for playing tab compositions with accurate timing
 */
class TabSequencer {
    constructor(audioEngine) {
        this.audioEngine = audioEngine;
        this.isPlaying = false;
        this.isPaused = false;
        this.currentBeat = 0;
        this.tempo = 120; // BPM
        this.tabData = null;
        this.allNotes = []; // All notes with timing info
        this.playbackTimer = null;
        this.startTime = 0;
        this.pausedTime = 0; // Time when paused
        this.totalPausedDuration = 0; // Total time spent paused
        this.onProgressCallback = null;
        this.onCompleteCallback = null;
        this.isLooping = false;
        this.totalDuration = 0;
        this.loopStartMeasure = 1;
        this.loopEndMeasure = 8;
    }

    setTabData(tabData) {
        this.tabData = tabData;
        if (tabData.tempo) {
            this.tempo = tabData.tempo;
        }
    }

    setTempo(bpm) {
        this.tempo = Math.max(60, Math.min(200, bpm));
    }

    setProgressCallback(callback) {
        this.onProgressCallback = callback;
    }

    setCompleteCallback(callback) {
        this.onCompleteCallback = callback;
    }

    async play() {
        if (!this.tabData) return;
        
        await this.audioEngine.ensureAudioContext();
        this.audioEngine.setMasterVolume(0.3);
        
        if (this.isPaused) {
            // Resume from pause
            this.resume();
        } else {
            // Start fresh playback
            this.startFreshPlayback();
        }
    }
    
    startFreshPlayback() {
        this.isPlaying = true;
        this.isPaused = false;
        this.currentBeat = 0;
        this.startTime = this.audioEngine.audioContext.currentTime;
        this.totalPausedDuration = 0;
        
        // Prepare notes for real-time triggering
        this.prepareNotes();
        
        // Start real-time playback
        this.startRealtimePlayback();
    }
    
    resume() {
        this.isPlaying = true;
        this.isPaused = false;
        
        // Adjust start time to account for pause duration
        const pauseDuration = this.audioEngine.audioContext.currentTime - this.pausedTime;
        this.totalPausedDuration += pauseDuration;
        
        // Continue real-time playback
        this.startRealtimePlayback();
    }

    stop() {
        this.isPlaying = false;
        this.isPaused = false;
        this.currentBeat = 0;
        this.totalPausedDuration = 0;
        
        // Stop the playback timer
        if (this.playbackTimer) {
            clearInterval(this.playbackTimer);
            this.playbackTimer = null;
        }
        
        // Stop all audio
        this.audioEngine.stopAllNotes();
        
        if (this.onProgressCallback) {
            this.onProgressCallback(0);
        }
    }

    pause() {
        this.isPlaying = false;
        this.isPaused = true;
        this.pausedTime = this.audioEngine.audioContext.currentTime;
        
        // Stop the playback timer but keep current position
        if (this.playbackTimer) {
            clearInterval(this.playbackTimer);
            this.playbackTimer = null;
        }
        
        // Stop currently playing notes but keep position
        this.audioEngine.stopAllNotes();
    }

    prepareNotes() {
        this.allNotes = [];
        
        const beatDuration = 60.0 / this.tempo;
        const totalBeats = this.tabData.measures.length * 4;
        this.totalDuration = totalBeats * beatDuration;
        
        // Collect all notes with timing for real-time triggering
        for (const measure of this.tabData.measures) {
            for (const note of measure.notes) {
                if (note.fret >= 0) {
                    const globalBeat = note.globalBeatPosition !== undefined ? note.globalBeatPosition : note.beatPosition;
                    
                    this.allNotes.push({
                        note: note,
                        beatPosition: globalBeat,
                        beatDuration: note.beatDuration,
                        triggered: false
                    });
                }
            }
        }
        
        // Sort by beat position
        this.allNotes.sort((a, b) => a.beatPosition - b.beatPosition);
    }

    getMeasureBeats(measure) {
        // Parse time signature to get beats per measure
        const timeSignature = measure.timeSignature || "4/4";
        const [numerator] = timeSignature.split('/').map(n => parseInt(n));
        return numerator;
    }

    startRealtimePlayback() {
        // Real-time playback with 10ms precision
        this.playbackTimer = setInterval(() => {
            if (!this.isPlaying) return;
            
            const currentTime = this.audioEngine.audioContext.currentTime;
            const elapsed = currentTime - this.startTime - this.totalPausedDuration;
            const beatDuration = 60.0 / this.tempo;
            this.currentBeat = elapsed / beatDuration;
            
            const progress = Math.min(this.currentBeat / (this.totalDuration / beatDuration), 1.0);
            
            // Trigger notes that should start now (with 50ms lookahead)
            const lookahead = 0.05;
            for (const noteData of this.allNotes) {
                if (!noteData.triggered && 
                    this.currentBeat >= noteData.beatPosition - lookahead &&
                    this.currentBeat <= noteData.beatPosition + lookahead) {
                    
                    const noteStartTime = Math.max(0, (noteData.beatPosition - this.currentBeat) * beatDuration);
                    const noteDuration = noteData.beatDuration * beatDuration;
                    
                    this.audioEngine.playNote(noteData.note, noteStartTime, noteDuration);
                    noteData.triggered = true;
                }
            }
            
            // Update progress
            if (this.onProgressCallback) {
                this.onProgressCallback(progress);
            }
            
            // Check for completion of current loop range
            const loopEndBeat = this.loopEndMeasure * 4;
            const totalBeats = this.tabData.measures.length * 4;
            
            if (this.isLooping && this.currentBeat >= loopEndBeat) {
                // Loop back to start of selected range
                this.loop();
            } else if (!this.isLooping && progress >= 1.0) {
                // Normal completion
                this.stop();
                if (this.onCompleteCallback) {
                    this.onCompleteCallback();
                }
            }
        }, 10);
    }
    
    loop() {
        // Reset for next loop iteration to start of loop range
        const loopStartBeat = (this.loopStartMeasure - 1) * 4;
        this.currentBeat = loopStartBeat;
        this.startTime = this.audioEngine.audioContext.currentTime - (loopStartBeat * 60.0 / this.tempo);
        this.totalPausedDuration = 0;
        
        // Reset note triggers only for notes in the loop range
        const loopEndBeat = this.loopEndMeasure * 4;
        this.allNotes.forEach(noteData => {
            if (noteData.beatPosition >= loopStartBeat && noteData.beatPosition < loopEndBeat) {
                noteData.triggered = false;
            }
        });
    }
    
    setLooping(enabled) {
        this.isLooping = enabled;
    }
    
    setLoopRange(startMeasure, endMeasure) {
        this.loopStartMeasure = startMeasure;
        this.loopEndMeasure = endMeasure;
    }
}