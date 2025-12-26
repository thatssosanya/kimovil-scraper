import React, { useState } from "react";
import Layout from "@/src/components/dashboard/layout/Layout";
import { TwoColumns } from "@/src/components/dashboard/layout";
import { api } from "@/src/utils/api";
import { AddWidgetDialogue } from "@/src/components/dashboard/device/dialogs/AddWidgetDialogue";
import { isSelected } from "@/src/utils/utils";
import { pluralize, PLURALS } from "@/src/utils/pluralize";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/Select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/Card";
import { Separator } from "@/src/components/ui/Separator";
import { Button } from "@/src/components/ui/Button";

import type { 
  Widget, 
  WidgetType,
  Device, 
  Config, 
  Link, 
  Marketplace, 
  RatingPosition, 
  CategoryToWidget, 
  Category, 
  TagToWidget, 
  Tag 
} from "@/src/server/db/schema";

export type WidgetWithRelations = Widget & {
  type?: WidgetType | null;
  devices: Array<Device & {
    configs: Array<{
      config: Config | null;
    }>;
    links: Array<Link & {
      marketplace: Marketplace | null;
      config: Config | null;
    }>;
    ratingPositions: RatingPosition[];
  }>;
  categories: Array<CategoryToWidget & {
    category: Category;
  }>;
  tags: Array<TagToWidget & {
    tag: Tag;
  }>;
};

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch (_err) {
    // Fallback for older browsers
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
  }
};

const Widgets = () => {
  const { data: widgets } = api.widget.getAllWidgets.useQuery();
  const { data: ratings } = api.rating.getAllRatingsAdmin.useQuery({});
  const [selectedWidget, setSelectedWidget] = useState<WidgetWithRelations>();
  const [selectedRatingId, setSelectedRatingId] = useState<string>("");
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [apiResponse, setApiResponse] = useState<string>("");
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Generate the actual widget API URL
  const apiUrl = selectedRatingId
    ? `/api/wordpress/get-widget?ratingId=${selectedRatingId}`
    : null;

  // Fetch API response when rating changes
  React.useEffect(() => {
    if (!apiUrl) {
      setApiResponse("");
      setResponseTime(null);
      return;
    }

    const fetchApiResponse = async () => {
      setIsLoading(true);
      const startTime = performance.now();

      try {
        const response = await fetch(apiUrl);
        const html = await response.text();
        const endTime = performance.now();

        setApiResponse(html);
        setResponseTime(Math.round(endTime - startTime));
      } catch (error) {
        console.error("Failed to fetch API response:", error);
        setApiResponse("Error loading widget");
        setResponseTime(null);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchApiResponse();
  }, [apiUrl]);

  // Generate iframe code for copying
  const iframeCode = selectedRatingId
    ? `<!-- Rating Widget -->\n<iframe src="${
        typeof window !== "undefined"
          ? window.location.origin
          : "https://click-or-die.ru"
      }${apiUrl}" \n        width="100%" \n        height="300" \n        frameborder="0" \n        style="border: none; border-radius: 8px;">\n</iframe>`
    : null;

  const handleCopy = async () => {
    if (iframeCode) {
      await copyToClipboard(iframeCode);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  return (
    <Layout>
      <TwoColumns>
        <div className="">
          {widgets?.map((el) => (
            <div
              onClick={() => setSelectedWidget(el)}
              className={`${
                isSelected(el, selectedWidget)
                  ? "bg-zinc-100"
                  : " bg-white hover:bg-zinc-50"
              } flex w-full cursor-pointer flex-col gap-1 border-b px-4 py-2 transition `}
              key={el.id}
            >
              <div>{el.name}</div>
              <div className="text-xs text-zinc-600">
                {el.devices.length}{" "}
                {pluralize(el.devices.length, PLURALS.devices)}
              </div>
            </div>
          ))}
          <AddWidgetDialogue />
        </div>
        <div className="space-y-6 p-4">
          <div className="py-4 text-2xl font-semibold">
            Превью виджета с рейтингами
          </div>

          {/* Rating Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Выберите рейтинг</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedRatingId}
                onValueChange={setSelectedRatingId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите рейтинг для превью" />
                </SelectTrigger>
                <SelectContent>
                  {ratings?.map((rating) => (
                    <SelectItem key={rating.id} value={rating.id}>
                      {rating.name} ({rating.devices.length} устройств)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Widget Preview and Template */}
          {selectedRatingId && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  HTML шаблон виджета
                  <div className="flex items-center gap-2">
                    {responseTime && (
                      <span className="text-sm text-gray-500">
                        {responseTime}ms
                      </span>
                    )}
                    <Button
                      onClick={() => void handleCopy()}
                      variant={copySuccess ? "default" : "outline"}
                      size="sm"
                    >
                      {copySuccess ? "✓ Скопировано" : "Копировать"}
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-gray-600">
                  API URL:{" "}
                  <code className="rounded bg-gray-100 px-2 py-1 text-xs">
                    {apiUrl}
                  </code>
                </div>
                <Separator />

                {/* Live Preview */}
                <div className="rounded-lg border bg-white p-4">
                  <h4 className="mb-3 text-sm font-medium">
                    Превью API ответа:
                    {isLoading && (
                      <span className="ml-2 text-xs text-gray-500">
                        Загрузка...
                      </span>
                    )}
                  </h4>
                  {isLoading ? (
                    <div className="flex h-32 items-center justify-center">
                      <div className="text-gray-500">Загрузка виджета...</div>
                    </div>
                  ) : (
                    <div dangerouslySetInnerHTML={{ __html: apiResponse }} />
                  )}
                </div>

                <Separator />

                {/* HTML Code */}
                <div>
                  <h4 className="mb-2 text-sm font-medium">
                    HTML код API ответа:
                    {apiResponse && (
                      <Button
                        onClick={() => void copyToClipboard(apiResponse)}
                        variant="ghost"
                        size="sm"
                        className="ml-2"
                      >
                        Копировать HTML
                      </Button>
                    )}
                  </h4>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-100 p-4 text-xs">
                    {apiResponse || "Выберите рейтинг для получения HTML"}
                  </pre>
                </div>

                <Separator />

                {/* iframe Code */}
                <div>
                  <h4 className="mb-2 text-sm font-medium">
                    iframe код для вставки:
                  </h4>
                  <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-100 p-4 text-xs">
                    {iframeCode}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </TwoColumns>
    </Layout>
  );
};

export default Widgets;
