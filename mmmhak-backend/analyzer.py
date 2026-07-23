import os
import math
import requests
from dotenv import load_dotenv

# Try importing transformers and torch. If not available, we use the Hugging Face API or Heuristic fallbacks.
# Forced to False to prevent local model download hang in offline environments and memory issues on host.
HAS_TRANSFORMERS = False

# Load environment variables from .env
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
if not os.path.exists(dotenv_path):
    dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path)

class MusicEmotionAnalyzer:
    """
    MusicEmotionAnalyzer maps a song's lyrics and BPM metadata to the Arousal-Valence (AV) coordinate system,
    applies a Neutral Decay layer, distributes weights among 6 core emotions (happy, confident, angry, sad, lonely, love)
    using an RBF kernel (gamma = 2.5), and outputs a React Recharts-compatible emotion spread dictionary.
    """
    def __init__(self, model_name="cardiffnlp/twitter-roberta-base-sentiment-latest", use_api_fallback=True):
        self.model_name = model_name
        self.use_api_fallback = use_api_fallback
        self.hf_api_key = os.getenv("HUGGINGFACE_API_KEY")
        self.pipeline = None
        
        # Initialize local Hugging Face sentiment pipeline if available
        if HAS_TRANSFORMERS:
            try:
                device = 0 if torch.cuda.is_available() else -1
                # Try loading with top_k=None to get all label probabilities
                self.pipeline = pipeline(
                    "sentiment-analysis",
                    model=self.model_name,
                    device=device,
                    top_k=None
                )
                print(f"[MusicEmotionAnalyzer] Successfully loaded local sentiment model: {self.model_name}")
            except Exception as e:
                print(f"[MusicEmotionAnalyzer] Warning: Failed to load local model with top_k=None: {e}. Trying return_all_scores=True...")
                try:
                    self.pipeline = pipeline(
                        "sentiment-analysis",
                        model=self.model_name,
                        device=device,
                        return_all_scores=True
                    )
                    print(f"[MusicEmotionAnalyzer] Successfully loaded local sentiment model with return_all_scores=True")
                except Exception as e2:
                    print(f"[MusicEmotionAnalyzer] Warning: Local pipeline initialization failed completely: {e2}. Will use API or heuristic fallback.")

    def _call_hf_api(self, text: str):
        """Calls Hugging Face Inference API for sentiment classification."""
        if not self.hf_api_key:
            raise ValueError("HUGGINGFACE_API_KEY is not set.")
            
        api_url = f"https://api-inference.huggingface.co/models/{self.model_name}"
        headers = {"Authorization": f"Bearer {self.hf_api_key}"}
        payload = {"inputs": text}
        
        response = requests.post(api_url, headers=headers, json=payload, timeout=12)
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list) and len(data) > 0:
                if isinstance(data[0], list):
                    return data[0]
                return data
            raise ValueError(f"Invalid API response format: {data}")
        elif response.status_code == 503:
            raise RuntimeError("Hugging Face model is loading (503). Try again in a few seconds.")
        else:
            raise RuntimeError(f"Hugging Face API failed with status {response.status_code}: {response.text}")

    def _heuristic_valence(self, text: str) -> tuple:
        """
        Heuristic lexicon-based valence estimator that matches p_pos, p_neg, p_neu probability patterns
        to apply the Neutral Decay logic even in offline fallback mode.
        """
        positive_words = [
            "행복", "기쁨", "사랑", "좋아", "신나", "아름다운", "감사", "웃음", "희망", "설렘", "따뜻",
            "happy", "joy", "love", "like", "wonderful", "grateful", "smile", "hope", "warm", "good",
            "confident", "자신", "용기", "최고", "나아갈", "빛나는", "안정", "편안", "달콤", "설레", "웃는"
        ]
        negative_words = [
            "우울", "슬픔", "눈물", "아픔", "고통", "외롭", "분노", "화나", "짜증", "불안", "어둠", "절망",
            "sad", "tear", "pain", "hurt", "lonely", "angry", "anxious", "dark", "despair", "hate",
            "depression", "cry", "fear", "scared", "혼자", "버려진", "쓸쓸", "그리움", "미움", "죽음"
        ]
        
        text_lower = text.lower()
        pos_count = sum(text_lower.count(word) for word in positive_words)
        neg_count = sum(text_lower.count(word) for word in negative_words)
        
        total_tokens = len(text_lower.split())
        if total_tokens == 0:
            return 0.0, 0.50  # (valence, confidence)
            
        matched = pos_count + neg_count
        if matched == 0:
            return 0.0, 0.50
            
        match_rate = min(1.0, matched / max(1.0, total_tokens))
        
        p_pos = (pos_count / matched) * match_rate
        p_neg = (neg_count / matched) * match_rate
        p_neu = 1.0 - (p_pos + p_neg)
        
        valence = p_pos - p_neg
        final_valence = valence * (1.0 - p_neu)
        confidence = max(p_pos, p_neu, p_neg)
        return final_valence, confidence

    def calculate_valence(self, text: str) -> tuple:
        """
        Analyzes lyrics sentiment to calculate Valence in the range [-1.0, 1.0].
        Applies a Neutral Decay layer: valence = (p_pos - p_neg) * (1 - p_neu).
        Returns (valence_score, confidence_score).
        """
        if not text or not isinstance(text, str) or len(text.strip()) == 0:
            return 0.0, 0.50

        def parse_scores(scores_dict):
            # 1. Check if it is a 5-star rating model (like nlptown/bert-base-multilingual-uncased-sentiment)
            is_5_star = any('star' in k for k in scores_dict.keys()) or len(scores_dict) == 5
            
            if is_5_star:
                star_scores = {}
                for label, score in scores_dict.items():
                    digits = [int(s) for s in label if s.isdigit()]
                    if digits:
                        star_val = digits[0]
                        if 'label_' in label and 0 <= star_val <= 4:
                            star_val += 1
                        star_scores[star_val] = score
                
                if len(star_scores) < 5:
                    for idx, (label, score) in enumerate(scores_dict.items()):
                        star_scores[idx + 1] = score
                        
                p_1 = star_scores.get(1, 0.0)
                p_2 = star_scores.get(2, 0.0)
                p_3 = star_scores.get(3, 0.0)
                p_4 = star_scores.get(4, 0.0)
                p_5 = star_scores.get(5, 0.0)
                
                total = p_1 + p_2 + p_3 + p_4 + p_5
                if total > 0:
                    p_1, p_2, p_3, p_4, p_5 = p_1/total, p_2/total, p_3/total, p_4/total, p_5/total
                    
                # Group stars to 3 classes for decay application
                p_pos = p_5 + p_4
                p_neg = p_1 + p_2
                p_neu = p_3
                
                valence = p_pos - p_neg
                final_valence = valence * (1.0 - p_neu)
                confidence = max(p_1, p_2, p_3, p_4, p_5)
                return final_valence, confidence
            
            # 2. Standard 3-class model parsing
            pos_keys = ['positive', 'label_2', 'joy']
            neu_keys = ['neutral', 'label_1', 'stability']
            neg_keys = ['negative', 'label_0', 'sadness', 'sad', 'depression', 'anger', 'angry', 'anxiety']
            
            p_pos = 0.0
            p_neu = 0.0
            p_neg = 0.0
            
            for k, v in scores_dict.items():
                if any(pk in k for pk in pos_keys):
                    p_pos += v
                elif any(nk in k for nk in neg_keys):
                    p_neg += v
                elif any(nek in k for nek in neu_keys):
                    p_neu += v
                    
            total = p_pos + p_neu + p_neg
            if total > 0:
                p_pos /= total
                p_neg /= total
                p_neu /= total
                
            valence = p_pos - p_neg
            final_valence = valence * (1.0 - p_neu)
            confidence = max(p_pos, p_neu, p_neg)
            return final_valence, confidence

        # Try local Hugging Face pipeline first
        if self.pipeline:
            try:
                results = self.pipeline(text[:512])  # Truncate to stay within context window
                if isinstance(results, list) and len(results) > 0:
                    flat_results = results[0] if isinstance(results[0], list) else results
                    scores_dict = {item['label'].lower(): item['score'] for item in flat_results}
                    val, conf = parse_scores(scores_dict)
                    return val, conf
            except Exception as e:
                print(f"[MusicEmotionAnalyzer] Local pipeline valence computation failed: {e}. Trying API fallback...")

        # Try Hugging Face Inference API fallback
        if self.use_api_fallback and self.hf_api_key:
            try:
                api_res = self._call_hf_api(text[:512])
                scores_dict = {item['label'].lower(): item['score'] for item in api_res}
                val, conf = parse_scores(scores_dict)
                return val, conf
            except Exception as e:
                print(f"[MusicEmotionAnalyzer] HF Inference API valence computation failed: {e}. Using heuristic fallback...")

        # Fallback to Heuristic
        return self._heuristic_valence(text)

    def calculate_arousal(self, bpm: float) -> float:
        """
        Maps BPM to Arousal in the range [0.0, 1.0].
        BPM <= 60: 기저 상태 (Arousal <= 0.2)
        BPM >= 130: 과각성 상태 (Arousal >= 0.8)
        BPM 60~130: 선형 보간 (arousal = 0.2 + (bpm - 60) * (0.6 / 70))
        The final value is clamped between [0.0, 1.0].
        """
        try:
            bpm = float(bpm)
        except (TypeError, ValueError):
            return 0.5000  # Default to neutral Arousal if invalid
            
        if bpm <= 60:
            val = (bpm / 60.0) * 0.20 if bpm > 0 else 0.0
            arousal = max(0.0, min(0.20, val))
        elif bpm >= 130:
            val = 0.80 + (bpm - 130.0) * (0.20 / 70.0)
            arousal = min(1.0, val)
        else:
            arousal = 0.20 + (bpm - 60.0) * (0.60 / 70.0)
            
        return max(0.0, min(1.0, arousal))

    def analyze(self, lyrics: str, bpm: float) -> dict:
        """
        Analyzes lyrics and BPM to calculate Recharts radar chart compatible emotion scores.
        Applies RBF Kernel with gamma = 2.0 and normalizes weights to new 6-axis schema.
        """
        try:
            # 1. Calculate Arousal and Valence independently
            valence, confidence = self.calculate_valence(lyrics)
            arousal = self.calculate_arousal(bpm)
            
            # [중요] valence/arousal이 0~1 범위로 들어올 경우 -1~1 범위로 정규화 (좌표계 매칭)
            # 만약 이미 -1~1 범위라면 아래 두 줄은 주석 처리하세요.
            v_norm = (valence * 2) - 1 if 0 <= valence <= 1 else valence
            a_norm = (arousal * 2) - 1 if 0 <= arousal <= 1 else arousal
            
            # 2. 신규 6축 2차원 감정 좌표계 (Valence, Arousal) 재정의
            # V: Valence (-1.0 ~ 1.0), A: Arousal (-1.0 ~ 1.0)
            centers = {
                "Uplifting":   (0.70,  0.60),  # 높은 긍정 + 높은 에너지
                "Energetic":   (0.30,  0.85),  # 에너지가 매우 높음
                "Aggressive":  (-0.65, 0.75),  # 높은 부정 + 높은 에너지
                "Melancholic": (-0.70, -0.20), # 높은 부정 + 낮은/중간 에너지
                "Desolation":  (-0.40, -0.70), # 높은 부정 + 매우 낮은 에너지 (고독)
                "Serenity":    (0.60,  -0.50)  # 높은 긍정 + 낮은 에너지 (평온)
            }
            
            # 3. Compute similarity weights based on RBF Kernel (gamma = 2.0)
            weights = {}
            for emo, center in centers.items():
                # Distance squared on 2D plane
                dist_sq = (v_norm - center[0])**2 + (a_norm - center[1])**2
                # RBF similarity: gamma를 2.0으로 조정하여 감정 간 점수 분산 확보
                w = math.exp(-2.0 * dist_sq)
                weights[emo] = w
                
            # 4. Normalize weights so they sum to exactly 1.0000
            total = sum(weights.values())
            if total == 0:
                normalized = {emo: 0.1667 for emo in centers}
            else:
                normalized = {emo: round(w / total, 4) for emo, w in weights.items()}
                
            # Adjust rounding errors to guarantee exactly 1.0000 total
            diff = round(1.0000 - sum(normalized.values()), 4)
            if diff != 0:
                max_emo = max(normalized, key=normalized.get)
                normalized[max_emo] = round(normalized[max_emo] + diff, 4)
                
            # 5. Determine primary emotion
            primary_emotion = max(normalized, key=normalized.get)
            
            # 6. Formulate output rounded to 4 decimal places
            output = {
                "Serenity": float(normalized["Serenity"]),
                "Uplifting": float(normalized["Uplifting"]),
                "Melancholic": float(normalized["Melancholic"]),
                "Aggressive": float(normalized["Aggressive"]),
                "Desolation": float(normalized["Desolation"]),
                "Energetic": float(normalized["Energetic"]),
                "primary_emotion": primary_emotion,
                "confidence": float(round(confidence, 4)),
                "derived_valence": float(round(valence, 4)),
                "derived_arousal": float(round(arousal, 4))
            }
            return output
            
        except Exception as e:
            print(f"[MusicEmotionAnalyzer] Error during analysis: {e}. Returning safe fallback profile.")
            return {
                "Serenity": 0.1667,
                "Uplifting": 0.1667,
                "Melancholic": 0.1666,
                "Aggressive": 0.1667,
                "Desolation": 0.1667,
                "Energetic": 0.1666,
                "primary_emotion": "Serenity",
                "confidence": 0.5000,
                "derived_valence": 0.0000,
                "derived_arousal": 0.5000
            }
