/**
 * src/utils/audioAnalyzer.js
 * 
 * Browser-side Web Audio API based Music Information Retrieval (MIR) feature extractor.
 * Decodes m4a preview audio and extracts Energy (RMS), Spectral Centroid, 
 * Vocal Range Energy (500Hz - 1600Hz), and dynamicRange (Spectral Flux Variance).
 * Returns safe fallback values if any error occurs.
 */

const FALLBACK_VALUES = {
  energy: 0.5,
  spectralCentroid: 2000.0,
  dynamicRange: 0.5,
  vocalRangeEnergy: 0.4
};

/**
 * Computes Spectral Centroid (Hz) of a Float32Array channel buffer using a Cooley-Tukey FFT.
 */
function getSpectralCentroid(channelData, sampleRate) {
  const fftSize = 2048;
  const numSamples = channelData.length;
  const numHops = 5;
  const hopSize = Math.floor((numSamples - fftSize) / (numHops + 1));

  let totalCentroid = 0;
  let validHops = 0;

  for (let h = 1; h <= numHops; h++) {
    const startIdx = h * hopSize;
    const re = new Float32Array(fftSize);
    const im = new Float32Array(fftSize);

    // Apply Hanning Window to target segment
    for (let i = 0; i < fftSize; i++) {
      const w = 0.5 * (1.0 - Math.cos((2.0 * Math.PI * i) / (fftSize - 1)));
      re[i] = channelData[startIdx + i] * w;
      im[i] = 0.0;
    }

    // In-place Cooley-Tukey FFT
    performFFT(re, im);

    let weightedSum = 0;
    let magnitudeSum = 0;

    // Use only the positive frequency half (Nyquist limit)
    for (let i = 0; i < fftSize / 2; i++) {
      const freq = (i * sampleRate) / fftSize;
      const mag = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
      weightedSum += freq * mag;
      magnitudeSum += mag;
    }

    if (magnitudeSum > 1e-5) {
      totalCentroid += weightedSum / magnitudeSum;
      validHops++;
    }
  }

  return validHops > 0 ? totalCentroid / validHops : FALLBACK_VALUES.spectralCentroid;
}

/**
 * Performs in-place Cooley-Tukey FFT.
 */
function performFFT(re, im) {
  const n = re.length;
  
  // Safe bit-reversal permutation (prevents infinite loop)
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      let temp = re[i];
      re[i] = re[j];
      re[j] = temp;
      temp = im[i];
      im[i] = im[j];
      im[j] = temp;
    }
    let k = n >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }

  // Butterfly operations
  let size = 2;
  while (size <= n) {
    const halfsize = size >> 1;
    const tablestep = n / size;
    for (let i = 0; i < n; i += size) {
      for (let j = i, k = 0; j < i + halfsize; j++, k += tablestep) {
        const angle = (-2.0 * Math.PI * k) / n;
        const wr = Math.cos(angle);
        const wi = Math.sin(angle);
        const tRe = re[j + halfsize] * wr - im[j + halfsize] * wi;
        const tIm = re[j + halfsize] * wi + im[j + halfsize] * wr;
        
        re[j + halfsize] = re[j] - tRe;
        im[j + halfsize] = im[j] - tIm;
        re[j] += tRe;
        im[j] += tIm;
      }
    }
    size <<= 1;
  }
}

/**
 * Step 1: Vocal Range Energy (500Hz - 1600Hz) ratio extractor.
 */
export function calculateVocalRangeEnergy(analyserNode) {
  try {
    if (!analyserNode) return FALLBACK_VALUES.vocalRangeEnergy;
    const sampleRate = analyserNode.context.sampleRate;
    const fftSize = analyserNode.fftSize || 2048;
    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    
    analyserNode.getFloatFrequencyData(dataArray);
    
    let vocalEnergy = 0;
    let totalEnergy = 0;
    
    const binLow = Math.floor((500 * fftSize) / sampleRate);
    const binHigh = Math.min(bufferLength - 1, Math.ceil((1600 * fftSize) / sampleRate));
    
    for (let i = 0; i < bufferLength; i++) {
      const mag = Math.pow(10, dataArray[i] / 20);
      const energy = mag * mag;
      totalEnergy += energy;
      if (i >= binLow && i <= binHigh) {
        vocalEnergy += energy;
      }
    }
    
    if (totalEnergy > 1e-6) {
      return Math.max(0.0, Math.min(1.0, vocalEnergy / totalEnergy));
    }
    return FALLBACK_VALUES.vocalRangeEnergy;
  } catch (err) {
    console.error("[audioAnalyzer] calculateVocalRangeEnergy error, returning fallback.", err);
    return FALLBACK_VALUES.vocalRangeEnergy;
  }
}

