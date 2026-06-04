import { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";

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

// ── Data ──────────────────────────────────────────────────────────────────────
const LEFT_ARTISTS = [
  { id: 1,  name: "Sabrina Carpenter", img: "https://picsum.photos/120/90?random=1" },
  { id: 2,  name: "Billie Eilish",     img: "https://picsum.photos/120/90?random=2" },
  { id: 3,  name: "Benson Boone",      img: "https://picsum.photos/120/90?random=3" },
  { id: 4,  name: "Hozier",            img: "https://picsum.photos/120/90?random=4" },
  { id: 5,  name: "FloyyMenor",        img: "https://picsum.photos/120/90?random=5" },
  { id: 6,  name: "Taylor Swift",      img: "https://picsum.photos/120/90?random=6" },
  { id: 7,  name: "ILLIT",             img: "https://picsum.photos/120/90?random=7" },
  { id: 8,  name: "ZICO",              img: "https://picsum.photos/120/90?random=8" },
];

const RIGHT_ARTISTS = [
  { id: 9,  name: "NewJeans",          img: "https://picsum.photos/120/90?random=9" },
  { id: 10, name: "Jung Kook",         img: "https://picsum.photos/120/90?random=10" },
  { id: 11, name: "The Weeknd",        img: "https://picsum.photos/120/90?random=11" },
  { id: 12, name: "Harry Styles",      img: "https://picsum.photos/120/90?random=12" },
  { id: 13, name: "Tate McRae",        img: "https://picsum.photos/120/90?random=13" },
  { id: 14, name: "Teddy Swims",       img: "https://picsum.photos/120/90?random=14" },
  { id: 15, name: "SZA",               img: "https://picsum.photos/120/90?random=15" },
  { id: 16, name: "Bad Bunny",         img: "https://picsum.photos/120/90?random=16" },
];

const INFO_BUTTONS = [
  { id: "bpm",    label: "BPM",    icon: "♫", content: 'Tempo: 128 BPM — High energy dance rhythm' },
  { id: "key",    label: "KEY",    icon: "♪", content: 'Key: A minor — Creates tension and emotional depth' },
  { id: "energy", label: "ENERGY", icon: "♫", content: 'Energy Score: 0.88 / 1.0 — Intense, driving force' },
  { id: "plays",  label: "PLAYS",  icon: "◎", content: 'Total Plays: 980,000,000 — Global viral spread' },
  { id: "lyrics", label: "LYRICS", icon: "♫", content: 'Sentiment: Joy 65% · Anxiety 12% · Depression 5%' },
];

// ── Artist Card ───────────────────────────────────────────────────────────────
function ArtistCard({ artist, onSelect, isActive }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      data-hover="true"
      onClick={() => onSelect(artist)}
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
        src={artist.img}
        alt={artist.name}
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
        {artist.name}
      </span>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ artists, side, activeArtist, onSelect, isMobile }) {
  if (isMobile) return null; // hidden on mobile — handled separately

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
      {artists.map((artist) => (
        <ArtistCard
          key={artist.id}
          artist={artist}
          onSelect={onSelect}
          isActive={activeArtist?.id === artist.id}
        />
      ))}
    </div>
  );
}

// ── Info Button + Popup ───────────────────────────────────────────────────────
function InfoButton({ btn, isOpen, onToggle, onClose, isMobile }) {
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose]);

  return (
    <div ref={wrapRef} style={{ position: "relative", marginBottom: 12 }}>
      <button
        data-hover="true"
        id={`btn-${btn.id}`}
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
            {btn.content}
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
            animation: playing
              ? `wave 0.8s ease-in-out ${delay}s infinite`
              : "none",
            boxShadow: playing ? "0 0 6px rgba(204,255,0,0.6)" : "none",
          }}
        />
      ))}
    </div>
  );
}

