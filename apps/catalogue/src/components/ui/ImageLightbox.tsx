import * as Dialog from "@radix-ui/react-dialog";
import { X, ZoomIn, ZoomOut, GripVertical } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLightboxControls } from "../../hooks/useLightboxControls";
import { cn } from "../../lib/utils";

type ImageLightboxProps = {
  src: string;
  alt: string;
  title?: string;
  description?: string;
  isOpen: boolean;
  onClose: () => void;
};

export const ImageLightbox = ({
  src,
  alt,
  title,
  description,
  isOpen,
  onClose,
}: ImageLightboxProps) => {
  const {
    isLoading,
    isZoomed,
    scale,
    containerRef,
    imageRef,
    toggleZoom,
    handleDragEnd,
    getDragConstraints,
    setIsLoading,
  } = useLightboxControls({ src, isOpen, onClose });

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <AnimatePresence>
        {isOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm"
              />
            </Dialog.Overlay>
            <Dialog.Content
              onEscapeKeyDown={onClose}
              onInteractOutside={onClose}
              aria-labelledby={title ? "lightbox-title" : undefined}
              aria-describedby={
                description ? "lightbox-description" : undefined
              }
              asChild
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 overflow-hidden focus:outline-none"
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
              >
                <div className="fixed right-4 top-4 z-50 flex items-center gap-2">
                  <button
                    onClick={toggleZoom}
                    className="rounded-full bg-black/20 p-2 text-white backdrop-blur-md transition-colors hover:bg-black/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                    aria-label={isZoomed ? "Zoom out" : "Zoom in"}
                  >
                    {isZoomed ? (
                      <ZoomOut className="h-4 w-4" />
                    ) : (
                      <ZoomIn className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={onClose}
                    className="rounded-full bg-black/20 p-2 text-white backdrop-blur-md transition-colors hover:bg-black/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                    aria-label="Close lightbox"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <motion.div
                  ref={containerRef}
                  className="flex h-full w-full flex-col items-center justify-center p-4"
                  drag={!isZoomed}
                  dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
                  dragElastic={0.05}
                  onDragEnd={handleDragEnd}
                >
                  <div className="relative">
                    {isLoading && (
                      <div
                        className="absolute inset-0 flex items-center justify-center"
                        role="status"
                        aria-label="Loading image"
                      >
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white/90" />
                      </div>
                    )}
                    <motion.div
                      onDoubleClick={toggleZoom}
                      onDoubleClickCapture={(e) => e.stopPropagation()}
                      drag={isZoomed}
                      key={isZoomed ? "zoomed" : "normal"}
                      dragConstraints={getDragConstraints()}
                      dragElastic={0.1}
                      dragMomentum={true}
                      dragTransition={{
                        bounceStiffness: 1000,
                        bounceDamping: 50,
                        power: 0.15,
                        timeConstant: 50,
                      }}
                      animate={{
                        scale,
                        x: isZoomed ? undefined : 0,
                        y: isZoomed ? undefined : 0,
                      }}
                      transition={{
                        type: "spring",
                        bounce: 0.1,
                        duration: 0.3,
                      }}
                      className="touch-none"
                    >
                      <motion.img
                        ref={imageRef}
                        src={src}
                        alt={alt}
                        onLoad={() => setIsLoading(false)}
                        className={cn(
                          `
                          h-auto max-h-[90vh] w-auto max-w-[90vw] cursor-grab select-none rounded-lg
                          object-contain transition-opacity
                          duration-300 active:cursor-grabbing
                        `,
                          isLoading ? "opacity-0" : "opacity-100"
                        )}
                        draggable={false}
                      />
                    </motion.div>
                  </div>

                  {(title || description) && (
                    <div className="mt-4 max-w-[90vw] space-y-2 text-center text-white">
                      {title && (
                        <h2 id="lightbox-title" className="text-lg font-medium">
                          {title}
                        </h2>
                      )}
                      {description && (
                        <p
                          id="lightbox-description"
                          className="text-sm text-white/80"
                        >
                          {description}
                        </p>
                      )}
                    </div>
                  )}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ delay: 0.2 }}
                  className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 text-center text-sm text-white/60 md:hidden"
                >
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4" aria-hidden="true" />
                    <span>Drag to close</span>
                  </div>
                </motion.div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
};
