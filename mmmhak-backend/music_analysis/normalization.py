# mmmhak-backend/music_analysis/normalization.py
"""
Utility module for scaling and normalizing different musical features into a standardized [0.0, 1.0] range.
"""

from music_analysis.weights import (
    TEMPO_MIN,
    TEMPO_MAX,
    LOUDNESS_MIN,
    LOUDNESS_MAX
)

def clamp(val: float, min_val: float, max_val: float) -> float:
    """Clamps a numeric value between a minimum and maximum range."""
    return max(min_val, min(val, max_val))

def normalize_tempo(tempo: float) -> float:
    """
    Scales tempo (BPM) into a [0.0, 1.0] range.
    BPM values are clamped to the anchors defined in weights.py.
    """
    try:
        val = float(tempo)
    except (TypeError, ValueError):
        val = 100.0  # Safe default if tempo is invalid
        
    clamped_val = clamp(val, TEMPO_MIN, TEMPO_MAX)
    return (clamped_val - TEMPO_MIN) / (TEMPO_MAX - TEMPO_MIN)

def normalize_loudness(loudness: float) -> float:
    """
    Scales loudness (in dB, typically negative) into a [0.0, 1.0] range.
    Loudness is clamped between LOUDNESS_MIN and LOUDNESS_MAX.
    """
    try:
        val = float(loudness)
    except (TypeError, ValueError):
        val = -8.0  # Safe default if loudness is invalid
        
    clamped_val = clamp(val, LOUDNESS_MIN, LOUDNESS_MAX)
    return (clamped_val - LOUDNESS_MIN) / (LOUDNESS_MAX - LOUDNESS_MIN)

def normalize_lyrics_valence(valence: float) -> float:
    """
    Converts lyrics valence from a [-1.0, 1.0] range into a [0.0, 1.0] range.
    """
    try:
        val = float(valence)
    except (TypeError, ValueError):
        val = 0.0  # Safe neutral default
        
    clamped_val = clamp(val, -1.0, 1.0)
    return (clamped_val + 1.0) / 2.0

def denormalize_valence(val_norm: float) -> float:
    """
    Converts a normalized [0.0, 1.0] valence score back to the [-1.0, 1.0] scale.
    """
    try:
        val = float(val_norm)
    except (TypeError, ValueError):
        val = 0.5
        
    clamped_val = clamp(val, 0.0, 1.0)
    return clamped_val * 2.0 - 1.0
