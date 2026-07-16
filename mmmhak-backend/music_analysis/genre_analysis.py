# mmmhak-backend/music_analysis/genre_analysis.py
"""
Module for fetching track tags/genres from the Last.fm API and calculating 
emotional arousal and valence offsets based on the genre weight mappings.
"""

import httpx
from typing import Dict, List, Any

from music_analysis.weights import (
    GENRE_WEIGHTS,
    LASTFM_API_KEY,
    LASTFM_BASE_URL
)
from music_analysis.normalization import clamp

async def fetch_lastfm_tags(title: str, artist: str) -> List[str]:
    """
    Fetches the top tags for a song from the Last.fm track.getInfo API endpoint.
    Returns a list of tags (in lowercase).
    """
    params = {
        "method": "track.getInfo",
        "api_key": LASTFM_API_KEY,
        "artist": artist,
        "track": title,
        "format": "json"
    }
    
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(LASTFM_BASE_URL, params=params, timeout=3.0)
            if res.status_code == 200:
                data = res.json()
                tags_data = data.get("track", {}).get("toptags", {}).get("tag", [])
                if isinstance(tags_data, dict):
                    tags_data = [tags_data]
                return [t.get("name", "").lower().strip() for t in tags_data if t.get("name")]
    except Exception as e:
        print(f"[GenreAnalysis] Last.fm fetch exception for {title} - {artist}: {e}")
    return []

def calculate_genre_offsets(genres: List[str]) -> Dict[str, float]:
    """
    Calculates Arousal and Valence modifiers based on the detected list of genres/tags.
    Substring matching is used to match tags like 'alternative rock' to 'rock'.
    Offsets are averaged and clamped to safe limits [-0.35, 0.35] to avoid value saturation.
    """
    arousal_mods: List[float] = []
    valence_mods: List[float] = []
    matched_genres: List[str] = []
    
    # Pre-defined keys in weight table
    arousal_table = GENRE_WEIGHTS["arousal"]
    valence_table = GENRE_WEIGHTS["valence"]
    
    for tag in genres:
        tag_lower = tag.lower()
        
        # Check Arousal modifiers
        arousal_matched = False
        for g_key, weight in arousal_table.items():
            if g_key in tag_lower:
                arousal_mods.append(weight)
                arousal_matched = True
                if g_key not in matched_genres:
                    matched_genres.append(g_key)
                    
        # Check Valence modifiers
        for g_key, weight in valence_table.items():
            if g_key in tag_lower:
                valence_mods.append(weight)
                if g_key not in matched_genres:
                    matched_genres.append(g_key)
                    
    # Aggregate offsets (average values if multiple matches, default to 0.0)
    final_arousal_offset = sum(arousal_mods) / len(arousal_mods) if arousal_mods else 0.0
    final_valence_offset = sum(valence_mods) / len(valence_mods) if valence_mods else 0.0
    
    # Clamp final modifiers to prevent overloading Arousal-Valence space
    final_arousal_offset = clamp(final_arousal_offset, -0.35, 0.35)
    final_valence_offset = clamp(final_valence_offset, -0.35, 0.35)
    
    return {
        "genre_arousal_offset": round(final_arousal_offset, 4),
        "genre_valence_offset": round(final_valence_offset, 4),
        "matched_genres": matched_genres
    }
