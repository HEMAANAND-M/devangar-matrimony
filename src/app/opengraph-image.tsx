import { ImageResponse } from "next/og";

export const alt = "Devangar Matrimony — trusted matches for the Devanga community";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Branded preview card shown when the site link is shared on WhatsApp, Facebook, etc. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px 96px",
          background: "linear-gradient(135deg, #3f0b1b 0%, #5e1229 55%, #7a1d39 100%)",
          color: "white",
          fontFamily: "serif",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -120,
            top: -120,
            width: 620,
            height: 620,
            borderRadius: 9999,
            border: "2px solid rgba(176,141,87,0.35)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -40,
            top: -40,
            width: 460,
            height: 460,
            borderRadius: 9999,
            border: "1px solid rgba(176,141,87,0.25)",
            display: "flex",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 64, height: 64, borderRadius: 9999, border: "2px solid #b08d57", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ display: "flex" }}>
              <div style={{ width: 26, height: 26, borderRadius: 9999, border: "3px solid #e9dcc3", display: "flex" }} />
              <div style={{ width: 26, height: 26, borderRadius: 9999, border: "3px solid #b08d57", marginLeft: -10, display: "flex" }} />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 40 }}>Devangar</span>
            <span style={{ fontSize: 16, letterSpacing: 8, color: "#e9dcc3", fontFamily: "sans-serif" }}>MATRIMONY</span>
          </div>
        </div>
        <div style={{ fontSize: 76, lineHeight: 1.08, marginTop: 56, maxWidth: 900, display: "flex", flexWrap: "wrap" }}>
          Where Devangar families begin a new chapter
        </div>
        <div style={{ display: "flex", gap: 36, marginTop: 44, fontSize: 24, color: "#e9dcc3", fontFamily: "sans-serif" }}>
          {["OTP-verified", "Every profile reviewed", "Privacy first"].map((t) => (
            <span key={t} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: 9999, background: "#b08d57", display: "flex" }} />
              {t}
            </span>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
