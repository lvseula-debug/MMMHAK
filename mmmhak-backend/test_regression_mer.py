import sys
import os
import asyncio

# Ensure mmmhak-backend folder is in python path
sys.path.append(os.path.dirname(__file__))

from music_analysis.emotion_engine_v2 import EmotionEngineV2

async def run_regression_tests():
    engine = EmotionEngineV2()
    
    test_cases = [
        {
            "title": "Creep",
            "artist": "Radiohead",
            "bpm": 92.0,
            "lyrics": """
            When you were here before, couldn't look you in the eye
            You're just like an angel, your skin makes me cry
            You float like a feather in a beautiful world
            I wish I was special, you're so very special
            But I'm a creep, I'm a weirdo
            What the hell am I doing here? I don't belong here
            """,
            "audio_features": {
                "bpm": 92.0,
                "energy": 0.82,
                "spectral_centroid": 3200.0,
                "dynamic_range": 0.75,
                "vocal_range_energy": 0.65
            }
        },
        {
            "title": "Something in the Way",
            "artist": "Nirvana",
            "bpm": 105.0,
            "lyrics": """
            Under the bridge, the tarp has sprung a leak
            And the animals I've trapped have all become my pets
            And I'm living off of grass and the drippings from the ceiling
            It's okay to eat fish 'cause they don't have any feelings
            Something in the way, mmm-mmm
            """,
            "audio_features": {
                "bpm": 105.0,
                "energy": 0.25,
                "spectral_centroid": 1200.0,
                "dynamic_range": 0.45,
                "vocal_range_energy": 0.35
            }
        },
        {
            "title": "Don't Look Back in Anger",
            "artist": "Oasis",
            "bpm": 163.0,
            "lyrics": """
            Slip inside the eye of your mind
            Don't you know you might find a better place to play?
            You said that you'd never been
            But all the things that you've seen slowly fade away
            So I start a revolution from my bed
            'Cause you said the brains I had went to my head
            """,
            "audio_features": {
                "bpm": 163.0,
                "energy": 0.78,
                "spectral_centroid": 2500.0,
                "dynamic_range": 0.65,
                "vocal_range_energy": 0.55
            }
        },
        {
            "title": "bad guy",
            "artist": "Billie Eilish",
            "bpm": 135.0,
            "lyrics": """
            White shirt now red, my bloody nose
            Sleepin', you're on your tippy toes
            Creepin' around like no one knows
            Think you're so criminal
            Bruises on both my knees for you
            I'm that bad type, make your mama sad type, make your girlfriend mad tight
            """,
            "audio_features": {
                "bpm": 135.0,
                "energy": 0.43,
                "spectral_centroid": 1800.0,
                "dynamic_range": 0.58,
                "vocal_range_energy": 0.48
            }
        }
    ]

    print("=== STARTING MER REGRESSION TEST SUITE ===")
    
    passed_all = True
    
    for case in test_cases:
        print(f"\nAnalyzing: {case['artist']} - {case['title']}")
        res = await engine.analyze_track(
            lyrics=case["lyrics"],
            title=case["title"],
            artist=case["artist"],
            bpm=case["bpm"],
            audio_features=case["audio_features"]
        )
        
        # Build 6-axis ratings list
        ratings = [
            ("Uplifting", res["Uplifting"]),
            ("Energetic", res["Energetic"]),
            ("Aggressive", res["Aggressive"]),
            ("Melancholic", res["Melancholic"]),
            ("Desolation", res["Desolation"]),
            ("Serenity", res["Serenity"])
        ]
        
        # Sort descending by score
        sorted_ratings = sorted(ratings, key=lambda x: x[1], reverse=True)
        top_2 = [r[0] for r in sorted_ratings[:2]]
        
        print("6-Axis Scores:")
        for name, score in ratings:
            print(f"  {name}: {score:.4f}")
        print(f"Top 2 Emotions: {top_2}")
        
        try:
            assert "Serenity" not in top_2, f"FAILED: 'Serenity' is in the top 2 emotions ({top_2})!"
            print(f"PASS: 'Serenity' is not in the top 2 for {case['title']}.")
        except AssertionError as e:
            print(e)
            passed_all = False
            
    print("\n==========================================")
    if passed_all:
        print("ALL REGRESSION TESTS PASSED SUCCESSFULLY!")
        sys.exit(0)
    else:
        print("REGRESSION TEST SUITE FAILED!")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(run_regression_tests())
