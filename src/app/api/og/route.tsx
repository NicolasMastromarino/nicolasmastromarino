import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title")?.slice(0, 90) ?? "Nicolás Mastromarino";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          backgroundColor: "#f5f6f1",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "14px",
              height: "14px",
              borderRadius: "999px",
              backgroundColor: "#c42e0a",
              display: "flex",
            }}
          />
          <div style={{ fontSize: "28px", fontWeight: 800, color: "#12141c" }}>
            Nicolás.M
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: "64px",
            fontWeight: 800,
            lineHeight: 1.15,
            color: "#12141c",
            maxWidth: "980px",
          }}
        >
          {title}
        </div>

        <div style={{ display: "flex", fontSize: "26px", color: "#525662" }}>
          CRM implementation, management & marketing automation
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
