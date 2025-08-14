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
        this.loopStartMeasure = 1;
        this.loopEndMeasure = 8;
        this.selectedMeasures = new Set(); // For visual selection
        
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
        this.loopStartInput = document.getElementById('loop-start');
        this.loopEndInput = document.getElementById('loop-end');
        this.selectAllBtn = document.getElementById('select-all-btn');
        
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
        this.loopStartInput.addEventListener('change', () => this.updateLoopRange());
        this.loopEndInput.addEventListener('change', () => this.updateLoopRange());
        this.selectAllBtn.addEventListener('click', () => this.selectAllMeasures());
        this.tempoUpBtn.addEventListener('click', () => this.adjustTempo(5));
        this.tempoDownBtn.addEventListener('click', () => this.adjustTempo(-5));
        
        // Add click listener to canvas for measure selection
        this.tabCanvas.addEventListener('click', (e) => this.handleCanvasClick(e));
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
                // No valid tab data found in URL
                this.showError('No valid tab data found. Please check your share link.');
            }
            
        } catch (error) {
            console.error('Failed to load tab data:', error);
            this.showError('Failed to load tab data: ' + error.message);
        }
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

    /**
     * Add globalBeatPosition to notes that don't have it (desktop format)
     */
    addGlobalBeatPositions() {
        if (!this.tabData || !this.tabData.measures) return;
        
        for (let measureIndex = 0; measureIndex < this.tabData.measures.length; measureIndex++) {
            const measure = this.tabData.measures[measureIndex];
            if (!measure.notes) continue;
            
            for (const note of measure.notes) {
                // Only add if it doesn't already exist
                if (note.globalBeatPosition === undefined) {
                    // Calculate global beat position: measure offset + local beat position
                    note.globalBeatPosition = (measureIndex * 4) + note.beatPosition;
                }
            }
            
            // Process triplet regions if they exist
            if (measure.tripletRegions && measure.tripletRegions.length > 0) {
                // Store triplet regions for this measure
                if (!this.tabData.tripletRegions) {
                    this.tabData.tripletRegions = {};
                }
                this.tabData.tripletRegions[measureIndex] = measure.tripletRegions;
            }
        }
    }

    setupFromTabData() {
        // Add globalBeatPosition for notes that don't have it (new format from desktop)
        this.addGlobalBeatPositions();
        
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
        
        // Initialize loop range to all measures
        this.loopEndMeasure = this.tabData.measures.length;
        this.loopEndInput.value = this.loopEndMeasure;
        this.loopEndInput.max = this.loopEndMeasure;
        this.loopStartInput.max = this.loopEndMeasure;
        this.updateLoopRange();

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
                
                // Draw measure background if selected for looping AND loop is enabled
                const measureNumber = measureIndex + 1;
                const isSelected = this.selectedMeasures.has(measureNumber) && this.isLooping;
                if (isSelected) {
                    ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
                    ctx.fillRect(measureX - 5, measureY - 15, measureWidth, (5 * lineSpacing) + 25);
                }
                
                // Draw measure number
                ctx.fillStyle = isSelected ? '#00ff00' : '#ffffff';
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
                
                // Draw triplet brackets if they exist for this measure
                this.drawTripletBrackets(ctx, measureIndex, measureX, measureY, subdivisionWidth, lineSpacing);
            }
        }
    }

    /**
     * Draw triplet brackets for a measure
     */
    drawTripletBrackets(ctx, measureIndex, measureX, measureY, subdivisionWidth, lineSpacing) {
        if (!this.tabData.tripletRegions || !this.tabData.tripletRegions[measureIndex]) return;
        
        const tripletRegions = this.tabData.tripletRegions[measureIndex];
        
        for (const tripletData of tripletRegions) {
            const stringIndex = tripletData.stringIndex;
            const region = tripletData.region;
            
            // Calculate bracket position
            const startX = measureX + (region.startBeat % 1) * 4 * subdivisionWidth;
            const endX = measureX + (region.endBeat % 1) * 4 * subdivisionWidth;
            const bracketY = measureY + (stringIndex * lineSpacing) - 15;
            
            // Draw triplet bracket
            ctx.strokeStyle = '#ffff00'; // Yellow color for visibility
            ctx.lineWidth = 1;
            
            // Bracket line
            ctx.beginPath();
            ctx.moveTo(startX, bracketY);
            ctx.lineTo(endX, bracketY);
            ctx.stroke();
            
            // Left bracket end
            ctx.beginPath();
            ctx.moveTo(startX, bracketY);
            ctx.lineTo(startX, bracketY + 5);
            ctx.stroke();
            
            // Right bracket end
            ctx.beginPath();
            ctx.moveTo(endX, bracketY);
            ctx.lineTo(endX, bracketY + 5);
            ctx.stroke();
            
            // Draw "3" in the middle of the bracket
            const centerX = (startX + endX) / 2;
            ctx.fillStyle = '#ffff00';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText('3', centerX, bracketY - 2);
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
        this.sequencer.setLoopRange(this.loopStartMeasure, this.loopEndMeasure);
        this.loopBtn.textContent = this.isLooping ? 'Loop: On' : 'Loop: Off';
        
        // Re-render to update visual highlighting
        if (this.tabData) {
            this.renderTab();
        }
    }
    
    updateLoopRange() {
        this.loopStartMeasure = Math.max(1, parseInt(this.loopStartInput.value) || 1);
        this.loopEndMeasure = Math.min(this.tabData?.measures.length || 8, parseInt(this.loopEndInput.value) || 8);
        
        // Ensure start <= end
        if (this.loopStartMeasure > this.loopEndMeasure) {
            this.loopEndMeasure = this.loopStartMeasure;
            this.loopEndInput.value = this.loopEndMeasure;
        }
        
        // Update sequencer
        this.sequencer.setLoopRange(this.loopStartMeasure, this.loopEndMeasure);
        
        // Update selected measures for visual indication
        this.selectedMeasures.clear();
        for (let i = this.loopStartMeasure; i <= this.loopEndMeasure; i++) {
            this.selectedMeasures.add(i);
        }
        
        // Re-render to show selection
        if (this.tabData) {
            this.renderTab();
        }
    }
    
    selectAllMeasures() {
        this.loopStartMeasure = 1;
        this.loopEndMeasure = this.tabData?.measures.length || 8;
        this.loopStartInput.value = this.loopStartMeasure;
        this.loopEndInput.value = this.loopEndMeasure;
        this.updateLoopRange();
    }
    
    handleCanvasClick(event) {
        if (!this.tabData) return;
        
        const rect = this.tabCanvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Calculate which measure was clicked
        const measureIndex = this.getMeasureFromClick(x, y);
        if (measureIndex >= 0 && measureIndex < this.tabData.measures.length) {
            const measureNumber = measureIndex + 1;
            
            // Set loop range to this single measure
            this.loopStartMeasure = measureNumber;
            this.loopEndMeasure = measureNumber;
            this.loopStartInput.value = measureNumber;
            this.loopEndInput.value = measureNumber;
            this.updateLoopRange();
        }
    }
    
    getMeasureFromClick(x, y) {
        // Use the same layout logic as renderTab
        const measuresPerRow = 4;
        const measureWidth = 200;
        const rowHeight = 180;
        
        // Calculate row and measure within row
        const row = Math.floor((y - 60) / rowHeight);
        const measureInRow = Math.floor((x - 50) / measureWidth);
        
        // Calculate absolute measure index
        const measureIndex = row * measuresPerRow + measureInRow;
        
        return measureIndex;
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