/**
 * Main entry point: Extracts MIR features from m4a ArrayBuffer in browser.
 */
export async function analyzeAudioData(arrayBuffer) {
  let audioCtx = null;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Decode m4a binary payload
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0); // Left channel PCM data
    const sampleRate = audioBuffer.sampleRate;

    // 1. RMS Energy Calculation
    let sumSq = 0;
    for (let i = 0; i < channelData.length; i++) {
      sumSq += channelData[i] * channelData[i];
    }
    const rms = Math.sqrt(sumSq / channelData.length);
    const energy = Math.max(0.0, Math.min(rms * 5.0, 1.0)); // Scale to normalized [0.0, 1.0]

    // 2. Spectral Centroid Calculation
    const spectralCentroid = getSpectralCentroid(channelData, sampleRate);

    // 3. Spectral Flux & dynamicRange, Vocal Range Energy (FFT analysis loops)
    const fftSize = 1024;
    const hopSize = 512;
    const numSamples = channelData.length;
    
    let previousMags = new Float32Array(fftSize / 2);
    let fluxes = [];
    let vocalEnergies = [];

    const binLow = Math.floor((500 * fftSize) / sampleRate);
    const binHigh = Math.ceil((1600 * fftSize) / sampleRate);

    for (let offset = 0; offset + fftSize <= numSamples; offset += hopSize) {
      const re = new Float32Array(fftSize);
      const im = new Float32Array(fftSize);

      // Windowing & copy
      for (let i = 0; i < fftSize; i++) {
        const w = 0.5 * (1.0 - Math.cos((2.0 * Math.PI * i) / (fftSize - 1)));
        re[i] = channelData[offset + i] * w;
        im[i] = 0.0;
      }

      performFFT(re, im);

      let currentMags = new Float32Array(fftSize / 2);
      let localVocalEnergy = 0;
      let localTotalEnergy = 0;
      let fluxSum = 0;

      for (let i = 0; i < fftSize / 2; i++) {
        const mag = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
        currentMags[i] = mag;
        
        const eng = mag * mag;
        localTotalEnergy += eng;
        if (i >= binLow && i <= binHigh) {
          localVocalEnergy += eng;
        }

        // Flux computation
        const diff = currentMags[i] - previousMags[i];
        fluxSum += diff * diff;
      }

      if (offset > 0) {
        fluxes.push(fluxSum);
      }
      
      if (localTotalEnergy > 1e-6) {
        vocalEnergies.push(localVocalEnergy / localTotalEnergy);
      }

      previousMags = currentMags;
    }

    // Dynamic Range calculation (Spectral Flux Variance, 90th clipping linear mapping)
    let avgFlux = 0;
    if (fluxes.length > 0) {
      avgFlux = fluxes.reduce((a, b) => a + b, 0) / fluxes.length;
    }
    let varianceFlux = 0;
    if (fluxes.length > 0) {
      varianceFlux = fluxes.reduce((sum, f) => sum + (f - avgFlux) * (f - avgFlux), 0) / fluxes.length;
    }

    // Logarithmic scaling to mirror natural hearing dB perception and prevent clamping (Min=0.5, Max=13.0)
    const logVar = Math.log(varianceFlux + 1.0);
    const dynamicRange = Math.max(0.0, Math.min(1.0, (logVar - 0.5) / (13.0 - 0.5)));

    // Vocal Range Energy average ratio
    let vocalRangeEnergy = FALLBACK_VALUES.vocalRangeEnergy;
    if (vocalEnergies.length > 0) {
      vocalRangeEnergy = vocalEnergies.reduce((a, b) => a + b, 0) / vocalEnergies.length;
    }

    // Cleanup AudioContext
    if (audioCtx && audioCtx.close) {
      await audioCtx.close();
    }

    return { 
      energy, 
      spectralCentroid, 
      dynamicRange: round(dynamicRange, 4), 
      vocalRangeEnergy: round(vocalRangeEnergy, 4) 
    };
  } catch (error) {
    console.error("[audioAnalyzer] MIR extraction failed. Returning fallbacks.", error);
    if (audioCtx && audioCtx.close) {
      try {
        await audioCtx.close();
      } catch { /* ignore */ }
    }
    return FALLBACK_VALUES;
  }
}

function round(val, prec) {
  return parseFloat(val.toFixed(prec));
}
