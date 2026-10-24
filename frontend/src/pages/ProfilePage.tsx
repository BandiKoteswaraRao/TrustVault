import React from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Shield, Key, Lock, CheckCircle2, LogOut } from 'lucide-react';

interface ProfilePageProps {
  onNavigate: (page: string) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onNavigate }) => {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Account & Security Profile</h1>
        <p className="text-xs text-slate-400 mt-1">Authenticated session identity and cryptographic settings</p>
      </div>

      {/* Profile Card */}
      <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-vault-500 text-white flex items-center justify-center font-bold text-2xl shadow-xl shadow-emerald-500/20">
            {user.fullName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{user.fullName}</h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{user.email}</p>
            <span className="inline-block mt-2 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase">
              Role: {user.role}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 border-t border-slate-800 text-xs">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-slate-500 block text-[11px] mb-1">User Identifier (UUID):</span>
            <span className="font-mono text-slate-300 text-[11px] break-all">{user.id}</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-slate-500 block text-[11px] mb-1">Password Protection:</span>
            <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              Bcrypt Hash (Work Factor 12)
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-850 border border-slate-800 space-y-3">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            Security & Zero-Trust Guarantees
          </h3>
          <ul className="text-xs text-slate-400 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 font-bold">•</span>
              <span>All authentication tokens are short-lived JSON Web Tokens signed with high-entropy cryptographic keys.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 font-bold">•</span>
              <span>Every document operation is audited with SHA-256 canonical hashing tied to your user identifier.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 font-bold">•</span>
              <span>Permission revocations take effect immediately on backend download requests.</span>
            </li>
          </ul>
        </div>

        <div className="pt-4 flex justify-end">
          <button
            onClick={async () => {
              await logout();
              onNavigate('landing');
            }}
            className="px-4 py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 text-xs font-bold transition-all flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Terminate Active Session</span>
          </button>
        </div>
      </div>
    </div>
  );
};
