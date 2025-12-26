export const revalidatePages = async () => {
  try {
    const token = process.env.NEXT_PUBLIC_REVALIDATION_TOKEN;
    if (!token) {
      console.error("Revalidation token not found");
      return;
    }

    const res = await fetch(`/api/revalidate?secret=${token}`, {
      method: "GET",
    });

    if (!res.ok) {
      console.error("Failed to revalidate pages");
    }
  } catch (error) {
    console.error("Error revalidating pages:", error);
  }
};

type RevalidateResponse = {
  revalidated: boolean;
  path: string;
};

export async function revalidateDevicePage(slug: string) {
  try {
    const token = process.env.NEXT_PUBLIC_REVALIDATION_TOKEN;
    if (!token) {
      console.error("Revalidation token is not set");
      return;
    }

    // Determine if we're on the server or client side
    const baseUrl =
      typeof window === "undefined"
        ? process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000" // Server-side
        : ""; // Client-side (relative URL is fine)

    const response = await fetch(
      `${baseUrl}/api/revalidate?secret=${token}&slug=${slug}`,
      { method: "POST" }
    );

    if (!response.ok) {
      throw new Error("Failed to revalidate");
    }

    const data = (await response.json()) as RevalidateResponse;
    return data;
  } catch (error) {
    console.error("Error revalidating:", error);
  }
}
