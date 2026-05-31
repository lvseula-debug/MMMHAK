import { useState, useEffect, useRef, useCallback } from "react";

// ── Mock Data Engine ─────────────────────────────────────────────────────────
const MOCK_TRACKS = [
  { id: "1", title: "Espresso", artist: "Sabrina Carpenter", bpm: 120, mode: "major", valence: 0.69, energy: 0.76, loudness: -3.5, streams: 1420000000, lyrics_sentiment: { anger: 0.05, anxiety: 0.10, depression: 0.08, joy: 0.72, stability: 0.65 } },
  { id: "2", title: "BIRDS OF A FEATHER", artist: "Billie Eilish", bpm: 105, mode: "major", valence: 0.43, energy: 0.51, loudness: -7.8, streams: 1280000000, lyrics_sentiment: { anger: 0.12, anxiety: 0.35, depression: 0.28, joy: 0.45, stability: 0.55 } },
  { id: "3", title: "Beautiful Things", artist: "Benson Boone", bpm: 105, mode: "major", valence: 0.31, energy: 0.47, loudness: -5.6, streams: 1610000000, lyrics_sentiment: { anger: 0.35, anxiety: 0.42, depression: 0.38, joy: 0.32, stability: 0.45 } },
  { id: "4", title: "Too Sweet", artist: "Hozier", bpm: 117, mode: "minor", valence: 0.65, energy: 0.62, loudness: -4.9, streams: 980000000, lyrics_sentiment: { anger: 0.15, anxiety: 0.22, depression: 0.18, joy: 0.58, stability: 0.50 } },
  { id: "5", title: "Gata Only", artist: "FloyyMenor", bpm: 100, mode: "minor", valence: 0.81, energy: 0.72, loudness: -5.4, streams: 1140000000, lyrics_sentiment: { anger: 0.08, anxiety: 0.12, depression: 0.05, joy: 0.78, stability: 0.52 } },
  { id: "6", title: "Cruel Summer", artist: "Taylor Swift", bpm: 170, mode: "major", valence: 0.53, energy: 0.70, loudness: -5.7, streams: 2450000000, lyrics_sentiment: { anger: 0.10, anxiety: 0.28, depression: 0.15, joy: 0.62, stability: 0.58 } },
  { id: "7", title: "Magnetic", artist: "ILLIT", bpm: 132, mode: "major", valence: 0.69, energy: 0.78, loudness: -4.8, streams: 580000000, lyrics_sentiment: { anger: 0.05, anxiety: 0.15, depression: 0.06, joy: 0.82, stability: 0.68 } },
  { id: "8", title: "Spot!", artist: "ZICO", bpm: 110, mode: "minor", valence: 0.78, energy: 0.83, loudness: -4.2, streams: 320000000, lyrics_sentiment: { anger: 0.12, anxiety: 0.18, depression: 0.08, joy: 0.76, stability: 0.60 } },
  { id: "9", title: "Super Shy", artist: "NewJeans", bpm: 150, mode: "major", valence: 0.85, energy: 0.82, loudness: -4.5, streams: 680000000, lyrics_sentiment: { anger: 0.02, anxiety: 0.10, depression: 0.04, joy: 0.88, stability: 0.72 } },
  { id: "10", title: "Seven", artist: "Jung Kook", bpm: 125, mode: "major", valence: 0.89, energy: 0.83, loudness: -4.1, streams: 1850000000, lyrics_sentiment: { anger: 0.04, anxiety: 0.08, depression: 0.05, joy: 0.90, stability: 0.75 } },
  { id: "11", title: "Blinding Lights", artist: "The Weeknd", bpm: 171, mode: "major", valence: 0.85, energy: 0.73, loudness: -5.9, streams: 4120000000, lyrics_sentiment: { anger: 0.15, anxiety: 0.25, depression: 0.20, joy: 0.80, stability: 0.60 } },
  { id: "12", title: "As It Was", artist: "Harry Styles", bpm: 174, mode: "minor", valence: 0.66, energy: 0.73, loudness: -5.3, streams: 3340000000, lyrics_sentiment: { anger: 0.08, anxiety: 0.20, depression: 0.15, joy: 0.72, stability: 0.68 } },
  { id: "13", title: "Greedy", artist: "Tate McRae", bpm: 111, mode: "minor", valence: 0.84, energy: 0.75, loudness: -3.2, streams: 1240000000, lyrics_sentiment: { anger: 0.18, anxiety: 0.15, depression: 0.10, joy: 0.82, stability: 0.58 } },
  { id: "14", title: "Lose Control", artist: "Teddy Swims", bpm: 159, mode: "minor", valence: 0.58, energy: 0.66, loudness: -4.8, streams: 1120000000, lyrics_sentiment: { anger: 0.22, anxiety: 0.32, depression: 0.35, joy: 0.48, stability: 0.48 } },
  { id: "15", title: "Fortnight", artist: "Taylor Swift", bpm: 192, mode: "major", valence: 0.28, energy: 0.39, loudness: -9.5, streams: 620000000, lyrics_sentiment: { anger: 0.25, anxiety: 0.48, depression: 0.45, joy: 0.22, stability: 0.40 } }
];

