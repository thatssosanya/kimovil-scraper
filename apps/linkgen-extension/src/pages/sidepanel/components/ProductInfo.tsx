import React from 'react';
import { TitleIcon } from './Icons';
import { CopyButton } from './CopyButton';
import { YandexMarketParams, AliExpressParams } from '@src/shared/utils/utils';

interface ProductInfoProps {
  type: 'yandex' | 'aliexpress';
  params: YandexMarketParams | AliExpressParams;
  title: string;
  onCopy: (text: string, field: string) => void;
  isCopied: (field: string) => boolean;
}

export const ProductInfo: React.FC<ProductInfoProps> = ({ 
  type, 
  params, 
  title, 
  onCopy, 
  isCopied 
}) => {
  const productId = type === 'yandex' 
    ? (params as YandexMarketParams).productId 
    : (params as AliExpressParams).productId;

  const sku = type === 'yandex' ? (params as YandexMarketParams).sku : null;
  const storeId = type === 'aliexpress' ? (params as AliExpressParams).storeId : null;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm transition-all duration-200">
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
        <h2 className="text-sm font-medium">
          Товар {type === 'yandex' ? 'Яндекс.Маркет' : 'AliExpress'}
        </h2>
      </div>

      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {productId && (
          <div className="flex items-center">
            <div className="px-4 py-3 w-1/3 font-medium text-sm">
              ID товара
            </div>
            <div className="px-4 py-3 w-2/3 flex items-center justify-between">
              <code className="text-sm font-mono group">
                <span className="group-active:bg-blue-100 dark:group-active:bg-blue-900 transition-colors duration-200">
                  {productId}
                </span>
              </code>
              <CopyButton
                text={productId}
                field="productId"
                onCopy={onCopy}
                isCopied={isCopied}
                label="Копировать ID товара"
              />
            </div>
          </div>
        )}

        {sku && (
          <div className="flex items-center">
            <div className="px-4 py-3 w-1/3 font-medium text-sm">SKU</div>
            <div className="px-4 py-3 w-2/3 flex items-center justify-between">
              <code className="text-sm font-mono group">
                <span className="group-active:bg-blue-100 dark:group-active:bg-blue-900 transition-colors duration-200">
                  {sku}
                </span>
              </code>
              <CopyButton
                text={sku}
                field="sku"
                onCopy={onCopy}
                isCopied={isCopied}
                label="Копировать SKU"
              />
            </div>
          </div>
        )}

        {storeId && (
          <div className="flex items-center">
            <div className="px-4 py-3 w-1/3 font-medium text-sm">
              ID магазина
            </div>
            <div className="px-4 py-3 w-2/3 flex items-center justify-between">
              <code className="text-sm font-mono group">
                <span className="group-active:bg-blue-100 dark:group-active:bg-blue-900 transition-colors duration-200">
                  {storeId}
                </span>
              </code>
              <CopyButton
                text={storeId}
                field="storeId"
                onCopy={onCopy}
                isCopied={isCopied}
                label="Копировать ID магазина"
              />
            </div>
          </div>
        )}

        <div className="flex items-center">
          <div className="px-4 py-3 w-1/3 font-medium text-sm flex items-center gap-1">
            <TitleIcon /> Название
          </div>
          <div className="px-4 py-3 w-2/3 flex items-center justify-between">
            <div className="text-sm line-clamp-2 pr-2 group">
              <span className="group-active:bg-blue-100 dark:group-active:bg-blue-900 transition-colors duration-200">
                {title || "—"}
              </span>
            </div>
            {title && (
              <CopyButton
                text={title}
                field="title"
                onCopy={onCopy}
                isCopied={isCopied}
                label="Копировать название"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};