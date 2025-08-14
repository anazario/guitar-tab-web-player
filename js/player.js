/**
 * Guitar Tab Web Player - Main Controller
 * Handles UI interactions and coordinates audio/rendering
 */

class GuitarTabPlayer {
    constructor() {
        this.tabData = null;
        this.isPlaying = false;
        this.currentTempo = 120;
        this.currentPosition = 0;
        this.currentBeat = 0; // Current beat position for visualization
        this.isLooping = false;
        
        // Initialize audio system
        this.audioEngine = new GuitarAudioEngine();
        this.sequencer = new TabSequencer(this.audioEngine);
        
        this.initializeElements();
        this.setupEventListeners();
        this.setupAudioCallbacks();
        this.loadTabData();
    }

    initializeElements() {
        // Get DOM elements
        this.playPauseBtn = document.getElementById('play-pause-btn');
        this.stopBtn = document.getElementById('stop-btn');
        this.restartBtn = document.getElementById('restart-btn');
        this.loopBtn = document.getElementById('loop-btn');
        
        this.tempoValue = document.getElementById('tempo-value');
        this.currentTempoSpan = document.getElementById('current-tempo');
        this.tempoUpBtn = document.getElementById('tempo-up');
        this.tempoDownBtn = document.getElementById('tempo-down');
        this.progressBar = document.getElementById('progress-bar');
        this.tabCanvas = document.getElementById('tab-canvas');
        this.loadingMessage = document.getElementById('loading-message');
        this.errorMessage = document.getElementById('error-message');
        this.compositionTitle = document.getElementById('composition-title');
    }

    setupEventListeners() {
        this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        this.stopBtn.addEventListener('click', () => this.stop());
        this.restartBtn.addEventListener('click', () => this.restart());
        this.loopBtn.addEventListener('click', () => this.toggleLoop());
        this.tempoUpBtn.addEventListener('click', () => this.adjustTempo(5));
        this.tempoDownBtn.addEventListener('click', () => this.adjustTempo(-5));
    }

    setupAudioCallbacks() {
        // Set up sequencer callbacks for progress and completion
        this.sequencer.setProgressCallback((progress) => {
            this.currentPosition = Math.min(progress, 1.0); // Cap at 1.0
            this.currentBeat = this.currentPosition * (this.tabData ? this.tabData.measures.length * 4 : 32);
            this.updateProgressBar(this.currentPosition);
            
            if (this.currentPosition < 1.0) {
                this.updatePlaybackVisualization();
            }
        });
        
        this.sequencer.setCompleteCallback(() => {
            this.onPlaybackComplete();
        });
    }

    async loadTabData() {
        try {
            
            // Check if we have URL data
            const urlData = await TabDataDecoder.decodeFromURL();
            
            if (urlData && TabDataDecoder.validateTabData(urlData)) {
                this.tabData = urlData;
                this.setupFromTabData();
                this.hideLoading();
            } else {
                // Load test data for development - try real tab first
                this.loadRealTabData();
            }
            
        } catch (error) {
            console.error('Failed to load tab data:', error);
            this.showError('Failed to load tab data: ' + error.message);
        }
    }

