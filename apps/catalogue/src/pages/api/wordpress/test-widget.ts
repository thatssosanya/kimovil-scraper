import type { NextApiRequest, NextApiResponse } from "next";

// Test page that demonstrates widget API usage
const TEST_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Widget API Test</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f8f9fa;
        }
        .test-section {
            background: white;
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .test-widget {
            border: 2px dashed #ddd;
            padding: 16px;
            margin: 16px 0;
            border-radius: 8px;
            background: #fdfdfd;
        }
        .loading {
            color: #666;
            text-align: center;
            padding: 40px;
        }
        .error {
            color: #dc3545;
            background: #f8d7da;
            padding: 12px;
            border-radius: 4px;
            margin: 10px 0;
        }
        .success {
            color: #155724;
            background: #d4edda;
            padding: 12px;
            border-radius: 4px;
            margin: 10px 0;
        }
        pre {
            background: #f8f9fa;
            padding: 12px;
            border-radius: 4px;
            overflow-x: auto;
            font-size: 12px;
        }
        .api-example {
            background: #e9ecef;
            padding: 16px;
            border-radius: 8px;
            font-family: monospace;
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <h1>Widget API Test Page</h1>
    
    <div class="test-section">
        <h2>API Endpoints</h2>
        <div class="api-example">
            GET /api/wordpress/get-widget?ratingId=YOUR_RATING_ID
        </div>
        <div class="api-example">
            GET /api/wordpress/get-widget?groupId=YOUR_GROUP_ID&type=group
        </div>
        <div class="api-example">
            GET /api/wordpress/widget-styles
        </div>
    </div>

    <div class="test-section">
        <h2>Widget Styles</h2>
        <p>Load widget styles first:</p>
        <div id="styles-test" class="test-widget">
            <div class="loading">Loading styles...</div>
        </div>
    </div>

    <div class="test-section">
        <h2>Test Widget (Rating)</h2>
        <div id="widget-test-rating" class="test-widget">
            <div class="loading">Loading widget...</div>
        </div>
        <div id="rating-response"></div>
    </div>

    <div class="test-section">
        <h2>Test Widget (Group)</h2>
        <div id="widget-test-group" class="test-widget">
            <div class="loading">Loading widget...</div>
        </div>
        <div id="group-response"></div>
    </div>

    <div class="test-section">
        <h2>API Documentation</h2>
        <h3>Parameters:</h3>
        <ul>
            <li><code>ratingId</code> - ID of a specific rating to render</li>
            <li><code>groupId</code> - ID of a rating group (renders first rating)</li>
            <li><code>type</code> - "rating" or "group" (default: "rating")</li>
            <li><code>baseUrl</code> - Base URL for links (optional)</li>
        </ul>
        
        <h3>Response Format:</h3>
        <pre>{
  "success": true,
  "widget": "&lt;div class=\\"cod-widget-container\\"&gt;...&lt;/div&gt;",
  "metadata": {
    "type": "rating",
    "id": "rating-id",
    "name": "Rating Name",
    "deviceCount": 5,
    "generatedAt": "2024-01-01T00:00:00.000Z"
  }
}</pre>
    </div>

    <script>
        // Load widget styles
        async function loadStyles() {
            try {
                const response = await fetch('/api/wordpress/widget-styles');
                const css = await response.text();
                
                const style = document.createElement('style');
                style.textContent = css;
                document.head.appendChild(style);
                
                document.getElementById('styles-test').innerHTML = '<div class="success">✅ Widget styles loaded successfully</div>';
            } catch (error) {
                document.getElementById('styles-test').innerHTML = '<div class="error">❌ Failed to load styles: ' + error.message + '</div>';
            }
        }

        // Test widget API with rating
        async function testRatingWidget() {
            try {
                // Try to get the first available rating
                const response = await fetch('/api/wordpress/get-widget?type=rating&ratingId=test');
                const data = await response.json();
                
                if (data.success) {
                    document.getElementById('widget-test-rating').innerHTML = data.widget;
                    document.getElementById('rating-response').innerHTML = 
                        '<div class="success">✅ Widget loaded successfully</div>' +
                        '<pre>' + JSON.stringify(data.metadata, null, 2) + '</pre>';
                } else {
                    document.getElementById('widget-test-rating').innerHTML = '<div class="error">❌ Failed to load widget</div>';
                    document.getElementById('rating-response').innerHTML = 
                        '<div class="error">Error: ' + data.error + '</div>';
                }
            } catch (error) {
                document.getElementById('widget-test-rating').innerHTML = '<div class="error">❌ Network error</div>';
                document.getElementById('rating-response').innerHTML = 
                    '<div class="error">Network Error: ' + error.message + '</div>';
            }
        }

        // Test widget API with group
        async function testGroupWidget() {
            try {
                const response = await fetch('/api/wordpress/get-widget?type=group&groupId=test');
                const data = await response.json();
                
                if (data.success) {
                    document.getElementById('widget-test-group').innerHTML = data.widget;
                    document.getElementById('group-response').innerHTML = 
                        '<div class="success">✅ Widget loaded successfully</div>' +
                        '<pre>' + JSON.stringify(data.metadata, null, 2) + '</pre>';
                } else {
                    document.getElementById('widget-test-group').innerHTML = '<div class="error">❌ Failed to load widget</div>';
                    document.getElementById('group-response').innerHTML = 
                        '<div class="error">Error: ' + data.error + '</div>';
                }
            } catch (error) {
                document.getElementById('widget-test-group').innerHTML = '<div class="error">❌ Network error</div>';
                document.getElementById('group-response').innerHTML = 
                    '<div class="error">Network Error: ' + error.message + '</div>';
            }
        }

        // Initialize tests
        window.addEventListener('load', () => {
            loadStyles();
            setTimeout(() => {
                testRatingWidget();
                testGroupWidget();
            }, 500);
        });
    </script>
</body>
</html>
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

  // Set appropriate headers for HTML
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  
  // Return test HTML
  res.status(200).send(TEST_HTML);
}