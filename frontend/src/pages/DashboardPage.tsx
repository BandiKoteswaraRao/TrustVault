import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { documentApi, auditApi, DocumentItem, AuditEventItem, AuditVerificationReport } from '../services/api';
import { 
  FileText, 
  Share2, 
  ShieldCheck, 
  AlertTriangle, 
  UploadCloud, 
  ArrowUpRight, 
  Clock, 
  Download, 
  CheckCircle2, 
  Activity 
} from 'lucide-react';

interface DashboardPageProps {
  onNavigate: (page: string, docId?: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [ownedDocs, setOwnedDocs] = useState<DocumentItem[]>([]);
  const [sharedDocs, setSharedDocs] = useState<DocumentItem[]>([]);
  const [recentAudit, setRecentAudit] = useState<AuditEventItem[]>([]);
  const [verification, setVerification] = useState<AuditVerificationReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [ownedRes, sharedRes, auditRes, verifyRes] = await Promise.all([
        documentApi.listOwned({ limit: 5 }),
        documentApi.listShared(),
        auditApi.getLogs({ limit: 5 }),
        auditApi.verifyTrail().catch(() => null)
      ]);

      setOwnedDocs(ownedRes.documents);
      setSharedDocs(sharedRes.documents);
      setRecentAudit(auditRes.events);
      if (verifyRes) setVerification(verifyRes);
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: string | number) => {
    const num = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
    if (isNaN(num) || num === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(num) / Math.log(k));
    return parseFloat((num / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-8 h-8 border-3 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
        <p className="text-xs text-slate-400">Loading secure vault dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome & Verification Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Welcome, {user?.fullName}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Zero-Trust Vault Session Active • Role: <span className="font-semibold text-emerald-400">{user?.role}</span>
          </p>
        </div>

        {/* Audit Status Pill */}
        <div className="flex items-center gap-3">
          {verification?.isValid ? (
            <div 
              onClick={() => onNavigate('audit')}
              className="cursor-pointer px-4 py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-2 hover:bg-emerald-500/20 transition-colors shadow-lg shadow-emerald-500/10"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Audit Chain Intact ({verification.totalEvents} Events)</span>
            </div>
          ) : (
            <div 
              onClick={() => onNavigate('audit')}
              className="cursor-pointer px-4 py-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold flex items-center gap-2 hover:bg-rose-500/20 transition-colors shadow-lg shadow-rose-500/10"
            >
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>Audit Chain Warning</span>
            </div>
          )}

          <button
            onClick={() => onNavigate('upload')}
            className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-1.5"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Document</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">My Documents</span>
            <FileText className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-white">{ownedDocs.length}</p>
          <span className="text-[11px] text-slate-500 mt-1 block">Stored in private isolated storage</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Shared With Me</span>
            <Share2 className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-bold text-white">{sharedDocs.length}</p>
          <span className="text-[11px] text-slate-500 mt-1 block">Active delegated access grants</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Audit Events Sealed</span>
            <CheckCircle2 className="w-4 h-4 text-vault-500" />
          </div>
          <p className="text-2xl font-bold text-white">{verification?.totalEvents || recentAudit.length}</p>
          <span className="text-[11px] text-slate-500 mt-1 block">SHA-256 hash linked events</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Access Enforcement</span>
            <Activity className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-white">Zero-Trust</p>
          <span className="text-[11px] text-slate-500 mt-1 block">Dynamic real-time checks</span>
        </div>
      </div>

      {/* Main Split: Documents vs Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: My Documents */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white tracking-tight">Recent Vault Documents</h2>
            <button
              onClick={() => onNavigate('documents')}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
            >
              View all ({ownedDocs.length})
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {ownedDocs.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center">
              <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-300">No documents uploaded yet</p>
              <p className="text-xs text-slate-500 mt-1 mb-4">Upload your first confidential document to initiate the secure vault.</p>
              <button
                onClick={() => onNavigate('upload')}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors inline-flex items-center gap-1.5"
              >
                <UploadCloud className="w-4 h-4" />
                Upload Now
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {ownedDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-between group"
                >
                  <div 
                    onClick={() => onNavigate('document-details', doc.id)}
                    className="flex items-center space-x-3 cursor-pointer min-w-0"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-sm text-white truncate group-hover:text-emerald-400 transition-colors">
                        {doc.title}
                      </h4>
                      <p className="text-xs text-slate-400 truncate">
                        {doc.file_name} • {formatFileSize(doc.file_size)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      onClick={() => onNavigate('document-details', doc.id)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
                    >
                      Permissions
                    </button>
                    <button
                      onClick={() => documentApi.download(doc.id, doc.file_name)}
                      className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-colors"
                      title="Download file"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Col: Recent Audit Trail */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white tracking-tight">Recent Audit Activity</h2>
            <button
              onClick={() => onNavigate('audit')}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
            >
              Verify trail
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            {recentAudit.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No recent audit records.</p>
            ) : (
              recentAudit.map((event) => (
                <div key={event.id} className="pb-3 border-b border-slate-800/60 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[11px] font-bold text-emerald-400">
                      {event.action}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      event.outcome === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                    }`}>
                      {event.outcome}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">
                    Actor: {event.actor_email || 'Anonymous System'}
                  </p>
                  <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-1 font-mono">
                    <Clock className="w-3 h-3" />
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
