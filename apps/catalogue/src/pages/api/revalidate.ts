import { type NextApiRequest, type NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Check for secret to confirm this is a valid request
  if (req.query.secret !== process.env.REVALIDATION_TOKEN) {
    return res.status(401).json({ message: "Invalid token" });
  }

  try {
    // Get the path from either the path or slug parameter
    const path =
      typeof req.query.path === "string" ? req.query.path : undefined;
    const slug =
      typeof req.query.slug === "string" ? req.query.slug : undefined;

    const pathToRevalidate = path || (slug ? `/devices/${slug}` : undefined);

    if (!pathToRevalidate) {
      return res
        .status(400)
        .json({ message: "Path or slug parameter is required" });
    }

    console.log("Revalidating", pathToRevalidate);
    await res.revalidate(pathToRevalidate);
    return res.json({ revalidated: true, path: pathToRevalidate });
  } catch (error) {
    console.error("Error revalidating:", error);
    return res
      .status(500)
      .json({ message: "Error revalidating", error: String(error) });
  }
}
