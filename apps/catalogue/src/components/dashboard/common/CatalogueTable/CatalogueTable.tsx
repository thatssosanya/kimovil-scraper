import React from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/src/components/ui/Tabs";
import { PublicDeviceCard } from "@/src/components/dashboard/device/components/cards";

type WidgetDevice = {
  id: string;
  name: string | null;
  imageUrl: string | null;
  description: string | null;
  links: Array<{
    id: string;
    url: string | null;
    price: number | null;
    marketplace?: {
      id: string;
      name: string | null;
      iconUrl?: string | null;
    } | null;
  }>;
  configs: Array<{
    config: {
      id: string;
      name: string | null;
      capacity?: string | null;
      ram?: string | null;
    };
  }>;
  ratingPositions: Array<{ position: number }>;
};

type CatalogueTableProps = {
  widgets: Array<{
    id: string;
    name: string | null;
    widgetTypeId: string | null;
    devices: Array<{
      device: WidgetDevice;
    }>;
  }>;
};

const widgetIconDict: { [key: string]: JSX.Element } = {
  Apple: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1024 1024"
      className="h-4 fill-current"
    >
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z" />
    </svg>
  ),
  Телевизоры: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5 fill-current"
      fill="#000000"
      viewBox="0 0 256 256"
    >
      <path d="M208,40H48A24,24,0,0,0,24,64V176a24,24,0,0,0,24,24H208a24,24,0,0,0,24-24V64A24,24,0,0,0,208,40Zm8,136a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V64a8,8,0,0,1,8-8H208a8,8,0,0,1,8,8Zm-48,48a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,224Zm-3.56-110.66-48-32A8,8,0,0,0,104,88v64a8,8,0,0,0,12.44,6.66l48-32a8,8,0,0,0,0-13.32ZM120,137.05V103l25.58,17Z"></path>
    </svg>
  ),
  "Ноутбуки и ПК": (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5 fill-current"
      fill="#000000"
      viewBox="0 0 256 256"
    >
      <path d="M232,168h-8V72a24,24,0,0,0-24-24H56A24,24,0,0,0,32,72v96H24a8,8,0,0,0-8,8v16a24,24,0,0,0,24,24H216a24,24,0,0,0,24-24V176A8,8,0,0,0,232,168ZM48,72a8,8,0,0,1,8-8H200a8,8,0,0,1,8,8v96H48ZM224,192a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8v-8H224ZM152,88a8,8,0,0,1-8,8H112a8,8,0,0,1,0-16h32A8,8,0,0,1,152,88Z"></path>
    </svg>
  ),
  Смартфоны: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5 fill-current"
      fill="#000000"
      viewBox="0 0 256 256"
    >
      <path d="M176,16H80A24,24,0,0,0,56,40V216a24,24,0,0,0,24,24h96a24,24,0,0,0,24-24V40A24,24,0,0,0,176,16ZM72,64H184V192H72Zm8-32h96a8,8,0,0,1,8,8v8H72V40A8,8,0,0,1,80,32Zm96,192H80a8,8,0,0,1-8-8v-8H184v8A8,8,0,0,1,176,224Z"></path>
    </svg>
  ),
  Консоли: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5 fill-current"
      fill="#000000"
      viewBox="0 0 256 256"
    >
      <path d="M176,112H152a8,8,0,0,1,0-16h24a8,8,0,0,1,0,16ZM104,96H96V88a8,8,0,0,0-16,0v8H72a8,8,0,0,0,0,16h8v8a8,8,0,0,0,16,0v-8h8a8,8,0,0,0,0-16ZM241.48,200.65a36,36,0,0,1-54.94,4.81c-.12-.12-.24-.24-.35-.37L146.48,160h-37L69.81,205.09l-.35.37A36.08,36.08,0,0,1,44,216,36,36,0,0,1,8.56,173.75a.68.68,0,0,1,0-.14L24.93,89.52A59.88,59.88,0,0,1,83.89,40H172a60.08,60.08,0,0,1,59,49.25c0,.06,0,.12,0,.18l16.37,84.17a.68.68,0,0,1,0,.14A35.74,35.74,0,0,1,241.48,200.65ZM172,144a44,44,0,0,0,0-88H83.89A43.9,43.9,0,0,0,40.68,92.37l0,.13L24.3,176.59A20,20,0,0,0,58,194.3l41.92-47.59a8,8,0,0,1,6-2.71Zm59.7,32.59-8.74-45A60,60,0,0,1,172,160h-4.2L198,194.31a20.09,20.09,0,0,0,17.46,5.39,20,20,0,0,0,16.23-23.11Z"></path>
    </svg>
  ),
};

