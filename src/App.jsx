import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PieChart, Pie, Cell } from "recharts";
import "./App.css";
import EmotionRadarChart from "./EmotionRadarChart";
import {
  useTrackCatalog,
  useTrackAnalysis,
  useMoodHistory
} from "./hooks";

// Optimized: LocalStorage caching + Incremental rendering (15-track batch)
const MUSIC_PLACEHOLDER = "/default_album_art.png";

const EMOTION_COLORS = {
  Aggressive: "#BF1111",
  Energetic: "#FF5F2A",
  Desolation: "#BEB729",
  Uplifting: "#FF06EA",
  Melancholic: "#6139FF",
  Serenity: "#34A853",
};

const EMPATHY_THEMES = {
  angry: { messages: ["누가 널 화나게 했어? 나한테 데리고 와."] },
  confident: { messages: ["그 누가 지금 널 말릴 수 있을까?"] },
  lonely: { messages: ["생각이 많아지는 날에는 산책이 최고야."] },
  happy: { messages: ["여기 해피 바이러스를 느껴봐"] },
  sad: { messages: ["오늘같이 숨이 찬 날이 있지."] },
  love: { messages: ["마치 누가 떠오르는 듯한 노래야."] }
};

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


// Removed old global fetchLyrics, using backend instead
function generateStructuredInsights(track, scores) {
  if (!track || !scores) return { vibe: "트랙 데이터를 분석 중입니다.", insight: "", profile: "" };

  const vibeMap = {
    sad: "아무것도 할 힘이 없어. 하루 종일 침대에 누워만 있는 중. 우울감이 심해서 누구랑도 얘기하고 싶지 않아. 그냥 무기력해.",
    confident: "난 무조건 성공해. 내 선택과 능력을 완벽하게 믿으니까. 누구도 날 막을 수 없고, 이대로 멈추지 않고 끝까지 밀고 나갈거야.",
    love: "너랑 같이 있을 때 제일 편안해. 마주 잡은 손이 따뜻하고, 함께 걷는 이 시간이 소중해. 진심으로 널 사랑하고 있어.",
    angry: "더 이상 못 참겠어. 속에서 화가 치밀어 오르고 한계에 부딪힌 기분이야. 날 그냥 내버려 둬. 짜증나고 분노가 조절이 안 돼.",
    happy: "오늘 날씨도 좋고 모든 게 다 마음에 들어. 기분 좋은 리듬에 발걸음이 가벼워져. 아무 걱정 없이 행복한 하루야.",
    lonely: "늦은 밤 텅 빈 거리를 혼자 걷고 있어. 주변에 아무도 없다는 게 실감 나서 쓸쓸하네. 갑자기 외로워져서 네 생각이 나."
  };

  const fallbackVibe = "아무것도 할 힘이 없어. 하루 종일 침대에 누워만 있는 중. 우울감이 심해서 누구랑도 얘기하고 싶지 않아. 그냥 무기력해.";

  if (scores.insufficient_data || scores.no_info) {
    return {
      vibe: fallbackVibe,
      insight: "차트에서 어떤 축도 두드러지지 않습니다. 데이터의 품질이나 가사 양이 부족하면 모든 점수가 0.5(중립)로 평탄화됩니다.",
      profile: `${track.mode === "minor" ? "Minor" : "Major"} Key · ${track.streams >= 1000000 ? (track.streams / 1000000).toFixed(1) + "M" : track.streams} Plays`
    };
  }

  // 1. 최고 감정 추출 (6대 감정 분류)
  const emotions = {
    happy: scores.happy,
    sad: scores.sad,
    angry: scores.angry,
    lonely: scores.lonely,
    confident: scores.confident,
    love: scores.love
  };

  // 값을 기준으로 내림차순 정렬
  const sortedEmotions = Object.entries(emotions).sort((a, b) => b[1] - a[1]);
  const top1 = sortedEmotions[0][0];
  const top2 = sortedEmotions[1][0];

  const primaryKey = scores.primary_emotion || top1;
  const vibe = vibeMap[primaryKey] || fallbackVibe;

  // 한글 라벨 매핑 (다시 추가 요청됨)
  const labels = {
    happy: "행복(Happy)",
    sad: "슬픔(Sad)",
    angry: "분노(Angry)",
    love: "사랑(Love)",
    lonely: "외로움(Lonely)",
    confident: "자신감(Confident)"
  };

  // 2. GRAPH INSIGHT 및 PROFILE 생성
  const insight = `차트에서 **${labels[top1]}**와(과) **${labels[top2]}** 축이 가장 두드러지게 뻗어 있습니다. 이는 곡 전반에 걸쳐 두 감정선이 얽히며 메인 테마로 작용하고 있음을 시각적으로 보여줍니다.`;
  const plays = track.streams >= 1000000 ? (track.streams / 1000000).toFixed(1) + "M" : track.streams;
  const profile = `${track.mode === "minor" ? "Minor" : "Major"} Key · Energy ${track.energy.toFixed(2)} · ${plays} Plays`;

  return { vibe, insight, profile };
}

