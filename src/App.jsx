import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PieChart, Pie, Cell } from "recharts";
import "./App.css";
import EmotionRadarChart from "./EmotionRadarChart";

// Optimized: LocalStorage caching + Incremental rendering (15-track batch)
const MUSIC_PLACEHOLDER = "/default_album_art.png";

const EMOTION_COLORS = {
  angry: "#BF1111",
  confident: "#FF5F2A",
  lonely: "#BEB729",
  happy: "#34A853",
  sad: "#6139FF",
  love: "#FF06EA",
};

const EMPATHY_THEMES = {
  angry: { messages: ["누가 널 화나게 했어? 나한테 데리고 와."] },
  confident: { messages: ["그 누가 지금 널 말릴 수 있을까?"] },
  lonely: { messages: ["손에 쥔 모래처럼 날아가는 것들이 있지.", "생각이 많아지는 날에는 산책이 최고야."] },
  happy: { messages: ["여기 해피 바이러스를 느껴봐!", "이 노래 들으면서 나랑 여행갈래?"] },
  sad: { messages: ["괜찮다고 말했지만 사실은 그렇지 않지?", "오늘같이 숨이 찬 날이 있지."] },
  love: { messages: ["마치 누가 떠오르는 듯한 노래야.", "네 머릿속에 떠오르는 그 사람은 누구야?"] }
};

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  const hostname = window.location.hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://127.0.0.1:8000";
  }
  return `http://${hostname}:8000`;
};

const getLocalCache = (key) => {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : {};
  } catch {
    return {};
  }
};

const setLocalCache = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* ignore */
  }
};

let itunesCache = getLocalCache("mm_itunes_cache");
let lastfmCache = getLocalCache("mm_lastfm_cache");

// ── Custom Cursor ─────────────────────────────────────────────────────────────
function CustomCursor() {
  const cursorRef = useRef(null);

  useEffect(() => {
    const cursor = cursorRef.current;
    if (!cursor) return;
    const move = (e) => {
      cursor.style.left = e.clientX + "px";
      cursor.style.top = e.clientY + "px";
    };
    window.addEventListener("mousemove", move);
    const onOver = (e) => {
      const t = e.target.closest("button, a, [data-hover]");
      if (t) cursor.classList.add("hovering");
      else cursor.classList.remove("hovering");
    };
    window.addEventListener("mouseover", onOver);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseover", onOver);
    };
  }, []);

  return <div id="custom-cursor" ref={cursorRef} />;
}

// ── Mock Data & Scoring ───────────────────────────────────────────────────────
const MOCK_TRACKS = [
  { id: "1", title: "Espresso", artist: "Sabrina Carpenter", bpm: 120, mode: "major", valence: 0.69, energy: 0.76, loudness: -3.5, streams: 1420000000, lyrics_sentiment: { happy: 0.72, sad: 0.08, angry: 0.05, love: 0.65, lonely: 0.10, confident: 0.60 } },
  { id: "2", title: "BIRDS OF A FEATHER", artist: "Billie Eilish", bpm: 105, mode: "major", valence: 0.43, energy: 0.51, loudness: -7.8, streams: 1280000000, lyrics_sentiment: { happy: 0.45, sad: 0.28, angry: 0.12, love: 0.55, lonely: 0.35, confident: 0.40 } },
  { id: "3", title: "Beautiful Things", artist: "Benson Boone", bpm: 105, mode: "major", valence: 0.31, energy: 0.47, loudness: -5.6, streams: 1610000000, lyrics_sentiment: { happy: 0.32, sad: 0.38, angry: 0.35, love: 0.45, lonely: 0.42, confident: 0.30 } },
  { id: "4", title: "Too Sweet", artist: "Hozier", bpm: 117, mode: "minor", valence: 0.65, energy: 0.62, loudness: -4.9, streams: 980000000, lyrics_sentiment: { happy: 0.58, sad: 0.18, angry: 0.15, love: 0.50, lonely: 0.22, confident: 0.45 } },
  { id: "5", title: "Gata Only", artist: "FloyyMenor", bpm: 100, mode: "minor", valence: 0.81, energy: 0.72, loudness: -5.4, streams: 1140000000, lyrics_sentiment: { happy: 0.78, sad: 0.05, angry: 0.08, love: 0.52, lonely: 0.12, confident: 0.50 } },
  { id: "6", title: "Cruel Summer", artist: "Taylor Swift", bpm: 170, mode: "major", valence: 0.53, energy: 0.70, loudness: -5.7, streams: 2450000000, lyrics_sentiment: { happy: 0.62, sad: 0.15, angry: 0.10, love: 0.58, lonely: 0.28, confident: 0.55 } },
  { id: "7", title: "Magnetic", artist: "ILLIT", bpm: 132, mode: "major", valence: 0.69, energy: 0.78, loudness: -4.8, streams: 580000000, lyrics_sentiment: { happy: 0.82, sad: 0.06, angry: 0.05, love: 0.68, lonely: 0.15, confident: 0.60 } },
  { id: "8", title: "Spot!", artist: "ZICO", bpm: 110, mode: "minor", valence: 0.78, energy: 0.83, loudness: -4.2, streams: 320000000, lyrics_sentiment: { happy: 0.76, sad: 0.08, angry: 0.12, love: 0.60, lonely: 0.18, confident: 0.65 } },
];

function computeVirusScores(track) {
  const { mode, valence, energy, loudness, lyrics_sentiment, streams } = track;
  const modeFactor = mode === "minor" ? 0.3 : -0.1;
  const loudNorm = Math.min(Math.max((loudness + 20) / 20, 0), 1);
  const contagion = Math.log10(Math.max(streams, 10)) / Math.log10(3000000000);

  // ① 순수 감정 점수 (인기도 무관)
  const spread = {
    happy: (lyrics_sentiment?.happy ?? 0.1) * 0.5 + valence * 0.35,
    sad: (lyrics_sentiment?.sad ?? 0.1) * 0.5 + (1 - valence) * 0.3 + modeFactor * 0.2,
    angry: (lyrics_sentiment?.angry ?? 0.05) * 0.5 + loudNorm * 0.2 + energy * 0.1,
    love: (lyrics_sentiment?.love ?? 0.1) * 0.5 + valence * 0.2 + energy * 0.1,
    lonely: (lyrics_sentiment?.lonely ?? 0.1) * 0.5 + (1 - valence) * 0.3 + (1 - energy) * 0.1,
    confident: (lyrics_sentiment?.confident ?? 0.1) * 0.5 + energy * 0.3 + loudNorm * 0.1,
  };

  // ② 전염성은 별도 메타데이터로만 사용
  const viralRisk = Object.values(spread)
    .reduce((sum, v) => sum + v, 0) / 6 * contagion; // 평균 감정 강도 × 전파력

  const positive_score = Math.min((spread.happy ?? 0) * 0.4 + (spread.love ?? 0) * 0.3 + (spread.confident ?? 0) * 0.3, 1);
  const negative_score = Math.min((spread.sad ?? 0) * 0.4 + (spread.lonely ?? 0) * 0.3 + (spread.angry ?? 0) * 0.3, 1);
  const polarity = positive_score - negative_score;
  const confidence = Math.abs(polarity);
  const classification = polarity > 0.25 ? "POSITIVE" : polarity < -0.25 ? "NEGATIVE" : "MIXED";
  const primary_emotion = (() => {
    const emos = ["happy", "confident", "angry", "sad", "lonely"];
    let maxVal = -1;
    let top = "happy";
    emos.forEach((emo) => {
      if ((spread[emo] ?? 0) > maxVal) {
        maxVal = spread[emo];
        top = emo;
      }
    });
    return top;
  })();

  const is_love_themed = (spread.love ?? 0) >= 0.35;
  const valence_group = polarity > 0.0 ? "positive" : "negative";

  return {
    ...spread,
    positive_score,
    negative_score,
    polarity,
    confidence,
    classification,
    discomfort: ((spread.angry ?? 0) * 0.4 + (spread.sad ?? 0) * 0.3 + (spread.lonely ?? 0) * 0.3),
    contagion,
    viralRisk,
    streams,
    primary_emotion,
    valence_group,
    love_theme_score: spread.love,
    is_love_themed,
  };
}

const safeMergeTracks = (prev, batchItems) => {
  const combined = [...prev, ...batchItems];
  const uniqueMap = new Map();
  combined.forEach(track => {
    const existing = uniqueMap.get(track.id);
    if (existing) {
      if (existing.isAI && !track.isAI) {
        uniqueMap.set(track.id, {
          ...track,
          isAI: true,
          lyrics: existing.lyrics,
          aiScores: existing.aiScores,
          lyrics_sentiment: existing.lyrics_sentiment
        });
      } else {
        uniqueMap.set(track.id, track);
      }
    } else {
      uniqueMap.set(track.id, track);
    }
  });
  return Array.from(uniqueMap.values()).sort((a, b) => a.rank - b.rank);
};


