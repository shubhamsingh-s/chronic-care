import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  Activity, User, Stethoscope, ArrowRight, Shield, Eye, EyeOff,
  Lock, ShieldCheck, KeyRound
} from 'lucide-react';

export const LoginRegister: React.FC = () => {
  const { login, quickLogin } = useAuth();
  const [isRegister, setIsRegister] = useState<boolean>(() => {
    return sessionStorage.getItem('chroniccare_auth_mode') === 'register';
  });
  const [role, setRole] = useState<'patient' | 'doctor' | 'admin'>(() => {
    return (sessionStorage.getItem('chroniccare_auth_role') as any) || 'patient';
  });

  useEffect(() => {
    sessionStorage.setItem('chroniccare_auth_mode', isRegister ? 'register' : 'signin');
  }, [isRegister]);

  useEffect(() => {
    sessionStorage.setItem('chroniccare_auth_role', role);
  }, [role]);

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [specialty, setSpecialty] = useState('Cardiology');
  const [qualifications, setQualifications] = useState('MD, FACC');
  const [experienceYears, setExperienceYears] = useState(10);
  const [fee, setFee] = useState(100);
  const [adminCode, setAdminCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [quickLoginLoading, setQuickLoginLoading] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (password.length < 4) {
      setErrorMsg('Password must be at least 4 characters long.');
      return;
    }

    if (isRegister) {
      if (!fullName.trim()) {
        setErrorMsg('Please enter your full legal name.');
        return;
      }
      if (role === 'admin' && !adminCode.trim()) {
        setErrorMsg('Please enter the Administrator Security Key.');
        return;
      }
    }

    setLoading(true);

    try {
      if (isRegister) {
        const payload: any = {
          email: cleanEmail,
          password,
          role,
          full_name: fullName.trim(),
          phone: phone.trim() || undefined
        };
        if (role === 'doctor') {
          payload.specialty = specialty;
          payload.qualifications = qualifications.trim() || 'MD';
          payload.experience_years = Number(experienceYears);
          payload.fee = Number(fee);
        } else if (role === 'admin') {
          payload.admin_code = adminCode.trim();
        }
        const res = await api.register(payload);
        login(res.access_token, res.user);
      } else {
        const res = await api.login({
          email: cleanEmail,
          password
        });
        login(res.access_token, res.user);
      }
    } catch (err: any) {
      const msg = typeof err?.message === 'string' ? err.message : JSON.stringify(err?.message || err);
      setErrorMsg(msg || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string) => {
    setQuickLoginLoading(demoEmail);
    setErrorMsg(null);
    try {
      await quickLogin(demoEmail);
    } catch (err: any) {
      setErrorMsg(`Demo login failed: ${err.message}`);
    } finally {
      setQuickLoginLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Subtle Ambient Background Gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-teal-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Brand & System Heading */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <div className="w-14 h-14 rounded-2xl bg-teal-600 border border-teal-400/30 flex items-center justify-center text-white mx-auto shadow-xl shadow-teal-900/40 mb-3">
          <Activity className="w-7 h-7" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          ChronicCare <span className="text-teal-400">Health</span>
        </h1>
        <p className="mt-1 text-xs text-slate-400 font-medium tracking-wide">
          Enterprise Clinical Portal & Remote Patient Monitoring System
        </p>

        {/* Enterprise Compliance Trust Badges */}
        <div className="flex items-center justify-center gap-4 mt-3 text-[11px] font-semibold text-slate-400">
          <span className="flex items-center gap-1 text-teal-400">
            <ShieldCheck className="w-3.5 h-3.5" /> HIPAA Compliant
          </span>
          <span>•</span>
          <span className="flex items-center gap-1 text-slate-300">
            <Lock className="w-3.5 h-3.5 text-slate-400" /> 256-Bit SSL
          </span>
          <span>•</span>
          <span className="text-slate-300">SOC-2 Type II</span>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-slate-800/95 backdrop-blur-md py-7 px-6 sm:px-8 shadow-2xl rounded-2xl border border-slate-700/80">
          {/* Sign In vs Register Tabs */}
          <div className="flex rounded-xl bg-slate-900 p-1 mb-5 border border-slate-700/50">
            <button
              type="button"
              onClick={() => { setIsRegister(false); setErrorMsg(null); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                !isRegister ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsRegister(true); setErrorMsg(null); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                isRegister ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {isRegister && (
              <>
                {/* Role Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Select Account Role</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRole('patient')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                        role === 'patient'
                          ? 'border-teal-500 bg-teal-500/15 text-teal-300 shadow-xs'
                          : 'border-slate-700 text-slate-400 hover:bg-slate-700/50'
                      }`}
                    >
                      <User className="w-4 h-4" />
                      <span>Patient</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('doctor')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                        role === 'doctor'
                          ? 'border-teal-500 bg-teal-500/15 text-teal-300 shadow-xs'
                          : 'border-slate-700 text-slate-400 hover:bg-slate-700/50'
                      }`}
                    >
                      <Stethoscope className="w-4 h-4" />
                      <span>Physician</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Full Legal Name</label>
                  <input
                    type="text"
                    required
                    placeholder="First and last legal name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-500 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number (Optional)</label>
                  <input
                    type="tel"
                    placeholder="Direct telephone or mobile"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-500 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>

                {role === 'doctor' && (
                  <div className="space-y-3 p-3 bg-slate-900/70 rounded-xl border border-slate-700">
                    <p className="text-[11px] font-bold text-teal-400 uppercase tracking-wider">Clinician Profile Information</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">Specialty</label>
                        <select
                          value={specialty}
                          onChange={(e) => setSpecialty(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                        >
                          <option value="Cardiology">Cardiology</option>
                          <option value="Endocrinology">Endocrinology</option>
                          <option value="Nephrology">Nephrology</option>
                          <option value="General Internal Medicine">General Internal Medicine</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">Credentials / Degrees</label>
                        <input
                          type="text"
                          placeholder="e.g. MD, MBBS, FACC"
                          value={qualifications}
                          onChange={(e) => setQualifications(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">Practice Years</label>
                        <input
                          type="number"
                          min={1}
                          max={60}
                          value={experienceYears}
                          onChange={(e) => setExperienceYears(parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">Consultation Fee ($)</label>
                        <input
                          type="number"
                          min={0}
                          value={fee}
                          onChange={(e) => setFee(parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Optional Admin Registration */}
                <div className="pt-1">
                  {role !== 'admin' ? (
                    <button
                      type="button"
                      onClick={() => setRole('admin')}
                      className="text-[11px] text-slate-400 hover:text-slate-300 font-medium underline block text-center w-full"
                    >
                      Administrative Staff Registration
                    </button>
                  ) : (
                    <div className="p-3 bg-purple-950/40 rounded-xl border border-purple-800/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-purple-300 flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5" /> Administrative Gate
                        </span>
                        <button
                          type="button"
                          onClick={() => setRole('patient')}
                          className="text-[10px] text-slate-400 hover:text-slate-300"
                        >
                          ✕ Cancel
                        </button>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-purple-200 mb-1">
                          Staff Security Access Key
                        </label>
                        <input
                          type="password"
                          required
                          placeholder="Enter authorization key"
                          value={adminCode}
                          onChange={(e) => setAdminCode(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-purple-700 text-white text-xs placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
              <input
                type="email"
                required
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-500 focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-300">Password</label>
                {isRegister && <span className="text-[10px] text-teal-400 font-medium">Min. 4 characters</span>}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-500 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-lg shadow-teal-900/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating...' : isRegister ? 'Complete Registration' : 'Sign In to Portal'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick One-Click Clinical Verification Accounts */}
          <div className="mt-6 pt-5 border-t border-slate-700/70">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <KeyRound className="w-3 h-3 text-teal-400" /> Instant Access Accounts
              </span>
              <span className="text-[10px] text-slate-500">1-Click Sign In</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-left">
              <button
                type="button"
                onClick={() => handleDemoLogin('dr.jenkins@chroniccare.ai')}
                disabled={!!quickLoginLoading}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-700/60 border border-slate-700 text-left transition-colors"
              >
                <div className="text-[11px] font-bold text-teal-300 truncate">Dr. Sarah Jenkins</div>
                <div className="text-[10px] text-slate-400">Cardiologist (Physician)</div>
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin('alice.johnson@chroniccare.ai')}
                disabled={!!quickLoginLoading}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-700/60 border border-slate-700 text-left transition-colors"
              >
                <div className="text-[11px] font-bold text-teal-300 truncate">Alice Johnson</div>
                <div className="text-[10px] text-slate-400">Cardiology Patient</div>
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin('dr.patel@chroniccare.ai')}
                disabled={!!quickLoginLoading}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-700/60 border border-slate-700 text-left transition-colors"
              >
                <div className="text-[11px] font-bold text-teal-300 truncate">Dr. Robert Patel</div>
                <div className="text-[10px] text-slate-400">Endocrinologist (Physician)</div>
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin('admin@chroniccare.ai')}
                disabled={!!quickLoginLoading}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-700/60 border border-slate-700 text-left transition-colors"
              >
                <div className="text-[11px] font-bold text-purple-300 truncate">Clinical Admin</div>
                <div className="text-[10px] text-slate-400">Security & Analytics</div>
              </button>
            </div>
            {quickLoginLoading && (
              <p className="text-[11px] text-teal-400 text-center mt-2 animate-pulse">
                Signing in as {quickLoginLoading}...
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
