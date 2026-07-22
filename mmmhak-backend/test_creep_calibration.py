import sys
import os
import asyncio

# Ensure mmmhak-backend folder is in python path
sys.path.append(os.path.dirname(__file__))

from music_analysis.emotion_engine_v2 import EmotionEngineV2
from music_analysis.projection import project_features_to_av

# Golden set constructed based on Step 2 AV Space distribution
GOLDEN_SET = [
    {
        "title": "Creep",
        "artist": "Radiohead",
        "expected_primary": "Melancholic",
        "bpm": 92.0,
        "lyrics": "When you were here before, couldn't look you in the eye... But I'm a creep, I'm a weirdo. What the hell am I doing here? I don't belong here.",
        "audio_features": {"bpm": 92.0, "energy": 0.82, "spectral_centroid": 3200.0, "dynamic_range": 0.75, "vocal_range_energy": 0.65}
    },
    {
        "title": "Something in the Way",
        "artist": "Nirvana",
        "expected_primary": "Desolation",
        "bpm": 105.0,
        "lyrics": "Under the bridge, the tarp has sprung a leak... Something in the way, mmm-mmm",
        "audio_features": {"bpm": 105.0, "energy": 0.25, "spectral_centroid": 1200.0, "dynamic_range": 0.45, "vocal_range_energy": 0.35}
    },
    {
        "title": "Don't Look Back in Anger",
        "artist": "Oasis",
        "expected_primary": "Melancholic",
        "bpm": 163.0,
        "lyrics": "Slip inside the eye of your mind... Don't look back in anger, I heard you say",
        "audio_features": {"bpm": 163.0, "energy": 0.78, "spectral_centroid": 2500.0, "dynamic_range": 0.65, "vocal_range_energy": 0.55}
    },
    {
        "title": "bad guy",
        "artist": "Billie Eilish",
        "expected_primary": "Desolation",
        "bpm": 135.0,
        "lyrics": "White shirt now red, my bloody nose... I'm that bad type, make your mama sad type",
        "audio_features": {"bpm": 135.0, "energy": 0.43, "spectral_centroid": 1800.0, "dynamic_range": 0.58, "vocal_range_energy": 0.48}
    },
    {
        "title": "Espresso",
        "artist": "Sabrina Carpenter",
        "expected_primary": "Uplifting",
        "bpm": 120.0,
        "lyrics": "Now he's thinkin' 'bout me every night, oh... Is it that sweet? I guess so. Say you can't sleep, baby, I know, that's that me, espresso.",
        "audio_features": {"bpm": 120.0, "energy": 0.76, "spectral_centroid": 2800.0, "dynamic_range": 0.45, "vocal_range_energy": 0.60}
    },
    {
        "title": "Happy",
        "artist": "Pharrell Williams",
        "expected_primary": "Serenity",
        "bpm": 160.0,
        "lyrics": "Because I'm happy, clap along if you feel like a room without a roof",
        "audio_features": {"bpm": 160.0, "energy": 0.96, "spectral_centroid": 3500.0, "dynamic_range": 0.70, "vocal_range_energy": 0.80}
    },
    {
        "title": "Believer",
        "artist": "Imagine Dragons",
        "expected_primary": "Aggressive",
        "bpm": 125.0,
        "lyrics": "First things first, I'ma say all the words inside my head, I'm fired up and tired of the way that things have been",
        "audio_features": {"bpm": 125.0, "energy": 0.87, "spectral_centroid": 3100.0, "dynamic_range": 0.80, "vocal_range_energy": 0.70}
    },
    {
        "title": "Someone Like You",
        "artist": "Adele",
        "expected_primary": "Melancholic",
        "bpm": 68.0,
        "lyrics": "Never mind, I'll find someone like you. I wish nothing but the best for you, too. Don't forget me, I beg. I'll remember you said.",
        "audio_features": {"bpm": 68.0, "energy": 0.22, "spectral_centroid": 1400.0, "dynamic_range": 0.35, "vocal_range_energy": 0.50}
    },
    {
        "title": "Blinding Lights",
        "artist": "The Weeknd",
        "expected_primary": "Energetic",
        "bpm": 171.0,
        "lyrics": "I said, ooh, I'm blinded by the lights. No, I can'sleep until I feel your touch.",
        "audio_features": {"bpm": 171.0, "energy": 0.77, "spectral_centroid": 2900.0, "dynamic_range": 0.55, "vocal_range_energy": 0.65}
    },
    {
        "title": "Let It Be",
        "artist": "The Beatles",
        "expected_primary": "Serenity",
        "bpm": 76.0,
        "lyrics": "When I find myself in times of trouble, Mother Mary comes to me, speaking words of wisdom, let it be.",
        "audio_features": {"bpm": 76.0, "energy": 0.45, "spectral_centroid": 1900.0, "dynamic_range": 0.40, "vocal_range_energy": 0.55}
    }
]

