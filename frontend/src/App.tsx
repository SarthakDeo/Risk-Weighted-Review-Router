import { useState } from 'react';
import { Shield } from 'lucide-react';
import { ScoreForm } from './components/ScoreForm';
import { ResultCard } from './components/ResultCard';
import { Dashboard } from './components/Dashboard';
import { HealthBadge } from './components/HealthBadge';
import type { HistoryEntry, ScoreResponse } from './types';
import './App.css';

type Tab = 'scorer' | 'dashboard' | 'history';

export default function App() {
  const [tab, setTab] = useState<Tab>('scorer');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [latest, setLatest] = useState<HistoryEntry | null>(null);

  const handleResult = (prId: string, result: ScoreResponse) => {
    const entry: HistoryEntry = { pr_id: prId, timestamp: new Date().toISOString(), result };
    setLatest(entry);
    setHistory((h) => [entry, ...h]);
    setTab('scorer');
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="brand">
            <Shield size={22} />
            <span className="brand-name">Risk Router</span>
            <span className="brand-sub">PR Risk Analyser</span>
          </div>
          <HealthBadge />
        </div>
        <nav className="nav">
          {(['scorer', 'dashboard', 'history'] as Tab[]).map((t) => (
            <button
              key={t}
              className={`nav-tab ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {t === 'history' && history.length > 0 && (
                <span className="nav-count">{history.length}</span>
              )}
            </button>
          ))}
        </nav>
      </header>

      <main className="main">
        {tab === 'scorer' && (
          <div className="scorer-layout">
            <ScoreForm onResult={handleResult} />
            {latest && (
              <div className="latest-result">
                <h3 className="section-title">Latest Result</h3>
                <ResultCard prId={latest.pr_id} result={latest.result} />
              </div>
            )}
          </div>
        )}

        {tab === 'dashboard' && <Dashboard history={history} />}

        {tab === 'history' && (
          <div className="history-panel">
            <h2 className="section-title">Scoring History</h2>
            {history.length === 0 ? (
              <div className="card empty-state">No PRs scored yet.</div>
            ) : (
              <div className="history-list">
                {history.map((entry, i) => (
                  <div key={i} className="history-item">
                    <div className="history-meta">
                      <span className="mono">{entry.pr_id}</span>
                      <span className="muted">{new Date(entry.timestamp).toLocaleString()}</span>
                    </div>
                    <ResultCard prId={entry.pr_id} result={entry.result} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
