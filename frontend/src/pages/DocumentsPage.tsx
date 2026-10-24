import React, { useEffect, useState } from 'react';
import { documentApi, DocumentItem } from '../services/api';
import { 
  FileText, 
  Share2, 
  Search, 
  Download, 
  Trash2, 
  ExternalLink, 
  UploadCloud, 
  Key, 
  Clock, 
  Shield 
} from 'lucide-react';

interface DocumentsPageProps {
  onNavigate: (page: string, docId?: string) => void;
  initialTab?: 'owned' | 'shared';
}

export const DocumentsPage: React.FC<DocumentsPageProps> = ({ onNavigate, initialTab = 'owned' }) => {
  const [activeTab, setActiveTab] = useState<'owned' | 'shared'>(initialTab);
  const [ownedDocs, setOwnedDocs] = useState<DocumentItem[]>([]);
  const [sharedDocs, setSharedDocs] = useState<DocumentItem[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDocuments();
  }, [activeTab, search, page]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      if (activeTab === 'owned') {
        const res = await documentApi.listOwned({ search, page, limit: 10 });
        setOwnedDocs(res.documents);
        setTotalPages(res.totalPages || 1);
      } else {
        const res = await documentApi.listShared();
        setSharedDocs(res.documents);
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${title}"? This cannot be undone.`)) {
      return;
    }
    try {
      await documentApi.delete(id);
      loadDocuments();
    } catch (err: any) {
      alert(err.message || 'Failed to delete document.');
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Documents Vault</h1>
          <p className="text-xs text-slate-400 mt-1">Manage private files and access delegations</p>
        </div>

        <button
          onClick={() => onNavigate('upload')}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-1.5 self-start sm:self-auto"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Upload Document</span>
        </button>
      </div>

      {/* Tabs and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setActiveTab('owned');
              setPage(1);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'owned'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>My Documents ({ownedDocs.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('shared');
              setPage(1);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'shared'
                ? 'bg-slate-800 text-cyan-400 border border-slate-700 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            <Share2 className="w-4 h-4" />
            <span>Shared With Me ({sharedDocs.length})</span>
          </button>
        </div>

        {activeTab === 'owned' && (
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by title..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
        )}
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-3 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs text-slate-400">Loading documents...</p>
        </div>
      ) : activeTab === 'owned' ? (
        /* My Documents Tab */
        ownedDocs.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-slate-900 border border-slate-800">
            <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-white">No documents found</h3>
            <p className="text-xs text-slate-400 mt-1 mb-6">
              {search ? 'Try clearing your search query.' : 'Upload a document to begin sharing with audit protection.'}
            </p>
            {!search && (
              <button
                onClick={() => onNavigate('upload')}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all"
              >
                Upload First Document
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ownedDocs.map((doc) => (
              <div
                key={doc.id}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      Owner
                    </span>
                  </div>

                  <h3 
                    onClick={() => onNavigate('document-details', doc.id)}
                    className="font-bold text-sm text-white group-hover:text-emerald-400 transition-colors cursor-pointer line-clamp-1 mb-1"
                  >
                    {doc.title}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-1 mb-3">
                    {doc.file_name}
                  </p>

                  <div className="text-[11px] text-slate-500 space-y-1 font-mono border-t border-slate-800/60 pt-3">
                    <div className="flex justify-between">
                      <span>Size:</span>
                      <span className="text-slate-300">{formatFileSize(doc.file_size)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>SHA-256:</span>
                      <span className="text-slate-400 truncate max-w-[120px]" title={doc.sha256_checksum}>
                        {doc.sha256_checksum.substring(0, 8)}...
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[10px]">
                      <span>Uploaded:</span>
                      <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 mt-4">
                  <button
                    onClick={() => onNavigate('document-details', doc.id)}
                    className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                  >
                    <span>Manage Access</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => documentApi.download(doc.id, doc.file_name)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(doc.id, doc.title)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Shared With Me Tab */
        sharedDocs.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-slate-900 border border-slate-800">
            <Share2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-white">No documents shared with you</h3>
            <p className="text-xs text-slate-400 mt-1">
              When document owners grant you access, those documents will appear here with instant download capabilities.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sharedDocs.map((doc) => (
              <div
                key={doc.id}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
                      <Share2 className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      Grantee ({doc.permission_level})
                    </span>
                  </div>

                  <h3 className="font-bold text-sm text-white line-clamp-1 mb-1">
                    {doc.title}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-1 mb-3">
                    {doc.file_name}
                  </p>

                  <div className="text-[11px] text-slate-500 space-y-1 font-mono border-t border-slate-800/60 pt-3">
                    <div className="flex justify-between">
                      <span>Shared By:</span>
                      <span className="text-slate-300">{doc.owner_name || doc.owner_email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Size:</span>
                      <span className="text-slate-300">{formatFileSize(doc.file_size)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px]">
                      <span>Shared At:</span>
                      <span>{doc.shared_at ? new Date(doc.shared_at).toLocaleDateString() : 'Active'}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-800/80 pt-3 mt-4">
                  <button
                    onClick={() => documentApi.download(doc.id, doc.file_name)}
                    className="w-full py-2 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-cyan-600/20"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Authorized Document</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Pagination */}
      {activeTab === 'owned' && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-6">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 disabled:opacity-40 transition-colors"
          >
            Previous
          </button>
          <span className="text-xs text-slate-400">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 disabled:opacity-40 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
