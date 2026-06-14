import os
import re
import time
import asyncio
import hashlib
import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# .env 파일 로드 (override=True를 설정하여 파일이 변경되었을 때 환경변수를 강제 덮어씁니다.)
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(dotenv_path, override=True)

app = FastAPI()

# CORS 설정
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://mmmhak.vercel.app"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 메모리 캐시 저장소
lyrics_cache = {}
analyze_cache = {}

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
    start_time = time.time()
    
    # 1. 캐시 확인 (가사의 MD5 해시값을 키로 사용)
    lyrics_hash = hashlib.md5(request.lyrics.encode('utf-8')).hexdigest()
    if lyrics_hash in analyze_cache:
        print("PROFILING: [CACHE HIT] /api/analyze returned from memory cache")
        print(f"PROFILING: Total /api/analyze execution took {time.time() - start_time:.3f} seconds")
        return analyze_cache[lyrics_hash]
        
    # 2. 환경변수 로드
    hf_key = os.getenv("HUGGINGFACE_API_KEY")
    if not hf_key:
        print("ERROR: HUGGINGFACE_API_KEY가 환경변수(.env)에 설정되어 있지 않습니다.")
        raise HTTPException(status_code=500, detail="HUGGINGFACE_API_KEY가 누락되었습니다.")

    token_prefix = hf_key[:4] if len(hf_key) >= 4 else "N/A"
    print(f"DEBUG: Currently loaded HUGGINGFACE_API_KEY = '{token_prefix}...' (Length: {len(hf_key)})")

    # 3. API 정보 설정 (경량화 및 타임아웃 방지를 위해 distilbart-mnli-12-3 모델 적용)
    api_url = "https://router.huggingface.co/hf-inference/models/valhalla/distilbart-mnli-12-3"
    headers = {"Authorization": f"Bearer {hf_key}"}

    # 4. 입력값 안전 처리 (512자 슬라이싱으로 토큰 길이 최적화 및 추론 속도 대폭 향상)
    safe_lyrics = request.lyrics[:512]

    payload = {
        "inputs": safe_lyrics,
        "parameters": {
            "candidate_labels": ["joy", "depression", "anxiety", "stability", "anger"]
        }
    }

    data = None
    max_retries = 3
    retry_delay = 2

    # 5. 비동기 호출 및 재시도 루프 (Cold Start 대응)
    try:
        for attempt in range(max_retries):
            api_start = time.time()
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    response = await client.post(api_url, headers=headers, json=payload)
                
                api_duration = time.time() - api_start
                print(f"PROFILING: HuggingFace API request (Attempt {attempt+1}) took {api_duration:.3f} seconds")
                
                if response.status_code == 503:
                    resp_data = response.json()
                    print(f"DEBUG: Model loading (503). Retrying in {retry_delay}s... Detail: {resp_data}")
                    await asyncio.sleep(retry_delay)
                    continue
                    
                if response.status_code != 200:
                    print(f"HuggingFace API Response Error (Status Code {response.status_code}): {response.text}")
                    raise HTTPException(status_code=500, detail=f"HuggingFace API Error: {response.text}")
                    
                data = response.json()
                break  # 성공 시 루프 탈출
            except (httpx.RequestError, httpx.HTTPStatusError) as exc:
                print(f"DEBUG: HTTP request failed on attempt {attempt+1}: {exc}")
                if attempt == max_retries - 1:
                    raise HTTPException(status_code=500, detail="HuggingFace API Connection Failed.")
                await asyncio.sleep(retry_delay)

        if data is None:
            raise HTTPException(status_code=503, detail="AI가 준비 중입니다. 잠시 후 다시 시도해 주세요.")

        # 6. 응답 데이터 파싱
        parse_start = time.time()
        if isinstance(data, list):
            # 신규 API 라우터 응답 형식: [{'label': 'joy', 'score': 0.32}, ...]
            result = {item["label"]: round(item["score"], 3) for item in data if "label" in item and "score" in item}
        elif isinstance(data, dict) and "labels" in data and "scores" in data:
            # 기존 레거시 API 응답 형식: {"labels": ["joy", ...], "scores": [0.32, ...]}
            result = {label: round(score, 3) for label, score in zip(data["labels"], data["scores"])}
        else:
            print(f"HuggingFace Invalid JSON Response Format: {data}")
            raise HTTPException(status_code=500, detail="허깅페이스 응답 형식이 올바르지 않습니다.")

        # 캐시에 결과 저장
        analyze_cache[lyrics_hash] = result

        parse_duration = time.time() - parse_start
        total_duration = time.time() - start_time
        print(f"PROFILING: Response parsing/processing took {parse_duration:.3f} seconds")
        print(f"PROFILING: Total /api/analyze execution took {total_duration:.3f} seconds")
        return result

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        import traceback
        print(f"Internal Exception during lyrics analysis: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="감정 분석 요청 중 오류가 발생했습니다.")

@app.get("/api/lyrics")
async def get_lyrics(title: str, artist: str):
    start_time = time.time()
    
    # 1. 캐시 확인
    cache_key = f"{title.lower().strip()}_{artist.lower().strip()}"
    if cache_key in lyrics_cache:
        print("PROFILING: [CACHE HIT] /api/lyrics returned from memory cache")
        print(f"PROFILING: Total /api/lyrics execution took {time.time() - start_time:.3f} seconds")
        return {"lyrics": lyrics_cache[cache_key]}

    try:
        def clean_text(text):
            if not text: return ""
            cleaned = re.sub(r'\[\d{2}:\d{2}\.\d{2,3}\]', '', text)
            return cleaned.strip()

        # 1차 시도 (get)
        api_start = time.time()
        url = f"https://lrclib.net/api/get?artist_name={artist}&track_name={title}"
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
            
        print(f"PROFILING: Lyrics 1st try (get) API took {time.time() - api_start:.3f} seconds")
        if response.status_code == 200:
            data = response.json()
            lyrics = None
            if data.get("plainLyrics"):
                lyrics = data["plainLyrics"]
            elif data.get("syncedLyrics"):
                lyrics = clean_text(data["syncedLyrics"])
                
            if lyrics:
                lyrics_cache[cache_key] = lyrics
                total_duration = time.time() - start_time
                print(f"PROFILING: Total /api/lyrics execution (1st try hit) took {total_duration:.3f} seconds")
                return {"lyrics": lyrics}
        
        # 2차 시도 (search)
        api_start2 = time.time()
        search_url = f"https://lrclib.net/api/search?q={artist} {title}"
        async with httpx.AsyncClient(timeout=10.0) as client:
            search_response = await client.get(search_url)
            
        print(f"PROFILING: Lyrics 2nd try (search) API took {time.time() - api_start2:.3f} seconds")
        if search_response.status_code == 200:
            search_data = search_response.json()
            if len(search_data) > 0:
                first_result = search_data[0]
                found_artist = first_result.get("artistName", "").lower()
                
                if artist.lower() not in found_artist and found_artist not in artist.lower():
                    raise HTTPException(status_code=404, detail="정확한 가사를 찾을 수 없습니다.")

                lyrics = None
                if first_result.get("plainLyrics"):
                    lyrics = first_result["plainLyrics"]
                elif first_result.get("syncedLyrics"):
                    lyrics = clean_text(first_result["syncedLyrics"])

                if lyrics:
                    lyrics_cache[cache_key] = lyrics
                    total_duration = time.time() - start_time
                    print(f"PROFILING: Total /api/lyrics execution (2nd try hit) took {total_duration:.3f} seconds")
                    return {"lyrics": lyrics}
        
        total_duration = time.time() - start_time
        print(f"PROFILING: Total /api/lyrics execution (fail) took {total_duration:.3f} seconds")
        raise HTTPException(status_code=404, detail="가사를 찾을 수 없습니다.")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))
        
@app.get("/api/itunes")
async def search_itunes(term: str, limit: int = 1, country: str = None):
    try:
        url = f"https://itunes.apple.com/search?term={term}&entity=song&limit={limit}"
        if country:
            url += f"&country={country}"
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
        return response.json()
    except Exception as e:
        print(f"iTunes Fetch Error: {e}")
        raise HTTPException(status_code=500, detail="아이튠즈 데이터를 가져오는 데 실패했습니다.")