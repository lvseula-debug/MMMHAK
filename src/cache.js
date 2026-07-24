const ITUNES_CACHE_KEY = "mm_itunes_cache";
const LASTFM_CACHE_KEY = "mm_lastfm_cache";
const AI_SCORES_CACHE_KEY = "mm_ai_scores_cache_v3";

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

const itunesCache = getLocalCache(ITUNES_CACHE_KEY);
const lastfmCache = getLocalCache(LASTFM_CACHE_KEY);
const aiScoresCache = getLocalCache(AI_SCORES_CACHE_KEY);

export const getItunesCache = (key) => {
  return itunesCache[key] || null;
};

export const setItunesCache = (key, data) => {
  itunesCache[key] = data;
  setLocalCache(ITUNES_CACHE_KEY, itunesCache);
};

export const getLastfmCache = (key) => {
  return lastfmCache[key] || null;
};

export const setLastfmCache = (key, data) => {
  lastfmCache[key] = data;
  setLocalCache(LASTFM_CACHE_KEY, lastfmCache);
};

export const isValidAiScores = (aiScores) => {
  if (!aiScores || typeof aiScores !== "object") return false;
  const requiredKeys = ["Uplifting", "Energetic", "Aggressive", "Melancholic", "Desolation", "Serenity"];
  return requiredKeys.every(key => aiScores[key] !== undefined && aiScores[key] !== null);
};

export const getAiScoresCache = (key) => {
  const item = aiScoresCache[key];
  if (!item) return null;
  if (item.aiScores && !isValidAiScores(item.aiScores)) {
    delete aiScoresCache[key];
    setLocalCache(AI_SCORES_CACHE_KEY, aiScoresCache);
    return null;
  }
  return item;
};

export const setAiScoresCache = (key, data) => {
  if (data && data.aiScores && !isValidAiScores(data.aiScores)) {
    return;
  }
  aiScoresCache[key] = data;
  setLocalCache(AI_SCORES_CACHE_KEY, aiScoresCache);
};

