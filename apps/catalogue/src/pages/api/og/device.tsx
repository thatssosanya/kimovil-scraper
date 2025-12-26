import { loadGoogleFont } from "@/src/lib/utils";
import { ImageResponse } from "@vercel/og";
import type { NextApiRequest, NextApiResponse } from "next";
import sharp from "sharp";

export const config = {
  runtime: "nodejs",
};

async function processImageUrl(url: string): Promise<string | null> {
  let newImageUrl = null;

  if (url.includes("webp") || url.includes("avif")) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      const imageBuffer = await response.arrayBuffer();
      const pngBuffer = await sharp(Buffer.from(imageBuffer)).png().toBuffer();
      newImageUrl = `data:image/png;base64,${pngBuffer.toString("base64")}`;
    } catch (error) {
      console.error("Error converting image to PNG:", error);
      return null;
    }
  } else {
    // Handle other formats directly
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      const imageBuffer = await response.arrayBuffer();
      const contentType = response.headers.get("content-type") || "image/jpeg";
      const base64 = Buffer.from(imageBuffer).toString("base64");
      newImageUrl = `data:${contentType};base64,${base64}`;
    } catch (error) {
      console.error("Error processing image:", error);
      return null;
    }
  }

  return newImageUrl;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const name = Array.isArray(req.query.name)
    ? req.query.name[0]
    : req.query.name || "Device";
  const description = Array.isArray(req.query.description)
    ? req.query.description[0]
    : req.query.description || "Обзор устройства";
  const imageUrl = Array.isArray(req.query.image)
    ? req.query.image[0]
    : req.query.image;
  const price = Array.isArray(req.query.price)
    ? req.query.price[0]
    : req.query.price;
  const brand = Array.isArray(req.query.brand)
    ? req.query.brand[0]
    : req.query.brand;
  const valueRating = Array.isArray(req.query.valueRating)
    ? req.query.valueRating[0]
    : req.query.valueRating;

  // Construct device title following the same logic as device pages
  const deviceTitle = brand ? `${brand} ${name}` : name;

  // Ensure we have required strings for TypeScript
  const safeDeviceTitle = deviceTitle || "Device";
  const safeDescription = description || "Обзор устройства";

  // Value rating logic matching ValueRating component
  const valueRatingNum = valueRating
    ? Math.max(0, Math.min(100, parseInt(valueRating)))
    : 0;

  const getValueRatingInfo = (value: number) => {
    if (value >= 90)
      return {
        description: "Бомба! Оптимальный вариант",
        bgColor: "#ecfdf5",
        borderColor: "#10b981",
        textColor: "#065f46",
        emoji: "🔥",
      };
    if (value >= 80)
      return {
        description: "Отличная покупка",
        bgColor: "#eff6ff",
        borderColor: "#3b82f6",
        textColor: "#1e40af",
        emoji: "⭐",
      };
    if (value >= 70)
      return {
        description: "Неплохой выбор",
        bgColor: "#eef2ff",
        borderColor: "#6366f1",
        textColor: "#4338ca",
        emoji: "👍",
      };
    if (value >= 60)
      return {
        description: "Можно поискать получше",
        bgColor: "#fef3c7",
        borderColor: "#f59e0b",
        textColor: "#92400e",
        emoji: "⚠️",
      };
    if (value >= 40)
      return {
        description: "Не советуем",
        bgColor: "#fee2e2",
        borderColor: "#ef4444",
        textColor: "#dc2626",
        emoji: "👎",
      };
    return {
      description: "Полный провал",
      bgColor: "#fef2f2",
      borderColor: "#f87171",
      textColor: "#dc2626",
      emoji: "💀",
    };
  };

  const valueRatingInfo = getValueRatingInfo(valueRatingNum);

  // Process image if provided
  let processedImageUrl = null;
  if (imageUrl && typeof imageUrl === "string") {
    processedImageUrl = await processImageUrl(imageUrl);
  }

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
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              height: "100%",
              paddingTop: "80px",
              paddingBottom: "60px",
              paddingLeft: "20px",
              paddingRight: "20px",
            }}
          >
            {/* Left side - content */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                justifyContent: "center",
                flex: imageUrl ? "0 0 60%" : "1",
                paddingRight: imageUrl ? "40px" : "0",
                maxWidth: "600px",
              }}
            >
              {/* Device name */}
              <h1
                style={{
                  color: "#111827",
                  fontSize: safeDeviceTitle.length > 25 ? "42px" : "52px",
                  fontWeight: "800",
                  margin: "0 0 12px 0",
                  lineHeight: "1.05",
                  letterSpacing: "-0.025em",
                }}
              >
                {safeDeviceTitle}
              </h1>

              {/* Description */}
              <p
                style={{
                  color: "#6b7280",
                  fontSize: "24px",
                  fontWeight: "400",
                  margin: "0 0 24px 0",
                  lineHeight: "1.4",
                  maxWidth: "480px",
                }}
              >
                {safeDescription.length > 100
                  ? safeDescription.substring(0, 100) + "..."
                  : safeDescription}
              </p>

              {/* Price - beautiful display */}
              <div style={{ gap: 16, alignItems: "stretch" }} tw="flex">
                {price && (
                  <div
                    tw="bg-zinc-100"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "16px 24px",
                      borderRadius: "16px",
                      height: "100%",
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
                        style={{
                          fontSize: "18px",
                          fontWeight: "500",
                          color: "#64748b",
                          marginBottom: "2px",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        ЦЕНА ОТ
                      </span>
                      <span
                        className="mt-4 text-gray-500"
                        style={{
                          fontSize: "28px",
                          fontWeight: "600",
                          lineHeight: "1",
                        }}
                      >
                        {price} ₽
                      </span>
                    </div>
                  </div>
                )}

                {/* Value Rating */}
                {valueRatingNum > 0 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      backgroundColor: valueRatingInfo.bgColor,
                      padding: "12px 20px",
                      borderRadius: "12px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "48px",
                          height: "48px",
                          backgroundColor: "white",
                          borderRadius: "50%",
                          fontSize: "24px",
                          fontWeight: "700",
                          color: valueRatingInfo.textColor,
                        }}
                      >
                        {valueRatingNum}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-start",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "24px",
                            fontWeight: "600",
                            color: valueRatingInfo.textColor,
                            lineHeight: "1.2",
                          }}
                        >
                          {valueRatingInfo.description}
                        </span>
                        <span
                          style={{
                            fontSize: "18px",
                            fontWeight: "500",
                            color: valueRatingInfo.textColor,
                            opacity: 0.8,
                          }}
                        >
                          Индекс цена/качество
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right side - device image */}
            {imageUrl && (
              <div
                style={{
                  flex: "0 0 350px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "450px",
                }}
              >
                {processedImageUrl ? (
                  <img
                    src={processedImageUrl}
                    alt={safeDeviceTitle}
                    style={{
                      width: "320px",
                      height: "420px",
                      objectFit: "contain",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      color: "#9ca3af",
                      width: "320px",
                      height: "420px",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "80px",
                        marginBottom: "16px",
                      }}
                    >
                      📱
                    </div>
                    <div
                      style={{
                        fontSize: "18px",
                        fontWeight: "500",
                        textAlign: "center",
                      }}
                    >
                      {safeDeviceTitle.split(" ")[0] || "Device"}
                    </div>
                  </div>
                )}
              </div>
            )}
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
              Характеристики
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
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        fonts: [
          {
            name: "Inter Tight",
            data: await loadGoogleFont("Inter Tight", "900"),
            weight: 900,
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
    console.error("Error generating OG image:", error);
    res.status(500).json({ error: "Failed to generate image" });
  }
}
