import React from 'react';
import { AlertCircle, AlertTriangle, ShieldCheck, Clock, Flame } from 'lucide-react';

interface TriageBadgeProps {
  priority: string;
  className?: string;
  showIcon?: boolean;
}

export const TriageBadge: React.FC<TriageBadgeProps> = ({ priority, className = '', showIcon = true }) => {
  const norm = (priority || '').toLowerCase();

  if (norm === 'emergency') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-900 border border-red-300 ring-2 ring-red-400/30 ${className}`}>
        {showIcon && <Flame className="w-3.5 h-3.5 text-red-600 animate-pulse" />}
        <span className="tracking-wide uppercase font-extrabold">EMERGENCY</span>
      </span>
    );
  }

  if (norm === 'urgent') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-950 border border-orange-300 ${className}`}>
        {showIcon && <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />}
        <span className="tracking-wide uppercase">URGENT</span>
      </span>
    );
  }

  if (norm === 'high') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-950 border border-amber-300 ${className}`}>
        {showIcon && <AlertCircle className="w-3.5 h-3.5 text-amber-600" />}
        <span className="tracking-wide uppercase">HIGH PRIORITY</span>
      </span>
    );
  }

  if (norm === 'routine') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-950 border border-emerald-300 ${className}`}>
        {showIcon && <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />}
        <span className="tracking-wide uppercase">ROUTINE</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-300 ${className}`}>
      {showIcon && <Clock className="w-3.5 h-3.5 text-slate-500" />}
      <span className="tracking-wide uppercase">AWAITING DATA</span>
    </span>
  );
};
