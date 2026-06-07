import React, { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";
import EmotionRadarChart from "./EmotionRadarChart";

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
  { id: "1", title: "Espresso", artist: "Sabrina Carpenter", bpm: 120, mode: "major", valence: 0.69, energy: 0.76, loudness: -3.5, streams: 1420000000, lyrics_sentiment: { anger: 0.05, anxiety: 0.10, depression: 0.08, joy: 0.72, stability: 0.65 } },
  { id: "2", title: "BIRDS OF A FEATHER", artist: "Billie Eilish", bpm: 105, mode: "major", valence: 0.43, energy: 0.51, loudness: -7.8, streams: 1280000000, lyrics_sentiment: { anger: 0.12, anxiety: 0.35, depression: 0.28, joy: 0.45, stability: 0.55 } },
  { id: "3", title: "Beautiful Things", artist: "Benson Boone", bpm: 105, mode: "major", valence: 0.31, energy: 0.47, loudness: -5.6, streams: 1610000000, lyrics_sentiment: { anger: 0.35, anxiety: 0.42, depression: 0.38, joy: 0.32, stability: 0.45 } },
  { id: "4", title: "Too Sweet", artist: "Hozier", bpm: 117, mode: "minor", valence: 0.65, energy: 0.62, loudness: -4.9, streams: 980000000, lyrics_sentiment: { anger: 0.15, anxiety: 0.22, depression: 0.18, joy: 0.58, stability: 0.50 } },
  { id: "5", title: "Gata Only", artist: "FloyyMenor", bpm: 100, mode: "minor", valence: 0.81, energy: 0.72, loudness: -5.4, streams: 1140000000, lyrics_sentiment: { anger: 0.08, anxiety: 0.12, depression: 0.05, joy: 0.78, stability: 0.52 } },
  { id: "6", title: "Cruel Summer", artist: "Taylor Swift", bpm: 170, mode: "major", valence: 0.53, energy: 0.70, loudness: -5.7, streams: 2450000000, lyrics_sentiment: { anger: 0.10, anxiety: 0.28, depression: 0.15, joy: 0.62, stability: 0.58 } },
  { id: "7", title: "Magnetic", artist: "ILLIT", bpm: 132, mode: "major", valence: 0.69, energy: 0.78, loudness: -4.8, streams: 580000000, lyrics_sentiment: { anger: 0.05, anxiety: 0.15, depression: 0.06, joy: 0.82, stability: 0.68 } },
  { id: "8", title: "Spot!", artist: "ZICO", bpm: 110, mode: "minor", valence: 0.78, energy: 0.83, loudness: -4.2, streams: 320000000, lyrics_sentiment: { anger: 0.12, anxiety: 0.18, depression: 0.08, joy: 0.76, stability: 0.60 } },
];

function computeVirusScores(track) {
  const { bpm, mode, valence, energy, loudness, lyrics_sentiment, streams } = track;
  const bpmNorm = Math.min(bpm, 200) / 200;
  const tempoStress = bpmNorm > 0.75 ? (bpmNorm - 0.75) * 4 : bpmNorm < 0.4 ? (0.4 - bpmNorm) * 2 : 0;
  const modeFactor = mode === "minor" ? 0.3 : -0.1;
  const loudNorm = Math.min(Math.max((loudness + 20) / 20, 0), 1);
  const contagion = Math.log10(Math.max(streams, 10)) / Math.log10(3000000000);

  const raw = {
    depression: lyrics_sentiment.depression * 0.5 + (1 - valence) * 0.3 + modeFactor * 0.2,
    anxiety: lyrics_sentiment.anxiety * 0.4 + tempoStress * 0.3 + (1 - valence) * 0.2 + modeFactor * 0.1,
    anger: lyrics_sentiment.anger * 0.5 + loudNorm * 0.2 + energy * 0.1 + modeFactor * 0.2,
    joy: lyrics_sentiment.joy * 0.5 + valence * 0.35 + (1 - modeFactor * 0.5) * 0.15,
    stability: lyrics_sentiment.stability * 0.4 + (1 - tempoStress) * 0.3 + (1 - loudNorm) * 0.3,
  };

  const spread = {};
  Object.keys(raw).forEach(k => { spread[k] = Math.min(raw[k] * (0.6 + contagion * 0.7), 1); });

  const positive_score = Math.min(spread.joy * 0.45 + spread.stability * 0.25 + valence * 0.30, 1);
  const negative_score = Math.min(spread.depression * 0.40 + spread.anxiety * 0.35 + spread.anger * 0.25, 1);
  const polarity = positive_score - negative_score;
  const confidence = Math.abs(polarity);
  const classification = polarity > 0.25 ? "POSITIVE" : polarity < -0.25 ? "NEGATIVE" : "MIXED";

  return {
    ...spread,
    positive_score,
    negative_score,
    polarity,
    confidence,
    classification,
    discomfort: (spread.anger * 0.4 + spread.anxiety * 0.35 + spread.depression * 0.25),
    contagion,
    streams,
  };
}

