import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  Users, Clock, CheckCircle2,
  MessageSquare, Send, Eye, ShieldCheck, Flame, Filter, Lock
} from 'lucide-react';
import { TriageBadge } from '../components/TriageBadge';

export const DoctorPortal: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'queue' | 'pending' | 'patients' | 'consultation'>(() => {
    return (sessionStorage.getItem('chroniccare_doctor_tab') as any) || 'queue';
  });

  useEffect(() => {
    sessionStorage.setItem('chroniccare_doctor_tab', activeTab);
  }, [activeTab]);

  // Doctor Data
  const [overview, setOverview] = useState<any>(null);
  const [priorityQueue, setPriorityQueue] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [activePatients, setActivePatients] = useState<any[]>([]);
  const [patientScopeFilter, setPatientScopeFilter] = useState<'all' | 'panel'>('all');

  // Selected Patient Records View (Gated)
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [patientRecords, setPatientRecords] = useState<any | null>(null);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState<string | null>(null);

  // Review Report Modal
  const [reviewModalReport, setReviewModalReport] = useState<any | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState('');

  // Consultation Chat in workspace
  const [selectedChatPatient, setSelectedChatPatient] = useState<any | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');

  // Filter state for Priority Queue
  const [tierFilter, setTierFilter] = useState('all');
  const [unreviewedOnly, setUnreviewedOnly] = useState(false);

  const fetchDoctorData = async () => {
    try {
      const [ov, pq, pr, ap] = await Promise.all([
        api.getDoctorOverview(),
        api.getPriorityQueue({ tier: tierFilter, unreviewed_only: unreviewedOnly, scope: 'all' }),
        api.getPendingRequests(),
        api.getActivePatients({ scope: patientScopeFilter })
      ]);
      setOverview(ov);
      setPriorityQueue(pq);
      setPendingRequests(pr);
      setActivePatients(ap);

      if (ap.length > 0 && !selectedChatPatient) {
        setSelectedChatPatient(ap[0]);
      }
    } catch (err) {
      console.error('Failed to load doctor portal data:', err);
    }
  };

  useEffect(() => {
    fetchDoctorData();
  }, [tierFilter, unreviewedOnly, patientScopeFilter]);


  // Load chat messages when selectedChatPatient changes
  useEffect(() => {
    if (selectedChatPatient?.request_id) {
      api.getMessages(selectedChatPatient.request_id)
        .then(setChatMessages)
        .catch(console.error);
    }
  }, [selectedChatPatient]);

  const handleRequestAction = async (id: number, action: 'accept' | 'decline') => {
    try {
      await api.actOnRequest(id, {
        action,
        doctor_response_notes: action === 'accept'
          ? 'Consultation request accepted. Medical record unlocked and remote monitoring active.'
          : 'Consultation request declined at this time due to clinical panel capacity.'
      });
      alert(`Request has been ${action}ed.`);
      await fetchDoctorData();
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    }
  };

  const handleConnectPatient = async (patientId: number) => {
    try {
      await api.connectPatientToPanel(patientId);
      alert('Patient successfully added to your active clinical panel.');
      await fetchDoctorData();
    } catch (err: any) {
      alert(`Connection failed: ${err.message}`);
    }
  };

  const handleOpenPatientRecords = async (patientId: number) => {
    setSelectedPatientId(patientId);
    setRecordsLoading(true);
    setRecordsError(null);
    try {
      const recs = await api.getPatientRecords(patientId);
      setPatientRecords(recs);
    } catch (err: any) {
      setRecordsError(err.message || 'Access Forbidden: Patient records locked.');
      setPatientRecords(null);
    } finally {
      setRecordsLoading(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewModalReport || !reviewFeedback.trim()) return;

    try {
      await api.reviewDailyReport(reviewModalReport.id, { feedback: reviewFeedback });
      alert('Clinical review and feedback saved! Patient notified immediately.');
      setReviewModalReport(null);
      setReviewFeedback('');
      await fetchDoctorData();
    } catch (err: any) {
      alert(`Review submission failed: ${err.message}`);
    }
  };

  const handleSendDoctorMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedChatPatient?.request_id) return;

    try {
      await api.sendMessage(selectedChatPatient.request_id, { message_text: chatInput });
      setChatInput('');
      const updated = await api.getMessages(selectedChatPatient.request_id);
      setChatMessages(updated);
    } catch (err: any) {
      alert(`Message error: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Doctor Workspace Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-teal-100 text-teal-800 border border-teal-200">
                  Physician Workspace
                </span>
                <span className="text-xs text-slate-500">• License Verified</span>
              </div>
              <h1 className="text-2xl font-black text-slate-900 mt-1">
                {user?.full_name}
              </h1>
              <p className="text-xs text-slate-500">
                Fellowship-Trained Specialist • Real-Time Clinical RPM & Telehealth Triage
              </p>
            </div>

            {/* Quick KPI badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-center">
                <span className="text-xl font-extrabold text-slate-900">{overview?.pending_requests_count ?? 0}</span>
                <span className="block text-[10px] font-bold uppercase text-slate-400">Pending Reqs</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-center">
                <span className="text-xl font-extrabold text-teal-700">{overview?.active_patients_count ?? 0}</span>
                <span className="block text-[10px] font-bold uppercase text-slate-400">Active Patients</span>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-center">
                <span className="text-xl font-extrabold text-red-700 animate-pulse">{overview?.priority_alerts_count ?? 0}</span>
                <span className="block text-[10px] font-bold uppercase text-red-600">Priority Alerts</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-center">
                <span className="text-xl font-extrabold text-slate-900">{overview?.unreviewed_reports_count ?? 0}</span>
                <span className="block text-[10px] font-bold uppercase text-slate-400">Unreviewed Logs</span>
              </div>
            </div>
          </div>

          {/* Sub-Tabs */}
          <div className="flex space-x-2 mt-6 border-t border-slate-100 pt-3">
            {[
              { id: 'queue', label: 'Smart Priority Queue', icon: <Flame className="w-4 h-4 text-red-500" />, badge: priorityQueue.filter(q => q.triage_priority === 'emergency').length || undefined },
              { id: 'pending', label: 'Pending Consultation Requests', icon: <Clock className="w-4 h-4 text-amber-500" />, badge: pendingRequests.length || undefined },
              { id: 'patients', label: 'Active Patients & Gated Records', icon: <Users className="w-4 h-4 text-teal-600" />, badge: activePatients.length || undefined },
              { id: 'consultation', label: 'Telehealth & Messaging', icon: <MessageSquare className="w-4 h-4 text-indigo-600" /> }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  if (tab.id !== 'patients') setSelectedPatientId(null);
                }}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${activeTab === tab.id ? 'bg-red-500 text-white' : 'bg-red-100 text-red-800'}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* ----------------- SUB-TAB 1: SMART PRIORITY QUEUE ----------------- */}
        {activeTab === 'queue' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Flame className="w-5 h-5 text-red-600" />
                  Clinician-Approved 5-Tier Priority Queue
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Deterministically ordered: Emergency &rarr; Urgent &rarr; High Priority &rarr; Routine &rarr; Awaiting Data.
                </p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={tierFilter}
                    onChange={(e) => setTierFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700"
                  >
                    <option value="all">All Tiers</option>
                    <option value="emergency">Emergency Escalation Only</option>
                    <option value="urgent">Urgent Review Only</option>
                    <option value="high">High Priority</option>
                    <option value="routine">Routine</option>
                  </select>
                </div>

                <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={unreviewedOnly}
                    onChange={(e) => setUnreviewedOnly(e.target.checked)}
                    className="rounded text-teal-600"
                  />
                  <span>Unreviewed Only</span>
                </label>
              </div>
            </div>

            {/* Queue Cards */}
            <div className="space-y-4">
              {priorityQueue.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-xs text-slate-400">
                  No patient reports matching current filter criteria.
                </div>
              ) : (
                priorityQueue.map((rep) => {
                  const isEmergency = rep.triage_priority === 'emergency';
                  return (
                    <div
                      key={rep.id}
                      className={`bg-white rounded-2xl border transition-all p-5 shadow-sm ${
                        isEmergency
                          ? 'border-red-400 bg-red-50/20 ring-2 ring-red-400/30 shadow-red-100'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-start space-x-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                            isEmergency ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {rep.patient_name.slice(0, 2).toUpperCase()}
                          </div>

                          <div>
                            <div className="flex items-center space-x-2">
                              <h3 className="font-bold text-slate-900 text-sm">{rep.patient_name}</h3>
                              <TriageBadge priority={rep.triage_priority} />
                              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                {rep.disease_module.replace('_', ' ')}
                              </span>
                            </div>

                            {/* Explainable clinical reasons tags */}
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {rep.triage_reasons?.map((reason: string, rIdx: number) => (
                                <span
                                  key={rIdx}
                                  className={`text-xs px-2.5 py-0.5 rounded-md font-semibold ${
                                    isEmergency ? 'bg-red-100 text-red-900 border border-red-200' :
                                    rep.triage_priority === 'urgent' ? 'bg-orange-100 text-orange-900 border border-orange-200' :
                                    'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {reason}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleOpenPatientRecords(rep.patient_id)}
                            className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Chart</span>
                          </button>

                          <button
                            onClick={() => {
                              setReviewModalReport(rep);
                              setReviewFeedback(rep.doctor_feedback || '');
                            }}
                            className={`px-4 py-2 rounded-xl text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 ${
                              isEmergency ? 'bg-red-600 hover:bg-red-700' : 'bg-teal-600 hover:bg-teal-700'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{rep.doctor_reviewed ? 'Edit Clinical Feedback' : 'Review & Respond'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Biometric Snapshot Footer */}
                      <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-600">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-semibold uppercase">Measurements</span>
                          <span className="font-bold text-slate-900">
                            {rep.measurements?.systolic_bp && `${rep.measurements.systolic_bp}/${rep.measurements.diastolic_bp} mmHg`}
                            {rep.measurements?.blood_glucose && `${rep.measurements.blood_glucose} mg/dL`}
                            {rep.measurements?.serum_creatinine && `${rep.measurements.serum_creatinine} mg/dL (eGFR ${rep.measurements.egfr})`}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-semibold uppercase">Medication</span>
                          <span className={rep.medication_taken === 'Yes' ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                            {rep.medication_taken} {rep.medication_details && `(${rep.medication_details})`}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-semibold uppercase">Symptoms / Severity</span>
                          <span className="font-medium text-slate-800">
                            {rep.symptoms?.length ? rep.symptoms.join(', ') : 'None'} ({rep.symptom_severity})
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-semibold uppercase">Submitted</span>
                          <span className="text-slate-500">
                            {new Date(rep.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>
                      </div>

                      {rep.doctor_reviewed && (
                        <div className="mt-3 p-2.5 rounded-xl bg-teal-50 border border-teal-100 text-xs text-teal-900 flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">Attending Feedback: </span>
                            <span>{rep.doctor_feedback}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ----------------- SUB-TAB 2: PENDING CONSULTATION REQUESTS (IMMEDIATE NAME VISIBILITY) ----------------- */}
        {activeTab === 'pending' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                Incoming Consultation Requests (Immediate Patient Name Visibility)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Pre-Acceptance Privacy Invariant: Patient full name, age, primary condition, and introductory message are visible immediately. Sensitive historical records, uploaded lab PDFs, and daily logs remain locked (403 Forbidden) until you click Accept.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {pendingRequests.length === 0 ? (
                <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 p-12 text-center text-xs text-slate-400">
                  No pending consultation requests.
                </div>
              ) : (
                pendingRequests.map((req) => (
                  <div key={req.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
                    <div>
                      {/* Immediate Name Visibility */}
                      <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                            {req.primary_disease.replace('_', ' ')}
                          </span>
                          <h3 className="text-lg font-black text-slate-900 mt-1">
                            {req.patient_name}
                          </h3>
                          <p className="text-xs text-slate-500">
                            Age: {req.patient_age || 'N/A'} • Sex: {req.patient_sex || 'N/A'} • Submitted: {new Date(req.created_at).toLocaleString()}
                          </p>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300">
                          Pending
                        </span>
                      </div>

                      {/* Reason and Intro Message */}
                      <div className="mt-4 space-y-3 text-xs">
                        <div>
                          <span className="font-bold text-slate-700 block">Consultation Reason:</span>
                          <p className="text-slate-600 mt-0.5">{req.consultation_reason}</p>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                          <span className="font-bold text-slate-800 block text-[11px] mb-1">Introductory Message from Patient:</span>
                          <p className="text-slate-600 italic leading-relaxed">"{req.introductory_message}"</p>
                        </div>

                        {/* Privacy lock warning */}
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 p-2 rounded-lg bg-amber-50/50 border border-amber-100">
                          <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Detailed medical records & daily monitoring logs are locked until accepted.</span>
                        </div>
                      </div>
                    </div>

                    {/* Accept / Decline Action Controls */}
                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleRequestAction(req.id, 'decline')}
                        className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs transition-colors"
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => handleRequestAction(req.id, 'accept')}
                        className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Accept & Unlock Records</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ----------------- SUB-TAB 3: ACTIVE PATIENTS & GATED MEDICAL RECORDS ----------------- */}
        {activeTab === 'patients' && (
          <div className="space-y-6">
            {!selectedPatientId ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Users className="w-5 h-5 text-teal-600" />
                      Clinical Patient Directory & Active Registry
                    </h2>
                    <p className="text-xs text-slate-500">
                      View all registered patients across the clinic pipeline or filter to your direct assigned panel.
                    </p>
                  </div>
                  <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl">
                    <button
                      onClick={() => setPatientScopeFilter('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        patientScopeFilter === 'all'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      All Clinic Patients ({overview?.total_clinic_patients ?? activePatients.length})
                    </button>
                    <button
                      onClick={() => setPatientScopeFilter('panel')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        patientScopeFilter === 'panel'
                          ? 'bg-white text-teal-800 shadow-sm'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      My Assigned Panel ({overview?.active_patients_count ?? 0})
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3">Patient Name</th>
                        <th className="px-4 py-3">Primary Condition</th>
                        <th className="px-4 py-3">Demographics</th>
                        <th className="px-4 py-3">Current Triage Alert</th>
                        <th className="px-4 py-3">AI Risk Score</th>
                        <th className="px-4 py-3">Panel Status</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activePatients.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-slate-400">
                            No patients found under this filter.
                          </td>
                        </tr>
                      ) : (
                        activePatients.map((pat) => (
                          <tr key={pat.patient_id} className="hover:bg-slate-50/70">
                            <td className="px-4 py-3.5">
                              <div className="font-bold text-slate-900">{pat.full_name}</div>
                              <div className="text-[10px] text-slate-400">ID #{pat.patient_id}</div>
                            </td>
                            <td className="px-4 py-3.5 capitalize text-slate-700 font-semibold">
                              {pat.primary_disease ? pat.primary_disease.replace('_', ' ') : 'General Care'}
                            </td>
                            <td className="px-4 py-3.5 text-slate-500">
                              {pat.age ? `${pat.age} yrs` : 'N/A'}, {pat.sex || 'N/A'}
                            </td>
                            <td className="px-4 py-3.5">
                              <TriageBadge priority={pat.current_triage} />
                            </td>
                            <td className="px-4 py-3.5 font-extrabold text-slate-900">
                              {pat.risk_score ? `${pat.risk_score}%` : 'N/A'}
                            </td>
                            <td className="px-4 py-3.5">
                              {pat.is_in_panel ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  Direct Panel
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                                  Clinic Registry
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center space-x-2">
                                {!pat.is_in_panel && (
                                  <button
                                    onClick={() => handleConnectPatient(pat.patient_id)}
                                    className="px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs"
                                  >
                                    + Add to Panel
                                  </button>
                                )}
                                <button
                                  onClick={() => handleOpenPatientRecords(pat.patient_id)}
                                  className="px-3 py-1.5 rounded-lg bg-teal-50 text-teal-800 hover:bg-teal-100 font-bold text-xs"
                                >
                                  View Chart &rarr;
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* GATED AUTHORIZED MEDICAL RECORD VIEW */
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setSelectedPatientId(null)}
                    className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1"
                  >
                    &larr; Back to Active Patient Registry
                  </button>

                  <span className="text-xs font-bold uppercase bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full border border-emerald-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Authorized Care Relationship Verified
                  </span>
                </div>

                {recordsLoading ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-xs text-slate-400">
                    Decrypting and loading authorized patient records...
                  </div>
                ) : recordsError ? (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
                    <Lock className="w-8 h-8 text-red-600 mx-auto mb-2" />
                    <h3 className="font-bold text-red-900 text-base">Access Gated (HTTP 403 Forbidden)</h3>
                    <p className="text-xs text-red-700 mt-1 max-w-md mx-auto">{recordsError}</p>
                  </div>
                ) : patientRecords ? (
                  <div className="space-y-6">
                    {/* Patient Overview Card */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                        <div>
                          <h2 className="text-xl font-black text-slate-900">{patientRecords.patient.full_name}</h2>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {patientRecords.patient.email} • {patientRecords.patient.phone || 'No phone'}
                          </p>
                        </div>
                        <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase bg-teal-100 text-teal-800 border border-teal-300">
                          Primary: {patientRecords.profile.primary_disease?.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-xs">
                        <div>
                          <span className="text-slate-400 font-semibold block text-[10px] uppercase">Age & Sex</span>
                          <span className="font-bold text-slate-800">{patientRecords.profile.age} yrs, {patientRecords.profile.sex}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-semibold block text-[10px] uppercase">Anthropometrics</span>
                          <span className="font-bold text-slate-800">{patientRecords.profile.height_cm} cm / {patientRecords.profile.weight_kg} kg</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-semibold block text-[10px] uppercase">Allergies</span>
                          <span className="font-bold text-red-600">{patientRecords.profile.allergies || 'None'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-semibold block text-[10px] uppercase">Family History</span>
                          <span className="text-slate-700">{patientRecords.profile.family_history || 'None'}</span>
                        </div>
                      </div>

                      {/* Active medications */}
                      <div className="mt-4 pt-3 border-t border-slate-100">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block mb-2">Active Prescribed Medications</span>
                        <div className="flex flex-wrap gap-2">
                          {patientRecords.profile.current_medications?.map((m: any, i: number) => (
                            <span key={i} className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-800">
                              {m.name} ({m.dosage} - {m.frequency})
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Longitudinal Daily Reports Table */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                      <h3 className="font-bold text-slate-900 text-sm mb-4">Patient Monitoring Submissions (RPM Logs)</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                            <tr>
                              <th className="px-3 py-2.5">Date</th>
                              <th className="px-3 py-2.5">Triage Priority</th>
                              <th className="px-3 py-2.5">Measurements</th>
                              <th className="px-3 py-2.5">Adherence</th>
                              <th className="px-3 py-2.5">Symptoms & Severity</th>
                              <th className="px-3 py-2.5">Patient Notes</th>
                              <th className="px-3 py-2.5">Review Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {patientRecords.reports.map((r: any) => (
                              <tr key={r.id}>
                                <td className="px-3 py-3 font-semibold text-slate-900">{new Date(r.created_at).toLocaleDateString()}</td>
                                <td className="px-3 py-3"><TriageBadge priority={r.triage_priority} /></td>
                                <td className="px-3 py-3 font-bold text-slate-800">
                                  {r.measurements?.systolic_bp && `${r.measurements.systolic_bp}/${r.measurements.diastolic_bp} mmHg`}
                                  {r.measurements?.blood_glucose && `${r.measurements.blood_glucose} mg/dL`}
                                  {r.measurements?.serum_creatinine && `${r.measurements.serum_creatinine} mg/dL`}
                                </td>
                                <td className="px-3 py-3 font-semibold">{r.medication_taken}</td>
                                <td className="px-3 py-3">{r.symptoms?.join(', ') || 'None'} ({r.symptom_severity})</td>
                                <td className="px-3 py-3 text-slate-500 italic">{r.patient_notes || '—'}</td>
                                <td className="px-3 py-3">
                                  {r.doctor_reviewed ? (
                                    <span className="text-emerald-700 font-bold">✓ Reviewed</span>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setReviewModalReport(r);
                                        setReviewFeedback('');
                                      }}
                                      className="text-xs text-teal-600 font-bold hover:underline"
                                    >
                                      + Add Review
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Uploaded Documents */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                      <h3 className="font-bold text-slate-900 text-sm mb-3">Authorized Medical Documents</h3>
                      {patientRecords.documents?.length === 0 ? (
                        <p className="text-xs text-slate-400">No external documents uploaded by patient.</p>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {patientRecords.documents.map((doc: any) => (
                            <div key={doc.id} className="py-2.5 flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-800">{doc.title} ({doc.document_type})</span>
                              <a
                                href={`/api/monitoring/document/${doc.id}/download`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                              >
                                View File
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}

        {/* ----------------- SUB-TAB 4: TELEHEALTH & ONE-TO-ONE MESSAGING ----------------- */}
        {activeTab === 'consultation' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[500px]">
            {/* Patient List */}
            <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-200 p-4 bg-slate-50/50">
              <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-3">Assigned Patients</h3>
              <div className="space-y-1">
                {activePatients.map((pat) => (
                  <button
                    key={pat.patient_id}
                    onClick={() => setSelectedChatPatient(pat)}
                    className={`w-full text-left p-3 rounded-xl transition-all ${
                      selectedChatPatient?.patient_id === pat.patient_id
                        ? 'bg-teal-600 text-white font-bold shadow-sm'
                        : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-200'
                    }`}
                  >
                    <p className="text-xs font-bold">{pat.full_name}</p>
                    <p className={`text-[11px] ${selectedChatPatient?.patient_id === pat.patient_id ? 'text-teal-100' : 'text-slate-500'}`}>
                      {pat.primary_disease.replace('_', ' ')}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Workspace */}
            <div className="flex-1 flex flex-col justify-between p-6">
              {selectedChatPatient ? (
                <>
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">Consultation with {selectedChatPatient.full_name}</h4>
                        <p className="text-xs text-slate-400">Asynchronous clinical communications and care coordination</p>
                      </div>
                    </div>

                    <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                      {chatMessages.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-10">No messages in this consultation thread yet.</p>
                      ) : (
                        chatMessages.map((m) => {
                          const isDoctor = m.sender_id === user?.id;
                          return (
                            <div key={m.id} className={`flex flex-col ${isDoctor ? 'items-end' : 'items-start'}`}>
                              <div
                                className={`max-w-md px-4 py-2.5 rounded-2xl text-xs ${
                                  isDoctor
                                    ? 'bg-slate-900 text-white rounded-br-sm'
                                    : 'bg-teal-50 text-teal-950 rounded-bl-sm border border-teal-200'
                                }`}
                              >
                                <p className="font-bold text-[10px] opacity-75 mb-0.5">{m.sender_name} ({m.sender_role})</p>
                                <p className="leading-relaxed">{m.message_text}</p>
                              </div>
                              <span className="text-[10px] text-slate-400 mt-1 px-1">
                                {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <form onSubmit={handleSendDoctorMessage} className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={`Send clinical advice or follow-up note to ${selectedChatPatient.full_name}...`}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send</span>
                    </button>
                  </form>
                </>
              ) : (
                <div className="text-center py-12 text-slate-400 text-xs">
                  Select an active patient to start clinical messaging.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL: Review Daily Report & Send Feedback */}
      {reviewModalReport && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Clinical Review & Response</h3>
              <button onClick={() => setReviewModalReport(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <div className="mt-3 p-3 bg-slate-50 rounded-xl text-xs space-y-1">
              <p><strong>Patient:</strong> {reviewModalReport.patient_name}</p>
              <p><strong>Triage Priority:</strong> <span className="font-bold uppercase text-red-600">{reviewModalReport.triage_priority}</span></p>
              <p><strong>Reasons:</strong> {reviewModalReport.triage_reasons?.join(', ')}</p>
            </div>

            <form onSubmit={handleReviewSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Physician Assessment & Patient-Facing Advice <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Record clinical observations, dosage titration recommendations, lifestyle adjustments, or urgent escalation instructions..."
                  value={reviewFeedback}
                  onChange={(e) => setReviewFeedback(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReviewModalReport(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 shadow-sm"
                >
                  Save Review & Notify Patient
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
