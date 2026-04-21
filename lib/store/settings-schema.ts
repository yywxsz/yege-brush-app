/**
 * Settings Schema - Runtime validation for persisted settings
 * Prevents app crash when localStorage is corrupted or version mismatch
 */

import { z } from 'zod';

/**
 * Provider config schema
 */
const ProviderConfigSchema = z.object({
  apiKey: z.string().optional().default(''),
  baseUrl: z.string().optional().default(''),
  models: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().optional(),
      }),
    )
    .optional(),
  name: z.string().optional(),
  type: z.enum(['openai', 'anthropic', 'google', 'custom', 'other']).optional(),
  defaultBaseUrl: z.string().optional(),
  icon: z.string().optional(),
  requiresApiKey: z.boolean().optional().default(true),
  isBuiltIn: z.boolean().optional().default(true),
  isServerConfigured: z.boolean().optional(),
  serverBaseUrl: z.string().optional(),
  serverModels: z.array(z.string()).optional(),
});

/**
 * TTS/ASR Provider config schema
 */
const AudioProviderConfigSchema = z.object({
  apiKey: z.string().optional().default(''),
  baseUrl: z.string().optional().default(''),
  enabled: z.boolean().optional().default(true),
  modelId: z.string().optional(),
  customModels: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
  providerOptions: z.record(z.string(), z.unknown()).optional(),
  isServerConfigured: z.boolean().optional(),
  serverBaseUrl: z.string().optional(),
  customName: z.string().optional(),
  customDefaultBaseUrl: z.string().optional(),
  customVoices: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
  isBuiltIn: z.boolean().optional(),
  requiresApiKey: z.boolean().optional(),
});

/**
 * Image/Video Provider config schema
 */
const MediaProviderConfigSchema = z.object({
  apiKey: z.string().optional().default(''),
  baseUrl: z.string().optional().default(''),
  enabled: z.boolean().optional().default(true),
  isServerConfigured: z.boolean().optional(),
  serverBaseUrl: z.string().optional(),
  customModels: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
});

/**
 * PDF Provider config schema
 */
const PDFProviderConfigSchema = z.object({
  apiKey: z.string().optional().default(''),
  baseUrl: z.string().optional().default(''),
  enabled: z.boolean().optional().default(true),
  isServerConfigured: z.boolean().optional(),
  serverBaseUrl: z.string().optional(),
});

/**
 * Web Search Provider config schema
 */
const WebSearchProviderConfigSchema = z.object({
  apiKey: z.string().optional().default(''),
  baseUrl: z.string().optional().default(''),
  enabled: z.boolean().optional().default(true),
  isServerConfigured: z.boolean().optional(),
  serverBaseUrl: z.string().optional(),
});

/**
 * Full settings state schema (partial - only validate what we need)
 * This is used to validate the persisted state before migration
 */
export const SettingsStateSchema = z.object({
  // Model selection
  providerId: z.string().optional(),
  modelId: z.string().optional(),

  // Provider configurations
  providersConfig: z.record(z.string(), ProviderConfigSchema).optional(),

  // TTS settings
  ttsModel: z.string().optional(),
  ttsProviderId: z.string().optional(),
  ttsVoice: z.string().optional(),
  ttsSpeed: z.number().min(0.5).max(2).optional(),
  ttsProvidersConfig: z.record(z.string(), AudioProviderConfigSchema).optional(),

  // ASR settings
  asrProviderId: z.string().optional(),
  asrLanguage: z.string().optional(),
  asrProvidersConfig: z.record(z.string(), AudioProviderConfigSchema).optional(),

  // PDF settings
  pdfProviderId: z.string().optional(),
  pdfProvidersConfig: z.record(z.string(), PDFProviderConfigSchema).optional(),

  // Image settings
  imageProviderId: z.string().optional(),
  imageModelId: z.string().optional(),
  imageGenerationEnabled: z.boolean().optional(),
  imageProvidersConfig: z.record(z.string(), MediaProviderConfigSchema).optional(),

  // Video settings
  videoProviderId: z.string().optional(),
  videoModelId: z.string().optional(),
  videoGenerationEnabled: z.boolean().optional(),
  videoProvidersConfig: z.record(z.string(), MediaProviderConfigSchema).optional(),

  // Web Search settings
  webSearchProviderId: z.string().optional(),
  webSearchProvidersConfig: z.record(z.string(), WebSearchProviderConfigSchema).optional(),

  // Global toggles
  ttsEnabled: z.boolean().optional(),
  asrEnabled: z.boolean().optional(),
  autoConfigApplied: z.boolean().optional(),
  showImageGenerationFeatureNotice: z.boolean().optional(),

  // Playback controls
  ttsMuted: z.boolean().optional(),
  ttsVolume: z.number().min(0).max(1).optional(),
  autoPlayLecture: z.boolean().optional(),
  playbackSpeed: z.number().optional(),

  // Agent settings
  selectedAgentIds: z.array(z.string()).optional(),
  maxTurns: z.string().optional(),
  agentMode: z.enum(['preset', 'auto']).optional(),
  autoAgentCount: z.number().optional(),

  // Layout preferences
  sidebarCollapsed: z.boolean().optional(),
  chatAreaCollapsed: z.boolean().optional(),
  chatAreaWidth: z.number().optional(),

  // Performance settings
  reducedMotion: z.boolean().optional(),
});

/**
 * Validate persisted settings state
 * Returns validated state or null if validation fails
 */
export function validatePersistedSettings(
  persistedState: unknown,
): z.infer<typeof SettingsStateSchema> | null {
  try {
    const result = SettingsStateSchema.safeParse(persistedState);
    if (result.success) {
      return result.data;
    }

    // Log validation errors for debugging
    console.warn('[Settings] Validation failed:', result.error.issues);

    // Try to salvage what we can
    const salvaged: Record<string, unknown> = {};
    const parsed = persistedState as Record<string, unknown>;

    for (const key of Object.keys(parsed)) {
      try {
        // Try to validate each field individually
        const fieldSchema = SettingsStateSchema.shape[key as keyof typeof SettingsStateSchema.shape];
        if (fieldSchema) {
          const fieldResult = fieldSchema.safeParse(parsed[key]);
          if (fieldResult.success) {
            salvaged[key] = fieldResult.data;
          }
        }
      } catch {
        // Skip invalid fields
      }
    }

    return Object.keys(salvaged).length > 0 ? (salvaged as z.infer<typeof SettingsStateSchema>) : null;
  } catch (error) {
    console.error('[Settings] Validation error:', error);
    return null;
  }
}

/**
 * Check if persisted state is corrupted beyond recovery
 */
export function isStateCorrupted(persistedState: unknown): boolean {
  if (!persistedState || typeof persistedState !== 'object') {
    return true;
  }

  const state = persistedState as Record<string, unknown>;

  // Check for critical corruption patterns
  const criticalFields = ['providersConfig', 'ttsProvidersConfig', 'imageProvidersConfig'];

  for (const field of criticalFields) {
    const value = state[field];
    if (value !== undefined && typeof value !== 'object') {
      return true;
    }
  }

  return false;
}

export type ValidatedSettingsState = z.infer<typeof SettingsStateSchema>;
