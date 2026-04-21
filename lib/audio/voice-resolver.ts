import type { TTSProviderId } from '@/lib/audio/types';
import { isCustomTTSProvider } from '@/lib/audio/types';
import type { AgentConfig } from '@/lib/orchestration/registry/types';
import { TTS_PROVIDERS } from '@/lib/audio/constants';

export interface ResolvedVoice {
  providerId: TTSProviderId;
  modelId?: string;
  voiceId: string;
}

/**
 * Language code normalization map.
 * Maps various language codes to canonical form for matching.
 */
const LANGUAGE_NORMALIZE_MAP: Record<string, string> = {
  // Chinese variants
  'zh': 'zh',
  'zh-cn': 'zh',
  'zh-tw': 'zh',
  'zh-hk': 'zh',
  'zh-hans': 'zh',
  'zh-hant': 'zh',
  'chinese': 'zh',
  // English variants
  'en': 'en',
  'en-us': 'en',
  'en-gb': 'en',
  'en-au': 'en',
  'english': 'en',
  // Japanese
  'ja': 'ja',
  'jp': 'ja',
  'japanese': 'ja',
  // Korean
  'ko': 'ko',
  'kr': 'ko',
  'korean': 'ko',
  // Spanish
  'es': 'es',
  'spanish': 'es',
  // French
  'fr': 'fr',
  'french': 'fr',
  // German
  'de': 'de',
  'german': 'de',
  // Russian
  'ru': 'ru',
  'russian': 'ru',
  // Italian
  'it': 'it',
  'italian': 'it',
  // Portuguese
  'pt': 'pt',
  'portuguese': 'pt',
};

/**
 * Detect language from languageDirective string.
 * Returns normalized language code (e.g., 'zh', 'en', 'ja').
 */
export function detectLanguageFromDirective(languageDirective: string): string {
  if (!languageDirective) return 'en';

  const lowerDirective = languageDirective.toLowerCase();

  // Check for explicit language mentions
  if (lowerDirective.includes('中文') || lowerDirective.includes('chinese') || lowerDirective.includes('简体中文')) {
    return 'zh';
  }
  if (lowerDirective.includes('english') || lowerDirective.includes('英文')) {
    return 'en';
  }
  if (lowerDirective.includes('日语') || lowerDirective.includes('japanese')) {
    return 'ja';
  }
  if (lowerDirective.includes('韩语') || lowerDirective.includes('korean')) {
    return 'ko';
  }
  if (lowerDirective.includes('spanish') || lowerDirective.includes('西班牙语')) {
    return 'es';
  }
  if (lowerDirective.includes('french') || lowerDirective.includes('法语')) {
    return 'fr';
  }
  if (lowerDirective.includes('german') || lowerDirective.includes('德语')) {
    return 'de';
  }

  // Default to English for English directives, Chinese for Chinese directives
  // Check if the directive itself is written in Chinese
  const chineseCharCount = (languageDirective.match(/[\u4e00-\u9fff]/g) || []).length;
  if (chineseCharCount > 3) {
    return 'zh';
  }

  return 'en';
}

/**
 * Check if a voice language matches the target language.
 */
function voiceLanguageMatches(voiceLanguage: string | undefined, targetLanguage: string): boolean {
  if (!voiceLanguage) return false;

  const normalizedVoice = LANGUAGE_NORMALIZE_MAP[voiceLanguage.toLowerCase()] || voiceLanguage.toLowerCase();
  const normalizedTarget = LANGUAGE_NORMALIZE_MAP[targetLanguage.toLowerCase()] || targetLanguage.toLowerCase();

  return normalizedVoice === normalizedTarget;
}

/**
 * Resolve the TTS provider + voice for an agent.
 * 1. If agent has voiceConfig and the voice is still valid, use it
 * 2. If targetLanguage is provided, prefer providers with matching language voices
 * 3. Otherwise, use the first available provider + deterministic voice by index
 */
export function resolveAgentVoice(
  agent: AgentConfig,
  agentIndex: number,
  availableProviders: ProviderWithVoices[],
  targetLanguage?: string,
): ResolvedVoice {
  // Agent-specific config
  if (agent.voiceConfig) {
    // Browser-native voices are dynamic (not in static registry), so skip validation
    if (agent.voiceConfig.providerId === 'browser-native-tts') {
      return {
        providerId: agent.voiceConfig.providerId,
        modelId: agent.voiceConfig.modelId,
        voiceId: agent.voiceConfig.voiceId,
      };
    }
    const list = getServerVoiceList(agent.voiceConfig.providerId);
    // Also check available providers (covers custom providers with dynamic voice lists)
    const fromAvailable = availableProviders
      .find((p) => p.providerId === agent.voiceConfig!.providerId)
      ?.voices.map((v) => v.id);
    const allVoiceIds = new Set([...list, ...(fromAvailable || [])]);
    if (allVoiceIds.has(agent.voiceConfig.voiceId)) {
      return {
        providerId: agent.voiceConfig.providerId,
        modelId: agent.voiceConfig.modelId,
        voiceId: agent.voiceConfig.voiceId,
      };
    }
  }

  // Smart voice selection: prefer providers with matching language voices
  if (targetLanguage && availableProviders.length > 0) {
    // Find providers with voices matching the target language
    const matchingProviders = availableProviders.filter((p) =>
      p.voices.some((v) => voiceLanguageMatches(v.language, targetLanguage)),
    );

    if (matchingProviders.length > 0) {
      const provider = matchingProviders[agentIndex % matchingProviders.length];
      const matchingVoices = provider.voices.filter((v) =>
        voiceLanguageMatches(v.language, targetLanguage),
      );
      if (matchingVoices.length > 0) {
        return {
          providerId: provider.providerId,
          voiceId: matchingVoices[agentIndex % matchingVoices.length].id,
        };
      }
    }
  }

  // Fallback: first available provider, deterministic voice
  if (availableProviders.length > 0) {
    const first = availableProviders[0];
    return {
      providerId: first.providerId,
      voiceId: first.voices[agentIndex % first.voices.length].id,
    };
  }

  return { providerId: 'browser-native-tts', voiceId: 'default' };
}

