/**
 * Media Generation Orchestrator
 *
 * Dispatches media generation API calls for all mediaGenerations across outlines.
 * Runs entirely on the frontend — calls /api/generate/image and /api/generate/video,
 * fetches result blobs, stores in IndexedDB, and updates the Zustand store.
 */

import { useMediaGenerationStore } from '@/lib/store/media-generation';
import { useSettingsStore } from '@/lib/store/settings';
import { db, mediaFileKey } from '@/lib/utils/database';
import type { SceneOutline } from '@/lib/types/generation';
import type { MediaGenerationRequest } from '@/lib/media/types';
import { createLogger } from '@/lib/logger';

const log = createLogger('MediaOrchestrator');

/** Maximum concurrent API calls to avoid rate limiting */
const MAX_CONCURRENT_GENERATIONS = 3;

/** Progress callback type */
export type MediaProgressCallback = (progress: {
  total: number;
  completed: number;
  generating: number;
  failed: number;
  currentElementId?: string;
}) => void;

/** Global progress callbacks */
const progressCallbacks = new Set<MediaProgressCallback>();

/** Subscribe to media generation progress updates */
export function subscribeMediaProgress(callback: MediaProgressCallback): () => void {
  progressCallbacks.add(callback);
  return () => progressCallbacks.delete(callback);
}

/** Notify all subscribers of progress update */
function notifyProgress(progress: Parameters<MediaProgressCallback>[0]): void {
  for (const callback of progressCallbacks) {
    try {
      callback(progress);
    } catch {
      // Ignore callback errors
    }
  }
}

/** Error with a structured errorCode from the API */
class MediaApiError extends Error {
  errorCode?: string;
  constructor(message: string, errorCode?: string) {
    super(message);
    this.errorCode = errorCode;
  }
}

/**
 * Concurrency-limited queue for media generation tasks.
 * Prevents API rate limiting by controlling parallel requests.
 */
class MediaGenerationQueue {
  private queue: Array<() => Promise<void>> = [];
  private running = 0;
  private maxConcurrent: number;

  constructor(maxConcurrent = MAX_CONCURRENT_GENERATIONS) {
    this.maxConcurrent = maxConcurrent;
  }

  add(task: () => Promise<void>): void {
    this.queue.push(task);
    this.process();
  }

  private async process(): Promise<void> {
    while (this.queue.length > 0 && this.running < this.maxConcurrent) {
      this.running++;
      const task = this.queue.shift()!;
      task().finally(() => {
        this.running--;
        this.process();
      });
    }
  }

  get pendingCount(): number {
    return this.queue.length;
  }

  get runningCount(): number {
    return this.running;
  }
}

/**
 * Check if an API key is configured for the current image provider.
 * Returns true if either client-side or server-side key is available.
 */
function checkImageApiKeyConfigured(settings: ReturnType<typeof useSettingsStore.getState>): boolean {
  const providerId = settings.imageProviderId;
  if (!providerId) return false;

  // Check client-side config first
  const clientConfig = settings.imageProvidersConfig?.[providerId];
  if (clientConfig?.apiKey) return true;

  // Server-side key check is done in the API route
  // We assume server might have a key configured, so return true to attempt the call
  // The API will return MISSING_API_KEY error if neither is configured
  return true;
}

/**
 * Check if an API key is configured for the current video provider.
 * Returns true if either client-side or server-side key is available.
 */
function checkVideoApiKeyConfigured(settings: ReturnType<typeof useSettingsStore.getState>): boolean {
  const providerId = settings.videoProviderId;
  if (!providerId) return false;

  // Check client-side config first
  const clientConfig = settings.videoProvidersConfig?.[providerId];
  if (clientConfig?.apiKey) return true;

  // Server-side key might be configured
  return true;
}

/**
 * Launch media generation for all mediaGenerations declared in outlines.
 * Runs in parallel with content/action generation — does not block.
 */
