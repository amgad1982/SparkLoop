import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';

class MusicCopyrightDialog extends StatefulWidget {
  final List<String> fileNames;

  const MusicCopyrightDialog({
    super.key,
    required this.fileNames,
  });

  static Future<bool?> show(
    BuildContext context, {
    required List<String> fileNames,
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => MusicCopyrightDialog(fileNames: fileNames),
    );
  }

  @override
  State<MusicCopyrightDialog> createState() => _MusicCopyrightDialogState();
}

class _MusicCopyrightDialogState extends State<MusicCopyrightDialog> {
  bool _hasAgreed = false;
  bool _showArabic = false;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isRtl = Directionality.of(context) == TextDirection.rtl;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.88,
      ),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        border: Border.all(
          color: AppColors.accentAmber.withValues(alpha: 0.3),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.5),
            blurRadius: 30,
            offset: const Offset(0, -10),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Handle bar
            Center(
              child: Container(
                width: 44,
                height: 4,
                margin: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: Colors.grey.withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),

            // Header with Shield & Language Switcher
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: AppColors.accentAmber.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: AppColors.accentAmber.withValues(alpha: 0.4),
                      ),
                    ),
                    child: const Icon(
                      Icons.shield_outlined,
                      color: AppColors.accentAmber,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              _showArabic || isRtl
                                  ? 'إقرار ملكية حقوق الموسيقى'
                                  : 'Music Copyright Attestation',
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppColors.accentAmber.withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Text(
                                'v1.0',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.accentAmber,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          _showArabic || isRtl
                            ? 'إقرار قانوني إلزامي قبل رفع المقطوعة إلى الخوادم'
                            : 'Mandatory legal agreement before hosting on cloud',
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.grey.shade400,
                          ),
                        ),
                      ],
                    ),
                  ),
                  TextButton(
                    onPressed: () => setState(() => _showArabic = !_showArabic),
                    style: TextButton.styleFrom(
                      visualDensity: VisualDensity.compact,
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                    ),
                    child: Text(
                      _showArabic ? 'EN' : 'عربي',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: AppColors.accentAmber,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const Divider(height: 16),

            // Scrollable Content
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Warning Banner
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.accentAmber.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: AppColors.accentAmber.withValues(alpha: 0.3),
                        ),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(
                            Icons.warning_amber_rounded,
                            color: AppColors.accentAmber,
                            size: 20,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              _showArabic || isRtl
                                  ? 'منصة SparkLoop هي مزود خدمة تقني وسيط فقط. المستخدم وحده هو من يتحمل المسؤولية الجنائية والمدنية الكاملة عن أي انتهاك لحقوق الطبع والنشر.'
                                  : 'SparkLoop acts strictly as a passive technical hosting provider. You assume 100% full legal, civil, and criminal liability for copyrighted material you upload.',
                              style: const TextStyle(
                                fontSize: 11,
                                height: 1.4,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 14),

                    // Pending Files Summary
                    if (widget.fileNames.isNotEmpty) ...[
                      Text(
                        _showArabic || isRtl ? 'المقاطع المحددة للرفع:' : 'Files to be Hosted:',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 6),
                      ...widget.fileNames.map(
                        (f) => Padding(
                          padding: const EdgeInsets.only(bottom: 4),
                          child: Row(
                            children: [
                              const Icon(Icons.music_note, size: 14, color: AppColors.primaryLight),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  f,
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: Colors.grey.shade300,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],

                    // Policy Clauses
                    _buildClause(
                      number: '1',
                      title: _showArabic || isRtl
                          ? 'ملكية المصنف والترخيص القانوني'
                          : 'Exclusive Ownership & Authorization',
                      desc: _showArabic || isRtl
                          ? 'تقر وتضمن بأنك المالك الأصلي أو صاحب الترخيص القانوني المعتمد لبث واستضافة هذا المحتوى.'
                          : 'You warrant that you are the sole creator/copyright owner or hold all necessary legal rights.',
                    ),
                    _buildClause(
                      number: '2',
                      title: _showArabic || isRtl
                          ? 'المسؤولية القانونية والتعويض الكامل'
                          : 'Sole User Liability & Full Indemnity',
                      desc: _showArabic || isRtl
                          ? 'تلتزم بالتعويض الكامل للمنصة ومشغليها عن أي نزاع أو ملاحقة قضائية أو مطالبات بالتعويض.'
                          : 'You agree to defend, indemnify, and hold harmless SparkLoop against any copyright infringement claims.',
                    ),
                    _buildClause(
                      number: '3',
                      title: _showArabic || isRtl
                          ? 'الملاذ الآمن وإجراءات الحذف (DMCA)'
                          : 'Safe Harbor Protection & Takedown',
                      desc: _showArabic || isRtl
                          ? 'تتمتع المنصة بالحماية كمزود وسيط وستقوم بالحذف الفوري لأي مادة فور تلقي إخطار رسمي بانتهاك الحقوق.'
                          : 'SparkLoop qualifies for intermediary safe harbor and will immediately remove disputed content upon notice.',
                    ),
                    _buildClause(
                      number: '4',
                      title: _showArabic || isRtl
                          ? 'البصمة الرقمية وسجل الإقرار الدائم'
                          : 'Cryptographic SHA-256 Audit Trail',
                      desc: _showArabic || isRtl
                          ? 'يتم تسجيل بصمة تجزئة SHA-256 للملف مع عنوان IP ومعرفك في سجل غير قابل للتعديل لتقديمه للجهات الرسمية.'
                          : 'An immutable SHA-256 fingerprint, IP address, and timestamp are preserved as legal evidence of compliance.',
                    ),
                  ],
                ),
              ),
            ),

            // Checkbox & Action Buttons
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: isDark ? AppColors.cardDark : Colors.grey.shade50,
                border: Border(
                  top: BorderSide(
                    color: isDark ? AppColors.borderDark : AppColors.borderLight,
                  ),
                ),
              ),
              child: Column(
                children: [
                  GestureDetector(
                    onTap: () => setState(() => _hasAgreed = !_hasAgreed),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Checkbox(
                          value: _hasAgreed,
                          onChanged: (v) => setState(() => _hasAgreed = v ?? false),
                          activeColor: AppColors.accentAmber,
                          materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _showArabic || isRtl
                                ? 'أقر وأتعهد بأنني المالك الحصري لهذه المقاطع الموسيقية وأتحمل كامل المسؤولية الفردية والجنائية والمدنية، وأوافق على سياسة SparkLoop لحقوق الملكية.'
                                : 'I certify that I own or hold valid licenses to this audio, assume 100% legal responsibility, and agree to the SparkLoop Copyright Policy.',
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              height: 1.3,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => Navigator.of(context).pop(false),
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                          ),
                          child: Text(_showArabic || isRtl ? 'إلغاء' : 'Cancel'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        flex: 2,
                        child: ElevatedButton.icon(
                          onPressed: _hasAgreed ? () => Navigator.of(context).pop(true) : null,
                          icon: const Icon(Icons.cloud_upload_outlined, size: 18),
                          label: Text(
                            _showArabic || isRtl ? 'توثيق ورفع للسيرفر ☁️' : 'Attest & Upload ☁️',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.accentAmber,
                            foregroundColor: Colors.black,
                            disabledBackgroundColor: Colors.grey.withValues(alpha: 0.2),
                            disabledForegroundColor: Colors.grey.shade500,
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildClause({
    required String number,
    required String title,
    required String desc,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 20,
            height: 20,
            margin: const EdgeInsets.only(top: 2),
            decoration: BoxDecoration(
              color: AppColors.accentAmber.withValues(alpha: 0.2),
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Text(
              number,
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.bold,
                color: AppColors.accentAmber,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  desc,
                  style: TextStyle(
                    fontSize: 10,
                    color: Colors.grey.shade400,
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
