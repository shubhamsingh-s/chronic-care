import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Stethoscope, Heart, Activity, User, ShieldAlert, Sparkles, UserCheck } from 'lucide-react';

export const QuickDemoSwitcher: React.FC = () => {
  const { user, quickLogin } = useAuth();

  const demoAccounts = [
    {
      label: 'Dr. Jenkins (Cardio)',
      email: 'dr.jenkins@chroniccare.ai',
      role: 'doctor',
      badge: 'Pending Req + Emergency Alert',
      icon: <Heart className="w-3.5 h-3.5 text-rose-500" />
    },
    {
      label: 'Dr. Patel (Endo)',
      email: 'dr.patel@chroniccare.ai',
      role: 'doctor',
      badge: 'Urgent Hyperglycemia',
      icon: <Activity className="w-3.5 h-3.5 text-teal-600" />
    },
    {
      label: 'Dr. Rostova (Nephro)',
      email: 'dr.rostova@chroniccare.ai',
      role: 'doctor',
      badge: 'CKD eGFR Trend',
      icon: <Stethoscope className="w-3.5 h-3.5 text-indigo-600" />
    },
    {
      label: 'John Doe (Heart)',
      email: 'john.doe@patient.care',
      role: 'patient',
      badge: 'Accepted • Emergency BP',
      icon: <User className="w-3.5 h-3.5 text-emerald-600" />
    },
    {
      label: 'Emily Watson (Diabetes)',
      email: 'emily.watson@patient.care',
      role: 'patient',
      badge: 'Accepted • Sugar Spikes',
      icon: <User className="w-3.5 h-3.5 text-emerald-600" />
    },
    {
      label: 'David Miller (CKD)',
      email: 'david.miller@patient.care',
      role: 'patient',
      badge: 'Accepted • Creatinine Tracker',
      icon: <User className="w-3.5 h-3.5 text-emerald-600" />
    },
    {
      label: 'Alice Johnson',
      email: 'alice.johnson@patient.care',
      role: 'patient',
      badge: 'Pending Request Demo',
      icon: <UserCheck className="w-3.5 h-3.5 text-amber-500" />
    },
    {
      label: 'Michael Brown',
      email: 'michael.brown@patient.care',
      role: 'patient',
      badge: '12-Q Onboarding Demo',
      icon: <Sparkles className="w-3.5 h-3.5 text-blue-500" />
    },
    {
      label: 'Admin',
      email: 'admin@chroniccare.ai',
      role: 'admin',
      badge: 'Governance & Audits',
      icon: <ShieldAlert className="w-3.5 h-3.5 text-purple-600" />
    }
  ];

  return (
    <div className="bg-slate-900 border-b border-slate-800 text-white px-3 py-1.5 text-xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center space-x-1.5 shrink-0 font-medium text-slate-300">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
          </span>
          <span className="font-semibold text-slate-100">1-Click Clinical Demo Switcher:</span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar">
          {demoAccounts.map((acc) => {
            const isCurrent = user?.email.toLowerCase() === acc.email.toLowerCase();
            return (
              <button
                key={acc.email}
                onClick={() => quickLogin(acc.email)}
                title={`Switch to ${acc.label} (${acc.badge})`}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md transition-all text-xs font-medium border ${
                  isCurrent
                    ? 'bg-teal-600 text-white border-teal-400 shadow-sm shadow-teal-500/20 ring-1 ring-teal-400'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 hover:border-slate-600'
                }`}
              >
                {acc.icon}
                <span className="whitespace-nowrap">{acc.label}</span>
                {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
