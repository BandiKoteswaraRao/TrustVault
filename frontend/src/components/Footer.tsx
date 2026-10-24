import React from 'react';
import { Shield, Lock, FileCheck, ExternalLink } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-800 bg-slate-900/60 py-10 mt-auto text-slate-400 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <div className="flex items-center space-x-2 text-white font-bold mb-3">
              <Shield className="w-5 h-5 text-emerald-400" />
              <span>TrustVault Core</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Enterprise digital document sharing with strict server-enforced zero-trust access control, immediate revocation, and a SHA-256 cryptographically chained audit trail.
            </p>
          </div>

          <div>
            <h4 className="text-white font-semibold text-xs uppercase tracking-wider mb-3">Security Architecture</h4>
            <ul className="text-xs space-y-2 text-slate-400">
              <li className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                Zero-Trust Server Authorization (OWASP SEC-01)
              </li>
              <li className="flex items-center gap-2">
                <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
                Append-Only SHA-256 Hash Chain
              </li>
              <li className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                Immediate Permission Revocation
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold text-xs uppercase tracking-wider mb-3">Compliance & Integrity</h4>
            <p className="text-xs text-slate-400 leading-relaxed mb-3">
              Every sensitive action is sealed with canonical hashing. External HMAC anchoring guarantees chain head integrity against silent historical database alteration.
            </p>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700 text-xs text-emerald-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Audit Engine Active
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800/80 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500">
          <p>© 2026 TrustVault Systems. All rights reserved.</p>
          <p className="mt-2 sm:mt-0 font-mono">v1.0.0 (Production Verified)</p>
        </div>
      </div>
    </footer>
  );
};
