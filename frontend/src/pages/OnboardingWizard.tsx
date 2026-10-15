import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  ClipboardCheck, AlertCircle,
  ChevronRight, ChevronLeft, Check, Lock
} from 'lucide-react';

export const OnboardingWizard: React.FC<{ onCompleted: () => void }> = ({ onCompleted }) => {
  const { user, refreshUser, logout } = useAuth();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSessionExpired, setIsSessionExpired] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    // Q1: Age
    age: 45,
    // Q2: Sex
    sex: 'Male',
    // Q3: Height & Weight
    height_cm: 175,
    weight_kg: 80,
    height_weight_unknown: false,
    // Q4: Chronic disease
    primary_disease: 'heart_disease',
    // Q5: Diagnosis year
    diagnosis_year: '2022',
    // Q6: Medications
    medications: [
      { name: 'Lisinopril', dosage: '10mg', frequency: 'Once daily' }
    ],
    // Q7: Allergies
    allergies: 'No known allergies',
    // Q8: Symptoms
    symptoms: ['Mild fatigue'],
    symptom_duration: '1-3 months',
    // Q9: Family History
    family_history: 'Father had hypertension and coronary artery disease',
    // Q10: Lab vitals date
    vitals_date: 'Within last 30 days',
    // Q11: Smoking
    smoking_status: 'Never',
    // Q12: Preferred specialty & goals
    preferred_specialty: 'Cardiology',
    care_goals: 'Optimize blood pressure control and prevent cardiovascular events',
    
    // Conditional Disease Fields
    // Diabetes
    blood_glucose: 140,
    glucose_context: 'Fasting',
    hba1c: 7.2,
    insulin_regimen: 'Oral medications only',
    hypoglycemia_history: 'None',
    // Heart Disease
    systolic_bp: 138,
    diastolic_bp: 88,
    resting_hr: 74,
    total_cholesterol: 210,
    hdl_cholesterol: 45,
    cardiac_history: 'Essential hypertension diagnosed',
    // CKD
    serum_creatinine: 1.6,
    egfr: 45,
    uacr_protein: '1+',
    ckd_stage: 'Stage 3a',
    nsaid_use: 'None (strictly avoided)',
    
    // Consent
    consent_granted: true,
  });

  // Calculate BMI
  const bmi = (formData.height_cm > 0 && formData.weight_kg > 0 && !formData.height_weight_unknown)
    ? (formData.weight_kg / Math.pow(formData.height_cm / 100, 2)).toFixed(1)
    : null;

  const handleNext = () => {
    if (step === 1 && (!formData.age || formData.age < 1 || formData.age > 125)) {
      setErrorMsg('Please specify a valid clinical age between 1 and 125.');
      return;
    }
    setErrorMsg(null);
    setStep(step + 1);
  };

  const handlePrev = () => {
    setErrorMsg(null);
    setStep(step - 1);
  };

  const addMedication = () => {
    setFormData({
      ...formData,
      medications: [...formData.medications, { name: '', dosage: '', frequency: '' }]
    });
  };

  const removeMedication = (index: number) => {
    setFormData({
      ...formData,
      medications: formData.medications.filter((_, i) => i !== index)
    });
  };

  const updateMedication = (index: number, field: string, val: string) => {
    const updated = [...formData.medications];
    (updated[index] as any)[field] = val;
    setFormData({ ...formData, medications: updated });
  };

  const toggleSymptom = (sym: string) => {
    if (formData.symptoms.includes(sym)) {
      setFormData({ ...formData, symptoms: formData.symptoms.filter(s => s !== sym) });
    } else {
      setFormData({ ...formData, symptoms: [...formData.symptoms, sym] });
    }
  };

  const handleSubmit = async () => {
    if (!formData.consent_granted) {
      setErrorMsg('You must sign and accept informed data-sharing consent to continue.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const payload: any = {
        age: Number(formData.age),
        sex: formData.sex,
        height_cm: formData.height_weight_unknown ? null : Number(formData.height_cm),
        weight_kg: formData.height_weight_unknown ? null : Number(formData.weight_kg),
        primary_disease: formData.primary_disease,
        diagnosis_year: formData.diagnosis_year,
        current_medications: formData.medications.filter(m => m.name.trim().length > 0),
        allergies: formData.allergies,
        current_symptoms: formData.symptoms,
        symptom_duration: formData.symptom_duration,
        family_history: formData.family_history,
        smoking_status: formData.smoking_status,
        preferred_specialty: formData.preferred_specialty,
        consent_granted: true,
        questionnaire_version: 'v1.0'
      };

      if (formData.primary_disease === 'diabetes') {
        payload.blood_glucose = Number(formData.blood_glucose);
        payload.glucose_context = formData.glucose_context;
        payload.hba1c = Number(formData.hba1c);
        payload.insulin_regimen = formData.insulin_regimen;
      } else if (formData.primary_disease === 'heart_disease') {
        payload.systolic_bp = Number(formData.systolic_bp);
        payload.diastolic_bp = Number(formData.diastolic_bp);
        payload.resting_hr = Number(formData.resting_hr);
        payload.total_cholesterol = Number(formData.total_cholesterol);
        payload.hdl_cholesterol = Number(formData.hdl_cholesterol);
      } else if (formData.primary_disease === 'ckd') {
        payload.serum_creatinine = Number(formData.serum_creatinine);
        payload.egfr = Number(formData.egfr);
        payload.uacr_protein = formData.uacr_protein;
        payload.ckd_stage = formData.ckd_stage;
      }

      await api.submitQuestionnaire(payload);
      await refreshUser();
      onCompleted();
    } catch (err: any) {
      const msg = typeof err?.message === 'string' ? err.message : JSON.stringify(err?.message || err);
      if (err.status === 401 || msg.includes('validate credentials') || msg.includes('expired')) {
        setIsSessionExpired(true);
        setErrorMsg('Your session has expired due to a server deployment or timeout. Please click "Sign In Again" below.');
      } else {
        setErrorMsg(msg || 'Submission failed. Please check inputs.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Onboarding Banner */}
      <div className="bg-gradient-to-r from-teal-800 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl mb-8 relative overflow-hidden">
        <div className="relative z-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-500/20 text-teal-300 border border-teal-400/30 mb-3">
            <ClipboardCheck className="w-3.5 h-3.5" />
            Mandatory Clinical Onboarding Protocol (12+ Questions)
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Comprehensive Health Questionnaire
          </h1>
          <p className="text-slate-300 text-sm sm:text-base mt-2 max-w-2xl leading-relaxed">
            Welcome, <span className="text-teal-300 font-semibold">{user?.full_name}</span>. Before specialist consultation and remote monitoring can unlock, complete this clinical baseline questionnaire. Your answers will generate calibrated AI risk assessments and establish your encrypted electronic health record.
          </p>
        </div>
      </div>

      {/* Progress tracker */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
          <span className={step >= 1 ? 'text-teal-700 font-bold' : ''}>1. Demographics & Vitals</span>
          <span className={step >= 2 ? 'text-teal-700 font-bold' : ''}>2. Disease & Medications</span>
          <span className={step >= 3 ? 'text-teal-700 font-bold' : ''}>3. Clinical Biomarkers</span>
          <span className={step >= 4 ? 'text-teal-700 font-bold' : ''}>4. Privacy & Consent</span>
        </div>
        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
          <div
            className="bg-teal-600 h-2 transition-all duration-300 rounded-full"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Validation Notice</p>
              <p className="text-red-700 text-xs mt-0.5">{errorMsg}</p>
            </div>
          </div>
          {isSessionExpired && (
            <button
              onClick={() => logout()}
              type="button"
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shrink-0 transition-colors shadow-sm"
            >
              Sign In Again
            </button>
          )}
        </div>
      )}

      {/* Step Container Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        {/* STEP 1: DEMOGRAPHICS & VITALS */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 text-xs font-extrabold flex items-center justify-center">1</span>
              Demographics & Anthropometrics
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  1. Age (Years) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={125}
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: parseInt(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-teal-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  2. Biological Sex / Clinical Context <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.sex}
                  onChange={(e) => setFormData({ ...formData, sex: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-teal-500 text-sm"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Intersex">Intersex</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to answer">Prefer not to answer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  3. Height (cm)
                </label>
                <input
                  type="number"
                  disabled={formData.height_weight_unknown}
                  value={formData.height_cm}
                  onChange={(e) => setFormData({ ...formData, height_cm: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-teal-500 text-sm disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  disabled={formData.height_weight_unknown}
                  value={formData.weight_kg}
                  onChange={(e) => setFormData({ ...formData, weight_kg: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-teal-500 text-sm disabled:bg-slate-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.height_weight_unknown}
                  onChange={(e) => setFormData({ ...formData, height_weight_unknown: e.target.checked })}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span>Height / Weight not currently known</span>
              </label>
              {bmi && !formData.height_weight_unknown && (
                <div className="text-right">
                  <span className="text-xs text-slate-500">Calculated BMI: </span>
                  <span className="text-xs font-extrabold text-teal-700">{bmi} kg/m²</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                4. Smoking & Tobacco History
              </label>
              <select
                value={formData.smoking_status}
                onChange={(e) => setFormData({ ...formData, smoking_status: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-teal-500"
              >
                <option value="Never">Never smoked</option>
                <option value="Former">Former smoker</option>
                <option value="Current">Current regular tobacco user</option>
                <option value="Prefer not to answer">Prefer not to answer</option>
              </select>
            </div>
          </div>
        )}

        {/* STEP 2: DISEASE & MEDICATIONS */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 text-xs font-extrabold flex items-center justify-center">2</span>
              Chronic Disease Profile & Regimen
            </h2>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                5. Primary Diagnosed Chronic Condition <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: 'heart_disease', title: 'Heart Disease / HTN', desc: 'Cardiovascular, Blood Pressure' },
                  { id: 'diabetes', title: 'Diabetes Mellitus', desc: 'Type 1 or Type 2 Glycemic Care' },
                  { id: 'ckd', title: 'Chronic Kidney Disease', desc: 'Renal Function, eGFR & Creatinine' }
                ].map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setFormData({ ...formData, primary_disease: item.id })}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      formData.primary_disease === item.id
                        ? 'border-teal-600 bg-teal-50/70 ring-2 ring-teal-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <p className={`font-bold text-sm ${formData.primary_disease === item.id ? 'text-teal-900' : 'text-slate-800'}`}>
                      {item.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  6. Year of Clinical Diagnosis
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2021 or 'Not applicable'"
                  value={formData.diagnosis_year}
                  onChange={(e) => setFormData({ ...formData, diagnosis_year: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  7. Known Medication Allergies
                </label>
                <input
                  type="text"
                  placeholder="e.g. Penicillin, Sulfa, or 'No known allergies'"
                  value={formData.allergies}
                  onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700">
                  8. Current Prescribed Medications
                </label>
                <button
                  type="button"
                  onClick={addMedication}
                  className="text-xs font-bold text-teal-600 hover:text-teal-700"
                >
                  + Add Medication
                </button>
              </div>

              <div className="space-y-2">
                {formData.medications.map((med, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Medication name (e.g. Metformin)"
                      value={med.name}
                      onChange={(e) => updateMedication(index, 'name', e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Dosage (e.g. 500mg)"
                      value={med.dosage}
                      onChange={(e) => updateMedication(index, 'dosage', e.target.value)}
                      className="w-28 px-3 py-2 rounded-lg border border-slate-300 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Frequency (e.g. Twice daily)"
                      value={med.frequency}
                      onChange={(e) => updateMedication(index, 'frequency', e.target.value)}
                      className="w-36 px-3 py-2 rounded-lg border border-slate-300 text-xs"
                    />
                    {formData.medications.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMedication(index)}
                        className="text-xs text-red-500 hover:text-red-700 font-bold px-1"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                9. Family Medical History
              </label>
              <textarea
                rows={2}
                placeholder="Mention direct relatives with heart disease, diabetes, hypertension, or kidney disease..."
                value={formData.family_history}
                onChange={(e) => setFormData({ ...formData, family_history: e.target.value })}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-xs"
              />
            </div>
          </div>
        )}

        {/* STEP 3: CONDITIONAL BIOMARKERS */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 text-xs font-extrabold flex items-center justify-center">3</span>
                Disease-Specific Baseline Biomarkers
              </span>
              <span className="text-xs text-teal-700 font-semibold uppercase bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                {formData.primary_disease.replace('_', ' ')}
              </span>
            </h2>

            {formData.primary_disease === 'diabetes' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    10. Latest Blood Glucose (mg/dL)
                  </label>
                  <input
                    type="number"
                    value={formData.blood_glucose}
                    onChange={(e) => setFormData({ ...formData, blood_glucose: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Normal fasting: 70–99 mg/dL | Post-meal: &lt;140 mg/dL</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Glucose Measurement Context
                  </label>
                  <select
                    value={formData.glucose_context}
                    onChange={(e) => setFormData({ ...formData, glucose_context: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                  >
                    <option value="Fasting">Fasting (Morning before meal)</option>
                    <option value="2-Hr Post-Meal">2-Hour Post-Meal</option>
                    <option value="Random">Random / Bedtime</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    11. Latest Laboratory HbA1c (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.hba1c}
                    onChange={(e) => setFormData({ ...formData, hba1c: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Target for most adults: &lt;7.0% per ADA guidelines</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Insulin or Oral Hypoglycemic Regimen
                  </label>
                  <select
                    value={formData.insulin_regimen}
                    onChange={(e) => setFormData({ ...formData, insulin_regimen: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                  >
                    <option value="Oral medications only">Oral medications only</option>
                    <option value="Basal insulin only">Basal insulin (long-acting)</option>
                    <option value="Basal-bolus insulin">Basal-bolus multiple daily injections</option>
                    <option value="Insulin pump">Insulin pump</option>
                    <option value="Diet and lifestyle only">Diet and lifestyle only</option>
                  </select>
                </div>
              </div>
            )}

            {formData.primary_disease === 'heart_disease' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    10. Systolic Blood Pressure (mmHg)
                  </label>
                  <input
                    type="number"
                    value={formData.systolic_bp}
                    onChange={(e) => setFormData({ ...formData, systolic_bp: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Target: &lt;130 mmHg per ACC/AHA guidelines</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Diastolic Blood Pressure (mmHg)
                  </label>
                  <input
                    type="number"
                    value={formData.diastolic_bp}
                    onChange={(e) => setFormData({ ...formData, diastolic_bp: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Target: &lt;80 mmHg</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    11. Resting Heart Rate (bpm)
                  </label>
                  <input
                    type="number"
                    value={formData.resting_hr}
                    onChange={(e) => setFormData({ ...formData, resting_hr: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Normal adult range: 60–100 bpm</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Total Cholesterol (mg/dL, optional)
                  </label>
                  <input
                    type="number"
                    value={formData.total_cholesterol}
                    onChange={(e) => setFormData({ ...formData, total_cholesterol: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
              </div>
            )}

            {formData.primary_disease === 'ckd' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    10. Serum Creatinine (mg/dL)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.serum_creatinine}
                    onChange={(e) => setFormData({ ...formData, serum_creatinine: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    11. Estimated GFR (eGFR, mL/min/1.73m²)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.egfr}
                    onChange={(e) => setFormData({ ...formData, egfr: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Normal: &gt;90 | Stage 3: 30–59 | Stage 5: &lt;15</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Urine Protein / Albuminuria (uACR)
                  </label>
                  <select
                    value={formData.uacr_protein}
                    onChange={(e) => setFormData({ ...formData, uacr_protein: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                  >
                    <option value="Negative">Negative / Normal</option>
                    <option value="Trace">Trace</option>
                    <option value="1+">1+ (Mild Microalbuminuria)</option>
                    <option value="2+">2+ (Moderate)</option>
                    <option value="3+">3+ (Severe Proteinuria)</option>
                    <option value="Not tested">Not tested recently</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Clinician-Established CKD Stage
                  </label>
                  <select
                    value={formData.ckd_stage}
                    onChange={(e) => setFormData({ ...formData, ckd_stage: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                  >
                    <option value="Stage 1">Stage 1 (Normal or high eGFR &gt;90)</option>
                    <option value="Stage 2">Stage 2 (Mildly decreased 60–89)</option>
                    <option value="Stage 3a">Stage 3a (Mild-to-moderate 45–59)</option>
                    <option value="Stage 3b">Stage 3b (Moderate-to-severe 30–44)</option>
                    <option value="Stage 4">Stage 4 (Severely decreased 15–29)</option>
                    <option value="Not known">Not known / Under evaluation</option>
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                12. Current Symptoms Checklist
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  'Shortness of breath', 'Chest tightness', 'Morning headache', 'Dizziness',
                  'Frequent urination', 'Excessive thirst', 'Blurry vision', 'Swollen ankles',
                  'Fatigue', 'Palpitations', 'Poor sleep'
                ].map((s) => (
                  <label
                    key={s}
                    className={`flex items-center space-x-2 p-2.5 rounded-lg border text-xs cursor-pointer ${
                      formData.symptoms.includes(s)
                        ? 'bg-teal-50 border-teal-500 font-semibold text-teal-900'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.symptoms.includes(s)}
                      onChange={() => toggleSymptom(s)}
                      className="rounded text-teal-600 focus:ring-teal-500"
                    />
                    <span>{s}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: PRIVACY & INFORMED CONSENT */}
        {step === 4 && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 text-xs font-extrabold flex items-center justify-center">4</span>
              Specialty Goals & Informed Consent
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Preferred Specialist Care Track
                </label>
                <select
                  value={formData.preferred_specialty}
                  onChange={(e) => setFormData({ ...formData, preferred_specialty: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                >
                  <option value="Cardiology">Cardiology (Heart & Blood Pressure)</option>
                  <option value="Endocrinology">Endocrinology (Diabetes & Metabolism)</option>
                  <option value="Nephrology">Nephrology (Kidney Health)</option>
                  <option value="Guided Matching">Guided Specialist Matching</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Primary Care Management Goal
                </label>
                <input
                  type="text"
                  value={formData.care_goals}
                  onChange={(e) => setFormData({ ...formData, care_goals: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                />
              </div>
            </div>

            {/* Privacy Explanation & Invariant */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs text-slate-700">
              <div className="flex items-center gap-2 text-teal-800 font-bold">
                <Lock className="w-4 h-4 text-teal-600" />
                <span>Strict Pre-Acceptance Privacy Architecture</span>
              </div>
              <p>
                When you submit a consultation request to a specialist, they will immediately see your <strong>full name, age, primary condition, and introductory reason</strong> in their pending dashboard.
              </p>
              <p>
                Your detailed questionnaire answers, historical charts, uploaded lab documents, and daily biometric logs remain strictly encrypted and inaccessible (HTTP 403 Forbidden) until the doctor explicitly accepts your request.
              </p>
            </div>

            {/* Informed Consent Checkbox */}
            <div className="p-4 rounded-xl bg-teal-50/70 border border-teal-200">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.consent_granted}
                  onChange={(e) => setFormData({ ...formData, consent_granted: e.target.checked })}
                  className="mt-1 rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
                />
                <div className="text-xs text-slate-800">
                  <p className="font-bold text-slate-900">Informed Patient Consent for Remote Clinical Monitoring & AI Risk Stratification</p>
                  <p className="text-slate-600 mt-1 leading-relaxed">
                    I confirm that the health data entered is accurate to the best of my knowledge. I understand that AI risk assessments provided by ChronicCare AI are mathematical probability stratifications, NOT medical diagnoses, and do not replace emergency medical response. I consent to sharing authorized records with physicians upon consultation acceptance.
                  </p>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={handlePrev}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-semibold transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>
          ) : <div />}

          {step < 4 ? (
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center space-x-1.5 px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold shadow-md shadow-teal-600/20 transition-all"
            >
              <span>Continue</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="flex items-center space-x-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white text-sm font-bold shadow-lg shadow-teal-700/20 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Verifying & Unlocking Portal...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Submit & Unlock Patient Dashboard</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
