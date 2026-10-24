import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { UploadPage } from './pages/UploadPage';
import { DocumentDetailsPage } from './pages/DocumentDetailsPage';
import { AuditPage } from './pages/AuditPage';
import { ProfilePage } from './pages/ProfilePage';
import { NotFoundPage } from './pages/NotFoundPage';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<string>('landing');
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  const handleNavigate = (page: string, param?: string) => {
    if (page === 'auth') {
      setAuthMode((param as 'login' | 'register') || 'login');
      setCurrentPage('auth');
    } else if (page === 'document-details' && param) {
      setActiveDocId(param);
      setCurrentPage('document-details');
    } else {
      setActiveDocId(null);
      setCurrentPage(page);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // If loading session
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-3 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
        <p className="text-xs font-mono text-emerald-400">Initializing TrustVault Core...</p>
      </div>
    );
  }

  // Routing render helper
  const renderCurrentPage = () => {
    // Unauthenticated landing & auth
    if (!user) {
      if (currentPage === 'auth') {
        return (
          <AuthPage
            initialMode={authMode}
            onSuccess={() => setCurrentPage('dashboard')}
          />
        );
      }
      return <LandingPage onNavigate={handleNavigate} />;
    }

    // Authenticated routes
    switch (currentPage) {
      case 'landing':
        return <LandingPage onNavigate={handleNavigate} />;
      case 'dashboard':
        return <DashboardPage onNavigate={handleNavigate} />;
      case 'documents':
        return <DocumentsPage onNavigate={handleNavigate} />;
      case 'upload':
        return <UploadPage onNavigate={handleNavigate} />;
      case 'document-details':
        return activeDocId ? (
          <DocumentDetailsPage documentId={activeDocId} onNavigate={handleNavigate} />
        ) : (
          <DocumentsPage onNavigate={handleNavigate} />
        );
      case 'audit':
        return <AuditPage />;
      case 'profile':
        return <ProfilePage onNavigate={handleNavigate} />;
      default:
        return <NotFoundPage onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Navbar currentPage={currentPage} onNavigate={handleNavigate} />
      <main className="flex-1">
        {renderCurrentPage()}
      </main>
      <Footer />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
