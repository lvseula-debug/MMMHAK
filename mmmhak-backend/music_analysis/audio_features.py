# mmmhak-backend/music_analysis/audio_features.py
"""
Module for Heuristic and Metadata Audio Features.
Provides iTunes previewUrl fetching and heuristic features fallback.
All native librosa decoding and temporary file usage are purged for serverless compatibility.
"""

import httpx
from typing import Dict, Any, List, Optional
from music_analysis.normalization import normalize_tempo, normalize_loudness, clamp
from music_analysis.weights import AUDIO_AROUSAL_WEIGHTS, AUDIO_VALENCE_WEIGHTS

async def fetch_itunes_preview_url(title: str, artist: str) -> Optional[str]:
    """
    Queries the iTunes Search API to find the song and retrieve its previewUrl.
    """
    url = "https://itunes.apple.com/search"
    params = {
        "term": f"{artist} {title}",
        "entity": "song",
        "limit": 1
    }
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(url, params=params, timeout=4.0)
            if res.status_code == 200:
                results = res.json().get("results", [])
                if results:
                    return results[0].get("previewUrl")
    except Exception as e:
        print(f"[AudioFeatures] iTunes search failed for {title} - {artist}: {e}")
    return None

def generate_heuristic_features(bpm: float, genres: List[str]) -> Dict[str, float]:
    """
    Generates a realistic fallback set of normalized audio features based on the 
    BPM and genre tags.
    """
    genre_set = {g.lower() for g in genres}
    
    # 1. Acousticness
    acousticness = 0.2
    if any(g in genre_set for g in ["acoustic", "folk", "classical", "jazz", "ballad"]):
        acousticness = 0.8
    elif any(g in genre_set for g in ["metal", "edm", "electronic", "dance", "synthpop", "hip-hop", "rap"]):
        acousticness = 0.05
        
    # 2. Instrumentalness
    instrumentalness = 0.02
    if any(g in genre_set for g in ["classical", "ambient", "soundtrack"]):
        instrumentalness = 0.8
    elif any(g in genre_set for g in ["lo-fi", "electronic", "house", "techno"]):
        instrumentalness = 0.4
        
    # 3. Speechiness
    speechiness = 0.05
    if any(g in genre_set for g in ["hip-hop", "rap", "trap", "spoken word"]):
        speechiness = 0.35
        
    # 4. Energy
    bpm_factor = min(1.0, max(0.0, (bpm - 60.0) / 100.0))
    if any(g in genre_set for g in ["metal", "punk", "hardcore", "edm", "electronic", "dance"]):
        energy = 0.70 + bpm_factor * 0.30
    elif any(g in genre_set for g in ["classical", "ambient", "lo-fi", "ballad", "acoustic"]):
        energy = 0.15 + bpm_factor * 0.25
    else:
        energy = 0.40 + bpm_factor * 0.40
    energy = clamp(energy, 0.0, 1.0)
    
    # 5. Loudness (dB)
    loudness = -20.0 + energy * 18.0
    loudness = clamp(loudness, -60.0, 0.0)
    
    # 6. Danceability
    danceability = 0.4
    if any(g in genre_set for g in ["edm", "electronic", "dance", "disco", "house", "techno"]):
        danceability = 0.80
    elif any(g in genre_set for g in ["hip-hop", "rap", "r&b", "pop"]):
        danceability = 0.70
    elif any(g in genre_set for g in ["classical", "ambient"]):
        danceability = 0.15
    danceability = clamp(danceability, 0.0, 1.0)
    
    # 7. Valence
    valence = 0.5
    if any(g in genre_set for g in ["happy", "pop", "disco", "dance"]):
        valence = 0.75
    elif any(g in genre_set for g in ["sad", "melancholy", "depressive", "dark"]):
        valence = 0.20
        
    # 8. Fallback Consonance
    consonance = 0.65
        
    return {
        "tempo": bpm,
        "energy": energy,
        "loudness": loudness,
        "danceability": danceability,
        "acousticness": acousticness,
        "instrumentalness": instrumentalness,
        "speechiness": speechiness,
        "consonance": consonance,
        "valence": valence
    }

def compute_raw_audio_scores(features: Dict[str, Any]) -> Dict[str, Any]:
    """
    Computes base arousal and valence scores using normalized anchors and custom weight factors.
    """
    tempo = float(features.get("tempo", 100.0))
    loudness = float(features.get("loudness", -8.0))
    
    norm_tempo = normalize_tempo(tempo)
    norm_loudness = normalize_loudness(loudness)
    
    norm_energy = clamp(float(features.get("energy", 0.5)), 0.0, 1.0)
    norm_dance = clamp(float(features.get("danceability", 0.5)), 0.0, 1.0)
    norm_acoustic = clamp(float(features.get("acousticness", 0.5)), 0.0, 1.0)
    norm_val = clamp(float(features.get("valence", 0.5)), 0.0, 1.0)
    norm_instr = clamp(float(features.get("instrumentalness", 0.0)), 0.0, 1.0)
    norm_speech = clamp(float(features.get("speechiness", 0.0)), 0.0, 1.0)
    
    # Calculate weighted Arousal
    arousal = (
        AUDIO_AROUSAL_WEIGHTS["tempo"] * norm_tempo +
        AUDIO_AROUSAL_WEIGHTS["energy"] * norm_energy +
        AUDIO_AROUSAL_WEIGHTS["loudness"] * norm_loudness +
        AUDIO_AROUSAL_WEIGHTS["danceability"] * norm_dance
    )
    
    # Calculate weighted Valence
    val_contrib = AUDIO_VALENCE_WEIGHTS["valence"] * norm_val + AUDIO_VALENCE_WEIGHTS["energy"] * norm_energy
    acoust_contrib = AUDIO_VALENCE_WEIGHTS["acousticness"] * norm_acoustic
    valence = val_contrib + acoust_contrib
    
    arousal_clamped = clamp(arousal, 0.0, 1.0)
    valence_clamped = clamp(valence, 0.0, 1.0)
    
    return {
        "arousal": round(arousal_clamped, 4),
        "valence": round(valence_clamped, 4),
        "normalized": {
            "tempo": round(norm_tempo, 4),
            "energy": round(norm_energy, 4),
            "loudness": round(norm_loudness, 4),
            "danceability": round(norm_dance, 4),
            "acousticness": round(norm_acoustic, 4),
            "instrumentalness": round(norm_instr, 4),
            "speechiness": round(norm_speech, 4),
            "valence": round(norm_val, 4)
        }
    }
