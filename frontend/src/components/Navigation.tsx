import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Activity, Bell, LogOut, Shield, User, CheckCircle2, Stethoscope } from 'lucide-react';

interface NavigationProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  tabs?: Array<{ id: string; label: string; icon?: React.ReactNode; badge?: string | number }>;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange, tabs = [] }) => {
  const { user, logout } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // We can poll or fetch notifications
  useEffect(() => {
    // Initial mock count or from user
    if (user?.role === 'doctor') {
      setUnreadCount(2); // e.g. Dr. Jenkins has pending request + emergency BP
    } else {
      setUnreadCount(1);
    }
  }, [user]);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Clinical Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-700 to-teal-500 flex items-center justify-center text-white shadow-md shadow-teal-700/20">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold tracking-tight text-slate-900">ChronicCare<span className="text-teal-600"> AI</span></span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
                  Clinical 2.0
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                Predictive Triage & Remote Patient Monitoring
              </p>
            </div>
          </div>

          {/* User profile & actions */}
          <div className="flex items-center space-x-3">
            {/* Role indicator */}
            <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
              {user?.role === 'doctor' && (
                <span className="flex items-center gap-1.5 font-semibold text-teal-700">
                  <Stethoscope className="w-4 h-4 text-teal-600" />
                  Physician Portal
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 ml-1" />
                </span>
              )}
              {user?.role === 'patient' && (
                <span className="flex items-center gap-1.5 font-semibold text-indigo-700">
                  <User className="w-4 h-4 text-indigo-600" />
                  Patient Portal
                  {user.questionnaire_completed && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                      Verified
                    </span>
                  )}
                </span>
              )}
              {user?.role === 'admin' && (
                <span className="flex items-center gap-1.5 font-semibold text-purple-700">
                  <Shield className="w-4 h-4 text-purple-600" />
                  Administrator
                </span>
              )}
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 relative transition-colors"
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white animate-pulse" />
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-slate-500">Clinical Alerts</span>
                    <button
                      onClick={() => setUnreadCount(0)}
                      className="text-[11px] text-teal-600 hover:underline font-medium"
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                    {user?.role === 'doctor' ? (
                      <>
                        <div className="p-3 hover:bg-slate-50 text-xs">
                          <p className="font-bold text-red-600 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-red-600"></span>
                            EMERGENCY BP ALERT: John Doe
                          </p>
                          <p className="text-slate-600 mt-1">Hypertensive Crisis (184/116 mmHg). Review in Smart Priority Queue.</p>
                          <span className="text-[10px] text-slate-400 mt-1 block">15 mins ago</span>
                        </div>
                        <div className="p-3 hover:bg-slate-50 text-xs">
                          <p className="font-semibold text-slate-800">New Consultation Request: Alice Johnson</p>
                          <p className="text-slate-600 mt-1">Patient submitted request for Heart Disease. Instant name visible.</p>
                          <span className="text-[10px] text-slate-400 mt-1 block">1 hour ago</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="p-3 hover:bg-slate-50 text-xs">
                          <p className="font-semibold text-teal-700">Specialist Review Recorded</p>
                          <p className="text-slate-600 mt-1">Your doctor evaluated your latest daily check-in logs.</p>
                          <span className="text-[10px] text-slate-400 mt-1 block">2 hours ago</span>
                        </div>
                        <div className="p-3 hover:bg-slate-50 text-xs">
                          <p className="font-semibold text-slate-800">AI Risk Assessment Updated</p>
                          <p className="text-slate-600 mt-1">New 7-day trend analysis has been calibrated with your recent reports.</p>
                          <span className="text-[10px] text-slate-400 mt-1 block">Yesterday</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Name & Logout */}
            <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-900 leading-tight">{user?.full_name}</p>
                <p className="text-[10px] text-slate-500">{user?.email}</p>
              </div>
              <button
                onClick={logout}
                className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs (if passed) */}
        {tabs.length > 0 && (
          <div className="flex space-x-1 border-t border-slate-100 overflow-x-auto no-scrollbar py-2">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange && onTabChange(tab.id)}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-teal-50 text-teal-800 font-semibold border border-teal-200 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isActive ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
};
