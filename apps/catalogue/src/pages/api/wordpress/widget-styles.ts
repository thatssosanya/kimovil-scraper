import type { NextApiRequest, NextApiResponse } from "next";

// Widget CSS styles that work with our renderToString components
const WIDGET_CSS = `
/* Click or Die Widget Styles */
.cod-widget-container {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
  max-width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}

.cod-widget-container * {
  box-sizing: border-box;
}

.cod-ratings-widget {
  max-width: 100%;
  width: 100%;
}

/* Device card styles */
.cod-widget-container a {
  text-decoration: none;
  color: inherit;
  display: block;
}

.cod-widget-container a:hover {
  text-decoration: none;
}

/* Responsive grid */
.cod-widget-container > div:last-child {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 8px 0;
  scrollbar-width: thin;
  scrollbar-color: #cbd5e0 #f7fafc;
}

.cod-widget-container > div:last-child::-webkit-scrollbar {
  height: 6px;
}

.cod-widget-container > div:last-child::-webkit-scrollbar-track {
  background: #f7fafc;
  border-radius: 3px;
}

.cod-widget-container > div:last-child::-webkit-scrollbar-thumb {
  background: #cbd5e0;
  border-radius: 3px;
}

.cod-widget-container > div:last-child::-webkit-scrollbar-thumb:hover {
  background: #a0aec0;
}

/* Footer styling */
.cod-widget-footer {
  font-size: 10px !important;
  color: #666 !important;
  margin-top: 8px !important;
  text-align: center !important;
  opacity: 0.7;
}

.cod-widget-footer a {
  color: #666 !important;
  text-decoration: none !important;
}

.cod-widget-footer a:hover {
  text-decoration: underline !important;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .cod-widget-container {
    padding: 0 4px;
  }
  
  .cod-widget-container > div:last-child {
    gap: 6px;
    padding: 6px 0;
  }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .cod-widget-footer {
    color: #a0a0a0 !important;
  }
  
  .cod-widget-footer a {
    color: #a0a0a0 !important;
  }
}
`.trim();

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET requests
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed. Use GET request.",
    });
  }

  // Set appropriate headers for CSS
  res.setHeader("Content-Type", "text/css; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400"); // Cache for 24 hours
  
  // Return CSS
  res.status(200).send(WIDGET_CSS);
}