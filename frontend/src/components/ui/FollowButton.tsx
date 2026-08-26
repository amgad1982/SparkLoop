import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { api } from '../../services/apiClient';
import { Tooltip } from './Tooltip';
import { UserPlus, UserCheck, Clock, RefreshCw, Loader2, UserMinus } from 'lucide-react';
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
        await api.unfollowUser(targetUserId);
        const newStatus = 'none';
        setStatus(newStatus);
        onStatusChange?.(newStatus);
      } else if (status === 'pending_outgoing') {
        await api.unfollowUser(targetUserId);
        const newStatus = 'none';
        setStatus(newStatus);
        onStatusChange?.(newStatus);
      } else if (status === 'follow_back' || status === 'none' || status === 'pending_incoming') {
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

  const sizeStyles = {
    xs: 'px-2.5 py-1 text-[11px] rounded-lg gap-1',
    sm: 'px-3 py-1.5 text-xs rounded-xl gap-1.5',
    md: 'px-3.5 py-1.5 text-xs font-semibold rounded-xl gap-1.5',
    lg: 'px-4 py-2 text-sm font-bold rounded-2xl gap-2',
  }[size];

  const renderConfig = () => {
    if (loading) {
      return {
        label: isArabic ? 'جاري التحميل...' : 'Loading...',
        icon: <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />,
        style: 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700',
        tooltip: '',
      };
    }

    if (status === 'following' || status === 'mutual') {
      if (isHovered) {
        return {
          label: isArabic ? 'إلغاء المتابعة' : 'Unfollow',
          icon: <UserMinus className="w-3.5 h-3.5 shrink-0" />,
          style: 'bg-rose-600 hover:bg-rose-500 text-white border border-rose-600 shadow-sm',
          tooltip: isArabic ? 'إلغاء متابعة هذا المبدع' : 'Unfollow creator',
        };
      }

      return {
        label: status === 'mutual' ? (isArabic ? 'متابعة متبادلة' : 'Mutual') : isArabic ? 'تتابعه' : 'Following',
        icon: <UserCheck className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300 shrink-0" />,
        style: 'bg-slate-100 dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700/80 font-medium shadow-sm',
        tooltip: isArabic ? 'أنت تتابع هذا المستخدم' : 'You are following this creator',
      };
    }

    if (status === 'pending_outgoing') {
      return {
        label: isArabic ? 'تم الطلب' : 'Requested',
        icon: <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />,
        style: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-medium',
        tooltip: isArabic ? 'طلب المتابعة قيد الانتظار' : 'Follow request pending',
      };
    }

    if (status === 'follow_back') {
      return {
        label: isArabic ? 'متابعة بالمثل' : 'Follow Back',
        icon: <RefreshCw className="w-3.5 h-3.5 shrink-0" />,
        style: 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium shadow-sm border border-transparent',
        tooltip: isArabic ? 'هذا المبدع يتابعك! تابعه بالمثل' : 'This creator follows you! Follow back',
      };
    }

    // Default 'none'
    return {
      label: isArabic ? 'متابعة' : 'Follow',
      icon: <UserPlus className="w-3.5 h-3.5 shrink-0" />,
      style: 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium shadow-sm border border-transparent',
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
        className={`inline-flex items-center justify-center transition-all duration-150 ${sizeStyles} ${config.style} ${className}`}
      >
        {config.icon}
        <span className="truncate">{config.label}</span>
      </motion.button>
    </Tooltip>
  );
};
