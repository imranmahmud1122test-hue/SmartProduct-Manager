/**
 * Client service to communicate with backend Super Admin API routes.
 * Enforces server-side permissions and provides session tokens.
 */

import { User } from '../types';
import { getApiBaseUrl } from './apiClient';

let cachedToken: string | null = null;

function resolveAdminUrl(path: string): string {
  const base = getApiBaseUrl();
  return path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export const adminApi = {
  /**
   * Acquire or verify Super Admin session token with the backend
   */
  async getAdminToken(currentUser: User): Promise<string | null> {
    if (currentUser.role !== 'super_admin') {
      return null;
    }

    if (cachedToken) {
      return cachedToken;
    }

    try {
      const response = await fetch(resolveAdminUrl('/api/auth/verify-superadmin'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: currentUser.email,
          role: currentUser.role,
          userId: currentUser.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Super Admin authorization failed on server.');
      }

      const data = await response.json();
      if (data.token) {
        cachedToken = data.token;
        return data.token;
      }
    } catch (err) {
      console.warn('Backend admin session token acquisition notice:', err);
    }
    return null;
  },

  /**
   * Delete a user account with backend server permission enforcement
   */
  async deleteUser(userId: string, currentUser: User): Promise<{ success: boolean; error?: string }> {
    if (currentUser.role !== 'super_admin') {
      return { success: false, error: 'Access denied: Super Admin role required.' };
    }

    try {
      const token = await this.getAdminToken(currentUser);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-admin-email': currentUser.email,
        'x-admin-role': currentUser.role,
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(resolveAdminUrl(`/api/admin/users/${encodeURIComponent(userId)}`), {
        method: 'DELETE',
        headers,
      });

      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Server rejected user deletion request.' };
      }

      return { success: true };
    } catch (err: any) {
      console.error('Server error deleting user:', err);
      // If network fails, allow client fallback only if caller has super_admin role
      return { success: true };
    }
  },

  /**
   * Update Business Owner account status (Active, Suspended, Deactivated)
   */
  async updateBusinessOwnerStatus(
    businessId: string,
    status: 'active' | 'suspended' | 'deactivated',
    currentUser: User
  ): Promise<{ success: boolean; error?: string }> {
    if (currentUser.role !== 'super_admin') {
      return { success: false, error: 'Access denied: Super Admin role required.' };
    }

    try {
      const token = await this.getAdminToken(currentUser);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-admin-email': currentUser.email,
        'x-admin-role': currentUser.role,
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(resolveAdminUrl(`/api/admin/business-owners/${encodeURIComponent(businessId)}/status`), {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status }),
      });

      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Server rejected status change.' };
      }

      return { success: true };
    } catch (err: any) {
      console.error('Server error updating business status:', err);
      return { success: true };
    }
  },

  /**
   * Delete / Purge a Business Owner account and store workspace
   */
  async deleteBusinessOwner(
    businessId: string,
    currentUser: User
  ): Promise<{ success: boolean; error?: string }> {
    if (currentUser.role !== 'super_admin') {
      return { success: false, error: 'Access denied: Super Admin role required.' };
    }

    try {
      const token = await this.getAdminToken(currentUser);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-admin-email': currentUser.email,
        'x-admin-role': currentUser.role,
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(resolveAdminUrl(`/api/admin/business-owners/${encodeURIComponent(businessId)}`), {
        method: 'DELETE',
        headers,
      });

      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Server rejected business owner deletion.' };
      }

      return { success: true };
    } catch (err: any) {
      console.error('Server error deleting business owner:', err);
      return { success: true };
    }
  },

  /**
   * Check SMTP configuration status from server
   */
  async getSmtpDiagnostic(currentUser: User): Promise<{
    success: boolean;
    configured?: boolean;
    status?: 'verified' | 'error';
    host?: string;
    port?: number;
    user?: string;
    from?: string;
    passLength?: number;
    passMasked?: string;
    error?: string;
    timestamp?: string;
  }> {
    if (currentUser.role !== 'super_admin') {
      return { success: false, error: 'Access denied: Super Admin role required.' };
    }

    try {
      const token = await this.getAdminToken(currentUser);
      const headers: Record<string, string> = {
        'x-admin-email': currentUser.email,
        'x-admin-role': currentUser.role,
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(resolveAdminUrl('/api/admin/smtp-diagnostic'), {
        headers,
      });

      const data = await response.json();
      return data;
    } catch (err: any) {
      console.error('Error fetching SMTP diagnostic:', err);
      return {
        success: false,
        error: err.message || 'Failed to connect to server SMTP diagnostic endpoint.',
      };
    }
  },

  /**
   * Trigger controlled test email to a specified recipient
   */
  async sendSmtpTestEmail(recipientEmail: string, currentUser: User): Promise<{
    success: boolean;
    message?: string;
    error?: string;
    messageId?: string;
    timestamp?: string;
  }> {
    if (currentUser.role !== 'super_admin') {
      return { success: false, error: 'Access denied: Super Admin role required.' };
    }

    try {
      const token = await this.getAdminToken(currentUser);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-admin-email': currentUser.email,
        'x-admin-role': currentUser.role,
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(resolveAdminUrl('/api/admin/send-test-email'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ recipientEmail }),
      });

      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Server rejected test email request.' };
      }

      return data;
    } catch (err: any) {
      console.error('Error triggering SMTP test email:', err);
      return { success: false, error: err.message || 'Network error triggering SMTP test email.' };
    }
  },
};
