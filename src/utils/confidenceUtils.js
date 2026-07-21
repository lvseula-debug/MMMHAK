// src/utils/confidenceUtils.js

/**
 * Maps emotion confidence scores (0.0 to 1.0) to user-friendly Korean mixed vibe labels.
 * 
 * @param {number} confidence - The confidence value between 0.0 and 1.0
 * @returns {{ label: string, description: string, level: string }}
 */
export function getConfidenceLabel(confidence) {
  const pct = Math.round((confidence ?? 0) * 100);
  if (pct <= 5) {
    return {
      label: "마음이 뒤엉켜 있는 중",
      description: "여러 감정이 한꺼번에 몰아쳐서, 지금은 뭐라 한마디로 정리하기 어려운 상태예요.",
      level: "extreme_mixed"
    };
  }
  if (pct <= 10) {
    return {
      label: "두 마음이 부딪히는 중",
      description: "정반대의 감정 두 개가 서로 밀고 당기며 계속 부딪히고 있어요.",
      level: "complex_crossover"
    };
  }
  if (pct <= 15) {
    return {
      label: "속마음이 겉과 다른 감정",
      description: "겉으로 드러나는 분위기 밑에, 눈치채기 힘든 다른 마음이 조용히 깔려 있어요.",
      level: "layered_subtle"
    };
  }
  if (pct <= 20) {
    return {
      label: "잔잔하게 스며든 감정",
      description: "주된 감정은 분명한데, 그 옆에 옅게 번진 다른 느낌도 함께 있어요.",
      level: "coexisting_nuance"
    };
  }
  return {
    label: "뚜렷한 하나의 감정",
    description: "하나의 감정이 곡 전체 분위기를 확실히 이끌고 있어요.",
    level: "clear_dominant"
  };
}