    loadRealTabData() {
        // Your real "NoMierda" composition
        const realTabData = {"version": 1, "measures": [{"notes": [{"string": 3, "fret": 6, "subdivision": 0, "duration": 4}, {"string": 4, "fret": 4, "subdivision": 0, "duration": 4}, {"string": 4, "fret": 8, "subdivision": 4, "duration": 12}, {"string": 5, "fret": 6, "subdivision": 4, "duration": 12}], "measureId": 1}, {"notes": [{"string": 3, "fret": 6, "subdivision": 0, "duration": 2}, {"string": 4, "fret": 4, "subdivision": 0, "duration": 2}, {"string": 4, "fret": 8, "subdivision": 2, "duration": 2}, {"string": 4, "fret": 7, "subdivision": 4, "duration": 12}, {"string": 5, "fret": 6, "subdivision": 2, "duration": 2}, {"string": 5, "fret": 5, "subdivision": 4, "duration": 12}], "measureId": 2}, {"notes": [{"string": 3, "fret": 6, "subdivision": 0, "duration": 2}, {"string": 3, "fret": 6, "subdivision": 4, "duration": 4}, {"string": 3, "fret": 7, "subdivision": 14, "duration": 2}, {"string": 4, "fret": 4, "subdivision": 0, "duration": 2}, {"string": 4, "fret": 8, "subdivision": 2, "duration": 2}, {"string": 4, "fret": 4, "subdivision": 4, "duration": 4}, {"string": 4, "fret": 5, "subdivision": 14, "duration": 2}, {"string": 4, "fret": 8, "subdivision": 8, "duration": 6}, {"string": 5, "fret": 6, "subdivision": 2, "duration": 2}, {"string": 5, "fret": 6, "subdivision": 8, "duration": 6}], "measureId": 3}, {"notes": [{"string": 3, "fret": 6, "subdivision": 0, "duration": 2}, {"string": 3, "fret": 6, "subdivision": 8, "duration": 2}, {"string": 4, "fret": 4, "subdivision": 0, "duration": 2}, {"string": 4, "fret": 8, "subdivision": 2, "duration": 2}, {"string": 4, "fret": 7, "subdivision": 4, "duration": 4}, {"string": 4, "fret": 4, "subdivision": 8, "duration": 2}, {"string": 4, "fret": 8, "subdivision": 10, "duration": 2}, {"string": 4, "fret": 7, "subdivision": 12, "duration": 4}, {"string": 5, "fret": 6, "subdivision": 2, "duration": 2}, {"string": 5, "fret": 5, "subdivision": 4, "duration": 4}, {"string": 5, "fret": 6, "subdivision": 10, "duration": 2}, {"string": 5, "fret": 5, "subdivision": 12, "duration": 4}], "measureId": 4}, {"notes": [{"string": 3, "fret": 6, "subdivision": 0, "duration": 2}, {"string": 3, "fret": 6, "subdivision": 4, "duration": 4}, {"string": 4, "fret": 4, "subdivision": 0, "duration": 2}, {"string": 4, "fret": 8, "subdivision": 2, "duration": 2}, {"string": 4, "fret": 4, "subdivision": 4, "duration": 4}, {"string": 4, "fret": 8, "subdivision": 8, "duration": 8}, {"string": 5, "fret": 6, "subdivision": 2, "duration": 2}, {"string": 5, "fret": 6, "subdivision": 8, "duration": 8}], "measureId": 5}, {"notes": [{"string": 3, "fret": 6, "subdivision": 0, "duration": 2}, {"string": 4, "fret": 4, "subdivision": 0, "duration": 2}, {"string": 4, "fret": 8, "subdivision": 2, "duration": 2}, {"string": 4, "fret": 7, "subdivision": 4, "duration": 12}, {"string": 5, "fret": 6, "subdivision": 2, "duration": 2}, {"string": 5, "fret": 5, "subdivision": 4, "duration": 12}], "measureId": 6}, {"notes": [{"string": 3, "fret": 6, "subdivision": 0, "duration": 2}, {"string": 3, "fret": 6, "subdivision": 4, "duration": 4}, {"string": 3, "fret": 7, "subdivision": 14, "duration": 2}, {"string": 4, "fret": 4, "subdivision": 0, "duration": 2}, {"string": 4, "fret": 8, "subdivision": 2, "duration": 2}, {"string": 4, "fret": 4, "subdivision": 4, "duration": 4}, {"string": 4, "fret": 5, "subdivision": 14, "duration": 2}, {"string": 4, "fret": 8, "subdivision": 8, "duration": 6}, {"string": 5, "fret": 6, "subdivision": 2, "duration": 2}, {"string": 5, "fret": 6, "subdivision": 8, "duration": 6}], "measureId": 7}, {"notes": [{"string": 3, "fret": 6, "subdivision": 0, "duration": 2}, {"string": 3, "fret": 6, "subdivision": 8, "duration": 2}, {"string": 4, "fret": 4, "subdivision": 0, "duration": 2}, {"string": 4, "fret": 8, "subdivision": 2, "duration": 2}, {"string": 4, "fret": 7, "subdivision": 4, "duration": 4}, {"string": 4, "fret": 4, "subdivision": 8, "duration": 2}, {"string": 4, "fret": 8, "subdivision": 10, "duration": 2}, {"string": 4, "fret": 7, "subdivision": 12, "duration": 4}, {"string": 5, "fret": 6, "subdivision": 2, "duration": 2}, {"string": 5, "fret": 5, "subdivision": 4, "duration": 4}, {"string": 5, "fret": 6, "subdivision": 10, "duration": 2}, {"string": 5, "fret": 5, "subdivision": 12, "duration": 4}], "measureId": 8}]};
        
        // Convert from legacy format to new format
        this.tabData = this.convertLegacyFormat(realTabData);
        this.tabData.title = "NoMierda";
        this.tabData.tempo = 120; // Set a reasonable tempo
        
        this.setupFromTabData();
        this.hideLoading();
    }

