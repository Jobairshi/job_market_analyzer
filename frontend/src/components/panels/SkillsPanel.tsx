'use client';

/**
 * Skill Analysis panel — resume vs job description gap analysis (from /skill-gap page).
 */

import { useState } from 'react';
import { api, AISkillGapResponse } from '@/lib/api';

export default function SkillsPanel() {
  const [resumeText, setResumeText] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AISkillGapResponse | null>(null);

  const handleAnalyze = async () => {
    if (resumeText.length < 10 || jobDesc.length < 10) return;
    setLoading(true); setError(null);
    try { setResult(await api.aiSkillGap(resumeText, jobDesc)); }
    catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Skill Gap Analysis</h1>
        <p className="mt-1 text-sm text-gray-500">
          Compare your resume against a target job to identify missing skills and get a learning path.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">Your Resume</label>
          <textarea value={resumeText} onChange={(e) => setResumeText(e.target.value)} rows={8}
            placeholder="Paste your resume text here..."
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Target Job Description</label>
          <textarea value={jobDesc} onChange={(e) => setJobDesc(e.target.value)} rows={8}
            placeholder="Paste the job description here..."
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
        </div>
      </div>

      <button onClick={handleAnalyze} disabled={loading || resumeText.length < 10 || jobDesc.length < 10}
        className="mt-4 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition">
        {loading ? 'Analyzing...' : 'Analyze Skill Gap'}
      </button>

      {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {result && (
        <div className="mt-8 space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-gray-900">Summary</h2>
            <p className="mt-2 text-sm text-gray-700">{result.summary}</p>
          </div>

          {result.missing_skills?.length > 0 && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-5">
              <h2 className="text-lg font-semibold text-red-800">Missing Skills</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {result.missing_skills.map((s) => (
                  <span key={s} className="rounded-full border border-red-200 bg-white px-3 py-1 text-sm font-medium text-red-700">{s}</span>
                ))}
              </div>
            </div>
          )}

          {result.learning_path?.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="text-lg font-semibold text-gray-900">Recommended Learning Path</h2>
              <div className="mt-4 space-y-2">
                {result.learning_path.map((item, idx) => {
                  const typeColor = item.type === 'course' ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : item.type === 'certification' ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  return (
                    <div key={idx} className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${typeColor}`}>{item.type}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.skill}</p>
                        <p className="text-xs text-gray-500">{item.resource}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