// ── Info Buttons Data ─────────────────────────────────────────────────────────
const INFO_BUTTONS = [
  { id: "genre", label: "GENRE", icon: "🎸", content: "" },
  { id: "mode", label: "MODE", icon: "♭", content: "" },
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

// ── Get Sanitized Genre Info Helper ──────────────────────────────────────────
function getSanitizedGenreInfo(track, scores) {
  const allowedGenres = [
    "K-Pop",
    "City Pop",
    "Lo-Fi",
    "R&B / Soul",
    "Hip-Hop / Rap",
    "Pop",
    "Indie / Alternative",
    "Electronic / Dance"
  ];

  const descriptions = {
    "K-Pop": "글로벌 음악 시장을 선도하는 감각적이고 트렌디한 사운드입니다.",
    "City Pop": "레트로한 감성과 도시적인 청량함을 담은 낭만적인 장르입니다.",
    "Lo-Fi": "아날로그한 질감과 잔잔한 비트로 새벽 감성을 자극하는 칠(Chill)한 장르입니다.",
    "R&B / Soul": "감미로운 그루브와 깊고 풍부한 보컬 소울이 특징인 장르입니다.",
    "Hip-Hop / Rap": "리드미컬한 비트와 플로우 위에 강렬한 메시지를 전하는 장르입니다.",
    "Pop": "",
    "Indie / Alternative": "독창적인 감성과 자유분방하고 개성 넘치는 음악 세계가 돋보이는 장르입니다.",
    "Electronic / Dance": "에너지 넘치는 신스 비트와 그루비한 리듬으로 강렬한 흥을 돋우는 장르입니다."
  };

  const matchedGenres = [];
  const rawTags = track?.tags || [];
  const artistLower = (track?.artist || "").toLowerCase();
  const titleLower = (track?.title || "").toLowerCase();
  const lyrics = (track?.lyrics || "").toLowerCase();

  const hasKorean = (text) => /[\u3131-\u318E\uAC00-\uD7A3]/.test(text);

  for (let tag of rawTags) {
    if (!tag || typeof tag !== 'string') continue;
    const t = tag.toLowerCase().trim();

    if (t.includes("bts") || t.includes("아리랑") || t.includes("arirang")) {
      continue;
    }

    if (t.includes("city pop") || t.includes("citypop")) {
      if (!matchedGenres.includes("City Pop")) matchedGenres.push("City Pop");
    } else if (t.includes("k-pop") || t.includes("kpop") || t === "korean") {
      if (!matchedGenres.includes("K-Pop")) matchedGenres.push("K-Pop");
    } else if (t.includes("lo-fi") || t.includes("lofi") || t.includes("chillhop")) {
      if (!matchedGenres.includes("Lo-Fi")) matchedGenres.push("Lo-Fi");
    } else if (t.includes("r&b") || t.includes("rnb") || t === "soul" || t === "neo-soul") {
      if (!matchedGenres.includes("R&B / Soul")) matchedGenres.push("R&B / Soul");
    } else if (t.includes("hip-hop") || t.includes("hip hop") || t.includes("hiphop") || t.includes("rap")) {
      if (!matchedGenres.includes("Hip-Hop / Rap")) matchedGenres.push("Hip-Hop / Rap");
    } else if (t.includes("pop") || t === "dance-pop") {
      if (!matchedGenres.includes("Pop")) matchedGenres.push("Pop");
    } else if (t.includes("indie") || t.includes("alternative")) {
      if (!matchedGenres.includes("Indie / Alternative")) matchedGenres.push("Indie / Alternative");
    } else if (t.includes("electronic") || t.includes("electro") || t.includes("house") || t.includes("techno") || t.includes("edm") || t.includes("dance") || t.includes("disco") || t.includes("club")) {
      if (!matchedGenres.includes("Electronic / Dance")) matchedGenres.push("Electronic / Dance");
    }
  }

  if (matchedGenres.length === 0 || artistLower.includes("bts") || titleLower.includes("arirang") || titleLower.includes("아리랑") || artistLower.includes("아리랑")) {
    matchedGenres.length = 0;
    if (artistLower.includes("bts") || artistLower.includes("zico") || artistLower.includes("illit") || hasKorean(artistLower) || hasKorean(titleLower) || hasKorean(lyrics)) {
      matchedGenres.push("K-Pop");
    } else if (scores?.primary_emotion === "happy" || scores?.primary_emotion === "confident") {
      matchedGenres.push("Pop");
    } else if (scores?.primary_emotion === "sad" || scores?.primary_emotion === "lonely" || scores?.primary_emotion === "love") {
      matchedGenres.push("R&B / Soul");
    } else {
      matchedGenres.push("Pop");
    }
  }

  const finalGenres = matchedGenres.slice(0, 2);
  const genreText = finalGenres.join(" / ");
  const primaryGenre = finalGenres[0] || "Pop";
  const desc = descriptions[primaryGenre] !== undefined ? descriptions[primaryGenre] : descriptions["Pop"];

  return {
    genreText,
    content: desc ? `GENRE: ${genreText} — ${desc}` : `GENRE: ${genreText}`
  };
}

// ── Info Button + Popup ───────────────────────────────────────────────────────
function InfoButton({ btn, isOpen, onToggle, onClose, isMobile, track, scores }) {
  const wrapRef = useRef(null);

  // Removed click-away closer as per user request

  let content = btn.content;
  if (track) {
    if (btn.id === 'genre') {
      const genreInfo = getSanitizedGenreInfo(track, scores);
      content = genreInfo.content;
    }
    else if (btn.id === 'mode') {
      const primaryEmotion = scores?.primary_emotion;
      let derived_mode = "unknown";
      if (primaryEmotion === "happy") {
        derived_mode = "ionian";
        content = "MODE: Ionian — 밝고 긍정적인 에너지를 주며 기분 전환을 유도하는 스케일입니다.";
      } else if (primaryEmotion === "confident") {
        derived_mode = "mixolydian";
        content = "MODE: Mixolydian — 당당하고 활기찬 해방감을 선사하는 스케일입니다.";
      } else if (primaryEmotion === "love") {
        derived_mode = "lydian";
        content = "MODE: Lydian — 공중에 뜬 듯한 신비롭고 환상적인 느낌을 주는 스케일입니다.";
      } else if (primaryEmotion === "sad") {
        derived_mode = "aeolian";
        content = "MODE: Aeolian — 슬픔과 내면의 깊은 침잠을 유도하는 정통 단조 스케일입니다.";
      } else if (primaryEmotion === "lonely") {
        derived_mode = "dorian";
        content = "MODE: Dorian — 세련되고 신비로운 무드로, 절제된 슬픔과 위로를 주는 스케일입니다.";
      } else if (primaryEmotion === "angry") {
        derived_mode = "locrian";
        content = "MODE: Locrian — 극도의 불안정과 파괴적인 긴장감을 유발하여 다크한 감정을 자극하는 스케일입니다.";
      } else {
        derived_mode = "unknown";
        content = "MODE: Analyzing — 곡의 스케일 정보를 분석 중입니다.";
      }
    }
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

// ── aggregateHistoryByEmotion Helper ──────────────────────────────────────────
const aggregateHistoryByEmotion = (history) => {
  const counts = { happy: 0, confident: 0, angry: 0, sad: 0, lonely: 0, love: 0 };
  history.forEach(item => {
    if (counts[item.emotion] !== undefined) counts[item.emotion]++;
  });

  const hasHistory = history.length > 0;
  let dominant = "-";
  let maxVal = 0;
  Object.keys(counts).forEach(key => {
    if (counts[key] > maxVal) {
      maxVal = counts[key];
      dominant = key.toUpperCase();
    }
  });

  const pieData = hasHistory
    ? Object.keys(counts)
      .filter(key => counts[key] > 0)
      .map(key => ({
        name: key,
        value: counts[key],
        color: EMOTION_COLORS[key]
      }))
    : [{ name: "empty", value: 1, color: "rgba(255, 255, 255, 0.1)" }];

  return { counts, dominant, pieData, hasHistory };
};

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

  const { dominant, pieData, hasHistory } = aggregateHistoryByEmotion(history);

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
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={36}
                    outerRadius={48}
                    paddingAngle={hasHistory ? 2 : 0}
                    dataKey="value"
                    isAnimationActive={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
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
                  <span style={{
                    fontSize: dominant.length > 8 ? 8 : 10,
                    color: hasHistory ? (EMOTION_COLORS[dominant.toLowerCase()] || "#CCFF00") : "#888",
                    fontWeight: 800,
                    fontFamily: "'Space Mono', monospace",
                    letterSpacing: "0.02em",
                    marginTop: 2
                  }}>
                    {dominant}
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
  const [activeTrack, setActiveTrack] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [playing, setPlaying] = useState(false);

  const [isGraphOpen, setIsGraphOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const {
    tracks,
    loading,
    loadingStatus,
    search,
    reloadGlobalChart,
    updateTrackData
  } = useTrackCatalog(setActiveTrack);

  const handleTrackAnalyzed = useCallback((track, lyrics, aiScores) => {
    updateTrackData(track.id, {
      isAI: true,
      lyrics,
      aiScores,
      lyrics_sentiment: aiScores
    });
    setActiveTrack(prev => (prev && prev.id === track.id ? {
      ...prev,
      isAI: true,
      lyrics,
      aiScores,
      lyrics_sentiment: aiScores
    } : prev));
  }, [updateTrackData]);

  const { scores, lyrics } = useTrackAnalysis(activeTrack, handleTrackAnalyzed);
  const { history: moodHistory, addEntry: handleAddToHistory } = useMoodHistory();

  const handleSearch = useCallback((query) => {
    setIsSearchOpen(false);
    search(query);
  }, [search]);

  const patchTrackSelection = useCallback((track) => {
    setPlaying(false);
    setActiveTrack(track);
  }, []);

  // Derive dominant emotion from scores during render
  let currentEmotion = "happy";
  if (scores) {
    if (scores.insufficient_data || scores.no_info) {
      currentEmotion = "neutral";
    } else if (scores.primary_emotion) {
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

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    document.body.style.transition = "background-color 1.5s ease-in-out";
    const targetColor = playing ? (EMOTION_COLORS[currentEmotion] || "#1A0050") : "#1A0050";
    document.body.style.backgroundColor = targetColor;
  }, [playing, currentEmotion]);

  useEffect(() => {
    const timer = setTimeout(() => {
      reloadGlobalChart();
    }, 0);
    return () => clearTimeout(timer);
  }, [reloadGlobalChart]);

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
        <Header isMobile={isMobile} tracksCount={tracks.length} onLogoClick={reloadGlobalChart} />

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