async function fetchItunesData(title, artist) {
  try {
    const q = encodeURIComponent(`${title} ${artist}`);
    const res = await fetch(`/itunes-api/search?term=${q}&entity=song&limit=5&media=music`);
    if (!res.ok) return { artworkUrl: null, previewUrl: null };
    const data = await res.json();
    const results = data.results || [];
    const match = results.find(r =>
      r.artistName?.toLowerCase().includes(artist.toLowerCase().split(" ")[0]) ||
      r.trackName?.toLowerCase().includes(title.toLowerCase().split(" ")[0])
    ) || results[0];
    if (!match) return { artworkUrl: null, previewUrl: null };
    return {
      artworkUrl: match.artworkUrl100?.replace("100x100", "400x400") || null,
      previewUrl: match.previewUrl || null,
    };
  } catch (_) {
    return { artworkUrl: null, previewUrl: null };
  }
}

// ── 외부 API에서 가사 가져오기 (Timeout & 최적화 적용) ──
async function fetchWithTimeout(url, options = {}, timeoutMs = 4000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

async function fetchLyrics(title, artist) {
  try {
    // get API는 정확한 매칭(duration 등)이 없으면 백엔드에서 오래 걸릴 수 있으므로,
    // 바로 search API를 호출하여 가장 정확도가 높은 첫 번째 결과를 가져옵니다.
    const searchUrl = "https://lrclib.net/api/search?track_name=" 
      + encodeURIComponent(title) 
      + "&artist_name=" 
      + encodeURIComponent(artist);

    const searchRes = await fetchWithTimeout(searchUrl, {}, 4000);
    if (!searchRes.ok) return "No lyrics found for this track.";

    const searchData = await searchRes.json();
    if (!searchData || searchData.length === 0) return "No lyrics found for this track.";

    const lyrics = searchData[0].plainLyrics || searchData[0].syncedLyrics;
    return lyrics ? lyrics : "No lyrics found for this track.";

  } catch (error) {
    console.error("Lyrics fetch error:", error);
    return "No lyrics found for this track (Timeout or Network Error).";
  }
}

function generateImpactText(track, scores) {
  if (!track || !scores) return "트랙 데이터를 분석 중입니다.";
  const { bpm, mode } = track;
  const { joy, depression, stability, anger } = scores;
  if (joy > 0.6 && bpm > 110) return "높은 템포와 Joy 수치가 도파민을 분비시킵니다. 우울감을 떨치고 에너지를 끌어올리기 완벽한 트랙입니다.";
  else if (mode === "minor" && stability > 0.5) return "Minor 키와 깊은 안정감이 혼자만의 사색에 잠기기 좋은 새벽의 무드를 조성합니다.";
  else if (anger > 0.5 || track.energy > 0.7) return "강렬한 에너지가 억눌린 스트레스를 해소하고 강한 몰입감을 선사합니다.";
  else if (depression > 0.5) return "차분하고 멜랑콜리한 선율이 복잡한 마음을 위로하고 깊은 공감을 이끌어냅니다.";
  else if (stability > 0.6) return "부드러운 흐름이 긴장된 신경을 이완시키며, 편안한 휴식을 취하기 좋은 트랙입니다.";
  else return "다양한 감정이 교차하는 트랙으로, 현재의 기분에 따라 새로운 매력을 발견할 수 있습니다.";
}

// ── Info Buttons Data ─────────────────────────────────────────────────────────
const INFO_BUTTONS = [
  { id: "bpm", label: "BPM", icon: "♫", content: 'Tempo: 128 BPM — High energy dance rhythm' },
  { id: "key", label: "KEY", icon: "♪", content: 'Key: A minor — Creates tension and emotional depth' },
  { id: "energy", label: "ENERGY", icon: "♫", content: 'Energy Score: 0.88 / 1.0 — Intense, driving force' },
  { id: "plays", label: "PLAYS", icon: "◎", content: 'Total Plays: 980,000,000 — Global viral spread' },
  { id: "graph", label: "GRAPH", icon: "📈", content: 'Toggle radar charts showing track emotions and balance' },
  { id: "mood", label: "MOOD", icon: "✨", content: "" },
];

// ── Artist Card ───────────────────────────────────────────────────────────────
function ArtistCard({ track, onSelect, isActive }) {
  const [hovered, setHovered] = useState(false);
  const imgUrl = track.artworkUrl || `https://picsum.photos/120/90?random=${track.id}`;

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
      content = 'Toggle radar charts showing track emotions and balance';
    }
    else if (btn.id === 'mood') content = generateImpactText(track, scores);
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
function PreviewSection({ track }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  // Draggable state removed

  useEffect(() => {
    setPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [track?.id]);

  const togglePlay = (e) => {
    e.stopPropagation();
    if (!audioRef.current) {
      if (!track?.previewUrl) alert("No audio preview available for this track.");
      return;
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };

  const imgUrl = track?.artworkUrl?.replace("100x100", "400x400") || `https://picsum.photos/160/160?random=${track?.id || 1}`;

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
      <audio ref={audioRef} src={track?.previewUrl} onEnded={() => setPlaying(false)} />

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

      {/* Square artist photo */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          width: 160,
          height: 160,
          borderRadius: 10,
          overflow: "hidden",
          boxShadow: playing
            ? "0 8px 40px rgba(26,0,80,0.6), 0 0 0 3px #CCFF00"
            : "0 8px 32px rgba(26,0,80,0.5)",
          border: "2px solid rgba(26,0,80,0.25)",
          transition: "box-shadow 0.3s",
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

    </div>
  );
}

// ── Error Boundary ────────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error) {
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
function CenterPanel({ activeTrack, isMobile, scores, lyrics, isGraphOpen, onToggleGraph, onToggleSearch, isSearchOpen, searchQuery, setSearchQuery, onSearch }) {
  const [openPopup, setOpenPopup] = useState(null);

  const toggle = (id) => setOpenPopup((prev) => (prev === id ? null : id));
  const close = () => setOpenPopup(null);

  return (
    <div
      className="flex flex-col relative w-full"
      style={{
        height: "100%",
        minHeight: "100vh",
        background: "#F5C8C8",
        animation: "fadeSlideIn 0.5s ease",
        overflowY: "auto", // 💖 핑크색 섹션 자체 스크롤 가능하도록 수정
      }}
    >
      {/* Navigation pill & Search Bar */}
      <div style={{ position: "relative", alignSelf: "flex-start", marginLeft: isMobile ? "16px" : "32px", marginTop: isMobile ? "16px" : "32px", zIndex: 100 }}>
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

      {/* Top Center: Preview Section */}
      <div className="flex justify-center w-full mt-2">
        <PreviewSection track={activeTrack} />
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
        <>
          <div
            className={`flex flex-1 items-center justify-center gap-4 ${isMobile ? "p-5 pb-10" : "p-6 pb-12"}`}
            style={{ position: "relative", zIndex: 10, pointerEvents: "none" }}
          >
            {scores && (
              <ErrorBoundary>
                <EmotionRadarChart scores={scores} />
              </ErrorBoundary>
            )}
          </div>
          {scores && (
            <div style={{
              position: "absolute",
              top: isMobile ? "600px" : "520px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 20,
              fontSize: "12px",
              fontWeight: "800",
              color: "#CCFF00",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              background: "#1A0050",
              padding: "6px 16px",
              borderRadius: "20px",
              border: "1px solid #CCFF00",
              boxShadow: "0 4px 15px rgba(0,0,0,0.5)"
            }}>
              Emotion Confidence {Math.round(scores.confidence * 100)}%
            </div>
          )}
        </>
      )}

      {/* ── [신규 추가] 핑크 섹션 배경에 흘러나오는 힙한 가사 보드 (하단 배치) ── */}
      <div
        style={{
          position: "absolute",
          top: isMobile ? "680px" : "600px",
          height: isMobile ? "800px" : "600px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "90%",
          maxWidth: "800px",
          background: "#F5C8C8",
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
            Sentiment: Joy {Math.round(activeTrack.lyrics_sentiment.joy * 100)}% · Anxiety {Math.round(activeTrack.lyrics_sentiment.anxiety * 100)}% · Depression {Math.round(activeTrack.lyrics_sentiment.depression * 100)}%
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
              src={track.artworkUrl || `https://picsum.photos/72/54?random=${track.id}`}
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

  // 💖 가사 상태 관리를 위한 신규 State 추가
  const [lyrics, setLyrics] = useState("LOADING LYRICS...");
  const [isGraphOpen, setIsGraphOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const LASTFM_API_KEY = "8031c3fd85fae84e3a1970b02e22a231";
  const LASTFM_BASE = "https://ws.audioscrobbler.com/2.0";

  const processTracks = async (rawTracks) => {
    const BATCH = 10;
    let allItems = [];

    for (let b = 0; b < rawTracks.length; b += BATCH) {
      const batch = rawTracks.slice(b, b + BATCH);
      setLoadingStatus(`🔍 LOADING ${b + 1}–${Math.min(b + BATCH, rawTracks.length)} / ${rawTracks.length}...`);

      const batchItems = await Promise.all(
        batch.map(async (raw, batchIdx) => {
          const idx = b + batchIdx;
          const playcount = parseInt(raw.playcount || "0", 10);
          const listeners = parseInt(raw.listeners || "0", 10);

          const artistName = typeof raw.artist === "string" ? raw.artist : raw.artist?.name || "Unknown Artist";

          let tags = [];
          try {
            const infoRes = await fetch(`${LASTFM_BASE}/?method=track.getInfo&api_key=${LASTFM_API_KEY}&artist=${encodeURIComponent(artistName)}&track=${encodeURIComponent(raw.name)}&format=json`);
            if (infoRes.ok) {
              const infoData = await infoRes.json();
              tags = (infoData?.track?.toptags?.tag || []).map(t => t.name.toLowerCase());
            }
          } catch (_) { }

          const itunes = await fetchItunesData(raw.name, artistName);

          const hasSad = tags.some(t => ["sad", "melancholy", "heartbreak", "depression", "dark", "emo", "blues"].some(k => t.includes(k)));
          const hasAngry = tags.some(t => ["angry", "aggressive", "metal", "hardcore", "rage", "punk"].some(k => t.includes(k)));
          const hasAnxious = tags.some(t => ["anxious", "nervous", "tense", "suspense", "dramatic"].some(k => t.includes(k)));
          const hasHappy = tags.some(t => ["happy", "upbeat", "dance", "party", "summer", "pop", "fun", "joy"].some(k => t.includes(k)));
          const hasCalm = tags.some(t => ["calm", "chill", "relax", "ambient", "peaceful", "acoustic"].some(k => t.includes(k)));

          const valence = hasHappy ? 0.65 + Math.random() * 0.25
            : hasSad ? 0.10 + Math.random() * 0.20
              : hasAngry ? 0.20 + Math.random() * 0.20
                : 0.35 + Math.random() * 0.20;

          const energy = hasAngry ? 0.75 + Math.random() * 0.2
            : hasCalm ? 0.15 + Math.random() * 0.25
              : hasHappy ? 0.65 + Math.random() * 0.2
                : 0.45 + Math.random() * 0.3;

          const bpm = hasAngry ? 140 + Math.floor(Math.random() * 40)
            : hasCalm ? 70 + Math.floor(Math.random() * 30)
              : hasHappy ? 110 + Math.floor(Math.random() * 40)
                : 95 + Math.floor(Math.random() * 60);

          const mode = hasSad || hasAngry ? "minor" : "major";
          const loudness = hasAngry ? -3 - Math.random() * 3
            : hasCalm ? -10 - Math.random() * 5
              : -5 - Math.random() * 4;

          const modeModifier = mode === "minor" ? 0.6 : 1.0;

          const lyrics_sentiment = {
            anger: Math.max(0.01, parseFloat(((hasAngry ? 0.5 : 0.05) + (1 - valence) * 0.3).toFixed(2))),
            anxiety: Math.max(0.01, parseFloat(((hasAnxious ? 0.4 : 0.08) + (1 - valence) * 0.25).toFixed(2))),
            depression: Math.max(0.01, parseFloat(((hasSad ? 0.5 : 0.05) + (1 - valence) * 0.4).toFixed(2))),
            joy: Math.max(0.01, parseFloat((((hasHappy ? 0.6 : 0.1) + valence * 0.3) * modeModifier).toFixed(2))),
            stability: Math.max(0.01, parseFloat(((hasCalm ? 0.5 : 0.15) + valence * 0.2).toFixed(2))),
          };

          return {
            id: `${artistName}_${raw.name}_${idx}`,
            title: raw.name,
            artist: artistName,
            bpm,
            mode,
            valence: parseFloat(valence.toFixed(3)),
            energy: parseFloat(energy.toFixed(3)),
            loudness: parseFloat(loudness.toFixed(1)),
            streams: playcount || (listeners * 3) || ((50 - idx) * 20000000 + 50000000),
            listeners,
            tags,
            artworkUrl: itunes.artworkUrl,
            previewUrl: itunes.previewUrl,
            lyrics_sentiment,
          };
        })
      );
      allItems = [...allItems, ...batchItems];
    }
    return allItems;
  };

  const handleSearch = async (query) => {
    if (!query.trim()) return;
    setIsSearchOpen(false);
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

      const firstItem = await processTracks([rawTracks[0]]);
      setTracks(firstItem);
      setActiveTrack(firstItem[0]);
      setScores(computeVirusScores(firstItem[0]));
      setLyrics("LOADING LYRICS...");
      fetchLyrics(firstItem[0].title, firstItem[0].artist).then(setLyrics);
      setLoading(false);

      if (rawTracks.length > 1) {
        processTracks(rawTracks.slice(1)).then(rest => {
          setTracks(prev => {
            const combined = [...prev, ...rest];
            return combined.sort((a, b) => b.streams - a.streams);
          });
        });
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

  // 가사 실시간 로드 처리를 포함한 트랙 선택 핸들러 함수
  const handleSelect = useCallback((track) => {
    setActiveTrack(track);
    setScores(computeVirusScores(track));

    // 새 곡을 선택하면 가사 상태 초기화 후 비동기 패치
    setLyrics("LOADING LYRICS...");
    fetchLyrics(track.title, track.artist).then(setLyrics);
  }, []);

  const fetchGlobalChart = async () => {

    try {
      setLoading(true);
      setLoadingStatus("📡 FETCHING LAST.FM GLOBAL CHART...");

      const chartRes = await fetch(`${LASTFM_BASE}/?method=chart.getTopTracks&api_key=${LASTFM_API_KEY}&format=json&limit=50`);
      if (!chartRes.ok) throw new Error("Last.fm request failed");

      const chartData = await chartRes.json();
      const rawTracks = chartData?.tracks?.track || [];
      if (rawTracks.length === 0) throw new Error("No tracks found");

      setLoadingStatus(`🎵 ANALYZING ${rawTracks.length} TRACKS...`);

      const firstItem = await processTracks([rawTracks[0]]);
      setTracks(firstItem);
      setActiveTrack(firstItem[0]);
      setScores(computeVirusScores(firstItem[0]));
      setLyrics("LOADING LYRICS...");
      fetchLyrics(firstItem[0].title, firstItem[0].artist).then(setLyrics);
      setLoading(false);

      if (rawTracks.length > 1) {
        processTracks(rawTracks.slice(1)).then(rest => {
          setTracks(prev => [...prev, ...rest]);
        });
      }
    } catch (err) {
      console.error("API error, using mock data:", err);
      const mock = MOCK_TRACKS.map((t, idx) => ({ ...t, id: t.id + idx, streams: t.streams || 500000000, artworkUrl: null, previewUrl: null }));
      setTracks(mock);
      setActiveTrack(mock[0]);
      setScores(computeVirusScores(mock[0]));

      fetchLyrics(mock[0].title, mock[0].artist).then(setLyrics);

      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGlobalChart();
  }, []);

  // 글로벌 이벤트 캡처를 활용해 어떤 InfoButton이 토글되었는지 확인하여 Graph 트리거
  const handleToggleGraphVisibility = useCallback(() => {
    setIsGraphOpen(prev => !prev);
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

      <div style={{ position: "fixed", inset: 0, background: "#1A0050", zIndex: -1 }} />

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
              />
            </div>
          </>
        )}

        {/* ── MOBILE layout ── */}
        {isMobile && (
          <div
            style={{
              position: "fixed",
              top: 80,
              left: 0,
              right: 0,
              bottom: 0,
              overflowY: "auto",
              scrollbarWidth: "none",
              zIndex: 10,
            }}
          >
            <MobileSidebarStrip tracks={leftTracks} activeTrack={activeTrack} onSelect={patchTrackSelection} label="Top Tracks (1-25)" />
            <CenterPanel
              activeTrack={activeTrack}
              isMobile={true}
              scores={scores}
              lyrics={lyrics}
              isGraphOpen={isGraphOpen}
              onToggleGraph={setIsGraphOpen}
            />
            <MobileSidebarStrip tracks={rightTracks} activeTrack={activeTrack} onSelect={patchTrackSelection} label="Top Tracks (26-50)" />
          </div>
        )}
      </div>
    </>
  );
}
