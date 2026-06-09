// api/get-token.js
export default async function handler(req, res) {
  // 스포티파이 API 키 가져오기 (Vercel 환경변수 또는 로컬 .env)
  const clientId = process.env.VITE_SPOTIFY_CLIENT_ID || process.env.REACT_APP_SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.VITE_SPOTIFY_CLIENT_SECRET || process.env.REACT_APP_SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: '서버에 스포티파이 API 키가 설정되지 않았습니다.' });
  }

  try {
    // 서버(Vercel)에서 스포티파이로 토큰 요청 (CORS 에러 안 남!)
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        // Node.js 환경에서 Base64 인코딩
        Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      },
      body: "grant_type=client_credentials",
    });

    const data = await response.json();
    
    // 성공적으로 받아온 토큰을 우리 앱(프론트엔드)으로 전달
    res.status(200).json(data);
  } catch (error) {
    console.error("Token fetch error:", error);
    res.status(500).json({ error: '토큰을 가져오는 데 실패했습니다.' });
  }
}