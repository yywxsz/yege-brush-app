'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Send, Lightbulb, Plus, Replace } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIInspirationEngineProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  disabled?: boolean;
}

const INSPIRATION_PROMPTS = [
  '探索代数的奥秘',
  '量子力学入门',
  '人工智能基础',
  '数据结构与算法',
  '英语口语提升',
  '创意写作技巧',
];

/**
 * AIInspirationEngine - Main input area with inspiration suggestions
 * Supports both append and replace modes when user clicks inspiration prompts
 */
export function AIInspirationEngine({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled,
}: AIInspirationEngineProps) {
  const [showInspirations, setShowInspirations] = useState(false);
  const [insertMode, setInsertMode] = useState<'append' | 'replace'>('append');

  const handleInspirationClick = (prompt: string) => {
    if (value.trim()) {
      // User already has content - use current insert mode
      if (insertMode === 'append') {
        onChange(value.trim() + '，' + prompt);
      } else {
        onChange(prompt);
      }
    } else {
      // Empty input - just set the prompt
      onChange(prompt);
    }
    setShowInspirations(false);
  };

  const toggleInsertMode = () => {
    setInsertMode((prev) => (prev === 'append' ? 'replace' : 'append'));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="relative"
    >
      {/* Main input container */}
      <div
        className={cn(
          'relative rounded-2xl overflow-hidden',
          'bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl',
          'border border-white/50 dark:border-slate-700/50',
          'shadow-xl shadow-slate-200/30 dark:shadow-slate-900/30',
          'transition-all duration-300',
          'hover:shadow-2xl hover:shadow-slate-200/40 dark:hover:shadow-slate-900/40',
        )}
      >
        {/* Gradient border effect */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-violet-500/20 via-blue-500/20 to-cyan-500/20 opacity-0 hover:opacity-100 transition-opacity duration-500" style={{ padding: '1px' }}>
          <div className="absolute inset-[1px] rounded-2xl bg-white/60 dark:bg-slate-800/60" />
        </div>

        {/* Input area */}
        <div className="relative p-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 size-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <Sparkles className="size-5 text-white" />
            </div>
            
            <div className="flex-1 min-w-0">
              <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                rows={3}
                className={cn(
                  'w-full resize-none bg-transparent',
                  'text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500',
                  'focus:outline-none text-base leading-relaxed',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              />
            </div>
          </div>

          {/* Action bar */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-700/50">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowInspirations(!showInspirations)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm',
                  'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
                  'hover:bg-slate-100/50 dark:hover:bg-slate-700/50 transition-colors',
                )}
              >
                <Lightbulb className="size-4" />
                <span>灵感</span>
              </button>
              {showInspirations && (
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full',
                  insertMode === 'append'
                    ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
                )}>
                  {insertMode === 'append' ? '追加模式' : '替换模式'}
                </span>
              )}
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onSubmit}
              disabled={disabled || !value.trim()}
              className={cn(
                'flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium',
                'bg-gradient-to-r from-violet-500 to-blue-500 text-white',
                'shadow-lg shadow-violet-500/25',
                'hover:shadow-xl hover:shadow-violet-500/30',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg',
                'transition-shadow duration-300',
              )}
            >
              <Send className="size-4" />
              <span>生成课程</span>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Inspiration suggestions dropdown */}
      <AnimatePresence>
        {showInspirations && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'absolute left-0 right-0 mt-2 p-3 rounded-xl z-10',
              'bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl',
              'border border-white/50 dark:border-slate-700/50',
              'shadow-xl shadow-slate-200/30 dark:shadow-slate-900/30',
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-slate-500 dark:text-slate-400">试试这些主题：</div>
              {value.trim() && (
                <button
                  type="button"
                  onClick={toggleInsertMode}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded text-xs',
                    'text-slate-500 dark:text-slate-400',
                    'hover:bg-slate-100/50 dark:hover:bg-slate-700/50 transition-colors',
                  )}
                  title={insertMode === 'append' ? '追加到现有内容后' : '替换现有内容'}
                >
                  {insertMode === 'append' ? (
                    <>
                      <Plus className="size-3" />
                      <span>追加</span>
                    </>
                  ) : (
                    <>
                      <Replace className="size-3" />
                      <span>替换</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {INSPIRATION_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleInspirationClick(prompt)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm',
                    'bg-slate-100/50 dark:bg-slate-700/50',
                    'text-slate-600 dark:text-slate-300',
                    'hover:bg-violet-100/50 dark:hover:bg-violet-900/30',
                    'hover:text-violet-600 dark:hover:text-violet-300',
                    'transition-colors duration-200',
                  )}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