export async function generateMediaForOutlines(
  outlines: SceneOutline[],
  stageId: string,
  abortSignal?: AbortSignal,
): Promise<void> {
  const settings = useSettingsStore.getState();
  const store = useMediaGenerationStore.getState();

  // Pre-check: verify API key is configured before attempting generation
  const hasImageApiKey = checkImageApiKeyConfigured(settings);
  const hasVideoApiKey = checkVideoApiKeyConfigured(settings);

  // Collect all media requests
  const allRequests: MediaGenerationRequest[] = [];
  for (const outline of outlines) {
    if (!outline.mediaGenerations) continue;
    for (const mg of outline.mediaGenerations) {
      // Filter by enabled flags
      if (mg.type === 'image' && !settings.imageGenerationEnabled) continue;
      if (mg.type === 'video' && !settings.videoGenerationEnabled) continue;
      // Skip if API key not configured (graceful degradation)
      if (mg.type === 'image' && !hasImageApiKey) {
        log.warn(`Skipping image generation "${mg.elementId}": no API key configured for provider "${settings.imageProviderId}"`);
        continue;
      }
      if (mg.type === 'video' && !hasVideoApiKey) {
        log.warn(`Skipping video generation "${mg.elementId}": no API key configured for provider "${settings.videoProviderId}"`);
        continue;
      }
      // Skip already completed or permanently failed (restored from DB)
      const existing = store.getTask(mg.elementId);
      if (existing?.status === 'done' || existing?.status === 'failed') continue;
      allRequests.push(mg);
    }
  }

  if (allRequests.length === 0) return;

  // Enqueue all as pending
  useMediaGenerationStore.getState().enqueueTasks(stageId, allRequests);

  // Track progress for UI feedback
  let completed = 0;
  let failed = 0;
  const total = allRequests.length;
  log.info(`Starting media generation: ${total} items, max ${MAX_CONCURRENT_GENERATIONS} concurrent`);

  // Notify initial progress
  notifyProgress({ total, completed: 0, generating: 0, failed: 0 });

  // Process with concurrency control using queue
  const queue = new MediaGenerationQueue(MAX_CONCURRENT_GENERATIONS);

  for (const req of allRequests) {
    if (abortSignal?.aborted) break;

    queue.add(async () => {
      if (abortSignal?.aborted) return;

      // Notify that this item is starting
      notifyProgress({ total, completed, generating: queue.runningCount, failed, currentElementId: req.elementId });

      await generateSingleMedia(req, stageId, abortSignal);

      // Check if it succeeded or failed
      const task = useMediaGenerationStore.getState().getTask(req.elementId);
      if (task?.status === 'done') {
        completed++;
      } else if (task?.status === 'failed') {
        failed++;
      }

      log.info(`Media generation progress: ${completed}/${total} (failed: ${failed})`);

      // Notify progress update
      notifyProgress({ total, completed, generating: queue.runningCount, failed });
    });
  }

  // Wait for all tasks to complete (polling approach)
  while ((completed + failed) < total && !abortSignal?.aborted) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Final progress notification
  notifyProgress({ total, completed, generating: 0, failed });
}

/**
 * Retry a single failed media task.
 */
export async function retryMediaTask(elementId: string): Promise<void> {
  const store = useMediaGenerationStore.getState();
  const task = store.getTask(elementId);
  if (!task || task.status !== 'failed') return;

  // Check if the corresponding generation type is still enabled in global settings
  const settings = useSettingsStore.getState();
  if (task.type === 'image' && !settings.imageGenerationEnabled) {
    store.markFailed(elementId, 'Generation disabled', 'GENERATION_DISABLED');
    return;
  }
  if (task.type === 'video' && !settings.videoGenerationEnabled) {
    store.markFailed(elementId, 'Generation disabled', 'GENERATION_DISABLED');
    return;
  }

  // Remove persisted failure record from DB so a fresh result can be written
  const dbKey = mediaFileKey(task.stageId, elementId);
  await db.mediaFiles.delete(dbKey).catch(() => {});

  store.markPendingForRetry(elementId);
  await generateSingleMedia(
    {
      type: task.type,
      prompt: task.prompt,
      elementId: task.elementId,
      aspectRatio: task.params.aspectRatio as MediaGenerationRequest['aspectRatio'],
      style: task.params.style,
    },
    task.stageId,
  );
}

// ==================== Internal ====================

