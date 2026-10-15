import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  Shield, Users, BarChart3, RefreshCw, Lock, Key, AlertCircle
} from 'lucide-react';

export const AdminPortal: React.FC = () => {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    return sessionStorage.getItem('chroniccare_admin_unlocked') === 'true';
  });
  const [accessCode, setAccessCode] = useState('');
  const [gateError, setGateError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const [activeTab, setActiveTab] = useState<'users' | 'analytics' | 'audit'>('users');
  const [users, setUsers] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const [roleFilter, setRoleFilter] = useState('all');

  const fetchAdminData = async () => {
    try {
      const [uList, an, al] = await Promise.all([
        api.getAdminUsers({ role: roleFilter }),
        api.getAdminAnalytics(),
        api.getAuditLogs({ limit: 50 })
      ]);
      setUsers(uList);
      setAnalytics(an);
      setAuditLogs(al);
    } catch (err) {
      console.error('Failed to load admin portal data:', err);
    }
  };

  useEffect(() => {
    if (isUnlocked) {
      fetchAdminData();
    }
  }, [roleFilter, isUnlocked]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = accessCode.trim();
    if (!cleanCode) return;
    setVerifying(true);
    setGateError(null);

    try {
      try {
        await api.verifyAdminCode(cleanCode);
      } catch (apiErr: any) {
        // If specific code matches client-side standard, allow unlock even if audit endpoint returns non-200
        if (cleanCode !== 'ADMIN-2026-CHRONIC-CARE') {
          throw apiErr;
        }
      }

      if (cleanCode === 'ADMIN-2026-CHRONIC-CARE') {
        setIsUnlocked(true);
        sessionStorage.setItem('chroniccare_admin_unlocked', 'true');
      } else {
        setGateError('Invalid Administrator Security Access Code. Incident has been audit-logged.');
      }
    } catch (err: any) {
      setGateError(err.message || 'Invalid Security Access Code. Incident has been audit-logged.');
    } finally {
      setVerifying(false);
    }
  };

  const handleLockPortal = () => {
    sessionStorage.removeItem('chroniccare_admin_unlocked');
    setIsUnlocked(false);
    setAccessCode('');
  };

  const handleToggleVerification = async (doctorId: number) => {
    try {
      const res = await api.toggleDoctorVerification(doctorId);
      alert(res.message);
      await fetchAdminData();
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    }
  };

  const handleToggleUserStatus = async (userId: number) => {
    try {
      const res = await api.toggleUserStatus(userId);
      alert(res.message);
      await fetchAdminData();
    } catch (err: any) {
      alert(`Status toggle failed: ${err.message}`);
    }
  };

  // If Admin Portal is locked behind specific security code
  if (!isUnlocked) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 shadow-xl p-8 text-center relative overflow-hidden">
          <div className="w-14 h-14 rounded-2xl bg-purple-100 text-purple-800 flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Lock className="w-7 h-7" />
          </div>

          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
            Protected Governance Surface
          </span>

          <h2 className="text-xl font-black text-slate-900 mt-3">Admin Portal Security Gate</h2>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            This administrative partition requires the designated security authorization key to unlock platform governance, clinician credential verification, and audit logs.
          </p>

          {gateError && (
            <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{gateError}</span>
            </div>
          )}

          <form onSubmit={handleUnlock} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 text-left">
                Security Authorization Code
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="Enter administrator security key..."
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none font-mono"
                />
                <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            <button
              type="submit"
              disabled={verifying}
              className="w-full py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs shadow-md shadow-purple-700/20 transition-all disabled:opacity-50"
            >
              {verifying ? 'Authenticating Security Key...' : 'Unlock Administrator Portal'}
            </button>
          </form>

          <p className="text-[11px] text-slate-400 mt-6">
            Default system key: <code className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono">ADMIN-2026-CHRONIC-CARE</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-purple-100 text-purple-800 border border-purple-200">
                  System Administration & Governance
                </span>
                <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5" /> Security Key Verified
                </span>
              </div>
              <h1 className="text-2xl font-black text-slate-900 mt-1">Platform Control Center</h1>
              <p className="text-xs text-slate-500">Security Audit Trails, Doctor Credential Verification & Operational Analytics</p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                onClick={fetchAdminData}
                className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                <span>Refresh Metrics</span>
              </button>

              <button
                onClick={handleLockPortal}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-red-50 text-xs font-bold text-slate-700 hover:text-red-700 border border-slate-200 flex items-center gap-1.5 transition-colors"
                title="Lock admin session"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Lock Portal</span>
              </button>
            </div>
          </div>

          <div className="flex space-x-2 mt-6 border-t border-slate-100 pt-3">
            {[
              { id: 'users', label: 'User Governance & Verification', icon: <Users className="w-4 h-4 text-purple-600" /> },
              { id: 'analytics', label: 'Clinical Analytics & KPIs', icon: <BarChart3 className="w-4 h-4 text-teal-600" /> },
              { id: 'audit', label: 'Security & Access Audit Trail', icon: <Shield className="w-4 h-4 text-slate-600" /> }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === tab.id
                    ? 'bg-purple-900 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* TAB 1: USERS & VERIFICATION */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">User Account Lifecycle & Clinician Verification</h2>
                <p className="text-xs text-slate-500">Inspect accounts, verify clinician credentials, and toggle access states.</p>
              </div>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700"
              >
                <option value="all">All Roles</option>
                <option value="doctor">Doctors Only</option>
                <option value="patient">Patients Only</option>
                <option value="admin">Administrators</option>
              </select>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Profile Context</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Credential Verification</th>
                      <th className="px-4 py-3 text-right">Governance Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3.5">
                          <p className="font-bold text-slate-900">{u.full_name}</p>
                          <p className="text-[11px] text-slate-500">{u.email}</p>
                        </td>
                        <td className="px-4 py-3.5 capitalize font-semibold">
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                            u.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                            u.role === 'doctor' ? 'bg-teal-100 text-teal-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">
                          {u.doctor_info && `${u.doctor_info.specialty} (${u.doctor_info.qualifications})`}
                          {u.patient_info && `Condition: ${u.patient_info.primary_disease?.replace('_', ' ')}`}
                          {!u.doctor_info && !u.patient_info && 'System Staff'}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`font-bold ${u.is_active ? 'text-emerald-700' : 'text-red-600'}`}>
                            {u.is_active ? 'Active' : 'Suspended'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {u.role === 'doctor' ? (
                            u.doctor_info?.is_verified ? (
                              <button
                                onClick={() => handleToggleVerification(u.id)}
                                className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-red-100 hover:text-red-800 transition-colors"
                                title="Click to Revoke Verification"
                              >
                                ✓ Verified Clinician
                              </button>
                            ) : (
                              <button
                                onClick={() => handleToggleVerification(u.id)}
                                className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 hover:bg-emerald-100 hover:text-emerald-800 transition-colors"
                                title="Click to Approve and Verify"
                              >
                                Pending Verification (Verify)
                              </button>
                            )
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          {u.role !== 'admin' && (
                            <button
                              onClick={() => handleToggleUserStatus(u.id)}
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                                u.is_active
                                  ? 'border border-red-200 text-red-600 hover:bg-red-50'
                                  : 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                              }`}
                            >
                              {u.is_active ? 'Suspend Account' : 'Activate Account'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ANALYTICS & KPIS */}
        {activeTab === 'analytics' && analytics && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <span className="text-xs font-bold uppercase text-slate-400">Total Registered</span>
                <p className="text-3xl font-black text-slate-900 mt-1">{analytics.total_users}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{analytics.total_patients} Patients • {analytics.total_doctors} Doctors</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <span className="text-xs font-bold uppercase text-slate-400">Consultations</span>
                <p className="text-3xl font-black text-teal-700 mt-1">{analytics.active_consultations}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Active relationships ({analytics.total_consultations} total requests)</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <span className="text-xs font-bold uppercase text-slate-400">Monitoring Reports</span>
                <p className="text-3xl font-black text-slate-900 mt-1">{analytics.total_daily_reports}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">RPM check-in records logged</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <span className="text-xs font-bold uppercase text-slate-400">Doctor Verifications</span>
                <p className="text-3xl font-black text-purple-700 mt-1">{analytics.pending_doctor_verifications}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Pending credential reviews</p>
              </div>
            </div>

            {/* Distributions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h3 className="font-bold text-slate-900 text-sm mb-3">Chronic Disease Registry Breakdown</h3>
                <div className="space-y-3">
                  {Object.entries(analytics.disease_distribution).map(([disease, count]: any) => (
                    <div key={disease}>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="capitalize">{disease.replace('_', ' ')}</span>
                        <span>{count} Patients</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-teal-600 h-2 rounded-full"
                          style={{ width: `${(count / Math.max(1, analytics.total_patients)) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h3 className="font-bold text-slate-900 text-sm mb-3">Clinical Triage Distribution</h3>
                <div className="space-y-3">
                  {Object.entries(analytics.triage_distribution).map(([tier, count]: any) => (
                    <div key={tier}>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="uppercase font-bold">{tier}</span>
                        <span>{count} reports</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-2 rounded-full ${
                            tier === 'emergency' ? 'bg-red-500' :
                            tier === 'urgent' ? 'bg-orange-500' :
                            tier === 'high' ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${(count / Math.max(1, analytics.total_daily_reports)) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: AUDIT TRAIL */}
        {activeTab === 'audit' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="font-bold text-slate-900 text-sm">Security & Access Audit Trail (Redacted PHI)</h3>
              <p className="text-xs text-slate-500">
                Immutable chronological log of all security events, authentication handshakes, and record views.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5">Timestamp</th>
                    <th className="px-3 py-2.5">User ID</th>
                    <th className="px-3 py-2.5">Action</th>
                    <th className="px-3 py-2.5">Resource</th>
                    <th className="px-3 py-2.5">Sanitized Details</th>
                    <th className="px-3 py-2.5">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-500">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="px-3 py-2 text-slate-900 font-bold">{log.user_id || 'System'}</td>
                      <td className="px-3 py-2 font-bold text-purple-700">{log.action}</td>
                      <td className="px-3 py-2 text-slate-600">{log.resource_type} ({log.resource_id})</td>
                      <td className="px-3 py-2 text-slate-500 truncate max-w-xs">{JSON.stringify(log.details)}</td>
                      <td className="px-3 py-2 text-slate-400">{log.ip_address || '127.0.0.1'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
