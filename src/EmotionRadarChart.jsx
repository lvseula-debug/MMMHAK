// src/EmotionRadarChart.jsx
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { getConfidenceLabel } from "./utils/confidenceUtils";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
} from "recharts";

const colorMap = {
  Uplifting: "#FF06EA",
  Energetic: "#FF5F2A",
  Aggressive: "#BF1111",
  Melancholic: "#6139FF",
  Desolation: "#BEB729",
  Serenity: "#34A853",
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const color = colorMap[data.subject] || "#CCFF00";
    return (
      <div
        style={{
          background: "rgba(26, 0, 80, 0.95)",
          color: color,
          padding: "6px 10px",
          border: `1px solid ${color}66`,
          borderRadius: "6px",
          fontFamily: "'Space Mono', monospace",
          fontSize: "10px",
          fontWeight: 700,
          boxShadow: `0 0 12px ${color}55`,
          textTransform: "uppercase",
          zIndex: 10000,
        }}
      >
        {data.subject}: {Math.round(data.value * 100)}%
      </div>
    );
  }
  return null;
};

const renderPolarAngleAxisTick = ({ payload, x, y, cx, cy, ...rest }) => {
  const labelColor = colorMap[payload.value] || "#CCFF00";
  let textAnchor = "middle";
  if (x > cx + 15) {
    textAnchor = "start";
  } else if (x < cx - 15) {
    textAnchor = "end";
  }

  // Y offset to reduce label overlap
  const yOffset = y > cy + 10 ? 8 : y < cy - 10 ? -8 : 0;

  return (
    <text
      {...rest}
      x={x}
      y={y + yOffset}
      textAnchor={textAnchor}
      fill={labelColor}
      style={{
        fontFamily: "'Space Mono', monospace",
        fontSize: "10px",
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {payload.value}
    </text>
  );
};

function DraggableChartGroup({ children, trackId, onDragStart, blobWidth = 310, blobHeight = 310, showModalRef }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  // Reset position when track changes
  useEffect(() => {
    setPos({ x: 0, y: 0 });
  }, [trackId]);

  const onMouseDown = (e) => {
    // Disable dragging while modal is visible – parent will set a flag via onDragStart if needed
    if (showModalRef?.current) return;
    dragging.current = true;
    setIsDragging(true);
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragStart.current = { mx: clientX, my: clientY, px: pos.x, py: pos.y };
  };



  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      setPos({
        x: dragStart.current.px + (clientX - dragStart.current.mx),
        y: dragStart.current.py + (clientY - dragStart.current.my),
      });
    };
    const onUp = () => {
      dragging.current = false;
      setIsDragging(false);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, []);

  return (
    <div
      className="relative z-10 flex justify-center items-center select-none w-full max-w-[310px] mx-auto"
      style={{
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        cursor: isDragging ? "grabbing" : "grab",
        pointerEvents: "auto",
      }}
      onMouseDown={onMouseDown}
      onTouchStart={onMouseDown}
    >
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#1A0050] rounded-full z-0 opacity-96 pointer-events-none w-full h-full"
        style={{
          maxWidth: blobWidth,
          maxHeight: blobHeight,
          animation: "float-blob 8s ease-in-out infinite",
        }}
      />
      <div className="relative z-10 p-2 w-full flex justify-center items-center">
        {children}
      </div>
    </div>
  );
}

const renderCustomDot = (scores) => (props) => {
  const { cx, cy, payload } = props;
  if (!payload || !scores) return null;

  const emotionsList = ["Uplifting", "Energetic", "Aggressive", "Melancholic", "Desolation", "Serenity"];
  const sorted = emotionsList
    .map(emo => ({ name: emo, val: scores[emo] ?? 0 }))
    .sort((a, b) => b.val - a.val);

  const top1 = sorted[0].name;
  const top2 = sorted[1].name;

  const currentSubject = payload.subject;
  const color = colorMap[currentSubject] || "#CCFF00";

  let r = 2.5;
  let strokeWidth = 1;
  let stroke = "none";

  if (currentSubject === top1) {
    r = 6.5;
    strokeWidth = 3;
    stroke = "#CCFF00";
  } else if (currentSubject === top2) {
    r = 4.5;
    strokeWidth = 2.5;
    stroke = "#00FF88";
  } else {
    return <circle cx={cx} cy={cy} r={2.5} fill={color} stroke="none" />;
  }

  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={color}
      stroke={stroke}
      strokeWidth={strokeWidth}
      style={{ filter: "drop-shadow(0 0 4px rgba(255,255,255,0.5))" }}
    />
  );
};

