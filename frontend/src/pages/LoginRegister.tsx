import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Activity, User, Stethoscope, ArrowRight, Shield } from 'lucide-react';

export const LoginRegister: React.FC = () => {
  const { login } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [role, setRole] = useState<'patient' | 'doctor' | 'admin'>('patient');

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [specialty, setSpecialty] = useState('Cardiology');
  const [qualifications, setQualifications] = useState('MD, FACC');
  const [experienceYears, setExperienceYears] = useState(10);
  const [fee, setFee] = useState(100);
  const [adminCode, setAdminCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      if (isRegister) {
        const payload: any = {
          email: email.trim().toLowerCase(),
          password,
          role,
          full_name: fullName.trim(),
          phone: phone.trim() || undefined
        };
        if (role === 'doctor') {
          payload.specialty = specialty;
          payload.qualifications = qualifications;
          payload.experience_years = Number(experienceYears);
          payload.fee = Number(fee);
        } else if (role === 'admin') {
          payload.admin_code = adminCode.trim();
        }
        const res = await api.register(payload);
        login(res.access_token, res.user);
      } else {
        const res = await api.login({
          email: email.trim().toLowerCase(),
          password
        });
        login(res.access_token, res.user);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-600 to-teal-400 flex items-center justify-center text-white mx-auto shadow-xl shadow-teal-500/20 mb-4">
          <Activity className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-black tracking-tight text-white">ChronicCare<span className="text-teal-400"> AI</span></h2>
        <p className="mt-1 text-xs sm:text-sm text-slate-400 font-medium">
          Predictive Chronic Disease Monitoring & Doctor Consultation Platform
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-slate-800/90 backdrop-blur-xl py-8 px-6 sm:px-10 shadow-2xl rounded-3xl border border-slate-700">
          {/* Toggle Tab */}
          <div className="flex rounded-xl bg-slate-900/80 p-1 mb-6 border border-slate-700/50">
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
              Register
            </button>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <>
                {/* Role Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Account Role</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRole('patient')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                        role === 'patient'
                          ? 'border-teal-500 bg-teal-500/10 text-teal-300'
                          : 'border-slate-700 text-slate-400 hover:bg-slate-700/50'
                      }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Patient</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('doctor')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                        role === 'doctor'
                          ? 'border-teal-500 bg-teal-500/10 text-teal-300'
                          : 'border-slate-700 text-slate-400 hover:bg-slate-700/50'
                      }`}
                    >
                      <Stethoscope className="w-3.5 h-3.5" />
                      <span>Doctor</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Full Legal Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Phone Number (Optional)</label>
                  <input
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>

                {role === 'doctor' && (
                  <div className="space-y-3 p-3 bg-slate-900/60 rounded-xl border border-slate-700">
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
                          <option value="General Internal Medicine">General Medicine</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">Qualifications</label>
                        <input
                          type="text"
                          placeholder="MD, FACC"
                          value={qualifications}
                          onChange={(e) => setQualifications(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">Experience (Years)</label>
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

                {/* Hidden Administrator Account Registration Option */}
                <div className="pt-2">
                  {role !== 'admin' ? (
                    <button
                      type="button"
                      onClick={() => setRole('admin')}
                      className="text-[11px] text-slate-500 hover:text-slate-400 font-medium underline block text-center w-full"
                    >
                      Administrator Registration (Requires Security Code)
                    </button>
                  ) : (
                    <div className="p-3 bg-purple-950/40 rounded-xl border border-purple-800/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-purple-300 flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5" /> Administrator Registration
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
                          Administrator Security Access Code
                        </label>
                        <input
                          type="password"
                          required
                          placeholder="Enter administrative security key"
                          value={adminCode}
                          onChange={(e) => setAdminCode(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-purple-700 text-white text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Email Address</label>
              <input
                type="email"
                required
                placeholder="name@chroniccare.ai"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Password</label>
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-3 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm shadow-lg shadow-teal-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating...' : isRegister ? 'Create Account' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
