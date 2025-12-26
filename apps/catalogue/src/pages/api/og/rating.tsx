import { loadGoogleFont } from "@/src/lib/utils";
import { ImageResponse } from "@vercel/og";
import type { NextApiRequest, NextApiResponse } from "next";

export const config = {
  runtime: "nodejs",
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const name = Array.isArray(req.query.name)
    ? req.query.name[0]
    : req.query.name || "Rating";
  const description = Array.isArray(req.query.description)
    ? req.query.description[0]
    : req.query.description || "Рейтинги устройств";
  const count = Array.isArray(req.query.count)
    ? req.query.count[0]
    : req.query.count || "0";

  // Ensure we have required strings for TypeScript
  const safeName = name || "Rating";
  const safeDescription = description || "Рейтинги устройств";
  const safeCount = count || "0";

  try {
    const imageResponse = new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#ffffff",
            fontFamily: '"Inter Tight"',
            position: "relative",
            padding: "20px",
          }}
        >
          {/* Logo - top left corner */}
          <div
            style={{
              position: "absolute",
              top: "40px",
              left: "40px",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "4px",
              }}
            >
              <svg
                width="200"
                height="35"
                viewBox="0 0 202.15 35.8"
                fill="currentColor"
                style={{ color: "#FF475A" }}
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M0,0H32.95V35.8H22.4V8.2H10.55V35.8H0Z" />
                <path d="M51.9,0h15.5l11.2,35.8H67.75l-1.7-5.45H53.2l-1.7,5.45H40.65Zm12.1,22.85-4.1-13.9h-.5l-4.1,13.9Z" />
                <path d="M84.6,27.5c4.35,0,6-1.75,6.4-6.8L92.65,0h28.15V35.8H110.25V8.3h-7.65L101.45,21.9c-.75,9.6-6.2,13.9-16.85,13.9Z" />
                <path d="M139.75,0h15.5l11.2,35.8H155.6l-1.7-5.45H141.05l-1.7,5.45H128.5Zm12.1,22.85-4.1-13.9h-.5L143.15,22.85Z" />
                <path d="M191.6,21.55c-1.65,1.85-5.2,3.1-8.5,3.1-7.6,0-13.3-4.9-13.3-12.85V0h10.55V10.25c0,3.9,2.45,6.2,5.75,6.2a6.71,6.71,0,0,0,5.5-3V0H202.15V35.8H191.6Z" />
              </svg>
            </div>
            <div
              style={{
                fontSize: "18px",
                fontWeight: "500",
                color: "#FF475A",
                letterSpacing: "0.5px",
              }}
            >
              Каталог
            </div>
          </div>

          {/* URL - bottom right corner */}
          <div
            style={{
              position: "absolute",
              bottom: "20px",
              right: "20px",
              color: "#9ca3af",
              fontSize: "14px",
              fontWeight: "500",
            }}
          >
            c.click-or-die.ru
          </div>

          {/* Main content area */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              justifyContent: "center",
              width: "100%",
              height: "100%",
              paddingTop: "80px",
              paddingBottom: "60px",
              paddingLeft: "20px",
              paddingRight: "20px",
              maxWidth: "800px",
            }}
          >
            {/* Rating title */}
            <h1
              style={{
                color: "#111827",
                fontSize: safeName.length > 25 ? "46px" : "56px",
                fontWeight: "800",
                margin: "0 0 16px 0",
                lineHeight: "1.05",
                letterSpacing: "-0.025em",
              }}
            >
              {safeName}
            </h1>

            {/* Description */}
            <p
              style={{
                color: "#6b7280",
                fontSize: "24px",
                fontWeight: "400",
                margin: "0 0 32px 0",
                lineHeight: "1.4",
                maxWidth: "700px",
              }}
            >
              {safeDescription.length > 120
                ? safeDescription.substring(0, 120) + "..."
                : safeDescription}
            </p>

            {/* Stats container */}
            <div style={{ gap: 16 }} tw="flex">
              {parseInt(safeCount) > 0 && (
                <div
                  style={{
                    display: "flex",
                    height: "100%",
                    alignItems: "center",
                    backgroundColor: "#f8fafc",
                    padding: "20px 28px",
                    borderRadius: "16px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                    }}
                  >
                    <span
                      className="text-black"
                      style={{
                        fontSize: "36px",
                        fontWeight: "700",
                        lineHeight: "1",
                        marginBottom: "4px",
                      }}
                    >
                      {"> "}
                      {safeCount}
                    </span>
                    <span
                      style={{
                        color: "#64748b",
                        fontSize: "15px",
                        fontWeight: "500",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      лучших устройств
                    </span>
                  </div>
                </div>
              )}

              {/* Rating badge */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  backgroundColor: "#ecfdf5",
                  height: "100%",
                  padding: "12px 20px",
                  borderRadius: "12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "32px",
                      fontWeight: "600",
                      color: "#065f46",
                    }}
                  >
                    Обновляется еженедельно
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom chips */}
          <div
            style={{
              position: "absolute",
              bottom: "20px",
              left: "40px",
              display: "flex",
              gap: "12px",
            }}
          >
            <div
              style={{
                backgroundColor: "#f1f5f9",
                color: "#475569",
                padding: "8px 16px",
                borderRadius: "20px",
                fontSize: "24px",
                fontWeight: "600",
              }}
            >
              Сравнение
            </div>
            <div
              style={{
                backgroundColor: "#f1f5f9",
                color: "#475569",
                padding: "8px 16px",
                borderRadius: "20px",
                fontSize: "24px",
                fontWeight: "600",
              }}
            >
              Лучшие цены
            </div>
            <div
              style={{
                backgroundColor: "#f1f5f9",
                color: "#475569",
                padding: "8px 16px",
                borderRadius: "20px",
                fontSize: "24px",
                fontWeight: "600",
              }}
            >
              Характеристики
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        fonts: [
          {
            name: "Inter Tight",
            data: await loadGoogleFont("Inter Tight", "800"),
            weight: 800,
            style: "normal",
          },
          {
            name: "Inter Tight",
            data: await loadGoogleFont("Inter Tight", "600"),
            weight: 600,
            style: "normal",
          },
          {
            name: "Inter Tight",
            data: await loadGoogleFont("Inter Tight", "500"),
            weight: 500,
            style: "normal",
          },
          {
            name: "Inter Tight",
            data: await loadGoogleFont("Inter Tight", "400"),
            weight: 400,
            style: "normal",
          },
        ],
      }
    );

    // Convert ImageResponse to proper Next.js API response
    const response = await imageResponse.arrayBuffer();
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.send(Buffer.from(response));
  } catch (error) {
    console.error("Error generating rating OG image:", error);
    res.status(500).json({ error: "Failed to generate image" });
  }
}