// Removed old global fetchLyrics, using backend instead
function generateStructuredInsights(track, scores) {
  if (!track || !scores) return { vibe: "트랙 데이터를 분석 중입니다.", insight: "", profile: "" };

  // 1. 최고 감정 추출 (러브 테마 제외하고 5대 감정만 분류)
  const emotions = {
    happy: scores.happy,
    sad: scores.sad,
    angry: scores.angry,
    lonely: scores.lonely,
    confident: scores.confident
  };

  // 값을 기준으로 내림차순 정렬
  const sortedEmotions = Object.entries(emotions).sort((a, b) => b[1] - a[1]);
  const top1 = sortedEmotions[0][0];
  const top2 = sortedEmotions[1][0];

  // 한글 라벨 매핑 (다시 추가 요청됨)
  const labels = {
    happy: "행복(Happy)",
    sad: "슬픔(Sad)",
    angry: "분노(Angry)",
    love: "사랑(Love)",
    lonely: "외로움(Lonely)",
    confident: "자신감(Confident)"
  };

  // 2. 6단계 심박수(BPM) 구간 판별
  let bpmTier;
  const bpm = track.bpm;
  if (bpm <= 65) bpmTier = "deep_rest";        // 수면 및 명상
  else if (bpm <= 85) bpmTier = "resting";     // 안정 시 심박수
  else if (bpm <= 105) bpmTier = "walking";    // 가벼운 산책
  else if (bpm <= 125) bpmTier = "jogging";    // 빠른 걸음
  else if (bpm <= 150) bpmTier = "cardio";     // 유산소 (아드레날린 폭발)
  else bpmTier = "overdrive";                  // 전력 질주 (극도의 흥분)

  // 3. VIBE 텍스트 생성 (교차 분석)
  let vibe;
  switch (top1) {
    case "happy":
      if (bpmTier === "cardio" || bpmTier === "overdrive") vibe = "심박수를 한계까지 끌어올리는 폭발적인 도파민 뱅어(Banger)입니다. 춤추기 완벽한 트랙입니다.";
      else if (bpmTier === "jogging" || bpmTier === "walking") vibe = "경쾌한 발걸음을 만들어주는 산뜻한 그루브. 일상의 텐션을 기분 좋게 올려줍니다.";
      else vibe = "입가에 여유로운 미소를 띠게 만드는 따뜻하고 긍정적인 무드의 트랙입니다.";
      break;
    case "sad":
      if (bpmTier === "cardio" || bpmTier === "overdrive") vibe = "빠른 템포 속에서 비극적인 감정이 폭발합니다. 빗속을 질주하며 억눌린 슬픔을 토해내는 듯한 카타르시스를 줍니다.";
      else if (bpmTier === "jogging" || bpmTier === "walking") vibe = "걷잡을 수 없는 멜랑콜리함이 묻어납니다. 복잡한 생각과 함께 정처 없이 걷기 좋은 분위기입니다.";
      else vibe = "시간이 멈춘 듯한 깊은 심연. 혼자만의 사색에 잠기거나 묵은 감정을 위로받기 완벽합니다.";
      break;
    case "angry":
      if (bpmTier === "cardio" || bpmTier === "overdrive") vibe = "혈관에 아드레날린을 직접 꽂는 듯한 파괴적인 에너지! 모든 스트레스를 박살 내는 강렬한 트랙입니다.";
      else if (bpmTier === "jogging" || bpmTier === "walking") vibe = "날카롭고 냉소적인 그루브가 긴장감을 조성하며, 묘한 반항심을 불러일으킵니다.";
      else vibe = "무겁고 압도적인 프레셔가 짓누르는 듯한, 다크하고 카리스마 넘치는 분위기를 뿜어냅니다.";
      break;
    case "love":
      if (bpmTier === "cardio" || bpmTier === "overdrive") vibe = "심장 박동을 닮은 빠른 비트 위에 달콤하고 정열적인 사랑의 고백이 펼쳐집니다. 에너제틱한 설렘을 줍니다.";
      else if (bpmTier === "jogging" || bpmTier === "walking") vibe = "달콤하고 부드러운 멜로디가 낭만적인 분위기를 고조시키며, 누군가를 떠올리게 만듭니다.";
      else vibe = "포근하고 깊은 사랑의 감정이 공간을 가득 채웁니다. 가장 편안하고 따뜻하게 마음을 녹여주는 트랙입니다.";
      break;
    case "lonely":
      if (bpmTier === "cardio" || bpmTier === "overdrive") vibe = "빠른 속도로 흘러가는 세상 속 홀로 남겨진 고독함. 가슴 한구석을 조여오는 아련한 감각을 줍니다.";
      else if (bpmTier === "jogging" || bpmTier === "walking") vibe = "외로운 밤길을 걸을 때 나지막이 들려오는 동반자 같은 곡. 조용한 위로를 전해줍니다.";
      else vibe = "한없이 깊고 고요한 방 안, 오롯이 혼자만의 감정에 침잠하여 차분하게 마음을 가라앉혀 줍니다.";
      break;
    case "confident":
      if (bpmTier === "cardio" || bpmTier === "overdrive") vibe = "넘치는 패기와 강인한 에너지가 당당하게 뿜어져 나옵니다. 세상의 중심에 선 듯한 강력한 자신감을 불어넣습니다.";
      else if (bpmTier === "jogging" || bpmTier === "walking") vibe = "자신감 넘치는 당당한 발걸음과 세련된 바이브. 어떤 난관도 헤쳐 나갈 수 있을 것만 같은 에너지를 줍니다.";
      else vibe = "내면에 잠재된 강한 신념과 확신을 일깨워주는 진중하고 품격 있는 무드의 트랙입니다.";
      break;
    default:
      vibe = "다양한 감정이 교차하는 트랙으로, 현재의 기분에 따라 새로운 매력을 발견할 수 있습니다.";
  }

  // 4. GRAPH INSIGHT 및 PROFILE 생성
  const insight = `차트에서 **${labels[top1]}**와(과) **${labels[top2]}** 축이 가장 두드러지게 뻗어 있습니다. 이는 곡 전반에 걸쳐 두 감정선이 얽히며 메인 테마로 작용하고 있음을 시각적으로 보여줍니다.`;
  const plays = track.streams >= 1000000 ? (track.streams / 1000000).toFixed(1) + "M" : track.streams;
  const profile = `${track.bpm} BPM · ${track.mode === "minor" ? "Minor" : "Major"} Key · Energy ${track.energy.toFixed(2)} · ${plays} Plays`;

  let finalVibe = vibe;
  if (scores.is_love_themed) {
    finalVibe += " ❤️ 이 곡은 사랑과 관계, 혹은 누군가를 향한 아련한 그리움을 주요 테마로 하고 있습니다.";
  }

  return { vibe: finalVibe, insight, profile };
}

// ── Info Buttons Data ─────────────────────────────────────────────────────────
const INFO_BUTTONS = [
  { id: "bpm", label: "BPM", icon: "♫", content: 'Tempo: 128 BPM — High energy dance rhythm' },
  { id: "key", label: "KEY", icon: "♪", content: 'Key: A minor — Creates tension and emotional depth' },
  { id: "graph", label: "GRAPH", icon: "📈", content: "" },
  { id: "mood", label: "MOOD", icon: "✨", content: "" },
];

// ── Artist Card ───────────────────────────────────────────────────────────────
function ArtistCard({ track, onSelect, isActive }) {
  const [hovered, setHovered] = useState(false);
  const imgUrl = track.artworkUrl || MUSIC_PLACEHOLDER;

  return (
    <div
      data-hover="true"
      onClick={() => onSelect(track)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        marginBottom: 14,
        cursor: "none",
        padding: "6px 4px",
        borderRadius: 10,
        background: isActive ? "rgba(204,255,0,0.07)" : "transparent",
        transition: "background 0.25s",
      }}
    >
      <div style={{ position: "relative", width: 120, height: 90 }}>
        <img
          src={imgUrl}
          alt={track.artist}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: 8,
            display: "block",
            border: isActive || hovered ? "2px solid #CCFF00" : "2px solid transparent",
            transform: isActive || hovered ? "scale(1.04)" : "scale(1)",
            transition: "border 0.2s, transform 0.2s, box-shadow 0.2s",
            boxShadow: isActive || hovered ? "0 0 16px rgba(204,255,0,0.45)" : "none",
          }}
        />
        {hovered && (
          <div style={{
            position: "absolute",
            inset: 0,
            background: "rgba(26,0,80,0.8)",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "8px",
            color: "#CCFF00",
            fontFamily: "'Space Mono', monospace",
            fontSize: "10px",
            fontWeight: "700",
            textAlign: "center",
            lineHeight: "1.2",
            wordBreak: "break-word",
            pointerEvents: "none",
            transform: isActive || hovered ? "scale(1.04)" : "scale(1)",
            border: "2px solid transparent"
          }}>
            {track.title}
          </div>
        )}
      </div>
      <span
        style={{
          fontSize: 10,
          color: isActive ? "#CCFF00" : "#E0D0FF",
          textAlign: "center",
          fontFamily: "'Space Mono', monospace",
          letterSpacing: "0.04em",
          lineHeight: 1.3,
          maxWidth: 120,
          transition: "color 0.2s",
        }}
      >
        {track.artist}
      </span>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ tracks, side, activeTrack, onSelect, isMobile }) {
  if (isMobile) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 80,
        [side]: 0,
        width: 160,
        height: "calc(100vh - 80px)",
        overflowY: "auto",
        overflowX: "hidden",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        padding: "16px 12px",
        background: "transparent",
        zIndex: 30,
      }}
    >
      {tracks.map((track) => (
        <ArtistCard
          key={track.id}
          track={track}
          onSelect={onSelect}
          isActive={activeTrack?.id === track.id}
        />
      ))}
    </div>
  );
}

