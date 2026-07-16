# mmmhak-backend/music_analysis/projection.py
"""
Module for Step 5: Advanced Projection Layer.
Fuses lyrics valence, tempo, energy, dynamicRange (flux variance), 
vocalRangeEnergy, and offsets onto a 2D Arousal-Valence space in the range [-1.0, 1.0].
"""

from typing import Dict, Any
from music_analysis.normalization import clamp

def project_features_to_av(
    lyrics_valence: float,             # range [-1.0, 1.0]
    bpm: float,                        # raw BPM value
    energy: float,                     # range [0.0, 1.0]
    spectral_centroid: float,          # raw frequency in Hz
    dynamic_range: float,              # range [0.0, 1.0] (Spectral Flux variance)
    vocal_range_energy: float,         # range [0.0, 1.0] (500Hz - 1600Hz ratio)
    weights: Dict[str, float],         # config-loaded mathematical weights
    genre_valence_offset: float = 0.0,
    genre_arousal_offset: float = 0.0,
    instrument_valence_offset: float = 0.0,
    instrument_arousal_offset: float = 0.0
) -> Dict[str, float]:
    """
    Projects lyrics valence and refined sound parameters onto [-1.0, 1.0] AV space.
    
    [Offset Math & Rationale]:
    - Genre Offsets (genre_valence_offset, genre_arousal_offset):
      * Concept: Calculated using prior statistical averages from Last.fm tag databases to anchor specific genre moods.
      * Example: Heavy Metal gains arousal +0.15 to reflect intense genre norms, whereas Ambient/Classical subtracts arousal -0.20.
    - Instrument Offsets (instrument_valence_offset, instrument_arousal_offset):
      * Concept: Adjusts emotion space based on timbre configuration of detected instrument classes.
      * Example: Acoustic piano tracks add valence +0.10 (positiveness), whereas distorted heavy electric guitars add arousal +0.12 (tension).
      
    Formulas:
      Centroid_Norm = clamp(spectral_centroid / 8000.0, 0.0, 1.0)
      Valence = V_lyrics + (W_h1 * Centroid_Norm) + (W_v * vocalRangeEnergy) + (genre_val_off + inst_val_off)
      Arousal = (W_a1 * BPM_Norm) + (W_a2 * Energy) + (W_a3 * dynamicRange) + (genre_aro_off + inst_aro_off)
    """
    W_h1 = weights.get("W_h1", 0.15)
    W_v  = weights.get("W_v", 0.12)
    W_a1 = weights.get("W_a1", 0.30)
    W_a2 = weights.get("W_a2", 0.50)
    W_a3 = weights.get("W_a3", 0.20)
    
    # 1. Normalize Spectral Centroid (assuming high-bright range up to 8000 Hz)
    centroid_norm = clamp(spectral_centroid / 8000.0, 0.0, 1.0)
    
    # 2. Valence Projection [-1.0, 1.0]
    valence_base = lyrics_valence + (W_h1 * centroid_norm) + (W_v * vocal_range_energy)
    valence_fused = valence_base + genre_valence_offset + instrument_valence_offset
    projected_valence = clamp(valence_fused, -1.0, 1.0)
    
    # 3. Arousal Projection [-1.0, 1.0]
    tempo_norm = clamp((bpm - 60.0) / 120.0, 0.0, 1.0)
    
    # Fused Arousal formula incorporating dynamicRange (Spectral Flux variance)
    arousal_base = (W_a1 * tempo_norm) + (W_a2 * energy) + (W_a3 * dynamic_range)
    arousal_fused = arousal_base + genre_arousal_offset + instrument_arousal_offset
    projected_arousal = clamp(arousal_fused, -1.0, 1.0)
    
    return {
        "projected_arousal": round(projected_arousal, 4),
        "projected_valence": round(projected_valence, 4)
    }