async function generateSingleMedia(
  req: MediaGenerationRequest,
  stageId: string,
  abortSignal?: AbortSignal,
): Promise<void> {
  const store = useMediaGenerationStore.getState();
  store.markGenerating(req.elementId);

  try {
    let resultUrl: string;
    let posterUrl: string | undefined;
    let mimeType: string;

    if (req.type === 'image') {
      const result = await callImageApi(req, abortSignal);
      resultUrl = result.url;
      mimeType = 'image/png';
    } else {
      const result = await callVideoApi(req, abortSignal);
      resultUrl = result.url;
      posterUrl = result.poster;
      mimeType = 'video/mp4';
    }

    if (abortSignal?.aborted) return;

    // Fetch blob from URL
    const blob = await fetchAsBlob(resultUrl);
    const posterBlob = posterUrl ? await fetchAsBlob(posterUrl).catch(() => undefined) : undefined;

    // Store in IndexedDB
    await db.mediaFiles.put({
      id: mediaFileKey(stageId, req.elementId),
      stageId,
      type: req.type,
      blob,
      mimeType,
      size: blob.size,
      poster: posterBlob,
      prompt: req.prompt,
      params: JSON.stringify({
        aspectRatio: req.aspectRatio,
        style: req.style,
      }),
      createdAt: Date.now(),
    });

    // Update store with object URL
    const objectUrl = URL.createObjectURL(blob);
    const posterObjectUrl = posterBlob ? URL.createObjectURL(posterBlob) : undefined;
    useMediaGenerationStore.getState().markDone(req.elementId, objectUrl, posterObjectUrl);
  } catch (err) {
    if (abortSignal?.aborted) return;
    const message = err instanceof Error ? err.message : String(err);
    const errorCode = err instanceof MediaApiError ? err.errorCode : undefined;

    // Graceful degradation: skip silently if API key not configured
    if (errorCode === 'MISSING_API_KEY') {
      log.warn(`Skipping ${req.elementId}: ${message}`);
      // Don't mark as failed - this is a configuration issue, not a generation failure
      // The slide will still render without the image
      return;
    }

    log.error(`Failed ${req.elementId}:`, message);
    useMediaGenerationStore.getState().markFailed(req.elementId, message, errorCode);

    // Persist non-retryable failures to IndexedDB so they survive page refresh
    if (errorCode) {
      await db.mediaFiles
        .put({
          id: mediaFileKey(stageId, req.elementId),
          stageId,
          type: req.type,
          blob: new Blob(), // empty placeholder
          mimeType: req.type === 'image' ? 'image/png' : 'video/mp4',
          size: 0,
          prompt: req.prompt,
          params: JSON.stringify({
            aspectRatio: req.aspectRatio,
            style: req.style,
          }),
          error: message,
          errorCode,
          createdAt: Date.now(),
        })
        .catch(() => {}); // best-effort
    }
  }
}

async function callImageApi(
  req: MediaGenerationRequest,
  abortSignal?: AbortSignal,
): Promise<{ url: string }> {
  const settings = useSettingsStore.getState();
  const providerConfig = settings.imageProvidersConfig?.[settings.imageProviderId];

  const response = await fetch('/api/generate/image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-image-provider': settings.imageProviderId || '',
      'x-image-model': settings.imageModelId || '',
      'x-api-key': providerConfig?.apiKey || '',
      'x-base-url': providerConfig?.baseUrl || '',
    },
    body: JSON.stringify({
      prompt: req.prompt,
      aspectRatio: req.aspectRatio,
      style: req.style,
    }),
    signal: abortSignal,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new MediaApiError(data.error || `Image API returned ${response.status}`, data.errorCode);
  }

  const data = await response.json();
  if (!data.success)
    throw new MediaApiError(data.error || 'Image generation failed', data.errorCode);

  // Result may have url or base64
  const url =
    data.result?.url || (data.result?.base64 ? `data:image/png;base64,${data.result.base64}` : '');
  if (!url) throw new Error('No image URL in response');
  return { url };
}

async function callVideoApi(
  req: MediaGenerationRequest,
  abortSignal?: AbortSignal,
): Promise<{ url: string; poster?: string }> {
  const settings = useSettingsStore.getState();
  const providerConfig = settings.videoProvidersConfig?.[settings.videoProviderId];

  const response = await fetch('/api/generate/video', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-video-provider': settings.videoProviderId || '',
      'x-video-model': settings.videoModelId || '',
      'x-api-key': providerConfig?.apiKey || '',
      'x-base-url': providerConfig?.baseUrl || '',
    },
    body: JSON.stringify({
      prompt: req.prompt,
      aspectRatio: req.aspectRatio,
    }),
    signal: abortSignal,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new MediaApiError(data.error || `Video API returned ${response.status}`, data.errorCode);
  }

  const data = await response.json();
  if (!data.success)
    throw new MediaApiError(data.error || 'Video generation failed', data.errorCode);

  const url = data.result?.url;
  if (!url) throw new Error('No video URL in response');
  return { url, poster: data.result?.poster };
}

async function fetchAsBlob(url: string): Promise<Blob> {
  // For data URLs, convert directly
  if (url.startsWith('data:')) {
    const res = await fetch(url);
    return res.blob();
  }
  // For remote URLs, proxy through our server to bypass CORS restrictions
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const res = await fetch('/api/proxy-media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Proxy fetch failed: ${res.status}`);
    }
    return res.blob();
  }
  // Relative URLs (shouldn't happen, but handle gracefully)
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch blob: ${res.status}`);
  return res.blob();
}