// ── Info Button + Popup ───────────────────────────────────────────────────────
function InfoButton({ btn, isOpen, onToggle, onClose, isMobile, track, scores }) {
  const wrapRef = useRef(null);

  // Removed click-away closer as per user request

  let content = btn.content;
  if (track) {
    if (btn.id === 'bpm') content = `Tempo: ${track.bpm} BPM — ${track.bpm > 120 ? 'High energy' : 'Chill'} rhythm`;
    else if (btn.id === 'key') content = `Key: ${track.mode === 'minor' ? 'Minor' : 'Major'} — ${track.mode === 'minor' ? 'Emotional depth' : 'Bright feel'}`;
    else if (btn.id === 'energy') content = `Energy Score: ${track.energy.toFixed(2)} / 1.0`;
    else if (btn.id === 'plays') content = `Total Plays: ${track.streams >= 1000000 ? (track.streams / 1000000).toFixed(1) + 'M' : track.streams}`;
    else if (btn.id === 'graph') {
      content = (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {scores && (
            <div style={{
              color: "#CCFF00",
              fontWeight: "700",
              fontSize: "11px",
              textAlign: "center",
              marginTop: "4px"
            }}>
              EMOTION CONFIDENCE: {Math.round(scores.confidence * 100)}%
            </div>
          )}
        </div>
      );
    }
    // 🌟 새로 추가된 MOOD 로직
    else if (btn.id === 'mood' && scores) {
      const insights = generateStructuredInsights(track, scores);
      content = (
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          marginTop: "4px",
          fontFamily: "'Nanum Myeongjo', serif",
          fontStyle: "italic",
          lineHeight: "1.6",
          wordBreak: "keep-all"
        }}>
          <div>
            <span style={{ color: "#CCFF00", fontWeight: 700, fontFamily: "'Space Mono', monospace", fontStyle: "normal" }}>VIBE:</span> {insights.vibe}
          </div>
          <div>
            <span style={{ color: "#00FF88", fontWeight: 700, fontFamily: "'Space Mono', monospace", fontStyle: "normal" }}>GRAPH INSIGHT:</span> {insights.insight}
          </div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.6)", marginTop: "4px", fontFamily: "'Space Mono', monospace", fontStyle: "normal" }}>
            {insights.profile}
          </div>
        </div>
      );
    }
  }

  return (
    <div ref={wrapRef} style={{ position: "relative", marginBottom: 12 }}>
      <button
        data-hover="true"
        onClick={onToggle}
        style={{
          background: "#CCFF00",
          color: "#1A0050",
          border: "none",
          borderRadius: 24,
          padding: "10px 18px",
          fontWeight: 800,
          fontSize: isMobile ? 11 : 13,
          textTransform: "uppercase",
          cursor: "none",
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: isMobile ? 130 : 155,
          fontFamily: "'Space Mono', monospace",
          letterSpacing: "0.06em",
          transition: "transform 0.15s, box-shadow 0.15s",
          transform: isOpen ? "scale(1.05)" : "scale(1)",
          boxShadow: isOpen
            ? "0 0 20px rgba(204,255,0,0.8), 0 4px 14px rgba(0,0,0,0.3)"
            : "0 4px 12px rgba(0,0,0,0.25)",
          userSelect: "none",
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>{btn.icon}</span>
        {btn.label}
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            marginLeft: "-120px",
            top: "calc(100% + 8px)",
            zIndex: 500,
            background: "#1A0050",
            color: "#fff",
            border: "1px solid #CCFF00",
            borderRadius: 12,
            padding: "14px 16px",
            width: 240,
            boxShadow: "0 8px 32px rgba(0,0,0,0.7), 0 0 24px rgba(204,255,0,0.2)",
            animation: "popIn 0.22s cubic-bezier(0.34,1.56,0.64,1) forwards",
            fontFamily: "'Space Mono', monospace",
          }}
        >
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: 8,
              right: 10,
              background: "none",
              border: "none",
              color: "#CCFF00",
              fontSize: 18,
              cursor: "none",
              lineHeight: 1,
              fontFamily: "'Space Mono', monospace",
              padding: "2px 4px",
            }}
          >
            ×
          </button>
          <div
            style={{
              fontSize: 9,
              color: "#CCFF00",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: 7,
              fontWeight: 700,
            }}
          >
            {btn.label}
          </div>
          <div style={{ fontSize: 12, color: "#E0D0FF", lineHeight: 1.7 }}>
            {content}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Waveform ──────────────────────────────────────────────────────────────────
function Waveform({ playing }) {
  const delays = [0, 0.1, 0.2, 0.3, 0.15, 0.25, 0.05, 0.35];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 3,
        height: 36,
        opacity: playing ? 1 : 0,
        transition: "opacity 0.3s",
      }}
    >
      {delays.map((delay, i) => (
        <div
          key={i}
          style={{
            width: 4,
            background: "#CCFF00",
            borderRadius: 2,
            height: 8,
            animation: playing ? `wave 0.8s ease-in-out ${delay}s infinite` : "none",
            boxShadow: playing ? "0 0 6px rgba(204,255,0,0.6)" : "none",
          }}
        />
      ))}
    </div>
  );
}

// ── Preview Section ───────────────────────────────────────────────────────────
// ── Preview Section ───────────────────────────────────────────────────────────
function PreviewSection({ track, playing, setPlaying, scores, onAddToHistory }) {
  const audioRef = useRef(null);
  const [empathyMessage, setEmpathyMessage] = useState(null);
  const [accentColor, setAccentColor] = useState("#CCFF00");

  const loggedRef = useRef(false);

  // Reset loggedRef when track changes
  useEffect(() => {
    loggedRef.current = false;
  }, [track?.id]);

  useEffect(() => {
    if (!playing || !track || !scores) return;

    // Determine primary emotion
    const topEmotion = scores.primary_emotion || "happy";

    // Set 30 second timer
    const timer = setTimeout(() => {
      if (!loggedRef.current) {
        loggedRef.current = true;
        if (onAddToHistory) {
          onAddToHistory(track, topEmotion);
        }
      }
    }, 30000);

    return () => clearTimeout(timer);
  }, [playing, track, scores, onAddToHistory]);

  const handleEnded = () => {
    setPlaying(false);
    if (track && scores && !loggedRef.current) {
      loggedRef.current = true;
      const topEmotion = scores.primary_emotion || "happy";
      if (onAddToHistory) {
        onAddToHistory(track, topEmotion);
      }
    }
  };

  useEffect(() => {
    if (!scores || !playing) return;

    const topEmotion = scores.primary_emotion || (() => {
      const emotions = ["happy", "confident", "angry", "sad", "lonely"];
      let top = "happy";
      let maxVal = -1;
      emotions.forEach((emo) => {
        const val = scores[emo] ?? 0;
        if (val > maxVal) {
          maxVal = val;
          top = emo;
        }
      });
      return top;
    })();

    const themeInfo = EMPATHY_THEMES[topEmotion];
    if (themeInfo && themeInfo.messages.length > 0) {
      const messages = themeInfo.messages;
      const randomMsg = messages[Math.floor(Math.random() * messages.length)];

      let timer;
      const deferredTimer = setTimeout(() => {
        setEmpathyMessage(randomMsg);
        setAccentColor(EMOTION_COLORS[topEmotion] || "#CCFF00");

        timer = setTimeout(() => {
          setEmpathyMessage(null);
        }, 3000);
      }, 0);

      return () => {
        clearTimeout(deferredTimer);
        if (timer) clearTimeout(timer);
      };
    }
  }, [playing, scores]);

  useEffect(() => {
    if (!playing) {
      const timer = setTimeout(() => {
        setEmpathyMessage(null);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [playing]);

  useEffect(() => {
    setPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = track?.previewUrl || "";
      audioRef.current.currentTime = 0;
    }
  }, [track?.id, track?.previewUrl, setPlaying]);

  const togglePlay = (e) => {
    e.stopPropagation();
    if (!audioRef.current) return;

    const targetSrc = track?.previewUrl || "";
    if (!targetSrc) {
      alert("No audio preview available for this track.");
      return;
    }

    if (audioRef.current.src !== targetSrc) {
      audioRef.current.src = targetSrc;
    }

    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };

  const imgUrl = track?.artworkUrl?.replace("100x100", "400x400") || MUSIC_PLACEHOLDER;

  // 스포티파이, 애플뮤직 검색 쿼리 생성
  const searchQuery = encodeURIComponent(`${track?.artist || ""} ${track?.title || ""}`);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        position: "relative",
        padding: "20px 10px 30px",
        minWidth: 0,
        zIndex: 10,
        userSelect: "none",
      }}
    >
      <audio ref={audioRef} src={track?.previewUrl} onEnded={handleEnded} />

      {/* Organic blob — behind everything */}
      <div
        style={{
          position: "absolute",
          top: "48%",
          left: "50%",
          transform: "translate(-50%, -52%)",
          width: 230,
          height: 210,
          background: "#1A0050",
          animation: "float-blob 8s ease-in-out infinite",
          zIndex: 0,
          opacity: 0.88,
          pointerEvents: "none",
        }}
      />

      {/* PREVIEW / STOP label */}
      <div
        data-hover="true"
        onClick={togglePlay}
        style={{
          position: "relative",
          zIndex: 2,
          fontFamily: "'Playfair Display', serif",
          fontStyle: "italic",
          fontWeight: 900,
          fontSize: 30,
          color: playing ? "#CCFF00" : "#1A0050",
          cursor: "none",
          userSelect: "none",
          letterSpacing: "-0.01em",
          marginBottom: 12,
          textShadow: playing ? "0 0 24px rgba(204,255,0,0.7)" : "none",
          transition: "color 0.3s, text-shadow 0.3s",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span style={{ fontSize: 24 }}>{playing ? "◼" : "▶"}</span>
        {playing ? "STOP" : "PREVIEW"}
      </div>

      {/* Wrapper for Album Cover + Floating Tooltip */}
      <div style={{ position: "relative", zIndex: 2 }}>
        {/* Tooltip Overlay */}
        <AnimatePresence>
          {empathyMessage && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 10, x: "-50%" }}
              animate={{ opacity: 1, scale: 1, y: 0, x: "-50%" }}
              exit={{ opacity: 0, scale: 0.8, y: -10, x: "-50%" }}
              style={{
                position: "absolute",
                left: "50%",
                bottom: "calc(100% + 12px)", // Float above the album cover
                zIndex: 50,
                background: "rgba(255, 255, 255, 0.4)",
                color: "#21005D",
                border: `2px solid ${accentColor}`,
                borderRadius: "12px",
                padding: "12px 16px",
                textAlign: "center",
                fontWeight: 700,
                fontSize: "11px",
                fontFamily: "'Nanum Myeongjo', serif",
                fontStyle: "italic",
                boxShadow: `0px 4px 15px ${accentColor}55`,
                width: "220px",
                pointerEvents: "none",
                whiteSpace: "pre-wrap",
                wordBreak: "keep-all",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)"
              }}
            >
              {empathyMessage}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Square artist photo */}
        <div
          data-hover="true"
          onClick={togglePlay}
          style={{
            position: "relative",
            width: 160,
            height: 160,
            borderRadius: 10,
            overflow: "hidden",
            cursor: "none",
            boxShadow: playing
              ? "0 8px 40px rgba(26,0,80,0.6), 0 0 0 3px #CCFF00"
              : "0 8px 32px rgba(26,0,80,0.5)",
            border: "2px solid rgba(26,0,80,0.25)",
            transition: "box-shadow 0.3s, transform 0.2s",
            transform: playing ? "scale(1.02)" : "scale(1)",
          }}
        >
          <img
            src={imgUrl}
            alt={track?.artist || "Artist"}
            style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
          />
          {playing && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(26,0,80,0.55)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Waveform playing={true} />
            </div>
          )}
        </div>
      </div>

      {/* Artist name */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          marginTop: 14,
          fontFamily: "'Space Mono', monospace",
          fontSize: 16,
          color: "#CCFF00",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          textAlign: "center",
        }}
      >
        {track?.artist || "Artist"}
        <div style={{ fontSize: 14, fontWeight: 700, color: "#CCFF00", marginTop: 4 }}>
          {track?.title || "Unknown Title"}
        </div>
      </div>

      {/* ── [NEW] 외부 풀버전 듣기 링크 버튼 (Spotify & Apple Music) ── */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          gap: "10px",
          marginTop: "18px",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <a
          href={`https://open.spotify.com/search/${searchQuery}`}
          target="_blank"
          rel="noopener noreferrer"
          data-hover="true"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 14px",
            borderRadius: "20px",
            border: "1px solid rgba(26, 0, 80, 0.4)", // 보라색 테두리
            color: "#1A0050", // 보라색 가사 글씨 색상
            textDecoration: "none",
            fontFamily: "'Space Mono', monospace",
            fontSize: "9px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            cursor: "none",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(26, 0, 80, 0.08)";
            e.currentTarget.style.boxShadow = "0 0 12px rgba(26, 0, 80, 0.15)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <span style={{ fontSize: "12px" }}>🟢</span> SPOTIFY
        </a>

        <a
          href={`https://music.apple.com/search?term=${searchQuery}`}
          target="_blank"
          rel="noopener noreferrer"
          data-hover="true"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 14px",
            borderRadius: "20px",
            border: "1px solid rgba(26, 0, 80, 0.4)", // 보라색 테두리
            color: "#1A0050", // 보라색 가사 글씨 색상
            textDecoration: "none",
            fontFamily: "'Space Mono', monospace",
            fontSize: "9px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            cursor: "none",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(26, 0, 80, 0.08)";
            e.currentTarget.style.boxShadow = "0 0 12px rgba(26, 0, 80, 0.15)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <span style={{ fontSize: "12px" }}>🔴</span> APPLE MUSIC
        </a>
      </div>

    </div>
  );
}

