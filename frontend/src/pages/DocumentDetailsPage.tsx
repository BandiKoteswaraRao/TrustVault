import React, { useEffect, useState } from 'react';
import { documentApi, permissionApi, DocumentItem, PermissionItem } from '../services/api';
import { Modal } from '../components/Modal';
import { 
  ArrowLeft, 
  Download, 
  ShieldCheck, 
  UserPlus, 
  UserX, 
  FileText, 
  Key, 
  Clock, 
  Trash2, 
  Edit3, 
  AlertCircle, 
  CheckCircle2 
} from 'lucide-react';

interface DocumentDetailsPageProps {
  documentId: string;
  onNavigate: (page: string, docId?: string) => void;
}

export const DocumentDetailsPage: React.FC<DocumentDetailsPageProps> = ({ documentId, onNavigate }) => {
  const [doc, setDoc] = useState<DocumentItem | null>(null);
  const [accessType, setAccessType] = useState<'owner' | 'grantee'>('owner');
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Grant Access Modal
  const [isGrantOpen, setIsGrantOpen] = useState(false);
  const [granteeEmail, setGranteeEmail] = useState('');
  const [grantLevel, setGrantLevel] = useState<'read' | 'download'>('download');
  const [grantLoading, setGrantLoading] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);

  // Edit Title Modal
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');

  useEffect(() => {
    loadDetails();
  }, [documentId]);

  const loadDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await documentApi.getDetails(documentId);
      setDoc(res.document);
      setAccessType(res.accessType);
      setEditTitle(res.document.title);
      setEditDesc(res.document.description || '');

      if (res.accessType === 'owner') {
        const permsRes = await permissionApi.list(documentId);
        setPermissions(permsRes.permissions);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load document details.');
    } finally {
      setLoading(false);
    }
  };

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    setGrantError(null);
    setGrantLoading(true);

    try {
      await permissionApi.grant(documentId, {
        granteeEmail,
        permissionLevel: grantLevel
      });
      setIsGrantOpen(false);
      setGranteeEmail('');
      // Reload permissions
      const permsRes = await permissionApi.list(documentId);
      setPermissions(permsRes.permissions);
    } catch (err: any) {
      setGrantError(err.message || 'Failed to grant permission.');
    } finally {
      setGrantLoading(false);
    }
  };

  const handleRevoke = async (permissionId: string, granteeEmail: string) => {
    if (!window.confirm(`Revoke document access for ${granteeEmail}? They will immediately lose access.`)) {
      return;
    }

    try {
      await permissionApi.revoke(documentId, permissionId);
      const permsRes = await permissionApi.list(documentId);
      setPermissions(permsRes.permissions);
    } catch (err: any) {
      alert(err.message || 'Failed to revoke permission.');
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await documentApi.update(documentId, { title: editTitle, description: editDesc });
      setIsEditOpen(false);
      loadDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to update document.');
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
      <div className="py-20 text-center">
        <div className="w-8 h-8 border-3 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-xs text-slate-400">Verifying zero-trust authorization...</p>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-white mb-2">Access Denied or Not Found</h2>
          <p className="text-xs text-slate-400 mb-6">{error || 'Unable to retrieve document.'}</p>
          <button
            onClick={() => onNavigate('documents')}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
          >
            Return to Documents
          </button>
        </div>
      </div>
    );
  }

  const activePermissions = permissions.filter(p => !p.revoked_at);
  const revokedPermissions = permissions.filter(p => p.revoked_at);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onNavigate('documents')}
          className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Documents
        </button>

        <div className="flex items-center gap-2">
          {accessType === 'owner' && (
            <button
              onClick={() => setIsEditOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs font-medium border border-slate-750 transition-colors flex items-center gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Details</span>
            </button>
          )}

          <button
            onClick={() => documentApi.download(doc.id, doc.file_name)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            <span>Download Document</span>
          </button>
        </div>
      </div>

      {/* Main Document Details Card */}
      <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded font-bold border ${
                accessType === 'owner'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
              }`}>
                {accessType === 'owner' ? 'Document Owner' : 'Authorized Grantee'}
              </span>
              <span className="text-xs text-slate-500">•</span>
              <span className="text-xs text-slate-400 font-mono">{doc.mime_type}</span>
            </div>

            <h1 className="text-2xl font-bold text-white tracking-tight">{doc.title}</h1>
            {doc.description && (
              <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">{doc.description}</p>
            )}
          </div>

          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-right shrink-0">
            <span className="text-[10px] text-slate-500 block uppercase font-mono">File Size</span>
            <span className="text-sm font-bold text-slate-200">{formatFileSize(doc.file_size)}</span>
          </div>
        </div>

        {/* Cryptographic Checksum Banner */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <span className="text-[11px] font-bold text-slate-300 block">SHA-256 Content Integrity Digest</span>
              <span className="text-xs font-mono text-emerald-400 break-all">{doc.sha256_checksum}</span>
            </div>
          </div>
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[11px] font-medium border border-emerald-500/20 self-start sm:self-auto">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Verified
          </div>
        </div>

        {/* File Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-800/80 text-xs">
          <div>
            <span className="text-slate-500 block text-[11px]">Original Filename:</span>
            <span className="text-slate-200 font-medium truncate block">{doc.file_name}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Uploaded Date:</span>
            <span className="text-slate-200 font-medium">{new Date(doc.created_at).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Owner Contact:</span>
            <span className="text-slate-200 font-medium">{doc.owner_email || 'You'}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Active Grants:</span>
            <span className="text-emerald-400 font-bold">{activePermissions.length}</span>
          </div>
        </div>
      </div>

      {/* Permissions Management Section (Owner Exclusive) */}
      {accessType === 'owner' && (
        <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <Key className="w-4 h-4 text-emerald-400" />
                Access Control & Permission Management
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Grant or revoke download permissions for other registered TrustVault users. Revocation takes effect instantly.
              </p>
            </div>

            <button
              onClick={() => {
                setGrantError(null);
                setIsGrantOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-emerald-400 border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 self-start sm:self-auto"
            >
              <UserPlus className="w-4 h-4" />
              <span>Grant Access</span>
            </button>
          </div>

          {/* Active Grants Table */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Active Access Grants ({activePermissions.length})
            </h3>

            {activePermissions.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 bg-slate-950/40 rounded-xl text-center border border-slate-800">
                This document is private. No other users have been granted access.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-850 text-slate-400 uppercase font-mono text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Grantee</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Permission</th>
                      <th className="py-3 px-4">Granted At</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {activePermissions.map((perm) => (
                      <tr key={perm.id} className="hover:bg-slate-850/50 transition-colors">
                        <td className="py-3 px-4 font-semibold text-white">{perm.grantee_name}</td>
                        <td className="py-3 px-4 text-slate-300 font-mono">{perm.grantee_email}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono text-[10px]">
                            {perm.permission_level}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">{new Date(perm.created_at).toLocaleDateString()}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleRevoke(perm.id, perm.grantee_email)}
                            className="px-2.5 py-1 rounded-lg text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 font-semibold transition-colors inline-flex items-center gap-1"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Historical Revoked Grants */}
          {revokedPermissions.length > 0 && (
            <div className="pt-4 border-t border-slate-800">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Revoked Access History ({revokedPermissions.length})
              </h3>
              <div className="overflow-x-auto rounded-xl border border-slate-800 opacity-70">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-850 text-slate-400 uppercase font-mono text-[10px]">
                    <tr>
                      <th className="py-2 px-4">Grantee</th>
                      <th className="py-2 px-4">Email</th>
                      <th className="py-2 px-4">Revoked At</th>
                      <th className="py-2 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {revokedPermissions.map((perm) => (
                      <tr key={perm.id}>
                        <td className="py-2 px-4 text-slate-400">{perm.grantee_name}</td>
                        <td className="py-2 px-4 text-slate-500 font-mono">{perm.grantee_email}</td>
                        <td className="py-2 px-4 text-slate-500">{perm.revoked_at ? new Date(perm.revoked_at).toLocaleString() : ''}</td>
                        <td className="py-2 px-4 text-right text-rose-400 font-semibold text-[11px]">Revoked</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grant Access Modal */}
      <Modal isOpen={isGrantOpen} onClose={() => setIsGrantOpen(false)} title="Grant Document Access">
        {grantError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{grantError}</span>
          </div>
        )}

        <form onSubmit={handleGrant} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Grantee Email Address</label>
            <input
              type="email"
              required
              value={granteeEmail}
              onChange={(e) => setGranteeEmail(e.target.value)}
              placeholder="e.g. demo.recipient@trustvault.local"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">Recipient must have a registered TrustVault account.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Permission Level</label>
            <select
              value={grantLevel}
              onChange={(e) => setGrantLevel(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="download">Download (Read & Download binary)</option>
              <option value="read">Read (Metadata inspection only)</option>
            </select>
          </div>

          <div className="pt-3 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsGrantOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={grantLoading || !granteeEmail}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
            >
              {grantLoading ? 'Granting...' : 'Confirm Grant'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Title Modal */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit Document Details">
        <form onSubmit={handleEdit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Document Title</label>
            <input
              type="text"
              required
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Description</label>
            <textarea
              rows={3}
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
