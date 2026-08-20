import React, { useRef, useState, useEffect } from 'react';
import { useThemeStore } from '../../stores/useThemeStore';
import { Download, Image as ImageIcon, Paintbrush, Send, Sparkles, Trash2, Type, Undo } from 'lucide-react';
import { api } from '../../services/apiClient';

interface MemeCanvasEditorProps {
  onPublishPost?: (mediaUrl: string, caption: string) => void;
  onPublishSpark?: (mediaUrl: string, caption: string) => void;
}

const MEME_TEMPLATES = [
  {
    id: 'cyber',
    name: 'Cyberpunk 2099',
    url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'retro',
    name: 'Neon Grid',
    url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'matrix',
    name: 'Glitch Stream',
    url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'space',
    name: 'Deep Cosmos',
    url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=600&auto=format&fit=crop&q=80',
  },
];

const STICKERS = ['🔥', '😂', '🚀', '💎', '👑', '⚡', '🌟', '💀', '🤖', '✨', '🧠', '👀'];

interface StickerItem {
  id: string;
  emoji: string;
  x: number;
  y: number;
  size: number;
}

export const MemeCanvasEditor: React.FC<MemeCanvasEditorProps> = ({
  onPublishPost,
  onPublishSpark,
}) => {
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState(MEME_TEMPLATES[0].url);
  const [topText, setTopText] = useState('WHEN YOU DEPLOY TO PROD');
  const [bottomText, setBottomText] = useState('AND EVERYTHING WORKS FIRST TRY');
  const [fontSize, setFontSize] = useState(28);
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPenActive, setIsPenActive] = useState(false);
  const [penColor, setPenColor] = useState('#d946ef');
  const [penSize, setPenSize] = useState(4);
  const [stickers, setStickers] = useState<StickerItem[]>([]);
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const drawHistory = useRef<ImageData[]>([]);
  const isMouseDown = useRef(false);

  // Redraw full canvas
  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = selectedTemplate;
    img.onload = () => {
      // Clear and draw background image
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Draw Top Text
      if (topText.trim()) {
        drawMemeText(ctx, topText, canvas.width / 2, fontSize + 15, fontSize, textColor, canvas.width);
      }

      // Draw Bottom Text
      if (bottomText.trim()) {
        drawMemeText(ctx, bottomText, canvas.width / 2, canvas.height - 25, fontSize, textColor, canvas.width);
      }

      // Draw Stickers
      stickers.forEach((s) => {
        ctx.font = `${s.size}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(s.emoji, s.x, s.y);
      });
    };
  };

  const drawMemeText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    size: number,
    color: string,
    maxWidth: number
  ) => {
    ctx.font = `900 ${size}px 'Inter', 'Cairo', Impact, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = size / 6;
    ctx.lineJoin = 'round';

    ctx.strokeText(text, x, y, maxWidth - 30);
    ctx.fillText(text, x, y, maxWidth - 30);
  };

  useEffect(() => {
    renderCanvas();
  }, [selectedTemplate, topText, bottomText, fontSize, textColor, stickers]);

  // Touch & Mouse Drawing Handling
  const handleStartDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isPenActive) return;
    isMouseDown.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penSize;
    ctx.lineCap = 'round';
  };

  const handleDrawMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isPenActive || !isMouseDown.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleEndDraw = () => {
    isMouseDown.current = false;
  };

  const addSticker = (emoji: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const newSticker: StickerItem = {
      id: Math.random().toString(),
      emoji,
      x: canvas.width / 2 + (Math.random() * 80 - 40),
      y: canvas.height / 2 + (Math.random() * 80 - 40),
      size: 40,
    };
    setStickers([...stickers, newSticker]);
  };

  const clearCanvasStickers = () => {
    setStickers([]);
    renderCanvas();
  };

  const exportWebPBlob = (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const canvas = canvasRef.current;
      if (!canvas) return reject(new Error('Canvas not found'));

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('WebP conversion failed'));
        },
        'image/webp',
        0.92
      );
    });
  };

  const handleDownload = async () => {
    try {
      const blob = await exportWebPBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sparkloop_meme_${Date.now()}.webp`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const handlePublish = async (destination: 'feed' | 'spark') => {
    setIsUploading(true);
    setStatusMessage(isArabic ? 'جاري تصدير الميم بصيغة WebP ورفعه...' : 'Exporting WebP & uploading...');

    try {
      const blob = await exportWebPBlob();
      const uploadRes = await api.uploadMedia(blob, `meme_${Date.now()}.webp`);

      const finalCaption = caption.trim() || `${topText} - ${bottomText}`;

      if (destination === 'feed') {
        await api.createPost(finalCaption, uploadRes.url, 'MemeWebP', 400, 400);
        setStatusMessage(isArabic ? 'تم نشر الميم في الصفحة الرئيسية! 🎉' : 'Published to Feed! 🎉');
        if (onPublishPost) onPublishPost(uploadRes.url, finalCaption);
      } else {
        const activeSpark = await api.getActiveSpark();
        await api.submitSparkEntry(activeSpark.id, finalCaption, uploadRes.url);
        setStatusMessage(isArabic ? 'تمت المشاركة في تحدي اليوم! 🏆' : 'Submitted to Daily Spark! 🏆');
        if (onPublishSpark) onPublishSpark(uploadRes.url, finalCaption);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setStatusMessage(`Error: ${msg}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4 text-white">
      {/* Editor Header */}
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-fuchsia-400" />
          <h2 className="font-bold text-base tracking-tight">
            {isArabic ? 'مختبر الميمز والرسم التفاعلي' : 'Interactive Meme & WebP Canvas'}
          </h2>
        </div>
        <button
          onClick={handleDownload}
          className="p-2 text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-colors"
          title="Download WebP"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>

      {/* Canvas Viewport */}
      <div className="flex justify-center">
        <div className="relative rounded-2xl overflow-hidden border-2 border-zinc-800 shadow-2xl bg-zinc-900 touch-none">
          <canvas
            ref={canvasRef}
            width={400}
            height={400}
            className="w-[320px] h-[320px] sm:w-[360px] sm:h-[360px] cursor-crosshair block"
            onMouseDown={handleStartDraw}
            onMouseMove={handleDrawMove}
            onMouseUp={handleEndDraw}
            onMouseLeave={handleEndDraw}
            onTouchStart={handleStartDraw}
            onTouchMove={handleDrawMove}
            onTouchEnd={handleEndDraw}
          />
        </div>
      </div>

      {/* Template Selector Carousel */}
      <div className="space-y-1.5">
        <span className="text-xs font-semibold text-zinc-400">
          {isArabic ? 'قوالب سريعة' : 'Viral Templates'}
        </span>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {MEME_TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.id}
              onClick={() => setSelectedTemplate(tmpl.url)}
              className={`relative flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                selectedTemplate === tmpl.url
                  ? 'border-fuchsia-500 scale-105 ring-2 ring-fuchsia-500/50'
                  : 'border-zinc-800 opacity-70 hover:opacity-100'
              }`}
            >
              <img src={tmpl.url} alt={tmpl.name} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </div>

      {/* Text Overlay Controls */}
      <div className="space-y-2.5 p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800">
        <div className="flex items-center gap-2 text-xs font-bold text-fuchsia-400">
          <Type className="w-4 h-4" />
          <span>{isArabic ? 'النصوص العلوية والسفلية' : 'Text Overlays'}</span>
        </div>

        <input
          type="text"
          value={topText}
          onChange={(e) => setTopText(e.target.value)}
          placeholder={isArabic ? 'النص العلوي...' : 'TOP TEXT...'}
          className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-bold text-white uppercase focus:outline-none focus:border-fuchsia-500"
        />

        <input
          type="text"
          value={bottomText}
          onChange={(e) => setBottomText(e.target.value)}
          placeholder={isArabic ? 'النص السفلي...' : 'BOTTOM TEXT...'}
          className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-bold text-white uppercase focus:outline-none focus:border-fuchsia-500"
        />

        <div className="flex items-center justify-between gap-4 pt-1">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-[11px] text-zinc-400">{isArabic ? 'الحجم' : 'Size'}</span>
            <input
              type="range"
              min={18}
              max={44}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-full accent-fuchsia-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            {['#FFFFFF', '#FACC15', '#06B6D4', '#EF4444'].map((color) => (
              <button
                key={color}
                onClick={() => setTextColor(color)}
                className={`w-5 h-5 rounded-full border ${
                  textColor === color ? 'border-white ring-2 ring-fuchsia-500' : 'border-transparent'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Sticker Tray & Pen Brush */}
      <div className="space-y-2 p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
            <span>🎨</span> {isArabic ? 'الملصقات وأداة الرسم' : 'Stickers & Drawing Pen'}
          </span>
          <button
            onClick={() => setIsPenActive(!isPenActive)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 border transition-colors ${
              isPenActive
                ? 'bg-fuchsia-500 text-white border-fuchsia-400'
                : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
            }`}
          >
            <Paintbrush className="w-3.5 h-3.5" />
            <span>{isPenActive ? (isArabic ? 'القلم نشط' : 'Pen Active') : (isArabic ? 'رسم حر' : 'Draw')}</span>
          </button>
        </div>

        {/* Sticker Tray */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {STICKERS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => addSticker(emoji)}
              className="text-xl p-2 bg-zinc-950 border border-zinc-800 hover:border-zinc-600 rounded-xl active:scale-90 transition-transform"
            >
              {emoji}
            </button>
          ))}
          {stickers.length > 0 && (
            <button
              onClick={clearCanvasStickers}
              className="p-2 bg-rose-950/40 text-rose-400 border border-rose-800/40 rounded-xl"
              title="Clear stickers"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Caption & Publish Action Bar */}
      <div className="space-y-3 pt-1">
        <textarea
          rows={2}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder={isArabic ? 'اكتب تعليقاً على هذا الميم (اختياري)...' : 'Write an optional post caption...'}
          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-2xl text-xs text-white resize-none focus:outline-none focus:border-fuchsia-500"
        />

        {statusMessage && (
          <div className="p-2.5 rounded-xl bg-zinc-900 border border-fuchsia-500/40 text-xs font-semibold text-fuchsia-300 text-center">
            {statusMessage}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button
            disabled={isUploading}
            onClick={() => handlePublish('feed')}
            className="py-3 px-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 shadow-lg"
          >
            <Send className="w-4 h-4 text-cyan-400" />
            <span>{isArabic ? 'نشر في الرئيسية' : 'Post to Feed'}</span>
          </button>

          <button
            disabled={isUploading}
            onClick={() => handlePublish('spark')}
            className="py-3 px-4 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 spark-glow"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>{isArabic ? 'مشاركة بتحدي اليوم' : 'Submit to Spark 24h'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