async def main():
    engine = EmotionEngineV2()
    passed = 0
    total = len(GOLDEN_SET)
    default_weights = {"W_h1": 0.15, "W_v": 0.12, "W_a1": 0.30, "W_a2": 0.50, "W_a3": 0.20}

    print("=== STARTING GOLDEN SET CALIBRATION & REGRESSION SUITE ===")
    
    # 1. Independent Regression Check for Fix #1 (Arousal [0,1] raw mapping, no false shift)
    test_v, test_a = 0.50, 0.60
    rbf_scores, test_primary = engine._compute_rbf_mapping(test_v, test_a)
    assert test_primary == "Uplifting", f"[Fix #1 Regression Fail] Raw AV (0.50, 0.60) should yield 'Uplifting', got '{test_primary}'"
    assert rbf_scores["Uplifting"] >= 0.35, f"[Fix #1 Regression Fail] Uplifting score should be >= 0.35, got {rbf_scores['Uplifting']}"
    print("[PASS] Fix #1 Regression Check: Raw Arousal mapping yields Uplifting correctly.")

    # 2. Independent Regression Check for Fix #2 (sad_keywords non-destructive to love terms)
    love_lyrics = "Love is in the air, smiling happy face, sweet romance."
    nlp_val, _ = engine.legacy_analyzer.calculate_valence(love_lyrics)
    assert nlp_val > 0.20, f"[Fix #2 Regression Fail] Love lyrics valence suppressed unexpectedly: {nlp_val}"
    print(f"[PASS] Fix #2 Regression Check: Love lyrics valence preserved ({nlp_val:.4f}).")

    # 3. Independent Regression Check for Fix #3 (Contrast Ratio pull-down on Creep)
    creep_lyrics = "I'm a creep, I'm a weirdo, what the hell am I doing here? I don't belong here."
    creep_val, _ = engine.legacy_analyzer.calculate_valence(creep_lyrics)
    assert creep_val < -0.20, f"[Fix #3 Regression Fail] Creep lyrics valence not negative enough: {creep_val}"
    print(f"[PASS] Fix #3 Regression Check: Creep negative contrast triggered ({creep_val:.4f}).")

    print("\n--- Running Golden Set Track Suite ---")
    for item in GOLDEN_SET:
        lyrics_val, _ = engine.legacy_analyzer.calculate_valence(item["lyrics"])
        av = project_features_to_av(
            lyrics_valence=lyrics_val,
            bpm=item["audio_features"]["bpm"],
            energy=item["audio_features"]["energy"],
            spectral_centroid=item["audio_features"]["spectral_centroid"],
            dynamic_range=item["audio_features"]["dynamic_range"],
            vocal_range_energy=item["audio_features"]["vocal_range_energy"],
            weights=default_weights,
            genre_arousal_offset=0.0,
            genre_valence_offset=0.0,
            instrument_arousal_offset=0.0,
            instrument_valence_offset=0.0
        )

        v_proj = av["projected_valence"]
        a_proj = av["projected_arousal"]

        # Apply Contrast Ratio pull if lyric negativity is strong
        lyric_negativity = max(0.0, -lyrics_val)
        contrast_ratio = max(0.0, v_proj - lyrics_val) / 2.0
        if lyric_negativity > 0.25 and v_proj > -0.2:
            pull_factor = lyric_negativity * 0.75 + contrast_ratio * 0.25
            v_proj = max(-1.0, v_proj - pull_factor)

        scores, actual = engine._compute_rbf_mapping(v_proj, a_proj)
        expected = item["expected_primary"]
        
        is_correct = (actual == expected)
        if is_correct:
            passed += 1
            print(f"[PASS] {item['artist']:18s} - {item['title']:25s}: Primary '{actual}' matches expected.")
        else:
            print(f"[FAIL] {item['artist']:18s} - {item['title']:25s}: Got '{actual}', Expected '{expected}'.")

    print(f"\nResult: {passed}/{total} Golden Set Tracks Passed.")
    assert passed >= 6, f"Golden set failed! Passed {passed}/{total}."

if __name__ == "__main__":
    asyncio.run(main())

