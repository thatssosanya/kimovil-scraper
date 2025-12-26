import { useCallback, useEffect, useRef, useState } from "react";
import type { PanInfo } from "framer-motion";

interface UseLightboxControlsProps {
  src: string;
  isOpen: boolean;
  onClose: () => void;
}

interface DragConstraints {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface UseLightboxControlsReturn {
  isLoading: boolean;
  isZoomed: boolean;
  scale: number;
  containerRef: React.RefObject<HTMLDivElement>;
  imageRef: React.RefObject<HTMLImageElement>;
  toggleZoom: () => void;
  handleDragEnd: (
    event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => void;
  getDragConstraints: () => DragConstraints;
  setIsLoading: (loading: boolean) => void;
}

export const useLightboxControls = ({
  src,
  isOpen,
  onClose,
}: UseLightboxControlsProps): UseLightboxControlsReturn => {
  const [isLoading, setIsLoading] = useState(true);
  const [isZoomed, setIsZoomed] = useState(false);
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const startDistanceRef = useRef(0);

  // Load image
  useEffect(() => {
    if (!src || !isOpen) return;
    const img = new Image();
    img.src = src;
    img.onload = () => setIsLoading(false);
    return () => {
      setIsLoading(true);
      setIsZoomed(false);
      setScale(1);
    };
  }, [src, isOpen]);

  const toggleZoom = useCallback(() => {
    setIsZoomed(!isZoomed);
    setScale(isZoomed ? 1 : 2);
  }, [isZoomed]);

  // Calculate drag constraints based on image and container size
  const getDragConstraints = useCallback((): DragConstraints => {
    if (!containerRef.current || !imageRef.current) {
      return { top: 0, bottom: 0, left: 0, right: 0 };
    }

    const container = containerRef.current.getBoundingClientRect();
    const image = imageRef.current.getBoundingClientRect();

    const scaledWidth = image.width * scale;
    const scaledHeight = image.height * scale;

    const horizontalOverflow = Math.max(0, scaledWidth - container.width);
    const verticalOverflow = Math.max(0, scaledHeight - container.height);

    return {
      left: -horizontalOverflow / 2,
      right: horizontalOverflow / 2,
      top: -verticalOverflow / 2,
      bottom: verticalOverflow / 2,
    };
  }, [scale]);

  // Handle pinch gestures
  useEffect(() => {
    const element = containerRef.current;
    if (!element || !isOpen) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();

      const touches = Array.from(e.touches);
      if (touches.length < 2) return;

      const [touch1, touch2] = touches as [Touch, Touch];
      startDistanceRef.current = Math.hypot(
        touch1.clientX - touch2.clientX,
        touch1.clientY - touch2.clientY
      );
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || startDistanceRef.current === 0) return;
      e.preventDefault();

      const touches = Array.from(e.touches);
      if (touches.length < 2) return;

      const [touch1, touch2] = touches as [Touch, Touch];
      const distance = Math.hypot(
        touch1.clientX - touch2.clientX,
        touch1.clientY - touch2.clientY
      );

      const delta = distance / startDistanceRef.current;
      const newScale = Math.min(Math.max(1, delta * (isZoomed ? 2 : 1)), 3);

      setScale(newScale);
      setIsZoomed(newScale > 1.2);
    };

    const handleTouchEnd = () => {
      startDistanceRef.current = 0;
      if (scale <= 1.2) {
        setScale(1);
        setIsZoomed(false);
      } else if (scale > 1.2 && scale < 1.8) {
        setScale(2);
        setIsZoomed(true);
      }
    };

    element.addEventListener("touchstart", handleTouchStart);
    element.addEventListener("touchmove", handleTouchMove, { passive: false });
    element.addEventListener("touchend", handleTouchEnd);

    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchmove", handleTouchMove);
      element.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isOpen, isZoomed, scale]);

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (!isZoomed && Math.abs(info.velocity.y) > 500) {
        onClose();
      }
    },
    [isZoomed, onClose]
  );

  return {
    // State
    isLoading,
    isZoomed,
    scale,

    // Refs
    containerRef,
    imageRef,

    // Handlers
    toggleZoom,
    handleDragEnd,
    getDragConstraints,

    // Utils
    setIsLoading,
  };
};
