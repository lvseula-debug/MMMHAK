import React, { useEffect, useState, useRef } from "react";

const NAVER_CLIENT_ID =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_NAVER_CLIENT_ID) ||
  (typeof process !== "undefined" && process.env?.NAVER_CLIENT_ID) ||
  "d9ZpaQqA7H0qJG_6Ect7";

const STORAGE_KEY = "mmmhak_naver_user";

export default function NaverLogin({ isMobile = false, onUserChange }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const hiddenBtnRef = useRef(null);

  useEffect(() => {
    if (onUserChange) {
      onUserChange(user);
    }
  }, [user, onUserChange]);

  useEffect(() => {
    // 1. Check if window.naver SDK is present
    if (!window.naver || !window.naver.LoginWithNaverId) return;

    const callbackUrl = window.location.origin + window.location.pathname;

    const naverLogin = new window.naver.LoginWithNaverId({
      clientId: NAVER_CLIENT_ID,
      callbackUrl: callbackUrl,
      isPopup: false,
      loginButton: { color: "green", type: 1, height: 36 }
    });

    naverLogin.init();

    // 2. Parse callback token from URL hash if redirected back
    if (window.location.hash.includes("access_token")) {
      naverLogin.getLoginStatus((status) => {
        if (status) {
          const profile = naverLogin.user;
          const userInfo = {
            id: profile.id,
            name: profile.name || profile.nickname || "Naver User",
            nickname: profile.nickname || profile.name || "Music Lover",
            email: profile.email || "",
            profileImage: profile.profile_image || "",
          };

          setUser(userInfo);
          if (onUserChange) onUserChange(userInfo);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(userInfo));
          } catch (e) {
            console.error("Failed to save Naver user to localStorage", e);
          }

          // Clean URL hash after token processing
          window.history.replaceState(null, null, window.location.pathname);
        }
      });
    }
  }, [onUserChange]);

  const handleCustomLogin = () => {
    // Click SDK's hidden anchor button or fallback to manual authorization redirect
    if (hiddenBtnRef.current) {
      const anchor = hiddenBtnRef.current.querySelector("a");
      if (anchor) {
        anchor.click();
        return;
      }
    }

    // Direct Naver OAuth URL fallback
    const callbackUrl = encodeURIComponent(window.location.origin + window.location.pathname);
    const state = Math.random().toString(36).substring(2);
    const authUrl = `https://nid.naver.com/oauth2.0/authorize?response_type=token&client_id=${NAVER_CLIENT_ID}&redirect_uri=${callbackUrl}&state=${state}`;
    window.location.href = authUrl;
  };

  const handleLogout = () => {
    setUser(null);
    if (onUserChange) onUserChange(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error("Failed to remove Naver user", e);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {/* SDK generated hidden login button target */}
      <div id="naverIdLogin" ref={hiddenBtnRef} style={{ display: "none" }} />

      {user ? (
        /* Logged In State */
        <div className="flex items-center gap-2">
          {user.profileImage ? (
            <img
              src={user.profileImage}
              alt={user.nickname}
              style={{
                width: isMobile ? 24 : 28,
                height: isMobile ? 24 : 28,
                borderRadius: "50%",
                border: "1px solid #CCFF00",
                objectFit: "cover",
                boxShadow: "0 0 8px rgba(204,255,0,0.5)",
              }}
            />
          ) : (
            <div
              style={{
                width: isMobile ? 24 : 28,
                height: isMobile ? 24 : 28,
                borderRadius: "50%",
                backgroundColor: "#03C75A",
                color: "#FFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: 12,
                boxShadow: "0 0 8px rgba(3,199,90,0.5)",
              }}
            >
              N
            </div>
          )}
          <span
            style={{
              fontSize: isMobile ? 10 : 12,
              fontWeight: 800,
              color: "#CCFF00",
              fontFamily: "'Space Mono', monospace",
              maxWidth: isMobile ? 70 : 110,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={user.email || user.nickname}
          >
            {user.nickname}
          </span>
          <button
            onClick={handleLogout}
            style={{
              fontSize: isMobile ? 9 : 11,
              padding: isMobile ? "2px 8px" : "4px 10px",
              borderRadius: 20,
              backgroundColor: "#1A0050",
              color: "#FF5F2A",
              fontWeight: 800,
              letterSpacing: "0.05em",
              border: "1px solid #FF5F2A",
              cursor: "pointer",
              fontFamily: "'Space Mono', monospace",
              transition: "transform 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            LOGOUT
          </button>
        </div>
      ) : (
        /* Logged Out State - Custom Naver Login Button */
        <button
          onClick={handleCustomLogin}
          style={{
            fontSize: isMobile ? 10 : 12,
            padding: isMobile ? "4px 10px" : "6px 14px",
            borderRadius: 20,
            backgroundColor: "#03C75A",
            color: "#FFFFFF",
            fontWeight: 800,
            letterSpacing: "0.05em",
            border: "1px solid #03C75A",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontFamily: "'Space Mono', monospace",
            boxShadow: "0 0 10px rgba(3,199,90,0.4)",
            transition: "transform 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          <span
            style={{
              background: "#FFF",
              color: "#03C75A",
              borderRadius: "50%",
              width: 16,
              height: 16,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 900,
            }}
          >
            N
          </span>
          <span>NAVER LOGIN</span>
        </button>
      )}
    </div>
  );
}
