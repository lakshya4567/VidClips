export default function LandingPage({ onLaunch }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b1120",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "40px",
      }}
    >
      <div>
        <h1 style={{ fontSize: "4rem", marginBottom: "20px" }}>
          Vid<span style={{ color: "#3b82f6" }}>Clips</span>
        </h1>

        <p
          style={{
            fontSize: "1.3rem",
            color: "rgba(255,255,255,.7)",
            marginBottom: "30px",
          }}
        >
          AI Video Intelligence Platform
        </p>

        <button
          onClick={onLaunch}
          style={{
            padding: "14px 30px",
            fontSize: "16px",
            fontWeight: "600",
            color: "white",
            background: "linear-gradient(135deg,#3b82f6,#9333ea)",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          LAUNCH VIDCLIPS
        </button>
      </div>
    </div>
  );
}
