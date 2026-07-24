import React, { useState, useEffect, useRef } from "react";

const MUSIC_PLACEHOLDER = "/default_album_art.png";

const MONTHLY_FOOD_MESSAGES = {
  Melancholic: "저음은 쓴맛을 더 깊게 느끼게 한대요. 마음이 쌉싸름한 날엔, 일하고 홀로 앉아 마시던 그 믹스커피 한 잔처럼 씁쓸함을 가만히 받아들여보세요.",
  Uplifting: "고음은 단맛도 한 스푼 더 얹어준다죠. 귀가 벌써 달달해졌으니, 문방구 달고나처럼 톡톡 튀는 기분을 즐겨보세요.",
  Energetic: "빠른 비트에 심장이 이미 쿵쿵 뛰었죠? 매운 거 먹고 나서 원샷하는 그 사이다처럼, 톡 쏘는 청량함으로 텐션을 이어가 보세요.",
  Aggressive: "거칠고 강렬한 사운드가 매운맛을 더 맵게 느끼게 한대요. 길거리 포장마차 떡볶이로 그 화력, 속 시원히 씻어내세요.",
  Serenity: "느리고 매끈한 선율은 부드러운 맛으로 이어진대요. 편의점에서 무심코 집어 든 바나나맛우유 한 모금처럼, 오늘은 마음도 스르륵 풀어지길.",
  Desolation: "여운 긴 저음은 깊은 맛으로 남는대요. 자취방에서 혼자 끓여 먹던 라면 한 그릇처럼, 그 온기가 노래보다 오래갈 거예요."
};

const EMOTION_COLORS = {
  Uplifting: "#FF06EA",
  Energetic: "#FF5F2A",
  Aggressive: "#BF1111",
  Melancholic: "#6139FF",
  Desolation: "#BEB729",
  Serenity: "#34A853",
};

