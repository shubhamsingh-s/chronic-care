import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navigation } from './components/Navigation';
import { PatientPortal } from './pages/PatientPortal';
import { DoctorPortal } from './pages/DoctorPortal';
import { AdminPortal } from './pages/AdminPortal';
import { OnboardingWizard } from './pages/OnboardingWizard';
import { LoginRegister } from './pages/LoginRegister';

const MainApp: React.FC = () => {
  const { user, loading, refreshUser } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-300">Initializing ChronicCare AI Clinical Platform...</p>
      </div>
    );
  }

  // Not logged in -> Show Clean Functional Login / Register
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col">
        <LoginRegister />
      </div>
    );
  }

  // If Patient has NOT completed mandatory health questionnaire
  if (user.role === 'patient' && !user.questionnaire_completed) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Navigation />
        <main className="flex-1">
          <OnboardingWizard onCompleted={() => refreshUser()} />
        </main>
      </div>
    );
  }

  // Role-specific portals (Demo switcher removed)
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navigation />
      <main className="flex-1">
        {user.role === 'patient' && <PatientPortal />}
        {user.role === 'doctor' && <DoctorPortal />}
        {user.role === 'admin' && <AdminPortal />}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