export default function EmotionRadarChart({ scores, trackId, source }) {
  const [showModal, setShowModal] = useState(false);
  const btnRef = useRef(null);
  const [modalPos, setModalPos] = useState({ bottom: 0, left: 0 });
  const showModalRef = useRef(false);

  // Reset modal when track changes
  useEffect(() => {
    setShowModal(false);
  }, [trackId]);

  // Sync ref for drag guard
  useEffect(() => {
    showModalRef.current = showModal;
  }, [showModal]);

  if (!scores) return null;

  const totalVal = (scores.Uplifting ?? 0) + (scores.Energetic ?? 0) + (scores.Aggressive ?? 0) + (scores.Melancholic ?? 0) + (scores.Desolation ?? 0) + (scores.Serenity ?? 0);

  if (scores.insufficient_data || scores.no_info || totalVal === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-white font-['Space_Mono'] bg-[#1A0050]/80 rounded-xl border border-dashed border-white/20 w-full max-w-[260px] min-h-[260px] mx-auto z-10 relative">
        <span style={{ fontSize: '28px', marginBottom: '8px' }}>⚠️</span>
        <div style={{ fontWeight: 800, color: '#CCFF00', fontSize: '11px', letterSpacing: '0.1em' }}>DATA SCARCE / NO INFO</div>
        <div style={{ fontSize: '10px', opacity: 0.6, marginTop: '8px', lineHeight: 1.5 }}>
          Insufficient lyrics or metadata available to generate a reliable emotion chart.
        </div>
      </div>
    );
  }

  const confidenceValue = scores.confidence ?? 0;
  const confInfo = getConfidenceLabel(confidenceValue);

  const data = [
    { subject: "Uplifting",   value: scores.Uplifting   ?? 0 },
    { subject: "Energetic",   value: scores.Energetic   ?? 0 },
    { subject: "Aggressive",  value: scores.Aggressive  ?? 0 },
    { subject: "Melancholic", value: scores.Melancholic ?? 0 },
    { subject: "Desolation",  value: scores.Desolation  ?? 0 },
    { subject: "Serenity",    value: scores.Serenity    ?? 0 },
  ];

  const maxVal = Math.max(...data.map(d => d.value));
  const radiusDomain = [0, Math.max(1, maxVal)];

  const hideBoard = scores.insufficient_data || scores.no_info || (source === 'heuristic' && scores.insufficient_data);

  return (
    <div className="flex flex-col items-center gap-2 mt-1 w-full relative">
      {showModal && createPortal(
        <div
          style={{
            position: 'fixed',
            bottom: modalPos.bottom,
            left: modalPos.left,
            transform: 'translateX(-50%)',
            width: 280,
            zIndex: 9999,
          }}
          className="bg-[#1A0050] border-2 border-[#CCFF00] rounded-2xl p-4 shadow-[0_0_20px_rgba(26,0,80,0.8)]"
        >
          <div className="flex justify-between items-center mb-2">
            <span className="font-['Space_Mono'] text-[11px] text-[#CCFF00] font-extrabold tracking-wider">GRAPH</span>
            <button onClick={() => setShowModal(false)} className="text-white text-xs font-bold hover:text-[#CCFF00]">✕</button>
          </div>
          <div className="text-center font-['Space_Mono'] text-[12px] text-[#CCFF00] font-bold mb-2">
            EMOTION CONFIDENCE: {Math.round(confidenceValue * 100)}%
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <span className="px-3 py-1 rounded-full text-[10px] font-extrabold border uppercase tracking-wider bg-[#FF06EA]/20 border-[#FF06EA] text-[#FF06EA] font-['Pretendard_Variable',sans-serif]">
              {confInfo.label}
            </span>
            <p className="text-[10px] text-[#E0D0FF] text-center font-medium leading-relaxed font-['Pretendard_Variable',sans-serif]">
              {confInfo.description}
            </p>
          </div>
        </div>,
        document.body
      )}

      <div className="flex flex-col items-center justify-center w-full">
        <DraggableChartGroup
          trackId={trackId}
          onDragStart={() => setShowModal(false)}
          blobWidth={310}
          blobHeight={310}
          showModalRef={showModalRef}
        >
          <div className="flex flex-col items-center w-full pt-1" style={{ pointerEvents: "auto" }}>
            <div className="font-['Space_Mono'] text-[13px] text-[#CCFF00] tracking-[0.2em] uppercase font-extrabold mb-0.5 text-center">
              EMOTION LANDSCAPE
            </div>
            <div className="font-['Space_Mono'] text-[10px] text-white tracking-[0.1em] uppercase font-bold mb-1 text-center">
              {(() => {
                const sorted = [...data].sort((a, b) => b.value - a.value);
                const top1 = sorted[0];
                if (!top1 || top1.value === 0) return "NEUTRAL";
                return top1.subject.toUpperCase();
              })()}
            </div>

            <div className="w-[270px] h-[250px] flex items-center justify-center relative -mt-1">
              <RadarChart width={270} height={250} cx="50%" cy="50%" outerRadius={65} data={data}>
                <defs>
                  <linearGradient id="radarGradient" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#FF06EA" />
                    <stop offset="20%" stopColor="#FF5F2A" />
                    <stop offset="40%" stopColor="#BF1111" />
                    <stop offset="60%" stopColor="#6139FF" />
                    <stop offset="80%" stopColor="#BEB729" />
                    <stop offset="100%" stopColor="#34A853" />
                  </linearGradient>
                </defs>
                <PolarGrid gridType="polygon" stroke="rgba(204,255,0,0.22)" strokeWidth={0.8} />
                <PolarAngleAxis dataKey="subject" tick={renderPolarAngleAxisTick} />
                <PolarRadiusAxis domain={radiusDomain} tick={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={false} />
                <Radar
                  name="Emotion"
                  dataKey="value"
                  stroke="url(#radarGradient)"
                  strokeWidth={2}
                  fill="url(#radarGradient)"
                  fillOpacity={0.28}
                  isAnimationActive={false}
                  dot={renderCustomDot(scores)}
                />
              </RadarChart>
            </div>

            <div className="flex justify-center mt-1 mb-1">
              <button
                ref={btnRef}
                onClick={() => {
                  if (!showModal && btnRef.current) {
                    const rect = btnRef.current.getBoundingClientRect();
                    setModalPos({
                      bottom: window.innerHeight - rect.top + 8,
                      left: rect.left + rect.width / 2,
                    });
                  }
                  setShowModal(!showModal);
                }}
                className="px-4 py-1.5 bg-[#CCFF00] text-[#1A0050] font-['Space_Mono'] text-[11px] font-extrabold rounded-full shadow-[0_0_12px_rgba(204,255,0,0.4)] hover:scale-105 transition-transform"
              >
                GRAPH
              </button>
            </div>

            {/* Bottom emotion percentage board */}
            {!hideBoard ? (
              <div className="flex flex-col items-center w-full pt-1" style={{ pointerEvents: "auto" }}>
                {data.map(d => (
                  <div key={d.subject} className="text-[10px] text-white" style={{ marginTop: "2px" }}>
                    {d.subject}: {Math.round(d.value * 100)}%
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-[#CCFF00] font-['Space_Mono'] text-sm mt-2">
                INFO UNAVAILABLE
              </div>
            )}

          </div>
        </DraggableChartGroup>
      </div>
    </div>
  );
}