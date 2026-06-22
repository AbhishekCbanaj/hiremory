import { ImageResponse } from "next/og";

export const alt = "Hiremory — personalized job outreach on autopilot";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Branded social-share card (shown when a Hiremory link is posted on LinkedIn/X).
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "linear-gradient(135deg, #FFFFFF 0%, #F0F7F3 60%, #E6F2EB 100%)",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "#047857", color: "#fff", fontSize: 40, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>H</div>
          <div style={{ fontSize: 40, fontWeight: 700, color: "#111813" }}>Hiremory</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 68, lineHeight: 1.05, color: "#111813", fontWeight: 700, maxWidth: 980 }}>
            Reach every recruiter with a letter, not a blast.
          </div>
          <div style={{ fontSize: 30, color: "#5B6B62", marginTop: 28, maxWidth: 900, fontFamily: "system-ui, sans-serif" }}>
            Personalized emails from your own inbox · auto follow-ups · resume on a yes.
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, fontSize: 24, color: "#5B6B62", fontFamily: "system-ui, sans-serif" }}>
          <span style={{ background: "#fff", border: "1px solid #E4E9E6", borderRadius: 999, padding: "10px 22px" }}>Sends from your inbox</span>
          <span style={{ background: "#fff", border: "1px solid #E4E9E6", borderRadius: 999, padding: "10px 22px" }}>Spam-safe pacing</span>
          <span style={{ background: "#fff", border: "1px solid #E4E9E6", borderRadius: 999, padding: "10px 22px" }}>AI-personalized</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
