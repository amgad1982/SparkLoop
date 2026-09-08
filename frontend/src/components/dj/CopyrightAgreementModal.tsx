import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert,
  FileCheck2,
  Lock,
  ExternalLink,
  X,
  AlertTriangle,
  Sparkles,
  Music,
  CheckCircle2,
} from 'lucide-react';
import { useThemeStore } from '../../stores/useThemeStore';

interface PendingUploadTrack {
  file: File;
  title: string;
  artist?: string;
  durationSeconds?: number;
}

interface CopyrightAgreementModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingTracks: PendingUploadTrack[];
  onConfirmUpload: () => void;
  isUploading?: boolean;
  uploadProgress?: { current: number; total: number; trackTitle: string };
}

export const CopyrightAgreementModal: React.FC<CopyrightAgreementModalProps> = ({
  isOpen,
  onClose,
  pendingTracks,
  onConfirmUpload,
  isUploading = false,
  uploadProgress,
}) => {
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';

  const [hasAcknowledged, setHasAcknowledged] = useState(false);
  const [activeTab, setActiveTab] = useState<'policy' | 'tracks'>('policy');

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          className="relative w-full max-w-2xl bg-slate-900/95 border border-amber-500/30 rounded-3xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh]"
        >
          {/* Glowing gradient header backdrop */}
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-amber-500/15 via-fuchsia-600/10 to-transparent pointer-events-none" />

          {/* Header */}
          <div className="relative p-5 sm:p-6 pb-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shadow-lg shadow-amber-500/10 text-amber-400">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  {isArabic ? 'إقرار ملكية حقوق المقطوعات ومسؤولية الرفع' : 'Music Ownership & Copyright Responsibility'}
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Policy v1.0
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  {isArabic
                    ? 'يرجى مراجعة الشروط القانونية الإلزامية قبل رفع المقاطع إلى خوادم SparkLoop'
                    : 'Mandatory legal agreement before hosting music tracks on SparkLoop cloud'}
                </p>
              </div>
            </div>

            {!isUploading && (
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Nav Tabs (Policy Clauses / Pending Tracks) */}
          <div className="flex border-b border-slate-800 bg-slate-900/50 px-6 pt-2">
            <button
              onClick={() => setActiveTab('policy')}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'policy'
                  ? 'border-amber-400 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>{isArabic ? 'البنود القانونية والإقرار' : 'Legal Clauses & Attestation'}</span>
            </button>
            <button
              onClick={() => setActiveTab('tracks')}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'tracks'
                  ? 'border-amber-400 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              <span>
                {isArabic ? 'الملفات المحددة للرفع' : 'Tracks to Upload'} ({pendingTracks.length})
              </span>
            </button>
          </div>

          {/* Body Content */}
          <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs leading-relaxed text-slate-300">
            {activeTab === 'policy' ? (
              <>
                {/* Notice Alert */}
                <div className="rounded-2xl p-4 bg-amber-950/30 border border-amber-500/30 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-slate-200">
                    <p className="font-semibold text-amber-300">
                      {isArabic
                        ? 'تنبيه قانوني هام للمستخدم والناشر:'
                        : 'Crucial Legal Notice regarding music uploads:'}
                    </p>
                    <p className="text-[11px] text-slate-300">
                      {isArabic
                        ? 'تطبيق SparkLoop مزود خدمة وسيط تقني فقط ولا يمتلك أو يدقق أو يراجع محتوى المقطوعات الصوتية المرفوعة من قبل المستخدمين. المستخدم وحده هو من يتحمل المسؤولية الجنائية والمدنية الكاملة.'
                        : 'SparkLoop acts strictly as a passive technical hosting provider. SparkLoop does not claim ownership or license your tracks, nor do we pre-screen user files. You assume 100% full legal, civil, and criminal liability for copyrighted material.'}
                    </p>
                  </div>
                </div>

                {/* Clauses Grid */}
                <div className="space-y-3">
                  {/* Clause 1: Ownership */}
                  <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-700/60">
                    <h4 className="font-bold text-white flex items-center gap-2 mb-1">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-[11px] flex items-center justify-center font-mono">
                        1
                      </span>
                      {isArabic ? 'ملكية المصنف والترخيص القانوني' : 'Exclusive Ownership & Authorization'}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      {isArabic
                        ? 'تقر وتضمن أنك المالك الأصلي أو المرخص له قانونياً بنشر وتوزيع واستضافة هذا المحتوى الصوتي، وأن رفعك للمقطع لا ينتهك أي حقوق نشر، علامات تجارية، أو حقوق ملكية فكرية لأي طرف ثالث.'
                        : 'You warrant and represent that you are the sole creator/copyright holder or hold all necessary licenses, releases, and authorizations to distribute, broadcast, and store this audio recording.'}
                    </p>
                  </div>

                  {/* Clause 2: Legal Liability */}
                  <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-700/60">
                    <h4 className="font-bold text-white flex items-center gap-2 mb-1">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-[11px] flex items-center justify-center font-mono">
                        2
                      </span>
                      {isArabic ? 'المسؤولية القانونية والتعويض الكامل' : 'Sole User Liability & Full Indemnity'}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      {isArabic
                        ? 'تتحمل منفرداً أية مطالبات، ملاحقات قضائية، أو تعويضات مالية ناشئة عن رفع هذه المادة. وتلتزم بتعويض SparkLoop ومشغليها عن أي أضرار أو أتعاب قانونية قد تنشأ عن مخالفة هذه السياسة.'
                        : 'You assume exclusive legal responsibility for any infringement. You agree to defend, indemnify, and hold harmless SparkLoop and its operators against all claims, damages, liabilities, or legal expenses.'}
                    </p>
                  </div>

                  {/* Clause 3: Safe Harbor & Takedown */}
                  <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-700/60">
                    <h4 className="font-bold text-white flex items-center gap-2 mb-1">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-[11px] flex items-center justify-center font-mono">
                        3
                      </span>
                      {isArabic ? 'الحماية القانونية للمزود وإجراءات الإزالة (DMCA)' : 'Service Provider Safe Harbor & DMCA Takedowns'}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      {isArabic
                        ? 'تتمتع المنصة بالحماية وفقاً لقوانين الملاذ الآمن لمزودي الخدمة التقنية (DMCA). تحتفظ SparkLoop بحق الحذف الفوري لأي مادة مسجلة ومرفوعة حال تلقي إخطار رسمي بانتهاك حقوق الملكية.'
                        : 'SparkLoop qualifies for intermediary safe harbor protections. Any track subject to a valid DMCA takedown notice or intellectual property dispute will be removed immediately without prior liability.'}
                    </p>
                  </div>

                  {/* Clause 4: Audit Trail */}
                  <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-700/60">
                    <h4 className="font-bold text-white flex items-center gap-2 mb-1">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-[11px] flex items-center justify-center font-mono">
                        4
                      </span>
                      {isArabic ? 'البصمة الرقمية وسجل الإقرار الدائم' : 'Cryptographic Proof & Immutable Audit Record'}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      {isArabic
                        ? 'يتم تسجيل بصمة تجزئة SHA-256 للملف مع عنوان IP، وتوقيت الإقرار، ومعرف حسابك في سجل دائم غير قابل للتعديل لتقديمه كدليل قانوني للسلطات المختصة عند الطلب.'
                        : 'Upon confirmation, an immutable audit record is stored with the file SHA-256 hash, client IP address, user agent, and timestamp to serve as legal evidence of your attestation.'}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              /* Tracks List Tab */
              <div className="space-y-2">
                <p className="text-xs text-slate-400 mb-2">
                  {isArabic
                    ? 'سيتم رفع المقاطع التالية وتخزينها على خوادم المنصة مع توثيق إقرار ملكيتك لها:'
                    : 'The following tracks will be uploaded and hosted on SparkLoop servers under your signed attestation:'}
                </p>
                {pendingTracks.map((pt, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/50 border border-slate-700/70"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-400 shrink-0">
                        <Music className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate text-xs">{pt.title}</p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {pt.artist || 'Unknown Artist'} • {(pt.file.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                      MP3 / Audio
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upload Progress Status if Active */}
          {isUploading && uploadProgress && (
            <div className="px-6 py-3 bg-fuchsia-950/40 border-t border-fuchsia-500/30">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-medium text-fuchsia-300 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  {isArabic ? 'جاري الرفع والتوثيق...' : 'Uploading & Attesting track...'} (
                  {uploadProgress.current}/{uploadProgress.total})
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {uploadProgress.trackTitle}
                </span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-fuchsia-500 to-amber-500 transition-all duration-300"
                  style={{
                    width: `${Math.round((uploadProgress.current / uploadProgress.total) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Footer & Acknowledgment Checkbox */}
          <div className="p-5 sm:p-6 pt-4 border-t border-slate-800 bg-slate-900/90 flex flex-col gap-4">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasAcknowledged}
                onChange={(e) => setHasAcknowledged(e.target.checked)}
                disabled={isUploading}
                className="mt-0.5 w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-400/40 cursor-pointer accent-amber-500"
              />
              <span className="text-xs text-slate-200 leading-snug">
                {isArabic ? (
                  <>
                    <strong className="text-amber-400">أوافق وأتعهد قانونياً:</strong> أنني المالك الحصري أو المرخص له قانونياً بنشر هذه المقطوعات الموسيقية، وأتحمل كامل المسؤولية الفردية والجنائية والمدنية عن أي حقوق ملكية فكرية، وأعفي منصة SparkLoop تماماً من أي مسؤولية.
                  </>
                ) : (
                  <>
                    <strong className="text-amber-400">I solemnly declare & agree:</strong> I am the exclusive owner or licensed holder of these audio files. I assume 100% full legal, civil, and criminal liability for copyright infringement and indemnify SparkLoop from all claims.
                  </>
                )}
              </span>
            </label>

            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={isUploading}
                className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isArabic ? 'إلغاء' : 'Cancel'}
              </button>

              <button
                type="button"
                onClick={onConfirmUpload}
                disabled={!hasAcknowledged || isUploading}
                className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-fuchsia-600 hover:from-amber-400 hover:to-fuchsia-500 text-white text-xs font-bold transition-all shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2 cursor-pointer"
              >
                {isUploading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{isArabic ? 'جاري الرفع والتوثيق...' : 'Uploading to Cloud...'}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {isArabic
                        ? `توثيق ورفع (${pendingTracks.length}) مقاطع للسيرفر ☁️`
                        : `Attest & Upload (${pendingTracks.length}) Tracks ☁️`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