export const CatalogueTable = ({ widgets = [] }: CatalogueTableProps) => {
  return (
    <div className=" mx-auto flex w-full max-w-7xl flex-col items-center justify-center px-2 ">
      <div className="sr-only text-2xl font-bold lg:text-3xl">Каталог</div>
      <Tabs
        defaultValue={(widgets[0] && widgets[0].id) || ""}
        className="w-full items-center  justify-center "
      >
        <TabsList className=" scrollbar w-full items-center justify-start overflow-auto bg-transparent px-1 pt-2 ">
          {widgets.map((widget) => (
            <TabsTrigger
              className="flex flex-shrink-0 gap-1 py-2 font-medium text-zinc-300"
              key={widget.id}
              value={widget.id}
            >
              <div>{widget.name && widgetIconDict[widget.name]}</div>
              <div>{widget.name}</div>
            </TabsTrigger>
          ))}
          <div className="ml-auto text-xs font-medium text-zinc-600">
            Собрали для вас лучшие предложения
          </div>
        </TabsList>
        {/* <TabsContent className="bg-white" value="apple">
          <div className="w-full text-sm ">
            <div className="text-center ">
              <h2 className="text-2xl font-medium text-black">iPhone</h2>
              <div className="grid w-full gap-2 rounded p-2 text-left sm:grid-cols-2 md:grid-cols-3">
                <PublicDeviceCard
                  title="iPhone SE 2022"
                  imgUrl={iphoneSE}
                  configs={{
                    "64": { capacity: "64 ГБ", price: "32283" },
                    "128": { capacity: "128 ГБ", price: "38686" },
                  }}
                />
                <PublicDeviceCard
                  title="iPhone 12"
                  imgUrl={iphone12}
                  configs={{
                    "64": { capacity: "64 ГБ", price: "46488" },
                    "128": { capacity: "128 ГБ", price: "80751" },
                    "256": { capacity: "256 ГБ", price: "93119" },
                  }}
                />
                <PublicDeviceCard
                  title="iPhone 13 mini"
                  imgUrl={iphone13m}
                  configs={{
                    "128": { capacity: "128 ГБ", price: "53190" },
                    "256": {
                      capacity: "256 ГБ",
                      price: "60990",
                      joomPrice: "58499",
                    },
                    "512": { capacity: "512 ГБ", price: "79900" },
                  }}
                />
                <PublicDeviceCard
                  title="iPhone 13"
                  imgUrl={iphone13}
                  configs={{
                    "128": { capacity: "128 ГБ", price: "54490" },
                    "256": {
                      capacity: "256 ГБ",
                      price: "69568",
                      joomPrice: "70449",
                    },
                    "512": { capacity: "512 ГБ", price: "78006" },
                  }}
                />
                <PublicDeviceCard
                  title="iPhone 13 Pro Max"
                  imgUrl={iphone13pm}
                  configs={{
                    "128": { capacity: "128 ГБ", price: "89990" },
                    "256": { capacity: "256 ГБ", price: "109490" },
                    "512": { capacity: "512 ГБ", price: "120490" },
                  }}
                />
                <PublicDeviceCard
                  title="iPhone 14"
                  imgUrl={iphone14}
                  configs={{
                    "128": { capacity: "128 ГБ", price: "61990" },
                    "256": { capacity: "256 ГБ", price: "71300" },
                    "512": { capacity: "512 ГБ", price: "79900" },
                  }}
                />
                <PublicDeviceCard
                  title="iPhone 14 Plus"
                  imgUrl={iphone14plus}
                  configs={{
                    "128": { capacity: "128 ГБ", price: "68935" },
                    "256": { capacity: "256 ГБ", price: "74990" },
                    "512": { capacity: "512 ГБ", price: "88449" },
                  }}
                />
                <PublicDeviceCard
                  title="iPhone 14 Pro "
                  imgUrl={iphone14p}
                  configs={{
                    "128": { capacity: "128 ГБ", price: "85300" },
                    "256": { capacity: "256 ГБ", price: "92700" },
                    "512": { capacity: "512 ГБ", price: "115628" },
                  }}
                />
                <PublicDeviceCard
                  title="iPhone 14 Pro Max"
                  imgUrl={iphone14pm}
                  configs={{
                    "128": { capacity: "128 ГБ", price: "90890" },
                    "256": { capacity: "256 ГБ", price: "96990" },
                    "512": { capacity: "512 ГБ", price: "114990" },
                  }}
                />
              </div>
            </div>
            <div className="mt-2 hidden text-center ">
              <h2 className="text-xl font-medium text-black">MacBook</h2>
            </div>
          </div>
        </TabsContent> */}
        {widgets.map((widget) => (
          <TabsContent key={widget.id} value={widget.id}>
            <div className="w-full text-sm ">
              <div className="text-center ">
                <div className="grid w-full gap-2 rounded p-1 text-left sm:grid-cols-2 md:grid-cols-3">
                  {widget.devices
                    .filter((el) => el.device.links.length > 0)
                    .map((deviceWrapper, i) => (
                      <PublicDeviceCard
                        key={deviceWrapper.device.id}
                        index={i + 1}
                        device={deviceWrapper.device}
                      />
                    ))}
                </div>
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};
