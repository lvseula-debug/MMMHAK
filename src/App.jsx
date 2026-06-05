import { useState, useEffect, useRef, useCallback } from "react";
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

// ── Info Buttons Data ─────────────────────────────────────────────────────────
const INFO_BUTTONS = [
  { id: "bpm", label: "BPM", icon: "♫", content: 'Tempo: 128 BPM — High energy dance rhythm' },
  { id: "key", label: "KEY", icon: "♪", content: 'Key: A minor — Creates tension and emotional depth' },
  { id: "energy", label: "ENERGY", icon: "♫", content: 'Energy Score: 0.88 / 1.0 — Intense, driving force' },
  { id: "plays", label: "PLAYS", icon: "◎", content: 'Total Plays: 980,000,000 — Global viral spread' },
  { id: "lyrics", label: "LYRICS", icon: "♫", content: 'Sentiment: Joy 65% · Anxiety 12% · Depression 5%' },
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
      <img
        src={imgUrl}
        alt={track.artist}
        style={{
          width: 120,
          height: 90,
          objectFit: "cover",
          borderRadius: 8,
          display: "block",
          border: isActive || hovered ? "2px solid #CCFF00" : "2px solid transparent",
          transform: isActive || hovered ? "scale(1.04)" : "scale(1)",
          transition: "border 0.2s, transform 0.2s, box-shadow 0.2s",
          boxShadow: isActive || hovered ? "0 0 16px rgba(204,255,0,0.45)" : "none",
        }}
      />
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
function InfoButton({ btn, isOpen, onToggle, onClose, isMobile, track }) {
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose]);

  let content = btn.content;
  if (track) {
    if (btn.id === 'bpm') content = `Tempo: ${track.bpm} BPM — ${track.bpm > 120 ? 'High energy' : 'Chill'} rhythm`;
    else if (btn.id === 'key') content = `Key: ${track.mode === 'minor' ? 'Minor' : 'Major'} — ${track.mode === 'minor' ? 'Emotional depth' : 'Bright feel'}`;
    else if (btn.id === 'energy') content = `Energy Score: ${track.energy.toFixed(2)} / 1.0`;
    else if (btn.id === 'plays') content = `Total Plays: ${track.streams >= 1000000 ? (track.streams / 1000000).toFixed(1) + 'M' : track.streams}`;
    else if (btn.id === 'lyrics') {
      const s = track.lyrics_sentiment;
      content = `Sentiment: Joy ${Math.round(s.joy * 100)}% · Anxiety ${Math.round(s.anxiety * 100)}% · Depression ${Math.round(s.depression * 100)}%`;
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
            left: isMobile ? 0 : 165,
            top: isMobile ? "calc(100% + 8px)" : 0,
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

  useEffect(() => {
    setPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [track?.id]);

  const togglePlay = () => {
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
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
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
          fontSize: 12,
          color: "#1A0050",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          textAlign: "center",
        }}
      >
        {track?.artist || "Artist"}
        <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.8, marginTop: 4 }}>
          {track?.title || "Unknown Title"}
        </div>
      </div>

      {/* Bottom waveform when playing */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          marginTop: 14,
          height: 36,
          opacity: playing ? 1 : 0,
          transition: "opacity 0.3s",
        }}
      >
        <Waveform playing={playing} />
      </div>
    </div>
  );
}

// ── Center Panel ──────────────────────────────────────────────────────────────
function CenterPanel({ activeTrack, isMobile, scores }) {
  const [openPopup, setOpenPopup] = useState(null);

  const toggle = (id) => setOpenPopup((prev) => (prev === id ? null : id));
  const close = () => setOpenPopup(null);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5C8C8",
        clipPath: "polygon(0 40px, 40px 0, 100% 0, 100% calc(100% - 40px), calc(100% - 40px) 100%, 0 100%)",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        animation: "fadeSlideIn 0.5s ease",
      }}
    >
      {/* Navigation pill */}
      <div
        style={{
          alignSelf: "flex-start",
          margin: "28px 0 0 28px",
          padding: "6px 16px",
          borderRadius: 20,
          background: "#1A0050",
          fontFamily: "'Space Mono', monospace",
          fontSize: 10,
          fontWeight: 700,
          color: "#CCFF00",
          letterSpacing: "0.15em",
          textTransform: "uppercase",
        }}
      >
        Navigation
      </div>

      {/* Content row */}
      <div
        style={{
          display: "flex",
          flex: 1,
          padding: isMobile ? "20px 16px 40px" : "24px 24px 48px",
          gap: 16,
          alignItems: "stretch",
        }}
      >
        {/* Info buttons column */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 4,
            flexShrink: 0,
            position: "relative",
            zIndex: 50,
          }}
        >
          {INFO_BUTTONS.map((btn) => (
            <InfoButton
              key={btn.id}
              btn={btn}
              isOpen={openPopup === btn.id}
              onToggle={() => toggle(btn.id)}
              onClose={close}
              isMobile={isMobile}
              track={activeTrack}
            />
          ))}
        </div>

        {/* Preview center */}
        <PreviewSection track={activeTrack} />

        {/* Radar chart — desktop only */}
        {!isMobile && scores && (
          <EmotionRadarChart scores={scores} />
        )}
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
            <span
              style={{
                fontSize: 8,
                color: activeTrack?.id === track.id ? "#CCFF00" : "rgba(255,255,255,0.5)",
                fontFamily: "'Space Mono', monospace",
                maxWidth: 72,
                textAlign: "center",
                lineHeight: 1.2,
                transition: "color 0.2s",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "inline-block",
                width: "100%",
              }}
            >
              {track.artist}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────