// ── Scoring Engine ────────────────────────────────────────────────────────────
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

  return {
    ...spread,
    discomfort: (spread.anger * 0.4 + spread.anxiety * 0.35 + spread.depression * 0.25),
    contagion,
    streams,
  };
}

// ── iTunes Search ─────────────────────────────────────────────────────────────
async function fetchItunesData(title, artist) {
  try {
    const q = encodeURIComponent(`${title} ${artist}`);
    const res = await fetch(`https://itunes.apple.com/search?term=${q}&entity=song&limit=5&media=music`);
    if (!res.ok) return { artworkUrl: null, previewUrl: null };
    const data = await res.json();
    const results = data.results || [];
    // 아티스트명이 가장 가까운 결과 우선
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

// ── Palette ───────────────────────────────────────────────────────────────────
const EMOTION_META = {
  depression: { label: "우울 지수", color: "#00F5FF", glow: "#00F5FFCC", icon: "◉" },
  anxiety: { label: "불안 지수", color: "#FF6B00", glow: "#FF6B00CC", icon: "⬡" },
  anger: { label: "분노 지수", color: "#FF0055", glow: "#FF0055CC", icon: "△" },
  joy: { label: "기쁨 지수", color: "#39FF14", glow: "#39FF14CC", icon: "○" },
  stability: { label: "안정 지수", color: "#FFE600", glow: "#FFE600CC", icon: "□" },
  discomfort: { label: "불쾌 지수", color: "#FF3DFF", glow: "#FF3DFFCC", icon: "✕" },
};

// ── Particles ─────────────────────────────────────────────────────────────────
function LanternParticles({ scores, active }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const particlesRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    const W = () => canvas.width;
    const H = () => canvas.height;

    const emotions = ["depression", "anxiety", "anger", "joy", "stability"];
    particlesRef.current = [];
    emotions.forEach(emo => {
      const score = scores[emo] || 0;
      const count = Math.floor(score * 20) + 4;
      const { color, glow } = EMOTION_META[emo];
      for (let i = 0; i < count; i++) {
        const big = Math.random() < 0.2;
        particlesRef.current.push({
          x: Math.random() * W(), y: Math.random() * H(),
          vx: (Math.random() - 0.5) * (big ? 0.4 : 0.9),
          vy: -(0.3 + Math.random() * 0.7),
          r: big ? 3 + Math.random() * 4 : 1 + Math.random() * 1.5,
          color, glow, alpha: big ? 0.9 : 0.7 + Math.random() * 0.3,
          pulse: Math.random() * Math.PI * 2, pulseSpeed: 0.02 + Math.random() * 0.04, big,
        });
      }
    });

    function draw() {
      ctx.clearRect(0, 0, W(), H());
      particlesRef.current.forEach(p => {
        p.pulse += p.pulseSpeed; p.x += p.vx; p.y += p.vy;
        if (p.y < -30) { p.y = H() + 10; p.x = Math.random() * W(); }
        if (p.x < -10) p.x = W() + 10;
        if (p.x > W() + 10) p.x = -10;
        const breathe = (Math.sin(p.pulse) + 1) / 2;
        const r = p.r * (0.85 + breathe * 0.3);
        const a = p.alpha * (0.6 + breathe * 0.4);
        const glowR = r * (p.big ? 5 : 4);
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
        grad.addColorStop(0, p.color + "FF"); grad.addColorStop(0.3, p.color + "BB");
        grad.addColorStop(0.7, p.color + "44"); grad.addColorStop(1, p.color + "00");
        ctx.beginPath(); ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
        ctx.fillStyle = grad; ctx.globalAlpha = a * 0.6; ctx.fill();
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = "#FFFFFF"; ctx.shadowBlur = p.big ? 15 : 9;
        ctx.shadowColor = p.glow; ctx.globalAlpha = a; ctx.fill();
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = p.color; ctx.shadowBlur = p.big ? 20 : 12;
        ctx.shadowColor = p.glow; ctx.globalAlpha = a * 0.85; ctx.fill();
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      });
      animRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [scores]);

  return (
    <canvas ref={canvasRef} style={{
      position: "fixed", inset: 0, width: "100vw", height: "100vh",
      opacity: active ? 1 : 0.15, transition: "opacity 0.5s",
    }} />
  );
}

// ── Radar Chart ───────────────────────────────────────────────────────────────
function RadarChart({ scores, size = 200 }) {
  const keys = ["depression", "anxiety", "anger", "joy", "stability"];
  const cx = size / 2, cy = size / 2, r = size * 0.38;
  const pts = keys.map((k, i) => {
    const angle = (i / keys.length) * Math.PI * 2 - Math.PI / 2;
    const val = scores[k] || 0;
    return {
      x: cx + Math.cos(angle) * r * val, y: cy + Math.sin(angle) * r * val,
      ax: cx + Math.cos(angle) * r, ay: cy + Math.sin(angle) * r, key: k, val
    };
  });
  const polygon = pts.map(p => `${p.x},${p.y}`).join(" ");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <radialGradient id="radarFill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#F5D080" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#A8E063" stopOpacity="0.04" />
        </radialGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map(t => (
        <polygon key={t} points={pts.map((p, i) => {
          const angle = (i / keys.length) * Math.PI * 2 - Math.PI / 2;
          return `${cx + Math.cos(angle) * r * t},${cy + Math.sin(angle) * r * t}`;
        }).join(" ")} fill="none" stroke="#ffffff0A" strokeWidth="1" />
      ))}
      {pts.map((p, i) => <line key={i} x1={cx} y1={cy} x2={p.ax} y2={p.ay} stroke="#ffffff0C" strokeWidth="1" />)}
      <polygon points={polygon} fill="url(#radarFill)" />
      <polygon points={polygon} fill="none" stroke="#F5D08070" strokeWidth="1.5" strokeDasharray="3 2" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={5} fill={EMOTION_META[p.key].color + "30"} />
          <circle cx={p.x} cy={p.y} r={2.5} fill={EMOTION_META[p.key].color} />
          <text x={p.ax + (p.ax - cx) * 0.2} y={p.ay + (p.ay - cy) * 0.2}
            textAnchor="middle" dominantBaseline="middle"
            fontSize="8" fill={EMOTION_META[p.key].color} opacity="0.85">
            {EMOTION_META[p.key].icon}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ── Wave Bar ──────────────────────────────────────────────────────────────────
function WaveBar({ value, color, label, animated, isMobile }) {
  const bars = isMobile ? 15 : 28;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: isMobile ? "1 1 100px" : "none" }}>
      <div style={{ fontSize: 9, letterSpacing: "0.12em", color: "#8A8A7A", textTransform: "uppercase" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: isMobile ? 1.5 : 2, height: 36 }}>
        {Array.from({ length: bars }).map((_, i) => {
          const threshold = i / bars;
          const active = threshold < value;
          const height = 4 + Math.abs(Math.sin(i * 0.7 + value * 5)) * 28;
          return (
            <div key={i} style={{
              width: isMobile ? 2.5 : 3, height: active ? height : 4,
              background: active ? color : "#2A2A1A", borderRadius: 2,
              transition: animated ? `height ${0.1 + i * 0.01}s ease` : "none",
              opacity: active ? 0.9 : 0.15,
              boxShadow: active ? `0 0 7px ${color}90` : "none",
            }} />
          );
        })}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>
        {Math.round(value * 100)}
      </div>
    </div>
  );
}

