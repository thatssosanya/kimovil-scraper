import React from 'react';
import { CacheIcon } from './Icons';
import { CopyButton } from './CopyButton';

interface GeneratedLinkProps {
  title: string;
  icon: React.ReactNode;
  link: string;
  linkLong?: string;
  field: string;
  onCopy: (text: string, field: string) => void;
  isCopied: (field: string) => boolean;
  isCached?: boolean;
  color?: 'blue' | 'orange' | 'green';
}

export const GeneratedLink: React.FC<GeneratedLinkProps> = ({
  title,
  icon,
  link,
  linkLong,
  field,
  onCopy,
  isCopied,
  isCached = false,
  color = 'blue'
}) => {
  const copied = isCopied(field);
  const colorClasses = {
    blue: {
      icon: 'text-blue-500',
      cache: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
      input: copied ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-600',
      focus: 'focus:border-blue-500 focus:ring-blue-500'
    },
    orange: {
      icon: 'text-orange-500',
      cache: 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300',
      input: copied ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-600',
      focus: 'focus:border-orange-500 focus:ring-orange-500'
    },
    green: {
      icon: 'text-green-500',
      cache: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
      input: copied ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-600',
      focus: 'focus:border-green-500 focus:ring-green-500'
    }
  };

  const colors = colorClasses[color];

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm hover:shadow transition-all duration-200">
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center">
        <h2 className="text-sm font-medium flex items-center gap-1.5">
          <span className={colors.icon}>{icon}</span>
          {title}
        </h2>
        {isCached && (
          <span
            className={`text-xs ${colors.cache} px-2 py-0.5 rounded-full flex items-center gap-1`}
            title="Загружено из кэша"
          >
            <CacheIcon /> Кэш
          </span>
        )}
      </div>
      <div className="p-3 space-y-2">
        <div className="flex items-center">
          <div className="relative flex-1">
            <input
              type="text"
              readOnly
              onClick={(e) => e.currentTarget.select()}
              value={link}
              className={`block w-full bg-gray-50 dark:bg-gray-700 border ${colors.focus} text-sm font-mono py-2 px-3 rounded-md transition-all duration-200 ${colors.input} focus:ring-1`}
              aria-label={`${title} короткая ссылка`}
            />
          </div>
          <CopyButton
            text={link}
            field={field}
            onCopy={onCopy}
            isCopied={isCopied}
            label={`Копировать ${title.toLowerCase()}`}
          />
        </div>
        {linkLong && (
          <details className="group">
            <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors select-none list-none flex items-center gap-1">
              <svg 
                className="w-3 h-3 transition-transform group-open:rotate-90" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Показать полную ссылку
            </summary>
            <div className="mt-2 flex items-center">
              <div className="relative flex-1">
                <input
                  type="text"
                  readOnly
                  onClick={(e) => e.currentTarget.select()}
                  value={linkLong}
                  className={`block w-full bg-gray-50 dark:bg-gray-700 border ${colors.focus} text-xs font-mono py-2 px-3 rounded-md transition-all duration-200 ${colors.input} focus:ring-1`}
                  aria-label={`${title} полная ссылка`}
                />
              </div>
              <CopyButton
                text={linkLong}
                field={`${field}Long`}
                onCopy={onCopy}
                isCopied={isCopied}
                label={`Копировать полную ${title.toLowerCase()}`}
              />
            </div>
          </details>
        )}
      </div>
    </div>
  );
};