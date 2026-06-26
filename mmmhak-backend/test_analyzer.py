import sys
import os
import json

# Ensure backend folder is in path for imports
sys.path.append(os.path.dirname(__file__))

from analyzer import MusicEmotionAnalyzer

def run_tests():
    print("==================================================")
    print("Starting MusicEmotionAnalyzer (Precision MER) Tests...")
    print("==================================================")
    
    analyzer = MusicEmotionAnalyzer(use_api_fallback=True)
    
    # 1. Verify BPM-to-Arousal mapping
    print("\n[TEST] Verifying Arousal Hybrid Mapping values:")
    arousal_60 = analyzer.calculate_arousal(60.0)
    arousal_95 = analyzer.calculate_arousal(95.0)
    arousal_130 = analyzer.calculate_arousal(130.0)
    
    print(f"  BPM  60 -> Arousal: {arousal_60} (Expected: 0.2000)")
    print(f"  BPM  95 -> Arousal: {arousal_95} (Expected: 0.5000)")
    print(f"  BPM 130 -> Arousal: {arousal_130} (Expected: 0.8000)")
    
    assert abs(arousal_60 - 0.20) < 1e-5
    assert abs(arousal_95 - 0.50) < 1e-5
    assert abs(arousal_130 - 0.80) < 1e-5
    
    # Clamping test
    arousal_0 = analyzer.calculate_arousal(0.0)
    arousal_200 = analyzer.calculate_arousal(200.0)
    print(f"  BPM   0 -> Arousal: {arousal_0} (Expected: 0.0000)")
    print(f"  BPM 200 -> Arousal: {arousal_200} (Expected: 1.0000)")
    assert arousal_0 == 0.0
    assert arousal_200 == 1.0
    
    # 2. Test cases: (name, lyrics, bpm)
    test_cases = [
        (
            "Depressed/Sad Song (Low BPM, Sad Lyrics)",
            "아무것도 할 힘이 없어. 하루 종일 침대에 누워만 있는 중. 우울감이 심해서 누구랑도 얘기하고 싶지 않아. 그냥 무기력해.",
            55.0
        ),
        (
            "Energetic/Confident Song (High BPM, High Energy Lyrics)",
            "난 무조건 성공해. 내 선택과 능력을 완벽하게 믿으니까. 누구도 날 막을 수 없고, 이대로 멈추지 않고 끝까지 밀고 나갈거야.",
            140.0
        ),
        (
            "Love/Cozy Song (Medium BPM, Warm Love Lyrics)",
            "너랑 같이 있을 때 제일 편안해. 마주 잡은 손이 따뜻하고, 함께 걷는 이 시간이 소중해. 진심으로 널 사랑하고 있어.",
            80.0
        ),
        (
            "Angry Song (High BPM, Angry Lyrics)",
            "더 이상 못 참겠어. 속에서 화가 치밀어 오르고 한계에 부딪힌 기분이야. 날 그냥 내버려 둬. 짜증나고 분노가 조절이 안 돼.",
            135.0
        ),
        (
            "Happy Song (Medium-High BPM, Joyful Lyrics)",
            "오늘 날씨도 좋고 모든 게 다 마음에 들어. 기분 좋은 리듬에 발걸음이 가벼워져. 아무 걱정 없이 행복한 하루야.",
            110.0
        ),
        (
            "Lonely Song (Medium BPM, Lonely/Melancholy Lyrics)",
            "늦은 밤 텅 빈 거리를 혼자 걷고 있어. 주변에 아무도 없다는 게 실감 나서 쓸쓸하네. 갑자기 외로워져서 네 생각이 나.",
            85.0
        ),
        (
            "Fallback Test (Empty lyrics, invalid BPM)",
            "",
            "invalid_bpm_value"
        )
    ]
    
    for name, lyrics, bpm in test_cases:
        print(f"\n[TEST CASE] {name}")
        print(f"  Lyrics: {repr(lyrics[:80])}...")
        print(f"  BPM: {bpm}")
        
        result = analyzer.analyze(lyrics, bpm)
        
        # Verify JSON outputs
        print("  [RESULT JSON]")
        print(json.dumps(result, indent=4, ensure_ascii=False))
        
        # Structure validations
        for key in ["happy", "confident", "angry", "sad", "lonely", "love"]:
            assert key in result
            assert isinstance(result[key], float)
            
        assert "primary_emotion" in result
        assert "confidence" in result
        assert "derived_valence" in result
        assert "derived_arousal" in result
        
        # Ensure scores sum to exactly 1.0000
        score_sum = round(
            result["happy"] + result["confident"] + result["angry"] +
            result["sad"] + result["lonely"] + result["love"], 
            4
        )
        print(f"  [VALIDATION] Total Sum: {score_sum} (Expected: 1.0000)")
        assert score_sum == 1.0000, f"Sum was {score_sum} instead of 1.0000"

    print("\n==================================================")
    print("All validation tests passed successfully!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
