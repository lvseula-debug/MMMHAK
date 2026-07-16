# mmmhak-backend/music_analysis/emotion_engine_v2.py
"""
Module for Step 7: Robust Cache & Fallback Layer.
Coordinates Tier 0 to Tier 3 fallback logic and structures response.
"""

import math
import hashlib
import json
import os
import asyncio
from typing import Dict, Any, List, Tuple, Optional

from music_analysis.normalization import normalize_lyrics_valence, clamp
from music_analysis.audio_features import fetch_itunes_preview_url, generate_heuristic_features
from music_analysis.genre_analysis import fetch_lastfm_tags, calculate_genre_offsets
from music_analysis.instrument_analysis import calculate_instrument_offsets
from music_analysis.projection import project_features_to_av
from music_analysis.explanation import generate_reasons, adjust_confidence_for_arousal
from music_analysis.harmonic_analysis import get_fallback_consonance
from music_analysis.cache import MemoryCache


from analyzer import MusicEmotionAnalyzer

class EmotionEngineV2:
    """
    Orchestrates the Emotion Engine 3.0 pipeline with tiered fallback.
    """
    def __init__(self, cache_ttl: int = 3600):
        self.legacy_analyzer = MusicEmotionAnalyzer(use_api_fallback=True)
        self.cache = MemoryCache()
        self.cache_ttl = cache_ttl
        
        # Load weights config
        config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config.json")
        if os.path.exists(config_path):
            try:
                with open(config_path, "r", encoding="utf-8") as f:
                    self.weights = json.load(f)
            except Exception as config_err:
                print(f"[EngineV2] Failed to load config.json: {config_err}. Using defaults.")
                self.weights = {"W_h1": 0.15, "W_h2": 0.10, "W_a1": 0.30, "W_a2": 0.50, "W_a3": 0.20}
        else:
            self.weights = {"W_h1": 0.15, "W_h2": 0.10, "W_a1": 0.30, "W_a2": 0.50, "W_a3": 0.20}

        # Initialize locks table for concurrency control
        self.locks = {}

        
        # Mathematical centers for the RBF Kernel
        self.centers = {
            "happy": (0.65, 0.65),
            "confident": (0.50, 0.85),
            "angry": (-0.60, 0.80),
            "sad": (-0.65, 0.20),
            "lonely": (-0.25, 0.40),
            "love": (0.65, 0.25)
        }
        self.gamma = 2.5

    def _compute_rbf_mapping(self, valence: float, arousal: float) -> Tuple[Dict[str, float], str]:
        """Runs the unmodified RBF kernel mapping to output normalized 6 emotion scores."""
        weights = {}
        # Normalize Arousal from [-1.0, 1.0] back to [0.0, 1.0] for accurate RBF center distance math
        arousal_norm = (arousal + 1.0) / 2.0
        
        for emo, center in self.centers.items():
            dist_sq = (valence - center[0])**2 + (arousal_norm - center[1])**2
            w = math.exp(-self.gamma * dist_sq)
            weights[emo] = w
            
        total = sum(weights.values())
        if total == 0:
            normalized = {emo: 0.1667 for emo in self.centers}
        else:
            normalized = {emo: round(w / total, 4) for emo, w in weights.items()}
            
        # Adjust rounding errors to sum to exactly 1.0000
        diff = round(1.0000 - sum(normalized.values()), 4)
        if diff != 0:
            max_emo = max(normalized, key=normalized.get)
            normalized[max_emo] = round(normalized[max_emo] + diff, 4)
            
        primary_emotion = max(normalized, key=normalized.get)
        return normalized, primary_emotion

    async def analyze_track(
        self,
        lyrics: str,
        title: str,
        artist: str,
        bpm: float,
        preview_url: Optional[str] = None,
        audio_features: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:
        """
        Executes emotion analysis using Hybrid Client-side extraction & 2-phase orchestration:
        Phase 1: Zero-shot Lyrics analysis & CORS Pre-Flag setup
        Phase 2: Concurrency-locked math projection fusing client features with config weights
        """
        # Step A: Base NLP lyrics valence analysis
        try:
            lyrics_valence, lyrics_confidence = self.legacy_analyzer.calculate_valence(lyrics)
        except Exception as e:
            print(f"[EngineV2] Lyrics analysis exception: {e}. Defaulting to neutral.")
            lyrics_valence, lyrics_confidence = 0.0, 0.50
            
        lyrics_valence_norm = normalize_lyrics_valence(lyrics_valence)
        
        # Determine iTunes preview URL if not provided
        resolved_preview_url = preview_url
        if not resolved_preview_url:
            resolved_preview_url = await fetch_itunes_preview_url(title, artist)

        # Derive unified single track_id cache key
        track_id = resolved_preview_url.split("/")[-1].split(".")[0] if resolved_preview_url else f"track_{title.lower()}_{artist.lower()}"
        cache_key = track_id

        # Phase 1: Client has not sent browser audio features yet (Quick un-locked pre-flag response)
        if not audio_features:
            print(f"[EngineV2] [Phase 1] Returning lyrics valence & CORS Pre-Flag for {artist} - {title}.")
            return {
                "is_cached": False,
                "useProxy": True,  # Force backend CORS audio-proxy bypass
                "previewUrl": resolved_preview_url,
                "lyrics_valence": lyrics_valence,
                "lyrics_confidence": lyrics_confidence
            }

        # Phase 2: Client sent audio features. Critical section using asyncio.Lock on track_id
        lock = self.locks.setdefault(cache_key, asyncio.Lock())
        async with lock:
            # Double-Check cache inside lock to prevent redundant in-flight API calls
            cached_result = self.cache.get(cache_key)
            if cached_result:
                print(f"[EngineV2] [CACHE HIT (Double-Check)] {artist} - {title}")
                cached_result["is_cached"] = True
                return cached_result

            print(f"[EngineV2] [CACHE MISS - Phase 2 Lock Acquired] Fusing features for {artist} - {title}: {audio_features}")
            tier_used = 1

            # Fetch Last.fm genre tags
            lastfm_tags = []
            lastfm_failed = False
            try:
                lastfm_tags = await fetch_lastfm_tags(title, artist)
            except Exception as e:
                print(f"[EngineV2] Last.fm fetch failed: {e}")
                lastfm_failed = True

            genre_info = calculate_genre_offsets(lastfm_tags)

            # Normalize client-side features and pad missing MIR properties for downstream logic safety
            normalized_features = {
                "tempo": float(audio_features.get("bpm", bpm)),
                "energy": float(audio_features.get("energy", 0.5)),
                "spectral_centroid": float(audio_features.get("spectral_centroid", 2000.0)),
                "dynamic_range": float(audio_features.get("dynamic_range", 0.5)),
                "vocal_range_energy": float(audio_features.get("vocal_range_energy", 0.4)),
                "danceability": 0.5,
                "acousticness": 0.5,
                "instrumentalness": 0.1,
                "speechiness": 0.1,
                "loudness": -8.0,
                "consonance": 0.65,
                "valence": 0.5
            }

            # Calculate instrument contribution using padded feature object
            instrument_info = calculate_instrument_offsets(normalized_features)

            # --- Feature Fusion & Projection Layer ---
            av_projection = project_features_to_av(
                lyrics_valence=lyrics_valence,
                bpm=normalized_features["tempo"],
                energy=normalized_features["energy"],
                spectral_centroid=normalized_features["spectral_centroid"],
                dynamic_range=normalized_features["dynamic_range"],
                vocal_range_energy=normalized_features["vocal_range_energy"],
                weights=self.weights,  # Pass JSON loaded weights
                genre_valence_offset=genre_info["genre_valence_offset"],
                genre_arousal_offset=genre_info["genre_arousal_offset"],
                instrument_valence_offset=instrument_info["instrument_valence_offset"],
                instrument_arousal_offset=instrument_info["instrument_arousal_offset"]
            )
            
            projected_valence = av_projection["projected_valence"]
            projected_arousal = av_projection["projected_arousal"]
            
            # --- Existing RBF Kernel Execution ---
            emotion_ratios, primary_emotion = self._compute_rbf_mapping(projected_valence, projected_arousal)
            
            # --- Explainable Analysis Generation ---
            reasons = generate_reasons(
                lyrics_valence=lyrics_valence,
                bpm=normalized_features["tempo"],
                normalized_features=normalized_features,
                genre_info=genre_info,
                instrument_info=instrument_info
            )
            
            # Step 3: Low Arousal confidence penalty adjustment
            final_confidence = adjust_confidence_for_arousal(lyrics_confidence, projected_arousal)

            # --- Format to exact JSON spec ---
            scores_obj = {
                "happy": float(emotion_ratios["happy"]),
                "confident": float(emotion_ratios["confident"]),
                "angry": float(emotion_ratios["angry"]),
                "sad": float(emotion_ratios["sad"]),
                "lonely": float(emotion_ratios["lonely"]),
                "love": float(emotion_ratios["love"]),
                "primary_emotion": primary_emotion,
                "confidence": final_confidence,
                "insufficient_data": False,
                "no_info": False
            }
            
            advanced_analysis = {
                "engine_version": "3.0_hybrid_client",
                "tier_used": tier_used,
                "projection": {
                    "valence": projected_valence,
                    "arousal": projected_arousal
                },
                "explainable_hints": reasons
            }
            
            output = {
                "track_id": track_id,
                "scores": scores_obj,
                "advanced_analysis": advanced_analysis,
                "is_cached": True,
                
                # Duplicate top-level keys for 100% React client compatibility safety
                "happy": scores_obj["happy"],
                "sad": scores_obj["sad"],
                "angry": scores_obj["angry"],
                "lonely": scores_obj["lonely"],
                "love": scores_obj["love"],
                "confident": scores_obj["confident"],
                "primary_emotion": scores_obj["primary_emotion"],
                "confidence": final_confidence,
                "derived_valence": projected_valence,
                "derived_arousal": projected_arousal,
                "insufficient_data": False,
                "no_info": False
            }
            
            # Save to Cache with explicit 30 days (2592000s) TTL
            self.cache.set(cache_key, output, ttl=2592000)
            return output
