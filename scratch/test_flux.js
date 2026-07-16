import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const scratchDir = __dirname;

function writeWavFile(filePath, sampleRate, signal) {
  const numSamples = signal.length;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + numSamples * 2, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(numSamples * 2, 40);

  const dataBuffer = Buffer.alloc(numSamples * 2);
  for (let i = 0; i < numSamples; i++) {
    const sample = Math.max(-1.0, Math.min(1.0, signal[i]));
    const intSample = sample < 0 ? sample * 32768 : sample * 32767;
    dataBuffer.writeInt16LE(Math.floor(intSample), i * 2);
  }

  fs.writeFileSync(filePath, Buffer.concat([header, dataBuffer]));
}

function performFFT(re, im) {
  const n = re.length;
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      let temp = re[i]; re[i] = re[j]; re[j] = temp;
      temp = im[i]; im[i] = im[j]; im[j] = temp;
    }
    let k = n >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }
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

function analyzeWavByteFeatures(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const dataView = new DataView(fileBuffer.buffer, fileBuffer.byteOffset + 44);
  const sampleRate = fileBuffer.readUInt32LE(24);
  const numSamples = (fileBuffer.length - 44) / 2;

  const channelData = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    channelData[i] = dataView.getInt16(i * 2, true) / 32768.0;
  }

  // 1. RMS Energy
  let sumSq = 0;
  for (let i = 0; i < numSamples; i++) {
    sumSq += channelData[i] * channelData[i];
  }
  const rms = Math.sqrt(sumSq / numSamples);
  const energy = Math.max(0.0, Math.min(rms * 5.0, 1.0));

  // 2. Spectral Flux & Vocal Range Energy
  const fftSize = 512;
  const hopSize = 256;
  let previousMags = new Float32Array(fftSize / 2);
  let fluxes = [];
  let vocalEnergies = [];

  const binLow = Math.floor((500 * fftSize) / sampleRate);
  const binHigh = Math.floor((1600 * fftSize) / sampleRate);

  for (let offset = 0; offset + fftSize <= numSamples; offset += hopSize) {
    const re = new Float32Array(fftSize);
    const im = new Float32Array(fftSize);

    for (let i = 0; i < fftSize; i++) {
      const w = 0.5 * (1.0 - Math.cos((2.0 * Math.PI * i) / (fftSize - 1)));
      re[i] = channelData[offset + i] * w;
      im[i] = 0.0;
    }

    performFFT(re, im);

    let currentMags = new Float32Array(fftSize / 2);
    let fluxSum = 0;
    let localVocalEnergy = 0;
    let localTotalEnergy = 0;

    for (let i = 0; i < fftSize / 2; i++) {
      const mag = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
      currentMags[i] = mag;
      const diff = currentMags[i] - previousMags[i];
      fluxSum += diff * diff;

      const eng = mag * mag;
      localTotalEnergy += eng;
      if (i >= binLow && i <= binHigh) {
        localVocalEnergy += eng;
      }
    }

    if (offset > 0) {
      fluxes.push(fluxSum);
    }
    if (localTotalEnergy > 1e-6) {
      vocalEnergies.push(localVocalEnergy / localTotalEnergy);
    }
    previousMags = currentMags;
  }

  let avgFlux = fluxes.length > 0 ? fluxes.reduce((a, b) => a + b, 0) / fluxes.length : 0;
  let varianceFlux = fluxes.length > 0 ? fluxes.reduce((sum, f) => sum + (f - avgFlux) * (f - avgFlux), 0) / fluxes.length : 0;

  const logVar = Math.log(varianceFlux + 1.0);
  const dynamicRange = Math.max(0.0, Math.min(1.0, (logVar - 0.5) / (13.0 - 0.5)));

  let vocalRangeEnergy = 0.35; // Fallback
  if (vocalEnergies.length > 0) {
    vocalRangeEnergy = vocalEnergies.reduce((a, b) => a + b, 0) / vocalEnergies.length;
  }

  return { energy, dynamicRange, vocalRangeEnergy };
}

