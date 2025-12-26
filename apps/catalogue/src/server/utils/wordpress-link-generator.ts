import { Shortio } from "@/src/server/services/shortio";

const WEBSITE_CLID = 2510955;
const WIDGETS_VID = "widgets";

function addVidParams(url: string): string {
  try {
    const urlObj = new URL(url);
    
    urlObj.searchParams.set("clid", WEBSITE_CLID.toString());
    urlObj.searchParams.set("vid", WIDGETS_VID);
    
    return urlObj.toString();
  } catch (error) {
    throw new Error(
      `Failed to add VID parameters: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export async function generateWordPressLink(
  kikCatUrl: string,
  signature: string
): Promise<string> {
  const shortioClient = new Shortio(undefined, signature);

  try {
    const expandedUrl = await shortioClient.expand(kikCatUrl);
    
    const urlWithVid = addVidParams(expandedUrl);
    
    const newShortUrl = await shortioClient.sh(urlWithVid);
    
    return newShortUrl;
  } catch (error) {
    throw new Error(
      `WordPress link generation failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
