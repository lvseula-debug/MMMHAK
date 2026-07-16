# mmmhak-backend/music_analysis/instrument_analysis.py
"""
Module for estimating the presence of major instruments (Piano, Guitar, Electric Guitar, 
Strings, Bass, Drum, Brass, Synth, Vocal) based on normalized Spotify audio features, 
and calculating the emotional offsets.
"""

from typing import Dict, Any, List, Optional

from music_analysis.weights import INSTRUMENT_WEIGHTS
from music_analysis.normalization import clamp

# Supported instruments list
SUPPORTED_INSTRUMENTS = [
    "piano",
    "acoustic_guitar",
    "electric_guitar",
    "strings",
    "bass",
    "drum",
    "brass",
    "synth",
    "vocal"
]

def estimate_instruments_from_features(normalized_features: Dict[str, float]) -> Dict[str, float]:
    """
    Estimates the activation scores (0.0 to 1.0) of various instruments 
    based solely on normalized audio features.
    Does not use genre metadata.
    """
    ac = normalized_features.get("acousticness", 0.5)
    en = normalized_features.get("energy", 0.5)
    da = normalized_features.get("danceability", 0.5)
    ins = normalized_features.get("instrumentalness", 0.0)
    sp = normalized_features.get("speechiness", 0.0)
    
    # 1. Piano: High acousticness, low energy, low speechiness
    piano = ac * (1.0 - en) * (1.0 - sp) * 0.9
    
    # 2. Acoustic Guitar: Moderate-high acousticness, moderate energy, moderate danceability
    acoustic_guitar = ac * en * (1.0 - ins * 0.3) * 0.8
    
    # 3. Electric Guitar: Low acousticness, high energy, low speechiness
    electric_guitar = (1.0 - ac) * en * (1.0 - sp) * 0.75
    
    # 4. Strings: High acousticness, low danceability, low speechiness
    strings = ac * (1.0 - da) * (1.0 - sp) * 0.85
    
    # 5. Bass: Low acousticness, high energy, high danceability
    bass = (1.0 - ac) * en * da * 0.8
    
    # 6. Drum: High energy, high danceability, low acousticness
    drum = en * da * (1.0 - ac * 0.5) * 0.9
    
    # 7. Brass: Moderate acousticness, moderate energy, moderate danceability
    brass = ac * en * da * 0.6
    
    # 8. Synth: Low acousticness, high instrumentalness, moderate energy
    synth = (1.0 - ac) * (0.2 + ins * 0.8) * (1.0 - sp) * 0.8
    
    # 9. Vocal: Low instrumentalness, moderate speechiness
    vocal = (1.0 - ins) * (0.75 + sp * 0.25)
    
    activations = {
        "piano": clamp(piano, 0.0, 1.0),
        "acoustic_guitar": clamp(acoustic_guitar, 0.0, 1.0),
        "electric_guitar": clamp(electric_guitar, 0.0, 1.0),
        "strings": clamp(strings, 0.0, 1.0),
        "bass": clamp(bass, 0.0, 1.0),
        "drum": clamp(drum, 0.0, 1.0),
        "brass": clamp(brass, 0.0, 1.0),
        "synth": clamp(synth, 0.0, 1.0),
        "vocal": clamp(vocal, 0.0, 1.0)
    }
    
    return {k: round(v, 4) for k, v in activations.items()}

def calculate_instrument_offsets(normalized_features: Optional[Dict[str, float]]) -> Dict[str, Any]:
    """
    Calculates the combined arousal and valence offsets from estimated instruments.
    If features are missing or invalid, returns unknown instrument profile with 0.0 weights.
    Offsets are clamped to safe limits [-0.25, 0.25] to prevent value saturation.
    """
    if not normalized_features:
        # Fallback to Unknown Instrument
        return {
            "instrument_arousal_offset": 0.0,
            "instrument_valence_offset": 0.0,
            "detected_instruments": ["unknown"]
        }
        
    activations = estimate_instruments_from_features(normalized_features)
    
    # Select active instruments (activation threshold >= 0.35)
    detected_instruments = [inst for inst, score in activations.items() if score >= 0.35]
    if not detected_instruments:
        detected_instruments = ["unknown"]
        
    arousal_offset = 0.0
    valence_offset = 0.0
    
    arousal_table = INSTRUMENT_WEIGHTS["arousal"]
    valence_table = INSTRUMENT_WEIGHTS["valence"]
    
    for inst, score in activations.items():
        # Only apply offset if the instrument activation is prominent (>= 0.35)
        if score >= 0.35:
            # Weighted offset by the activation intensity
            if inst in arousal_table:
                arousal_offset += arousal_table[inst] * score
            if inst in valence_table:
                valence_offset += valence_table[inst] * score
                
    # Average the offsets by number of active instruments if any
    active_count = len([inst for inst, score in activations.items() if score >= 0.35])
    if active_count > 0:
        arousal_offset /= active_count
        valence_offset /= active_count
        
    # Clamp final modifiers to prevent overloading Arousal-Valence space
    arousal_offset = clamp(arousal_offset, -0.25, 0.25)
    valence_offset = clamp(valence_offset, -0.25, 0.25)
    
    return {
        "instrument_arousal_offset": round(arousal_offset, 4),
        "instrument_valence_offset": round(valence_offset, 4),
        "detected_instruments": detected_instruments,
        "instrument_scores": activations
    }
