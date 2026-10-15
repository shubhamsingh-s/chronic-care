import React from 'react';
import { AlertOctagon, PhoneCall, ExternalLink } from 'lucide-react';

interface EmergencyBannerProps {
  reason?: string;
  onDismiss?: () => void;
}

export const EmergencyBanner: React.FC<EmergencyBannerProps> = ({ reason }) => {
  return (
    <div className="bg-red-600 text-white shadow-lg border-b border-red-700 animate-pulse-subtle">
      <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center space-x-3 flex-1">
            <span className="flex p-2 rounded-lg bg-red-700 text-white shrink-0">
              <AlertOctagon className="h-6 w-6 animate-bounce" aria-hidden="true" />
            </span>
            <div>
              <p className="font-bold text-sm sm:text-base tracking-wide flex items-center gap-2">
                CRITICAL EMERGENCY SAFETY ALERT
                <span className="inline-block bg-white text-red-700 font-extrabold text-xs px-2 py-0.5 rounded uppercase">
                  Immediate Action Required
                </span>
              </p>
              <p className="text-xs sm:text-sm text-red-100 mt-0.5 font-medium">
                {reason || 'A life-threatening biomarker or red-flag clinical symptom has been recorded.'}
                {' '}Do NOT wait for asynchronous doctor review. Call emergency medical services immediately.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href="tel:911"
              className="flex items-center space-x-1.5 px-4 py-2 rounded-md bg-white text-red-700 font-bold text-sm shadow hover:bg-red-50 transition-colors"
            >
              <PhoneCall className="w-4 h-4" />
              <span>Call 911 / 112 Now</span>
            </a>
            <a
              href="https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings/hypertensive-crisis-when-you-should-call-9-1-1"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center space-x-1 px-3 py-2 rounded-md bg-red-700 hover:bg-red-800 text-xs text-white"
            >
              <span>Emergency Guidelines</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
