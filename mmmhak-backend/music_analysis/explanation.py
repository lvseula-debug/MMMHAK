from typing import Dict, List, Any
from music_analysis.weights import LOW_AROUSAL_PENALTY, AROUSAL_THRESHOLD
from music_analysis.normalization import clamp

def adjust_confidence_for_arousal(base_confidence: float, arousal: float) -> float:
    """
    Applies a penalty to the confidence score if the projected arousal is 
    below AROUSAL_THRESHOLD. Low-arousal emotions are inherently harder 
    to classify, reducing model confidence.
    """
    if arousal < AROUSAL_THRESHOLD:
        penalty = LOW_AROUSAL_PENALTY * (AROUSAL_THRESHOLD - arousal)
        adjusted = base_confidence - penalty
        return round(float(clamp(adjusted, 0.0, 1.0)), 3)
    return round(float(base_confidence), 3)


def generate_reasons(
    lyrics_valence: float,
    bpm: float,
    normalized_features: Dict[str, float],
    genre_info: Dict[str, Any],
    instrument_info: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """
    Constructs a list of reason metadata objects explaining the contributions 
    of various modalities to the overall emotion classification.
    """
    reasons: List[Dict[str, Any]] = []
    
    # 1. Lyrics explanation
    lyrics_status = "neutral"
    if lyrics_valence > 0.25:
        lyrics_status = "joyful"
    elif lyrics_valence < -0.25:
        lyrics_status = "melancholic"
        
    reasons.append({
        "feature": "lyrics",
        "status": lyrics_status,
        "score": round(lyrics_valence, 3)
    })
    
    # 2. Tempo explanation
    tempo_status = "moderate"
    if bpm < 85.0:
        tempo_status = "slow"
    elif bpm > 125.0:
        tempo_status = "fast"
        
    reasons.append({
        "feature": "tempo",
        "status": tempo_status,
        "score": round(bpm, 1)
    })
    
    # 3. Audio Features explanations (Energy, Acousticness, Danceability)
    energy = normalized_features.get("energy", 0.5)
    energy_status = "moderate"
    if energy > 0.65:
        energy_status = "high"
    elif energy < 0.35:
        energy_status = "low"
        
    reasons.append({
        "feature": "audio_energy",
        "status": energy_status,
        "score": round(energy, 3)
    })
        
    acousticness = normalized_features.get("acousticness", 0.0)
    if acousticness > 0.6:
        reasons.append({
            "feature": "acousticness",
            "status": "high",
            "score": round(acousticness, 3)
        })
        
    danceability = normalized_features.get("danceability", 0.0)
    if danceability > 0.65:
        reasons.append({
            "feature": "danceability",
            "status": "groovy",
            "score": round(danceability, 3)
        })
        
    # 4. Genre modifiers
    matched_genres = genre_info.get("matched_genres", [])
    genre_valence = genre_info.get("genre_valence_offset", 0.0)
    genre_arousal = genre_info.get("genre_arousal_offset", 0.0)
    
    for genre in matched_genres[:2]:
        genre_score = genre_valence if abs(genre_valence) > abs(genre_arousal) else genre_arousal
        reasons.append({
            "feature": "genre",
            "status": genre,
            "score": round(genre_score, 3)
        })
        
    # 5. Instrument modifiers
    detected_instruments = instrument_info.get("detected_instruments", [])
    inst_valence = instrument_info.get("instrument_valence_offset", 0.0)
    inst_arousal = instrument_info.get("instrument_arousal_offset", 0.0)
    
    for inst in detected_instruments[:2]:
        if inst != "unknown":
            inst_score = inst_valence if abs(inst_valence) > abs(inst_arousal) else inst_arousal
            reasons.append({
                "feature": "instrument",
                "status": inst,
                "score": round(inst_score, 3)
            })
            
    return reasons
