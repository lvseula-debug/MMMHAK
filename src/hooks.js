import { useState, useEffect, useRef, useCallback } from "react";
import {
  getItunesCache,
  setItunesCache,
  getLastfmCache,
  setLastfmCache,
  getAiScoresCache,
  setAiScoresCache
} from "./cache";

const MUSIC_PLACEHOLDER = "/default_album_art.png";
const LASTFM_API_KEY = "8031c3fd85fae84e3a1970b02e22a231";
const LASTFM_BASE = "https://ws.audioscrobbler.com/2.0";

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

export const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  const hostname = window.location.hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://127.0.0.1:8000";
  }
  return `http://${hostname}:8000`;
};

export function normalizeEmotionScores(rawSpread, source, streams) {
  const contagion = Math.log10(Math.max(streams, 10)) / Math.log10(3000000000);

  // Normalize each emotion value to be strictly between 0 and 1
  const spread = {
    happy: Math.min(Math.max(Number(rawSpread.happy) || 0, 0), 1.0),
    sad: Math.min(Math.max(Number(rawSpread.sad) || 0, 0), 1.0),
    angry: Math.min(Math.max(Number(rawSpread.angry) || 0, 0), 1.0),
    love: Math.min(Math.max(Number(rawSpread.love) || 0, 0), 1.0),
    lonely: Math.min(Math.max(Number(rawSpread.lonely) || 0, 0), 1.0),
    confident: Math.min(Math.max(Number(rawSpread.confident) || 0, 0), 1.0),
  };

  const insufficient_data = rawSpread.insufficient_data || false;
  const no_info = rawSpread.no_info || false;

  const viralRisk = Object.values(spread).reduce((sum, v) => sum + v, 0) / 6 * contagion;
  const positive_score = Math.min(spread.happy * 0.4 + spread.love * 0.3 + spread.confident * 0.3, 1.0);
  const negative_score = Math.min(spread.sad * 0.4 + spread.lonely * 0.3 + spread.angry * 0.3, 1.0);
  const polarity = positive_score - negative_score;
  const confidence = Math.abs(polarity);
  const classification = polarity > 0.25 ? "POSITIVE" : polarity < -0.25 ? "NEGATIVE" : "MIXED";

  const primary_emotion = (() => {
    if (insufficient_data || no_info) return "neutral";
    const emos = ["happy", "confident", "angry", "sad", "lonely", "love"];
    let maxVal = -1;
    let top = "happy";
    emos.forEach((emo) => {
      if (spread[emo] > maxVal) {
        maxVal = spread[emo];
        top = emo;
      }
    });
    return top;
  })();

  const valence_group = polarity > 0.0 ? "positive" : "negative";
  const love_theme_score = spread.love;
  const is_love_themed = love_theme_score >= 0.35 && !insufficient_data;

  return {
    ...spread,
    positive_score: parseFloat(positive_score.toFixed(3)),
    negative_score: parseFloat(negative_score.toFixed(3)),
    polarity: parseFloat(polarity.toFixed(3)),
    confidence: parseFloat(confidence.toFixed(3)),
    classification,
    discomfort: parseFloat(((spread.angry * 0.4) + (spread.sad * 0.3) + (spread.lonely * 0.3)).toFixed(3)),
    contagion: parseFloat(contagion.toFixed(3)),
    viralRisk: parseFloat(viralRisk.toFixed(3)),
    streams,
    isAI: source === "ai",
    source,
    primary_emotion,
    valence_group,
    love_theme_score,
    is_love_themed,
    insufficient_data,
    no_info
  };
}

export function computeVirusScores(track) {
  const { mode, valence, energy, loudness, lyrics_sentiment, streams } = track;
  
  if (lyrics_sentiment?.insufficient_data) {
    return normalizeEmotionScores({
      happy: 0.5,
      sad: 0.5,
      angry: 0.5,
      love: 0.5,
      lonely: 0.5,
      confident: 0.5,
      insufficient_data: true
    }, "heuristic", streams);
  }

  const modeFactor = mode === "minor" ? 0.3 : -0.1;
  const loudNorm = Math.min(Math.max((loudness + 20) / 20, 0), 1);

  const rawSpread = {
    happy: (lyrics_sentiment?.happy ?? 0.1) * 0.5 + valence * 0.35,
    sad: (lyrics_sentiment?.sad ?? 0.1) * 0.5 + (1 - valence) * 0.3 + modeFactor * 0.2,
    angry: (lyrics_sentiment?.angry ?? 0.05) * 0.5 + loudNorm * 0.2 + energy * 0.1,
    love: (lyrics_sentiment?.love ?? 0.1) * 0.5 + valence * 0.2 + energy * 0.1,
    lonely: (lyrics_sentiment?.lonely ?? 0.1) * 0.5 + (1 - valence) * 0.3 + (1 - energy) * 0.1,
    confident: (lyrics_sentiment?.confident ?? 0.1) * 0.5 + energy * 0.3 + loudNorm * 0.1,
  };

  return normalizeEmotionScores(rawSpread, "heuristic", streams);
}