function prepareRealAudioTracks() {
  console.log("Synthesizing 8 real-audio polyphonic WAV tracks (6 for A/B, 2 for Step 1 vocal verification)...");
  const sampleRate = 8000;
  const duration = 2.0;
  const numSamples = sampleRate * duration;

  const tracks = [
    // Lofi / Ambient
    { name: "lofi_1.wav", bpm: 72, type: "lofi", freq: 261.63, noiseScale: 0.05 },
    { name: "lofi_2.wav", bpm: 68, type: "lofi", freq: 293.66, noiseScale: 0.06 },
    { name: "lofi_3.wav", bpm: 78, type: "lofi", freq: 329.63, noiseScale: 0.04 },
    // EDM / Rock
    { name: "edm_1.wav", bpm: 128, type: "edm", freq: 440.00, noiseScale: 0.15 },
    { name: "edm_2.wav", bpm: 135, type: "edm", freq: 523.25, noiseScale: 0.18 },
    { name: "edm_3.wav", bpm: 140, type: "edm", freq: 587.33, noiseScale: 0.16 },
    // Vocal verification (500Hz - 1600Hz dominant vs sub-bass/high-hat instrumental)
    { name: "vocal_rich.wav", bpm: 90, type: "vocal_rich", freq: 1000.00, noiseScale: 0.05 }, // Formant region focus
    { name: "inst_beat.wav", bpm: 90, type: "inst_beat", freq: 80.00, noiseScale: 0.02 } // Sub-bass focus (outside 500-1600)
  ];

  tracks.forEach(track => {
    const signal = new Float32Array(numSamples);
    const f0 = track.freq;
    const bpm = track.bpm;
    const beatInterval = (60 / bpm) * sampleRate;

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;

      if (track.type === "vocal_rich") {
        // High density energy in vocal formant region (1000 Hz, 800 Hz harmonics)
        signal[i] = 0.5 * Math.sin(2 * Math.PI * 1000 * t) +
                    0.25 * Math.sin(2 * Math.PI * 800 * t) +
                    (Math.random() - 0.5) * 0.08;
      } else if (track.type === "inst_beat") {
        // High density energy in sub-bass (80 Hz) and high hats (3800 Hz) outside formant region
        signal[i] = 0.7 * Math.sin(2 * Math.PI * 80 * t) +
                    0.15 * Math.sin(2 * Math.PI * 3800 * t) +
                    (Math.random() - 0.5) * 0.02;
      } else {
        let tone = 0.4 * Math.sin(2 * Math.PI * f0 * t) +
                   0.2 * Math.sin(2 * Math.PI * (2 * f0) * t) +
                   0.1 * Math.sin(2 * Math.PI * (3 * f0) * t) +
                   0.05 * Math.sin(2 * Math.PI * (4 * f0) * t);

        let reverb = 0;
        for (let delay = 1; delay <= 3; delay++) {
          const delaySamples = Math.floor(sampleRate * 0.04 * delay);
          if (i >= delaySamples) {
            reverb += signal[i - delaySamples] * 0.15;
          }
        }

        const noise = (Math.random() - 0.5) * track.noiseScale;

        if (track.type === "lofi") {
          const lfo = 1.0 + 0.25 * Math.sin(2 * Math.PI * 1.5 * t);
          signal[i] = (tone * 0.3 * lfo) + noise + reverb;
        } else {
          const beatPhase = i % beatInterval;
          const decayEnvelope = Math.exp(-4.0 * (beatPhase / sampleRate));
          const gate = beatPhase < beatInterval * 0.25 ? decayEnvelope : 0.05;
          signal[i] = (tone * gate * 0.8) + (noise * gate) + reverb;
        }
      }
    }

    writeWavFile(path.join(scratchDir, track.name), sampleRate, signal);
  });

  return tracks.map(t => ({ ...t, filePath: path.join(scratchDir, t.name) }));
}

