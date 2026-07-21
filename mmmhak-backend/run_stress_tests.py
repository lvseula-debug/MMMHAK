import sys
import os
import asyncio

# Ensure mmmhak-backend folder is in python path
sys.path.append(os.path.dirname(__file__))

from music_analysis.emotion_engine_v2 import EmotionEngineV2

async def run_stress_tests():
    engine = EmotionEngineV2()
    
    test_cases = [
        # === 1. 메이저 화성 + 우울한 가사 ===
        {
            "category": "Major Scale + Sad Lyrics",
            "title": "Creep",
            "artist": "Radiohead",
            "bpm": 92.0,
            "lyrics": "When you were here before, couldn't look you in the eye. You float like a feather in a beautiful world. But I'm a creep, I'm a weirdo. What the hell am I doing here? I don't belong here. She's running out the door. She runs, runs, runs.",
            "audio_features": {"bpm": 92.0, "energy": 0.82, "spectral_centroid": 3200.0, "dynamic_range": 0.75, "vocal_range_energy": 0.65}
        },
        {
            "category": "Major Scale + Sad Lyrics",
            "title": "Something in the Way",
            "artist": "Nirvana",
            "bpm": 105.0,
            "lyrics": "Under the bridge, the tarp has sprung a leak. And the animals I've trapped have all become my pets. And I'm living off of grass and the drippings from the ceiling. Something in the way, mmm-mmm.",
            "audio_features": {"bpm": 105.0, "energy": 0.25, "spectral_centroid": 1200.0, "dynamic_range": 0.45, "vocal_range_energy": 0.35}
        },
        {
            "category": "Major Scale + Sad Lyrics",
            "title": "Hurt",
            "artist": "Johnny Cash",
            "bpm": 90.0,
            "lyrics": "I hurt myself today to see if I still feel. I focus on the pain, the only thing that's real. The needle tears a hole, the old familiar sting. Try to kill it all away, but I remember everything. What have I become, my sweetest friend? Everyone I know goes away in the end.",
            "audio_features": {"bpm": 90.0, "energy": 0.30, "spectral_centroid": 1400.0, "dynamic_range": 0.50, "vocal_range_energy": 0.45}
        },
        {
            "category": "Major Scale + Sad Lyrics",
            "title": "Between the Bars",
            "artist": "Elliott Smith",
            "bpm": 85.0,
            "lyrics": "Drink up, baby, stay up all night. With the things you could do, you won't but you might. The potential you'll be that you'll never see. The promises you'll only make. Drink up with me now and forget all about the pressure of days.",
            "audio_features": {"bpm": 85.0, "energy": 0.22, "spectral_centroid": 1000.0, "dynamic_range": 0.38, "vocal_range_energy": 0.30}
        },
        # === 2. 업템포 + 이별/상실 가사 ===
        {
            "category": "Uptempo + Heartbreak Lyrics",
            "title": "Hey Ya!",
            "artist": "OutKast",
            "bpm": 120.0,
            "lyrics": "My baby don't mess around because she loves me so. But does she really wanna but can't stand to see me walk out the door? Don't try to fight the feeling, 'cause the thought of being alone is hurting. Are we still in love? Is it just a lie we keep holding on to?",
            "audio_features": {"bpm": 120.0, "energy": 0.88, "spectral_centroid": 2800.0, "dynamic_range": 0.60, "vocal_range_energy": 0.55}
        },
        {
            "category": "Uptempo + Heartbreak Lyrics",
            "title": "Dancing On My Own",
            "artist": "Robyn",
            "bpm": 117.0,
            "lyrics": "Somebody said you got a new friend. Does she love you better than I can? There's a big black sky over my town. I know where you at, I bet she's around. I'm in the corner, watching you kiss her, oh. I'm giving it my all, but I'm not the girl you're taking home. I keep dancing on my own.",
            "audio_features": {"bpm": 117.0, "energy": 0.85, "spectral_centroid": 2600.0, "dynamic_range": 0.62, "vocal_range_energy": 0.58}
        },
        {
            "category": "Uptempo + Heartbreak Lyrics",
            "title": "Pumped Up Kicks",
            "artist": "Foster the People",
            "bpm": 128.0,
            "lyrics": "Robert's got a quick hand. He'll look around the room, he won't tell you his plan. He's got a rolled cigarette hanging out his mouth. Yeah, he found a six-shooter gun. All the other kids with the pumped up kicks, you'd better run, better run, outrun my gun.",
            "audio_features": {"bpm": 128.0, "energy": 0.72, "spectral_centroid": 2300.0, "dynamic_range": 0.55, "vocal_range_energy": 0.50}
        },
        # === 3. 밝은 멜로디 + 사회비판/분노 가사 ===
        {
            "category": "Bright Melody + Anger/Protest Lyrics",
            "title": "Basket Case",
            "artist": "Green Day",
            "bpm": 175.0,
            "lyrics": "Do you have the time to listen to me whine about nothing and everything all at once? I am one of those melodramatic fools, neurotic to the bone, no doubt about it. Sometimes I give myself the creeps. Sometimes my mind plays tricks on me. It all keeps adding up, I think I'm cracking up. Am I just paranoid?",
            "audio_features": {"bpm": 175.0, "energy": 0.94, "spectral_centroid": 3600.0, "dynamic_range": 0.70, "vocal_range_energy": 0.60}
        },
        {
            "category": "Bright Melody + Anger/Protest Lyrics",
            "title": "There Is a Light That Never Goes Out",
            "artist": "The Smiths",
            "bpm": 136.0,
            "lyrics": "Take me out tonight. Where there's music and there's people and they're young and alive. Driving in your car, please don't drop me home. Because it's not my home, it's their home and I'm no longer welcome. And if a double-decker bus crashes into us, to die by your side is such a heavenly way to die.",
            "audio_features": {"bpm": 136.0, "energy": 0.75, "spectral_centroid": 2100.0, "dynamic_range": 0.52, "vocal_range_energy": 0.48}
        },
        {
            "category": "Bright Melody + Anger/Protest Lyrics",
            "title": "Hard Times",
            "artist": "Paramore",
            "bpm": 120.0,
            "lyrics": "All that I want is a hole in the ground. You can tell me when it's alright for me to come out. Hard times, gonna make you wonder why you even try. Hard times, gonna take you down and laugh when you cry. Still don't know how I even survive.",
            "audio_features": {"bpm": 120.0, "energy": 0.88, "spectral_centroid": 2700.0, "dynamic_range": 0.65, "vocal_range_energy": 0.52}
        },
        # === 4. 반어법/아이러니 ===
        {
            "category": "Irony + Cynical Lyrics",
            "title": "bad guy",
            "artist": "Billie Eilish",
            "bpm": 135.0,
            "lyrics": "White shirt now red, my bloody nose. Sleepin', you're on your tippy toes. Creepin' around like no one knows. Think you're so criminal. Bruises on both my knees for you. I'm that bad type, make your mama sad type, make your girlfriend mad tight, might seduce your dad type. I'm the bad guy, duh.",
            "audio_features": {"bpm": 135.0, "energy": 0.43, "spectral_centroid": 1800.0, "dynamic_range": 0.58, "vocal_range_energy": 0.48}
        },
        {
            "category": "Irony + Cynical Lyrics",
            "title": "Smile",
            "artist": "Lily Allen",
            "bpm": 96.0,
            "lyrics": "When you first left me, I was lost in myself and I was sad. But now you call me up on the phone and you say you're alone and you want me back. At first when I see you cry, yeah it makes me smile, yeah it makes me smile. Worst of all, I feel bad for a second, but then I just laugh.",
            "audio_features": {"bpm": 96.0, "energy": 0.68, "spectral_centroid": 1900.0, "dynamic_range": 0.52, "vocal_range_energy": 0.45}
        }
    ]

    print("=== STARTING SYSTEM STRESS TESTING ===")
    
    passed_count = 0
    total_cases = len(test_cases)
    
    for idx, case in enumerate(test_cases, 1):
        print(f"\n[{idx}/{total_cases}] Category: {case['category']}")
        print(f"Track: {case['artist']} - {case['title']}")
        
        res = await engine.analyze_track(
            lyrics=case["lyrics"],
            title=case["title"],
            artist=case["artist"],
            bpm=case["bpm"],
            audio_features=case["audio_features"]
        )
        
        # Determine top 2 emotions
        ratings = [
            ("Uplifting", res["Uplifting"]),
            ("Energetic", res["Energetic"]),
            ("Aggressive", res["Aggressive"]),
            ("Melancholic", res["Melancholic"]),
            ("Desolation", res["Desolation"]),
            ("Serenity", res["Serenity"])
        ]
        sorted_ratings = sorted(ratings, key=lambda x: x[1], reverse=True)
        top_2 = [r[0] for r in sorted_ratings[:2]]
        
        print(f"  Top 2 Emotions: {top_2}")
        print(f"  Serenity (happy) Score: {res['Serenity']:.4f}")
        print(f"  Uplifting (love) Score: {res['Uplifting']:.4f}")
        
        # Assessment: Serenity should NOT be in the top 2 emotions
        if "Serenity" not in top_2:
            print("  Status: PASS")
            passed_count += 1
        else:
            print("  Status: FAIL (Serenity detected in top 2!)")
            
    print("\n==========================================")
    pass_rate = (passed_count / total_cases) * 100
    print(f"STRESS TESTS COMPLETE. Passed: {passed_count}/{total_cases} ({pass_rate:.1f}%)")
    
    if passed_count == total_cases:
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(run_stress_tests())
