'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, XCircle, Circle, Image } from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { subscribeMediaProgress } from '@/lib/media/media-orchestrator';

interface GeneratingProgressProps {
  outlineReady: boolean; // Is outline generation complete?
  firstPageReady: boolean; // Is first page generated?
  statusMessage: string;
  error?: string | null;
  stageId?: string; // Optional: for media progress tracking
}

// Status item component - declared outside main component
function StatusItem({
  completed,
  inProgress,
  hasError,
  label,
}: {
  completed: boolean;
  inProgress: boolean;
  hasError: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-shrink-0">
        {hasError ? (
          <XCircle className="size-6 text-destructive" />
        ) : completed ? (
          <CheckCircle2 className="size-6 text-green-500" />
        ) : inProgress ? (
          <Loader2 className="size-6 text-primary animate-spin" />
        ) : (
          <Circle className="size-6 text-muted-foreground" />
        )}
      </div>
      <span
        className={`text-base ${
          hasError
            ? 'text-destructive'
            : completed
              ? 'text-green-600 font-medium'
              : inProgress
                ? 'text-primary font-medium'
                : 'text-muted-foreground'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

export function GeneratingProgress({
  outlineReady,
  firstPageReady,
  statusMessage,
  error,
  stageId,
}: GeneratingProgressProps) {
  const { t } = useI18n();
  const [dots, setDots] = useState('');

  // Media generation progress state
  const [mediaProgress, setMediaProgress] = useState<{
    total: number;
    completed: number;
    generating: number;
    failed: number;
  } | null>(null);

  // Subscribe to media generation progress
  useEffect(() => {
    const unsubscribe = subscribeMediaProgress((progress) => {
      setMediaProgress(progress);
    });
    return unsubscribe;
  }, []);

  // Animated dots for loading state
  useEffect(() => {
    if (!error && !firstPageReady) {
      const interval = setInterval(() => {
        setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
      }, 500);
      return () => clearInterval(interval);
    }
  }, [error, firstPageReady]);

  // Determine media status
  const mediaInProgress = mediaProgress && mediaProgress.generating > 0;
  const mediaComplete = mediaProgress && mediaProgress.completed === mediaProgress.total && mediaProgress.total > 0;
  const mediaHasError = mediaProgress && mediaProgress.failed > 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {error ? (
              <>
                <XCircle className="size-5 text-destructive" />
                {t('generation.generationFailed')}
              </>
            ) : firstPageReady ? (
              <>
                <CheckCircle2 className="size-5 text-green-500" />
                {t('generation.openingClassroom')}
              </>
            ) : (
              <>
                <Loader2 className="size-5 animate-spin" />
                {t('generation.generatingCourse')}
                {dots}
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Three milestone status items */}
          <div className="divide-y">
            <StatusItem
              completed={outlineReady}
              inProgress={!outlineReady && !error}
              hasError={!outlineReady && !!error}
              label={
                outlineReady ? t('generation.outlineReady') : t('generation.generatingOutlines')
              }
            />
            <StatusItem
              completed={firstPageReady}
              inProgress={outlineReady && !firstPageReady && !error}
              hasError={outlineReady && !firstPageReady && !!error}
              label={
                firstPageReady
                  ? t('generation.firstPageReady')
                  : t('generation.generatingFirstPage')
              }
            />
            {/* Media generation progress */}
            {mediaProgress && mediaProgress.total > 0 && (
              <div className="flex items-center gap-3 py-3">
                <div className="flex-shrink-0">
                  {mediaHasError && !mediaInProgress ? (
                    <XCircle className="size-6 text-amber-500" />
                  ) : mediaComplete ? (
                    <CheckCircle2 className="size-6 text-green-500" />
                  ) : mediaInProgress ? (
                    <Loader2 className="size-6 text-primary animate-spin" />
                  ) : (
                    <Image className="size-6 text-muted-foreground" />
                  )}
                </div>
                <span
                  className={`text-base ${
                    mediaHasError && !mediaInProgress
                      ? 'text-amber-600'
                      : mediaComplete
                        ? 'text-green-600 font-medium'
                        : mediaInProgress
                          ? 'text-primary font-medium'
                          : 'text-muted-foreground'
                  }`}
                >
                  {mediaComplete
                    ? t('generation.mediaComplete')
                    : mediaInProgress
                      ? t('generation.generatingMedia').replace('{{current}}', String(mediaProgress.completed + 1)).replace('{{total}}', String(mediaProgress.total))
                      : t('generation.mediaPending')}
                </span>
              </div>
            )}
          </div>

          {/* Status message */}
          {statusMessage && !error && (
            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground">{statusMessage}</p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
