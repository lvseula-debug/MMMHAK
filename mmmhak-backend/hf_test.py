import requests
import json

API_URL = "https://router.huggingface.co/hf-inference/models/facebook/bart-large-mnli"

import os
from dotenv import load_dotenv

# .env 파일 로드
dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
if not os.path.exists(dotenv_path):
    dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(dotenv_path)

HF_API_KEY = os.getenv("HUGGINGFACE_API_KEY")
headers = {"Authorization": f"Bearer {HF_API_KEY}"}
def test_emotion_analysis():
    # 테스트용 (아이유 - 밤편지)
    lyrics = "이 밤 그날의 반딧불을 당신의 창 가까이 보낼게요. 사랑한다는 뜻이에요."
    
    payload = {
        "inputs": lyrics,
        "parameters": {
            # 우리가 화면에 그릴 5가지 감정 지표
            "candidate_labels": ["joy", "depression", "anxiety", "stability", "anger"]
        }
    }
    
    print("허깅페이스에 분석을 요청합니다... (최초 로딩 시 최대 20초 소요될 수 있음)")
    response = requests.post(API_URL, headers=headers, json=payload)
    
    print("분석 결과:")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))

if __name__ == "__main__":
    test_emotion_analysis()