import os
import re
import time
import math
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
    title: str = "Unknown Title"
    artist: str = "Unknown Artist"

@app.get("/")
def read_root():
    return {"status": "ok", "message": "MMMHAK 주방 오픈!"}

@app.get("/log")
def log_frontend(msg: str):
    print("FRONTEND ERROR:", msg)
    return {"status": "logged"}

# 1. 라벨별 맞춤 hypothesis template (Valence 및 감정)
valence_hypotheses = [
    "이 노래는 긍정적이고 신나는 분위기이다.",
    "이 노래는 부정적이고 무겁거나 어두운 분위기이다."
]

emotion_hypotheses = {
    "happy": "This song expresses joy and happiness.",
    "sad": "This song expresses sadness, sorrow, or heartbreak.",
    "angry": "This song expresses anger or aggression.",
    "love": "This song expresses romantic love or deep affection for someone.",
    "lonely": "This song expresses loneliness or feeling alone.",
    "confident": "This song expresses confidence or self-assurance."
}

# 3. 라벨별 threshold (초기값, 검증 데이터로 보정 예정)
thresholds = {
    "happy": 0.35,
    "angry": 0.35,
    "lonely": 0.30,
    "love": 0.20,
    "sad": 0.20,
    "confident": 0.30
}

async def call_hf_zero_shot(client, api_url, headers, text, candidate_hypotheses, multi_label=False):
    payload = {
        "inputs": text,
        "parameters": {
            "candidate_labels": candidate_hypotheses,
            "hypothesis_template": "{}",
            "multi_label": multi_label
        }
    }
    max_retries = 3
    retry_delay = 2
    for attempt in range(max_retries):
        try:
            response = await client.post(api_url, headers=headers, json=payload, timeout=15.0)
            if response.status_code == 503:
                print(f"DEBUG: Model loading (503). Retrying in {retry_delay}s...")
                await asyncio.sleep(retry_delay)
                continue
            if response.status_code != 200:
                print(f"HuggingFace API Error (Attempt {attempt+1}): {response.status_code} - {response.text}")
                if attempt == max_retries - 1:
                    raise HTTPException(status_code=500, detail=f"HuggingFace API Error: {response.text}")
                await asyncio.sleep(retry_delay)
                continue
            data = response.json()
            
            if not isinstance(data, list):
                if isinstance(data, dict) and "labels" in data and "scores" in data:
                    return {label: score for label, score in zip(data["labels"], data["scores"])}
                raise HTTPException(status_code=500, detail="Invalid response format from HuggingFace API")
                
            return {item["label"]: item["score"] for item in data}
        except (httpx.RequestError, httpx.HTTPStatusError) as exc:
            print(f"DEBUG: HTTP request failed on attempt {attempt+1}: {exc}")
            if attempt == max_retries - 1:
                raise HTTPException(status_code=500, detail=f"HuggingFace API Connection Failed: {exc}")
            await asyncio.sleep(retry_delay)
    return {}

def apply_temperature(score: float, temperature: float = 2.0) -> float:
    if score == 0.0:
        return 0.0
    # Clamp to avoid math domain errors in log
    score = min(max(score, 1e-6), 1.0 - 1e-6)
    logit = math.log(score / (1.0 - score))
    scaled_logit = logit / temperature
    return round(1.0 / (1.0 + math.exp(-scaled_logit)), 3)

