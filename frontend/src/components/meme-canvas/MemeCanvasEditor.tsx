import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useThemeStore } from '../../stores/useThemeStore';
import {
  Download,
  Image as ImageIcon,
  Move,
  Paintbrush,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  Upload,
} from 'lucide-react';
import { api } from '../../services/apiClient';

interface MemeCanvasEditorProps {
  onPublishPost?: (mediaUrl: string, caption: string) => void;
  onPublishSpark?: (mediaUrl: string, caption: string) => void;
}

export interface TextLayer {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  hasShadow: boolean;
  fontFamily: string;
  isUppercase: boolean;
  bgHighlight: boolean;
}

export interface StickerLayer {
  id: string;
  emoji: string;
  x: number;
  y: number;
  size: number;
}

const TEMPLATE_CATEGORIES = [
  {
    id: 'viral',
    name: 'Viral Memes',
    nameAr: 'ميمز مشهورة',
    templates: [
      { id: 'v1', name: 'Cyber Cat', url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=600&auto=format&fit=crop&q=80' },
      { id: 'v2', name: 'Shocked Doge', url: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=600&auto=format&fit=crop&q=80' },
      { id: 'v3', name: 'Neon City Night', url: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=600&auto=format&fit=crop&q=80' },
      { id: 'v4', name: 'Space Explorer', url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80' },
    ],
  },
  {
    id: 'cyber',
    name: 'Cyberpunk & Tech',
    nameAr: 'سايبر بانك وبرمجة',
    templates: [
      { id: 'c1', name: 'Matrix Rain', url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop&q=80' },
      { id: 'c2', name: 'Cyberpunk Glitch', url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80' },
      { id: 'c3', name: 'Retro Grid Synth', url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&auto=format&fit=crop&q=80' },
    ],
  },
  {
    id: 'abstract',
    name: 'Gradients & Cards',
    nameAr: 'تدرجات وخلفيات',
    templates: [
      { id: 'a1', name: 'Deep Cosmos', url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=600&auto=format&fit=crop&q=80' },
      { id: 'a2', name: 'Sunset Waves', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80' },
    ],
  },
];

const FONTS = [
  { id: 'Impact', name: 'Impact (Classic Meme)', css: 'Impact, sans-serif' },
  { id: 'Cairo', name: 'Cairo (Arabic & Modern)', css: "'Cairo', 'Segoe UI', sans-serif" },
  { id: 'Inter', name: 'Inter (Clean Tech)', css: "'Inter', sans-serif" },
  { id: 'Montserrat', name: 'Montserrat (Bold)', css: "'Montserrat', sans-serif" },
  { id: 'Courier', name: 'Monospace Code', css: "'Courier Prime', monospace" },
];

const STICKER_PACKS = [
  { category: '🔥 Viral', emojis: ['🔥', '😂', '🚀', '💎', '💀', '🤖', '👀', '🧠', '⚡', '🌟'] },
  { category: '🕶️ Memes', emojis: ['🕶️', '👑', '🏆', '💯', '💥', '💬', '🗯️', '🚨', '🎯', '🍕'] },
  { category: '✨ Magic', emojis: ['✨', '🦄', '🌈', '🔮', '🎉', '🍿', '💡', '🎨', '🎸', '🕹️'] },
];

const FILTERS = [
  { id: 'normal', name: 'Normal', nameAr: 'عادي', filter: 'none' },
  { id: 'cyber', name: 'Cyber Glow', nameAr: 'توهج سايبر', filter: 'contrast(1.3) saturate(1.8) hue-rotate(15deg)' },
  { id: 'deepfry', name: 'Deep Fried', nameAr: 'مشبع جداً', filter: 'contrast(2) saturate(2.5)' },
  { id: 'noir', name: 'Noir B&W', nameAr: 'أبيض وأسود', filter: 'grayscale(1) contrast(1.2)' },
  { id: 'sepia', name: 'Vintage Sepia', nameAr: 'كلاسيكي قديم', filter: 'sepia(0.8) contrast(1.1)' },
];

const ASPECT_RATIOS = [
  { id: '1:1', name: 'Square (1:1)', width: 400, height: 400 },
  { id: '4:3', name: 'Classic (4:3)', width: 400, height: 300 },
  { id: '16:9', name: 'Landscape (16:9)', width: 480, height: 270 },
  { id: '9:16', name: 'Story (9:16)', width: 360, height: 500 },
];

export const MemeCanvasEditor: React.FC<MemeCanvasEditorProps> = ({
  onPublishPost,
  onPublishSpark,
}) => {
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [aspectRatio, setAspectRatio] = useState(ASPECT_RATIOS[0]);
  const [bgImage, setBgImage] = useState<string>(TEMPLATE_CATEGORIES[0].templates[0].url);
  const [activeFilter, setActiveFilter] = useState(FILTERS[0]);
  const [templateCategory, setTemplateCategory] = useState('viral');

  const [textLayers, setTextLayers] = useState<TextLayer[]>([
    {
      id: 'text-1',
      text: isArabic ? 'عندما ينجح الكود من أول محاولة' : 'WHEN THE CODE COMPILES FIRST TRY',
      x: 200,
      y: 45,
      fontSize: 26,
      color: '#FFFFFF',
      strokeColor: '#000000',
      strokeWidth: 4,
      hasShadow: true,
      fontFamily: isArabic ? 'Cairo' : 'Impact',
      isUppercase: !isArabic,
      bgHighlight: false,
    },
    {
      id: 'text-2',
      text: isArabic ? 'بدون أي أخطاء في الإنتاج 🚀' : 'WITHOUT ANY PRODUCTION BUGS 🚀',
      x: 200,
      y: 365,
      fontSize: 24,
      color: '#FACC15',
      strokeColor: '#000000',
      strokeWidth: 4,
      hasShadow: true,
      fontFamily: isArabic ? 'Cairo' : 'Impact',
      isUppercase: !isArabic,
      bgHighlight: false,
    },
  ]);
  const [selectedTextId, setSelectedTextId] = useState<string>('text-1');

  const [stickers, setStickers] = useState<StickerLayer[]>([
    { id: 'stk-1', emoji: '🔥', x: 355, y: 55, size: 36 },
  ]);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);

  const [isBrushMode, setIsBrushMode] = useState(false);
  const [brushColor, setBrushColor] = useState('#d946ef');
  const [brushSize, setBrushSize] = useState(6);
  const [brushType, setBrushType] = useState<'pen' | 'glow' | 'eraser'>('pen');
  const [brushStrokes, setBrushStrokes] = useState<
    Array<{ points: Array<{ x: number; y: number }>; color: string; size: number; isGlow: boolean }>
  >([]);
  const isDrawing = useRef(false);
  const currentStroke = useRef<Array<{ x: number; y: number }>>([]);

  const isDragging = useRef<string | null>(null);
  const dragStart = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number } | null>(null);

  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = aspectRatio.width;
    canvas.height = aspectRatio.height;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = bgImage;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.filter = activeFilter.filter;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.filter = 'none';

      brushStrokes.forEach((stroke) => {
        if (stroke.points.length < 2) return;
        ctx.beginPath();
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (stroke.isGlow) {
          ctx.shadowColor = stroke.color;
          ctx.shadowBlur = 12;
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      });

      stickers.forEach((s) => {
        ctx.font = `${s.size}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(s.emoji, s.x, s.y);
        if (s.id === selectedStickerId) {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.strokeRect(s.x - s.size / 2 - 4, s.y - s.size / 2 - 4, s.size + 8, s.size + 8);
        }
      });

      textLayers.forEach((layer) => {
        if (!layer.text.trim()) return;
        const fontObj = FONTS.find((f) => f.id === layer.fontFamily) || FONTS[0];
        const displayText = layer.isUppercase ? layer.text.toUpperCase() : layer.text;

        ctx.font = `900 ${layer.fontSize}px ${fontObj.css}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (layer.bgHighlight) {
          const metrics = ctx.measureText(displayText);
          const padX = 12;
          const padY = 8;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
          ctx.fillRect(
            layer.x - metrics.width / 2 - padX,
            layer.y - layer.fontSize / 2 - padY,
            metrics.width + padX * 2,
            layer.fontSize + padY * 2
          );
        }

        if (layer.hasShadow) {
          ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
          ctx.shadowBlur = 8;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
        } else {
          ctx.shadowBlur = 0;
        }

        if (layer.strokeWidth > 0) {
          ctx.strokeStyle = layer.strokeColor;
          ctx.lineWidth = layer.strokeWidth;
          ctx.lineJoin = 'round';
          ctx.strokeText(displayText, layer.x, layer.y, canvas.width - 24);
        }

        ctx.fillStyle = layer.color;
        ctx.fillText(displayText, layer.x, layer.y, canvas.width - 24);
        ctx.shadowBlur = 0;

        if (layer.id === selectedTextId && !isBrushMode) {
          const metrics = ctx.measureText(displayText);
          ctx.strokeStyle = '#d946ef';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(
            layer.x - metrics.width / 2 - 8,
            layer.y - layer.fontSize / 2 - 6,
            metrics.width + 16,
            layer.fontSize + 12
          );
          ctx.setLineDash([]);
        }
      });
    };
  }, [aspectRatio, bgImage, activeFilter, textLayers, stickers, brushStrokes, selectedTextId, selectedStickerId, isBrushMode]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e);
    if (isBrushMode) {
      isDrawing.current = true;
      const actualColor = brushType === 'eraser' ? '#09090b' : brushColor;
      currentStroke.current = [{ x, y }];
      setBrushStrokes((prev) => [
        ...prev,
        { points: [{ x, y }], color: actualColor, size: brushSize, isGlow: brushType === 'glow' },
      ]);
      return;
    }
    for (let i = stickers.length - 1; i >= 0; i--) {
      const s = stickers[i];
      if (Math.hypot(s.x - x, s.y - y) <= s.size) {
        setSelectedStickerId(s.id);
        setSelectedTextId('');
        isDragging.current = `sticker:${s.id}`;
        dragStart.current = { mouseX: x, mouseY: y, startX: s.x, startY: s.y };
        return;
      }
    }
    for (let i = textLayers.length - 1; i >= 0; i--) {
      const t = textLayers[i];
      if (Math.abs(t.y - y) <= t.fontSize + 10 && Math.abs(t.x - x) <= aspectRatio.width / 2) {
        setSelectedTextId(t.id);
        setSelectedStickerId(null);
        isDragging.current = `text:${t.id}`;
        dragStart.current = { mouseX: x, mouseY: y, startX: t.x, startY: t.y };
        return;
      }
    }
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e);
    if (isBrushMode && isDrawing.current) {
      setBrushStrokes((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last) last.points.push({ x, y });
        return updated;
      });
      return;
    }
    if (isDragging.current && dragStart.current) {
      const dx = x - dragStart.current.mouseX;
      const dy = y - dragStart.current.mouseY;
      if (isDragging.current.startsWith('text:')) {
        const layerId = isDragging.current.replace('text:', '');
        setTextLayers((prev) => prev.map((l) => l.id === layerId ? { ...l, x: Math.max(20, Math.min(aspectRatio.width - 20, dragStart.current!.startX + dx)), y: Math.max(20, Math.min(aspectRatio.height - 20, dragStart.current!.startY + dy)) } : l));
      } else if (isDragging.current.startsWith('sticker:')) {
        const stickerId = isDragging.current.replace('sticker:', '');
        setStickers((prev) => prev.map((s) => s.id === stickerId ? { ...s, x: Math.max(10, Math.min(aspectRatio.width - 10, dragStart.current!.startX + dx)), y: Math.max(10, Math.min(aspectRatio.height - 10, dragStart.current!.startY + dy)) } : s));
      }
    }
  };

  const handlePointerUp = () => {
    isDrawing.current = false;
    isDragging.current = null;
    dragStart.current = null;
  };

  const handleAddTextLayer = () => {
    const newId = `text-${Date.now()}`;
    const newLayer: TextLayer = { id: newId, text: isArabic ? 'نص جديد' : 'NEW TEXT', x: aspectRatio.width / 2, y: aspectRatio.height / 2, fontSize: 22, color: '#FFFFFF', strokeColor: '#000000', strokeWidth: 4, hasShadow: true, fontFamily: isArabic ? 'Cairo' : 'Impact', isUppercase: !isArabic, bgHighlight: false };
    setTextLayers((prev) => [...prev, newLayer]);
    setSelectedTextId(newId);
    setIsBrushMode(false);
  };

  const handleDeleteSelectedText = () => {
    if (textLayers.length <= 1) return;
    setTextLayers((prev) => prev.filter((l) => l.id !== selectedTextId));
    setSelectedTextId(textLayers[0]?.id || '');
  };

  const handleAddSticker = (emoji: string) => {
    const newSticker: StickerLayer = { id: `stk-${Date.now()}`, emoji, x: aspectRatio.width / 2, y: aspectRatio.height / 2, size: 40 };
    setStickers((prev) => [...prev, newSticker]);
    setSelectedStickerId(newSticker.id);
    setIsBrushMode(false);
  };

  const handleCustomImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => { if (typeof event.target?.result === 'string') setBgImage(event.target.result); };
    reader.readAsDataURL(file);
  };

  const handleUndo = () => {
    if (brushStrokes.length > 0) setBrushStrokes((prev) => prev.slice(0, -1));
    else if (stickers.length > 0) setStickers((prev) => prev.slice(0, -1));
  };

  const exportWebPBlob = (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const canvas = canvasRef.current;
      if (!canvas) return reject(new Error('Canvas unavailable'));
      canvas.toBlob((blob) => { if (blob) resolve(blob); else reject(new Error('Export failed')); }, 'image/webp', 0.92);
    });
  };

  const handleDownload = async () => {
    try {
      const blob = await exportWebPBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meme_${Date.now()}.webp`;
      a.click();
    } catch (err) { console.error(err); }
  };

  const handlePublish = async (destination: 'feed' | 'spark') => {
    setIsUploading(true);
    try {
      const blob = await exportWebPBlob();
      const uploadRes = await api.uploadMedia(blob, `meme_${Date.now()}.webp`);
      const finalCaption = caption.trim() || textLayers.map((l) => l.text).join(' - ');
      if (destination === 'feed') {
        await api.createPost(finalCaption, uploadRes.url, 'MemeWebP', aspectRatio.width, aspectRatio.height);
        setStatusMessage(isArabic ? 'تم النشر! 🎉' : 'Published! 🎉');
        if (onPublishPost) onPublishPost(uploadRes.url, finalCaption);
      } else {
        const activeSpark = await api.getActiveSpark();
        await api.submitSparkEntry(activeSpark.id, finalCaption, uploadRes.url);
        setStatusMessage(isArabic ? 'تمت المشاركة! 🏆' : 'Submitted! 🏆');
        if (onPublishSpark) onPublishSpark(uploadRes.url, finalCaption);
      }
    } catch (err) { setStatusMessage('Upload failed'); } finally { setIsUploading(false); }
  };

  const selectedTextLayer = textLayers.find((l) => l.id === selectedTextId) || textLayers[0];

  return (
    <div className="space-y-5 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-fuchsia-600 to-cyan-500 p-0.5 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-black text-base tracking-tight">{isArabic ? 'استوديو الميمز' : 'Meme Studio'}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={aspectRatio.id} onChange={(e) => { const found = ASPECT_RATIOS.find((r) => r.id === e.target.value); if (found) setAspectRatio(found); }} className="bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs">
            {ASPECT_RATIOS.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <button onClick={handleUndo} className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl"><Undo2 className="w-4 h-4" /></button>
          <button onClick={handleDownload} className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-bold flex items-center gap-1.5"><Download className="w-4 h-4" /> Export</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 flex flex-col items-center gap-4">
          <div className="relative rounded-2xl overflow-hidden border-2 border-zinc-700 bg-zinc-950">
            <canvas ref={canvasRef} className="cursor-crosshair block" onMouseDown={handlePointerDown} onMouseMove={handlePointerMove} onMouseUp={handlePointerUp} onMouseLeave={handlePointerUp} onTouchStart={handlePointerDown} onTouchMove={handlePointerMove} onTouchEnd={handlePointerUp} />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setIsBrushMode(false)} className={`px-4 py-2 rounded-xl text-xs font-bold ${!isBrushMode ? 'bg-fuchsia-600' : 'bg-zinc-900'}`}>Move</button>
            <button onClick={() => setIsBrushMode(true)} className={`px-4 py-2 rounded-xl text-xs font-bold ${isBrushMode ? 'bg-fuchsia-600' : 'bg-zinc-900'}`}>Draw</button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleCustomImageUpload} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-zinc-900 rounded-xl text-xs">Upload</button>
          </div>
        </div>

        <div className="lg:col-span-6 space-y-4">
          <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-fuchsia-400">Text Layers</span>
              <button onClick={handleAddTextLayer} className="text-xs font-bold text-fuchsia-300">Add Text</button>
            </div>
            {selectedTextLayer && (
              <div className="space-y-2">
                <input type="text" value={selectedTextLayer.text} onChange={(e) => setTextLayers((prev) => prev.map((l) => (l.id === selectedTextLayer.id ? { ...l, text: e.target.value } : l)))} className="w-full px-3 py-2 bg-zinc-950 rounded-xl text-xs" />
                <div className="flex gap-2">
                  <select value={selectedTextLayer.fontFamily} onChange={(e) => setTextLayers((prev) => prev.map((l) => (l.id === selectedTextLayer.id ? { ...l, fontFamily: e.target.value } : l)))} className="bg-zinc-950 px-2 py-1 text-xs rounded-lg">
                    {FONTS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                  <input type="range" min={14} max={48} value={selectedTextLayer.fontSize} onChange={(e) => setTextLayers((prev) => prev.map((l) => (l.id === selectedTextLayer.id ? { ...l, fontSize: Number(e.target.value) } : l)))} />
                </div>
              </div>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800">
            <div className="flex items-center gap-2 overflow-x-auto">
              {STICKER_PACKS.flatMap((p) => p.emojis).map((emoji, idx) => (
                <button key={idx} onClick={() => handleAddSticker(emoji)} className="text-xl p-2 bg-zinc-950 rounded-xl">{emoji}</button>
              ))}
            </div>
          </div>

          <textarea value={caption} onChange={(e) => setCaption(e.target.value)} className="w-full p-3 bg-zinc-900 rounded-2xl text-xs" placeholder="Caption..." />
          
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => handlePublish('feed')} className="py-3 bg-zinc-800 rounded-2xl text-xs font-bold">Post to Feed</button>
            <button onClick={() => handlePublish('spark')} className="py-3 bg-gradient-to-r from-fuchsia-600 to-purple-600 rounded-2xl text-xs font-bold">Submit to Spark</button>
          </div>
        </div>
      </div>
    </div>
  );
};
