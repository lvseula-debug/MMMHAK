import React, { useState, useEffect, useRef } from "react";

const MUSIC_PLACEHOLDER = "/default_album_art.png";

const MONTHLY_FOOD_MESSAGES = {
  Melancholic: "이번 한 달은 Melancholic한 음악을 가장 많이 들으셨네요. 마음을 깊게 다독여줄 쌉싸름한 다크 초콜릿 한 조각이 필요한 기간이에요.",
  Uplifting: "이번 한 달은 Uplifting한 음악을 가장 많이 들으셨네요. 설렘과 행복이 한가득 퍼지는 달콤한 딸기 생크림 케이크 같은 시간이었네요!",
  Energetic: "이번 한 달은 Energetic한 음악을 가장 많이 들으셨네요. 톡톡 튀는 에너지를 닮은 톡 쏘는 자몽 에이드 한 잔으로 텐션을 유지해 보세요!",
  Aggressive: "이번 한 달은 Aggressive한 음악을 가장 많이 들으셨네요. 가슴속 답답함을 싹 풀어줄 화끈하고 매콤한 떡볶이가 당기는 한 달이었군요.",
  Desolation: "이번 한 달은 Desolation한 음악을 가장 많이 들으셨네요. 텅 빈 마음에 고요하게 온기를 채워줄 따뜻한 캐모마일 티 한 잔을 선물해 보세요.",
  Serenity: "이번 한 달은 Serenity한 음악을 가장 많이 들으셨네요. 부드럽고 잔잔한 온기로 지친 몸과 마음을 부드럽게 감싸주는 바닐라 라떼 같은 기간이었네요."
};

const EMOTION_COLORS = {
  Uplifting: "#FF06EA",
  Energetic: "#FF5F2A",
  Aggressive: "#BF1111",
  Melancholic: "#6139FF",
  Desolation: "#BEB729",
  Serenity: "#34A853",
};

export default function MusicMoodMappingView({ history = [], isMobile = false }) {
  const [playingTrackId, setPlayingTrackId] = useState(null);
  const audioRef = useRef(null);

  // 1. 최근 30일 이내 데이터 추출
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const recentHistory = history.filter(item => {
    if (!item.timestamp) return true;
    return now - new Date(item.timestamp).getTime() <= thirtyDaysMs;
  });

  // 2. 곡명(title) 기준 청취 횟수(playCount) 집계 및 대표 감정 계산
  const trackMap = new Map();
  const emotionCounts = {};

  recentHistory.forEach(item => {
    const key = `${item.title}_${item.artist}`.toLowerCase();
    if (!trackMap.has(key)) {
      trackMap.set(key, {
        id: item.id || key,
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
      if (!existing.previewUrl && item.previewUrl) existing.previewUrl = item.previewUrl;
      if (!existing.artworkUrl && item.artworkUrl) existing.artworkUrl = item.artworkUrl;
    }

    const emo = item.emotion || "Serenity";
    emotionCounts[emo] = (emotionCounts[emo] || 0) + 1;
  });

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

  // 4. 마인드맵 노드 좌표 계산 (방사형 배치)
  const displayTracks = aggregatedTracks.slice(0, 6);
  const totalCount = displayTracks.length;

  const containerRef = useRef(null);
  const [centerPos, setCenterPos] = useState({ x: 400, y: 320 });

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

  const radius = isMobile ? 160 : 250;

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center relative w-full min-h-screen px-4 pb-20 select-none overflow-hidden"
      style={{
        backgroundColor: "#1A0050",
        color: "#fff",
        fontFamily: "'Space Mono', monospace",
      }}
    >
      <audio ref={audioRef} onEnded={handleAudioEnded} />

      {/* 1. 화면 타이틀: "Music mood mapping" (M만 대문자) */}
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
          Music mood mapping
        </h1>
        <div style={{ fontSize: isMobile ? 9 : 11, color: "rgba(255,255,255,0.6)", letterSpacing: "0.2em", textTransform: "uppercase", marginTop: 4 }}>
          30-DAY EMOTION & MUSIC MINDMAP
        </div>
      </div>

      {/* 마인드맵 캔버스 영역 */}
      <div
        className="relative w-full max-w-[900px] flex items-center justify-center"
        style={{ minHeight: isMobile ? 520 : 650 }}
      >
        {/* SVG 점선 연결선 */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          {displayTracks.map((track, idx) => {
            const angle = (idx * (360 / Math.max(totalCount, 1)) - 90) * (Math.PI / 180);
            const targetX = centerPos.x + radius * Math.cos(angle);
            const targetY = centerPos.y + radius * Math.sin(angle);

            return (
              <line
                key={`line-${track.id}`}
                x1={centerPos.x}
                y1={centerPos.y}
                x2={targetX}
                y2={targetY}
                stroke="#CCFF00"
                strokeWidth="1.5"
                strokeDasharray="6 6"
                opacity="0.45"
              />
            );
          })}
        </svg>

        {/* 중앙 노드: 30일 대표 감정 + 푸드 페어링 멘트 */}
        <div
          className="absolute z-10 flex flex-col items-center justify-center p-6 text-center rounded-full transition-all duration-300"
          style={{
            left: centerPos.x,
            top: centerPos.y,
            transform: "translate(-50%, -50%)",
            width: isMobile ? 220 : 280,
            height: isMobile ? 220 : 280,
            background: "rgba(26, 0, 80, 0.92)",
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
              fontFamily: "'Pretendard Variable', sans-serif",
              fontWeight: 500,
              maxWidth: 220,
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
                  width: isMobile ? 100 : 120,
                  height: isMobile ? 100 : 120,
                  transform: "translate(-10%, -10%)",
                  filter: "blur(8px)",
                }}
              />

              {/* 앨범 커버 아트워크 */}
              <div style={{ position: "relative", width: isMobile ? 70 : 90, height: isMobile ? 70 : 90, zIndex: 1 }}>
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