function Header({ isMobile, tracksCount }) {
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
          style={{
            fontFamily: "'Playfair Display', serif",
            fontStyle: "italic",
            fontWeight: 900,
            fontSize: isMobile ? 34 : 48,
            color: "#fff",
            letterSpacing: "-0.02em",
            lineHeight: 1,
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

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    async function fetchData() {
      const LASTFM_API_KEY = "8031c3fd85fae84e3a1970b02e22a231";
      const LASTFM_BASE = "https://ws.audioscrobbler.com/2.0";

      try {
        setLoading(true);
        setLoadingStatus("📡 FETCHING LAST.FM GLOBAL CHART...");

        const chartRes = await fetch(`${LASTFM_BASE}/?method=chart.getTopTracks&api_key=${LASTFM_API_KEY}&format=json&limit=50`);
        if (!chartRes.ok) throw new Error("Last.fm request failed");

        const chartData = await chartRes.json();
        const rawTracks = chartData?.tracks?.track || [];
        if (rawTracks.length === 0) throw new Error("No tracks found");

        setLoadingStatus(`🎵 ANALYZING ${rawTracks.length} TRACKS...`);

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

              let tags = [];
              try {
                const infoRes = await fetch(`${LASTFM_BASE}/?method=track.getInfo&api_key=${LASTFM_API_KEY}&artist=${encodeURIComponent(raw.artist.name)}&track=${encodeURIComponent(raw.name)}&format=json`);
                if (infoRes.ok) {
                  const infoData = await infoRes.json();
                  tags = (infoData?.track?.toptags?.tag || []).map(t => t.name.toLowerCase());
                }
              } catch (_) { }

              const itunes = await fetchItunesData(raw.name, raw.artist.name);

              const hasSad = tags.some(t => ["sad", "melancholy", "heartbreak", "depression", "dark", "emo", "blues"].some(k => t.includes(k)));
              const hasAngry = tags.some(t => ["angry", "aggressive", "metal", "hardcore", "rage", "punk"].some(k => t.includes(k)));
              const hasAnxious = tags.some(t => ["anxious", "nervous", "tense", "suspense", "dramatic"].some(k => t.includes(k)));
              const hasHappy = tags.some(t => ["happy", "upbeat", "dance", "party", "summer", "pop", "fun", "joy"].some(k => t.includes(k)));
              const hasCalm = tags.some(t => ["calm", "chill", "relax", "ambient", "peaceful", "acoustic"].some(k => t.includes(k)));

              const valence = hasHappy ? 0.75 + Math.random() * 0.2
                : hasSad ? 0.15 + Math.random() * 0.25
                  : hasAngry ? 0.30 + Math.random() * 0.2
                    : 0.45 + Math.random() * 0.3;

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

              const lyrics_sentiment = {
                anger: Math.max(0.01, parseFloat(((hasAngry ? 0.5 : 0.05) + (1 - valence) * 0.3 + energy * 0.15).toFixed(2))),
                anxiety: Math.max(0.01, parseFloat(((hasAnxious ? 0.4 : 0.08) + (1 - valence) * 0.25 + (bpm > 130 ? 0.2 : 0)).toFixed(2))),
                depression: Math.max(0.01, parseFloat(((hasSad ? 0.45 : 0.05) + (1 - valence) * 0.4 + (1 - energy) * 0.2).toFixed(2))),
                joy: Math.max(0.01, parseFloat(((hasHappy ? 0.55 : 0.1) + valence * 0.35 + energy * 0.15).toFixed(2))),
                stability: Math.max(0.01, parseFloat(((hasCalm ? 0.5 : 0.1) + (1 - energy) * 0.3 + valence * 0.25).toFixed(2))),
              };

              return {
                id: `${raw.artist.name}_${raw.name}_${idx}`,
                title: raw.name,
                artist: raw.artist.name,
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

        setTracks(allItems);
        setActiveTrack(allItems[0]);
        setScores(computeVirusScores(allItems[0]));
        setLoading(false);
      } catch (err) {
        console.error("API error, using mock data:", err);
        const mock = MOCK_TRACKS.map((t, idx) => ({ ...t, id: t.id + idx, streams: t.streams || 500000000, artworkUrl: null, previewUrl: null }));
        setTracks(mock);
        setActiveTrack(mock[0]);
        setScores(computeVirusScores(mock[0]));
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleSelect = useCallback((track) => {
    setActiveTrack(track);
    setScores(computeVirusScores(track));
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

      <Header isMobile={isMobile} tracksCount={tracks.length} />

      {/* ── DESKTOP layout ── */}
      {!isMobile && (
        <>
          <Sidebar tracks={leftTracks} side="left" activeTrack={activeTrack} onSelect={handleSelect} isMobile={false} />
          <Sidebar tracks={rightTracks} side="right" activeTrack={activeTrack} onSelect={handleSelect} isMobile={false} />
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
            <CenterPanel activeTrack={activeTrack} isMobile={false} scores={scores} />
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
          <MobileSidebarStrip tracks={leftTracks} activeTrack={activeTrack} onSelect={handleSelect} label="Top Tracks (1-25)" />
          <CenterPanel activeTrack={activeTrack} isMobile={true} scores={scores} />
          <MobileSidebarStrip tracks={rightTracks} activeTrack={activeTrack} onSelect={handleSelect} label="Top Tracks (26-50)" />
        </div>
      )}
    </>
  );
}
