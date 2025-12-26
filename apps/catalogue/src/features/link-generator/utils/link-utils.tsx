import { Send } from "lucide-react";
import React from "react";

export interface AliExpressCommissionData {
  url: string;
  product_name: string | null;
  commission_rate: number | null;
  hot_commission_rate: number | null;
  is_hot: boolean;
}

export interface ParsedUrl {
  url: string;
  title?: string;
  params: Record<string, string>;
  protocol: string;
  hostname: string;
  pathname: string;
  hash: string;
  port: string;
  username: string;
  password: string;
  origin: string;
  search: string;
  // AliExpress specific data
  aliExpressCommission?: AliExpressCommissionData;
}

export const PARTNER_CLIDS = {
  telegram: 2913665,
  website: 2510955,
  kick: 11999773,
} as const;

export type PartnerType = "telegram" | "website" | "kick";
export type PartnerClid = (typeof PARTNER_CLIDS)[PartnerType];

export const VID_OPTIONS = [
  { label: "Каталог", value: "catalogue" },
  { label: "Виджеты", value: "widgets" },
  { label: "Кик", value: "kick" },
];

export const HIDDEN_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "do-waremd5",
  "distr_type",
  "cpc",
]);

export function parseUrl(url: string, title?: string): ParsedUrl {
  const urlObject = new URL(url);
  return {
    url,
    title,
    params: extractUrlParams(url),
    protocol: urlObject.protocol.replace(":", ""),
    hostname: urlObject.hostname,
    pathname: urlObject.pathname,
    hash: urlObject.hash,
    port: urlObject.port || "",
    username: urlObject.username,
    password: urlObject.password,
    origin: urlObject.origin,
    search: urlObject.search,
  };
}

export function isYandexMarketUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname === "market.yandex.ru";
  } catch {
    return false;
  }
}

export function isAliExpressUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    return (
      hostname.includes("aliexpress") ||
      hostname.includes("ae01.alicdn.com") ||
      hostname.includes("s.click.aliexpress.com") ||
      hostname.includes("fas.st") // AliExpress short links
    );
  } catch {
    return false;
  }
}

export function identifyLinkType(params: Record<string, string>): {
  label: string;
  color: string;
  bgColor: string;
  icon?: React.ReactNode;
  description?: string;
} {
  const clid = params.clid;
  if (clid === "2913665") {
    return {
      label: "тг @clickordie",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      icon: <Send className="h-3.5 w-3.5" />,
      description: "Реферальная ссылка для Telegram",
    };
  }
  if (clid === "2510955") {
    return {
      label: "Палач",
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      description: "Реферальная ссылка для сайта",
    };
  }
  if (clid === "11999773") {
    return {
      label: "Кик",
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      description: "Реферальная ссылка для Кика",
    };
  }
  return {
    label: "Обычная ссылка",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  };
}

export function highlightUrlParts(url: string): JSX.Element {
  const parts = url.split(/([?&](?:clid|vid|sku)=[^&]+)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.match(/[?&](?:clid|vid|sku)=[^&]+/)) {
          const [param, value] = part.replace(/[?&]/, "").split("=");
          return (
            <span key={i} className="font-medium text-primary">
              {part.startsWith("?") ? "?" : "&"}
              {param}=<span className="font-bold">{value}</span>
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export function extractUrlParams(url: string): Record<string, string> {
  try {
    const urlObject = new URL(url);
    const params: Record<string, string> = {};
    urlObject.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  } catch {
    return {};
  }
}