/**
 * Get the list of voice IDs for a TTS provider.
 * For browser-native-tts, returns empty (browser voices are dynamic).
 * For custom providers, reads from ttsProvidersConfig.customVoices.
 */
export function getServerVoiceList(
  providerId: TTSProviderId,
  ttsProvidersConfig?: Record<string, Record<string, unknown>>,
): string[] {
  if (providerId === 'browser-native-tts') return [];
  if (isCustomTTSProvider(providerId) && ttsProvidersConfig) {
    const customVoices = ttsProvidersConfig[providerId]?.customVoices as
      | Array<{ id: string }>
      | undefined;
    return customVoices?.map((v) => v.id) || [];
  }
  const provider = TTS_PROVIDERS[providerId as keyof typeof TTS_PROVIDERS];
  if (!provider) return [];
  return provider.voices.map((v) => v.id);
}

export interface ModelVoiceGroup {
  modelId: string;
  modelName: string;
  voices: Array<{ id: string; name: string; language?: string }>;
}

export interface ProviderWithVoices {
  providerId: TTSProviderId;
  providerName: string;
  voices: Array<{ id: string; name: string; language?: string }>;
  modelGroups: ModelVoiceGroup[]; // voices grouped by model
}

/**
 * Get all available providers and their voices for the voice picker UI.
 * A provider is available if it has an API key or is server-configured.
 * Custom providers are available if they have voices configured.
 * Browser-native-tts is excluded (no static voice list).
 *
 * @param ttsProvidersConfig - Provider configuration
 * @param targetLanguage - Optional language filter. If provided, only returns voices matching this language.
 */
export function getAvailableProvidersWithVoices(
  ttsProvidersConfig: Record<
    string,
    {
      apiKey?: string;
      enabled?: boolean;
      isServerConfigured?: boolean;
      modelId?: string;
      customName?: string;
      customVoices?: Array<{ id: string; name: string }>;
    }
  >,
  targetLanguage?: string,
): ProviderWithVoices[] {
  const result: ProviderWithVoices[] = [];

  // Built-in providers
  for (const [id, config] of Object.entries(TTS_PROVIDERS)) {
    const providerId = id as TTSProviderId;
    if (providerId === 'browser-native-tts') continue;
    if (config.voices.length === 0) continue;

    const providerConfig = ttsProvidersConfig[providerId];
    const hasApiKey = providerConfig?.apiKey && providerConfig.apiKey.trim().length > 0;
    const isServerConfigured = providerConfig?.isServerConfigured === true;

    if (hasApiKey || isServerConfigured) {
      // Filter voices by language if targetLanguage is specified
      let allVoices = config.voices.map((v) => ({
        id: v.id,
        name: v.name,
        language: v.language,
      }));

      if (targetLanguage) {
        allVoices = allVoices.filter((v) => voiceLanguageMatches(v.language, targetLanguage));
      }

      // Skip provider if no voices match the language filter
      if (allVoices.length === 0) continue;

      // Build model groups
      const modelGroups: ModelVoiceGroup[] = [];
      if (config.models.length > 0) {
        for (const model of config.models) {
          const compatibleVoices = config.voices
            .filter((v) => !v.compatibleModels || v.compatibleModels.includes(model.id))
            .filter((v) => !targetLanguage || voiceLanguageMatches(v.language, targetLanguage))
            .map((v) => ({ id: v.id, name: v.name, language: v.language }));
          if (compatibleVoices.length > 0) {
            modelGroups.push({
              modelId: model.id,
              modelName: model.name,
              voices: compatibleVoices,
            });
          }
        }
      } else {
        modelGroups.push({
          modelId: '',
          modelName: config.name,
          voices: allVoices,
        });
      }

      result.push({
        providerId,
        providerName: config.name,
        voices: allVoices,
        modelGroups,
      });
    }
  }

  // Custom providers
  for (const [id, providerConfig] of Object.entries(ttsProvidersConfig)) {
    if (!isCustomTTSProvider(id)) continue;
    const customVoices = providerConfig.customVoices || [];
    if (customVoices.length === 0) continue;

    const providerId = id as TTSProviderId;
    const providerName = providerConfig.customName || id;
    const voices = customVoices.map((v) => ({ id: v.id, name: v.name }));

    result.push({
      providerId,
      providerName,
      voices,
      modelGroups: [{ modelId: '', modelName: providerName, voices }],
    });
  }

  return result;
}

/**
 * Find a voice display name across all providers.
 */
export function findVoiceDisplayName(
  providerId: TTSProviderId,
  voiceId: string,
  ttsProvidersConfig?: Record<string, Record<string, unknown>>,
): string {
  if (isCustomTTSProvider(providerId) && ttsProvidersConfig) {
    const customVoices = ttsProvidersConfig[providerId]?.customVoices as
      | Array<{ id: string; name: string }>
      | undefined;
    const voice = customVoices?.find((v) => v.id === voiceId);
    return voice?.name ?? voiceId;
  }
  const provider = TTS_PROVIDERS[providerId as keyof typeof TTS_PROVIDERS];
  if (!provider) return voiceId;
  const voice = provider.voices.find((v) => v.id === voiceId);
  return voice?.name ?? voiceId;
}
