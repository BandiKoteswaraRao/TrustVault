import React from 'react';
import { Shield, Lock, FileCheck, RefreshCw, KeyRound, ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react';

interface LandingPageProps {
  onNavigate: (page: string, tab?: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  return (
    <div className="space-y-24 py-12">
      {/* Hero Section */}
      <section className="text-center max-w-4xl mx-auto px-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-8 animate-pulse">
          <Shield className="w-4 h-4" />
          <span>Next-Gen Zero-Trust Document Vault</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-tight mb-6">
          Secure Document Sharing with a <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-vault-500">Real Cryptographic Audit Trail</span>
        </h1>

        <p className="text-lg text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
          Traditional file sharing permits silent data leaks, unauthorized access post-revocation, and easily falsified audit logs. TrustVault provides server-enforced zero-trust access control, isolated storage, and an append-only SHA-256 hash-linked audit chain with mathematical tamper detection.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => onNavigate('auth', 'register')}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-xl shadow-emerald-600/30 hover:scale-105 transition-all flex items-center justify-center gap-2"
          >
            Get Started Now
            <ArrowRight className="w-5 h-5" />
          </button>
          <button
            onClick={() => onNavigate('auth', 'login')}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all flex items-center justify-center gap-2"
          >
            <KeyRound className="w-4 h-4 text-emerald-400" />
            Sign In with Demo Account
          </button>
        </div>
      </section>

      {/* Security Pillars Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl font-bold text-white mb-4">Engineered for Verifiable Security</h2>
          <p className="text-slate-400 text-sm">Every layer operates under zero-trust assumptions. Frontend UI states are strictly cosmetic; all authorization is mathematically enforced on the backend.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all shadow-xl group">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Server-Enforced Zero-Trust</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Every document query and download strictly validates acting user session and explicit ownership or active non-revoked permission rows directly in PostgreSQL. IDOR/BOLA attacks are mathematically blocked.
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all shadow-xl group">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <RefreshCw className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Immediate Access Revocation</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              When an owner revokes access to a shared document, subsequent download attempts by the grantee fail instantly with HTTP 403. There are no stale tokens or cached pre-signed links.
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all shadow-xl group">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <FileCheck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Cryptographic SHA-256 Audit Chain</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Every sensitive action is sealed in an append-only hash chain linking to its predecessor. Any manual alteration, deletion, or reordering breaks the chain and is flagged immediately.
            </p>
          </div>
        </div>
      </section>

      {/* Demo Walkthrough Architecture */}
      <section className="max-w-5xl mx-auto px-4 bg-slate-900/60 border border-slate-800 rounded-3xl p-8 sm:p-12">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">Interactive Evaluation Demo Accounts</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="p-6 rounded-xl bg-slate-850 border border-slate-800">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">A</div>
              <div>
                <h4 className="font-bold text-white">Alice (Document Owner)</h4>
                <p className="text-xs text-slate-400">demo.owner@trustvault.local</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 mb-4">Can upload confidential documents, view SHA-256 checksums, grant access to Bob, and immediately revoke access.</p>
            <div className="text-xs font-mono bg-slate-900 px-3 py-2 rounded text-slate-300 border border-slate-800">
              Password: <span className="text-emerald-400 font-bold">DemoOwner123!</span>
            </div>
          </div>

          <div className="p-6 rounded-xl bg-slate-850 border border-slate-800">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm">B</div>
              <div>
                <h4 className="font-bold text-white">Bob (Recipient)</h4>
                <p className="text-xs text-slate-400">demo.recipient@trustvault.local</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 mb-4">Can view and download only documents explicitly granted to him. Cannot delegate permissions or download after revocation.</p>
            <div className="text-xs font-mono bg-slate-900 px-3 py-2 rounded text-slate-300 border border-slate-800">
              Password: <span className="text-cyan-400 font-bold">DemoRecipient123!</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
