import React, { useEffect, useState } from 'react';
import { auditApi, AuditEventItem, AuditVerificationReport } from '../services/api';
import { 
  ShieldCheck, 
  AlertTriangle, 
  RefreshCw, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  Key, 
  Clock, 
  Database, 
  Hash, 
  CheckCircle2, 
  XCircle 
} from 'lucide-react';

export const AuditPage: React.FC = () => {
  const [events, setEvents] = useState<AuditEventItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Verification State
  const [verification, setVerification] = useState<AuditVerificationReport | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    loadAuditLogs();
  }, [page, actionFilter, outcomeFilter]);

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const res = await auditApi.getLogs({
        action: actionFilter || undefined,
        outcome: outcomeFilter || undefined,
        page,
        limit: 25
      });
      setEvents(res.events);
      setTotal(res.total);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await auditApi.verifyTrail();
      setVerification(res);
      // Reload logs because verification creates an AUDIT_VERIFY event
      loadAuditLogs();
    } catch (err: any) {
      alert(err.message || 'Verification execution failed.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Hash className="w-6 h-6 text-emerald-400" />
            Append-Only Audit Trail
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Every critical action is sealed in an append-only SHA-256 hash-linked chain
          </p>
        </div>

        <button
          onClick={handleVerify}
          disabled={verifying}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-vault-500 hover:from-emerald-500 hover:to-vault-600 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2 self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${verifying ? 'animate-spin' : ''}`} />
          <span>{verifying ? 'Recomputing Hashes...' : 'Verify Cryptographic Integrity'}</span>
        </button>
      </div>

      {/* Verification Results Banner */}
      {verification && (
        <div className={`p-6 rounded-3xl border shadow-xl transition-all ${
          verification.isValid
            ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
            : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
        }`}>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              {verification.isValid ? (
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
              )}
              <div>
                <h3 className="font-bold text-base text-white">
                  {verification.isValid
                    ? 'Audit Trail Fully Intact & Cryptographically Verified'
                    : 'Cryptographic Tampering or Corruption Detected!'}
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">{verification.message}</p>
              </div>
            </div>

            <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
              Verified: {new Date(verification.verifiedAt).toLocaleTimeString()}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-800/60 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Total Events Chained:</span>
              <span className="font-bold font-mono text-white">{verification.totalEvents}</span>
            </div>
            {verification.hmacSignature && (
              <div className="sm:col-span-2">
                <span className="text-slate-400 block text-[11px]">Chain Head HMAC Anchor:</span>
                <span className="font-mono text-emerald-400 text-[11px] break-all">{verification.hmacSignature}</span>
              </div>
            )}
            {!verification.isValid && verification.tamperedEventId && (
              <div className="sm:col-span-2 text-rose-400">
                <span className="text-rose-400 block text-[11px] font-bold">First Point of Corruption:</span>
                <span className="font-mono text-[11px]">
                  Seq #{verification.tamperedSequenceNumber} • Event ID: {verification.tamperedEventId}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
          <Filter className="w-4 h-4 text-emerald-400" />
          <span>Filters:</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-950 border border-slate-800 rounded-xl py-1.5 px-3 text-xs text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Actions</option>
            <option value="AUTH_REGISTER_SUCCESS">AUTH_REGISTER_SUCCESS</option>
            <option value="AUTH_LOGIN_SUCCESS">AUTH_LOGIN_SUCCESS</option>
            <option value="AUTH_LOGIN_FAILURE">AUTH_LOGIN_FAILURE</option>
            <option value="DOCUMENT_UPLOAD">DOCUMENT_UPLOAD</option>
            <option value="DOCUMENT_DOWNLOAD">DOCUMENT_DOWNLOAD</option>
            <option value="DOCUMENT_DELETE">DOCUMENT_DELETE</option>
            <option value="PERMISSION_GRANT">PERMISSION_GRANT</option>
            <option value="PERMISSION_REVOKE">PERMISSION_REVOKE</option>
            <option value="AUDIT_VERIFY">AUDIT_VERIFY</option>
          </select>

          <select
            value={outcomeFilter}
            onChange={(e) => {
              setOutcomeFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-950 border border-slate-800 rounded-xl py-1.5 px-3 text-xs text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Outcomes</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILURE">FAILURE</option>
            <option value="DENIED">DENIED</option>
          </select>

          {(actionFilter || outcomeFilter) && (
            <button
              onClick={() => {
                setActionFilter('');
                setOutcomeFilter('');
                setPage(1);
              }}
              className="text-xs text-slate-400 hover:text-white underline"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Events Table */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-3 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs text-slate-400">Loading audit records...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-slate-900 border border-slate-800">
          <Database className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-white">No audit records found</h3>
          <p className="text-xs text-slate-400 mt-1">Try resetting filter criteria.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900 shadow-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-850 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Seq</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Target Type</th>
                <th className="py-3 px-4">Outcome</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {events.map((ev) => (
                <React.Fragment key={ev.id}>
                  <tr className="hover:bg-slate-850/50 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-400">#{ev.sequence_number}</td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                      {ev.action}
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                      {ev.actor_email || 'System'}
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{ev.target_type}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
                        ev.outcome === 'SUCCESS'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        {ev.outcome}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {new Date(ev.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setExpandedRow(expandedRow === ev.id ? null : ev.id)}
                        className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                        title="Inspect Cryptographic Chain Links"
                      >
                        {expandedRow === ev.id ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                  </tr>

                  {/* Expanded Row Showing SHA-256 Hash Chain Links */}
                  {expandedRow === ev.id && (
                    <tr className="bg-slate-950/80 border-b border-slate-800">
                      <td colSpan={7} className="p-4 space-y-3 font-mono text-xs">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                            <span className="text-[10px] text-slate-500 uppercase block mb-1">
                              Previous Event Hash (prev_hash):
                            </span>
                            <span className="text-slate-400 text-[11px] break-all">
                              {ev.prev_hash}
                            </span>
                          </div>

                          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                            <span className="text-[10px] text-slate-500 uppercase block mb-1">
                              Current Sealed Digest (current_hash):
                            </span>
                            <span className="text-emerald-400 text-[11px] break-all font-bold">
                              {ev.current_hash}
                            </span>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px]">
                          <span className="text-[10px] text-slate-500 uppercase block mb-1">
                            Sanitized Event Metadata:
                          </span>
                          <pre className="text-slate-300 overflow-x-auto">
                            {JSON.stringify(typeof ev.metadata === 'string' ? JSON.parse(ev.metadata) : ev.metadata, null, 2)}
                          </pre>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-slate-400">
            Page {page} of {totalPages} ({total} events)
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
