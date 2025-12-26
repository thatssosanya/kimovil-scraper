import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { Eye, Pencil, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { Dashboard } from "@uppy/react";
import { ImageLightbox } from "./ImageLightbox";
import { useUppy } from "@/src/hooks/useUppy";

import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";
import "@uppy/image-editor/dist/style.min.css";

interface EditableImageProps {
  imageUrl: string | null;
  placeholderIcon: LucideIcon;
  size?: number;
  onSave?: (url: string) => void;
  disabled?: boolean;
  alt?: string;
}

export function EditableImage({
  imageUrl,
  placeholderIcon: PlaceholderIcon,
  size = 80,
  onSave,
  disabled = false,
  alt = "Device image",
}: EditableImageProps) {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [hasUppyFiles, setHasUppyFiles] = useState(false);

  const uppy = useUppy({
    onUploadSuccess: useCallback((url: string) => {
      if (onSave) onSave(url);
      setLocalUrl(url);
      setIsEditorOpen(false);
      setHasUppyFiles(false);
    }, [onSave]),
  });

  // Track Uppy state to prevent accidental closing
  useEffect(() => {
    if (!uppy || typeof uppy.on !== 'function') return;

    const handleFileAdded = () => setHasUppyFiles(true);
    const handleFileRemoved = () => {
      try {
        if (uppy && typeof uppy.getFiles === 'function' && uppy.getFiles().length <= 1) {
          setHasUppyFiles(false);
        }
      } catch (error) {
        console.warn('Error checking uppy files:', error);
        setHasUppyFiles(false);
      }
    };
    const handleCancelAll = () => setHasUppyFiles(false);

    uppy.on('file-added', handleFileAdded);
    uppy.on('file-removed', handleFileRemoved);
    uppy.on('cancel-all', handleCancelAll);

    return () => {
      try {
        if (uppy && typeof uppy.off === 'function') {
          uppy.off('file-added', handleFileAdded);
          uppy.off('file-removed', handleFileRemoved);
          uppy.off('cancel-all', handleCancelAll);
        }
      } catch (error) {
        console.warn('Error removing uppy listeners:', error);
      }
    };
  }, [uppy]);

  const handlePreview = useCallback(() => {
    setIsLightboxOpen(true);
  }, []);

  const handleEdit = useCallback(() => {
    setIsEditorOpen(true);
    setHasUppyFiles(false);
  }, []);

  const handleEditorClose = useCallback((open: boolean) => {
    if (!open && hasUppyFiles) {
      // Prevent closing if there are unsaved files
      return;
    }
    setIsEditorOpen(open);
    if (!open) {
      // Clear uppy state when closing
      try {
        if (uppy && typeof uppy.cancelAll === 'function') {
          uppy.cancelAll();
        }
        if (uppy && typeof uppy.clear === 'function') {
          uppy.clear();
        }
      } catch (error) {
        console.warn('Error clearing uppy state:', error);
      }
      setHasUppyFiles(false);
    }
  }, [hasUppyFiles, uppy]);

  const handleForceClose = useCallback(() => {
    try {
      if (uppy && typeof uppy.cancelAll === 'function') {
        uppy.cancelAll();
      }
      if (uppy && typeof uppy.clear === 'function') {
        uppy.clear();
      }
    } catch (error) {
      console.warn('Error clearing uppy state:', error);
    }
    setHasUppyFiles(false);
    setIsEditorOpen(false);
  }, [uppy]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handlePreview();
    } else if (e.key === "Enter" && e.shiftKey && onSave && !disabled) {
      e.preventDefault();
      handleEdit();
    }
  }, [handlePreview, handleEdit, onSave, disabled]);

  const currentImageUrl = localUrl || imageUrl;

  return (
    <>
      <div
        className="group relative shrink-0 overflow-hidden rounded-lg dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        style={{ height: size, width: size }}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => setShowOverlay(true)}
        onMouseLeave={() => setShowOverlay(false)}
        onTouchStart={() => {
          setShowOverlay(true);
          setTimeout(() => setShowOverlay(false), 400);
        }}
      >
        {currentImageUrl ? (
          <Image
            src={currentImageUrl}
            alt={alt}
            fill
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <PlaceholderIcon className="h-8 w-8 dark:text-gray-500" />
          </div>
        )}

        {/* Overlay with action buttons */}
        <div
          className={`absolute inset-0 bg-black/50 flex items-center justify-center gap-2 transition-opacity ${
            showOverlay ? "opacity-100" : "opacity-0"
          }`}
        >
          {/* Preview button */}
          {currentImageUrl && (
            <button
              onClick={handlePreview}
              className="flex items-center justify-center w-8 h-8 bg-white/20 hover:bg-white/30 text-white rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
              aria-label="Просмотр изображения"
              title="Просмотр"
            >
              <Eye className="h-4 w-4" />
            </button>
          )}

          {/* Edit button */}
          {onSave && !disabled && (
            <button
              onClick={handleEdit}
              className="flex items-center justify-center w-8 h-8 bg-white/20 hover:bg-white/30 text-white rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
              aria-label="Редактировать изображение"
              title="Редактировать"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Image Lightbox */}
      {currentImageUrl && (
        <ImageLightbox
          src={currentImageUrl}
          alt={alt}
          isOpen={isLightboxOpen}
          onClose={() => setIsLightboxOpen(false)}
        />
      )}

      {/* Uppy Editor Dialog */}
      <Dialog.Root open={isEditorOpen} onOpenChange={handleEditorClose}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <Dialog.Content 
            className="fixed inset-4 md:inset-8 lg:inset-16 bg-white dark:bg-gray-900 rounded-lg shadow-xl z-50 flex flex-col overflow-hidden focus:outline-none"
            onInteractOutside={(e) => {
              if (hasUppyFiles) {
                e.preventDefault();
              }
            }}
          >
            {/* Header with close button */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Редактирование изображения
              </h2>
              <button
                onClick={handleForceClose}
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Закрыть редактор"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            {/* Uppy Dashboard - full remaining height */}
            <div className="flex-1 overflow-hidden">
              <Dashboard
                uppy={uppy}
                width="100%"
                height="calc(100vh - 12rem)"
                autoOpen="imageEditor"
                proudlyDisplayPoweredByUppy={false}
                theme="dark"
                note="Выберите изображение для загрузки и редактирования"
                showProgressDetails
              />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}