export const fetchLyrics = async (title, artist) => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`);
    if (!response.ok) {
      return { lyrics: null, is_lyrics_available: false };
    }
    const data = await response.json();
    return {
      lyrics: data.lyrics || null,
      is_lyrics_available: data.is_lyrics_available ?? (!!data.lyrics)
    };
  } catch (e) {
    console.error(`Lyrics fetch error:`, e);
    return { lyrics: null, is_lyrics_available: false };
  }
};

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

    let results = await fetchWithTerm(`${safeTitle} ${safeArtist}`, country);

    if (results.length === 0) {
      const cleanArtist = safeArtist.split(/[,/&]|\bfeat\b/i)[0].trim();
      results = await fetchWithTerm(`${safeTitle} ${cleanArtist}`, country);
    }

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

    if (!match || !match.previewUrl) {
      const usMatch = await searchSequence("US");
      if (usMatch && usMatch.previewUrl) {
        match = usMatch;
      }
    }

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

          let tags = [];
          let lastfmCover = null;
          const cachedLastfm = getLastfmCache(cacheKey);
          if (cachedLastfm) {
            tags = cachedLastfm.tags;
            lastfmCover = cachedLastfm.cover;
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
                setLastfmCache(cacheKey, { tags, cover: lastfmCover });
              }
            } catch {
              /* ignore */
            }
          }

          if (!lastfmCover && Array.isArray(raw.image) && raw.image.length > 0) {
            const largeImg = raw.image.find(img => img.size === 'extralarge') || raw.image[raw.image.length - 1];
            if (largeImg && largeImg['#text'] && !largeImg['#text'].includes('default_album')) {
              lastfmCover = largeImg['#text'];
            }
          }

          let itunes = getItunesCache(cacheKey);
          if (!itunes || (!itunes.previewUrl && !itunes.hasNoPreview)) {
            itunes = await fetchItunesData(raw.name, artistName);
            if (!itunes.previewUrl) {
              itunes.hasNoPreview = true;
            }
            setItunesCache(cacheKey, itunes);
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

          const insufficient_data = tags.length < 3;
          const lyrics_sentiment = insufficient_data ? {
            happy: 0.5,
            sad: 0.5,
            angry: 0.5,
            love: 0.5,
            lonely: 0.5,
            confident: 0.5,
            insufficient_data: true
          } : {
            happy: Math.max(0.01, parseFloat(((((hasHappy ? 0.5 : 0.1) + valence * 0.3) * modeModifier) * (0.5 + intensity)).toFixed(2))),
            sad: Math.max(0.01, parseFloat((((hasSad ? 0.4 : 0.05) + (1 - valence) * 0.4) * (1.5 - intensity)).toFixed(2))),
            angry: Math.max(0.01, parseFloat((((hasAngry ? 0.4 : 0.05) + (1 - valence) * 0.3) * (0.5 + intensity)).toFixed(2))),
            love: Math.max(0.01, parseFloat(((((hasLove ? 0.5 : 0.1) + valence * 0.2) * modeModifier) * (0.8 + intensity * 0.2)).toFixed(2))),
            lonely: Math.max(0.01, parseFloat((((hasLonely ? 0.4 : 0.1) + (1 - valence) * 0.3) * (1.2 - intensity * 0.2)).toFixed(2))),
            confident: Math.max(0.01, parseFloat((((hasConfident ? 0.4 : 0.1) + valence * 0.2) * (0.5 + intensity)).toFixed(2))),
          };

          const cleanTags = [];
          const rawTags = tags || [];
          for (let t of rawTags) {
            if (!t || typeof t !== 'string') continue;
            const cleanT = t.toLowerCase().trim();
            if (cleanT.includes("bts") || cleanT.includes("아리랑") || cleanT.includes("arirang") || cleanT === "k-pop" || cleanT === "kpop" || cleanT === "korean") {
              continue;
            }
            if (cleanT.includes("r&b") || cleanT.includes("rnb") || cleanT === "r and b" || cleanT === "soul") {
              if (!cleanTags.includes("r&b")) cleanTags.push("r&b");
            } else if (cleanT.includes("hip-hop") || cleanT.includes("hip hop") || cleanT.includes("hiphop") || cleanT.includes("rap")) {
              if (!cleanTags.includes("hip-hop")) cleanTags.push("hip-hop");
            } else if (cleanT.includes("pop")) {
              if (!cleanTags.includes("pop")) cleanTags.push("pop");
            } else if (cleanT.includes("ballad")) {
              if (!cleanTags.includes("ballad")) cleanTags.push("ballad");
            } else if (cleanT.includes("indie")) {
              if (!cleanTags.includes("indie")) cleanTags.push("indie");
            } else if (cleanT.includes("rock") || cleanT.includes("metal") || cleanT.includes("punk") || cleanT.includes("grunge")) {
              if (!cleanTags.includes("rock")) cleanTags.push("rock");
            } else if (cleanT.includes("electronic") || cleanT.includes("electro") || cleanT.includes("house") || cleanT.includes("techno") || cleanT.includes("edm") || cleanT.includes("synth")) {
              if (!cleanTags.includes("electronic")) cleanTags.push("electronic");
            } else if (cleanT.includes("dance") || cleanT.includes("disco")) {
              if (!cleanTags.includes("dance")) cleanTags.push("dance");
            }
          }
          const finalTags = cleanTags.length > 0 ? cleanTags : ["pop", "r&b"];

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
            tags: finalTags,
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

export function useTrackCatalog(onTrackSelect) {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState("CONNECTING LAST.FM API...");
  const requestIdRef = useRef(0);

  const fetchGlobalChart = useCallback(async () => {
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
      if (onTrackSelect && firstItem[0]) {
        onTrackSelect(firstItem[0]);
      }
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
      const mock = MOCK_TRACKS.map((t, idx) => ({ ...t, id: t.id + idx, rank: idx, streams: t.streams || 500000000, artworkUrl: null, previewUrl: null }));
      if (mock.length > 0) {
        setTracks(mock);
        if (onTrackSelect && mock[0]) {
          onTrackSelect(mock[0]);
        }
      }
      setLoading(false);
    }
  }, [onTrackSelect]);

  const search = useCallback(async (query) => {
    if (!query.trim()) return;
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
      if (onTrackSelect && firstItem[0]) {
        onTrackSelect(firstItem[0]);
      }
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
  }, [onTrackSelect]);

  const updateTrackData = useCallback((trackId, updatedFields) => {
    setTracks(prev =>
      prev.map(t => (t.id === trackId ? { ...t, ...updatedFields } : t))
    );
  }, []);

  return {
    tracks,
    loading,
    loadingStatus,
    search,
    reloadGlobalChart: fetchGlobalChart,
    updateTrackData
  };
}

export function useTrackAnalysis(track, onTrackAnalyzed) {
  const [scores, setScores] = useState(null);
  const [lyrics, setLyrics] = useState("LOADING LYRICS...");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const selectedTrackIdRef = useRef(null);

  const parseBackendScores = (backendData, streams) => {
    const scoresObj = backendData.scores || backendData;
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
        val = scoresObj[k] ?? backendData[k] ?? backendData.emotions?.[k];
        if (val !== undefined) break;
      }
      return Number(val) || 0;
    };

    const rawSpread = {
      happy: getVal('happy'),
      sad: getVal('sad'),
      angry: getVal('angry'),
      love: getVal('love'),
      lonely: getVal('lonely'),
      confident: getVal('confident'),
      insufficient_data: backendData.insufficient_data || backendData.no_info || false,
      no_info: backendData.no_info || false
    };

    return normalizeEmotionScores(rawSpread, "ai", streams);
  };

  useEffect(() => {
    if (!track) {
      setScores(null);
      setLyrics("LOADING LYRICS...");
      setIsAnalyzing(false);
      return;
    }

    selectedTrackIdRef.current = track.id;
    const myTrackId = track.id;
    const cacheKey = `${track.title.toLowerCase().trim()}_${track.artist.toLowerCase().trim()}`;

    if (track.isAI && track.lyrics) {
      setScores(track.aiScores);
      setLyrics(track.lyrics);
      setIsAnalyzing(false);
      return;
    }

    const cachedData = getAiScoresCache(cacheKey);
    if (cachedData && cachedData.lyrics && cachedData.aiScores) {
      setScores(cachedData.aiScores);
      setLyrics(cachedData.lyrics);
      setIsAnalyzing(false);

      if (onTrackAnalyzed) {
        onTrackAnalyzed(track, cachedData.lyrics, cachedData.aiScores);
      }
      return;
    }

    setScores(computeVirusScores(track));
    setLyrics("LOADING LYRICS...");
    setIsAnalyzing(true);

    let isCancelled = false;

    const runAnalysis = async () => {
      try {
        const lyricData = await fetchLyrics(track.title, track.artist);
        if (selectedTrackIdRef.current !== myTrackId || isCancelled) return;

        if (lyricData.is_lyrics_available && lyricData.lyrics) {
          const fetchedLyrics = lyricData.lyrics;
          setLyrics(fetchedLyrics);

          // 1단계: 백엔드에 1차 분석 요청 및 CORS Pre-Flag 조회
          const analyzeRes = await fetch(`${getApiBaseUrl()}/api/analyze`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lyrics: fetchedLyrics,
              title: track.title,
              artist: track.artist,
              bpm: track.bpm
            })
          });

          if (selectedTrackIdRef.current !== myTrackId || isCancelled) return;
          if (!analyzeRes.ok) throw new Error("AI Analysis API error");

          const step1Result = await analyzeRes.json();
          let finalScores = null;

          // 백엔드 캐시가 이미 존재하여 최종 결과가 반환된 경우
          if (step1Result.is_cached) {
            finalScores = parseBackendScores(step1Result, track.streams);
          } else {
            // 캐시 미스인 경우 클라이언트 MIR 피처 연산 실행
            const { previewUrl, useProxy } = step1Result;
            let targetAudioUrl = previewUrl;

            if (targetAudioUrl) {
              if (useProxy) {
                targetAudioUrl = `${getApiBaseUrl()}/api/audio-proxy?url=${encodeURIComponent(previewUrl)}`;
              }

              // Display micro loading state while decoding & running FFT/Spectral Flux (approx. 161ms)
              setLyrics("멜로디 주파수 분석 중...");

              let audioFeatures = { energy: 0.5, spectralCentroid: 2000, dynamicRange: 0.4, vocalRangeEnergy: 0.4 };
              try {
                const audioRes = await fetch(targetAudioUrl);
                if (audioRes.ok) {
                  const arrayBuffer = await audioRes.arrayBuffer();
                  const { analyzeAudioData } = await import("./utils/audioAnalyzer");
                  audioFeatures = await analyzeAudioData(arrayBuffer);
                } else {
                  throw new Error(`Audio fetch failed with status: ${audioRes.status}`);
                }
              } catch (e) {
                console.warn("[hooks] Browser audio analysis failed, using robust fallbacks.", e);
                audioFeatures = { energy: 0.5, spectralCentroid: 2000, dynamicRange: 0.4, vocalRangeEnergy: 0.4 };
              }

              // Restore lyrics view
              setLyrics(fetchedLyrics);

              // 2단계: 추출된 피처를 백엔드 최종 병합 API로 전송 (/api/analyze/merge)
              const mergeRes = await fetch(`${getApiBaseUrl()}/api/analyze/merge`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  lyrics: fetchedLyrics,
                  title: track.title,
                  artist: track.artist,
                  bpm: track.bpm,
                  audio_features: {
                    bpm: track.bpm, // Bound Last.fm metadata BPM directly
                    energy: audioFeatures.energy,
                    spectral_centroid: audioFeatures.spectralCentroid,
                    dynamic_range: audioFeatures.dynamicRange,
                    vocal_range_energy: audioFeatures.vocalRangeEnergy
                  }
                })
              });

              if (selectedTrackIdRef.current !== myTrackId || isCancelled) return;
              if (!mergeRes.ok) throw new Error("AI Merge API error");

              const mergeResult = await mergeRes.json();
              finalScores = parseBackendScores(mergeResult, track.streams);
            } else {
              // 미리보기 URL이 없을 경우 1단계 결과 적용
              finalScores = parseBackendScores(step1Result, track.streams);
            }
          }

          if (selectedTrackIdRef.current !== myTrackId || isCancelled) return;
          setScores(finalScores);
          setIsAnalyzing(false);

          setAiScoresCache(cacheKey, {
            lyrics: fetchedLyrics,
            aiScores: finalScores
          });

          if (onTrackAnalyzed) {
            onTrackAnalyzed(track, fetchedLyrics, finalScores);
          }
        } else {
          setLyrics("가사 정보를 불러올 수 없는 곡입니다.");
          const finalScores = normalizeEmotionScores({
            happy: 0.5,
            sad: 0.5,
            angry: 0.5,
            love: 0.5,
            lonely: 0.5,
            confident: 0.5,
            insufficient_data: true,
            no_info: true
          }, "ai", track.streams);
          setScores(finalScores);
          setIsAnalyzing(false);
        }
      } catch (err) {
        console.error("Analysis fallback:", err);
        if (selectedTrackIdRef.current === myTrackId && !isCancelled) {
          setIsAnalyzing(false);
        }
      }
    };

    runAnalysis();

    return () => {
      isCancelled = true;
    };
  }, [track, onTrackAnalyzed]);

  return { scores, lyrics, isAnalyzing };
}

export function useMoodHistory() {
  const [history, setHistory] = useState([]);

  const addEntry = useCallback((track, emotion) => {
    setHistory((prev) => [
      ...prev,
      {
        id: track.id + "_" + Date.now(),
        title: track.title,
        artist: track.artist,
        emotion: emotion
      }
    ]);
  }, []);

  return { history, addEntry };
}
