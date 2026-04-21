'use client';

import { useEffect, useState } from 'react';
import { useMediaGenerationStore } from '@/lib/store/media-generation';
import { db, mediaFileKey } from '@/lib/utils/database';
import { createLogger } from '@/lib/logger';

const log = createLogger('LazyImage');

export interface LazyImageProps {
  /** Image element ID (e.g., "gen_img_1") */
  elementId: string;
  /** Stage/Classroom ID */
  stageId: string;
  /** Fallback src if not a generated image */
  fallbackSrc?: string;
  /** Alt text */
  alt?: string;
  /** Width */
  width: number;
  /** Height */
  height: number;
  /** Additional className */
  className?: string;
  /** Style */
  style?: React.CSSProperties;
}

/**
 * LazyImage - Lazy-loaded AI-generated image with skeleton placeholder
 *
 * Behavior:
 * 1. If src is a regular URL → render immediately
 * 2. If src is a gen_img_* placeholder → show skeleton while generating
 * 3. When generation completes → replace skeleton with actual image
 *
 * This enables "text-first rendering" - students can start reading content
 * while images load in the background.
 */
export function LazyImage({
  elementId,
  stageId,
  fallbackSrc,
  alt = '',
  width,
  height,
  className = '',
  style,
}: LazyImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Check if this is a generated image placeholder
  const isGeneratedImage = elementId.startsWith('gen_img_');

  // Subscribe to media generation store
  const task = useMediaGenerationStore((state) => state.getTask(elementId));

  useEffect(() => {
    if (!isGeneratedImage) {
      // Not a generated image, use fallback immediately
      setImageUrl(fallbackSrc || null);
      setIsLoading(false);
      return;
    }

    // Check if already completed
    if (task?.status === 'done') {
      loadFromIndexedDB();
      return;
    }

    // If failed, show error state
    if (task?.status === 'failed') {
      setHasError(true);
      setIsLoading(false);
      return;
    }

    // Still generating - wait for completion
    setIsLoading(true);

    // Poll for completion (store updates will trigger re-render)
    const unsubscribe = useMediaGenerationStore.subscribe((state) => {
      const currentTask = state.getTask(elementId);
      if (currentTask?.status === 'done') {
        loadFromIndexedDB();
        unsubscribe();
      } else if (currentTask?.status === 'failed') {
        setHasError(true);
        setIsLoading(false);
        unsubscribe();
      }
    });

    return unsubscribe;
  }, [elementId, stageId, task?.status, isGeneratedImage, fallbackSrc]);

  const loadFromIndexedDB = async () => {
    try {
      const key = mediaFileKey(stageId, elementId);
      const record = await db.mediaFiles.get(key);

      if (record?.blob) {
        const url = URL.createObjectURL(record.blob);
        setImageUrl(url);
        setIsLoading(false);
      } else {
        log.warn(`No blob found for ${elementId}`);
        setHasError(true);
        setIsLoading(false);
      }
    } catch (error) {
      log.error(`Failed to load image from IndexedDB: ${elementId}`, error);
      setHasError(true);
      setIsLoading(false);
    }
  };

  // Skeleton placeholder while loading
  if (isLoading && isGeneratedImage) {
    return (
      <div
        className={`lazy-image-skeleton ${className}`}
        style={{
          width,
          height,
          ...style,
        }}
      >
        <div className="skeleton-shimmer w-full h-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse rounded" />
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
        {/* Progress indicator */}
        {task && task.status === 'generating' && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
            <div className="h-full bg-blue-500 animate-pulse" style={{ width: '60%' }} />
          </div>
        )}
      </div>
    );
  }

  // Error state
  if (hasError) {
    return (
      <div
        className={`lazy-image-error ${className}`}
        style={{
          width,
          height,
          backgroundColor: '#f3f4f6',
          ...style,
        }}
      >
        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
          <svg
            className="w-8 h-8 mb-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span className="text-xs">图片生成失败</span>
        </div>
      </div>
    );
  }

  // Render actual image
  if (imageUrl || fallbackSrc) {
    return (
      <img
        src={imageUrl || fallbackSrc}
        alt={alt}
        width={width}
        height={height}
        className={className}
        style={style}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
      />
    );
  }

  return null;
}
