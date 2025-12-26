export class Shortio {
  private apiURL: string;
  private signature: string;

  constructor(
    apiURL: string = "https://kik.cat/yourls-api.php",
    signature: string,
  ) {
    this.apiURL = apiURL;
    this.signature = signature;
  }

  async sh(longURL: string, keyword?: string): Promise<string> {
    const response = await fetch(this.apiURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: keyword
        ? new URLSearchParams({
            action: "shorturl",
            url: longURL,
            keyword: keyword,
            signature: this.signature,
            format: "json",
          })
        : new URLSearchParams({
            action: "shorturl",
            url: longURL,
            signature: this.signature,
            format: "json",
          }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();
    
    if (json.status && json.status !== 'success') {
      throw new Error(json.message || json.statusCode || 'API Error');
    }
    
    if (!json.shorturl) {
      throw new Error('No shortened URL returned from service');
    }
    
    return json.shorturl;
  }

  async expand(shortURL: string): Promise<string> {
    const response = await fetch(this.apiURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        action: "expand",
        shorturl: shortURL,
        signature: this.signature,
        format: "json",
      }),
    });
    const json = await response.json();
    return json.longurl;
  }

  async getStats(shortURL: string) {
    const response = await fetch(this.apiURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        action: "url-stats",
        shorturl: shortURL,
        signature: this.signature,
        format: "json",
      }),
    });
    const json: unknown = await response.json();
    return json;
  }

  async getTitle(longURL: string): Promise<string> {
    const response = await fetch(longURL);
    const html = await response.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/);
    const title = titleMatch?.[1] ?? "";
    return title;
  }
}
