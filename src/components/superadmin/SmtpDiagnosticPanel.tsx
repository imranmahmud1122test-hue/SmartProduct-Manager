import React, { useState, useEffect } from 'react';
import {
  Mail,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Send,
  ShieldCheck,
  Server,
  Lock,
  Key,
  Info,
  Clock,
  Sparkles,
} from 'lucide-react';
import { User } from '../../types';
import { adminApi } from '../../services/adminApi';

interface SmtpDiagnosticPanelProps {
  currentUser: User;
}

interface DiagnosticState {
  success: boolean;
  configured?: boolean;
  status?: 'verified' | 'error';
  host?: string;
  port?: number;
  user?: string;
  from?: string;
  passLength?: number;
  passMasked?: string;
  message?: string;
  error?: string;
  timestamp?: string;
}

export const SmtpDiagnosticPanel: React.FC<SmtpDiagnosticPanelProps> = ({ currentUser }) => {
  const [loading, setLoading] = useState(true);
  const [diagData, setDiagData] = useState<DiagnosticState | null>(null);
  const [recipientEmail, setRecipientEmail] = useState(currentUser.email || 'imranmahmud1122.test@gmail.com');
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
    messageId?: string;
    timestamp?: string;
  } | null>(null);

  const fetchDiagnostic = async () => {
    setLoading(true);
    setTestResult(null);
    try {
      const res = await adminApi.getSmtpDiagnostic(currentUser);
      setDiagData(res);
    } catch (err: any) {
      setDiagData({
        success: false,
        status: 'error',
        error: err.message || 'Failed to fetch SMTP diagnostic from server.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostic();
  }, []);

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientEmail.trim()) return;

    setSendingTest(true);
    setTestResult(null);

    try {
      const res = await adminApi.sendSmtpTestEmail(recipientEmail.trim(), currentUser);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        error: err.message || 'Network error triggering SMTP test email.',
      });
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Title */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0">
            <Mail className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black tracking-tight text-white">SMTP Mail Server Diagnostics</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-extrabold uppercase tracking-wider border border-purple-500/30 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-purple-400" /> Super Admin Only
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Verify server-side SMTP environment variables and trigger controlled diagnostic test emails.
            </p>
          </div>
        </div>

        <button
          onClick={fetchDiagnostic}
          disabled={loading}
          className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Re-verify SMTP Connection
        </button>
      </div>

      {/* Connection Status Banner */}
      {loading ? (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-3 shadow-xs">
          <RefreshCw className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
          <p className="text-sm font-bold text-slate-700">Checking server-side SMTP handshake & authentication...</p>
        </div>
      ) : diagData?.status === 'verified' ? (
        <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl flex items-start gap-3 text-emerald-900 shadow-xs">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-black text-emerald-900">SMTP Configuration Active & Handshake Verified</h3>
              {diagData.timestamp && (
                <span className="text-[11px] font-mono text-emerald-700 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Tested at {new Date(diagData.timestamp).toLocaleTimeString()}
                </span>
              )}
            </div>
            <p className="text-xs text-emerald-800 mt-1">
              {diagData.message || 'Server successfully authenticated with the configured SMTP mail server.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-rose-50 border border-rose-200 p-5 rounded-2xl flex items-start gap-3 text-rose-900 shadow-xs">
          <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-black text-rose-900">SMTP Handshake / Credentials Issue</h3>
            <p className="text-xs text-rose-800 mt-1 font-mono bg-rose-100/60 p-2 rounded-lg border border-rose-200">
              {diagData?.error || 'Failed to authenticate with SMTP server. Please verify environment credentials.'}
            </p>
          </div>
        </div>
      )}

      {/* Environment Variables Inspection Grid */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-purple-600" />
            <h3 className="text-sm font-black text-slate-900">Loaded Server Environment Variables</h3>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">Loaded securely from process.env</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* SMTP_HOST */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center justify-between">
              <span>SMTP_HOST</span>
              <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-[9px]">Server Host</span>
            </div>
            <div className="text-sm font-bold font-mono text-slate-900 truncate">
              {diagData?.host || 'smtp.gmail.com'}
            </div>
          </div>

          {/* SMTP_PORT */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center justify-between">
              <span>SMTP_PORT</span>
              <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[9px]">
                {diagData?.port === 465 ? 'SSL (465)' : 'STARTTLS (587)'}
              </span>
            </div>
            <div className="text-sm font-bold font-mono text-slate-900">
              {diagData?.port || 587}
            </div>
          </div>

          {/* SMTP_USER */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center justify-between">
              <span>SMTP_USER</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[9px]">Sender Account</span>
            </div>
            <div className="text-sm font-bold font-mono text-slate-900 truncate" title={diagData?.user}>
              {diagData?.user || 'imranmahmud1122.test@gmail.com'}
            </div>
          </div>

          {/* SMTP_PASS */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center justify-between">
              <span>SMTP_PASS</span>
              <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-[9px] flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" /> Masked Secret
              </span>
            </div>
            <div className="text-sm font-bold font-mono text-purple-700">
              {diagData?.passMasked || '•••••••• (16 chars)'}
            </div>
          </div>

          {/* SMTP_FROM */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1 md:col-span-2">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center justify-between">
              <span>SMTP_FROM</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[9px]">Sender Header</span>
            </div>
            <div className="text-sm font-bold font-mono text-slate-900 truncate">
              {diagData?.from || '"Smart Product Manager" <imranmahmud1122.test@gmail.com>'}
            </div>
          </div>
        </div>
      </div>

      {/* Controlled Test Email Trigger Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Send className="w-4 h-4 text-purple-600" />
          <h3 className="text-sm font-black text-slate-900">Trigger Controlled Test Email</h3>
        </div>

        <p className="text-xs text-slate-600">
          Send a real diagnostic email to any specified inbox to confirm SMTP email delivery.
        </p>

        <form onSubmit={handleSendTestEmail} className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch gap-3">
            <div className="flex-1 relative">
              <input
                type="email"
                required
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="Enter target recipient email address"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm font-medium text-slate-900 bg-white"
              />
            </div>
            <button
              type="submit"
              disabled={sendingTest || !recipientEmail.trim()}
              className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Send className={`w-3.5 h-3.5 ${sendingTest ? 'animate-bounce' : ''}`} />
              {sendingTest ? 'Sending Test Email...' : 'Send Diagnostic Test Email'}
            </button>
          </div>
        </form>

        {/* Test Result Feedback Banner */}
        {testResult && (
          <div
            className={`p-4 rounded-xl border text-xs font-medium space-y-1 ${
              testResult.success
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-2 font-bold">
              {testResult.success ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Test Email Sent Successfully</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Test Email Delivery Failed</span>
                </>
              )}
            </div>

            <p className="font-mono text-[11px] opacity-90">{testResult.message || testResult.error}</p>

            {testResult.messageId && (
              <div className="text-[10px] font-mono opacity-75 pt-1">
                Message ID: {testResult.messageId}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
