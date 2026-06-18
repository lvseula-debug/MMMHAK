const ITUNES_CACHE_KEY = "mm_itunes_cache";
const LASTFM_CACHE_KEY = "mm_lastfm_cache";
const AI_SCORES_CACHE_KEY = "mm_ai_scores_cache";

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

export const getAiScoresCache = (key) => {
  return aiScoresCache[key] || null;
};

export const setAiScoresCache = (key, data) => {
  aiScoresCache[key] = data;
  setLocalCache(AI_SCORES_CACHE_KEY, aiScoresCache);
};
