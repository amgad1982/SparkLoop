import React, { useState } from 'react';
import { useThemeStore } from '../../stores/useThemeStore';
import { api } from '../../services/apiClient';
import { ChainDto } from '../../types/api';
import { GitBranch, Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CreateChainModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChainCreated: (chain: ChainDto) => void;
}

export const CreateChainModal: React.FC<CreateChainModalProps> = ({
  isOpen,
  onClose,
  onChainCreated,
}) => {
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';

  const [title, setTitle] = useState('');
  const [theme, setTheme] = useState('Cyberpunk');
  const [maxSteps, setMaxSteps] = useState<number>(10);
  const [initialContent, setInitialContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !initialContent.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const created = await api.createChain(title.trim(), theme.trim(), maxSteps, initialContent.trim());
      onChainCreated(created);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Creation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4 text-white shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-fuchsia-400" />
                <h3 className="font-bold text-lg">
                  {isArabic ? 'بدء سلسلة قصة جديدة' : 'Start a New Story Chain'}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-zinc-400 hover:text-white rounded-full bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-400 font-semibold mb-1">
                  {isArabic ? 'عنوان السلسلة' : 'Story Title'}
                </label>
                <input
                  type="text"
                  required
                  maxLength={150}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={isArabic ? 'مثال: لغز المختبر المفقود' : 'e.g. The Midnight Glitch'}
                  className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-fuchsia-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">
                    {isArabic ? 'الثيم / النوع' : 'Theme'}
                  </label>
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-fuchsia-500"
                  >
                    <option value="Cyberpunk">Cyberpunk / خيال علمي</option>
                    <option value="Comedy">Comedy Improv / كوميديا</option>
                    <option value="Mystery">Mystery / غموض وتشويق</option>
                    <option value="Fantasy">Fantasy / مغامرات وسحر</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">
                    {isArabic ? 'عدد الأدوار' : 'Max Steps Limit'}
                  </label>
                  <div className="flex gap-2">
                    {[5, 10, 20].map((steps) => (
                      <button
                        type="button"
                        key={steps}
                        onClick={() => setMaxSteps(steps)}
                        className={`flex-1 py-2 rounded-xl font-bold border transition-colors ${
                          maxSteps === steps
                            ? 'bg-fuchsia-500 text-white border-fuchsia-400'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {steps}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-semibold mb-1">
                  {isArabic ? 'الجملة الافتتاحية (الدور 1)' : 'Opening Sentence (Turn #1)'}
                </label>
                <textarea
                  rows={2}
                  required
                  maxLength={100}
                  value={initialContent}
                  onChange={(e) => setInitialContent(e.target.value)}
                  placeholder={
                    isArabic
                      ? 'اكتب الجملة الأولى لتشعل القصة (أقل من 100 حرف)...'
                      : 'Write the opening beat (max 100 chars)...'
                  }
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white resize-none focus:outline-none focus:border-fuchsia-500"
                />
              </div>

              {error && (
                <div className="p-2.5 bg-rose-950/40 border border-rose-800 rounded-xl text-rose-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !title.trim() || !initialContent.trim()}
                className="w-full py-3 bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
              >
                <Plus className="w-4 h-4" />
                <span>{isSubmitting ? (isArabic ? 'جاري الإنشاء...' : 'Creating...') : (isArabic ? 'إطلاق السلسلة 🚀' : 'Launch Chain 🚀')}</span>
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