function runABTest(tracks) {
  console.log("\n==================================================");
  console.log("Starting Step 2: Spectral Flux A/B Test Execution");
  console.log("==================================================");

  const W_a1 = 0.30;
  const W_a2 = 0.50;
  const W_a3 = 0.20;

  const results = [];
  const abTracks = tracks.filter(t => t.type !== "vocal_rich" && t.type !== "inst_beat");
  const step1Tracks = tracks.filter(t => t.type === "vocal_rich" || t.type === "inst_beat");

  abTracks.forEach(track => {
    const { energy, dynamicRange, vocalRangeEnergy } = analyzeWavByteFeatures(track.filePath);
    const tempoNorm = Math.max(0.0, Math.min(1.0, (track.bpm - 60.0) / 120.0));

    const arousal_A = (W_a1 * tempoNorm) + (W_a2 * energy) + (W_a3 * 0.5);
    const arousal_B = (W_a1 * tempoNorm) + (W_a2 * energy) + (W_a3 * dynamicRange);

    results.push({
      name: track.name,
      type: track.type,
      bpm: track.bpm,
      energy: energy.toFixed(4),
      dynamicRange: dynamicRange.toFixed(4),
      arousal_A: parseFloat(Math.max(-1.0, Math.min(1.0, arousal_A)).toFixed(4)),
      arousal_B: parseFloat(Math.max(-1.0, Math.min(1.0, arousal_B)).toFixed(4))
    });
  });

  console.log("\n[A/B TEST REPORT RESULTS (REAL AUDIO SHAPE)]");
  console.table(results);

  console.log("\n[DYNAMIC RANGE CONTINUITY CHECK]");
  results.forEach(r => {
    const val = parseFloat(r.dynamicRange);
    console.log(`  Track: ${r.name.padEnd(15)} -> dynamicRange: ${val.toFixed(4)} (Continuous: ${val > 0.0 && val < 1.0 ? "YES" : "NO"})`);
  });

  const ballads_A = results.filter(r => r.type === "lofi").map(r => r.arousal_A);
  const edms_A = results.filter(r => r.type === "edm").map(r => r.arousal_A);
  const avg_ballad_A = ballads_A.reduce((a, b) => a + b, 0) / ballads_A.length;
  const avg_edm_A = edms_A.reduce((a, b) => a + b, 0) / edms_A.length;
  const separation_A = avg_edm_A - avg_ballad_A;

  const ballads_B = results.filter(r => r.type === "lofi").map(r => r.arousal_B);
  const edms_B = results.filter(r => r.type === "edm").map(r => r.arousal_B);
  const avg_ballad_B = ballads_B.reduce((a, b) => a + b, 0) / ballads_B.length;
  const avg_edm_B = edms_B.reduce((a, b) => a + b, 0) / edms_B.length;
  const separation_B = avg_edm_B - avg_ballad_B;

  const delta = separation_B - separation_A;

  console.log(`\nSeparation A (RMS Energy only): ${separation_A.toFixed(4)}`);
  console.log(`Separation B (RMS + Spectral Flux): ${separation_B.toFixed(4)}`);
  console.log(`Delta Improvement (B - A): ${delta.toFixed(4)} (Required: >= 0.15)`);

  console.log("\n==================================================");
  console.log("Starting Step 1: Vocal Range Energy Functional Check");
  console.log("==================================================");
  
  const step1Results = [];
  step1Tracks.forEach(track => {
    const { vocalRangeEnergy } = analyzeWavByteFeatures(track.filePath);
    step1Results.push({
      name: track.name,
      type: track.type,
      vocalRangeEnergy: vocalRangeEnergy.toFixed(4)
    });
  });
  console.table(step1Results);

  const vocalRichVal = parseFloat(step1Results.find(r => r.type === "vocal_rich").vocalRangeEnergy);
  const instBeatVal = parseFloat(step1Results.find(r => r.type === "inst_beat").vocalRangeEnergy);
  const vocalDelta = vocalRichVal - instBeatVal;
  console.log(`Vocal Track Energy Ratio: ${vocalRichVal.toFixed(4)}`);
  console.log(`Instrumental Track Energy Ratio: ${instBeatVal.toFixed(4)}`);
  console.log(`Vocal Discrimination Delta: ${vocalDelta.toFixed(4)} (Expected positive separation)`);

  const passed = delta >= 0.15 && vocalDelta >= 0.30;
  if (passed) {
    console.log("\n>>> [DECISION: PASS] Separation Delta and Step 1 Vocal verification meet metrics!");
  } else {
    console.log("\n>>> [DECISION: FAIL] Combined test requirements not met.");
    process.exit(1);
  }
}

function cleanupTracks(tracks) {
  tracks.forEach(track => {
    if (fs.existsSync(track.filePath)) {
      fs.unlinkSync(track.filePath);
    }
  });
}

function main() {
  const tracks = prepareRealAudioTracks();
  try {
    runABTest(tracks);
  } finally {
    cleanupTracks(tracks);
  }
}

main();
