/**
 * Guitar Tab Web Player - URL Data Decoder
 * Handles decompression and parsing of tab data from URL fragments
 */

class TabDataDecoder {
    /**
     * Extract and decode tab data from the current URL
     * @returns {Object|null} Decoded tab data or null if invalid
     */
    static async decodeFromURL() {
        try {
            const fragment = window.location.hash.substring(1);
            console.log('URL fragment:', fragment);
            if (!fragment) {
                console.warn('No URL fragment found');
                return null;
            }

            const params = new URLSearchParams(fragment);
            const encodedData = params.get('data');
            const isCompressed = params.get('compressed') === 'true';
            console.log('Encoded data length:', encodedData ? encodedData.length : 'null');
            console.log('Is compressed:', isCompressed);
            
            if (!encodedData) {
                console.warn('No data parameter found in URL');
                console.log('Available URL params:', [...params.keys()]);
                return null;
            }

            // Decode base64 data
            const decodedData = this.base64ToUint8Array(encodedData);
            let jsonString;
            
            if (isCompressed) {
                // Data is marked as compressed, try decompression
                try {
                    jsonString = await this.decompressData(decodedData);
                    console.log('Successfully decompressed data');
                } catch (error) {
                    console.warn('Failed to decompress marked compressed data:', error);
                    throw new Error('Failed to decompress data: ' + error.message);
                }
            } else {
                // Data is uncompressed
                jsonString = new TextDecoder().decode(decodedData);
                console.log('Using uncompressed data');
            }
            
            const tabData = JSON.parse(jsonString);

            // Extract additional URL parameters
            const tempo = params.get('tempo');
            const title = params.get('title');

            if (tempo) {
                tabData.tempo = parseInt(tempo, 10);
            }
            if (title) {
                tabData.title = decodeURIComponent(title);
            }

            console.log('Successfully decoded tab data:', tabData);
            return tabData;

        } catch (error) {
            console.error('Failed to decode tab data:', error);
            return null;
        }
    }

    /**
     * Convert base64 string to Uint8Array
     * @param {string} base64 
     * @returns {Uint8Array}
     */
    static base64ToUint8Array(base64) {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }

    /**
     * Decompress gzipped data using browser's DecompressionStream
     * Falls back to using pako library or assuming uncompressed data
     * @param {Uint8Array} compressedData 
     * @returns {string}
     */
    static async decompressData(compressedData) {
        console.log('Attempting to decompress data of length:', compressedData.length);
        
        try {
            // Check if DecompressionStream is supported (modern browsers)
            if (typeof DecompressionStream !== 'undefined') {
                console.log('Using DecompressionStream');
                const stream = new DecompressionStream('gzip');
                const writer = stream.writable.getWriter();
                const reader = stream.readable.getReader();
                
                writer.write(compressedData);
                writer.close();
                
                const chunks = [];
                let done = false;
                
                while (!done) {
                    const { value, done: readerDone } = await reader.read();
                    done = readerDone;
                    if (value) chunks.push(value);
                }
                
                const decompressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
                let offset = 0;
                for (const chunk of chunks) {
                    decompressed.set(chunk, offset);
                    offset += chunk.length;
                }
                
                const result = new TextDecoder().decode(decompressed);
                console.log('Decompression successful, result length:', result.length);
                return result;
            } else {
                console.warn('DecompressionStream not supported');
                // Try to use pako if available (we can add this library later)
                if (typeof pako !== 'undefined') {
                    console.log('Using pako for decompression');
                    const decompressed = pako.inflate(compressedData, { to: 'string' });
                    return decompressed;
                }
                
                // Last resort: assume data is not compressed
                console.warn('No decompression available, assuming uncompressed data');
                return new TextDecoder().decode(compressedData);
            }
        } catch (error) {
            console.warn('Decompression failed:', error);
            
            // Try pako as fallback if available
            try {
                if (typeof pako !== 'undefined') {
                    console.log('Trying pako as fallback');
                    const decompressed = pako.inflate(compressedData, { to: 'string' });
                    return decompressed;
                }
            } catch (pakoError) {
                console.warn('Pako decompression also failed:', pakoError);
            }
            
            // Final fallback: treat as uncompressed and throw error to let caller handle
            console.warn('All decompression failed');
            throw new Error('Decompression failed, data may be uncompressed');
        }
    }

    /**
     * Validate that the decoded data has the expected structure
     * @param {Object} tabData 
     * @returns {boolean}
     */
    static validateTabData(tabData) {
        console.log('Validating tab data:', tabData);
        
        if (!tabData || typeof tabData !== 'object') {
            console.log('Validation failed: not an object');
            return false;
        }

        // Check for required properties
        if (!tabData.measures || !Array.isArray(tabData.measures)) {
            console.log('Validation failed: no measures array');
            return false;
        }

        console.log('Found', tabData.measures.length, 'measures');

        // Validate measures structure
        for (let i = 0; i < tabData.measures.length; i++) {
            const measure = tabData.measures[i];
            if (!measure || typeof measure !== 'object') {
                console.log(`Validation failed: measure ${i} is not an object`);
                return false;
            }
            
            if (!measure.notes || !Array.isArray(measure.notes)) {
                console.log(`Validation failed: measure ${i} has no notes array`);
                return false;
            }

            console.log(`Measure ${i} has ${measure.notes.length} notes`);

            // Validate note structure
            for (let j = 0; j < measure.notes.length; j++) {
                const note = measure.notes[j];
                if (typeof note.string !== 'number' || 
                    typeof note.fret !== 'number' ||
                    typeof note.beatPosition !== 'number' ||
                    typeof note.beatDuration !== 'number') {
                    console.log(`Validation failed: note ${j} in measure ${i} has invalid structure:`, note);
                    return false;
                }
            }
        }

        console.log('Validation passed!');
        return true;
    }
}

// For backward compatibility and alternative data formats
TabDataDecoder.SUPPORTED_VERSIONS = [1, 2];
TabDataDecoder.DEFAULT_TEMPO = 120;