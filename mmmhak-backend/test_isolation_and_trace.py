import sys
import os
import asyncio
import math

sys.path.append(os.path.dirname(__file__))

from music_analysis.emotion_engine_v2 import EmotionEngineV2
from music_analysis.projection import project_features_to_av

# 1. fix #1 Rollback Test (Isolate Arousal Re-normalization)
def test_fix1_rollback():
    centers = {
        "Serenity": (0.75, 0.40),
        "Energetic": (0.10, 0.85),
        "Aggressive": (-0.35, 0.85),
        "Melancholic": (-0.35, 0.72),
        "Desolation": (-0.55, 0.35),
        "Uplifting": (0.50, 0.60)
    }
    gamma = 3.0

    # Test track with moderate positive valence (0.50) and low/mid arousal (0.35)
    v, a = 0.50, 0.35

    # Fixed behavior: arousal_norm = float(a) = 0.35
    w_fixed = {emo: math.exp(-gamma * ((v - c[0])**2 + (a - c[1])**2)) for emo, c in centers.items()}
    tot_fixed = sum(w_fixed.values())
    scores_fixed = {k: round(v / tot_fixed, 4) for k, v in w_fixed.items()}

    # Rolled-back behavior: arousal_norm = (a + 1.0) / 2.0 = 0.675
    a_rolled = (a + 1.0) / 2.0
    w_rolled = {emo: math.exp(-gamma * ((v - c[0])**2 + (a_rolled - c[1])**2)) for emo, c in centers.items()}
    tot_rolled = sum(w_rolled.values())
    scores_rolled = {k: round(v / tot_rolled, 4) for k, v in w_rolled.items()}

    print("=== [ISOLATION TEST: Fix #1 Rollback vs Fixed] ===")
    print(f"Input: projected_valence={v}, projected_arousal={a}")
    print(f"  FIXED   (raw [0,1] arousal=0.350): Uplifting = {scores_fixed['Uplifting']:.4f} | Primary = {max(scores_fixed, key=scores_fixed.get)}")
    print(f"  ROLLED  (shifted [0.5,1] a=0.675): Uplifting = {scores_rolled['Uplifting']:.4f} | Primary = {max(scores_rolled, key=scores_rolled.get)}")
    print(f"  -> Uplifting score drop under rollback: {((scores_fixed['Uplifting'] - scores_rolled['Uplifting'])/scores_fixed['Uplifting']) * 100:.1f}%")
    print("====================================================\n")

# 2. Step-by-Step Pipeline Trace for Love/Uplifting Tracks
async def trace_love_tracks():
    engine = EmotionEngineV2()
    love_tracks = [
        {
            "title": "Espresso",
            "artist": "Sabrina Carpenter",
            "lyrics": "Now he's thinkin' 'bout me every night, oh... Is it that sweet? I guess so. Say you can't sleep, baby, I know, that's that me, espresso. Walk in the room, love is in the air.",
            "audio_features": {"bpm": 120.0, "energy": 0.76, "spectral_centroid": 2800.0, "dynamic_range": 0.45, "vocal_range_energy": 0.60}
        },
        {
            "title": "Cruel Summer",
            "artist": "Taylor Swift",
            "lyrics": "Fever dream high in the quiet of the night, you know that I caught it. Bad, bad boy, shiny toy with a price, you know that I bought it. It's a cruel summer with you, I love you, ain't that the worst thing you ever heard?",
            "audio_features": {"bpm": 170.0, "energy": 0.70, "spectral_centroid": 3000.0, "dynamic_range": 0.50, "vocal_range_energy": 0.65}
        }
    ]

    print("=== [STEP-BY-STEP PIPELINE TRACE FOR LOVE / UPLIFTING TRACKS] ===")
    default_weights = {"W_h1": 0.15, "W_v": 0.12, "W_a1": 0.30, "W_a2": 0.50, "W_a3": 0.20}

    for track in love_tracks:
        lyrics_val, confidence = engine.legacy_analyzer.calculate_valence(track["lyrics"])
        av = project_features_to_av(
            lyrics_valence=lyrics_val,
            bpm=track["audio_features"]["bpm"],
            energy=track["audio_features"]["energy"],
            spectral_centroid=track["audio_features"]["spectral_centroid"],
            dynamic_range=track["audio_features"]["dynamic_range"],
            vocal_range_energy=track["audio_features"]["vocal_range_energy"],
            weights=default_weights,
            genre_arousal_offset=0.0,
            genre_valence_offset=0.0,
            instrument_arousal_offset=0.0,
            instrument_valence_offset=0.0
        )
        v_proj = av["projected_valence"]
        a_proj = av["projected_arousal"]

        # RBF Distance to Uplifting Center (0.50, 0.60)
        uplifting_center = engine.centers["Uplifting"]
        dist_sq = (v_proj - uplifting_center[0])**2 + (a_proj - uplifting_center[1])**2
        raw_act = math.exp(-engine.gamma * dist_sq)

        scores, primary = engine._compute_rbf_mapping(v_proj, a_proj)

        print(f"\nTrack: {track['artist']} - {track['title']}")
        print(f"  Step 1. NLP Lyrics Valence: {lyrics_val:.4f} (Confidence: {confidence:.2f})")
        print(f"  Step 2. Fused Projected AV: Valence={v_proj:.4f}, Arousal={a_proj:.4f}")
        print(f"  Step 3. Distance to Uplifting Center {uplifting_center}: dist_sq={dist_sq:.4f}, raw_activation={raw_act:.4f}")
        print(f"  Step 4. Final 6-Axis RBF Scores:")
        for emo, sc in scores.items():
            print(f"          - {emo:12s}: {sc:.4f}")
        print(f"  Step 5. Determined Primary Emotion: '{primary}'")

if __name__ == "__main__":
    test_fix1_rollback()
    asyncio.run(trace_love_tracks())
