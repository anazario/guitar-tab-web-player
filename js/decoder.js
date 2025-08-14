/**
 * Guitar Tab Web Player - URL Data Decoder
 * Handles decompression and parsing of tab data from URL fragments
 */

class TabDataDecoder {
    /**
     * Extract and decode tab data from the current URL
     * @returns {Object|null} Decoded tab data or null if invalid
     */
    static decodeFromURL() {
        try {
            const fragment = window.location.hash.substring(1);
            if (!fragment) {
                console.warn('No URL fragment found');
                return null;
            }

            const params = new URLSearchParams(fragment);
            const encodedData = params.get('data');
            
            if (!encodedData) {
                console.warn('No data parameter found in URL');
                return null;
            }

            // Decode base64 and decompress
            const compressedData = this.base64ToUint8Array(encodedData);
            const jsonString = this.decompressData(compressedData);
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
     * Falls back to assuming uncompressed data if decompression fails
     * @param {Uint8Array} compressedData 
     * @returns {string}
     */
    static async decompressData(compressedData) {
        try {
            // Check if DecompressionStream is supported (modern browsers)
            if (typeof DecompressionStream !== 'undefined') {
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
                
                return new TextDecoder().decode(decompressed);
            } else {
                // Fallback: assume data is not compressed (for older browsers)
                console.warn('DecompressionStream not supported, assuming uncompressed data');
                return new TextDecoder().decode(compressedData);
            }
        } catch (error) {
            console.warn('Decompression failed, trying as uncompressed data:', error);
            // Fallback to treating as uncompressed
            return new TextDecoder().decode(compressedData);
        }
    }

    /**
     * Validate that the decoded data has the expected structure
     * @param {Object} tabData 
     * @returns {boolean}
     */
    static validateTabData(tabData) {
        if (!tabData || typeof tabData !== 'object') {
            return false;
        }

        // Check for required properties
        if (!tabData.measures || !Array.isArray(tabData.measures)) {
            return false;
        }

        // Validate measures structure
        for (const measure of tabData.measures) {
            if (!measure || typeof measure !== 'object') {
                return false;
            }
            
            if (!measure.notes || !Array.isArray(measure.notes)) {
                return false;
            }

            // Validate note structure
            for (const note of measure.notes) {
                if (typeof note.string !== 'number' || 
                    typeof note.fret !== 'number' ||
                    typeof note.beatPosition !== 'number' ||
                    typeof note.beatDuration !== 'number') {
                    return false;
                }
            }
        }

        return true;
    }
}

// For backward compatibility and alternative data formats
TabDataDecoder.SUPPORTED_VERSIONS = [1, 2];
TabDataDecoder.DEFAULT_TEMPO = 120;