'use client';

import { useState, useCallback, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Loader2, Trash2, AlertTriangle, Image, RefreshCw } from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { clearDatabase, getCacheSize, formatBytes, cleanupMediaCache, clearMediaCache } from '@/lib/utils/database';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';

const log = createLogger('GeneralSettings');

export function GeneralSettings() {
  const { t } = useI18n();

  // Clear cache state
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [clearing, setClearing] = useState(false);

  // Media cache state
  const [cacheSize, setCacheSize] = useState<{ totalBytes: number; mediaBytes: number; audioBytes: number } | null>(null);
  const [clearingMedia, setClearingMedia] = useState(false);

  // Load cache size on mount
  useEffect(() => {
    getCacheSize().then(setCacheSize).catch(() => {});
  }, []);

  const handleCleanupMediaCache = useCallback(async () => {
    setClearingMedia(true);
    try {
      const removed = await cleanupMediaCache();
      const newSize = await getCacheSize();
      setCacheSize(newSize);
      if (removed > 0) {
        toast.success(t('settings.mediaCacheCleaned').replace('{{count}}', String(removed)));
      } else {
        toast.success(t('settings.mediaCacheWithinLimit'));
      }
    } catch (error) {
      log.error('Failed to cleanup media cache:', error);
      toast.error(t('settings.mediaCacheCleanupFailed'));
    } finally {
      setClearingMedia(false);
    }
  }, [t]);

  const handleClearMediaCache = useCallback(async () => {
    setClearingMedia(true);
    try {
      const count = await clearMediaCache();
      const newSize = await getCacheSize();
      setCacheSize(newSize);
      toast.success(t('settings.mediaCacheCleared').replace('{{count}}', String(count)));
    } catch (error) {
      log.error('Failed to clear media cache:', error);
      toast.error(t('settings.mediaCacheCleanupFailed'));
    } finally {
      setClearingMedia(false);
    }
  }, [t]);

  const confirmPhrase = t('settings.clearCacheConfirmPhrase');
  const isConfirmValid = confirmInput === confirmPhrase;

  const handleClearCache = useCallback(async () => {
    if (!isConfirmValid) return;
    setClearing(true);
    try {
      // 1. Clear IndexedDB
      await clearDatabase();
      // 2. Clear localStorage
      localStorage.clear();
      // 3. Clear sessionStorage
      sessionStorage.clear();

      toast.success(t('settings.clearCacheSuccess'));

      // Reload page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      log.error('Failed to clear cache:', error);
      toast.error(t('settings.clearCacheFailed'));
      setClearing(false);
    }
  }, [isConfirmValid, t]);

  const clearCacheItems =
    t('settings.clearCacheConfirmItems').split('、').length > 1
      ? t('settings.clearCacheConfirmItems').split('、')
      : t('settings.clearCacheConfirmItems').split(', ');

  return (
    <div className="flex flex-col gap-8">
      {/* Media Cache Management */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-primary/10 text-primary">
              <Image className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold">{t('settings.mediaCache')}</h3>
          </div>

          {/* Content */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{t('settings.mediaCacheSize')}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {cacheSize
                  ? `${formatBytes(cacheSize.mediaBytes)} ${t('settings.mediaCacheImages')} · ${formatBytes(cacheSize.audioBytes)} ${t('settings.mediaCacheAudio')}`
                  : t('settings.mediaCacheLoading')}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={handleCleanupMediaCache}
                disabled={clearingMedia}
              >
                {clearingMedia ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                )}
                {t('settings.mediaCacheCleanup')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={handleClearMediaCache}
                disabled={clearingMedia}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                {t('settings.mediaCacheClear')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone - Clear Cache */}
      <div className="relative rounded-xl border border-destructive/30 bg-destructive/[0.03] dark:bg-destructive/[0.06] overflow-hidden">
        {/* Subtle diagonal stripe pattern for danger emphasis */}
        <div
          className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `repeating-linear-gradient(
              -45deg,
              transparent,
              transparent 10px,
              currentColor 10px,
              currentColor 11px
            )`,
          }}
        />

        <div className="relative p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-destructive/10 text-destructive">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-destructive">{t('settings.dangerZone')}</h3>
          </div>

          {/* Content */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{t('settings.clearCache')}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {t('settings.clearCacheDescription')}
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="shrink-0"
              onClick={() => {
                setConfirmInput('');
                setShowClearDialog(true);
              }}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              {t('settings.clearCache')}
            </Button>
          </div>
        </div>
      </div>

      {/* Clear Cache Confirmation Dialog */}
      <AlertDialog
        open={showClearDialog}
        onOpenChange={(open) => {
          if (!clearing) {
            setShowClearDialog(open);
            if (!open) setConfirmInput('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              {t('settings.clearCacheConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>{t('settings.clearCacheConfirmDescription')}</p>
                <ul className="space-y-1.5 ml-1">
                  {clearCacheItems.map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-destructive/60 shrink-0" />
                      {item.trim()}
                    </li>
                  ))}
                </ul>
                <div className="pt-1">
                  <Label className="text-xs font-medium text-foreground">
                    {t('settings.clearCacheConfirmInput')}
                  </Label>
                  <Input
                    className="mt-1.5 h-9 text-sm"
                    placeholder={confirmPhrase}
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && isConfirmValid) {
                        handleClearCache();
                      }
                    }}
                    autoFocus
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>{t('common.cancel')}</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={!isConfirmValid || clearing}
              onClick={handleClearCache}
            >
              {clearing ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-1.5" />
              )}
              {t('settings.clearCacheButton')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