    loadTestData() {
        // Simple test data (fallback)
        this.tabData = {
            version: 2,
            title: "Test Tab",
            tempo: 120,
            measures: [
                {
                    timeSignature: "4/4",
                    keySignature: "C",
                    notes: [
                        { string: 0, fret: 3, beatPosition: 0.0, beatDuration: 1.0 },
                        { string: 0, fret: 5, beatPosition: 1.0, beatDuration: 1.0 },
                        { string: 1, fret: 2, beatPosition: 2.0, beatDuration: 1.0 },
                        { string: 2, fret: 0, beatPosition: 3.0, beatDuration: 1.0 }
                    ]
                }
            ]
        };
        
        this.setupFromTabData();
        this.hideLoading();
    }

    /**
     * Convert legacy subdivision/duration format to beatPosition/beatDuration
     */
    convertLegacyFormat(legacyData) {
        const converted = {
            version: 2,
            measures: []
        };
        
        // Process each measure
        for (let measureIndex = 0; measureIndex < legacyData.measures.length; measureIndex++) {
            const measure = legacyData.measures[measureIndex];
            const convertedMeasure = {
                timeSignature: "4/4",
                keySignature: "C", 
                notes: []
            };
            
            // Convert each note
            for (const note of measure.notes) {
                const convertedNote = {
                    string: note.string,
                    fret: note.fret,
                    // Convert subdivision to beat position within this measure (subdivision * 0.25)
                    beatPosition: note.subdivision * 0.25,
                    // Convert duration to beat duration (duration * 0.25) 
                    beatDuration: note.duration * 0.25,
                    // Add measure offset for sequencer (each measure is 4 beats)
                    globalBeatPosition: (measureIndex * 4) + (note.subdivision * 0.25)
                };
                
                convertedMeasure.notes.push(convertedNote);
            }
            
            converted.measures.push(convertedMeasure);
        }
        
        return converted;
    }

    setupFromTabData() {
        // Update UI with tab data
        if (this.tabData.title) {
            this.compositionTitle.textContent = this.tabData.title;
        }
        
        if (this.tabData.tempo) {
            this.currentTempo = this.tabData.tempo;
            this.updateTempoDisplay();
        }

        // Setup audio system with tab data
        this.sequencer.setTabData(this.tabData);
        this.sequencer.setTempo(this.currentTempo);

        // Initialize renderer
        this.renderTab();
    }

    renderTab() {
        // GuitarTabEditor-style rendering with authentic colors
        const ctx = this.tabCanvas.getContext('2d');
        
        // Layout configuration
        const measuresPerRow = 4; // 4 measures per row like desktop app
        const measureWidth = 200; // Width per measure
        const subdivisionWidth = 12; // Space for each subdivision (16 subdivisions per measure)
        const rowHeight = 180; // Height per row (strings + spacing)
        const rowCount = Math.ceil(this.tabData.measures.length / measuresPerRow);
        
        // Set canvas size based on rows
        this.tabCanvas.width = 50 + (measuresPerRow * measureWidth) + 50;
        this.tabCanvas.height = 60 + (rowCount * rowHeight) + 40;
        
        // Store these for playback visualizer
        this.measureWidth = measureWidth;
        this.subdivisionWidth = subdivisionWidth;
        this.measuresPerRow = measuresPerRow;
        this.rowHeight = rowHeight;
        
        // Clear with black background (matching GuitarTabEditor)
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, this.tabCanvas.width, this.tabCanvas.height);
        
