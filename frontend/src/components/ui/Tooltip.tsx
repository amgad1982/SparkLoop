import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useThemeStore } from '../../stores/useThemeStore';

export interface TooltipProps {
  content: string | React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
  disabled?: boolean;
}

interface Coords {
  top: number;
  left: number;
  actualPosition: 'top' | 'bottom' | 'left' | 'right';
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 150,
  className = '',
  disabled = false,
}) => {
  const { direction } = useThemeStore();
  const isRtl = direction === 'rtl';

  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    // RTL position flipping for side tooltips
    let effectivePosition = position;
    if (isRtl) {
      if (position === 'left') effectivePosition = 'right';
      else if (position === 'right') effectivePosition = 'left';
    }

    const gap = 8;
    const padding = 12;

    // Viewport collision flipping
    if (effectivePosition === 'top' && rect.top < 45) {
      effectivePosition = 'bottom';
    } else if (effectivePosition === 'bottom' && rect.bottom > window.innerHeight - 45) {
      effectivePosition = 'top';
    } else if (effectivePosition === 'left' && rect.left < 100) {
      effectivePosition = 'right';
    } else if (effectivePosition === 'right' && rect.right > window.innerWidth - 100) {
      effectivePosition = 'left';
    }

    let top = 0;
    let left = 0;

    switch (effectivePosition) {
      case 'bottom':
        top = rect.bottom + gap;
        left = Math.min(
          Math.max(rect.left + rect.width / 2, padding + 60),
          window.innerWidth - padding - 60
        );
        break;
      case 'left':
        top = Math.min(
          Math.max(rect.top + rect.height / 2, padding + 15),
          window.innerHeight - padding - 15
        );
        left = rect.left - gap;
        break;
      case 'right':
        top = Math.min(
          Math.max(rect.top + rect.height / 2, padding + 15),
          window.innerHeight - padding - 15
        );
        left = rect.right + gap;
        break;
      case 'top':
      default:
        top = rect.top - gap;
        left = Math.min(
          Math.max(rect.left + rect.width / 2, padding + 60),
          window.innerWidth - padding - 60
        );
        break;
    }

    setCoords({ top, left, actualPosition: effectivePosition });
  }, [position, isRtl]);

  const handleMouseEnter = () => {
    if (disabled || !content) return;
    timeoutRef.current = setTimeout(() => {
      updatePosition();
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  };

  useEffect(() => {
    if (!isVisible) return;

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isVisible, updatePosition]);

  if (!content || disabled) {
    return <>{children}</>;
  }

  const getTransformClasses = (pos: 'top' | 'bottom' | 'left' | 'right') => {
    switch (pos) {
      case 'bottom':
        return '-translate-x-1/2 translate-y-0';
      case 'left':
        return '-translate-x-full -translate-y-1/2';
      case 'right':
        return 'translate-x-0 -translate-y-1/2';
      case 'top':
      default:
        return '-translate-x-1/2 -translate-y-full';
    }
  };

  const getArrowClasses = (pos: 'top' | 'bottom' | 'left' | 'right') => {
    switch (pos) {
      case 'bottom':
        return 'bottom-full left-1/2 -translate-x-1/2 border-b-zinc-900 border-x-transparent border-t-transparent border-b-4 border-x-4 border-t-0';
      case 'left':
        return 'left-full top-1/2 -translate-y-1/2 border-l-zinc-900 border-y-transparent border-r-transparent border-l-4 border-y-4 border-r-0';
      case 'right':
        return 'right-full top-1/2 -translate-y-1/2 border-r-zinc-900 border-y-transparent border-l-transparent border-r-4 border-y-4 border-r-0';
      case 'top':
      default:
        return 'top-full left-1/2 -translate-x-1/2 border-t-zinc-900 border-x-transparent border-b-transparent border-t-4 border-x-4 border-b-0';
    }
  };

  return (
    <>
      <span
        ref={triggerRef}
        className={`inline-flex items-center justify-center shrink-0 ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleMouseEnter}
        onBlur={handleMouseLeave}
      >
        {children}
      </span>

      {isVisible &&
        coords &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="tooltip"
            style={{
              top: `${coords.top}px`,
              left: `${coords.left}px`,
            }}
            className={`fixed z-[999999] pointer-events-none whitespace-nowrap max-w-[280px] px-2.5 py-1 text-[11px] font-bold tracking-tight rounded-lg shadow-2xl backdrop-blur-md transition-opacity duration-150 animate-in fade-in zoom-in-95 bg-zinc-900/95 text-white border border-zinc-700/90 dark:bg-zinc-900/95 dark:text-zinc-100 dark:border-zinc-700/80 select-none ${getTransformClasses(
              coords.actualPosition
            )}`}
          >
            {content}
            <div className={`absolute w-0 h-0 ${getArrowClasses(coords.actualPosition)}`} />
          </div>,
          document.body
        )}
    </>
  );
};