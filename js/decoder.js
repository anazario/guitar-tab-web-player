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
            const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            console.log('URL fragment (first 100 chars):', fragment.substring(0, 100));
            console.log('Mobile browser detected:', isMobile);
            console.log('URL total length:', window.location.href.length);
            console.log('Fragment length:', fragment.length);
            
            if (!fragment) {
                console.warn('No URL fragment found');
                return null;
            }

            // Check for mobile URL length limits
            if (isMobile && window.location.href.length > 8000) {
                console.warn('URL may exceed mobile browser limits:', window.location.href.length, 'characters');
            }

            // Manual parsing instead of URLSearchParams to avoid potential issues
            let encodedData = null;
            let isCompressed = false;
            
            // Parse data parameter manually
            const dataMatch = fragment.match(/[?&]?data=([^&]*)/);
            if (dataMatch) {
                encodedData = dataMatch[1];
            }
            
            // Parse compressed parameter
            const compressedMatch = fragment.match(/[?&]compressed=([^&]*)/);
            if (compressedMatch) {
                isCompressed = compressedMatch[1] === 'true';
            }
            
            console.log('Manually parsed data length:', encodedData ? encodedData.length : 'null');
            console.log('First 50 chars of encoded data:', encodedData ? encodedData.substring(0, 50) : 'null');
            console.log('Last 50 chars of encoded data:', encodedData ? encodedData.substring(encodedData.length - 50) : 'null');
            console.log('Is compressed:', isCompressed);
            console.log('Pako library available:', typeof pako !== 'undefined');
            console.log('DecompressionStream available:', typeof DecompressionStream !== 'undefined');
            
            if (!encodedData) {
                console.warn('No data parameter found in URL');
                console.log('Fragment content:', fragment);
                return null;
            }

            // URL decode the base64 data (handles +, /, = characters)
            let urlDecodedData;
            try {
                urlDecodedData = decodeURIComponent(encodedData);
                console.log('URL decoded data length:', urlDecodedData.length);
                console.log('URL decoded data ends with:', urlDecodedData.slice(-20));
            } catch (error) {
                console.error('Failed to URL decode data:', error);
                throw new Error('Invalid URL encoding: ' + error.message);
            }

            // Decode base64 data (use URL-decoded version)
            let decodedData;
            try {
                decodedData = this.base64ToUint8Array(urlDecodedData);
                console.log('Base64 decoded to', decodedData.length, 'bytes');
            } catch (error) {
                console.error('Failed to decode base64 data:', error);
                throw new Error('Invalid base64 data: ' + error.message);
            }
            
            let jsonString;
            
            if (isCompressed) {
                // Data is marked as compressed, try decompression
                try {
                    // Add extra logging for mobile debugging
                    console.log('Attempting decompression on mobile:', isMobile);
                    jsonString = await this.decompressData(decodedData);
                    console.log('Successfully decompressed data, result length:', jsonString.length);
                } catch (error) {
                    console.warn('Failed to decompress marked compressed data:', error);
                    
                    // Mobile fallback: try treating as uncompressed data
                    if (isMobile) {
                        console.log('Mobile fallback: attempting to treat compressed data as uncompressed');
                        try {
                            jsonString = new TextDecoder().decode(decodedData);
                            console.log('Mobile fallback successful');
                        } catch (fallbackError) {
                            console.error('Mobile fallback also failed:', fallbackError);
                            throw new Error('Decompression failed and mobile fallback failed: ' + error.message);
                        }
                    } else {
                        throw new Error('Failed to decompress data: ' + error.message);
                    }
                }
            } else {
                // Data is uncompressed
                try {
                    jsonString = new TextDecoder().decode(decodedData);
                    console.log('Using uncompressed data, length:', jsonString.length);
                } catch (error) {
                    console.error('Failed to decode uncompressed data:', error);
                    throw new Error('Failed to decode uncompressed data: ' + error.message);
                }
            }
            
            const tabData = JSON.parse(jsonString);

            // Extract additional URL parameters manually
            const tempoMatch = fragment.match(/[?&]tempo=([^&]*)/);
            const titleMatch = fragment.match(/[?&]title=([^&]*)/);

            if (tempoMatch) {
                tabData.tempo = parseInt(tempoMatch[1], 10);
            }
            if (titleMatch) {
                tabData.title = decodeURIComponent(titleMatch[1]);
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
        try {
            // Clean the base64 string - remove any invalid characters and fix padding
            let cleanBase64 = base64.replace(/[^A-Za-z0-9+/]/g, '');
            
            // Add padding if needed
            while (cleanBase64.length % 4) {
                cleanBase64 += '=';
            }
            
            console.log('Original base64 length:', base64.length);
            console.log('Cleaned base64 length:', cleanBase64.length);
            console.log('Base64 ends with:', base64.slice(-20));
            
            const binaryString = atob(cleanBase64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            return bytes;
        } catch (error) {
            console.error('Base64 decode error:', error);
            console.log('Problematic base64 string (first 100 chars):', base64.substring(0, 100));
            console.log('Problematic base64 string (last 50 chars):', base64.slice(-50));
            throw new Error('Invalid base64 data: ' + error.message);
        }
    }

    /**
     * Decompress gzipped data using browser's DecompressionStream
     * Falls back to using pako library or assuming uncompressed data
     * @param {Uint8Array} compressedData 
     * @returns {string}
     */
    static async decompressData(compressedData) {
        console.log('Attempting to decompress data of length:', compressedData.length);
        const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // Check if pako library loaded properly
        if (typeof pako === 'undefined') {
            console.error('Pako library not available - this may cause decompression to fail on mobile');
            if (isMobile) {
                throw new Error('Compression library not available on mobile browser');
            }
        }
        
        // Debug: Check what format we actually have
        console.log('First 4 bytes:', compressedData[0], compressedData[1], compressedData[2], compressedData[3]);
        console.log('First 4 bytes (hex):', 
            compressedData[0]?.toString(16).padStart(2, '0'),
            compressedData[1]?.toString(16).padStart(2, '0'),
            compressedData[2]?.toString(16).padStart(2, '0'),
            compressedData[3]?.toString(16).padStart(2, '0')
        );
        
        // Auto-detect compression format
        if (compressedData[0] === 0x1f && compressedData[1] === 0x8b) {
            console.log('Detected: gzip format');
            if (typeof pako !== 'undefined') {
                const decompressed = pako.ungzip(compressedData, { to: 'string' });
                console.log('Gzip decompression successful, result length:', decompressed.length);
                return decompressed;
            }
        } else if (compressedData[0] === 0x78) {
            // 0x78 indicates zlib format (various compression levels)
            console.log('Detected: zlib format (header: 0x78 0x' + compressedData[1].toString(16) + ')');
            if (typeof pako !== 'undefined') {
                const decompressed = pako.inflate(compressedData, { to: 'string' });
                console.log('Zlib decompression successful, result length:', decompressed.length);
                return decompressed;
            }
        } else {
            console.log('Detected: raw DEFLATE or uncompressed data');
        }
        
        try {
            // Try pako first since it's more reliable for raw DEFLATE
            if (typeof pako !== 'undefined') {
                console.log('Using pako for raw deflate decompression');
                const decompressed = pako.inflateRaw(compressedData, { to: 'string' });
                console.log('Pako decompression successful, result length:', decompressed.length);
                return decompressed;
            }
            
            // Fallback to DecompressionStream if pako not available
            if (typeof DecompressionStream !== 'undefined') {
                console.log('Using DecompressionStream with deflate-raw');
                const stream = new DecompressionStream('deflate-raw');
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
                console.log('DecompressionStream successful, result length:', result.length);
                return result;
            }
            
            // No decompression available
            console.warn('No decompression available, assuming uncompressed data');
            return new TextDecoder().decode(compressedData);
        } catch (error) {
            console.warn('All decompression methods failed:', error);
            throw new Error('Decompression failed: ' + error.message);
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

        // Check version and handle format differences
        const version = tabData.version || 1;
        console.log('Tab data version:', version);
        
        if (version === 2) {
            // Version 2 format validation
            if (!tabData.instrumentConfig) {
                console.log('Validation failed: version 2 missing instrumentConfig');
                return false;
            }
            
            // Validate instrument config structure
            const config = tabData.instrumentConfig;
            if (!config.name || !config.strings || !Array.isArray(config.strings)) {
                console.log('Validation failed: invalid instrumentConfig structure');
                return false;
            }
            
            console.log('Instrument config:', config.name, 'with', config.strings.length, 'strings');
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