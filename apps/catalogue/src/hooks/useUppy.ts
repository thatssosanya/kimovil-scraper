import { useState, useEffect } from "react";
import Uppy from "@uppy/core";
import ImageEditor from "@uppy/image-editor";
import AwsS3 from "@uppy/aws-s3";
import Russian from "@uppy/locales/lib/ru_RU.js";
import { useUppyEvent } from "@uppy/react";
import type { UppyFile } from "@uppy/core";

type UppyMeta = Record<string, unknown>;
type UppyBody = Record<string, unknown>;

interface UseUppyProps {
  onUploadSuccess?: (url: string) => void;
}

export const useUppy = ({ onUploadSuccess }: UseUppyProps = {}) => {
  const [uppy] = useState(() =>
    new Uppy<UppyMeta, UppyBody>({
      restrictions: {
        maxFileSize: 1000000,
        maxNumberOfFiles: 1,
        minNumberOfFiles: 1,
        allowedFileTypes: ["image/*"],
      },
      locale: Russian,
    })
      .use(ImageEditor, {
        id: "ImageEditor",
        cropperOptions: {
          croppedCanvasOptions: {
            fillColor: "transparent",
          },
          initialAspectRatio: 2 / 3,
          aspectRatio: 2 / 3,
        },
        quality: 0.8,
      })
      .use(AwsS3, {
        shouldUseMultipart: false,
        getUploadParameters(file: UppyFile<UppyMeta, UppyBody>) {
          return fetch("/api/spaces/sign-s3", {
            method: "POST",
            headers: {
              accept: "application/json",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              filename: file.name || "file",
              contentType: file.type || "application/octet-stream",
            }),
          }).then(async (response) => {
            if (!response.ok)
              throw new Error("Unsuccessful request", { cause: response });

            const data = (await response.json()) as {
              method: "PUT";
              url: string;
            };

            return {
              method: data.method,
              url: data.url,
              fields: {},
              headers: {
                "x-amz-acl": "public-read",
                "Content-Type": file.type || "application/octet-stream",
              },
            };
          });
        },
      })
  );

  useUppyEvent(uppy, "upload-success", (_file, response) => {
    if (response.uploadURL && onUploadSuccess) {
      // Rewrite storage URL to CDN URL
      const cdnUrl = response.uploadURL.replace(
        /https:\/\/storage\.yandexcloud\.net\/cod-devices-images/,
        "https://cdn.click-or-die.ru"
      );
      onUploadSuccess(cdnUrl);
    }
  });

  useEffect(() => {
    return () => {
      uppy.cancelAll();
      uppy.clear();
    };
  }, [uppy]);

  return uppy;
};
