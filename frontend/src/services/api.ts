// TrustVault Frontend API Client

const API_BASE = import.meta.env.VITE_API_URL || '';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  createdAt?: string;
}

export interface DocumentItem {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  file_name: string;
  file_size: string | number;
  mime_type: string;
  sha256_checksum: string;
  created_at: string;
  updated_at: string;
  owner_email?: string;
  owner_name?: string;
  access_type?: 'owner' | 'grantee';
  permission_level?: string;
  shared_at?: string;
}

export interface PermissionItem {
  id: string;
  document_id: string;
  grantee_id: string;
  grantee_email: string;
  grantee_name: string;
  permission_level: string;
  created_at: string;
  revoked_at: string | null;
}

export interface AuditEventItem {
  id: string;
  sequence_number: number;
  timestamp: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  outcome: 'SUCCESS' | 'FAILURE' | 'DENIED';
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, any>;
  prev_hash: string;
  current_hash: string;
}

export interface AuditVerificationReport {
  isValid: boolean;
  totalEvents: number;
  tamperedIndex?: number;
  tamperedEventId?: string;
  tamperedSequenceNumber?: number;
  reason?: string;
  expectedHash?: string;
  actualHash?: string;
  verifiedAt: string;
  hmacSignature?: string;
  message?: string;
}

// Token helper
export function getAuthToken(): string | null {
  return localStorage.getItem('trustvault_token');
}

export function setAuthToken(token: string): void {
  localStorage.setItem('trustvault_token', token);
}

export function removeAuthToken(): void {
  localStorage.removeItem('trustvault_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Only set application/json if body is not FormData
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 401 && !endpoint.includes('/api/auth/login') && !endpoint.includes('/api/auth/register')) {
    // Session expired
    removeAuthToken();
    window.dispatchEvent(new Event('auth:unauthorized'));
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.message || data.error || `HTTP ${response.status}`;
    const err: any = new Error(errorMsg);
    err.status = response.status;
    err.details = data.details;
    throw err;
  }

  return data as T;
}

// Authentication API
export const authApi = {
  async register(params: { email: string; password: string; fullName: string }) {
    const res = await request<{ user: User; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(params)
    });
    setAuthToken(res.token);
    return res;
  },

  async login(params: { email: string; password: string }) {
    const res = await request<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(params)
    });
    setAuthToken(res.token);
    return res;
  },

  async getMe() {
    return request<{ user: User }>('/api/auth/me');
  },

  async logout() {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } finally {
      removeAuthToken();
    }
  }
};

// Document API
export const documentApi = {
  async upload(formData: FormData) {
    return request<{ message: string; document: DocumentItem }>('/api/documents', {
      method: 'POST',
      body: formData
    });
  },

  async listOwned(params?: { search?: string; page?: number; limit?: number }) {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.page) qs.set('page', params.page.toString());
    if (params?.limit) qs.set('limit', params.limit.toString());
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return request<{ documents: DocumentItem[]; total: number; page: number; totalPages: number }>(`/api/documents${query}`);
  },

  async listShared() {
    return request<{ documents: DocumentItem[] }>('/api/documents/shared');
  },

  async getDetails(id: string) {
    return request<{ document: DocumentItem; accessType: 'owner' | 'grantee'; permissionLevel: string }>(`/api/documents/${id}`);
  },

  async download(id: string, filename: string): Promise<void> {
    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/api/documents/${id}/download`, { headers });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.message || `Download failed: HTTP ${res.status}`);
    }

    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
  },

  async update(id: string, data: { title: string; description?: string }) {
    return request<{ message: string; document: DocumentItem }>(`/api/documents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },

  async delete(id: string) {
    return request<{ message: string }>(`/api/documents/${id}`, {
      method: 'DELETE'
    });
  }
};

// Permissions API
export const permissionApi = {
  async list(documentId: string) {
    return request<{ permissions: PermissionItem[] }>(`/api/documents/${documentId}/permissions`);
  },

  async grant(documentId: string, params: { granteeEmail: string; permissionLevel?: 'read' | 'download' }) {
    return request<{ message: string; permission: PermissionItem }>(`/api/documents/${documentId}/permissions`, {
      method: 'POST',
      body: JSON.stringify(params)
    });
  },

  async revoke(documentId: string, permissionId: string) {
    return request<{ message: string }>(`/api/documents/${documentId}/permissions/${permissionId}`, {
      method: 'DELETE'
    });
  }
};

// Audit API
export const auditApi = {
  async getLogs(params?: { action?: string; outcome?: string; targetType?: string; page?: number; limit?: number }) {
    const qs = new URLSearchParams();
    if (params?.action) qs.set('action', params.action);
    if (params?.outcome) qs.set('outcome', params.outcome);
    if (params?.targetType) qs.set('targetType', params.targetType);
    if (params?.page) qs.set('page', params.page.toString());
    if (params?.limit) qs.set('limit', params.limit.toString());
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return request<{ events: AuditEventItem[]; total: number; page: number; totalPages: number }>(`/api/audit${query}`);
  },

  async verifyTrail() {
    return request<AuditVerificationReport>('/api/audit/verify');
  }
};
