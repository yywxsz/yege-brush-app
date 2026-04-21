'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  Settings,
  Sun,
  Moon,
  Monitor,
  BotOff,
  Upload,
  Atom,
  BookOpen,
  Bot,
  Home,
  Layers,
  Menu,
  X,
  Trash2,
  Pencil,
  Copy,
  Check,
} from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { LanguageSwitcher } from '@/components/language-switcher';
import { createLogger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { SettingsDialog } from '@/components/settings';
import { GenerationToolbar } from '@/components/generation/generation-toolbar';
import { useTheme } from '@/lib/hooks/use-theme';
import { nanoid } from 'nanoid';
import { storePdfBlob } from '@/lib/utils/image-storage';
import type { UserRequirements } from '@/lib/types/generation';
import { useSettingsStore } from '@/lib/store/settings';
import { useUserProfileStore } from '@/lib/store/user-profile';
import {
  StageListItem,
  listStages,
  deleteStageData,
  renameStage,
  getFirstSlideByStages,
} from '@/lib/utils/stage-storage';
import type { Slide } from '@/lib/types/slides';
import { useMediaGenerationStore } from '@/lib/store/media-generation';
import { toast } from 'sonner';
import { useDraftCache } from '@/lib/hooks/use-draft-cache';
import { SpeechButton } from '@/components/audio/speech-button';
import { useImportClassroom } from '@/lib/import/use-import-classroom';
import { ThumbnailSlide } from '@/components/slide-renderer/components/ThumbnailSlide';
import {
  HomeBackground,
  AIInspirationEngine,
} from '@/components/glassmorphism';

const log = createLogger('Home');

const WEB_SEARCH_STORAGE_KEY = 'webSearchEnabled';
const INTERACTIVE_MODE_STORAGE_KEY = 'interactiveModeEnabled';

interface FormState {
  pdfFile: File | null;
  requirement: string;
  webSearch: boolean;
  interactiveMode: boolean;
}

const initialFormState: FormState = {
  pdfFile: null,
  requirement: '',
  webSearch: false,
  interactiveMode: false,
};

function HomeDashboard() {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialFormState);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<
    import('@/lib/types/settings').SettingsSection | undefined
  >(undefined);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeNav, setActiveNav] = useState('workspace');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coursesSectionRef = useRef<HTMLDivElement>(null);

  // Draft cache for requirement text
  const { cachedValue: cachedRequirement, updateCache: updateRequirementCache } =
    useDraftCache<string>({ key: 'requirementDraft' });

  // Model setup state
  const currentModelId = useSettingsStore((s) => s.modelId);

  const [error, setError] = useState<string | null>(null);
  const [classrooms, setClassrooms] = useState<StageListItem[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, Slide>>({});

  // Hydrate client-only state after mount
  useEffect(() => {
    try {
      const savedWebSearch = localStorage.getItem(WEB_SEARCH_STORAGE_KEY);
      const savedInteractiveMode = localStorage.getItem(INTERACTIVE_MODE_STORAGE_KEY);
      const updates: Partial<FormState> = {};
      if (savedWebSearch === 'true') updates.webSearch = true;
      if (savedInteractiveMode === 'true') updates.interactiveMode = true;
      if (Object.keys(updates).length > 0) {
        setForm((prev) => ({ ...prev, ...updates }));
      }
    } catch {
      /* localStorage unavailable */
    }
  }, []);

  // Restore requirement draft from cache
  const [prevCachedRequirement, setPrevCachedRequirement] = useState(cachedRequirement);
  if (cachedRequirement !== prevCachedRequirement) {
    setPrevCachedRequirement(cachedRequirement);
    if (cachedRequirement) {
      setForm((prev) => ({ ...prev, requirement: cachedRequirement }));
    }
  }

  const loadClassrooms = async () => {
    try {
      const list = await listStages();
      setClassrooms(list);
      if (list.length > 0) {
        const slides = await getFirstSlideByStages(list.map((c) => c.id));
        setThumbnails(slides);
      }
    } catch (err) {
      log.error('Failed to load classrooms:', err);
    }
  };

  const { importing, handleFileChange } = useImportClassroom(() => {
    loadClassrooms();
  });

  useEffect(() => {
    useMediaGenerationStore.getState().revokeObjectUrls();
    useMediaGenerationStore.setState({ tasks: {} });
    loadClassrooms();

    // Show new feature notification for existing users
    const showNotice = useSettingsStore.getState().showImageGenerationFeatureNotice;
    if (showNotice) {
      // Delay to let the page render first
      setTimeout(() => {
        toast.custom(
          (id) => (
            <div
              className="w-[356px] rounded-xl border border-violet-200/60 dark:border-violet-800/40 bg-gradient-to-r from-violet-50 via-white to-violet-50 dark:from-violet-950/60 dark:via-slate-900 dark:to-violet-950/60 shadow-lg shadow-violet-500/8 dark:shadow-violet-900/20 p-4 flex items-start gap-3 cursor-pointer"
              onClick={() => {
                toast.dismiss(id);
                useSettingsStore.getState().dismissImageGenerationFeatureNotice();
                setSettingsSection('image');
                setSettingsOpen(true);
              }}
            >
              <div className="shrink-0 mt-0.5 size-9 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center ring-1 ring-violet-200/50 dark:ring-violet-800/30">
                <Atom className="size-4.5 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-violet-900 dark:text-violet-200 leading-tight">
                  {t('settings.newFeatureImageGeneration')}
                </p>
                <p className="text-xs text-violet-700/80 dark:text-violet-400/70 mt-0.5 leading-relaxed">
                  {t('settings.newFeatureImageGenerationDesc')}
                </p>
              </div>
            </div>
          ),
          { duration: 6000 },
        );
      }, 1500);
    }
  }, []);

  // 响应式：移动端自动折叠侧边栏
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const updateForm = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    try {
      if (field === 'webSearch') localStorage.setItem(WEB_SEARCH_STORAGE_KEY, String(value));
      if (field === 'interactiveMode')
        localStorage.setItem(INTERACTIVE_MODE_STORAGE_KEY, String(value));
      if (field === 'requirement') updateRequirementCache(value as string);
    } catch {
      /* ignore */
    }
  };

  const showSetupToast = (icon: React.ReactNode, title: string, desc: string) => {
    toast.custom(
      (id) => (
        <div
          className="w-[356px] rounded-xl border border-amber-200/60 dark:border-amber-800/40 bg-gradient-to-r from-amber-50 via-white to-amber-50 dark:from-amber-950/60 dark:via-slate-900 dark:to-amber-950/60 shadow-lg shadow-amber-500/8 dark:shadow-amber-900/20 p-4 flex items-start gap-3 cursor-pointer"
          onClick={() => {
            toast.dismiss(id);
            setSettingsOpen(true);
          }}
        >
          <div className="shrink-0 mt-0.5 size-9 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center ring-1 ring-amber-200/50 dark:ring-amber-800/30">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200 leading-tight">
              {title}
            </p>
            <p className="text-xs text-amber-700/80 dark:text-amber-400/70 mt-0.5 leading-relaxed">
              {desc}
            </p>
          </div>
        </div>
      ),
      { duration: 4000 },
    );
  };

  const handleGenerate = async () => {
    if (!currentModelId) {
      showSetupToast(
        <BotOff className="size-4.5 text-amber-600 dark:text-amber-400" />,
        t('settings.modelNotConfigured'),
        t('settings.setupNeeded'),
      );
      setSettingsOpen(true);
      return;
    }

    if (!form.requirement.trim()) {
      setError(t('upload.requirementRequired'));
      return;
    }

    setError(null);

    try {
      const userProfile = useUserProfileStore.getState();
      const requirements: UserRequirements = {
        requirement: form.requirement,
        userNickname: userProfile.nickname || undefined,
        userBio: userProfile.bio || undefined,
        webSearch: form.webSearch || undefined,
        interactiveMode: form.interactiveMode,
      };

      let pdfStorageKey: string | undefined;
      let pdfFileName: string | undefined;
      let pdfProviderId: string | undefined;
      let pdfProviderConfig: { apiKey?: string; baseUrl?: string } | undefined;

      if (form.pdfFile) {
        pdfStorageKey = await storePdfBlob(form.pdfFile);
        pdfFileName = form.pdfFile.name;

        const settings = useSettingsStore.getState();
        pdfProviderId = settings.pdfProviderId;
        const providerCfg = settings.pdfProvidersConfig?.[settings.pdfProviderId];
        if (providerCfg) {
          pdfProviderConfig = {
            apiKey: providerCfg.apiKey,
            baseUrl: providerCfg.baseUrl,
          };
        }
      }

      const sessionState = {
        sessionId: nanoid(),
        requirements,
        pdfText: '',
        pdfImages: [],
        imageStorageIds: [],
        pdfStorageKey,
        pdfFileName,
        pdfProviderId,
        pdfProviderConfig,
        sceneOutlines: null,
        currentStep: 'generating' as const,
      };
      sessionStorage.setItem('generationSession', JSON.stringify(sessionState));

      router.push('/generation-preview');
    } catch (err) {
      log.error('Error preparing generation:', err);
      setError(err instanceof Error ? err.message : t('upload.generateFailed'));
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t('classroom.today');
    if (diffDays === 1) return t('classroom.yesterday');
    if (diffDays < 7) return `${diffDays} ${t('classroom.daysAgo')}`;
    return date.toLocaleDateString();
  };

  const handleDelete = async (id: string) => {
    setPendingDeleteId(null);
    try {
      await deleteStageData(id);
      await loadClassrooms();
    } catch (err) {
      log.error('Failed to delete classroom:', err);
      toast.error('Failed to delete classroom');
    }
  };

  const handleRename = async (id: string, newName: string) => {
    try {
      await renameStage(id, newName);
      setClassrooms((prev) => prev.map((c) => (c.id === id ? { ...c, name: newName } : c)));
    } catch (err) {
      log.error('Failed to rename classroom:', err);
      toast.error(t('classroom.renameFailed'));
    }
  };

  // 导航处理
  const handleNavClick = (id: string) => {
    setActiveNav(id);
    if (id === 'classrooms' && coursesSectionRef.current) {
      coursesSectionRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    // 移动端点击导航后折叠侧边栏
    if (window.innerWidth < 768) {
      setSidebarCollapsed(true);
    }
  };

  // 导航项
  const navItems = [
    { id: 'workspace', icon: <Home className="size-5" />, label: '工作台' },
    { id: 'classrooms', icon: <BookOpen className="size-5" />, label: '我的课堂', badge: classrooms.length },
    { id: 'agents', icon: <Bot className="size-5" />, label: '智能体库' },
    { id: 'templates', icon: <Layers className="size-5" />, label: '模板库' },
  ];

  return (
    <div className="min-h-screen flex gap-4 md:gap-6 p-4 md:p-6 relative">
      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* ═══ 统一的 Glassmorphism 背景 ═══ */}
      <HomeBackground />

      {/* ═══ 悬浮毛玻璃侧边导航 ═══ */}
      <motion.aside
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className={cn(
          'shrink-0 flex flex-col fixed md:relative z-50 h-[calc(100vh-2rem)] md:h-auto',
          'bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl',
          'border border-white/50 dark:border-slate-700/50',
          'rounded-2xl md:rounded-3xl',
          'shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50',
          'transition-all duration-300',
          sidebarCollapsed ? 'w-16 p-3 -translate-x-full md:translate-x-0' : 'w-64 p-4 md:p-6',
          'md:translate-x-0',
        )}
        style={{
          transform: sidebarCollapsed ? 'translateX(-100%)' : undefined,
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 mb-6 md:mb-8">
          <motion.div
            whileHover={{ rotate: 180 }}
            transition={{ duration: 0.5 }}
            className="size-10 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow-lg shadow-violet-500/25 shrink-0"
          >
            <span className="text-white font-bold text-lg">M</span>
          </motion.div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="overflow-hidden"
              >
                <span className="text-xl font-bold tracking-tight text-slate-800 dark:text-white whitespace-nowrap">
                  OpenMAIC
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col gap-1 md:gap-2">
          {navItems.map((item) => (
            <motion.button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'flex items-center gap-3 px-3 md:px-4 py-2.5 md:py-3 rounded-xl font-medium transition-all',
                'relative overflow-hidden',
                activeNav === item.id
                  ? 'bg-white/80 dark:bg-slate-800/80 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-200',
              )}
            >
              {activeNav === item.id && (
                <motion.div
                  layoutId="activeIndicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r-full"
                />
              )}
              <span className="text-lg shrink-0">{item.icon}</span>
              <AnimatePresence>
                {!sidebarCollapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 text-left text-sm whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {item.badge !== undefined && !sidebarCollapsed && (
                <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                  {item.badge}
                </span>
              )}
            </motion.button>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
          <motion.button
            onClick={() => setSettingsOpen(true)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              'w-full flex items-center gap-3 px-3 md:px-4 py-2.5 md:py-3 rounded-xl',
              'text-slate-400 dark:text-slate-500',
              'hover:bg-white/50 dark:hover:bg-slate-800/50',
              'hover:text-slate-600 dark:hover:text-slate-300',
              'transition-colors',
            )}
          >
            <Settings className="size-5 shrink-0" />
            <AnimatePresence>
              {!sidebarCollapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-sm whitespace-nowrap"
                >
                  设置
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </motion.aside>

      {/* 移动端菜单按钮 */}
      <motion.button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="fixed bottom-6 left-6 z-50 md:hidden size-12 rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl shadow-lg flex items-center justify-center border border-white/50 dark:border-slate-700/50"
        whileTap={{ scale: 0.95 }}
      >
        {sidebarCollapsed ? <Menu className="size-5" /> : <X className="size-5" />}
      </motion.button>

      {/* ═══ 主工作区 ═══ */}
      <main className="flex-1 flex flex-col gap-6 md:gap-8 relative z-10 min-w-0">
        {/* 顶部工具栏 */}
        <div className="flex items-center justify-between gap-4">
          <motion.button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden md:flex size-10 rounded-xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm items-center justify-center text-slate-500 hover:bg-white/80 dark:hover:bg-slate-700/80 transition-colors"
            whileTap={{ scale: 0.95 }}
          >
            <Menu className="size-5" />
          </motion.button>
          
          <div className="flex-1" />
          
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl px-3 py-2 rounded-full border border-white/50 dark:border-slate-700/50 shadow-lg"
          >
            <LanguageSwitcher />
            <div className="w-px h-4 bg-slate-200/70 dark:bg-slate-700/70" />
            
            {/* Theme Selector */}
            <div className="relative group">
              <button className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50 transition-colors">
                {theme === 'light' && <Sun className="w-4 h-4" />}
                {theme === 'dark' && <Moon className="w-4 h-4" />}
                {theme === 'system' && <Monitor className="w-4 h-4" />}
              </button>
              <div className="absolute top-full right-0 mt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-xl shadow-xl border border-white/50 dark:border-slate-700/50 overflow-hidden min-w-[120px] z-50">
                <button onClick={() => setTheme('light')} className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-100/50 dark:hover:bg-slate-700/50 flex items-center gap-2">
                  <Sun className="w-4 h-4" /> 浅色
                </button>
                <button onClick={() => setTheme('dark')} className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-100/50 dark:hover:bg-slate-700/50 flex items-center gap-2">
                  <Moon className="w-4 h-4" /> 深色
                </button>
                <button onClick={() => setTheme('system')} className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-100/50 dark:hover:bg-slate-700/50 flex items-center gap-2">
                  <Monitor className="w-4 h-4" /> 系统
                </button>
              </div>
            </div>

            <div className="w-px h-4 bg-slate-200/70 dark:bg-slate-700/70" />
            
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50 transition-colors group"
            >
              <Settings className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500" />
            </button>
          </motion.div>
        </div>

        {/* ═══ AI 灵感引擎区域 ═══ */}
        <AIInspirationEngine
          value={form.requirement}
          onChange={(value) => updateForm('requirement', value)}
          onSubmit={handleGenerate}
          placeholder={t('upload.requirementPlaceholder')}
          disabled={!currentModelId}
        />

        {/* 附加工具栏 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap items-center gap-3 -mt-2"
        >
          <GenerationToolbar
            webSearch={form.webSearch}
            onWebSearchChange={(v) => updateForm('webSearch', v)}
            onSettingsOpen={(section) => {
              setSettingsSection(section);
              setSettingsOpen(true);
            }}
            pdfFile={form.pdfFile}
            onPdfFileChange={(f) => updateForm('pdfFile', f)}
            onPdfError={setError}
          />

          {/* Interactive mode toggle */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => updateForm('interactiveMode', !form.interactiveMode)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all',
              'border',
              form.interactiveMode
                ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 border-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.35)]'
                : 'border-cyan-300/60 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20',
            )}
          >
            <Atom className="size-4 animate-[spin_3s_linear_infinite]" />
            <span className="hidden sm:inline">{t('toolbar.interactiveModeLabel')}</span>
          </motion.button>

          {/* Voice input */}
          <SpeechButton
            size="md"
            onTranscription={(text) => {
              setForm((prev) => {
                const next = prev.requirement + (prev.requirement ? ' ' : '') + text;
                updateRequirementCache(next);
                return { ...prev, requirement: next };
              });
            }}
          />

          {/* Import button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <Upload className="size-4" />
            <span className="hidden sm:inline">{t('import.classroom')}</span>
          </button>
        </motion.div>

        {/* Error display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-2xl text-red-600 dark:text-red-400"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ 历史课堂网格 (Bento Box) ═══ */}
        <div ref={coursesSectionRef} className="mt-4 scroll-mt-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <BookOpen className="size-5 text-violet-500" />
              最近的课堂
              {classrooms.length > 0 && (
                <span className="text-sm font-normal text-slate-400 dark:text-slate-500">
                  ({classrooms.length})
                </span>
              )}
            </h2>
          </div>

          {classrooms.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500"
            >
              <div className="size-16 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                <BookOpen className="size-8 opacity-50" />
              </div>
              <p className="text-sm">{t('classroom.noClassrooms')}</p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {classrooms.map((classroom, index) => (
                <CourseCard
                  key={classroom.id}
                  classroom={classroom}
                  slide={thumbnails[classroom.id]}
                  index={index}
                  formatDate={formatDate}
                  t={t}
                  onDelete={(id) => setPendingDeleteId(id)}
                  onRename={handleRename}
                  confirmingDelete={pendingDeleteId === classroom.id}
                  onConfirmDelete={() => handleDelete(classroom.id)}
                  onCancelDelete={() => setPendingDeleteId(null)}
                  onClick={() => router.push(`/classroom/${classroom.id}`)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-auto pt-8 text-center text-xs text-slate-400 dark:text-slate-500">
          OpenMAIC Open Source Project
        </div>
      </main>

      {/* Settings Dialog */}
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={(open) => {
          setSettingsOpen(open);
          if (!open) setSettingsSection(undefined);
        }}
        initialSection={settingsSection}
      />
    </div>
  );
}

// 课程卡片组件
function CourseCard({
  classroom,
  slide,
  index,
  formatDate,
  t,
  onDelete,
  onRename,
  confirmingDelete,
  onConfirmDelete,
  onCancelDelete,
  onClick,
}: {
  classroom: StageListItem;
  slide?: Slide;
  index: number;
  formatDate: (ts: number) => string;
  t: (key: string) => string;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  confirmingDelete: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onClick: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const thumbRef = useRef<HTMLDivElement>(null);
  const [thumbWidth, setThumbWidth] = useState(0);

  useEffect(() => {
    const el = thumbRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setThumbWidth(Math.round(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const gradientColors = [
    'from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30',
    'from-emerald-100 to-cyan-100 dark:from-emerald-900/30 dark:to-cyan-900/30',
    'from-orange-100 to-pink-100 dark:from-orange-900/30 dark:to-pink-900/30',
    'from-violet-100 to-indigo-100 dark:from-violet-900/30 dark:to-indigo-900/30',
  ];
  const gradientClass = gradientColors[index % gradientColors.length];

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!thumbRef.current) return;
    const rect = thumbRef.current.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const startRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNameDraft(classroom.name);
    setEditing(true);
  };

  const commitRename = () => {
    if (!editing) return;
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== classroom.name) {
      onRename(classroom.id, trimmed);
    }
    setEditing(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      whileHover={{ y: -4 }}
      onClick={confirmingDelete ? undefined : onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'group cursor-pointer',
        'bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm',
        'rounded-2xl md:rounded-3xl',
        'border border-white/50 dark:border-slate-700/50',
        'shadow-sm hover:shadow-xl',
        'transition-all duration-300',
        'overflow-hidden',
        'p-4 md:p-5',
      )}
    >
      {/* 缩略图区域 */}
      <div
        ref={thumbRef}
        onMouseMove={handleMouseMove}
        className={cn(
          'h-28 md:h-32 rounded-xl md:rounded-2xl mb-4 relative overflow-hidden',
          'bg-gradient-to-br',
          gradientClass,
        )}
      >
        {/* 真实缩略图 */}
        {slide && thumbWidth > 0 && (
          <ThumbnailSlide
            slide={slide}
            size={thumbWidth}
            viewportSize={slide.viewportSize ?? 1000}
            viewportRatio={slide.viewportRatio ?? 0.5625}
          />
        )}

        {/* 光泽扫过效果 */}
        <motion.div
          className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: `radial-gradient(400px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(255,255,255,0.2), transparent 40%)`,
          }}
        />

        {/* 悬浮播放按钮 */}
        <div
          className={cn(
            'absolute inset-0 bg-black/10',
            'opacity-0 group-hover:opacity-100',
            'transition-opacity duration-300',
            'flex items-center justify-center',
          )}
        >
          <motion.div
            initial={{ scale: 0.8 }}
            whileHover={{ scale: 1 }}
            className="size-12 bg-white rounded-full flex items-center justify-center shadow-lg"
          >
            <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[12px] border-l-slate-800 border-b-[8px] border-b-transparent ml-1" />
          </motion.div>
        </div>

        {/* 幻灯片数量标签 */}
        <div className="absolute top-2 right-2 px-2 py-1 bg-black/20 backdrop-blur-sm rounded-lg text-xs font-medium text-white">
          {classroom.sceneCount} 页
        </div>

        {/* 操作按钮 */}
        <AnimatePresence>
          {!confirmingDelete && isHovered && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="absolute top-2 left-2 flex gap-1.5"
            >
              <button
                onClick={startRename}
                className="size-7 rounded-full bg-black/20 hover:bg-black/40 text-white backdrop-blur-sm flex items-center justify-center transition-colors"
              >
                <Pencil className="size-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(classroom.id);
                }}
                className="size-7 rounded-full bg-black/20 hover:bg-red-500/80 text-white backdrop-blur-sm flex items-center justify-center transition-colors"
              >
                <Trash2 className="size-3" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 删除确认 */}
        <AnimatePresence>
          {confirmingDelete && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/60 backdrop-blur-md"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-sm font-medium text-white/90">确认删除？</span>
              <div className="flex gap-2">
                <button
                  onClick={onCancelDelete}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-white/80 hover:bg-white/20 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={onConfirmDelete}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  删除
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 标题 */}
      {editing ? (
        <div onClick={(e) => e.stopPropagation()}>
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setEditing(false);
            }}
            onBlur={commitRename}
            autoFocus
            className="w-full bg-transparent border-b-2 border-violet-400 text-sm font-semibold text-slate-800 dark:text-white outline-none pb-1"
          />
        </div>
      ) : (
        <h3 className="font-semibold text-sm md:text-base text-slate-800 dark:text-white mb-1 line-clamp-1">
          {classroom.name}
        </h3>
      )}

      {/* 底部信息 */}
      <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 mt-2">
        <span>{formatDate(classroom.updatedAt)}</span>
        <div className="flex -space-x-1.5">
          {['bg-blue-500', 'bg-emerald-500', 'bg-purple-500'].map((color, i) => (
            <div key={i} className={cn('size-5 rounded-full border-2 border-white dark:border-slate-900', color)} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export default function Page() {
  return <HomeDashboard />;
}
