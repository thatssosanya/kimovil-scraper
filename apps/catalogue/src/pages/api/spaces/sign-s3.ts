import { S3, Credentials } from "aws-sdk";
import { type NextApiRequest, type NextApiResponse } from "next";

function getS3Client() {
  const s3Client = new S3({
    signatureVersion: "v4",
    endpoint: "https://fra1.digitaloceanspaces.com",
    region: process.env.AWS_REGION,
    s3ForcePathStyle: false,
    credentials: new Credentials(
      process.env.AWS_KEY || "",
      process.env.AWS_SECRET || ""
    ),
  });
  return s3Client;
}
const expires = 900; // 15 minutes
export default function signS3(req: NextApiRequest, res: NextApiResponse) {
  const s3 = getS3Client();

  if (!req.body && !("filename" in req.body) && typeof req.body !== "object") {
    return res.status(400).send("No filename provided");
  } else if (typeof req.body === "object") {
    const { contentType, filename } = req.body as {
      contentType: string;
      filename: string;
    };
    const Key = `${crypto.randomUUID()}-${filename}`;
    const s3Params = {
      Bucket: `${process.env.AWS_BUCKET || ""}/catalogue`,
      Key,
      ACL: "public-read",
      Expires: expires,
      ContentType: contentType,
    };

    s3.getSignedUrl("putObject", s3Params, (err, url) => {
      if (err) {
        console.log(err);
        return;
      }
      const returnData = {
        url,
        method: "PUT",
      };
      res.write(JSON.stringify(returnData));
      res.end();
    });
    return true;
  }
}