// ── Preview Section ───────────────────────────────────────────────────────────
function PreviewSection({ artist }) {
  const [playing, setPlaying] = useState(false);

  // Reset on artist change
  useEffect(() => {
    setPlaying(false);
  }, [artist?.id]);

  const togglePlay = () => setPlaying((p) => !p);

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
          src={
            artist?.img?.replace("120/90", "160/160") ||
            `https://picsum.photos/160/160?random=${artist?.id || 1}`
          }
          alt={artist?.name || "Artist"}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        {/* Playing overlay */}
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
        {artist?.name || "artist name"}
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
function CenterPanel({ activeArtist, isMobile }) {
  const [openPopup, setOpenPopup] = useState(null);

  const toggle = (id) => setOpenPopup((prev) => (prev === id ? null : id));
  const close = () => setOpenPopup(null);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5C8C8",
        clipPath:
          "polygon(0 40px, 40px 0, 100% 0, 100% calc(100% - 40px), calc(100% - 40px) 100%, 0 100%)",
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
            />
          ))}
        </div>

        {/* Preview center */}
        <PreviewSection artist={activeArtist} />

        {/* Right ambient space — decorative */}
        {!isMobile && (
          <div
            style={{
              flex: 1,
              position: "relative",
              minWidth: 40,
              pointerEvents: "none",
            }}
          >
            {[
              { top: "18%", right: "12%", size: 64, opacity: 0.12 },
              { top: "48%", right: "28%", size: 32, opacity: 0.08 },
              { top: "70%", right: "8%",  size: 90, opacity: 0.06 },
            ].map((c, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  top: c.top,
                  right: c.right,
                  width: c.size,
                  height: c.size,
                  borderRadius: "50%",
                  border: `1.5px solid rgba(26,0,80,${c.opacity * 2})`,
                  background: `rgba(26,0,80,${c.opacity})`,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Mobile Sidebar Strip ──────────────────────────────────────────────────────
function MobileSidebarStrip({ artists, activeArtist, onSelect, label }) {
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
        {artists.map((a) => (
          <div
            key={a.id}
            data-hover="true"
            onClick={() => onSelect(a)}
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
              src={a.img}
              alt={a.name}
              style={{
                width: 72,
                height: 54,
                objectFit: "cover",
                borderRadius: 6,
                border:
                  activeArtist?.id === a.id
                    ? "2px solid #CCFF00"
                    : "2px solid transparent",
                boxShadow:
                  activeArtist?.id === a.id
                    ? "0 0 10px rgba(204,255,0,0.5)"
                    : "none",
                transition: "border 0.2s, box-shadow 0.2s",
              }}
            />
            <span
              style={{
                fontSize: 8,
                color:
                  activeArtist?.id === a.id ? "#CCFF00" : "rgba(255,255,255,0.5)",
                fontFamily: "'Space Mono', monospace",
                maxWidth: 72,
                textAlign: "center",
                lineHeight: 1.2,
                transition: "color 0.2s",
              }}
            >
              {a.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────
function Header({ isMobile }) {
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
      {/* Logo */}
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

      {/* Right accent */}
      <div
        style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}
      >
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
  const [activeArtist, setActiveArtist] = useState(LEFT_ARTISTS[0]);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 700);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const handleSelect = useCallback((artist) => {
    setActiveArtist(artist);
  }, []);

  return (
    <>
      <CustomCursor />

      {/* Deep-purple fixed background */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "#1A0050",
          zIndex: -1,
        }}
      />

      {/* Grid dot overlay */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle, rgba(204,255,0,0.045) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
          zIndex: 0,
          pointerEvents: "none",
        }}
      />

      <Header isMobile={isMobile} />

      {/* ── DESKTOP layout ── */}
      {!isMobile && (
        <>
          {/* Left sidebar — truly fixed */}
          <Sidebar
            artists={LEFT_ARTISTS}
            side="left"
            activeArtist={activeArtist}
            onSelect={handleSelect}
            isMobile={false}
          />

          {/* Right sidebar — truly fixed */}
          <Sidebar
            artists={RIGHT_ARTISTS}
            side="right"
            activeArtist={activeArtist}
            onSelect={handleSelect}
            isMobile={false}
          />

          {/* Center scrollable zone */}
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
            <CenterPanel activeArtist={activeArtist} isMobile={false} />
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
          {/* Top artist strip */}
          <MobileSidebarStrip
            artists={LEFT_ARTISTS}
            activeArtist={activeArtist}
            onSelect={handleSelect}
            label="Artists"
          />

          {/* Center panel */}
          <CenterPanel activeArtist={activeArtist} isMobile={true} />

          {/* Bottom artist strip */}
          <MobileSidebarStrip
            artists={RIGHT_ARTISTS}
            activeArtist={activeArtist}
            onSelect={handleSelect}
            label="More Artists"
          />
        </div>
      )}
    </>
  );
}