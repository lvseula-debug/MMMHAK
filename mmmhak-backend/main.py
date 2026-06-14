import os
import requests
import re
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# .env 파일 로드
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(dotenv_path)

app = FastAPI()

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

HF_API_KEY = os.getenv("HUGGINGFACE_API_KEY")
# 허깅페이스 텍스트 감정 분석 1위 모델
HF_API_URL = "https://api-inference.huggingface.co/models/facebook/bart-large-mnli"

class AnalyzeRequest(BaseModel):
    lyrics: str

@app.get("/")
def read_root():
    return {"status": "ok", "message": "MMMHAK 주방 오픈!"}

@app.get("/log")
def log_frontend(msg: str):
    print("FRONTEND ERROR:", msg)
    return {"status": "logged"}

@app.post("/api/analyze")
async def analyze_lyrics(request: AnalyzeRequest):
    if not HF_API_KEY:
        raise HTTPException(status_code=500, detail="HUGGINGFACE_API_KEY가 .env에 없습니다.")

    headers = {"Authorization": f"Bearer {HF_API_KEY}"}
    
    # 텍스트가 너무 길면 허깅페이스가 힘들어하므로 앞부분(약 1000자)만 잘라서 보냅니다.
    safe_lyrics = request.lyrics[:1000]

    payload = {
        "inputs": safe_lyrics,
        "parameters": {
            "candidate_labels": ["joy", "depression", "anxiety", "stability", "anger"]
        }
    }

    try:
        response = requests.post(HF_API_URL, headers=headers, json=payload)
        data = response.json()

        # 허깅페이스 콜드스타트(로딩) 에러 방어
        if "error" in data:
            raise HTTPException(status_code=503, detail=f"AI가 잠에서 깨는 중입니다. 10초 뒤 다시 눌러주세요! ({data['error']})")

        # 허깅페이스의 배열 응답을 프론트엔드용 JSON 딕셔너리로 변환
        if "labels" in data and "scores" in data:
            result = {label: round(score, 3) for label, score in zip(data["labels"], data["scores"])}
            return result
        else:
            raise HTTPException(status_code=500, detail="허깅페이스 응답 형식이 이상합니다.")
            
    except Exception as e:
        print(f"HuggingFace Error: {e}")
        raise HTTPException(status_code=500, detail="감정 분석 중 오류가 발생했습니다.")

@app.get("/api/lyrics")
async def get_lyrics(title: str, artist: str):
    try:
        def clean_text(text):
            if not text: return ""
            cleaned = re.sub(r'\[\d{2}:\d{2}\.\d{2,3}\]', '', text)
            return cleaned.strip()

        # 1차 시도
        url = f"https://lrclib.net/api/get?artist_name={artist}&track_name={title}"
        response = requests.get(url)
        if response.status_code == 200:
            data = response.json()
            if data.get("plainLyrics"):
                return {"lyrics": data["plainLyrics"]}
            if data.get("syncedLyrics"):
                return {"lyrics": clean_text(data["syncedLyrics"])}
        
        # 2차 시도 (안전장치 포함)
        search_url = f"https://lrclib.net/api/search?q={artist} {title}"
        search_response = requests.get(search_url)
        if search_response.status_code == 200:
            search_data = search_response.json()
            if len(search_data) > 0:
                first_result = search_data[0]
                found_artist = first_result.get("artistName", "").lower()
                
                if artist.lower() not in found_artist and found_artist not in artist.lower():
                    raise HTTPException(status_code=404, detail="정확한 가사를 찾을 수 없습니다.")

                if first_result.get("plainLyrics"):
                    return {"lyrics": first_result["plainLyrics"]}
                if first_result.get("syncedLyrics"):
                    return {"lyrics": clean_text(first_result["syncedLyrics"])}
        
        raise HTTPException(status_code=404, detail="가사를 찾을 수 없습니다.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
@app.get("/api/itunes")
async def search_itunes(term: str, limit: int = 1):
    try:
        # 파이썬 서버가 아이튠즈로 직접 요청 (CORS 에러 절대 안 생김!)
        url = f"https://itunes.apple.com/search?term={term}&entity=song&limit={limit}"
        response = requests.get(url)
        return response.json()
    except Exception as e:
        print(f"iTunes Fetch Error: {e}")
        raise HTTPException(status_code=500, detail="아이튠즈 데이터를 가져오는 데 실패했습니다.")