// 연결선 베지어 곡선 패스 계산 함수
const getCurvedPath = (startX, startY, endX, endY) => {
  const deltaX = (endX - startX) * 0.5;
  const deltaY = (endY - startY) * 0.5;
  const cp1x = startX + deltaX;
  const cp1y = startY;
  const cp2x = endX - deltaX;
  const cp2y = endY;
  return `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
};

export default function MusicMoodMappingView({ history = [], isMobile = false }) {
  const [playingTrackId, setPlayingTrackId] = useState(null);
  const audioRef = useRef(null);
  const containerRef = useRef(null);
  const [centerPos, setCenterPos] = useState({ x: 450, y: 300 });

  // 1. 최근 30일 이내 데이터 추출
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const recentHistory = history.filter(item => {
    if (!item.timestamp) return true;
    return now - new Date(item.timestamp).getTime() <= thirtyDaysMs;
  });

  // 2. 곡명(title) & 아티스트/trackId 기준 청취 횟수(playCount) 중복 집계 및 대표 감정 계산
  const trackMap = new Map();
  const emotionCounts = {};

  recentHistory.forEach(item => {
    // 곡 식별 키: trackId가 유효하면 trackId, 없으면 title + artist 조합
    const rawKey = item.trackId || (item.title && item.artist ? `${item.title.trim()}-${item.artist.trim()}` : item.id);
    const key = rawKey.toString().toLowerCase();

    if (!trackMap.has(key)) {
      trackMap.set(key, {
        id: item.trackId || item.id || key,
        title: item.title,
        artist: item.artist,
        artworkUrl: item.artworkUrl || item.artwork || MUSIC_PLACEHOLDER,
        previewUrl: item.previewUrl || item.preview || "",
        emotion: item.emotion || "Serenity",
        playCount: 1,
      });
    } else {
      const existing = trackMap.get(key);
      existing.playCount += 1;
      if (!existing.previewUrl && (item.previewUrl || item.preview)) {
        existing.previewUrl = item.previewUrl || item.preview;
      }
      if (!existing.artworkUrl && (item.artworkUrl || item.artwork)) {
        existing.artworkUrl = item.artworkUrl || item.artwork;
      }
    }

    const emo = item.emotion || "Serenity";
    emotionCounts[emo] = (emotionCounts[emo] || 0) + 1;
  });

  // 많이 들은 곡 순서대로 (playCount 내림차순) 정렬
  const aggregatedTracks = Array.from(trackMap.values()).sort((a, b) => b.playCount - a.playCount);

  // 대표 감정 (Dominant Emotion)
  let dominantEmotion = "Serenity";
  let maxEmoCount = 0;
  Object.entries(emotionCounts).forEach(([emo, count]) => {
    if (count > maxEmoCount) {
      maxEmoCount = count;
      dominantEmotion = emo;
    }
  });

  const foodMessage = MONTHLY_FOOD_MESSAGES[dominantEmotion] || MONTHLY_FOOD_MESSAGES.Serenity;
  const dominantColor = EMOTION_COLORS[dominantEmotion] || "#CCFF00";

  // 3. Audio Preview 핸들러
  const handleTogglePlay = (track) => {
    const url = track.previewUrl || track.preview;
    if (!url) {
      console.warn("No audio preview URL available for track:", track.title);
      return;
    }

    if (playingTrackId === track.id) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingTrackId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = url;
        audioRef.current.play().then(() => {
          setPlayingTrackId(track.id);
        }).catch(err => {
          console.error("Audio playback error:", err);
          setPlayingTrackId(null);
        });
      }
    }
  };

  const handleAudioEnded = () => {
    setPlayingTrackId(null);
  };

  // 4. 마인드맵 노드 좌표 및 캔버스 크기 정중앙 계산
  useEffect(() => {
    const updateCenter = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCenterPos({ x: rect.width / 2, y: rect.height / 2 });
      }
    };
    updateCenter();
    window.addEventListener("resize", updateCenter);
    return () => window.removeEventListener("resize", updateCenter);
  }, []);

  const displayTracks = aggregatedTracks.slice(0, 6);
  const totalCount = displayTracks.length;
  const radius = isMobile ? 150 : 240;

  return (
    <div
      className="flex flex-col items-center relative w-full select-none overflow-hidden"
      style={{
        minHeight: "100vh",
        backgroundColor: "#1A0050",
        color: "#fff",
        fontFamily: "'Space Mono', monospace",
        paddingBottom: "60px",
      }}
    >
      <audio ref={audioRef} onEnded={handleAudioEnded} />

      {/* 1. 타이틀 텍스트: "Music Mood Mapping" (M, M, M 모두 대문자!) */}
      <div className="mt-8 mb-4 text-center z-20">
        <h1
          style={{
            fontFamily: "'Playfair Display', serif",
            fontStyle: "italic",
            fontWeight: 900,
            fontSize: isMobile ? 28 : 42,
            color: "#CCFF00",
            letterSpacing: "-0.01em",
            textShadow: "0 0 20px rgba(204,255,0,0.6)",
          }}
        >
          Music Mood Mapping
        </h1>
        <div
          style={{
            fontSize: isMobile ? 9 : 11,
            color: "rgba(255,255,255,0.6)",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            marginTop: 4,
          }}
        >
          30-DAY EMOTION & MUSIC MINDMAP
        </div>
      </div>

      {/* 2. 마인드맵 캔버스 영역 (정중앙 50% 50% 배치) */}
      <div
        ref={containerRef}
        className="relative w-full max-w-[900px] flex-1 flex items-center justify-center"
        style={{ minHeight: isMobile ? 500 : 600, height: isMobile ? "500px" : "600px" }}
      >
        {/* 3. SVG 연결선 - 베지어 곡선 패스 (<path d={...} />) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          {displayTracks.map((track, idx) => {
            const angle = (idx * (360 / Math.max(totalCount, 1)) - 90) * (Math.PI / 180);
            const targetX = centerPos.x + radius * Math.cos(angle);
            const targetY = centerPos.y + radius * Math.sin(angle);

            return (
              <path
                key={`path-${track.id}`}
                d={getCurvedPath(centerPos.x, centerPos.y, targetX, targetY)}
                fill="none"
                stroke="#CCFF00"
                strokeWidth={2}
                strokeDasharray="4 4"
                opacity={0.65}
                style={{ filter: "drop-shadow(0 0 6px rgba(204,255,0,0.5))" }}
              />
            );
          })}
        </svg>

        {/* 중앙 노드 (X: 50%, Y: 50% 절대 배치) */}
        <div
          className="absolute z-10 flex flex-col items-center justify-center p-6 text-center rounded-full transition-all duration-300"
          style={{
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: isMobile ? 210 : 270,
            height: isMobile ? 210 : 270,
            background: "rgba(26, 0, 80, 0.94)",
            border: `2px solid ${dominantColor}`,
            boxShadow: `0 0 35px ${dominantColor}66, inset 0 0 20px ${dominantColor}33`,
            animation: "pulse-glow 3s ease-in-out infinite",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: dominantColor,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            30-DAY DOMINANT MOOD
          </div>
          <div
            style={{
              fontSize: isMobile ? 18 : 22,
              fontWeight: 900,
              color: "#CCFF00",
              fontFamily: "'Playfair Display', serif",
              fontStyle: "italic",
              marginBottom: 8,
              textShadow: "0 0 10px rgba(204,255,0,0.5)",
            }}
          >
            {dominantEmotion}
          </div>
          <p
            style={{
              fontSize: isMobile ? 9 : 10,
              color: "#E0D0FF",
              lineHeight: 1.5,
              wordBreak: "keep-all",
              whiteSpace: "pre-wrap",
              fontFamily: "'Pretendard Variable', sans-serif",
              fontWeight: 500,
              maxWidth: 210,
            }}
          >
            {foodMessage}
          </p>
        </div>

        {/* 주변 방사형 트랙 노드 (PreviewSection 스타일 적용) */}
        {displayTracks.map((track, idx) => {
          const angle = (idx * (360 / Math.max(totalCount, 1)) - 90) * (Math.PI / 180);
          const x = centerPos.x + radius * Math.cos(angle);
          const y = centerPos.y + radius * Math.sin(angle);

          const isPlaying = playingTrackId === track.id;
          const floatDelay = idx * 0.4;

          return (
            <div
              key={track.id}
              onClick={() => handleTogglePlay(track)}
              className="absolute z-10 flex flex-col items-center cursor-pointer group transition-transform duration-200 hover:scale-105"
              style={{
                left: x,
                top: y,
                transform: "translate(-50%, -50%)",
                animation: `float-blob ${6 + (idx % 3) * 2}s ease-in-out ${floatDelay}s infinite`,
              }}
            >
              {/* Organic blob background */}
              <div
                className="absolute inset-0 bg-[#1A0050] rounded-full z-0 opacity-80 pointer-events-none"
                style={{
                  width: isMobile ? 90 : 110,
                  height: isMobile ? 90 : 110,
                  transform: "translate(-10%, -10%)",
                  filter: "blur(8px)",
                }}
              />

              {/* 앨범 커버 아트워크 */}
              <div style={{ position: "relative", width: isMobile ? 65 : 85, height: isMobile ? 65 : 85, zIndex: 1 }}>
                <img
                  src={track.artworkUrl || MUSIC_PLACEHOLDER}
                  alt={track.artist}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    borderRadius: 8,
                    border: isPlaying ? "2px solid #CCFF00" : "2px solid rgba(254, 255, 255, 0.2)",
                    boxShadow: isPlaying ? "0 0 20px rgba(204,255,0,0.8)" : "0 4px 12px rgba(0,0,0,0.4)",
                    transition: "border 0.25s, box-shadow 0.25s",
                  }}
                />
                {/* Play / Stop Badge Overlay */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 8,
                    background: isPlaying ? "rgba(26,0,80,0.6)" : "rgba(0,0,0,0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#CCFF00",
                    fontSize: isPlaying ? 22 : 16,
                    fontWeight: 900,
                    textShadow: "0 0 10px #CCFF00",
                  }}
                >
                  {isPlaying ? "◼" : "▶"}
                </div>
              </div>

              {/* 곡 제목 + 아티스트 + 재생수 */}
              <div className="relative z-1 flex flex-col items-center mt-1.5 max-w-[110px] text-center">
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    color: isPlaying ? "#CCFF00" : "#FFF",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: 100,
                  }}
                  title={track.title}
                >
                  {track.title}
                </span>
                <span
                  style={{
                    fontSize: 8,
                    color: "rgba(255,255,255,0.6)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: 100,
                  }}
                  title={track.artist}
                >
                  {track.artist}
                </span>
                <span
                  style={{
                    fontSize: 7,
                    fontWeight: 700,
                    color: "#00FF88",
                    marginTop: 1,
                  }}
                >
                  {track.playCount} Plays
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