// ── Error Boundary ────────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Chart Render Error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full p-4 flex items-center justify-center bg-red-900/50 rounded-lg text-red-200 text-xs text-center border border-red-500/30">
          차트 데이터를 불러오거나 렌더링하는 중 오류가 발생했습니다.
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Center Panel (핑크색 섹션 내부 가사 스크롤 구현 완료) ───────────────────────
function CenterPanel({ activeTrack, isMobile, scores, lyrics, isGraphOpen, onToggleGraph, onToggleSearch, isSearchOpen, searchQuery, setSearchQuery, onSearch, playing, setPlaying, currentEmotion, onAddToHistory, history }) {
  const [openPopup, setOpenPopup] = useState(null);
  const [prevTrackId, setPrevTrackId] = useState(activeTrack?.id);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  if (activeTrack?.id !== prevTrackId) {
    setPrevTrackId(activeTrack?.id);
    setOpenPopup(null);
    setIsHistoryOpen(false);
  }

  const toggle = (id) => setOpenPopup((prev) => (prev === id ? null : id));
  const close = () => setOpenPopup(null);

  return (
    <div
      className="flex flex-col relative w-full"
      style={{
        height: isMobile ? "auto" : "100%",
        minHeight: "100vh",
        backgroundColor: playing ? EMOTION_COLORS[currentEmotion] : "#F5C8C8",
        animation: "fadeSlideIn 0.5s ease",
        overflowY: isMobile ? "visible" : "auto", // 💖 모바일 스크롤 꼬임 해결
        transition: "background-color 1.5s ease-in-out",
      }}
    >
      {/* Top Header Row for Navigation and History */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          width: "100%",
          padding: isMobile ? "16px 16px 0 16px" : "32px 32px 0 32px",
          position: "relative",
          zIndex: 100,
        }}
      >
        {/* Left: Navigation Button & Search Dropdown */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => onToggleSearch(!isSearchOpen)}
            className={`${isMobile ? "px-4 py-1.5 text-[10px]" : "px-6 py-2 text-[14px]"} rounded-full bg-[#1A0050] text-[#CCFF00] font-bold tracking-[0.15em] uppercase border border-[#CCFF00] transition-all duration-200`}
            style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 900, cursor: "pointer", width: isMobile ? "130px" : "180px" }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.05)"; e.currentTarget.style.boxShadow = "0 0 10px rgba(204,255,0,0.5)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none"; }}
          >
            NAVIGATION 🔍
          </button>

          {isSearchOpen && (
            <div style={{
              position: "absolute",
              top: "100%",
              left: 0,
              marginTop: "12px",
              background: "#1A0050",
              border: "2px solid #CCFF00",
              borderRadius: "12px",
              padding: isMobile ? "16px 20px" : "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              animation: "fadeSlideIn 0.2s ease-out",
              width: isMobile ? "calc(100vw - 32px)" : "240px",
              maxWidth: "320px",
              boxShadow: "0 0 15px rgba(204,255,0,0.2)",
              zIndex: 500
            }}>
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onSearch(searchQuery); }}
                placeholder="SEARCH..."
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "#CCFF00",
                  fontFamily: "'Space Mono', monospace",
                  fontSize: "14px",
                  letterSpacing: "0.05em",
                  width: "100%"
                }}
              />
              <button
                onClick={() => onToggleSearch(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#CCFF00",
                  fontSize: "20px",
                  cursor: "pointer",
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>
          )}
        </div>

        {/* Right: History Button & History Dropdown */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            className={`${isMobile ? "px-4 py-1.5 text-[10px]" : "px-6 py-2 text-[14px]"} rounded-full bg-[#1A0050] text-[#CCFF00] font-bold tracking-[0.15em] uppercase border border-[#CCFF00] transition-all duration-200`}
            style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 900, cursor: "pointer", width: isMobile ? "130px" : "180px" }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.05)"; e.currentTarget.style.boxShadow = "0 0 10px rgba(204,255,0,0.5)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none"; }}
          >
            HISTORY 📊
          </button>

          {isHistoryOpen && (
            <div style={{
              position: "absolute",
              top: "100%",
              right: 0,
              marginTop: "12px",
              background: "#1A0050",
              border: "2px solid #CCFF00",
              borderRadius: "12px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              animation: "fadeSlideIn 0.2s ease-out",
              width: isMobile ? "calc(100vw - 32px)" : "280px",
              maxHeight: "480px",
              boxShadow: "0 0 20px rgba(204,255,0,0.3)",
              zIndex: 500,
              overflowY: "auto",
              scrollbarWidth: "none",
              msOverflowStyle: "none"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#CCFF00",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  fontFamily: "'Space Mono', monospace"
                }}>
                  Mood History
                </div>
                <button
                  onClick={() => setIsHistoryOpen(false)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#CCFF00",
                    fontSize: "20px",
                    cursor: "pointer",
                    lineHeight: 1,
                    padding: "0 4px"
                  }}
                >
                  ×
                </button>
              </div>

              {/* Pie Chart / Donut Chart */}
              <div style={{
                position: "relative",
                width: 120,
                height: 120,
                margin: "0 auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <PieChart width={120} height={120}>
                  <Pie
                    data={(() => {
                      const counts = { happy: 0, confident: 0, angry: 0, sad: 0, lonely: 0, love: 0 };
                      history.forEach(item => {
                        if (counts[item.emotion] !== undefined) counts[item.emotion]++;
                      });
                      const hasHistory = history.length > 0;
                      if (!hasHistory) return [{ name: "empty", value: 1, color: "rgba(255, 255, 255, 0.1)" }];
                      return Object.keys(counts)
                        .filter(key => counts[key] > 0)
                        .map(key => ({
                          name: key,
                          value: counts[key],
                          color: EMOTION_COLORS[key]
                        }));
                    })()}
                    cx="50%"
                    cy="50%"
                    innerRadius={36}
                    outerRadius={48}
                    paddingAngle={history.length > 0 ? 2 : 0}
                    dataKey="value"
                    isAnimationActive={false}
                  >
                    {(() => {
                      const counts = { happy: 0, confident: 0, angry: 0, sad: 0, lonely: 0, love: 0 };
                      history.forEach(item => {
                        if (counts[item.emotion] !== undefined) counts[item.emotion]++;
                      });
                      const hasHistory = history.length > 0;
                      const data = hasHistory
                        ? Object.keys(counts)
                          .filter(key => counts[key] > 0)
                          .map(key => ({ name: key, value: counts[key], color: EMOTION_COLORS[key] }))
                        : [{ name: "empty", value: 1, color: "rgba(255, 255, 255, 0.1)" }];
                      return data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ));
                    })()}
                  </Pie>
                </PieChart>

                {/* Center dominant label */}
                <div style={{
                  position: "absolute",
                  textAlign: "center",
                  width: "100%",
                  pointerEvents: "none",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <span style={{
                    fontSize: 8,
                    color: "rgba(255, 255, 255, 0.5)",
                    textTransform: "uppercase",
                    fontFamily: "'Space Mono', monospace",
                    letterSpacing: "0.05em",
                  }}>
                    Dominant
                  </span>
                  <span style={(() => {
                    const counts = { happy: 0, confident: 0, angry: 0, sad: 0, lonely: 0, love: 0 };
                    history.forEach(item => {
                      if (counts[item.emotion] !== undefined) counts[item.emotion]++;
                    });
                    let dominant = "-";
                    let maxVal = 0;
                    Object.keys(counts).forEach(key => {
                      if (counts[key] > maxVal) {
                        maxVal = counts[key];
                        dominant = key.toUpperCase();
                      }
                    });
                    return {
                      fontSize: dominant.length > 8 ? 8 : 10,
                      color: history.length > 0 ? (EMOTION_COLORS[dominant.toLowerCase()] || "#CCFF00") : "#888",
                      fontWeight: 800,
                      fontFamily: "'Space Mono', monospace",
                      letterSpacing: "0.02em",
                      marginTop: 2
                    };
                  })()}>
                    {(() => {
                      const counts = { happy: 0, confident: 0, angry: 0, sad: 0, lonely: 0, love: 0 };
                      history.forEach(item => {
                        if (counts[item.emotion] !== undefined) counts[item.emotion]++;
                      });
                      let dominant = "-";
                      let maxVal = 0;
                      Object.keys(counts).forEach(key => {
                        if (counts[key] > maxVal) {
                          maxVal = counts[key];
                          dominant = key.toUpperCase();
                        }
                      });
                      return dominant;
                    })()}
                  </span>
                </div>
              </div>

              {/* History list of played songs */}
              <div style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginTop: 4,
                maxHeight: "180px",
                overflowY: "auto",
                scrollbarWidth: "none",
                msOverflowStyle: "none"
              }}>
                {history.length === 0 ? (
                  <div style={{
                    fontSize: 9,
                    color: "rgba(255, 255, 255, 0.4)",
                    textAlign: "center",
                    fontFamily: "'Space Mono', monospace",
                    padding: "12px 0"
                  }}>
                    No history yet
                  </div>
                ) : (
                  history.slice().reverse().map(item => (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 8px",
                        background: "rgba(255, 255, 255, 0.05)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: 6,
                      }}
                    >
                      <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor: EMOTION_COLORS[item.emotion] || "#CCFF00",
                        flexShrink: 0,
                        boxShadow: `0 0 5px ${EMOTION_COLORS[item.emotion]}aa`
                      }} />
                      <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                        <span style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: "#fff",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          fontFamily: "'Space Mono', monospace"
                        }} title={item.title}>
                          {item.title}
                        </span>
                        <span style={{
                          fontSize: 8,
                          color: "rgba(255, 255, 255, 0.5)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          fontFamily: "'Space Mono', monospace",
                          marginTop: 1
                        }} title={item.artist}>
                          {item.artist}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top Center: Preview Section */}
      <div className="flex justify-center w-full mt-2">
        <PreviewSection track={activeTrack} playing={playing} setPlaying={setPlaying} scores={scores} onAddToHistory={onAddToHistory} />
      </div>

      {/* Info buttons row (가로로 일렬 배치) */}
      <div className="flex flex-row flex-wrap justify-center items-center gap-4 mt-6 px-4 relative z-50 w-full">
        {INFO_BUTTONS.map((btn) => (
          <InfoButton
            key={btn.id}
            btn={btn}
            isOpen={openPopup === btn.id}
            onToggle={() => {
              const isOpening = openPopup !== btn.id;
              toggle(btn.id);
              if (btn.id === "graph") {
                if (onToggleGraph) onToggleGraph(isOpening);
              }
            }}
            onClose={() => {
              close();
              if (btn.id === "graph") {
                if (onToggleGraph) onToggleGraph(false);
              }
            }}
            isMobile={isMobile}
            track={activeTrack}
            scores={scores}
          />
        ))}
      </div>

      {/* Content row (Radar chart) */}
      {isGraphOpen && (
        <div
          className={`flex flex-1 flex-col items-center justify-center gap-4 ${isMobile ? "p-5 pb-10" : "p-6 pb-12"}`}
          style={{ position: "relative", zIndex: 10, pointerEvents: "none" }}
        >
          {lyrics === "LOADING LYRICS..." && (
            <div style={{
              color: "#CCFF00",
              fontSize: "9px",
              fontFamily: "'Space Mono', monospace",
              letterSpacing: "0.15em",
              textShadow: "0 0 8px rgba(204,255,0,0.6)",
              marginBottom: "8px",
              textAlign: "center"
            }}>
              ⚡ AI ANALYZING MOOD & LYRICS...
            </div>
          )}
          {scores && (
            <ErrorBoundary>
              <EmotionRadarChart scores={scores} playing={playing} />
            </ErrorBoundary>
          )}
        </div>
      )}

      {/* ── [신규 추가] 핑크 섹션 배경에 흘러나오는 힙한 가사 보드 (하단 배치) ── */}
      <div
        style={{
          position: "relative",
          margin: "20px auto 80px auto",
          height: "auto",
          minHeight: isMobile ? "1000px" : "600px",
          width: "90%",
          maxWidth: "800px",
          backgroundColor: playing ? EMOTION_COLORS[currentEmotion] : "#F5C8C8",
          transition: "background-color 1.5s ease-in-out",
          border: "none",
          borderRadius: "12px",
          padding: "20px",
          fontFamily: "\"Pretendard Variable\", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, \"Helvetica Neue\", \"Segoe UI\", \"Apple SD Gothic Neo\", \"Noto Sans KR\", \"Malgun Gothic\", \"Apple Color Emoji\", \"Segoe UI Emoji\", \"Segoe UI Symbol\", sans-serif",
          textAlign: "center",
          color: "#1A0050",
          overflowY: "auto",
          lineHeight: "1.8",
          fontSize: "13px",
          whiteSpace: "pre-wrap",
          zIndex: 1
        }}
      >
        {activeTrack?.lyrics_sentiment && (
          <div style={{ fontSize: "15px", fontWeight: "800", marginBottom: "16px", color: "#CCFF00", textShadow: "0 0 5px rgba(204,255,0,0.3)" }}>
            Sentiment: Happy {Math.round((activeTrack.lyrics_sentiment.happy ?? activeTrack.lyrics_sentiment.joy ?? 0) * 100)}% · Sad {Math.round((activeTrack.lyrics_sentiment.sad ?? activeTrack.lyrics_sentiment.depression ?? 0) * 100)}% · Angry {Math.round((activeTrack.lyrics_sentiment.angry ?? 0) * 100)}% · Love {Math.round((activeTrack.lyrics_sentiment.love ?? 0) * 100)}% · Lonely {Math.round((activeTrack.lyrics_sentiment.lonely ?? activeTrack.lyrics_sentiment.anxiety ?? 0) * 100)}% · Confident {Math.round((activeTrack.lyrics_sentiment.confident ?? activeTrack.lyrics_sentiment.stability ?? 0) * 100)}%
          </div>
        )}
        <div style={{ fontWeight: "700" }}>
          {lyrics}
        </div>
      </div>
    </div>
  );
}

