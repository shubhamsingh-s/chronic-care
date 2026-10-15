const BASE_URL = '/api';

export function getToken(): string | null {
  return localStorage.getItem('chroniccare_token');
}

export function setToken(token: string) {
  localStorage.setItem('chroniccare_token', token);
}

export function removeToken() {
  localStorage.removeItem('chroniccare_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Only set Content-Type if not sending FormData
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = 'Request failed';
    try {
      const errData = await response.json();
      if (Array.isArray(errData.detail)) {
        errorDetail = errData.detail
          .map((d: any) => {
            const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : '';
            const msg = d.msg || JSON.stringify(d);
            return field ? `${field}: ${msg}` : msg;
          })
          .join('; ');
      } else if (typeof errData.detail === 'object' && errData.detail !== null) {
        errorDetail = JSON.stringify(errData.detail);
      } else if (errData.detail) {
        errorDetail = String(errData.detail);
      } else if (errData.message) {
        errorDetail = typeof errData.message === 'string' ? errData.message : JSON.stringify(errData.message);
      }
    } catch {
      errorDetail = `HTTP ${response.status}: ${response.statusText}`;
    }
    const err = new Error(errorDetail);
    (err as any).status = response.status;
    throw err;
  }

  return response.json();
}

export const api = {
  // Auth
  register: (data: any) => request<any>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: any) => request<any>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => request<any>('/auth/me'),
  logout: () => request<any>('/auth/logout', { method: 'POST' }),

  // Patient
  submitQuestionnaire: (data: any) => request<any>('/patient/questionnaire', { method: 'POST', body: JSON.stringify(data) }),
  getPatientDashboard: () => request<any>('/patient/dashboard'),
  getDoctors: (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<any[]>(`/patient/doctors${qs ? `?${qs}` : ''}`);
  },
  sendConsultationRequest: (data: any) => request<any>('/patient/requests', { method: 'POST', body: JSON.stringify(data) }),
  getPatientRequests: () => request<any[]>('/patient/requests'),

  // Doctor
  getDoctorOverview: () => request<any>('/doctor/overview'),
  getPendingRequests: () => request<any[]>('/doctor/pending-requests'),
  actOnRequest: (id: number, data: { action: 'accept' | 'decline'; doctor_response_notes?: string }) =>
    request<any>(`/doctor/requests/${id}/action`, { method: 'POST', body: JSON.stringify(data) }),
  getActivePatients: (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<any[]>(`/doctor/active-patients${qs ? `?${qs}` : ''}`);
  },
  getPatientRecords: (patientId: number) => request<any>(`/doctor/patient/${patientId}/records`),
  connectPatientToPanel: (patientId: number) => request<any>(`/doctor/patient/${patientId}/connect`, { method: 'POST' }),
  getPriorityQueue: (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<any[]>(`/doctor/priority-queue${qs ? `?${qs}` : ''}`);
  },

  reviewDailyReport: (id: number, data: { feedback: string }) =>
    request<any>(`/doctor/reports/${id}/review`, { method: 'POST', body: JSON.stringify(data) }),

  // Remote Patient Monitoring
  submitDailyReport: (data: any) => request<any>('/monitoring/daily-report', { method: 'POST', body: JSON.stringify(data) }),
  getMyReports: (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<any[]>(`/monitoring/my-reports${qs ? `?${qs}` : ''}`);
  },
  uploadDocument: (formData: FormData) => request<any>('/monitoring/upload-document', { method: 'POST', body: formData }),
  getMyDocuments: () => request<any[]>('/monitoring/my-documents'),

  // AI Assessment
  evaluateRisk: (data: { disease_module: string; custom_inputs?: any }) =>
    request<any>('/assessment/evaluate', { method: 'POST', body: JSON.stringify(data) }),
  getAssessmentHistory: () => request<any[]>('/assessment/history'),

  // Consultation & Appointments
  getMessages: (reqId: number) => request<any[]>(`/consultation/${reqId}/messages`),
  sendMessage: (reqId: number, data: { message_text: string; attachments?: any[] }) =>
    request<any>(`/consultation/${reqId}/messages`, { method: 'POST', body: JSON.stringify(data) }),
  scheduleAppointment: (data: any) => request<any>('/consultation/appointments', { method: 'POST', body: JSON.stringify(data) }),
  getAppointments: () => request<any[]>('/consultation/appointments'),

  // Admin
  getAdminUsers: (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<any[]>(`/admin/users${qs ? `?${qs}` : ''}`);
  },
  toggleDoctorVerification: (id: number) => request<any>(`/admin/doctors/${id}/verify`, { method: 'POST' }),
  toggleUserStatus: (id: number) => request<any>(`/admin/users/${id}/toggle-status`, { method: 'POST' }),
  getAuditLogs: (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<any[]>(`/admin/audit-logs${qs ? `?${qs}` : ''}`);
  },
  getAdminAnalytics: () => request<any>('/admin/analytics'),
  verifyAdminCode: (code: string) => request<any>('/admin/verify-code', { method: 'POST', body: JSON.stringify({ code }) }),
};
