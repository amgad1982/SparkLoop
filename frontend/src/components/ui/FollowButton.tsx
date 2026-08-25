import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { api } from '../../services/apiClient';
import { Tooltip } from './Tooltip';
import { Check, UserPlus, UserCheck, Clock, RefreshCw, Loader2, UserMinus } from 'lucide-react';
import { motion } from 'framer-motion';

export type FollowStatusType =
  | 'none'
  | 'pending_outgoing'
  | 'pending_incoming'
  | 'following'
  | 'follow_back'
  | 'mutual'
  | 'self';

interface FollowButtonProps {
  targetUserId: string;
  targetUsername: string;
  initialStatus?: FollowStatusType;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  onStatusChange?: (newStatus: FollowStatusType) => void;
  className?: string;
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right';
}

export const FollowButton: React.FC<FollowButtonProps> = ({
  targetUserId,
  targetUsername,
  initialStatus = 'none',
  size = 'sm',
  onStatusChange,
  className = '',
  tooltipPosition = 'top',
}) => {
  const { currentPersona } = useAuthStore();
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';

  const [status, setStatus] = useState<FollowStatusType>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const isSelf =
    currentPersona?.id === targetUserId ||
    currentPersona?.username.toLowerCase() === targetUsername.toLowerCase();

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  if (isSelf || status === 'self') {
    return null;
  }

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;

    setLoading(true);
    try {
      if (status === 'following' || status === 'mutual') {
        // Unfollow
        await api.unfollowUser(targetUserId);
        const newStatus = 'none';
        setStatus(newStatus);
        onStatusChange?.(newStatus);
      } else if (status === 'pending_outgoing') {
        // Cancel request
        await api.unfollowUser(targetUserId);
        const newStatus = 'none';
        setStatus(newStatus);
        onStatusChange?.(newStatus);
      } else if (status === 'follow_back' || status === 'none' || status === 'pending_incoming') {
        // Follow / Follow Back
        await api.followUser(targetUserId);
        const newStatus: FollowStatusType = status === 'follow_back' ? 'mutual' : 'following';
        setStatus(newStatus);
        onStatusChange?.(newStatus);
      }
    } catch (err) {
      console.error('Follow action failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // Dimensions & typography based on size
  const sizeStyles = {
    xs: 'px-2 py-0.5 text-[10px] rounded-lg gap-1',
    sm: 'px-2.5 py-1 text-xs rounded-xl gap-1.5',
    md: 'px-3.5 py-1.5 text-xs font-semibold rounded-xl gap-1.5',
    lg: 'px-4 py-2 text-sm font-bold rounded-2xl gap-2',
  }[size];

  // Render button content and styles based on relationship state
  const renderConfig = () => {
    if (loading) {
      return {
        label: isArabic ? 'جاري التحميل...' : 'Loading...',
        icon: <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />,
        style: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700',
        tooltip: '',
      };
    }

    if (status === 'following' || status === 'mutual') {
      if (isHovered) {
        return {
          label: isArabic ? 'إلغاء المتابعة' : 'Unfollow',
          icon: <UserMinus className="w-3.5 h-3.5 shrink-0" />,
          style:
            'bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-500/40 hover:bg-rose-500 hover:text-white dark:hover:text-white',
          tooltip: isArabic ? 'إلغاء متابعة هذا المبدع' : 'Unfollow creator',
        };
      }

      return {
        label: status === 'mutual' ? (isArabic ? 'متابعة متبادلة' : 'Mutual') : isArabic ? 'تتابعه' : 'Following',
        icon: <UserCheck className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />,
        style:
          'bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/40 font-medium shadow-sm',
        tooltip: isArabic ? 'أنت تتابع هذا المستخدم' : 'You are following this creator',
      };
    }

    if (status === 'pending_outgoing') {
      return {
        label: isArabic ? 'تم الطلب' : 'Requested',
        icon: <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />,
        style:
          'bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 font-medium',
        tooltip: isArabic ? 'طلب المتابعة قيد الانتظار' : 'Follow request pending',
      };
    }

    if (status === 'follow_back') {
      return {
        label: isArabic ? 'متابعة بالمثل' : 'Follow Back',
        icon: <RefreshCw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />,
        style:
          'bg-emerald-500/15 dark:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-400 dark:border-emerald-500/50 hover:bg-emerald-600 hover:text-white font-bold shadow-sm',
        tooltip: isArabic ? 'هذا المبدع يتابعك! تابعه بالمثل' : 'This creator follows you! Follow back',
      };
    }

    // Default 'none'
    return {
      label: isArabic ? 'متابعة' : 'Follow',
      icon: <UserPlus className="w-3.5 h-3.5 shrink-0" />,
      style:
        'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold shadow-md shadow-indigo-500/20 border border-transparent active:scale-95',
      tooltip: isArabic ? 'متابعة لمعرفة أحدث المشاركات' : 'Follow to see latest creations',
    };
  };

  const config = renderConfig();

  return (
    <Tooltip content={config.tooltip} position={tooltipPosition}>
      <motion.button
        type="button"
        whileTap={{ scale: 0.96 }}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`inline-flex items-center justify-center transition-all duration-200 ${sizeStyles} ${config.style} ${className}`}
      >
        {config.icon}
        <span className="truncate">{config.label}</span>
      </motion.button>
    </Tooltip>
  );
};