// ── Mobile Sidebar Strip ──────────────────────────────────────────────────────
function MobileSidebarStrip({ tracks, activeTrack, onSelect, label }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          fontSize: 8,
          color: "rgba(255,255,255,0.3)",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          fontFamily: "'Space Mono', monospace",
          padding: "8px 12px 4px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          overflowX: "auto",
          scrollbarWidth: "none",
          gap: 8,
          padding: "4px 12px 12px",
        }}
      >
        {tracks.map((track) => (
          <div
            key={track.id}
            data-hover="true"
            onClick={() => onSelect(track)}
            style={{
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              cursor: "none",
            }}
          >
            <img
              src={track.artworkUrl || MUSIC_PLACEHOLDER}
              alt={track.artist}
              style={{
                width: 72,
                height: 54,
                objectFit: "cover",
                borderRadius: 6,
                border: activeTrack?.id === track.id ? "2px solid #CCFF00" : "2px solid transparent",
                boxShadow: activeTrack?.id === track.id ? "0 0 10px rgba(204,255,0,0.5)" : "none",
                transition: "border 0.2s, box-shadow 0.2s",
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", maxWidth: 72 }}>
              <span
                style={{
                  fontSize: 8,
                  fontWeight: 700,
                  color: activeTrack?.id === track.id ? "#CCFF00" : "rgba(255,255,255,0.8)",
                  fontFamily: "'Space Mono', monospace",
                  textAlign: "center",
                  lineHeight: 1.1,
                  transition: "color 0.2s",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "inline-block",
                  width: "100%",
                }}
              >
                {track.title}
              </span>
              <span
                style={{
                  fontSize: 7,
                  color: activeTrack?.id === track.id ? "rgba(204,255,0,0.7)" : "rgba(255,255,255,0.4)",
                  fontFamily: "'Space Mono', monospace",
                  textAlign: "center",
                  lineHeight: 1.1,
                  transition: "color 0.2s",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "inline-block",
                  width: "100%",
                  marginTop: 2,
                }}
              >
                {track.artist}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────
function Header({ isMobile, tracksCount, onLogoClick }) {
  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 80,
        zIndex: 100,
        background: "#1A0050",
        borderBottom: "1px solid rgba(204,255,0,0.14)",
        display: "flex",
        alignItems: "center",
        padding: isMobile ? "0 16px" : "0 32px",
        boxShadow: "0 4px 28px rgba(0,0,0,0.5)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <div
          onClick={onLogoClick}
          style={{
            fontFamily: "'Playfair Display', serif",
            fontStyle: "italic",
            fontWeight: 900,
            fontSize: isMobile ? 34 : 48,
            color: "#fff",
            letterSpacing: "-0.02em",
            lineHeight: 1,
            cursor: onLogoClick ? "pointer" : "default",
          }}
        >
          MMMHAK
        </div>
        <div
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: isMobile ? 7 : 9,
            fontWeight: 400,
            color: "rgba(255,255,255,0.6)",
            letterSpacing: isMobile ? "0.22em" : "0.35em",
            textTransform: "uppercase",
          }}
        >
          Music Is Your Life
        </div>
      </div>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: 8,
            color: "rgba(255,255,255,0.4)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          {tracksCount} Tracks
        </span>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#CCFF00",
            boxShadow: "0 0 10px #CCFF0099",
            animation: "pulse-glow 2s ease-in-out infinite",
          }}
        />
        <span
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: 8,
            color: "rgba(255,255,255,0.3)",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          Live
        </span>
      </div>
    </header>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function MMMHAKApp() {
  const [tracks, setTracks] = useState([]);
  const [activeTrack, setActiveTrack] = useState(null);
  const [scores, setScores] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState("CONNECTING LAST.FM API...");
  const [isMobile, setIsMobile] = useState(false);
  const [playing, setPlaying] = useState(false);

  // 💖 가사 상태 관리를 위한 신규 State 추가
  const [lyrics, setLyrics] = useState("LOADING LYRICS...");
  const [isGraphOpen, setIsGraphOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const requestIdRef = useRef(0);

  const [moodHistory, setMoodHistory] = useState([]);

  const handleAddToHistory = useCallback((track, emotion) => {
    setMoodHistory((prev) => [
      ...prev,
      {
        id: track.id + "_" + Date.now(),
        title: track.title,
        artist: track.artist,
        emotion: emotion
      }
    ]);
  }, []);

  // Derive dominant emotion from scores during render
  let currentEmotion = "happy";
  if (scores) {
    if (scores.primary_emotion) {
      currentEmotion = scores.primary_emotion;
    } else {
      const emotionsList = ["happy", "confident", "angry", "sad", "lonely"];
      let maxVal = -1;
      emotionsList.forEach((emo) => {
        const val = scores[emo] ?? 0;
        if (val > maxVal) {
          maxVal = val;
          currentEmotion = emo;
        }
      });
    }
  }

  const LASTFM_API_KEY = "8031c3fd85fae84e3a1970b02e22a231";
  const LASTFM_BASE = "https://ws.audioscrobbler.com/2.0";

  // 🎵 1. 더 안전해진 아이튠즈 우회 함수 (에러 방어력 MAX - 다중 복구 및 국가별 스토어 폴백 적용)
  const fetchItunesData = async (title, artist) => {
    const fetchWithTerm = async (term, country = "") => {
      try {
        const q = encodeURIComponent(term);
        const countryParam = country ? `&country=${country}` : "";
        const useDirect = window.location.protocol === "https:";
        const res = useDirect
          ? await fetch(`https://itunes.apple.com/search?term=${q}&entity=song&limit=5${countryParam}`)
          : await fetch(`${getApiBaseUrl()}/api/itunes?term=${q}&limit=5${countryParam}`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.results || [];
      } catch {
        return [];
      }
    };

    const searchSequence = async (country = "") => {
      const safeTitle = title || "";
      const safeArtist = artist || "";

      // 1차 시도: 원본 곡명 + 아티스트명
      let results = await fetchWithTerm(`${safeTitle} ${safeArtist}`, country);

      // 2차 시도: 원본 곡명 + 아티스트 첫 단어 (아티스트 명칭이 너무 길거나 피처링 정보가 붙어있을 때 대비)
      if (results.length === 0) {
        const cleanArtist = safeArtist.split(/[,/&]|\bfeat\b/i)[0].trim();
        results = await fetchWithTerm(`${safeTitle} ${cleanArtist}`, country);
      }

      // 3차 시도: 괄호 및 불필요한 단어를 제거한 정제된 쿼리 (Remastered, Radio Edit 등)
      if (results.length === 0) {
        const cleanTitle = safeTitle
          .replace(/\(.*?\)/g, '')
          .replace(/\[.*?\]/g, '')
          .replace(/- \d{4} Remaster.*/gi, '')
          .replace(/remastered/gi, '')
          .replace(/feat\..*/gi, '')
          .replace(/ft\..*/gi, '')
          .trim();
        const cleanArtist = safeArtist.split(/[,/&]|\bfeat\b/i)[0].trim();
        results = await fetchWithTerm(`${cleanTitle} ${cleanArtist}`, country);
      }

      if (results.length === 0) {
        const cleanTitle = safeTitle
          .replace(/\(.*?\)/g, '')
          .replace(/\[.*?\]/g, '')
          .trim();
        results = await fetchWithTerm(cleanTitle, country);
      }

      const match = results.find(r =>
        r.artistName?.toLowerCase().includes(safeArtist.toLowerCase().split(' ')[0]) ||
        r.trackName?.toLowerCase().includes(safeTitle.toLowerCase().split(' ')[0])
      ) || results[0];

      return match || null;
    };

    try {
      let match = await searchSequence("");

      // 2단계: 프리뷰가 없다면 미국(US) 스토어에서 시도 (글로벌 팝송 매칭율 극대화)
      if (!match || !match.previewUrl) {
        const usMatch = await searchSequence("US");
        if (usMatch && usMatch.previewUrl) {
          match = usMatch;
        }
      }

      // 3단계: 여전히 없다면 한국(KR) 스토어에서 시도 (국내 가요/K-pop 매칭율 극대화)
      if (!match || !match.previewUrl) {
        const krMatch = await searchSequence("KR");
        if (krMatch && krMatch.previewUrl) {
          match = krMatch;
        }
      }

      if (!match) return { artworkUrl: null, previewUrl: null };

      return {
        artworkUrl: match.artworkUrl100?.replace('100x100bb', '400x400bb') || null,
        previewUrl: match.previewUrl || null,
      };
    } catch (error) {
      console.error('iTunes fetch error:', error);
      return { artworkUrl: null, previewUrl: null };
    }
  };

  // 🚀 2. 백그라운드 50곡 처리를 보장하는 프로세스 함수
  const processTracks = async (rawTracks, startIdx = 0, onBatchComplete = null) => {
    const BATCH = 15;
    let allItems = [];

    for (let b = 0; b < rawTracks.length; b += BATCH) {
      const batch = rawTracks.slice(b, b + BATCH);

      try {
        const batchItems = await Promise.all(
          batch.map(async (raw, batchIdx) => {
            const idx = startIdx + b + batchIdx;
            const artistName = typeof raw.artist === 'string' ? raw.artist : raw.artist?.name || 'Unknown Artist';
            const playcount = parseInt(raw.playcount || '0', 10);
            const listeners = parseInt(raw.listeners || '0', 10);
            const cacheKey = `${artistName}_${raw.name}`.toLowerCase();

            // 1. Last.fm 캐시 적용
            let tags = [];
            let lastfmCover = null;
            if (lastfmCache[cacheKey]) {
              tags = lastfmCache[cacheKey].tags;
              lastfmCover = lastfmCache[cacheKey].cover;
            } else {
              try {
                const infoRes = await fetch(`${LASTFM_BASE}/?method=track.getInfo&api_key=${LASTFM_API_KEY}&artist=${encodeURIComponent(artistName)}&track=${encodeURIComponent(raw.name)}&format=json`);
                if (infoRes.ok) {
                  const infoData = await infoRes.json();
                  tags = (infoData?.track?.toptags?.tag || []).map(t => t.name.toLowerCase());
                  const albumImages = infoData?.track?.album?.image;
                  if (Array.isArray(albumImages) && albumImages.length > 0) {
                    const largeImg = albumImages.find(img => img.size === 'extralarge') || albumImages[albumImages.length - 1];
                    if (largeImg && largeImg['#text'] && !largeImg['#text'].includes('default_album')) {
                      lastfmCover = largeImg['#text'];
                    }
                  }
                  // 캐시 갱신
                  lastfmCache[cacheKey] = { tags, cover: lastfmCover };
                  setLocalCache("mm_lastfm_cache", lastfmCache);
                }
              } catch {
                /* ignore */
              }
            }

            // 2. raw.image 백업
            if (!lastfmCover && Array.isArray(raw.image) && raw.image.length > 0) {
              const largeImg = raw.image.find(img => img.size === 'extralarge') || raw.image[raw.image.length - 1];
              if (largeImg && largeImg['#text'] && !largeImg['#text'].includes('default_album')) {
                lastfmCover = largeImg['#text'];
              }
            }

            // 3. iTunes 캐시 적용 (기존 빈 캐시 치유 로직 포함)
            let itunes;
            if (itunesCache[cacheKey] && (itunesCache[cacheKey].previewUrl || itunesCache[cacheKey].hasNoPreview)) {
              itunes = itunesCache[cacheKey];
            } else {
              itunes = await fetchItunesData(raw.name, artistName);
              if (!itunes.previewUrl) {
                itunes.hasNoPreview = true;
              }
              itunesCache[cacheKey] = itunes;
              setLocalCache("mm_itunes_cache", itunesCache);
            }

            const artworkUrl = itunes.artworkUrl || lastfmCover || null;

            const hasSad = tags.some(t => ['sad', 'melancholy', 'heartbreak', 'depression', 'dark', 'emo', 'blues'].some(k => t.includes(k)));
            const hasAngry = tags.some(t => ['angry', 'aggressive', 'metal', 'hardcore', 'rage', 'punk'].some(k => t.includes(k)));
            const hasHappy = tags.some(t => ['happy', 'upbeat', 'dance', 'party', 'summer', 'pop', 'fun', 'joy'].some(k => t.includes(k)));
            const hasCalm = tags.some(t => ['calm', 'chill', 'relax', 'ambient', 'peaceful', 'acoustic'].some(k => t.includes(k)));
            const hasLove = tags.some(t => ['love', 'romantic', 'heart', 'affection', 'together', 'sweet'].some(k => t.includes(k)));
            const hasLonely = tags.some(t => ['lonely', 'loneliness', 'alone', 'isolated', 'solitude'].some(k => t.includes(k)));
            const hasConfident = tags.some(t => ['confident', 'confidence', 'proud', 'power', 'strong', 'bold', 'badass', 'anthem', 'energy'].some(k => t.includes(k)));

            const getPseudoRandom = (str) => {
              let hash = 0;
              for (let i = 0; i < str.length; i++) {
                hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
              }
              const x = Math.sin(hash) * 10000;
              return x - Math.floor(x);
            };

            const trackSeed = raw.name + artistName;
            const randVal = getPseudoRandom(trackSeed);
            const randVal2 = getPseudoRandom(trackSeed + 'alt');

            const genreStr = tags.join(' ');
            const isHighTempoGenre = ['dance', 'electronic', 'rock', 'metal', 'punk', 'house', 'edm', 'upbeat'].some(g => genreStr.includes(g));
            const isLowTempoGenre = ['r&b', 'soul', 'ballad', 'acoustic', 'classical', 'jazz', 'ambient', 'chill', 'downtempo', 'lo-fi'].some(g => genreStr.includes(g));

            let baseBpm;
            let baseEnergy;

            if (isHighTempoGenre || hasAngry) {
              baseBpm = 130 + Math.floor(randVal * 40);
              baseEnergy = 0.75 + randVal2 * 0.2;
            } else if (isLowTempoGenre || hasCalm || hasSad) {
              baseBpm = 65 + Math.floor(randVal * 30);
              baseEnergy = 0.2 + randVal2 * 0.25;
            } else if (hasHappy) {
              baseBpm = 110 + Math.floor(randVal * 25);
              baseEnergy = 0.6 + randVal2 * 0.2;
            } else {
              baseBpm = 90 + Math.floor(randVal * 35);
              baseEnergy = 0.45 + randVal2 * 0.3;
            }

            const valence = hasHappy ? 0.65 + randVal * 0.25 : hasSad ? 0.10 + randVal * 0.20 : hasAngry ? 0.20 + randVal * 0.20 : 0.35 + randVal * 0.30;
            const loudness = hasAngry || isHighTempoGenre ? -3 - randVal * 3 : hasCalm || isLowTempoGenre ? -10 - randVal * 5 : -5 - randVal * 4;
            const mode = (hasSad || hasAngry) ? 'minor' : 'major';

            const modeModifier = mode === 'minor' ? 0.6 : 1.0;
            const normalizedBpm = Math.min(Math.max((baseBpm - 60) / 100, 0), 1);
            const intensity = (baseEnergy * 0.6) + (normalizedBpm * 0.4);

            const lyrics_sentiment = {
              happy: Math.max(0.01, parseFloat(((((hasHappy ? 0.5 : 0.1) + valence * 0.3) * modeModifier) * (0.5 + intensity)).toFixed(2))),
              sad: Math.max(0.01, parseFloat((((hasSad ? 0.4 : 0.05) + (1 - valence) * 0.4) * (1.5 - intensity)).toFixed(2))),
              angry: Math.max(0.01, parseFloat((((hasAngry ? 0.4 : 0.05) + (1 - valence) * 0.3) * (0.5 + intensity)).toFixed(2))),
              love: Math.max(0.01, parseFloat(((((hasLove ? 0.5 : 0.1) + valence * 0.2) * modeModifier) * (0.8 + intensity * 0.2)).toFixed(2))),
              lonely: Math.max(0.01, parseFloat((((hasLonely ? 0.4 : 0.1) + (1 - valence) * 0.3) * (1.2 - intensity * 0.2)).toFixed(2))),
              confident: Math.max(0.01, parseFloat((((hasConfident ? 0.4 : 0.1) + valence * 0.2) * (0.5 + intensity)).toFixed(2))),
            };

            return {
              id: `${artistName}_${raw.name}_${idx}`,
              title: raw.name,
              artist: artistName,
              bpm: baseBpm,
              mode,
              valence: parseFloat(valence.toFixed(3)),
              energy: parseFloat(baseEnergy.toFixed(3)),
              loudness: parseFloat(loudness.toFixed(1)),
              streams: playcount || (listeners * 3) || ((50 - idx) * 20000000 + 50000000),
              listeners,
              tags,
              artworkUrl: artworkUrl,
              previewUrl: itunes.previewUrl,
              lyrics_sentiment,
              rank: idx,
            };
          })
        );

        allItems = [...allItems, ...batchItems];
        if (onBatchComplete) {
          onBatchComplete(batchItems);
        }
      } catch (err) {
        console.error(`Batch processing error at index ${b}:`, err);
      }

      await new Promise(resolve => setTimeout(resolve, 10));
    }
    return allItems;
  };

  const handleSearch = async (query) => {
    if (!query.trim()) return;
    setIsSearchOpen(false);
    const myRequestId = ++requestIdRef.current;
    try {
      setLoading(true);
      setLoadingStatus(`🔍 SEARCHING FOR ${query.toUpperCase()}...`);

      const searchRes = await fetch(`${LASTFM_BASE}/?method=track.search&track=${encodeURIComponent(query)}&api_key=${LASTFM_API_KEY}&format=json&limit=30`);
      if (!searchRes.ok) throw new Error("Search request failed");

      const searchData = await searchRes.json();
      let rawTracks = searchData?.results?.trackmatches?.track || [];
      if (!Array.isArray(rawTracks)) {
        rawTracks = [rawTracks];
      }

      if (rawTracks.length === 0) {
        alert("No tracks found for your search.");
        setLoading(false);
        return;
      }

      setLoadingStatus(`🎵 ANALYZING ${rawTracks.length} SEARCH RESULTS...`);

      const firstItem = await processTracks([rawTracks[0]], 0);
      if (myRequestId !== requestIdRef.current) return;

      setTracks(firstItem);
      setActiveTrack(firstItem[0]);
      setScores(computeVirusScores(firstItem[0]));
      setLyrics("LOADING LYRICS...");
      fetchLyrics(firstItem[0].title, firstItem[0].artist).then(setLyrics);
      setLoading(false);

      if (rawTracks.length > 1) {
        processTracks(rawTracks.slice(1), 1, (batchItems) => {
          if (myRequestId !== requestIdRef.current) return;
          setTracks(prev => safeMergeTracks(prev, batchItems));
        }).catch(err => console.error("Background loading error:", err));
      }
    } catch (err) {
      console.error("Search error:", err);
      alert("Failed to search tracks.");
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Removed unused useEffect that synchronously set currentEmotion state

  useEffect(() => {
    const targetColor = playing ? (EMOTION_COLORS[currentEmotion] || "#1A0050") : "#1A0050";
    document.body.style.backgroundColor = targetColor;
  }, [playing, currentEmotion]);



  const fetchLyrics = useCallback(async (title, artist) => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`);
      if (!response.ok) {
        throw new Error('Lyrics fetch failed');
      }
      const data = await response.json();
      return data.lyrics || "현재 이 곡의 가사를 제공할 수 없습니다.";
    } catch (e) {
      console.error(`Lyrics fetch error:`, e);
      if (window.location.protocol === "https:" && (e.name === "TypeError" || e.message?.includes("fetch"))) {
        return `⚠️ [보안 제한 안내] HTTPS 환경에서 로컬 백엔드 서버(HTTP) 호출이 차단되었습니다.\n\n해결하려면 브라우저 주소창 왼쪽 [자물쇠 아이콘(설정)] ➔ [사이트 설정] ➔ [안전하지 않은 콘텐츠(Insecure content)]를 '허용(Allow)'으로 변경하고 새로고침해 주세요.`;
      }
      return "현재 이 곡의 가사를 제공할 수 없습니다.";
    }
  }, []);

  const handleSelect = useCallback(async (track) => {
    setPlaying(false); // Stop playing immediately to avoid layout background color flicker

    // Check if the track is already AI analyzed
    if (track.isAI && track.lyrics) {
      setActiveTrack(track);
      setScores(track.aiScores);
      setLyrics(track.lyrics);
      setIsGraphOpen(false);
      setIsSearchOpen(false);
      return;
    }

    setActiveTrack(track);
    setScores(computeVirusScores(track));
    setLyrics("LOADING LYRICS...");
    setIsGraphOpen(false);
    setIsSearchOpen(false);

    try {
      const fetchedLyrics = await fetchLyrics(track.title, track.artist);
      setLyrics(fetchedLyrics);

      if (fetchedLyrics !== "현재 이 곡의 가사를 제공할 수 없습니다.") {
        const analyzeRes = await fetch(`${getApiBaseUrl()}/api/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lyrics: fetchedLyrics,
            title: track.title,
            artist: track.artist
          })
        });

        if (!analyzeRes.ok) throw new Error("AI Analysis API error");

        const aiScores = await analyzeRes.json();
        console.log('AI Analysis Data:', aiScores);

        const finalScores = (() => {
          const { streams } = track;
          const contagion = Math.log10(Math.max(streams, 10)) / Math.log10(3000000000);

          const legacyMapping = {
            happy: ["happy", "joy"],
            sad: ["sad", "depression"],
            angry: ["angry", "anger"],
            lonely: ["lonely", "anxiety"],
            confident: ["confident", "stability"],
            love: ["love"]
          };

          const getVal = (key) => {
            const keysToTry = legacyMapping[key] || [key];
            let val = undefined;
            for (const k of keysToTry) {
              val = aiScores.scores?.[k] ?? aiScores[k] ?? aiScores.emotions?.[k];
              if (val !== undefined) break;
            }
            return Math.min(Math.max(Number(val) || 0, 0), 1.0);
          };

          const spread = {
            happy: getVal('happy'),
            sad: getVal('sad'),
            angry: getVal('angry'),
            love: getVal('love'),
            lonely: getVal('lonely'),
            confident: getVal('confident'),
          };

          const viralRisk = Object.values(spread).reduce((sum, v) => sum + v, 0) / 6 * contagion;
          const positive_score = Math.min((spread.happy ?? 0) * 0.4 + (spread.love ?? 0) * 0.3 + (spread.confident ?? 0) * 0.3, 1);
          const negative_score = Math.min((spread.sad ?? 0) * 0.4 + (spread.lonely ?? 0) * 0.3 + (spread.angry ?? 0) * 0.3, 1);
          const polarity = positive_score - negative_score;
          const confidence = Math.abs(polarity);
          const classification = polarity > 0.25 ? "POSITIVE" : polarity < -0.25 ? "NEGATIVE" : "MIXED";

          const primary_emotion = aiScores.primary_emotion || (() => {
            const emos = ["happy", "confident", "angry", "sad", "lonely"];
            let maxVal = -1;
            let top = "happy";
            emos.forEach((emo) => {
              if ((spread[emo] ?? 0) > maxVal) {
                maxVal = spread[emo];
                top = emo;
              }
            });
            return top;
          })();

          const valence_group = aiScores.valence_group || (polarity > 0.0 ? "positive" : "negative");
          const love_theme_score = aiScores.love_theme_score ?? spread.love;
          const is_love_themed = aiScores.is_love_themed ?? (love_theme_score >= 0.35);

          return {
            ...spread,
            positive_score,
            negative_score,
            polarity,
            confidence,
            classification,
            discomfort: ((spread.angry ?? 0) * 0.4 + (spread.sad ?? 0) * 0.3 + (spread.lonely ?? 0) * 0.3),
            contagion,
            viralRisk,
            streams,
            isAI: true,
            primary_emotion,
            valence_group,
            love_theme_score,
            is_love_themed
          };
        })();

        setScores(finalScores);

        // Update activeTrack and update the track in the tracks list with AI scores and lyrics
        const updatedTrack = {
          ...track,
          isAI: true,
          lyrics: fetchedLyrics,
          aiScores: finalScores,
          lyrics_sentiment: finalScores
        };
        setActiveTrack(updatedTrack);
        setTracks(prev => prev.map(t => t.id === track.id ? updatedTrack : t));
      }
    } catch (err) {
      console.error("Analysis fallback:", err);
    }
  }, [setPlaying, setTracks, fetchLyrics]);

  // 🌟 3. 글로벌 차트 50곡을 백그라운드에서 안전하게 로드
  const fetchGlobalChart = async () => {
    const myRequestId = ++requestIdRef.current;
    try {
      setLoading(true);
      setLoadingStatus("📡 FETCHING LAST.FM GLOBAL CHART...");

      const chartRes = await fetch(`${LASTFM_BASE}/?method=chart.getTopTracks&api_key=${LASTFM_API_KEY}&format=json&limit=50`);
      if (!chartRes.ok) throw new Error("Last.fm request failed");

      const chartData = await chartRes.json();
      const rawTracks = chartData?.tracks?.track || [];
      if (rawTracks.length === 0) throw new Error("No tracks found");

      setLoadingStatus(`🎵 LOADED ${rawTracks.length} TRACKS. STARTING ANALYSIS...`);

      const firstItem = await processTracks([rawTracks[0]], 0);
      if (myRequestId !== requestIdRef.current) return;

      setTracks(firstItem);
      handleSelect(firstItem[0]);
      setLoading(false);

      if (rawTracks.length > 1) {
        processTracks(rawTracks.slice(1), 1, (batchItems) => {
          if (myRequestId !== requestIdRef.current) return;
          setTracks(prev => safeMergeTracks(prev, batchItems));
        }).catch(err => console.error("Background loading error:", err));
      }
    } catch (err) {
      console.error("API error, using mock data:", err);
      if (myRequestId !== requestIdRef.current) return;
      const mock = typeof MOCK_TRACKS !== 'undefined' ? MOCK_TRACKS.map((t, idx) => ({ ...t, id: t.id + idx, rank: idx, streams: t.streams || 500000000, artworkUrl: null, previewUrl: null })) : [];
      if (mock.length > 0) {
        setTracks(mock);
        handleSelect(mock[0]);
      }
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchGlobalChart();
    }, 0);
    return () => clearTimeout(timer);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  if (loading || !activeTrack || !scores) {
    return (
      <div style={{
        minHeight: "100vh", background: "#1A0050", color: "#F5EED8",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        fontFamily: "'Space Mono', 'Courier New', monospace", gap: 20,
      }}>
        <div style={{
          width: 55, height: 55, borderRadius: "50%",
          border: "3px solid rgba(204,255,0,0.1)", borderTopColor: "#CCFF00",
          animation: "spin 1s linear infinite", boxShadow: "0 0 20px rgba(204,255,0,0.4)",
        }} />
        <div style={{ fontSize: 10, letterSpacing: "0.2em", color: "rgba(255,255,255,0.7)", textTransform: "uppercase", textAlign: "center", maxWidth: 300 }}>
          {loadingStatus}
        </div>
      </div>
    );
  }
  const half = Math.ceil(tracks.length / 2);
  const leftTracks = tracks.slice(0, half);
  const rightTracks = tracks.slice(half);

  // LYRICS 버튼 클릭 트리거 감지를 위해 handleSelect를 감싼 래퍼 생성 및 개조
  const patchTrackSelection = (track) => {
    handleSelect(track);
  };

  return (
    <>
      <CustomCursor />

      <div style={{ position: "fixed", inset: 0, backgroundColor: playing ? EMOTION_COLORS[currentEmotion] : "#1A0050", zIndex: -1, transition: "background-color 1.5s ease-in-out" }} />

      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage: "radial-gradient(circle, rgba(204,255,0,0.045) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
          zIndex: 0,
          pointerEvents: "none",
        }}
      />

      <div style={{ width: "100%", height: "100%" }}>
        <Header isMobile={isMobile} tracksCount={tracks.length} onLogoClick={fetchGlobalChart} />

        {/* ── DESKTOP layout ── */}
        {!isMobile && (
          <>
            <Sidebar tracks={leftTracks} side="left" activeTrack={activeTrack} onSelect={patchTrackSelection} isMobile={false} />
            <Sidebar tracks={rightTracks} side="right" activeTrack={activeTrack} onSelect={patchTrackSelection} isMobile={false} />
            <div
              style={{
                position: "fixed",
                top: 80,
                left: 160,
                right: 160,
                bottom: 0,
                overflowY: "auto",
                overflowX: "hidden",
                scrollbarWidth: "none",
                zIndex: 10,
              }}
            >
              <CenterPanel
                activeTrack={activeTrack}
                isMobile={false}
                scores={scores}
                lyrics={lyrics}
                isGraphOpen={isGraphOpen}
                onToggleGraph={setIsGraphOpen}
                onToggleSearch={setIsSearchOpen}
                isSearchOpen={isSearchOpen}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onSearch={handleSearch}
                playing={playing}
                setPlaying={setPlaying}
                currentEmotion={currentEmotion}
                onAddToHistory={handleAddToHistory}
                history={moodHistory}
              />
            </div>
          </>
        )}

        {/* ── MOBILE layout ── */}
        {isMobile && (
          <div
            className="mobile-scroll-container"
            style={{
              position: "fixed",
              top: 80,
              left: 0,
              right: 0,
              bottom: 0,
              overflowY: "auto",
              scrollbarWidth: "none",
              zIndex: 10,
              touchAction: "pan-y",
            }}
          >
            <MobileSidebarStrip tracks={tracks} activeTrack={activeTrack} onSelect={patchTrackSelection} label="Top Tracks" />
            <CenterPanel
              activeTrack={activeTrack}
              isMobile={true}
              scores={scores}
              lyrics={lyrics}
              isGraphOpen={isGraphOpen}
              onToggleGraph={setIsGraphOpen}
              onToggleSearch={setIsSearchOpen}
              isSearchOpen={isSearchOpen}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onSearch={handleSearch}
              playing={playing}
              setPlaying={setPlaying}
              currentEmotion={currentEmotion}
              onAddToHistory={handleAddToHistory}
              history={moodHistory}
            />
          </div>
        )}
      </div>
    </>
  );
}
