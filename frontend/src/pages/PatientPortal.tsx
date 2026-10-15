import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  Activity, Heart, Stethoscope, FileText, Upload,
  CheckCircle2, Clock, Sparkles, AlertTriangle, Send,
  MessageSquare, Filter, ArrowUpRight, Info, Eye
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ReferenceLine, ReferenceArea, AreaChart, Area
} from 'recharts';
import { TriageBadge } from '../components/TriageBadge';
import { EmergencyBanner } from '../components/EmergencyBanner';

export const PatientPortal: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  // Dashboard Data
  const [dashboard, setDashboard] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);

  // Modals & form state
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [newMessageText, setNewMessageText] = useState('');

  // Daily Check-In Form State
  const [checkInForm, setCheckInForm] = useState({
    disease_module: 'heart_disease',
    medication_taken: 'Yes',
    medication_details: '',
    reason_missed: '',
    systolic_bp: 130,
    diastolic_bp: 82,
    resting_hr: 72,
    blood_glucose: 120,
    post_meal_glucose: 150,
    hba1c: 6.8,
    serum_creatinine: 1.5,
    egfr: 48,
    symptoms: [] as string[],
    symptom_severity: 'None',
    usual_condition_comparison: 'Same',
    patient_notes: ''
  });

  const [triageFeedback, setTriageFeedback] = useState<any>(null);

  // Consultation Request Form
  const [requestForm, setRequestForm] = useState({
    doctor_id: 0,
    primary_disease: 'heart_disease',
    consultation_reason: '',
    introductory_message: ''
  });

  // Doctor Filters
  const [doctorSpecialtyFilter, setDoctorSpecialtyFilter] = useState('all');

  const fetchData = async () => {
    try {
      const [dash, reps, docs, reqs, docsList] = await Promise.all([
        api.getPatientDashboard(),
        api.getMyReports({ days: 30 }),
        api.getDoctors(),
        api.getPatientRequests(),
        api.getMyDocuments()
      ]);
      setDashboard(dash);
      setReports(reps);
      setDoctors(docs);
      setRequests(reqs);
      setDocuments(docsList);

      // Set initial disease module in checkin from dashboard
      if (dash.primary_disease && dash.primary_disease !== 'none') {
        setCheckInForm(prev => ({ ...prev, disease_module: dash.primary_disease }));
        setRequestForm(prev => ({ ...prev, primary_disease: dash.primary_disease }));
      }

      // If active doctor request exists, fetch messages
      if (dash.assigned_doctor?.request_id) {
        const msgs = await api.getMessages(dash.assigned_doctor.request_id);
        setMessages(msgs);
      }
    } catch (err) {
      console.error('Error fetching patient dashboard data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Poll messages every 5s if on consultation tab
  useEffect(() => {
    if (activeTab === 'consultation' && dashboard?.assigned_doctor?.request_id) {
      const interval = setInterval(async () => {
        try {
          const msgs = await api.getMessages(dashboard.assigned_doctor.request_id);
          setMessages(msgs);
        } catch {
          // ignore
        }
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab, dashboard]);

  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const measurements: any = {};
      if (checkInForm.disease_module === 'heart_disease') {
        measurements.systolic_bp = Number(checkInForm.systolic_bp);
        measurements.diastolic_bp = Number(checkInForm.diastolic_bp);
        measurements.resting_hr = Number(checkInForm.resting_hr);
      } else if (checkInForm.disease_module === 'diabetes') {
        measurements.blood_glucose = Number(checkInForm.blood_glucose);
        if (checkInForm.post_meal_glucose) measurements.post_meal_glucose = Number(checkInForm.post_meal_glucose);
      } else if (checkInForm.disease_module === 'ckd') {
        measurements.serum_creatinine = Number(checkInForm.serum_creatinine);
        measurements.egfr = Number(checkInForm.egfr);
        measurements.systolic_bp = Number(checkInForm.systolic_bp);
      }

      const res = await api.submitDailyReport({
        disease_module: checkInForm.disease_module,
        medication_taken: checkInForm.medication_taken,
        medication_details: checkInForm.medication_details,
        reason_missed: checkInForm.reason_missed,
        measurements,
        symptoms: checkInForm.symptoms,
        symptom_severity: checkInForm.symptom_severity,
        usual_condition_comparison: checkInForm.usual_condition_comparison,
        patient_notes: checkInForm.patient_notes
      });

      setTriageFeedback(res);
      setShowCheckInModal(false);
      await fetchData();
    } catch (err: any) {
      alert(`Submission failed: ${err.message}`);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim() || !dashboard?.assigned_doctor?.request_id) return;

    try {
      await api.sendMessage(dashboard.assigned_doctor.request_id, {
        message_text: newMessageText
      });
      setNewMessageText('');
      const updated = await api.getMessages(dashboard.assigned_doctor.request_id);
      setMessages(updated);
    } catch (err: any) {
      alert(`Send failed: ${err.message}`);
    }
  };

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.sendConsultationRequest(requestForm);
      setShowRequestModal(false);
      alert('Consultation request sent! Visible immediately in doctor pending queue.');
      await fetchData();
    } catch (err: any) {
      alert(`Request failed: ${err.message}`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', file.name);
    formData.append('document_type', 'lab_report');

    try {
      await api.uploadDocument(formData);
      alert('Document uploaded and encrypted in Medical Records Vault.');
      const docs = await api.getMyDocuments();
      setDocuments(docs);
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    }
  };

  // Check if latest report is emergency
  const hasEmergency = dashboard?.latest_daily_report?.triage_priority === 'emergency';
  const emergencyReason = dashboard?.latest_daily_report?.triage_reasons?.[0];

  // Prepare chart data from reports (reverse to chronological)
  const chartData = [...reports].reverse().map(r => {
    const d = new Date(r.created_at);
    return {
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      systolic_bp: r.measurements?.systolic_bp,
      diastolic_bp: r.measurements?.diastolic_bp,
      resting_hr: r.measurements?.resting_hr,
      blood_glucose: r.measurements?.blood_glucose,
      post_meal_glucose: r.measurements?.post_meal_glucose,
      serum_creatinine: r.measurements?.serum_creatinine,
      egfr: r.measurements?.egfr,
      priority: r.triage_priority
    };
  });

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Emergency Safety Alert Bar */}
      {hasEmergency && <EmergencyBanner reason={emergencyReason} />}

      {/* Main Tab Navigation */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-2 overflow-x-auto py-2.5 no-scrollbar">
            {[
              { id: 'overview', label: 'Overview', icon: <Activity className="w-4 h-4" /> },
              { id: 'disease_view', label: 'Dedicated Care Module', icon: <Heart className="w-4 h-4" /> },
              { id: 'daily_checkin', label: 'Daily RPM Check-In', icon: <Clock className="w-4 h-4" />, badge: 'Daily' },
              { id: 'ai_assessment', label: 'AI Health Stratification', icon: <Sparkles className="w-4 h-4" /> },
              { id: 'consultation', label: 'Doctor Consultation', icon: <Stethoscope className="w-4 h-4" />, badge: dashboard?.assigned_doctor ? 'Active' : 'Search' },
              { id: 'vault', label: 'Medical Vault', icon: <FileText className="w-4 h-4" />, count: documents.length },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${activeTab === tab.id ? 'bg-white text-teal-800' : 'bg-teal-100 text-teal-800'}`}>
                    {tab.badge}
                  </span>
                )}
                {tab.count !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${activeTab === tab.id ? 'bg-white text-teal-800' : 'bg-slate-200 text-slate-700'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Instant Triage Notification Feedback Banner */}
        {triageFeedback && (
          <div className="mb-6 p-4 rounded-2xl bg-white border border-slate-200 shadow-md flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-xl bg-teal-50 text-teal-700">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  Daily Check-In Recorded Successfully
                  <TriageBadge priority={triageFeedback.triage_priority} />
                </p>
                <div className="mt-1 text-xs text-slate-600">
                  <span className="font-semibold">Clinical Triage Evaluation: </span>
                  {triageFeedback.triage_reasons.join(' • ')}
                </div>
              </div>
            </div>
            <button
              onClick={() => setTriageFeedback(null)}
              className="text-xs text-slate-400 hover:text-slate-600 font-bold px-2 py-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* ----------------- TAB 1: OVERVIEW ----------------- */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Welcome & Disease Badge */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-400/30">
                      {dashboard?.primary_disease ? dashboard.primary_disease.replace('_', ' ') : 'General Care'}
                    </span>
                    <span className="text-xs text-slate-400">• Active Remote Surveillance</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                    Welcome back, {user?.full_name}
                  </h1>
                  <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-xl">
                    Your personal health dashboard tracks longitudinal biomarkers, evaluates clinical risk with AI, and keeps your managing specialist updated daily.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowCheckInModal(true)}
                    className="px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2"
                  >
                    <Clock className="w-4 h-4" />
                    <span>Submit Today's Check-In</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Status Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Assigned Doctor / Pending Request Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Managing Specialist</span>
                  <Stethoscope className="w-4 h-4 text-teal-600" />
                </div>

                <div className="mt-4">
                  {dashboard?.assigned_doctor ? (
                    <div>
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-sm">
                          {dashboard.assigned_doctor.name.replace('Dr. ', '').slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{dashboard.assigned_doctor.name}</p>
                          <p className="text-xs text-teal-600 font-semibold">{dashboard.assigned_doctor.specialty}</p>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-2">
                        {dashboard.assigned_doctor.qualifications}
                      </p>
                      <button
                        onClick={() => setActiveTab('consultation')}
                        className="mt-4 w-full py-2 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Open Consultation Workspace</span>
                      </button>
                    </div>
                  ) : dashboard?.pending_request ? (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="font-bold text-xs">Awaiting Doctor Acceptance</span>
                      </div>
                      <p className="text-xs text-amber-800 mt-1">
                        Request submitted to <strong>{dashboard.pending_request.doctor_name}</strong> ({dashboard.pending_request.specialty}).
                      </p>
                      <p className="text-[11px] text-amber-700/80 mt-1 italic">
                        {dashboard.pending_request.notice}
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-xs text-slate-500">No specialist assigned yet.</p>
                      <button
                        onClick={() => setActiveTab('consultation')}
                        className="mt-2 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold"
                      >
                        Find a Specialist
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Latest RPM Triage Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Latest Monitoring Status</span>
                  <Activity className="w-4 h-4 text-teal-600" />
                </div>

                <div className="mt-4">
                  {dashboard?.latest_daily_report ? (
                    <div>
                      <div className="flex items-center justify-between">
                        <TriageBadge priority={dashboard.latest_daily_report.triage_priority} />
                        <span className="text-[11px] text-slate-400">
                          {new Date(dashboard.latest_daily_report.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="mt-3 space-y-1.5">
                        {dashboard.latest_daily_report.triage_reasons?.map((reason: string, i: number) => (
                          <p key={i} className="text-xs text-slate-700 font-medium flex items-start gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                            <span>{reason}</span>
                          </p>
                        ))}
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span>Medication: <strong className="text-slate-800">{dashboard.latest_daily_report.medication_taken}</strong></span>
                        {dashboard.latest_daily_report.doctor_reviewed ? (
                          <span className="text-emerald-700 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Reviewed by Doctor
                          </span>
                        ) : (
                          <span className="text-slate-400">Pending Physician Review</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-xs text-slate-500">No daily check-in submitted yet.</p>
                      <button
                        onClick={() => setShowCheckInModal(true)}
                        className="mt-2 text-xs font-bold text-teal-600 hover:underline"
                      >
                        Submit First Check-In
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* AI Risk Stratification Summary Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">AI Risk Stratification</span>
                  <Sparkles className="w-4 h-4 text-teal-600" />
                </div>

                <div className="mt-4">
                  {dashboard?.latest_ai_assessment ? (
                    <div>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-2xl font-extrabold text-slate-900">
                            {dashboard.latest_ai_assessment.risk_score}%
                          </span>
                          <span className="text-xs text-slate-500 block">Statistical Probability</span>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                          dashboard.latest_ai_assessment.risk_category === 'critical' ? 'bg-red-100 text-red-800' :
                          dashboard.latest_ai_assessment.risk_category === 'high' ? 'bg-amber-100 text-amber-800' :
                          dashboard.latest_ai_assessment.risk_category === 'moderate' ? 'bg-blue-100 text-blue-800' :
                          'bg-emerald-100 text-emerald-800'
                        }`}>
                          {dashboard.latest_ai_assessment.risk_category} Risk
                        </span>
                      </div>

                      <div className="mt-3">
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-2 rounded-full ${
                              dashboard.latest_ai_assessment.risk_score > 70 ? 'bg-red-500' :
                              dashboard.latest_ai_assessment.risk_score > 40 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${dashboard.latest_ai_assessment.risk_score}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Model: {dashboard.latest_ai_assessment.model_version} • Confidence: {dashboard.latest_ai_assessment.confidence_score}%
                        </p>
                      </div>

                      <button
                        onClick={() => setActiveTab('ai_assessment')}
                        className="mt-3 w-full py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition-colors"
                      >
                        View Clinical Recommendations
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 py-4 text-center">Calculating baseline risk...</p>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Chart Preview */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Longitudinal Clinical Trends</h3>
                  <p className="text-xs text-slate-500">Biometric variations over the last 30 daily submissions</p>
                </div>
                <button
                  onClick={() => setActiveTab('disease_view')}
                  className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1"
                >
                  <span>Detailed Disease Interface</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {chartData.length > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorSys" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#0d9488" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} />
                      <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px' }} />
                      {dashboard?.primary_disease === 'diabetes' ? (
                        <Area type="monotone" dataKey="blood_glucose" name="Glucose (mg/dL)" stroke="#0d9488" strokeWidth={2} fillOpacity={1} fill="url(#colorSys)" />
                      ) : dashboard?.primary_disease === 'ckd' ? (
                        <Area type="monotone" dataKey="serum_creatinine" name="Creatinine (mg/dL)" stroke="#0d9488" strokeWidth={2} fillOpacity={1} fill="url(#colorSys)" />
                      ) : (
                        <Area type="monotone" dataKey="systolic_bp" name="Systolic BP (mmHg)" stroke="#0d9488" strokeWidth={2} fillOpacity={1} fill="url(#colorSys)" />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-xs text-slate-400">
                  Submit daily reports to generate longitudinal trend curves.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ----------------- TAB 2: DEDICATED DISEASE CARE MODULES ----------------- */}
        {activeTab === 'disease_view' && (
          <div className="space-y-6">
            {/* Header with disease selector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Heart className="w-5 h-5 text-teal-600" />
                  {dashboard?.primary_disease === 'diabetes' && 'Diabetes Mellitus Care Management'}
                  {dashboard?.primary_disease === 'heart_disease' && 'Hypertension & Cardiovascular Surveillance'}
                  {dashboard?.primary_disease === 'ckd' && 'Chronic Kidney Disease (CKD) Renal Trajectory'}
                  {!['diabetes', 'heart_disease', 'ckd'].includes(dashboard?.primary_disease) && 'Cardiovascular & General Chronic Module'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Clinical parameters, evidence-based target bands, and longitudinal graphs with strict schema isolation.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCheckInModal(true)}
                  className="px-4 py-2 rounded-lg bg-teal-600 text-white font-bold text-xs hover:bg-teal-700"
                >
                  + Log Measurement
                </button>
              </div>
            </div>

            {/* DISEASE VIEW 1: HEART DISEASE */}
            {(dashboard?.primary_disease === 'heart_disease' || !['diabetes', 'ckd'].includes(dashboard?.primary_disease)) && (
              <div className="space-y-6">
                {/* Blood Pressure dual-trend graph */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">Ambulatory Blood Pressure Tracking (mmHg)</h3>
                      <p className="text-xs text-slate-500">ACC/AHA clinical threshold bands: Normal (&lt;120/80), Stage 1 (130-139), Stage 2 (&ge;140/90), Crisis (&ge;180/120)</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-semibold">
                      <span className="flex items-center gap-1.5 text-teal-700">
                        <span className="w-3 h-0.5 bg-teal-600 inline-block"></span> Systolic BP
                      </span>
                      <span className="flex items-center gap-1.5 text-blue-600">
                        <span className="w-3 h-0.5 bg-blue-500 inline-block"></span> Diastolic BP
                      </span>
                    </div>
                  </div>

                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                        <YAxis stroke="#94a3b8" fontSize={11} domain={[50, 200]} />
                        <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px' }} />
                        {/* Reference lines for clinical thresholds */}
                        <ReferenceLine y={180} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Hypertensive Crisis (180)', fill: '#ef4444', fontSize: 10 }} />
                        <ReferenceLine y={140} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Stage 2 HTN (140)', fill: '#f59e0b', fontSize: 10 }} />
                        <ReferenceLine y={120} stroke="#10b981" strokeDasharray="4 4" label={{ value: 'Normal Target (120)', fill: '#10b981', fontSize: 10 }} />
                        
                        <Line type="monotone" dataKey="systolic_bp" stroke="#0d9488" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        <Line type="monotone" dataKey="diastolic_bp" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Resting Heart Rate Graph */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <h3 className="font-bold text-slate-900 text-sm mb-1">Resting Heart Rate Timeline (bpm)</h3>
                  <p className="text-xs text-slate-500 mb-4">Target resting rhythm: 60–100 bpm</p>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                        <YAxis stroke="#94a3b8" fontSize={11} domain={[40, 140]} />
                        <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px' }} />
                        <ReferenceLine y={100} stroke="#f59e0b" strokeDasharray="3 3" />
                        <ReferenceLine y={60} stroke="#10b981" strokeDasharray="3 3" />
                        <Line type="monotone" dataKey="resting_hr" stroke="#ec4899" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* DISEASE VIEW 2: DIABETES MELLITUS */}
            {dashboard?.primary_disease === 'diabetes' && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">Fasting vs. Post-Meal Blood Glucose (mg/dL)</h3>
                      <p className="text-xs text-slate-500">Green shaded band indicates ADA recommended clinical target range (70–180 mg/dL)</p>
                    </div>
                  </div>

                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                        <YAxis stroke="#94a3b8" fontSize={11} domain={[40, 350]} />
                        <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px' }} />
                        
                        {/* Shaded ADA Target Range 70 - 180 */}
                        <ReferenceArea y1={70} y2={180} fill="#d1fae5" fillOpacity={0.4} />
                        <ReferenceLine y={250} stroke="#f97316" strokeDasharray="3 3" label={{ value: 'Severe Hyperglycemia (250)', fill: '#ea580c', fontSize: 10 }} />
                        <ReferenceLine y={54} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Severe Hypoglycemia (54)', fill: '#dc2626', fontSize: 10 }} />
                        
                        <Line type="monotone" dataKey="blood_glucose" name="Fasting Glucose" stroke="#0d9488" strokeWidth={2.5} dot={{ r: 4 }} />
                        <Line type="monotone" dataKey="post_meal_glucose" name="Post-Meal Glucose" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-2xl border border-slate-200 p-5">
                    <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">Glycemic Target Compliance</h4>
                    <p className="text-2xl font-extrabold text-teal-700">76% Time In Range</p>
                    <p className="text-xs text-slate-500 mt-1">Measurements logged within 70–180 mg/dL over the past 30 days.</p>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-200 p-5">
                    <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">Latest HbA1c Lab Benchmark</h4>
                    <p className="text-2xl font-extrabold text-slate-900">7.4%</p>
                    <p className="text-xs text-slate-500 mt-1">Endocrinology target: &lt;7.0% for reduced microvascular risk.</p>
                  </div>
                </div>
              </div>
            )}

            {/* DISEASE VIEW 3: CHRONIC KIDNEY DISEASE (CKD) */}
            {dashboard?.primary_disease === 'ckd' && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">Longitudinal eGFR & Serum Creatinine Trajectory</h3>
                      <p className="text-xs text-slate-500">KDIGO clinical monitoring: tracking renal filtration capacity & acute elevation deviations</p>
                    </div>
                  </div>

                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                        <YAxis stroke="#94a3b8" fontSize={11} />
                        <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px' }} />
                        <ReferenceLine y={15} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Stage 5 Kidney Failure (<15)', fill: '#ef4444', fontSize: 10 }} />
                        <ReferenceLine y={30} stroke="#f97316" strokeDasharray="3 3" label={{ value: 'Stage 4 CKD (30)', fill: '#f97316', fontSize: 10 }} />
                        <ReferenceLine y={60} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Mild CKD (60)', fill: '#10b981', fontSize: 10 }} />
                        
                        <Line type="monotone" dataKey="egfr" name="eGFR (mL/min/1.73m²)" stroke="#0d9488" strokeWidth={2.5} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Nephrotoxicity Alert Box */}
                <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex items-start gap-4">
                  <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-sm">Nephroprotection Protocol Notice</p>
                    <p>
                      Avoid Over-the-Counter Non-Steroidal Anti-Inflammatory Drugs (NSAIDs) such as <strong>Ibuprofen, Naproxen, and Meloxicam</strong>, which cause acute tubular vasoconstriction and accelerate renal decline.
                    </p>
                    <p className="font-semibold text-amber-800 pt-1">
                      Always consult Dr. Rostova before taking any new over-the-counter painkiller or herbal supplement.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ----------------- TAB 3: DAILY RPM CHECK-IN ----------------- */}
        {activeTab === 'daily_checkin' && (
          <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
            <div className="border-b border-slate-100 pb-4 mb-6">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
                Remote Patient Monitoring Form
              </span>
              <h2 className="text-xl font-bold text-slate-900 mt-2">Daily Clinical Health Submission</h2>
              <p className="text-xs text-slate-500 mt-1">
                Your report is immediately evaluated by our 5-tier clinician-approved triage engine. Urgent anomalies are instantly routed to your doctor's priority queue.
              </p>
            </div>

            <form onSubmit={handleCheckInSubmit} className="space-y-6">
              {/* Disease module selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Disease Care Context</label>
                <select
                  value={checkInForm.disease_module}
                  onChange={(e) => setCheckInForm({ ...checkInForm, disease_module: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-medium"
                >
                  <option value="heart_disease">Heart Disease & Hypertension</option>
                  <option value="diabetes">Diabetes Mellitus</option>
                  <option value="ckd">Chronic Kidney Disease (CKD)</option>
                  <option value="multiple">Multiple Conditions</option>
                </select>
              </div>

              {/* Medication adherence */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <label className="block text-xs font-bold text-slate-700">
                  Prescribed Medication Adherence <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['Yes', 'Partially', 'No', 'Unsure'].map((opt) => (
                    <button
                      type="button"
                      key={opt}
                      onClick={() => setCheckInForm({ ...checkInForm, medication_taken: opt as any })}
                      className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                        checkInForm.medication_taken === opt
                          ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {opt === 'Yes' && '✓ Taken as Prescribed'}
                      {opt === 'Partially' && 'Partially Taken'}
                      {opt === 'No' && '✕ Missed Dose'}
                      {opt === 'Unsure' && 'Unsure'}
                    </button>
                  ))}
                </div>

                {checkInForm.medication_taken === 'No' && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Reason for missed dose:</label>
                    <input
                      type="text"
                      placeholder="e.g. Side effects, ran out of pills, forgot during travel"
                      value={checkInForm.reason_missed}
                      onChange={(e) => setCheckInForm({ ...checkInForm, reason_missed: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                    />
                  </div>
                )}
              </div>

              {/* Disease-Specific Vitals */}
              {checkInForm.disease_module in ['heart_disease', 'multiple'] && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-700 border-b border-slate-100 pb-1">Cardiovascular Vitals</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Systolic BP (mmHg)</label>
                      <input
                        type="number"
                        value={checkInForm.systolic_bp}
                        onChange={(e) => setCheckInForm({ ...checkInForm, systolic_bp: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-semibold"
                      />
                      <span className="text-[10px] text-slate-400">Emergency &ge;180 mmHg</span>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Diastolic BP (mmHg)</label>
                      <input
                        type="number"
                        value={checkInForm.diastolic_bp}
                        onChange={(e) => setCheckInForm({ ...checkInForm, diastolic_bp: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-semibold"
                      />
                      <span className="text-[10px] text-slate-400">Emergency &ge;120 mmHg</span>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Resting Heart Rate (bpm)</label>
                      <input
                        type="number"
                        value={checkInForm.resting_hr}
                        onChange={(e) => setCheckInForm({ ...checkInForm, resting_hr: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-semibold"
                      />
                      <span className="text-[10px] text-slate-400">Target: 60-100 bpm</span>
                    </div>
                  </div>
                </div>
              )}

              {checkInForm.disease_module in ['diabetes', 'multiple'] && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-700 border-b border-slate-100 pb-1">Glycemic Biomarkers</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Blood Glucose (mg/dL)</label>
                      <input
                        type="number"
                        value={checkInForm.blood_glucose}
                        onChange={(e) => setCheckInForm({ ...checkInForm, blood_glucose: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-semibold"
                      />
                      <span className="text-[10px] text-slate-400">&le;54 Hypo / &ge;400 DKA Alert</span>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Post-Meal Glucose (optional)</label>
                      <input
                        type="number"
                        value={checkInForm.post_meal_glucose}
                        onChange={(e) => setCheckInForm({ ...checkInForm, post_meal_glucose: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              {checkInForm.disease_module in ['ckd', 'multiple'] && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-700 border-b border-slate-100 pb-1">Renal Biomarkers</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Serum Creatinine (mg/dL)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={checkInForm.serum_creatinine}
                        onChange={(e) => setCheckInForm({ ...checkInForm, serum_creatinine: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">eGFR (mL/min/1.73m²)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={checkInForm.egfr}
                        onChange={(e) => setCheckInForm({ ...checkInForm, egfr: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-semibold"
                      />
                      <span className="text-[10px] text-slate-400">&lt;15 Stage 5 Failure Alert</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Symptoms and Severity */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Today's Symptoms</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      'Chest pain', 'Chest pressure', 'Shortness of breath', 'Sudden breathlessness',
                      'Dizziness', 'Palpitations', 'Leg swelling', 'Confusion',
                      'Fruity breath odor', 'Frequent thirst', 'Blurry vision', 'Extreme fatigue'
                    ].map((s) => (
                      <label
                        key={s}
                        className={`flex items-center space-x-2 p-2 rounded-lg border text-xs cursor-pointer ${
                          checkInForm.symptoms.includes(s)
                            ? 'bg-teal-50 border-teal-500 font-bold text-teal-900'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checkInForm.symptoms.includes(s)}
                          onChange={() => {
                            if (checkInForm.symptoms.includes(s)) {
                              setCheckInForm({ ...checkInForm, symptoms: checkInForm.symptoms.filter(x => x !== s) });
                            } else {
                              setCheckInForm({ ...checkInForm, symptoms: [...checkInForm.symptoms, s] });
                            }
                          }}
                          className="rounded text-teal-600 focus:ring-teal-500"
                        />
                        <span>{s}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Symptom Severity</label>
                    <select
                      value={checkInForm.symptom_severity}
                      onChange={(e) => setCheckInForm({ ...checkInForm, symptom_severity: e.target.value as any })}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
                    >
                      <option value="None">None (Feeling fine)</option>
                      <option value="Mild">Mild (Noticeable but stable)</option>
                      <option value="Moderate">Moderate (Impacting daily tasks)</option>
                      <option value="Severe">Severe (Urgent physician review)</option>
                      <option value="Critical">Critical (Immediate emergency care)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Comparison with Usual Baseline</label>
                    <select
                      value={checkInForm.usual_condition_comparison}
                      onChange={(e) => setCheckInForm({ ...checkInForm, usual_condition_comparison: e.target.value as any })}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
                    >
                      <option value="Better">Better than usual</option>
                      <option value="Same">Same as usual</option>
                      <option value="Worse">Worse than usual</option>
                      <option value="Much worse">Much worse than usual</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Notes for Doctor (optional)</label>
                  <textarea
                    rows={2}
                    placeholder="Describe how you are feeling, any physical stressors, or dietary variations today..."
                    value={checkInForm.patient_notes}
                    onChange={(e) => setCheckInForm({ ...checkInForm, patient_notes: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Submit & Run Multi-Factor Triage Engine</span>
              </button>
            </form>
          </div>
        )}

        {/* ----------------- TAB 4: AI HEALTH ASSESSMENT ----------------- */}
        {activeTab === 'ai_assessment' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-teal-900 to-slate-900 text-white p-6 sm:p-8 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-500/20 text-teal-300 border border-teal-400/30 mb-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  Calibrated Clinical Risk Engine
                </span>
                <h2 className="text-2xl font-extrabold tracking-tight">AI Chronic Risk Stratification</h2>
                <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-xl">
                  Statistical estimations derived from peer-reviewed cardiology (ACC/AHA), endocrinology (ADA FINDRISC), and nephrology (KDIGO) scoring frameworks.
                </p>
              </div>

              <button
                onClick={async () => {
                  try {
                    const res = await api.evaluateRisk({ disease_module: dashboard?.primary_disease || 'heart_disease' });
                    alert(`AI evaluation re-run! Calibrated Risk: ${res.risk_score}% (${res.risk_category.toUpperCase()})`);
                    await fetchData();
                  } catch (err: any) {
                    alert(`Evaluation error: ${err.message}`);
                  }
                }}
                className="px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs sm:text-sm shadow-md transition-all shrink-0"
              >
                Re-Run On-Demand Evaluation
              </button>
            </div>

            {/* AI Caveats Disclaimer Box */}
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
              <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">MANDATORY NON-DIAGNOSTIC CLINICAL GOVERNANCE</p>
                <p className="mt-0.5 text-amber-800 leading-relaxed">
                  {dashboard?.latest_ai_assessment?.clinical_caveats ||
                    'This AI evaluation is a statistical risk estimation derived from reported clinical indicators. It is NOT a confirmed medical diagnosis and does not replace certified laboratory testing or evaluation by a licensed physician.'}
                </p>
              </div>
            </div>

            {dashboard?.latest_ai_assessment && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Score breakdown card */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <h3 className="font-bold text-slate-900 text-sm mb-4">Stratification Metric</h3>
                  <div className="text-center py-4">
                    <span className="text-5xl font-black text-slate-900 tracking-tight">
                      {dashboard.latest_ai_assessment.risk_score}
                      <span className="text-2xl text-teal-600 font-bold">%</span>
                    </span>
                    <span className="block text-xs font-bold uppercase tracking-wider text-slate-500 mt-1">
                      Probability of Progression
                    </span>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Risk Category:</span>
                      <strong className="text-slate-900 uppercase font-bold">{dashboard.latest_ai_assessment.risk_category}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Data Completeness:</span>
                      <strong className="text-teal-700">{dashboard.latest_ai_assessment.confidence_score}% Confidence</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Model Version:</span>
                      <span className="font-mono text-slate-600">{dashboard.latest_ai_assessment.model_version}</span>
                    </div>
                  </div>
                </div>

                {/* Evidence-Based Recommendations */}
                <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <h3 className="font-bold text-slate-900 text-sm mb-3">Clinical & Lifestyle Recommendations</h3>
                  <div className="space-y-2.5">
                    {dashboard.latest_ai_assessment.recommendations?.map((rec: string, i: number) => (
                      <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-2.5 text-xs text-slate-700">
                        <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{rec}</span>
                      </div>
                    ))}
                  </div>

                  {dashboard.latest_ai_assessment.missing_features?.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <p className="text-xs font-semibold text-amber-700 mb-1">Biomarkers not yet provided (Confidence reduced):</p>
                      <div className="flex flex-wrap gap-1.5">
                        {dashboard.latest_ai_assessment.missing_features.map((mf: string, idx: number) => (
                          <span key={idx} className="px-2 py-0.5 rounded text-[10px] bg-amber-50 text-amber-800 border border-amber-200 font-medium">
                            {mf}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ----------------- TAB 5: DOCTOR CONSULTATION ----------------- */}
        {activeTab === 'consultation' && (
          <div className="space-y-6">
            {/* If doctor assigned & accepted: Show 1-to-1 workspace */}
            {dashboard?.assigned_doctor ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[500px]">
                {/* Doctor Sidebar */}
                <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-200 p-6 bg-slate-50/50">
                  <div className="text-center pb-4 border-b border-slate-200">
                    <div className="w-16 h-16 rounded-full bg-teal-100 text-teal-800 font-extrabold text-xl flex items-center justify-center mx-auto mb-3 shadow-inner">
                      {dashboard.assigned_doctor.name.replace('Dr. ', '').slice(0, 2)}
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm">{dashboard.assigned_doctor.name}</h3>
                    <p className="text-xs font-semibold text-teal-700">{dashboard.assigned_doctor.specialty}</p>
                    <span className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Active Care Relationship
                    </span>
                  </div>

                  <div className="py-4 space-y-3 text-xs">
                    <div>
                      <span className="text-slate-400 font-semibold block text-[10px] uppercase">Qualifications</span>
                      <span className="text-slate-700 font-medium">{dashboard.assigned_doctor.qualifications}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block text-[10px] uppercase">Next Scheduled Appointment</span>
                      {dashboard.next_appointment ? (
                        <span className="text-slate-800 font-bold block mt-0.5">
                          {new Date(dashboard.next_appointment.scheduled_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">No appointment scheduled</span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => setShowAppointmentModal(true)}
                    className="w-full py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm transition-all"
                  >
                    Schedule Telehealth Visit
                  </button>
                </div>

                {/* Asynchronous Messaging Thread */}
                <div className="flex-1 flex flex-col justify-between p-6">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">One-to-One Clinical Consultation</h4>
                        <p className="text-xs text-slate-400">Encrypted asynchronous messaging thread with your physician</p>
                      </div>
                    </div>

                    <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                      {messages.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-10">
                          No messages yet. Send a message to Dr. {dashboard.assigned_doctor.name.replace('Dr. ', '')} below.
                        </p>
                      ) : (
                        messages.map((m) => {
                          const isMe = m.sender_id === user?.id;
                          return (
                            <div
                              key={m.id}
                              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                            >
                              <div
                                className={`max-w-md px-4 py-2.5 rounded-2xl text-xs ${
                                  isMe
                                    ? 'bg-teal-600 text-white rounded-br-sm'
                                    : 'bg-slate-100 text-slate-800 rounded-bl-sm border border-slate-200'
                                }`}
                              >
                                <p className="font-semibold text-[10px] opacity-75 mb-0.5">
                                  {m.sender_name} ({m.sender_role})
                                </p>
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

                  {/* Send Input */}
                  <form onSubmit={handleSendMessage} className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Type your message or clinical query..."
                      value={newMessageText}
                      onChange={(e) => setNewMessageText(e.target.value)}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send</span>
                    </button>
                  </form>
                </div>
              </div>
            ) : null}

            {/* Specialist Directory (always accessible to find doctors or if not yet assigned) */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Verified Specialist Directory</h3>
                  <p className="text-xs text-slate-500">Board-certified clinicians available for remote monitoring consultation</p>
                </div>

                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={doctorSpecialtyFilter}
                    onChange={(e) => setDoctorSpecialtyFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700"
                  >
                    <option value="all">All Specialties</option>
                    <option value="Cardiology">Cardiology</option>
                    <option value="Endocrinology">Endocrinology</option>
                    <option value="Nephrology">Nephrology</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {doctors
                  .filter(d => doctorSpecialtyFilter === 'all' || d.specialty.toLowerCase().includes(doctorSpecialtyFilter.toLowerCase()))
                  .map((doc) => (
                    <div key={doc.user_id} className="border border-slate-200 rounded-2xl p-5 hover:border-teal-500 transition-all flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm">{doc.full_name}</h4>
                            <p className="text-xs font-semibold text-teal-700">{doc.specialty}</p>
                          </div>
                          {doc.is_verified && (
                            <span className="text-[10px] bg-teal-100 text-teal-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-teal-600" /> Verified
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-600 mt-2 line-clamp-2">{doc.bio}</p>

                        <div className="mt-3 pt-3 border-t border-slate-100 space-y-1 text-xs text-slate-500">
                          <p><strong>Experience:</strong> {doc.experience_years} years</p>
                          <p><strong>Fee:</strong> ${doc.fee} / consultation</p>
                          <p><strong>Mode:</strong> {doc.consultation_mode}</p>
                          <p><strong>Languages:</strong> {doc.languages}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedDoctor(doc);
                          setRequestForm({
                            ...requestForm,
                            doctor_id: doc.user_id,
                            consultation_reason: `Seeking remote management and specialist oversight for ${dashboard?.primary_disease?.replace('_', ' ')}.`,
                            introductory_message: `Hello ${doc.full_name}, I am sharing my clinical history to request ongoing chronic care consultation.`
                          });
                          setShowRequestModal(true);
                        }}
                        className="mt-4 w-full py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition-colors"
                      >
                        Request Consultation
                      </button>
                    </div>
                  ))}
              </div>
            </div>

            {/* Sent Requests Tracker */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="font-bold text-slate-900 text-sm mb-3">Your Sent Consultation Requests</h3>
              {requests.length === 0 ? (
                <p className="text-xs text-slate-400">No requests submitted yet.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {requests.map((r) => (
                    <div key={r.id} className="py-3 flex items-center justify-between flex-wrap gap-2 text-xs">
                      <div>
                        <p className="font-bold text-slate-900">{r.doctor_name} ({r.specialty})</p>
                        <p className="text-slate-500 text-[11px] mt-0.5">{r.consultation_reason}</p>
                        <span className="text-[10px] text-slate-400">Sent: {new Date(r.created_at).toLocaleString()}</span>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                        r.status === 'accepted' ? 'bg-emerald-100 text-emerald-800' :
                        r.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'
                      }`}>
                        {r.status === 'pending' ? 'Awaiting Doctor Acceptance' : r.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ----------------- TAB 6: MEDICAL RECORDS VAULT ----------------- */}
        {activeTab === 'vault' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Encrypted Medical Records Vault</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Secure storage for diagnostic PDFs, laboratory panels, prescriptions, and ECG summaries (Max 15MB).
                </p>
              </div>

              <label className="cursor-pointer px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all">
                <Upload className="w-4 h-4" />
                <span>Upload New Document</span>
                <input type="file" onChange={handleFileUpload} className="hidden" accept=".pdf,.png,.jpg,.jpeg" />
              </label>
            </div>

            {/* Document Listing */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h4 className="font-bold text-slate-900 text-sm mb-4">Uploaded Medical Documents</h4>
              {documents.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">No documents uploaded yet.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {documents.map((doc) => (
                    <div key={doc.id} className="py-3 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <FileText className="w-5 h-5 text-teal-600" />
                        <div>
                          <p className="font-semibold text-xs text-slate-900">{doc.title}</p>
                          <p className="text-[10px] text-slate-400">
                            {doc.document_type} • {(doc.file_size / (1024 * 1024)).toFixed(2)} MB • {new Date(doc.uploaded_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <a
                        href={`/api/monitoring/document/${doc.id}/download`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View / Download</span>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Historical Daily Reports Table */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h4 className="font-bold text-slate-900 text-sm mb-4">Historical Daily Check-In Logs (30 Days)</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5">Date</th>
                      <th className="px-3 py-2.5">Module</th>
                      <th className="px-3 py-2.5">Triage Tier</th>
                      <th className="px-3 py-2.5">Key Biometrics</th>
                      <th className="px-3 py-2.5">Medication</th>
                      <th className="px-3 py-2.5">Doctor Review</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reports.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/50">
                        <td className="px-3 py-3 font-medium text-slate-900">
                          {new Date(r.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-3 capitalize text-slate-600">
                          {r.disease_module.replace('_', ' ')}
                        </td>
                        <td className="px-3 py-3">
                          <TriageBadge priority={r.triage_priority} />
                        </td>
                        <td className="px-3 py-3 text-slate-700">
                          {r.measurements?.systolic_bp && `${r.measurements.systolic_bp}/${r.measurements.diastolic_bp} mmHg`}
                          {r.measurements?.blood_glucose && `${r.measurements.blood_glucose} mg/dL`}
                          {r.measurements?.serum_creatinine && `${r.measurements.serum_creatinine} mg/dL`}
                        </td>
                        <td className="px-3 py-3 font-semibold">
                          <span className={r.medication_taken === 'Yes' ? 'text-emerald-700' : 'text-amber-700'}>
                            {r.medication_taken}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {r.doctor_reviewed ? (
                            <span className="text-emerald-700 font-semibold" title={r.doctor_feedback}>
                              ✓ Reviewed: "{r.doctor_feedback?.slice(0, 30)}..."
                            </span>
                          ) : (
                            <span className="text-slate-400">Pending</span>
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
      </div>

      {/* MODAL: Submit Daily Check-In */}
      {showCheckInModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Quick Daily Check-In</h3>
              <button onClick={() => setShowCheckInModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleCheckInSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Medication Adherence</label>
                <select
                  value={checkInForm.medication_taken}
                  onChange={(e) => setCheckInForm({ ...checkInForm, medication_taken: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
                >
                  <option value="Yes">Yes, taken as prescribed</option>
                  <option value="Partially">Partially taken</option>
                  <option value="No">No (Missed medication)</option>
                  <option value="Unsure">Unsure</option>
                </select>
              </div>

              {dashboard?.primary_disease === 'heart_disease' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Systolic BP (mmHg)</label>
                    <input
                      type="number"
                      value={checkInForm.systolic_bp}
                      onChange={(e) => setCheckInForm({ ...checkInForm, systolic_bp: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Diastolic BP (mmHg)</label>
                    <input
                      type="number"
                      value={checkInForm.diastolic_bp}
                      onChange={(e) => setCheckInForm({ ...checkInForm, diastolic_bp: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold"
                    />
                  </div>
                </div>
              )}

              {dashboard?.primary_disease === 'diabetes' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Blood Glucose (mg/dL)</label>
                  <input
                    type="number"
                    value={checkInForm.blood_glucose}
                    onChange={(e) => setCheckInForm({ ...checkInForm, blood_glucose: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Symptom Severity</label>
                <select
                  value={checkInForm.symptom_severity}
                  onChange={(e) => setCheckInForm({ ...checkInForm, symptom_severity: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                >
                  <option value="None">None</option>
                  <option value="Mild">Mild</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Severe">Severe</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="Optional observation..."
                  value={checkInForm.patient_notes}
                  onChange={(e) => setCheckInForm({ ...checkInForm, patient_notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs"
              >
                Submit Check-In
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Request Consultation */}
      {showRequestModal && selectedDoctor && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl">
            <h3 className="font-bold text-slate-900 text-base">Request Specialist Consultation</h3>
            <p className="text-xs text-slate-500 mt-1">
              To: <strong>{selectedDoctor.full_name}</strong> ({selectedDoctor.specialty})
            </p>

            <form onSubmit={handleSendRequest} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reason for Consultation</label>
                <input
                  type="text"
                  required
                  value={requestForm.consultation_reason}
                  onChange={(e) => setRequestForm({ ...requestForm, consultation_reason: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Introductory Message to Doctor</label>
                <textarea
                  rows={3}
                  required
                  value={requestForm.introductory_message}
                  onChange={(e) => setRequestForm({ ...requestForm, introductory_message: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl text-[11px] text-slate-500 border border-slate-200">
                <strong>Privacy Notice:</strong> The doctor will immediately see your full name, age, condition, and this message. Your medical questionnaire and daily logs will unlock only after they accept.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700"
                >
                  Send Consultation Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Book Appointment */}
      {showAppointmentModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl">
            <h3 className="font-bold text-slate-900 text-base">Schedule Telehealth Appointment</h3>
            <p className="text-xs text-slate-500 mt-1">With {dashboard?.assigned_doctor?.name}</p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const targetTime = new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString();
                  await api.scheduleAppointment({
                    doctor_id: dashboard?.assigned_doctor?.doctor_id,
                    scheduled_time: targetTime,
                    duration_minutes: 30,
                    mode: 'video',
                    notes: 'Quarterly remote health consultation'
                  });
                  alert('Appointment scheduled successfully!');
                  setShowAppointmentModal(false);
                  await fetchData();
                } catch (err: any) {
                  alert(`Appointment booking failed: ${err.message}`);
                }
              }}
              className="mt-4 space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Appointment Mode</label>
                <select className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold">
                  <option value="video">Secure HD Video Visit</option>
                  <option value="in_person">In-Person Clinic Visit</option>
                  <option value="chat">Real-time Clinical Chat</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Preferred Time Window</label>
                <select className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs">
                  <option>Next available: In 2 days at 10:00 AM EST</option>
                  <option>In 3 days at 2:30 PM EST</option>
                  <option>Next Monday at 9:00 AM EST</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAppointmentModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700"
                >
                  Confirm Appointment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
