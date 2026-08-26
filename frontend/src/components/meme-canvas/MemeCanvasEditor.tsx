import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useThemeStore } from '../../stores/useThemeStore';
import { Tooltip } from '../ui/Tooltip';
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
  RefreshCw,
  Palette,
  Sliders,
  Check,
  Flame,
  Layers,
  Eraser,
  Hash,
} from 'lucide-react';
import { api } from '../../services/apiClient';
import { SparkDto } from '../../types/api';

interface MemeCanvasEditorProps {
  activeSpark?: SparkDto;
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

const COLOR_SWATCHES = ['#FFFFFF', '#FACC15', '#38BDF8', '#D946EF', '#4ADE80', '#F87171', '#000000'];

const STICKER_PACKS = [
  { id: 'viral', label: '🔥 Viral', emojis: ['🔥', '😂', '🚀', '💎', '💀', '🤖', '👀', '🧠', '⚡', '🌟'] },
  { id: 'memes', label: '🕶️ Memes', emojis: ['🕶️', '👑', '🏆', '💯', '💥', '💬', '🗯️', '🚨', '🎯', '🍕'] },
  { id: 'vibes', label: '✨ Vibes', emojis: ['✨', '🦄', '🌈', '🔮', '🎉', '🍿', '💡', '🎨', '🎸', '🕹️'] },
];

const FILTERS = [
  { id: 'normal', name: 'Normal', nameAr: 'عادي', filter: 'none' },
  { id: 'cyber', name: 'Cyber Glow', nameAr: 'توهج سايبر', filter: 'contrast(1.3) saturate(1.8) hue-rotate(15deg)' },
  { id: 'deepfry', name: 'Deep Fried', nameAr: 'مشبع جداً', filter: 'contrast(2) saturate(2.5)' },
  { id: 'noir', name: 'Noir B&W', nameAr: 'أبيض وأسود', filter: 'grayscale(1) contrast(1.2)' },
  { id: 'sepia', name: 'Vintage Sepia', nameAr: 'كلاسيكي قديم', filter: 'sepia(0.8) contrast(1.1)' },
];

const ASPECT_RATIOS = [
  { id: '1:1', name: 'Square 1:1', width: 450, height: 450, aspectClass: 'aspect-square' },
  { id: '4:3', name: 'Classic 4:3', width: 480, height: 360, aspectClass: 'aspect-[4/3]' },
  { id: '16:9', name: 'Wide 16:9', width: 480, height: 270, aspectClass: 'aspect-[16/9]' },
  { id: '9:16', name: 'Story 9:16', width: 360, height: 640, aspectClass: 'aspect-[9/16]' },
];

type StudioTab = 'text' | 'templates' | 'stickers' | 'draw' | 'filters';

export const MemeCanvasEditor: React.FC<MemeCanvasEditorProps> = ({
  activeSpark,
  onPublishPost,
  onPublishSpark,
}) => {
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [aspectRatio, setAspectRatio] = useState(ASPECT_RATIOS[0]);
  const [bgImage, setBgImage] = useState<string>(TEMPLATE_CATEGORIES[0].templates[0].url);
  const [activeFilter, setActiveFilter] = useState(FILTERS[0]);
  const [activeStudioTab, setActiveStudioTab] = useState<StudioTab>('text');
  const [templateCategory, setTemplateCategory] = useState('viral');
  const [activeStickerPack, setActiveStickerPack] = useState('viral');

  const [textLayers, setTextLayers] = useState<TextLayer[]>([
    {
      id: 'text-1',
      text: isArabic ? 'عندما ينجح الكود من أول محاولة' : 'WHEN THE CODE COMPILES FIRST TRY',
      x: 225,
      y: 50,
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
      x: 225,
      y: 400,
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
    { id: 'stk-1', emoji: '🔥', x: 400, y: 60, size: 38 },
  ]);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);

  // Brush drawing state
  const [isBrushMode, setIsBrushMode] = useState(false);
  const [brushColor, setBrushColor] = useState('#D946EF');
  const [brushSize, setBrushSize] = useState(6);
  const [brushType, setBrushType] = useState<'pen' | 'glow' | 'eraser'>('glow');
  const [brushStrokes, setBrushStrokes] = useState<
    Array<{ points: Array<{ x: number; y: number }>; color: string; size: number; isGlow: boolean }>
  >([]);
  const isDrawing = useRef(false);

  const [cursorStyle, setCursorStyle] = useState<string>('default');

  const isDragging = useRef<{
    type: 'text' | 'sticker';
    id: string;
    mouseX: number;
    mouseY: number;
    startX: number;
    startY: number;
  } | null>(null);

  const resizingTarget = useRef<{
    type: 'text' | 'sticker';
    id: string;
    handle: 'tl' | 'tr' | 'bl' | 'br';
    initialSize: number;
    initialDist: number;
    startX: number;
    startY: number;
  } | null>(null);

  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // Synchronize text coordinates when aspect ratio changes
  const handleSelectAspectRatio = (ratio: typeof ASPECT_RATIOS[0]) => {
    setAspectRatio(ratio);
    setTextLayers((prev) =>
      prev.map((l, idx) => ({
        ...l,
        x: ratio.width / 2,
        y: idx === 0 ? 50 : ratio.height - 50,
      }))
    );
  };

  interface Bounds {
    x: number;
    y: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  }

  const getTextLayerBounds = (
    layer: TextLayer,
    canvasWidth: number,
    ctx?: CanvasRenderingContext2D | null
  ): Bounds => {
    const fontObj = FONTS.find((f) => f.id === layer.fontFamily) || FONTS[0];
    const displayText = layer.isUppercase ? layer.text.toUpperCase() : layer.text;
    const lines = displayText.split('\n');
    const lineHeight = layer.fontSize * 1.25;
    const totalHeight = lines.length * lineHeight;
    const maxDrawWidth = Math.max(120, canvasWidth - 32);

    let maxLineWidth = 0;
    if (ctx) {
      ctx.save();
      ctx.font = `900 ${layer.fontSize}px ${fontObj.css}`;
      lines.forEach((line) => {
        const m = ctx.measureText(line).width;
        if (m > maxLineWidth) maxLineWidth = m;
      });
      ctx.restore();
    } else {
      maxLineWidth = Math.max(...lines.map((l) => l.length * layer.fontSize * 0.65), 60);
    }
    const actualWidth = Math.min(maxLineWidth, maxDrawWidth);
    const padX = 12;
    const padY = 8;

    return {
      x: layer.x - actualWidth / 2 - padX,
      y: layer.y - totalHeight / 2 - padY,
      width: actualWidth + padX * 2,
      height: totalHeight + padY * 2,
      centerX: layer.x,
      centerY: layer.y,
    };
  };

  const getStickerBounds = (s: StickerLayer): Bounds => {
    const pad = 8;
    const half = s.size / 2;
    return {
      x: s.x - half - pad,
      y: s.y - half - pad,
      width: s.size + pad * 2,
      height: s.size + pad * 2,
      centerX: s.x,
      centerY: s.y,
    };
  };

  const getHandles = (bounds: Bounds) => [
    { id: 'tl' as const, x: bounds.x, y: bounds.y, cursor: 'nwse-resize' },
    { id: 'tr' as const, x: bounds.x + bounds.width, y: bounds.y, cursor: 'nesw-resize' },
    { id: 'bl' as const, x: bounds.x, y: bounds.y + bounds.height, cursor: 'nesw-resize' },
    { id: 'br' as const, x: bounds.x + bounds.width, y: bounds.y + bounds.height, cursor: 'nwse-resize' },
  ];

  const drawSelectionBoxWithHandles = (
    ctx: CanvasRenderingContext2D,
    bounds: Bounds,
    color: string
  ) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    ctx.setLineDash([]);

    const handles = getHandles(bounds);
    handles.forEach((h) => {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(h.x, h.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.stroke();
    });
    ctx.restore();
  };

  const drawMemeContent = (
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement | null,
    width: number,
    height: number,
    isExport: boolean
  ) => {
    ctx.clearRect(0, 0, width, height);

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.filter = activeFilter.filter;
      ctx.drawImage(img, 0, 0, width, height);
      ctx.filter = 'none';
    } else {
      // Dark gradient backdrop fallback
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#09090b');
      grad.addColorStop(1, '#18181b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    // 1. Draw brush strokes
    brushStrokes.forEach((stroke) => {
      if (stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (stroke.isGlow) {
        ctx.shadowColor = stroke.color;
        ctx.shadowBlur = 14;
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

    // 2. Draw stickers & emojis
    stickers.forEach((s) => {
      ctx.font = `${s.size}px sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji'`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.emoji, s.x, s.y);
      if (s.id === selectedStickerId && !isExport && !isBrushMode && activeStudioTab === 'stickers') {
        const bounds = getStickerBounds(s);
        drawSelectionBoxWithHandles(ctx, bounds, '#38BDF8');
      }
    });

    // 3. Draw text layers
    textLayers.forEach((layer) => {
      if (!layer.text.trim()) return;
      const fontObj = FONTS.find((f) => f.id === layer.fontFamily) || FONTS[0];
      const displayText = layer.isUppercase ? layer.text.toUpperCase() : layer.text;

      ctx.font = `900 ${layer.fontSize}px ${fontObj.css}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Split lines by explicit \n
      const lines = displayText.split('\n');
      const lineHeight = layer.fontSize * 1.25;
      const startY = layer.y - ((lines.length - 1) * lineHeight) / 2;
      const maxDrawWidth = Math.max(120, width - 32);

      lines.forEach((line, idx) => {
        const lineY = startY + idx * lineHeight;

        if (layer.bgHighlight) {
          const metrics = ctx.measureText(line);
          const drawLineWidth = Math.min(metrics.width, maxDrawWidth);
          const padX = 14;
          const padY = 6;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
          ctx.fillRect(
            layer.x - drawLineWidth / 2 - padX,
            lineY - layer.fontSize / 2 - padY,
            drawLineWidth + padX * 2,
            layer.fontSize + padY * 2
          );
        }

        if (layer.hasShadow) {
          ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
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
          ctx.strokeText(line, layer.x, lineY, maxDrawWidth);
        }

        ctx.fillStyle = layer.color;
        ctx.fillText(line, layer.x, lineY, maxDrawWidth);
        ctx.shadowBlur = 0;
      });

      if (layer.id === selectedTextId && !isExport && !isBrushMode && activeStudioTab === 'text') {
        const bounds = getTextLayerBounds(layer, width, ctx);
        drawSelectionBoxWithHandles(ctx, bounds, '#6366F1');
      }
    });
  };

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = aspectRatio.width;
    canvas.height = aspectRatio.height;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      drawMemeContent(ctx, img, canvas.width, canvas.height, false);
    };
    img.onerror = () => {
      drawMemeContent(ctx, null, canvas.width, canvas.height, false);
    };
    img.src = bgImage;
  }, [aspectRatio, bgImage, activeFilter, textLayers, stickers, brushStrokes, selectedTextId, selectedStickerId, isBrushMode, activeStudioTab]);

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

  const updateCursor = useCallback((x: number, y: number) => {
    if (isBrushMode || activeStudioTab === 'draw') {
      setCursorStyle(brushType === 'eraser' ? 'cell' : 'crosshair');
      return;
    }

    const ctx = canvasRef.current?.getContext('2d');

    // 1. Check if hovering over selected text resize handles
    if (selectedTextId && activeStudioTab === 'text') {
      const selectedText = textLayers.find((t) => t.id === selectedTextId);
      if (selectedText) {
        const bounds = getTextLayerBounds(selectedText, aspectRatio.width, ctx);
        const handles = getHandles(bounds);
        const handle = handles.find((h) => Math.hypot(h.x - x, h.y - y) <= 12);
        if (handle) {
          setCursorStyle(handle.cursor);
          return;
        }
      }
    }

    // 2. Check if hovering over selected sticker resize handles
    if (selectedStickerId && activeStudioTab === 'stickers') {
      const selectedSticker = stickers.find((s) => s.id === selectedStickerId);
      if (selectedSticker) {
        const bounds = getStickerBounds(selectedSticker);
        const handles = getHandles(bounds);
        const handle = handles.find((h) => Math.hypot(h.x - x, h.y - y) <= 12);
        if (handle) {
          setCursorStyle(handle.cursor);
          return;
        }
      }
    }

    // 3. Check if hovering over any sticker
    for (let i = stickers.length - 1; i >= 0; i--) {
      const s = stickers[i];
      if (Math.hypot(s.x - x, s.y - y) <= s.size / 2 + 8) {
        setCursorStyle('grab');
        return;
      }
    }

    // 4. Check if hovering over any text layer
    for (let i = textLayers.length - 1; i >= 0; i--) {
      const t = textLayers[i];
      const bounds = getTextLayerBounds(t, aspectRatio.width, ctx);
      if (x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height) {
        setCursorStyle('grab');
        return;
      }
    }

    // 5. Default tab cursor
    setCursorStyle('default');
  }, [isBrushMode, activeStudioTab, brushType, selectedTextId, selectedStickerId, textLayers, stickers, aspectRatio.width]);

  useEffect(() => {
    if (isBrushMode || activeStudioTab === 'draw') {
      setCursorStyle(brushType === 'eraser' ? 'cell' : 'crosshair');
    } else {
      setCursorStyle('default');
    }
  }, [isBrushMode, activeStudioTab, brushType]);

  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e);
    const ctx = canvasRef.current?.getContext('2d');

    if (isBrushMode || activeStudioTab === 'draw') {
      isDrawing.current = true;
      setCursorStyle(brushType === 'eraser' ? 'cell' : 'crosshair');
      const actualColor = brushType === 'eraser' ? '#09090b' : brushColor;
      setBrushStrokes((prev) => [
        ...prev,
        { points: [{ x, y }], color: actualColor, size: brushSize, isGlow: brushType === 'glow' },
      ]);
      return;
    }

    // 1. Check if clicked a resize handle on the active text layer
    if (selectedTextId && activeStudioTab === 'text') {
      const selectedText = textLayers.find((t) => t.id === selectedTextId);
      if (selectedText) {
        const bounds = getTextLayerBounds(selectedText, aspectRatio.width, ctx);
        const handles = getHandles(bounds);
        const hitHandle = handles.find((h) => Math.hypot(h.x - x, h.y - y) <= 14);
        if (hitHandle) {
          const initialDist = Math.hypot(x - bounds.centerX, y - bounds.centerY);
          resizingTarget.current = {
            type: 'text',
            id: selectedText.id,
            handle: hitHandle.id,
            initialSize: selectedText.fontSize,
            initialDist: Math.max(20, initialDist),
            startX: x,
            startY: y,
          };
          setCursorStyle(hitHandle.cursor);
          return;
        }
      }
    }

    // 2. Check if clicked a resize handle on the active sticker
    if (selectedStickerId && activeStudioTab === 'stickers') {
      const selectedSticker = stickers.find((s) => s.id === selectedStickerId);
      if (selectedSticker) {
        const bounds = getStickerBounds(selectedSticker);
        const handles = getHandles(bounds);
        const hitHandle = handles.find((h) => Math.hypot(h.x - x, h.y - y) <= 14);
        if (hitHandle) {
          const initialDist = Math.hypot(x - bounds.centerX, y - bounds.centerY);
          resizingTarget.current = {
            type: 'sticker',
            id: selectedSticker.id,
            handle: hitHandle.id,
            initialSize: selectedSticker.size,
            initialDist: Math.max(20, initialDist),
            startX: x,
            startY: y,
          };
          setCursorStyle(hitHandle.cursor);
          return;
        }
      }
    }

    // 3. Check if clicked on a sticker (Topmost first)
    for (let i = stickers.length - 1; i >= 0; i--) {
      const s = stickers[i];
      if (Math.hypot(s.x - x, s.y - y) <= s.size / 2 + 10) {
        setSelectedStickerId(s.id);
        setSelectedTextId('');
        setActiveStudioTab('stickers');
        isDragging.current = { type: 'sticker', id: s.id, mouseX: x, mouseY: y, startX: s.x, startY: s.y };
        setCursorStyle('grabbing');
        return;
      }
    }

    // 4. Check if clicked on a text layer (Topmost first)
    for (let i = textLayers.length - 1; i >= 0; i--) {
      const t = textLayers[i];
      const bounds = getTextLayerBounds(t, aspectRatio.width, ctx);
      if (x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height) {
        setSelectedTextId(t.id);
        setSelectedStickerId(null);
        setActiveStudioTab('text');
        isDragging.current = { type: 'text', id: t.id, mouseX: x, mouseY: y, startX: t.x, startY: t.y };
        setCursorStyle('grabbing');
        return;
      }
    }
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e);

    // Active brush drawing
    if ((isBrushMode || activeStudioTab === 'draw') && isDrawing.current) {
      setBrushStrokes((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last) last.points.push({ x, y });
        return updated;
      });
      return;
    }

    // Active mouse resizing
    if (resizingTarget.current) {
      const target = resizingTarget.current;
      if (target.type === 'text') {
        const currentLayer = textLayers.find((l) => l.id === target.id);
        if (currentLayer) {
          const currentDist = Math.hypot(x - currentLayer.x, y - currentLayer.y);
          const scaleRatio = currentDist / target.initialDist;
          const newFontSize = Math.max(12, Math.min(96, Math.round(target.initialSize * scaleRatio)));
          setTextLayers((prev) =>
            prev.map((l) => (l.id === target.id ? { ...l, fontSize: newFontSize } : l))
          );
        }
      } else if (target.type === 'sticker') {
        const currentSticker = stickers.find((s) => s.id === target.id);
        if (currentSticker) {
          const currentDist = Math.hypot(x - currentSticker.x, y - currentSticker.y);
          const scaleRatio = currentDist / target.initialDist;
          const newSize = Math.max(18, Math.min(180, Math.round(target.initialSize * scaleRatio)));
          setStickers((prev) =>
            prev.map((s) => (s.id === target.id ? { ...s, size: newSize } : s))
          );
        }
      }
      return;
    }

    // Active mouse dragging
    if (isDragging.current) {
      const drag = isDragging.current;
      const dx = x - drag.mouseX;
      const dy = y - drag.mouseY;
      if (drag.type === 'text') {
        setTextLayers((prev) =>
          prev.map((l) =>
            l.id === drag.id
              ? {
                  ...l,
                  x: Math.max(20, Math.min(aspectRatio.width - 20, drag.startX + dx)),
                  y: Math.max(20, Math.min(aspectRatio.height - 20, drag.startY + dy)),
                }
              : l
          )
        );
      } else if (drag.type === 'sticker') {
        setStickers((prev) =>
          prev.map((s) =>
            s.id === drag.id
              ? {
                  ...s,
                  x: Math.max(10, Math.min(aspectRatio.width - 10, drag.startX + dx)),
                  y: Math.max(10, Math.min(aspectRatio.height - 10, drag.startY + dy)),
                }
              : s
          )
        );
      }
      return;
    }

    // Update hover cursor
    updateCursor(x, y);
  };

  const handlePointerUp = () => {
    isDrawing.current = false;
    isDragging.current = null;
    resizingTarget.current = null;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e);
    const ctx = canvasRef.current?.getContext('2d');
    const delta = e.deltaY < 0 ? 2 : -2;

    if (selectedTextId && activeStudioTab === 'text') {
      const target = textLayers.find((t) => t.id === selectedTextId);
      if (target) {
        const bounds = getTextLayerBounds(target, aspectRatio.width, ctx);
        if (x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height) {
          e.preventDefault();
          setTextLayers((prev) =>
            prev.map((t) =>
              t.id === selectedTextId
                ? { ...t, fontSize: Math.max(12, Math.min(96, t.fontSize + delta)) }
                : t
            )
          );
          return;
        }
      }
    }

    if (selectedStickerId && activeStudioTab === 'stickers') {
      const target = stickers.find((s) => s.id === selectedStickerId);
      if (target && Math.hypot(target.x - x, target.y - y) <= target.size) {
        e.preventDefault();
        setStickers((prev) =>
          prev.map((s) =>
            s.id === selectedStickerId
              ? { ...s, size: Math.max(18, Math.min(180, s.size + delta * 2)) }
              : s
          )
        );
      }
    }
  };

  const handleAddTextLayer = () => {
    const newId = `text-${Date.now()}`;
    const newLayer: TextLayer = {
      id: newId,
      text: isArabic ? 'نص جديد' : 'NEW TEXT',
      x: aspectRatio.width / 2,
      y: aspectRatio.height / 2,
      fontSize: 22,
      color: '#FFFFFF',
      strokeColor: '#000000',
      strokeWidth: 4,
      hasShadow: true,
      fontFamily: isArabic ? 'Cairo' : 'Impact',
      isUppercase: !isArabic,
      bgHighlight: false,
    };
    setTextLayers((prev) => [...prev, newLayer]);
    setSelectedTextId(newId);
    setActiveStudioTab('text');
    setIsBrushMode(false);
  };

  const handleDeleteSelectedText = () => {
    if (textLayers.length <= 1) return;
    const remaining = textLayers.filter((l) => l.id !== selectedTextId);
    setTextLayers(remaining);
    setSelectedTextId(remaining[0]?.id || '');
  };

  const handleAddSticker = (emoji: string) => {
    const newSticker: StickerLayer = {
      id: `stk-${Date.now()}`,
      emoji,
      x: aspectRatio.width / 2,
      y: aspectRatio.height / 2,
      size: 40,
    };
    setStickers((prev) => [...prev, newSticker]);
    setSelectedStickerId(newSticker.id);
    setIsBrushMode(false);
  };

  const handleDeleteSelectedSticker = () => {
    if (!selectedStickerId) return;
    setStickers((prev) => prev.filter((s) => s.id !== selectedStickerId));
    setSelectedStickerId(null);
  };

  const handleCustomImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setBgImage(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUndo = () => {
    if (brushStrokes.length > 0) {
      setBrushStrokes((prev) => prev.slice(0, -1));
    } else if (stickers.length > 0) {
      setStickers((prev) => prev.slice(0, -1));
    }
  };

  const handleResetCanvas = () => {
    setBrushStrokes([]);
    setStickers([]);
    setActiveFilter(FILTERS[0]);
  };

  const exportMemeAsBlobOrDataUrl = async (): Promise<{ blob: Blob; dataUrl: string }> => {
    // Ensure all web fonts are fully loaded before capturing
    if (document.fonts) {
      try {
        await document.fonts.ready;
      } catch {
        // font ready fallback
      }
    }

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = aspectRatio.width;
    exportCanvas.height = aspectRatio.height;
    const exportCtx = exportCanvas.getContext('2d');

    if (exportCtx) {
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          drawMemeContent(exportCtx, img, exportCanvas.width, exportCanvas.height, true);
          resolve();
        };
        img.onerror = () => {
          drawMemeContent(exportCtx, null, exportCanvas.width, exportCanvas.height, true);
          resolve();
        };
        img.src = bgImage;
      });
    }

    let dataUrl = '';
    try {
      dataUrl = exportCanvas.toDataURL('image/webp', 0.95);
    } catch (e) {
      console.warn('Canvas toDataURL failed, falling back to main canvas:', e);
      if (canvasRef.current) {
        try {
          dataUrl = canvasRef.current.toDataURL('image/webp', 0.95);
        } catch {
          // ignore
        }
      }
    }

    const blob = await new Promise<Blob>((resolve) => {
      exportCanvas.toBlob((b) => {
        if (b) {
          resolve(b);
        } else if (dataUrl) {
          // Convert dataURL to blob fallback
          try {
            const byteString = atob(dataUrl.split(',')[1]);
            const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
              ia[i] = byteString.charCodeAt(i);
            }
            resolve(new Blob([ab], { type: mimeString }));
          } catch {
            resolve(new Blob([], { type: 'image/webp' }));
          }
        } else {
          resolve(new Blob([], { type: 'image/webp' }));
        }
      }, 'image/webp', 0.95);
    });

    return { blob, dataUrl };
  };

  const handleDownload = async () => {
    try {
      const { blob } = await exportMemeAsBlobOrDataUrl();
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
    setStatusMessage(null);
    try {
      const { blob, dataUrl } = await exportMemeAsBlobOrDataUrl();
      let finalMediaUrl = dataUrl; // Guaranteed fallback

      try {
        const uploadRes = await api.uploadMedia(blob, `meme_${Date.now()}.webp`);
        if (uploadRes?.url) {
          finalMediaUrl = uploadRes.url;
        }
      } catch (uploadErr) {
        console.warn('Server upload failed, falling back to embedded WebP dataUrl:', uploadErr);
      }

      const finalCaption = caption.trim() || textLayers.map((l) => l.text).join(' - ');

      if (destination === 'feed') {
        await api.createPost(finalCaption, finalMediaUrl, 'MemeWebP', aspectRatio.width, aspectRatio.height);
        setStatusMessage({ text: isArabic ? 'تم نشر الميم بنجاح في الموجز! 🎉' : 'Meme posted to feed successfully! 🎉' });
        if (onPublishPost) onPublishPost(finalMediaUrl, finalCaption);
      } else {
        const targetSparkId = activeSpark?.id || (await api.getActiveSpark()).id;
        await api.submitSparkEntry(targetSparkId, finalCaption, finalMediaUrl);
        setStatusMessage({ text: isArabic ? 'تم إرسال الميم إلى تحدي اليوم! 🏆' : 'Submitted to Daily Spark challenge! 🏆' });
        if (onPublishSpark) onPublishSpark(finalMediaUrl, finalCaption);
      }
    } catch (err: unknown) {
      console.error('Publish failed:', err);
      setStatusMessage({ text: isArabic ? 'فشل النشر. يرجى المحاولة مرة أخرى.' : 'Publish failed. Please try again.', isError: true });
    } finally {
      setIsUploading(false);
    }
  };

  const selectedTextLayer = textLayers.find((l) => l.id === selectedTextId) || textLayers[0];
  const selectedSticker = stickers.find((s) => s.id === selectedStickerId);

  return (
    <div className="space-y-6 text-white max-w-2xl mx-auto">
      {/* 1. Header & Quick Controls */}
      <div className="glass-card p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-black text-base tracking-tight text-slate-900 dark:text-white">
              {isArabic ? 'استوديو الميمز وصناع المحتوى' : 'Interactive Meme Studio'}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {isArabic ? 'صمم وشارك أفكارك وتحدياتك في ثوانٍ' : 'Design & publish viral memes in seconds'}
            </p>
          </div>
        </div>

        {/* Aspect Ratio & Top Actions */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl gap-1">
            {ASPECT_RATIOS.map((r) => (
              <Tooltip key={r.id} content={`${isArabic ? 'أبعاد الكانفاس' : 'Canvas Ratio'}: ${r.name}`} position="bottom">
                <button
                  onClick={() => handleSelectAspectRatio(r)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                    aspectRatio.id === r.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {r.name}
                </button>
              </Tooltip>
            ))}
          </div>

          <Tooltip content={isArabic ? 'تراجع عن آخر خطوة رسم أو إضافة' : 'Undo last brush stroke or action'} position="bottom">
            <button
              onClick={handleUndo}
              className="p-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <Undo2 className="w-4 h-4" />
            </button>
          </Tooltip>

          <Tooltip content={isArabic ? 'إعادة ضبط الكانفاس وتنظيف الطبقات' : 'Reset canvas and clear layers'} position="bottom">
            <button
              onClick={handleResetCanvas}
              className="p-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </Tooltip>

          <Tooltip content={isArabic ? 'تنزيل الميم كصورة WebP عالية الدقة' : 'Download meme as high-res WebP image'} position="bottom">
            <button
              onClick={handleDownload}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isArabic ? 'تصدير' : 'Export'}</span>
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Active Spark Challenge Context Pill */}
      {activeSpark && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 overflow-hidden">
            <Flame className="w-4 h-4 text-amber-500 shrink-0 animate-pulse" />
            <div className="truncate">
              <span className="text-[10px] font-black text-amber-600 dark:text-amber-300 uppercase block">
                {isArabic ? 'تحدي السبارك الحالي:' : 'Daily Spark Challenge:'}
              </span>
              <span className="text-xs font-bold text-slate-900 dark:text-white truncate block">
                {activeSpark.title}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setTextLayers((prev) => [
                {
                  ...prev[0],
                  text: activeSpark.prompt,
                },
                ...prev.slice(1),
              ]);
            }}
            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] rounded-xl shrink-0 transition-colors shadow-sm"
          >
            {isArabic ? 'استخدم نص التحدي' : 'Use Challenge Prompt'}
          </button>
        </div>
      )}

      {/* 2. Interactive Canvas Stage */}
      <div className="glass-card p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800/80 space-y-5 shadow-sm">
        <div
          ref={containerRef}
          className="relative w-full max-w-[480px] mx-auto bg-slate-100 dark:bg-slate-950 rounded-2xl overflow-hidden border border-slate-300 dark:border-slate-800 shadow-inner flex items-center justify-center select-none p-1"
        >
          <canvas
            ref={canvasRef}
            style={{ cursor: cursorStyle }}
            className="w-full h-auto object-contain block touch-none select-none"
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
            onWheel={handleWheel}
          />
        </div>

        {/* Studio Tool Navigation Dock */}
        <div className="flex items-center justify-center gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-x-auto no-scrollbar">
          {[
            { id: 'text' as StudioTab, label: isArabic ? 'النصوص' : 'Text', icon: Type, tip: isArabic ? 'إضافة وتنسيق النصوص' : 'Add & style text layers' },
            { id: 'templates' as StudioTab, label: isArabic ? 'القوالب' : 'Templates', icon: ImageIcon, tip: isArabic ? 'اختيار صور وقوالب ميمز جاهزة' : 'Select meme templates' },
            { id: 'stickers' as StudioTab, label: isArabic ? 'الملصقات' : 'Stickers', icon: Sparkles, tip: isArabic ? 'إضافة إيموجي وملصقات' : 'Add emoji stickers' },
            { id: 'draw' as StudioTab, label: isArabic ? 'الرسم' : 'Brush', icon: Paintbrush, tip: isArabic ? 'الرسم الحر بالفرشاة' : 'Freehand brush drawing' },
            { id: 'filters' as StudioTab, label: isArabic ? 'الفلاتر' : 'Filters', icon: Palette, tip: isArabic ? 'تأثيرات وفلاتر بصرية' : 'Visual filters & adjustments' },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeStudioTab === tab.id;
            return (
              <Tooltip key={tab.id} content={tab.tip} position="top">
                <button
                  onClick={() => {
                    setActiveStudioTab(tab.id);
                    setIsBrushMode(tab.id === 'draw');
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors shrink-0 ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              </Tooltip>
            );
          })}
        </div>
      </div>

      {/* 3. Studio Customization Panel */}
      <div className="glass-card p-6 sm:p-7 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-sm space-y-4">
        {/* TAB 1: TEXT STUDIO */}
        {activeStudioTab === 'text' && (
          <div className="space-y-4">
            {/* Layers Selector & Add */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 shrink-0">
                  <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  {isArabic ? 'الطبقات:' : 'Layers:'}
                </span>
                {textLayers.map((layer, idx) => (
                  <button
                    key={layer.id}
                    onClick={() => setSelectedTextId(layer.id)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 ${
                      selectedTextId === layer.id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    #{idx + 1} {layer.text ? layer.text.slice(0, 10) + '...' : 'Text'}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={handleAddTextLayer}
                  className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 border border-indigo-200 dark:border-indigo-500/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-xl flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'نص جديد' : 'Add Text'}</span>
                </button>
                {textLayers.length > 1 && (
                  <button
                    onClick={handleDeleteSelectedText}
                    className="p-1.5 bg-slate-100 dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/60 border border-slate-200 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-800 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 rounded-xl transition-colors"
                    title={isArabic ? 'حذف النص المحدد' : 'Delete Layer'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Selected Layer Properties */}
            {selectedTextLayer && (
              <div className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isArabic ? 'محتوى النص' : 'Text Content'}
                  </label>
                  <input
                    type="text"
                    value={selectedTextLayer.text}
                    onChange={(e) =>
                      setTextLayers((prev) =>
                        prev.map((l) => (l.id === selectedTextLayer.id ? { ...l, text: e.target.value } : l))
                      )
                    }
                    placeholder={isArabic ? 'اكتب النص هنا...' : 'Type text here...'}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0b0f17] border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Font Family */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isArabic ? 'الخط' : 'Font Family'}
                    </label>
                    <select
                      value={selectedTextLayer.fontFamily}
                      onChange={(e) =>
                        setTextLayers((prev) =>
                          prev.map((l) =>
                            l.id === selectedTextLayer.id ? { ...l, fontFamily: e.target.value } : l
                          )
                        )
                      }
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0b0f17] border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    >
                      {FONTS.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Font Size Slider */}
                  <div>
                    <div className="flex justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      <span>{isArabic ? 'حجم الخط' : 'Font Size'}</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-mono">{selectedTextLayer.fontSize}px</span>
                    </div>
                    <input
                      type="range"
                      min={14}
                      max={56}
                      value={selectedTextLayer.fontSize}
                      onChange={(e) =>
                        setTextLayers((prev) =>
                          prev.map((l) =>
                            l.id === selectedTextLayer.id ? { ...l, fontSize: Number(e.target.value) } : l
                          )
                        )
                      }
                      className="w-full accent-indigo-600 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer h-2"
                    />
                  </div>
                </div>

                {/* Color Swatches & Styles */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{isArabic ? 'اللون:' : 'Color:'}</span>
                    {COLOR_SWATCHES.map((col) => (
                      <button
                        key={col}
                        onClick={() =>
                          setTextLayers((prev) =>
                            prev.map((l) => (l.id === selectedTextLayer.id ? { ...l, color: col } : l))
                          )
                        }
                        className={`w-6 h-6 rounded-full border transition-transform ${
                          selectedTextLayer.color === col
                            ? 'scale-125 border-slate-900 dark:border-white ring-2 ring-indigo-500'
                            : 'border-slate-300 dark:border-slate-700 hover:scale-110'
                        }`}
                        style={{ backgroundColor: col }}
                      />
                    ))}
                  </div>

                  {/* Style Toggles */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setTextLayers((prev) =>
                          prev.map((l) =>
                            l.id === selectedTextLayer.id ? { ...l, isUppercase: !l.isUppercase } : l
                          )
                        )
                      }
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-colors ${
                        selectedTextLayer.isUppercase
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500'
                          : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      AA
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setTextLayers((prev) =>
                          prev.map((l) =>
                            l.id === selectedTextLayer.id ? { ...l, bgHighlight: !l.bgHighlight } : l
                          )
                        )
                      }
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-colors ${
                        selectedTextLayer.bgHighlight
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500'
                          : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      {isArabic ? 'شريط خلفي' : 'Box Bar'}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setTextLayers((prev) =>
                          prev.map((l) =>
                            l.id === selectedTextLayer.id ? { ...l, hasShadow: !l.hasShadow } : l
                          )
                        )
                      }
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-colors ${
                        selectedTextLayer.hasShadow
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500'
                          : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      {isArabic ? 'ظل' : 'Shadow'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: TEMPLATES & BACKGROUND */}
        {activeStudioTab === 'templates' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex gap-2">
                {TEMPLATE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setTemplateCategory(cat.id)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                      templateCategory === cat.id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {isArabic ? cat.nameAr : cat.name}
                  </button>
                ))}
              </div>

              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCustomImageUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/80 border border-sky-200 dark:border-sky-500/40 text-sky-700 dark:text-sky-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'رفع صورة من جهازك' : 'Upload Image'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {TEMPLATE_CATEGORIES.find((c) => c.id === templateCategory)?.templates.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => setBgImage(tpl.url)}
                  className={`group relative rounded-2xl overflow-hidden border-2 aspect-video transition-all ${
                    bgImage === tpl.url
                      ? 'border-indigo-500 ring-2 ring-indigo-500/50 scale-102'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600'
                  }`}
                >
                  <img src={tpl.url} alt={tpl.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 text-center">
                    <span className="text-[10px] font-bold text-white truncate">{tpl.name}</span>
                  </div>
                  {bgImage === tpl.url && (
                    <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center shadow">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: STICKERS & EMOJIS */}
        {activeStudioTab === 'stickers' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex gap-2">
                {STICKER_PACKS.map((pack) => (
                  <button
                    key={pack.id}
                    onClick={() => setActiveStickerPack(pack.id)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                      activeStickerPack === pack.id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {pack.label}
                  </button>
                ))}
              </div>

              {selectedSticker && (
                <button
                  onClick={handleDeleteSelectedSticker}
                  className="px-2.5 py-1 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-xl flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>{isArabic ? 'حذف الملصق' : 'Delete Sticker'}</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
              {STICKER_PACKS.find((p) => p.id === activeStickerPack)?.emojis.map((emoji, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAddSticker(emoji)}
                  className="aspect-square bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 rounded-2xl flex items-center justify-center text-2xl hover:scale-115 active:scale-95 transition-all shadow-sm"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: BRUSH & DRAWING STUDIO */}
        {activeStudioTab === 'draw' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              {/* Brush Type */}
              <div className="flex gap-2">
                {[
                  { id: 'glow' as const, label: isArabic ? 'قلم نيون مضيء' : 'Neon Glow', icon: Sparkles },
                  { id: 'pen' as const, label: isArabic ? 'قلم عادي' : 'Solid Pen', icon: Paintbrush },
                  { id: 'eraser' as const, label: isArabic ? 'ممحاة' : 'Eraser', icon: Eraser },
                ].map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.id}
                      onClick={() => setBrushType(type.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        brushType === type.id
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{type.label}</span>
                    </button>
                  );
                })}
              </div>

              {brushStrokes.length > 0 && (
                <button
                  onClick={() => setBrushStrokes([])}
                  className="px-2.5 py-1 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                >
                  {isArabic ? 'مسح كل الرسومات' : 'Clear Drawings'}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              {/* Color Swatches */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{isArabic ? 'لون الرسم:' : 'Brush Color:'}</span>
                {COLOR_SWATCHES.map((col) => (
                  <button
                    key={col}
                    onClick={() => setBrushColor(col)}
                    className={`w-6 h-6 rounded-full border transition-transform ${
                      brushColor === col
                        ? 'scale-125 border-slate-900 dark:border-white ring-2 ring-indigo-500'
                        : 'border-slate-300 dark:border-slate-700 hover:scale-110'
                    }`}
                    style={{ backgroundColor: col }}
                  />
                ))}
              </div>

              {/* Brush Size Slider */}
              <div>
                <div className="flex justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span>{isArabic ? 'سُمك القلم' : 'Brush Size'}</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-mono">{brushSize}px</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={24}
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="w-full accent-indigo-600 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer h-2"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: VISUAL FILTERS */}
        {activeStudioTab === 'filters' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setActiveFilter(f)}
                  className={`p-3 rounded-2xl border text-center transition-all ${
                    activeFilter.id === f.id
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-700 dark:text-indigo-300 shadow-sm ring-1 ring-indigo-500'
                      : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Palette className={`w-5 h-5 mx-auto mb-1.5 ${activeFilter.id === f.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                  <div className="font-bold text-xs">{isArabic ? f.nameAr : f.name}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4. Publishing & Sharing Deck */}
      <div className="glass-card p-6 sm:p-7 rounded-3xl border border-slate-200 dark:border-slate-800/80 space-y-5 shadow-sm">
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {isArabic ? 'وصف الميم / التعليق' : 'Meme Caption & Tags'}
            </label>
            <div className="flex gap-1.5">
              {['#meme', '#sparkloop', '#devhumor', '#vibes'].map((tag) => (
                <Tooltip key={tag} content={`${isArabic ? 'إدراج الوسم' : 'Insert tag'} ${tag}`} position="top">
                  <button
                    type="button"
                    onClick={() => setCaption((prev) => (prev ? `${prev} ${tag}` : tag))}
                    className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-800 transition-colors"
                  >
                    {tag}
                  </button>
                </Tooltip>
              ))}
            </div>
          </div>
          <textarea
            rows={2}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder={
              isArabic
                ? 'أضف تعليقاً مضحكاً لمشاركته مع المجتمع...'
                : 'Write a witty caption or tags before publishing...'
            }
            className="w-full p-3 bg-slate-50 dark:bg-[#0b0f17] border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 resize-none focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
          />
        </div>

        {statusMessage && (
          <div
            className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 ${
              statusMessage.isError
                ? 'bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                : 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            <span>{statusMessage.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <Tooltip content={isArabic ? 'نشر هذا الميم كمنشور جديد في الموجز العام' : 'Publish this meme artwork to global feed'} position="top">
            <button
              type="button"
              onClick={() => handlePublish('feed')}
              disabled={isUploading}
              className="w-full py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 disabled:opacity-50 text-slate-800 dark:text-slate-200 font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              {isUploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 text-sky-500" />}
              <span>{isArabic ? 'نشر في الموجز العام 📱' : 'Post to Feed 📱'}</span>
            </button>
          </Tooltip>

          <Tooltip content={isArabic ? 'تقديم هذا الميم كمشاركة في تحدي السبارك اليومي' : 'Submit meme entry to active Daily Spark challenge'} position="top">
            <button
              type="button"
              onClick={() => handlePublish('spark')}
              disabled={isUploading}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              {isUploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4 text-amber-300 fill-amber-300" />}
              <span>{isArabic ? 'مشاركة في تحدي اليوم 🏆' : 'Submit to Daily Spark 🏆'}</span>
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};