        // Draw title
        ctx.fillStyle = '#ffffff';
        ctx.font = '18px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(this.tabData.title || 'Guitar Tab', 20, 25);
        
        const stringCount = 6;
        const lineSpacing = 20;
        const tuning = ['E', 'B', 'G', 'D', 'A', 'E'];
        
        // Render each row
        for (let row = 0; row < rowCount; row++) {
            const rowY = 60 + (row * rowHeight);
            
            // Draw strings for this row
            ctx.strokeStyle = '#cccccc';
            ctx.lineWidth = 1;
            for (let i = 0; i < stringCount; i++) {
                const y = rowY + 30 + (i * lineSpacing);
                ctx.beginPath();
                ctx.moveTo(40, y);
                ctx.lineTo(this.tabCanvas.width - 40, y);
                ctx.stroke();
            }
            
            // Draw string labels (tuning) for this row
            ctx.fillStyle = '#cccccc';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            for (let i = 0; i < stringCount; i++) {
                const y = rowY + 30 + (i * lineSpacing);
                ctx.fillText(tuning[i], 25, y + 4);
            }
            
            // Draw measures in this row
            const startMeasure = row * measuresPerRow;
            const endMeasure = Math.min(startMeasure + measuresPerRow, this.tabData.measures.length);
            
            for (let measureIndex = startMeasure; measureIndex < endMeasure; measureIndex++) {
                const measure = this.tabData.measures[measureIndex];
                const measureInRow = measureIndex - startMeasure;
                const measureX = 50 + (measureInRow * measureWidth);
                const measureY = rowY + 30;
                
                // Draw measure separator
                ctx.strokeStyle = '#555555';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(measureX - 5, measureY - 15);
                ctx.lineTo(measureX - 5, measureY + (5 * lineSpacing) + 10);
                ctx.stroke();
                
                // Draw measure number
                ctx.fillStyle = '#ffffff';
                ctx.font = '14px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(`${measureIndex + 1}`, measureX + measureWidth/2, measureY - 20);
                
                // Draw subdivision grid lines (16 subdivisions per measure)
                for (let sub = 1; sub < 16; sub++) {
                    const gridX = measureX + (sub * subdivisionWidth);
                    ctx.strokeStyle = sub % 4 === 0 ? '#555555' : '#333333'; // Stronger lines on beat boundaries
                    ctx.lineWidth = 0.5;
                    ctx.beginPath();
                    ctx.moveTo(gridX, measureY - 10);
                    ctx.lineTo(gridX, measureY + (5 * lineSpacing) + 5);
                    ctx.stroke();
                }
                
                // Draw all notes in this measure
                for (const note of measure.notes) {
                    if (note.fret >= 0) {
                        const subdivision = Math.round(note.beatPosition * 4); // Convert to subdivision (0-15)
                        const noteX = measureX + (subdivision * subdivisionWidth);
                        const noteY = measureY + (note.string * lineSpacing);
                        
                        // Draw note background (subtle blue like GuitarTabEditor)
                        ctx.fillStyle = 'rgba(0, 0, 255, 0.2)';
                        ctx.beginPath();
                        ctx.arc(noteX, noteY, 10, 0, 2 * Math.PI);
                        ctx.fill();
                        
                        // Draw note border
                        ctx.strokeStyle = 'rgba(0, 0, 255, 0.6)';
                        ctx.lineWidth = 1;
                        ctx.stroke();
                        
                        // Draw fret number in lime green (matching GuitarTabEditor textNormal)
                        ctx.fillStyle = '#00ff00';
                        ctx.font = '12px Arial';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(note.fret.toString(), noteX, noteY);
                    }
                }
            }
        }
    }

    /**
     * Update the visual representation during playback
     */
    updatePlaybackVisualization() {
        if (!this.tabData || !this.isPlaying) return;
        
        this.renderTabWithPlayback();
        this.autoScrollToPlayback();
    }

    /**
     * Auto-scroll to keep the current playback position visible
     */
    autoScrollToPlayback() {
        const currentMeasure = Math.floor(this.currentBeat / 4);
        const row = Math.floor(currentMeasure / this.measuresPerRow);
        
        // Calculate the target scroll position
        const rowY = 60 + (row * this.rowHeight);
        const tabDisplayContainer = this.tabCanvas.parentElement;
        
        // Get current scroll position
        const containerHeight = tabDisplayContainer.offsetHeight;
        const scrollTop = tabDisplayContainer.scrollTop;
        const scrollBottom = scrollTop + containerHeight;
        
        // Check if current row is visible
        const rowTop = rowY - 30;
        const rowBottom = rowY + this.rowHeight;
        
        if (rowTop < scrollTop || rowBottom > scrollBottom) {
            // Scroll to center the current row
            const targetScroll = rowTop - (containerHeight / 2) + (this.rowHeight / 2);
            tabDisplayContainer.scrollTo({
                top: Math.max(0, targetScroll),
                behavior: 'smooth'
            });
        }
    }

    /**
     * Render the tab with playback highlighting
     */
    renderTabWithPlayback() {
        const ctx = this.tabCanvas.getContext('2d');
        
        // Clear and redraw the base tab
        this.renderTab();
        
        // Add playback visualization overlays
        this.drawPlaybackCursor();
        this.highlightActiveNotes();
    }

    /**
     * Draw the playback cursor line
     */
    drawPlaybackCursor() {
        const ctx = this.tabCanvas.getContext('2d');
        
        // Calculate cursor position
        const currentMeasure = Math.floor(this.currentBeat / 4);
        const beatInMeasure = this.currentBeat % 4;
        const subdivisionInMeasure = beatInMeasure * 4;
        
        // Calculate row and position
        const row = Math.floor(currentMeasure / this.measuresPerRow);
        const measureInRow = currentMeasure % this.measuresPerRow;
        
        const cursorX = 50 + (measureInRow * this.measureWidth) + (subdivisionInMeasure * this.subdivisionWidth);
        const cursorY = 60 + (row * this.rowHeight) + 30;
        
        // Draw the cursor line
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cursorX, cursorY - 15);
        ctx.lineTo(cursorX, cursorY + (5 * 20) + 10);
        ctx.stroke();
        
        // Draw cursor head (triangle)
        ctx.fillStyle = '#00ff00';
        ctx.beginPath();
        ctx.moveTo(cursorX, cursorY - 15);
        ctx.lineTo(cursorX - 6, cursorY - 25);
        ctx.lineTo(cursorX + 6, cursorY - 25);
        ctx.closePath();
        ctx.fill();
    }

    /**
     * Highlight notes that are currently playing (group chords into ovals)
     */
    highlightActiveNotes() {
        if (!this.tabData) return;
        
        const ctx = this.tabCanvas.getContext('2d');
        const tolerance = 0.1; // Beat tolerance for "current" notes
        
        // Group active notes by measure and subdivision (chord detection)
        const activeChords = {};
        
        // Find all currently playing notes
        for (let measureIndex = 0; measureIndex < this.tabData.measures.length; measureIndex++) {
            const measure = this.tabData.measures[measureIndex];
            
            for (const note of measure.notes) {
                if (note.fret >= 0 && note.globalBeatPosition !== undefined) {
                    // Check if this note is currently active
                    const noteStart = note.globalBeatPosition;
                    const noteEnd = noteStart + note.beatDuration;
                    
                    if (this.currentBeat >= noteStart - tolerance && 
                        this.currentBeat <= noteEnd + tolerance) {
                        
                        // Group by measure and subdivision for chord detection
                        const subdivision = Math.round(note.beatPosition * 4);
                        const chordKey = `${measureIndex}-${subdivision}`;
                        
                        if (!activeChords[chordKey]) {
                            activeChords[chordKey] = {
                                measureIndex,
                                subdivision,
                                notes: []
                            };
                        }
                        
                        activeChords[chordKey].notes.push(note);
                    }
                }
            }
        }
        
        // Draw highlight for each chord/note group
        for (const chord of Object.values(activeChords)) {
            this.drawChordHighlight(ctx, chord);
        }
    }

    /**
     * Draw highlight for a chord (group of notes at same time)
     */
    drawChordHighlight(ctx, chord) {
        const { measureIndex, subdivision, notes } = chord;
        
        // Calculate screen positions
        const row = Math.floor(measureIndex / this.measuresPerRow);
        const measureInRow = measureIndex % this.measuresPerRow;
        
        const chordX = 50 + (measureInRow * this.measureWidth) + (subdivision * this.subdivisionWidth);
        const baseY = 60 + (row * this.rowHeight) + 30;
        
        if (notes.length === 1) {
            // Single note - draw circular highlight
            const noteY = baseY + (notes[0].string * 20);
            
            ctx.shadowColor = '#00ff00';
            ctx.shadowBlur = 15;
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(chordX, noteY, 15, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.shadowBlur = 0;
            
        } else {
            // Multiple notes (chord) - draw oval highlight
            const stringNumbers = notes.map(n => n.string).sort((a, b) => a - b);
            const minString = stringNumbers[0];
            const maxString = stringNumbers[stringNumbers.length - 1];
            
            const topY = baseY + (minString * 20);
            const bottomY = baseY + (maxString * 20);
            const centerY = (topY + bottomY) / 2;
            const height = Math.max(30, bottomY - topY + 20);
            const width = 24;
            
            // Draw oval highlight
            ctx.shadowColor = '#00ff00';
            ctx.shadowBlur = 15;
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(chordX, centerY, width/2, height/2, 0, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
    }

    togglePlayPause() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    async play() {
        try {
            this.isPlaying = true;
            this.playPauseBtn.textContent = 'Pause';
            document.body.classList.add('playing');
            
            // Start audio playback
            await this.sequencer.play();
            
        } catch (error) {
            console.error('Failed to start playback:', error);
            this.isPlaying = false;
            this.playPauseBtn.textContent = 'Play';
            document.body.classList.remove('playing');
            
            alert('Unable to start audio playback. Please check your browser audio settings.');
        }
    }
    
    toggleLoop() {
        this.isLooping = !this.isLooping;
        this.sequencer.setLooping(this.isLooping);
        this.loopBtn.textContent = this.isLooping ? 'Loop: On' : 'Loop: Off';
    }

    pause() {
        this.isPlaying = false;
        this.playPauseBtn.textContent = 'Play';
        document.body.classList.remove('playing');
        
        this.sequencer.pause();
    }

    stop() {
        this.isPlaying = false;
        this.currentPosition = 0;
        this.currentBeat = 0;
        this.playPauseBtn.textContent = 'Play';
        document.body.classList.remove('playing');
        
        // Stop all active oscillators immediately
        if (this.audioEngine) {
            this.audioEngine.stopAllNotes();
        }
        
        this.sequencer.stop();
        this.updateProgressBar(0);
        this.renderTab();
    }

    restart() {
        this.stop();
        this.play();
    }

    adjustTempo(delta) {
        this.currentTempo = Math.max(60, Math.min(200, this.currentTempo + delta));
        this.updateTempoDisplay();
        
        // Update sequencer tempo
        this.sequencer.setTempo(this.currentTempo);
    }

    updateTempoDisplay() {
        this.tempoValue.textContent = this.currentTempo;
        this.currentTempoSpan.textContent = this.currentTempo;
    }

    updateProgressBar(progress) {
        this.progressBar.style.width = (progress * 100) + '%';
    }

    onPlaybackComplete() {
        // Called when sequencer finishes playing
        this.isPlaying = false;
        this.currentPosition = 0;
        this.currentBeat = 0;
        this.playPauseBtn.textContent = 'Play';
        document.body.classList.remove('playing');
        
        // Reset progress bar and visualization immediately
        this.updateProgressBar(0);
        this.renderTab(); // Clear highlights and cursor
        
    }

    hideLoading() {
        this.loadingMessage.style.display = 'none';
    }

    showError(message) {
        this.loadingMessage.style.display = 'none';
        this.errorMessage.style.display = 'block';
        this.errorMessage.querySelector('p').textContent = message;
    }
}

// Initialize the player when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.player = new GuitarTabPlayer();
});