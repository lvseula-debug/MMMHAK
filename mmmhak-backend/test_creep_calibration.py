import sys
import os
import asyncio

# Ensure mmmhak-backend folder is in python path
sys.path.append(os.path.dirname(__file__))

from music_analysis.emotion_engine_v2 import EmotionEngineV2

async def main():
    engine = EmotionEngineV2()
    
    # Mock parameters representing Creep by Radiohead
    title = "Creep"
    artist = "Radiohead"
    bpm = 92.0
    lyrics = """
    When you were here before, couldn't look you in the eye
    You're just like an angel, your skin makes me cry
    You float like a feather in a beautiful world
    I wish I was special, you're so very special
    But I'm a creep, I'm a weirdo
    What the hell am I doing here? I don't belong here
    """
    
    # Run analysis without audio features (Phase 1)
    phase1_res = await engine.analyze_track(
        lyrics=lyrics,
        title=title,
        artist=artist,
        bpm=bpm
    )
    print("Phase 1 response matches expected structure:", "previewUrl" in phase1_res)
    
    # Run analysis with audio features (Phase 2)
    # Energy spike representing the heavy chorus distortion
    audio_features = {
        "bpm": bpm,
        "energy": 0.82,
        "spectral_centroid": 3200.0,
        "dynamic_range": 0.75,
        "vocal_range_energy": 0.65
    }
    
    phase2_res = await engine.analyze_track(
        lyrics=lyrics,
        title=title,
        artist=artist,
        bpm=bpm,
        audio_features=audio_features
    )
    
    print("\nPhase 2 Response (Creep calibrated):")
    print("Scores:")
    for k, v in phase2_res["scores"].items():
        print(f"  {k}: {v}")
        
    print("\nTop-level Psychoacoustic 6-Axis:")
    print("  Uplifting:", phase2_res["Uplifting"])
    print("  Energetic:", phase2_res["Energetic"])
    print("  Aggressive:", phase2_res["Aggressive"])
    print("  Melancholic:", phase2_res["Melancholic"])
    print("  Desolation:", phase2_res["Desolation"])
    print("  Serenity:", phase2_res["Serenity"])
    
    # Assertions
    # Melancholic (sad) and Desolation (lonely) should be significant
    assert phase2_res["Melancholic"] > 0.20, "Melancholic score should be calibrated higher"
    assert phase2_res["Desolation"] > 0.15, "Desolation score should be calibrated higher"
    # Uplifting (love) and Serenity (happy) should be suppressed
    assert phase2_res["Uplifting"] < 0.20, "Uplifting score should be suppressed"
    assert phase2_res["Serenity"] < 0.20, "Serenity score should be suppressed"
    
    print("\nAll assertions passed successfully!")

if __name__ == "__main__":
    asyncio.run(main())
