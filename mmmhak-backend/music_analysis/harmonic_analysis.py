# mmmhak-backend/music_analysis/harmonic_analysis.py
"""
Module for Step 1: Harmonic Analysis.
Calculates the Consonance Score (TotalConsonance) of an audio signal 
using Pitch Class Interval Consonance Weights from a chromagram.
Provides key/mode-based fallback values when raw audio is unavailable.
"""

import numpy as np
import librosa
from typing import Dict, Any, Optional

# Pitch Interval Consonance Weights based on psychoacoustic consonance perception
# 0: Unison/Octave (most consonant), 6: Tritone (most dissonant)
INTERVAL_CONSONANCE_WEIGHTS: Dict[int, float] = {
    0: 1.00,  # Unison / Octave
    1: 0.05,  # Minor 2nd
    2: 0.25,  # Major 2nd
    3: 0.70,  # Minor 3rd
    4: 0.85,  # Major 3rd
    5: 0.80,  # Perfect 4th
    6: 0.00,  # Tritone
    7: 0.95,  # Perfect 5th
    8: 0.60,  # Minor 6th
    9: 0.75,  # Major 6th
    10: 0.30, # Minor 7th
    11: 0.10  # Major 7th
}

def calculate_chroma_consonance(y: np.ndarray, sr: int) -> float:
    """
    Computes a Total Consonance score in [0.0, 1.0] from raw audio time series.
    Extracts CENS chromagram, averages over time, and calculates the pairwise
    consonance of pitch class distributions.
    """
    try:
        # Extract CENS chromagram (stable against noise/dynamics)
        chroma = librosa.feature.chroma_cens(y=y, sr=sr)
        
        # Average chromagram over time
        mean_chroma = chroma.mean(axis=1)
        
        # Normalize to form a probability distribution over the 12 pitch classes
        chroma_sum = mean_chroma.sum()
        if chroma_sum == 0:
            return 0.65  # Neutral default consonance
            
        c_prob = mean_chroma / chroma_sum
        
        # Compute pairwise interval consonance score
        total_consonance = 0.0
        for i in range(12):
            for j in range(12):
                interval = (j - i) % 12
                weight = INTERVAL_CONSONANCE_WEIGHTS[interval]
                total_consonance += c_prob[i] * c_prob[j] * weight
                
        # Scale and clamp to [0.0, 1.0]
        # In practice, even highly consonant music has a mixed chroma probability,
        # so we scale the raw value to stretch the range.
        scaled_consonance = (total_consonance - 0.3) / 0.5
        return float(np.clip(scaled_consonance, 0.0, 1.0))
        
    except Exception as e:
        print(f"[HarmonicAnalysis] Error calculating consonance from audio: {e}")
        return 0.65

def get_fallback_consonance(mode: Optional[str]) -> float:
    """
    Returns a deterministic consonance score fallback based on track mode / key.
    Major modes are highly consonant, while minor modes are less consonant.
    """
    if not mode:
        return 0.65  # Neutral default consonance
        
    mode_lower = mode.lower().strip()
    if "major" in mode_lower or mode_lower == "1":
        return 0.75  # Consonant major key fallback
    elif "minor" in mode_lower or mode_lower == "0":
        return 0.55  # Slightly dissonant minor key fallback
        
    return 0.65
