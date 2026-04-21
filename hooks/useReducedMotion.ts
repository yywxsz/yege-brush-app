/**
 * useReducedMotion - Hook to detect and manage reduced motion preference
 * 
 * Detects:
 * 1. User's system preference (prefers-reduced-motion)
 * 2. Device performance (via hardwareConcurrency and deviceMemory)
 * 3. Manual override via settings
 */

'use client';

import { useEffect, useCallback } from 'react';
import { useSettingsStore } from '@/lib/store/settings';

interface DeviceCapabilities {
  cpuCores: number;
  memory: number; // GB, 0 if unknown
  isLowEnd: boolean;
}

/**
 * Detect device capabilities
 */
function detectDeviceCapabilities(): DeviceCapabilities {
  const cpuCores = navigator.hardwareConcurrency || 2;
  
  // @ts-expect-error - deviceMemory is experimental but widely supported
  const memory = navigator.deviceMemory || 0;
  
  // Consider low-end if:
  // - Less than 4 CPU cores, OR
  // - Less than 4GB RAM (if detectable)
  const isLowEnd = cpuCores < 4 || (memory > 0 && memory < 4);
  
  return { cpuCores, memory, isLowEnd };
}

/**
 * Hook to manage reduced motion preference
 * 
 * Returns:
 * - reducedMotion: current state
 * - setReducedMotion: setter
 * - shouldSuggestReducedMotion: whether to suggest enabling it
 * - deviceCapabilities: detected device info
 */
export function useReducedMotion() {
  const reducedMotion = useSettingsStore((state) => state.reducedMotion);
  const setReducedMotion = useSettingsStore((state) => state.setReducedMotion);

  // Check system preference
  const prefersReducedMotion = typeof window !== 'undefined' 
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
    : false;

  // Detect device capabilities
  const deviceCapabilities = typeof window !== 'undefined' 
    ? detectDeviceCapabilities() 
    : { cpuCores: 2, memory: 0, isLowEnd: false };

  // Suggest reduced motion if:
  // 1. System prefers it, OR
  // 2. Device is low-end
  const shouldSuggestReducedMotion = prefersReducedMotion || deviceCapabilities.isLowEnd;

  // Auto-enable reduced motion on first visit if system prefers it
  useEffect(() => {
    if (prefersReducedMotion && !reducedMotion) {
      setReducedMotion(true);
    }
  }, [prefersReducedMotion, reducedMotion, setReducedMotion]);

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [setReducedMotion]);

  return {
    reducedMotion,
    setReducedMotion,
    shouldSuggestReducedMotion,
    deviceCapabilities,
    prefersReducedMotion,
  };
}

/**
 * Utility to conditionally apply animation props
 * Usage: <motion.div {...getMotionProps({ animate: { x: 100 } })} />
 */
export function getMotionProps<T extends Record<string, unknown>>(
  props: T,
): T | { initial: false; animate: false } {
  const reducedMotion = useSettingsStore.getState().reducedMotion;
  
  if (reducedMotion) {
    return { initial: false, animate: false };
  }
  
  return props;
}

/**
 * CSS class helper for conditional blur
 * Returns blur class if reduced motion is disabled
 */
export function getBlurClass(enabled: boolean = true): string {
  if (!enabled) return '';
  
  const reducedMotion = useSettingsStore.getState().reducedMotion;
  return reducedMotion ? '' : 'backdrop-blur-sm';
}