async def classify_lyrics(lyrics: str, threshold_override: dict = None):
    """
    Valence(긍정/부정) 1차 분류 -> 그룹별 세부 감정 2차 분류(조건부 실행) 및 Love 테마 독립 분리.
    """
    th = threshold_override or thresholds
    
    hf_key = os.getenv("HUGGINGFACE_API_KEY")
    if not hf_key:
        print("ERROR: HUGGINGFACE_API_KEY가 환경변수(.env)에 설정되어 있지 않습니다.")
        raise HTTPException(status_code=500, detail="HUGGINGFACE_API_KEY가 누락되었습니다.")
        
    api_url = "https://router.huggingface.co/hf-inference/models/facebook/bart-large-mnli"
    headers = {"Authorization": f"Bearer {hf_key}"}
    safe_lyrics = lyrics[:512]

    async with httpx.AsyncClient(timeout=15.0) as client:
        # 1단계: Valence 분류
        val_res = await call_hf_zero_shot(client, api_url, headers, safe_lyrics, valence_hypotheses, multi_label=False)
        pos_val = val_res.get(valence_hypotheses[0], 0.0)
        neg_val = val_res.get(valence_hypotheses[1], 0.0)
        
        valence_group = "positive" if pos_val >= neg_val else "negative"

        # 2단계: 그룹별 세부 감정 라벨 분류
        if valence_group == "positive":
            active_emotions = ["happy", "confident"]
        else:
            active_emotions = ["angry", "sad", "lonely"]
            
        # 3단계: Love는 항상 함께 독립 주제로 분류
        active_labels = active_emotions + ["love"]
        candidate_hyps = [emotion_hypotheses[emo] for emo in active_labels]
        
        emo_res = await call_hf_zero_shot(client, api_url, headers, safe_lyrics, candidate_hyps, multi_label=True)

    # 점수 병합 및 미평가 라벨 0.0 처리 (이 시점은 raw 점수)
    scores = {}
    for emo in ["happy", "confident", "angry", "sad", "lonely"]:
        if emo in active_emotions:
            hyp = emotion_hypotheses[emo]
            scores[emo] = round(emo_res.get(hyp, 0.0), 3)
        else:
            scores[emo] = 0.0
            
    # Love 점수 별도 처리
    love_hyp = emotion_hypotheses["love"]
    scores["love"] = round(emo_res.get(love_hyp, 0.0), 3)

    # Valence 그룹 내 후보 중 최고 점수를 대표 감정으로 결정
    primary_emotion = max(active_emotions, key=scores.get)
    
    love_theme_score = scores["love"]
    is_love_themed = love_theme_score >= th.get("love", 0.20)
    
    matched_labels = [emo for emo in active_emotions if scores[emo] >= th.get(emo, 0.30)]
    if is_love_themed:
        matched_labels.append("love")

    # 4단계: Temperature Scaling 적용 (보정 및 극단값 완화)
    scaled_scores = {}
    for emo, val in scores.items():
        scaled_scores[emo] = apply_temperature(val, temperature=2.0)

    return {
        "scores": scaled_scores,
        "raw_scores": scores,
        "primary_emotion": primary_emotion,
        "valence_group": valence_group,
        "love_theme_score": scaled_scores["love"],
        "is_love_themed": is_love_themed,
        "matched_labels": matched_labels,
        "top_label": primary_emotion,
    }

async def calibrate_thresholds(lyrics_list, ground_truth_labels):
    """
    검증셋(50곡 정도)으로 라벨별 점수 분포를 확인하고
    threshold를 보정하기 위한 함수.
    """
    import pandas as pd
    records = []
    for lyrics, true_label in zip(lyrics_list, ground_truth_labels):
        result = await classify_lyrics(lyrics, threshold_override={k: 0 for k in thresholds})
        record = {"true_label": true_label, **result["scores"]}
        records.append(record)

    df = pd.DataFrame(records)

    # 라벨별로 정답일 때의 점수 분포 vs 정답이 아닐 때의 점수 분포 비교
    for label in label_hypotheses.keys():
        true_scores = df[df["true_label"] == label][label]
        false_scores = df[df["true_label"] != label][label]
        print(f"\n[{label}]")
        print(f"  정답일 때 평균 점수: {true_scores.mean():.3f}")
        print(f"  오답일 때 평균 점수: {false_scores.mean():.3f}")
        # 이 두 분포 사이의 적절한 지점을 threshold로 설정

    return df

@app.post("/api/analyze")
async def analyze_lyrics(request: AnalyzeRequest):
    start_time = time.time()
    
    # 1. 캐시 확인 (가사의 MD5 해시값을 키로 사용)
    lyrics_hash = hashlib.md5(request.lyrics.encode('utf-8')).hexdigest()
    if lyrics_hash in analyze_cache:
        cached_res = analyze_cache[lyrics_hash]
        if "raw_scores" in cached_res:
            print(f"[DEBUG] [CACHE HIT] {request.artist} - {request.title} raw_scores: {cached_res['raw_scores']}")
        else:
            print(f"[DEBUG] [CACHE HIT] {request.artist} - {request.title} raw_scores: (not in cache)")
        print("PROFILING: [CACHE HIT] /api/analyze returned from memory cache")
        print(f"PROFILING: Total /api/analyze execution took {time.time() - start_time:.3f} seconds")
        return cached_res

    try:
        # 2. classify_lyrics 호출
        result_classification = await classify_lyrics(request.lyrics)
        
        # 원인 진단을 위한 로그 추가
        print(f"[DEBUG] {request.artist} - {request.title} raw_scores: {result_classification['raw_scores']}")
        
        # Build backward-compatible flat structure
        result = {
            "scores": result_classification["scores"],
            "matched_labels": result_classification["matched_labels"],
            "top_label": result_classification["top_label"],
            "primary_emotion": result_classification["primary_emotion"],
            "valence_group": result_classification["valence_group"],
            "love_theme_score": result_classification["love_theme_score"],
            "is_love_themed": result_classification["is_love_themed"],
            "raw_scores": result_classification["raw_scores"]
        }
        for label, score in result_classification["scores"].items():
            result[label] = score

        # 캐시에 결과 저장
        analyze_cache[lyrics_hash] = result

        total_duration = time.time() - start_time
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