// ── Mini Audio Player ─────────────────────────────────────────────────────────
function MiniPlayer({ track, domColor, domGlow, onClose }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);

  // 트랙 변경 시 재생 초기화
  useEffect(() => {
    setPlaying(false);
    setProgress(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [track?.id]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else { audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); }
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (audio && audio.duration) {
      setProgress(audio.currentTime / audio.duration);
    }
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audio.currentTime = ratio * audio.duration;
    setProgress(ratio);
  };

  const handleVolumeChange = (e) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  };

  const fmt = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  if (!track?.previewUrl) return null;

  return (
    <div style={{
      position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
      zIndex: 1000, width: "min(520px, 95vw)",
      background: "rgba(8, 10, 22, 0.97)",
      border: `1px solid ${domColor}40`,
      borderRadius: 18, padding: "14px 18px",
      backdropFilter: "blur(20px)",
      boxShadow: `0 0 40px ${domGlow}, 0 8px 32px rgba(0,0,0,0.8)`,
      display: "flex", flexDirection: "column", gap: 10,
      animation: "slideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
    }}>
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes slideUp { from { opacity:0; transform: translateX(-50%) translateY(30px); } to { opacity:1; transform: translateX(-50%) translateY(0); } }
        @keyframes spinVinyl { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .player-seek::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%; background: ${domColor}; cursor: pointer; }
        .player-seek::-webkit-slider-runnable-track { height: 3px; background: #ffffff15; border-radius: 2px; }
        .player-vol::-webkit-slider-thumb { -webkit-appearance: none; width: 10px; height: 10px; border-radius: 50%; background: ${domColor}; cursor: pointer; }
        .player-vol::-webkit-slider-runnable-track { height: 2px; background: #ffffff15; border-radius: 2px; }
      `}} />

      <audio
        ref={audioRef}
        src={track.previewUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={e => setDuration(e.target.duration)}
        onEnded={() => { setPlaying(false); setProgress(0); }}
        volume={volume}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* 앨범커버 */}
        <div style={{
          width: 52, height: 52, borderRadius: 10, flexShrink: 0, overflow: "hidden",
          border: `2px solid ${domColor}50`,
          boxShadow: `0 0 16px ${domGlow}`,
          animation: playing ? "spinVinyl 8s linear infinite" : "none",
          background: "#1a1a2e",
        }}>
          {track.artworkUrl ? (
            <img src={track.artworkUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
              {EMOTION_META["joy"].icon}
            </div>
          )}
        </div>

        {/* 트랙 정보 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#F5EED8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {track.title}
          </div>
          <div style={{ fontSize: 10, color: "#6A6A5A", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {track.artist}
          </div>
          <div style={{ fontSize: 8, color: domColor, marginTop: 3, letterSpacing: "0.15em", textTransform: "uppercase" }}>
            ♪ iTunes 30s Preview
          </div>
        </div>

        {/* 컨트롤 */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {/* 볼륨 */}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 11, color: "#5A5A4A" }}>♪</span>
            <input type="range" className="player-vol" min="0" max="1" step="0.05"
              value={volume} onChange={handleVolumeChange}
              style={{ width: 60, appearance: "none", background: "transparent", cursor: "pointer" }} />
          </div>

          {/* Play/Pause */}
          <button onClick={togglePlay} style={{
            width: 40, height: 40, borderRadius: "50%",
            background: `radial-gradient(circle, ${domColor}30, ${domColor}10)`,
            border: `1.5px solid ${domColor}80`,
            color: domColor, fontSize: 16, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: playing ? `0 0 18px ${domGlow}` : "none",
            transition: "all 0.2s",
          }}>
            {playing ? "⏸" : "▶"}
          </button>

          {/* 닫기 */}
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: "50%",
            background: "#ffffff08", border: "1px solid #ffffff15",
            color: "#4A4A3A", fontSize: 12, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>✕</button>
        </div>
      </div>

      {/* Seek Bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 9, color: "#4A4A3A", fontVariantNumeric: "tabular-nums", minWidth: 28 }}>
          {fmt(duration * progress)}
        </span>
        <div onClick={handleSeek} style={{ flex: 1, height: 12, display: "flex", alignItems: "center", cursor: "pointer", position: "relative" }}>
          <div style={{ position: "absolute", left: 0, right: 0, height: 3, background: "#ffffff10", borderRadius: 2 }}>
            <div style={{
              height: "100%", width: `${progress * 100}%`, borderRadius: 2,
              background: `linear-gradient(90deg, ${domColor}, ${domColor}99)`,
              boxShadow: `0 0 8px ${domGlow}`,
              transition: "width 0.1s linear",
            }} />
          </div>
        </div>
        <span style={{ fontSize: 9, color: "#4A4A3A", fontVariantNumeric: "tabular-nums", minWidth: 28, textAlign: "right" }}>
          {fmt(duration)}
        </span>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function MusicVirus() {
  const [tracks, setTracks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [scores, setScores] = useState(null);
  const [animating, setAnimating] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState("CONNECTING LAST.FM API...");
  const [showPlayer, setShowPlayer] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ── Last.fm + iTunes 데이터 페칭 ─────────────────────────────────────────
  useEffect(() => {
    async function fetchData() {
      const LASTFM_API_KEY = "8031c3fd85fae84e3a1970b02e22a231";
      const LASTFM_BASE = "https://ws.audioscrobbler.com/2.0";

      try {
        setLoading(true);
        setLoadingStatus("📡 FETCHING LAST.FM GLOBAL CHART...");

        // 1. Last.fm 글로벌 Top 50 차트
        const chartRes = await fetch(
          `${LASTFM_BASE}/?method=chart.getTopTracks&api_key=${LASTFM_API_KEY}&format=json&limit=50`
        );
        if (!chartRes.ok) throw new Error("Last.fm 요청 실패");

        const chartData = await chartRes.json();
        const rawTracks = chartData?.tracks?.track || [];
        if (rawTracks.length === 0) throw new Error("트랙 없음");

        setLoadingStatus(`🎵 ANALYZING ${rawTracks.length} TRACKS...`);

        // 2. 각 트랙 병렬 처리: Last.fm 태그 + iTunes 미리듣기
        // 성능을 위해 배치 처리 (10개씩)
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

              // Last.fm track.getInfo (태그)
              let tags = [];
              try {
                const infoRes = await fetch(
                  `${LASTFM_BASE}/?method=track.getInfo&api_key=${LASTFM_API_KEY}&artist=${encodeURIComponent(raw.artist.name)}&track=${encodeURIComponent(raw.name)}&format=json`
                );
                if (infoRes.ok) {
                  const infoData = await infoRes.json();
                  tags = (infoData?.track?.toptags?.tag || []).map(t => t.name.toLowerCase());
                }
              } catch (_) { }

              // iTunes 앨범커버 + 미리듣기
              const itunes = await fetchItunesData(raw.name, raw.artist.name);

              // 태그 기반 감성 추정
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
        setSelected(allItems[0]);
        setScores(computeVirusScores(allItems[0]));
        setLoading(false);
      } catch (err) {
        console.error("API 오류, 모크 데이터 사용:", err);
        const mock = MOCK_TRACKS.map(t => ({ ...t, streams: t.streams || 500000000, artworkUrl: null, previewUrl: null }));
        setTracks(mock);
        setSelected(mock[0]);
        setScores(computeVirusScores(mock[0]));
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const selectTrack = useCallback((track) => {
    setAnimating(true);
    setShowPlayer(false);
    setTimeout(() => {
      setSelected(track);
      setScores(computeVirusScores(track));
      setAnimating(false);
    }, 280);
  }, []);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading || !selected || !scores) {
    return (
      <div style={{
        minHeight: "100vh", background: "#000000", color: "#F5EED8",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        fontFamily: "'DM Mono', 'Courier New', monospace", gap: 20,
      }}>
        <div style={{
          width: 55, height: 55, borderRadius: "50%",
          border: "3px solid #ffffff10", borderTopColor: "#39FF14",
          animation: "spin 1s linear infinite", boxShadow: "0 0 20px #39FF14CC",
        }} />
        <div style={{ fontSize: 10, letterSpacing: "0.2em", color: "#8A8A7A", textTransform: "uppercase", textAlign: "center", maxWidth: 300 }}>
          {loadingStatus}
        </div>
        <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }` }} />
      </div>
    );
  }

  const aggregate = tracks.reduce((acc, t) => {
    const s = computeVirusScores(t);
    Object.keys(s).forEach(k => { if (typeof s[k] === "number") acc[k] = (acc[k] || 0) + s[k]; });
    return acc;
  }, {});
  Object.keys(aggregate).forEach(k => { aggregate[k] /= (tracks.length || 1); });

  const dominantEmotion = ["depression", "anxiety", "anger", "joy", "stability"]
    .reduce((a, b) => scores[a] > scores[b] ? a : b);
  const domColor = EMOTION_META[dominantEmotion].color;
  const domGlow = EMOTION_META[dominantEmotion].glow;

  return (
    <div style={{
      minHeight: "100vh", background: "#000000", color: "#E8E4D8",
      fontFamily: "'DM Mono', 'Courier New', monospace",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1 }}>
        <LanternParticles scores={scores} active={!animating} />
      </div>
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: `radial-gradient(circle, #ffffff08 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
      }} />

      {/* Header */}
      <header style={{
        position: "relative", zIndex: 10,
        padding: isMobile ? "12px 16px" : "18px 28px 14px",
        borderBottom: "1px solid #ffffff08",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        backdropFilter: "blur(8px)", background: "#0C0E1A90",
      }}>
        <div>
          <div style={{ fontSize: isMobile ? 8 : 9, letterSpacing: isMobile ? "0.15em" : "0.3em", color: "#F0C060AA", marginBottom: 4, textTransform: "uppercase" }}>
            ✦ LIVE · Social Emotional Contagion
          </div>
          <div style={{ fontSize: "clamp(32px, 6vw, 44px)", fontWeight: 900, letterSpacing: "-0.02em", color: "#F5EED8" }}>
            MMMHAK
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            fontSize: 9, color: "#8A8A6A",
            background: "#ffffff06", border: "1px solid #ffffff0A",
            padding: "5px 10px", borderRadius: 20, letterSpacing: "0.05em",
          }}>
            {isMobile ? `${tracks.length} tracks` : `${tracks.length} tracks · Last.fm Global`}
          </div>
          {/* iTunes 미리듣기 버튼 */}
          {selected.previewUrl && (
            <button onClick={() => setShowPlayer(p => !p)} style={{
              fontSize: 9, color: showPlayer ? domColor : "#8A8A6A",
              background: showPlayer ? `${domColor}15` : "#ffffff06",
              border: `1px solid ${showPlayer ? domColor + "60" : "#ffffff0A"}`,
              padding: "5px 12px", borderRadius: 20,
              cursor: "pointer", letterSpacing: "0.05em",
              boxShadow: showPlayer ? `0 0 12px ${domGlow}` : "none",
              transition: "all 0.2s",
            }}>
              {showPlayer ? "⏸ PLAYER" : "▶ PREVIEW"}
            </button>
          )}
        </div>
      </header>

      <div style={{
        position: "relative", zIndex: 5,
        display: "flex", flexDirection: isMobile ? "column" : "row",
        height: isMobile ? "auto" : "calc(100vh - 63px)",
      }}>

        {/* Sidebar */}
        <aside style={{
          width: isMobile ? "100%" : 260,
          borderRight: isMobile ? "none" : "1px solid #ffffff07",
          borderBottom: isMobile ? "1px solid #ffffff07" : "none",
          overflowY: isMobile ? "hidden" : "auto",
          overflowX: isMobile ? "auto" : "hidden",
          padding: isMobile ? "10px 0" : "14px 0",
          scrollbarWidth: "none",
          background: "#0A0C1680", backdropFilter: "blur(6px)",
          display: isMobile ? "flex" : "block",
          flexDirection: isMobile ? "row" : "column",
          flexShrink: 0,
        }}>
          {!isMobile && (
            <div style={{ padding: "0 16px 10px", fontSize: 9, letterSpacing: "0.2em", color: "#4A4A3A", textTransform: "uppercase" }}>
              Last.fm Global Chart
            </div>
          )}
          {tracks.map((track, i) => {
            const s = computeVirusScores(track);
            const dom = ["depression", "anxiety", "anger", "joy", "stability"].reduce((a, b) => s[a] > s[b] ? a : b);
            const isActive = selected.id === track.id;
            return (
              <div key={track.id} onClick={() => selectTrack(track)} style={{
                padding: isMobile ? "8px 14px" : "10px 14px",
                cursor: "pointer",
                background: isActive ? `${EMOTION_META[dom].color}0C` : "transparent",
                borderLeft: isMobile ? "none" : `2px solid ${isActive ? EMOTION_META[dom].color : "transparent"}`,
                borderBottom: isMobile ? `2px solid ${isActive ? EMOTION_META[dom].color : "transparent"}` : "none",
                transition: "all 0.2s", flexShrink: 0,
                width: isMobile ? 175 : "auto",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {/* 앨범커버 or 순위 */}
                  <div style={{
                    width: 32, height: 32, borderRadius: 7, flexShrink: 0, overflow: "hidden",
                    background: track.artworkUrl ? "transparent" : `linear-gradient(135deg, ${EMOTION_META[dom].color}50, ${EMOTION_META[dom].color}10)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, color: EMOTION_META[dom].color, fontWeight: 700,
                    border: `1px solid ${isActive ? EMOTION_META[dom].color + "60" : EMOTION_META[dom].color + "25"}`,
                    boxShadow: isActive ? `0 0 12px ${EMOTION_META[dom].glow}` : "none",
                    position: "relative",
                  }}>
                    {track.artworkUrl ? (
                      <>
                        <img src={track.artworkUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        {isActive && (
                          <div style={{
                            position: "absolute", inset: 0, background: `${EMOTION_META[dom].color}30`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 12, color: EMOTION_META[dom].color,
                          }}>▶</div>
                        )}
                      </>
                    ) : (
                      String(i + 1).padStart(2, "0")
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: isActive ? "#F5EED8" : "#B0A898", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {track.title}
                    </div>
                    <div style={{ fontSize: 9, color: "#4A4A3A", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 4 }}>
                      {track.artist}
                      {track.previewUrl && <span style={{ color: domColor, fontSize: 8 }}>♪</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: 9, color: "#3A3A2A", flexShrink: 0 }}>
                    {String(i + 1).padStart(2, "0")}
                  </div>
                </div>
                <div style={{ marginTop: 6, display: "flex", gap: 2 }}>
                  {["depression", "anxiety", "anger", "joy", "stability"].map(k => (
                    <div key={k} style={{
                      height: 2, flex: 1, borderRadius: 2,
                      background: `linear-gradient(90deg, ${EMOTION_META[k].color}CC ${s[k] * 100}%, #1E1E14 0%)`,
                    }} />
                  ))}
                </div>
              </div>
            );
          })}
        </aside>

        {/* Main */}
        <main style={{
          flex: 1, overflow: isMobile ? "visible" : "auto",
          padding: isMobile ? "16px 16px" : "20px 24px",
          scrollbarWidth: "none", position: "relative",
          paddingBottom: showPlayer ? 120 : undefined,
        }}>
          <div style={{ opacity: animating ? 0 : 1, transition: "opacity 0.28s", position: "relative", zIndex: 2 }}>

            {/* Track Header */}
            <div style={{
              display: "flex", flexDirection: isMobile ? "column" : "row",
              alignItems: isMobile ? "center" : "flex-start",
              textAlign: isMobile ? "center" : "left",
              gap: isMobile ? 16 : 22, marginBottom: 24, flexWrap: "wrap",
            }}>
              {/* 앨범커버 / 감정 아이콘 */}
              <div style={{
                width: 96, height: 96, borderRadius: 20, flexShrink: 0, overflow: "hidden",
                background: selected.artworkUrl
                  ? "transparent"
                  : `radial-gradient(circle at 35% 35%, ${domColor}70 0%, ${domColor}18 60%, transparent 100%)`,
                border: `1.5px solid ${domColor}50`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 38, transition: "box-shadow 0.8s",
                boxShadow: `0 0 32px ${domGlow}, 0 0 8px ${domColor}40 inset`,
                position: "relative",
              }}>
                {selected.artworkUrl ? (
                  <>
                    <img src={selected.artworkUrl} alt={selected.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    {/* 재생 버튼 오버레이 */}
                    {selected.previewUrl && (
                      <button onClick={() => setShowPlayer(p => !p)} style={{
                        position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)",
                        border: "none", cursor: "pointer", fontSize: 28, color: domColor,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        opacity: 0, transition: "opacity 0.2s",
                      }}
                        onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                        onMouseLeave={e => e.currentTarget.style.opacity = "0"}
                      >
                        {showPlayer ? "⏸" : "▶"}
                      </button>
                    )}
                  </>
                ) : (
                  EMOTION_META[dominantEmotion].icon
                )}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "#5A5A4A", marginBottom: 5 }}>
                  NOW ANALYZING
                </div>
                <div style={{ fontSize: "clamp(20px, 4vw, 30px)", fontWeight: 800, color: "#F5EED8", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
                  {selected.title}
                </div>
                <div style={{ fontSize: 13, color: "#7A7A6A", marginTop: 5 }}>{selected.artist}</div>

                {/* Tags */}
                {selected.tags && selected.tags.length > 0 && (
                  <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap", justifyContent: isMobile ? "center" : "flex-start" }}>
                    {selected.tags.slice(0, 4).map(tag => (
                      <span key={tag} style={{
                        fontSize: 8, padding: "2px 8px", borderRadius: 20,
                        background: `${domColor}12`, border: `1px solid ${domColor}30`,
                        color: domColor, letterSpacing: "0.1em", textTransform: "uppercase",
                      }}>#{tag}</span>
                    ))}
                  </div>
                )}

                <div style={{
                  display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap",
                  justifyContent: isMobile ? "center" : "flex-start",
                }}>
                  {[
                    { label: "BPM", val: selected.bpm },
                    { label: "KEY", val: selected.mode === "minor" ? "단조" : "장조" },
                    { label: "ENERGY", val: `${Math.round(selected.energy * 100)}%` },
                    { label: "VALENCE", val: `${Math.round(selected.valence * 100)}%` },
                    { label: "PLAYS", val: selected.streams >= 1e9 ? `${(selected.streams / 1e9).toFixed(1)}B` : `${(selected.streams / 1e6).toFixed(0)}M` },
                  ].map(item => (
                    <div key={item.label} style={{
                      padding: "4px 12px", borderRadius: 20, fontSize: 10,
                      background: "#ffffff05", border: "1px solid #ffffff0E", color: "#8A8A7A",
                    }}>
                      <span style={{ color: "#4A4A3A", marginRight: 4 }}>{item.label}</span>
                      <span style={{ color: "#D8D0C0", fontWeight: 700 }}>{item.val}</span>
                    </div>
                  ))}
                  {/* iTunes 미리듣기 뱃지 */}
                  {selected.previewUrl && (
                    <button onClick={() => setShowPlayer(p => !p)} style={{
                      padding: "4px 12px", borderRadius: 20, fontSize: 10,
                      background: showPlayer ? `${domColor}20` : "#ffffff05",
                      border: `1px solid ${showPlayer ? domColor + "60" : "#ffffff0E"}`,
                      color: showPlayer ? domColor : "#8A8A7A",
                      cursor: "pointer", transition: "all 0.2s",
                      boxShadow: showPlayer ? `0 0 10px ${domGlow}` : "none",
                    }}>
                      {showPlayer ? "⏸ PLAYING" : "▶ PREVIEW"}
                    </button>
                  )}
                </div>
              </div>
              <div style={{ flexShrink: 0, marginTop: isMobile ? 12 : 0 }}>
                <RadarChart scores={scores} size={isMobile ? 150 : 174} />
              </div>
            </div>

            {/* Dominant Glow Banner */}
            <div style={{
              padding: isMobile ? "12px 14px" : "14px 18px", borderRadius: 14, marginBottom: 18,
              background: `linear-gradient(120deg, ${domColor}12 0%, transparent 70%)`,
              border: `1px solid ${domColor}30`,
              display: "flex", alignItems: "center", gap: 14,
              boxShadow: `0 0 20px ${domGlow}`, transition: "all 0.8s",
            }}>
              {/* 앨범커버 썸네일 */}
              {selected.artworkUrl ? (
                <div style={{
                  width: 44, height: 44, borderRadius: 10, overflow: "hidden", flexShrink: 0,
                  border: `1px solid ${domColor}40`, boxShadow: `0 0 12px ${domGlow}`,
                }}>
                  <img src={selected.artworkUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              ) : (
                <div style={{ fontSize: 26, filter: `drop-shadow(0 0 8px ${domColor})`, transition: "filter 0.8s" }}>
                  {EMOTION_META[dominantEmotion].icon}
                </div>
              )}
              <div>
                <div style={{ fontSize: 9, letterSpacing: "0.15em", color: domColor, textTransform: "uppercase", marginBottom: 3, transition: "color 0.8s" }}>
                  Dominant Emotional Light
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#F0E8D4" }}>
                  {EMOTION_META[dominantEmotion].label} · 강도 {Math.round(scores[dominantEmotion] * 100)}
                </div>
                <div style={{ fontSize: 10, color: "#5A5A4A", marginTop: 3 }}>
                  전파 지수 {Math.round(scores.contagion * 100)}% · {selected.streams >= 1e9 ? `${(selected.streams / 1e9).toFixed(1)}B` : `${(selected.streams / 1e6).toFixed(0)}M`} plays
                  {selected.listeners ? ` · ${(selected.listeners / 1e6).toFixed(1)}M listeners` : ""}
                </div>
              </div>
            </div>

            {/* Emotion Wave Bars */}
            <div style={{
              background: "#0E1020A0", border: "1px solid #ffffff07",
              borderRadius: 16, padding: isMobile ? "14px 16px" : "18px 22px", marginBottom: 18,
              backdropFilter: "blur(4px)",
            }}>
              <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "#3A3A2A", marginBottom: 14, textTransform: "uppercase" }}>
                감정 스펙트럼
              </div>
              <div style={{ display: "flex", gap: isMobile ? 12 : 18, flexWrap: "wrap", justifyContent: "space-between" }}>
                {Object.entries(EMOTION_META).filter(([k]) => k !== "discomfort").map(([key, meta]) => (
                  <WaveBar key={key} value={scores[key] || 0} color={meta.color} label={meta.label} animated={!animating} isMobile={isMobile} />
                ))}
              </div>
            </div>

            {/* 3 Data Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(195px, 1fr))", gap: 12, marginBottom: 18 }}>

              {/* ① Tempo */}
              <div style={{ background: "#0E1020A0", border: "1px solid #F0C06020", borderRadius: 14, padding: "15px 17px", backdropFilter: "blur(4px)" }}>
                <div style={{ fontSize: 9, letterSpacing: "0.12em", color: "#F0C060", marginBottom: 10, textTransform: "uppercase" }}>① Tempo · Mode</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#F0E8D4", letterSpacing: "-0.02em" }}>
                  {selected.bpm} <span style={{ fontSize: 12, color: "#4A4A3A", fontWeight: 400 }}>BPM</span>
                </div>
                <div style={{ marginTop: 8 }}>
                  <div style={{
                    display: "inline-block", padding: "3px 10px", borderRadius: 20,
                    fontSize: 10, fontWeight: 700,
                    background: selected.mode === "minor" ? "#7EC8C820" : "#A8E06320",
                    color: selected.mode === "minor" ? "#7EC8C8" : "#A8E063",
                    border: `1px solid ${selected.mode === "minor" ? "#7EC8C840" : "#A8E06340"}`,
                  }}>
                    {selected.mode === "minor" ? "단조 (Minor)" : "장조 (Major)"}
                  </div>
                </div>
                <div style={{ marginTop: 10, fontSize: 10, color: "#4A4A3A", lineHeight: 1.7 }}>
                  단조 + 빠른 BPM → 불안감 증폭<br />단조 + 느린 BPM → 우울감 유발
                </div>
              </div>

              {/* ② Audio Features */}
              <div style={{ background: "#0E1020A0", border: "1px solid #A8E06320", borderRadius: 14, padding: "15px 17px", backdropFilter: "blur(4px)" }}>
                <div style={{ fontSize: 9, letterSpacing: "0.12em", color: "#A8E063", marginBottom: 10, textTransform: "uppercase" }}>② Audio Features</div>
                {[
                  { k: "valence", label: "Valence", v: selected.valence, color: "#A8E063" },
                  { k: "energy", label: "Energy", v: selected.energy, color: "#F0C060" },
                  { k: "loudness", label: "Loudness", v: Math.min((selected.loudness + 20) / 20, 1), color: "#F09060" },
                ].map(item => (
                  <div key={item.k} style={{ marginBottom: 9 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#5A5A4A", marginBottom: 3 }}>
                      <span>{item.label}</span>
                      <span style={{ color: item.color }}>{item.k === "loudness" ? `${selected.loudness}dB` : Math.round(item.v * 100)}</span>
                    </div>
                    <div style={{ height: 3, background: "#1E1E14", borderRadius: 2 }}>
                      <div style={{
                        height: "100%", width: `${item.v * 100}%`, borderRadius: 2,
                        background: `linear-gradient(90deg, ${item.color}CC, ${item.color}80)`,
                        transition: "width 0.65s ease", boxShadow: `0 0 8px ${item.color}70`,
                      }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* ③ Lyrics NLP */}
              <div style={{ background: "#0E1020A0", border: "1px solid #F5D08020", borderRadius: 14, padding: "15px 17px", backdropFilter: "blur(4px)" }}>
                <div style={{ fontSize: 9, letterSpacing: "0.12em", color: "#F5D080", marginBottom: 10, textTransform: "uppercase" }}>③ Lyrics NLP</div>
                {Object.entries(selected.lyrics_sentiment).map(([k, v]) => {
                  const meta = EMOTION_META[k] || { color: "#888", label: k };
                  return (
                    <div key={k} style={{ marginBottom: 7 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#4A4A3A", marginBottom: 2 }}>
                        <span>{meta.label || k}</span>
                        <span style={{ color: meta.color }}>{Math.round(v * 100)}%</span>
                      </div>
                      <div style={{ height: 2, background: "#1E1E14", borderRadius: 1 }}>
                        <div style={{
                          height: "100%", width: `${v * 100}%`, borderRadius: 1,
                          background: meta.color, transition: "width 0.7s ease",
                          boxShadow: `0 0 5px ${meta.color}80`,
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Social Aggregate */}
            <div style={{
              background: "#0E1020A0", border: "1px solid #ffffff07",
              borderRadius: 14, padding: "16px 20px", backdropFilter: "blur(4px)",
            }}>
              <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "#3A3A2A", marginBottom: 12, textTransform: "uppercase" }}>
                사회 집단 감정 평균 · {tracks.length}곡
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 9 }}>
                {["depression", "anxiety", "anger", "joy", "stability", "discomfort"].map(k => (
                  <div key={k} style={{
                    padding: "10px 12px", borderRadius: 10,
                    background: `${EMOTION_META[k].color}08`,
                    border: `1px solid ${EMOTION_META[k].color}20`,
                  }}>
                    <div style={{ fontSize: 9, color: "#4A4A3A", marginBottom: 4 }}>{EMOTION_META[k].label}</div>
                    <div style={{
                      fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em",
                      color: EMOTION_META[k].color,
                      textShadow: `0 0 12px ${EMOTION_META[k].glow}`,
                    }}>
                      {Math.round((aggregate[k] || 0) * 100)}
                    </div>
                    <div style={{ height: 2, background: "#1E1E14", borderRadius: 1, marginTop: 6 }}>
                      <div style={{
                        height: "100%", width: `${(aggregate[k] || 0) * 100}%`,
                        background: EMOTION_META[k].color, borderRadius: 1,
                        boxShadow: `0 0 6px ${EMOTION_META[k].glow}`,
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </main>
      </div>

      {/* Floating Mini Player */}
      {showPlayer && selected && (
        <MiniPlayer
          track={selected}
          domColor={domColor}
          domGlow={domGlow}
          onClose={() => setShowPlayer(false)}
        />
      )}
    </div>
  );
}