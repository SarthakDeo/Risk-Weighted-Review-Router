import React, { useState } from 'react';
import { Plus, Trash2, Zap } from 'lucide-react';
import type { ScoreResponse } from '../types';
import { scorePR } from '../api';

interface Props {
  onResult: (prId: string, result: ScoreResponse) => void;
}

export function ScoreForm({ onResult }: Props) {
  const [prId, setPrId] = useState('');
  const [files, setFiles] = useState(['']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFile = () => setFiles((f) => [...f, '']);
  const removeFile = (i: number) => setFiles((f) => f.filter((_, idx) => idx !== i));
  const updateFile = (i: number, val: string) =>
    setFiles((f) => f.map((v, idx) => (idx === i ? val : v)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanFiles = files.map((f) => f.trim()).filter(Boolean);
    if (!prId.trim()) { setError('PR ID is required.'); return; }
    if (cleanFiles.length === 0) { setError('At least one file path is required.'); return; }

    setLoading(true);
    try {
      const result = await scorePR({ pr_id: prId.trim(), changed_files: cleanFiles });
      onResult(prId.trim(), result);
    } catch (err: any) {
      setError(err.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="score-form card" onSubmit={handleSubmit}>
      <h2 className="form-title">Score a Pull Request</h2>

      <div className="field">
        <label>PR ID</label>
        <input
          className="input"
          placeholder="e.g. PR-123"
          value={prId}
          onChange={(e) => setPrId(e.target.value)}
        />
      </div>

      <div className="field">
        <label>Changed Files</label>
        <div className="file-list">
          {files.map((f, i) => (
            <div key={i} className="file-row">
              <input
                className="input"
                placeholder="e.g. services/payments/charge.go"
                value={f}
                onChange={(e) => updateFile(i, e.target.value)}
              />
              {files.length > 1 && (
                <button type="button" className="icon-btn danger" onClick={() => removeFile(i)}>
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button type="button" className="add-btn" onClick={addFile}>
          <Plus size={14} /> Add file
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      <button className="submit-btn" type="submit" disabled={loading}>
        {loading ? (
          <span className="spinner" />
        ) : (
          <>
            <Zap size={15} /> Analyse Risk
          </>
        )}
      </button>
    </form>
  );
}
