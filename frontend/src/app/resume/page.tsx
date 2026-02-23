'use client';

import { useCallback, useRef, useState } from 'react';
import { api, MatchedJob, ResumeMatchResponse } from '@/lib/api';

/* ── Page ──────────────────────────────────────────────── */

export default function ResumePage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResumeMatchResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ── File selection helpers ─────────────────────────── */

  const handleFile = useCallback((f: File | undefined) => {
    if (!f) return;
    if (f.type !== 'application/pdf') {
      setError('Only PDF files are accepted.');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum 10 MB.');
      return;
    }
    setError(null);
    setFile(f);
    setResult(null);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFile(e.dataTransfer.files?.[0]);
    },
    [handleFile],
  );

  /* ── Upload ─────────────────────────────────────────── */

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.uploadResume(file);
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Upload failed.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Render ─────────────────────────────────────────── */

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Resume Match</h1>
        <p className="mt-2 text-gray-500">
          Upload your resume (PDF) and we&rsquo;ll find the most relevant jobs using AI-powered vector similarity.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition
          ${dragOver ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'}`}
      >
        <UploadIcon />
        <p className="mt-4 text-sm text-gray-600">
          {file ? (
            <>
              <span className="font-semibold text-indigo-600">{file.name}</span>{' '}
              ({(file.size / 1024).toFixed(0)} KB)
            </>
          ) : (
            <>
              <span className="font-semibold text-indigo-600">Click or drag &amp; drop</span>{' '}
              your resume here
            </>
          )}
        </p>
        <p className="mt-1 text-xs text-gray-400">PDF only &middot; Max 10 MB</p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      {/* Actions */}
      <div className="mt-6 flex items-center gap-4">
        <button
          disabled={!file || loading}
          onClick={handleUpload}
          className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm
                     hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 transition"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Spinner /> Analyzing…
            </span>
          ) : (
            'Find Matching Jobs'
          )}
        </button>

        {file && !loading && (
          <button
            onClick={() => { setFile(null); setResult(null); setError(null); }}
            className="text-sm text-gray-500 hover:text-gray-700 transition"
          >
            Clear
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="mt-10">
          <h2 className="text-xl font-semibold text-gray-900">
            Top {result.total} Matches
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Based on semantic similarity between your resume and job descriptions.
          </p>

          <div className="mt-6 space-y-4">
            {result.matches.map((job, idx) => (
              <MatchCard key={job.id ?? idx} job={job} rank={idx + 1} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Match Card ────────────────────────────────────────── */

function MatchCard({ job, rank }: { job: MatchedJob; rank: number }) {
  const scoreColor =
    job.final_score >= 80
      ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
      : job.final_score >= 60
        ? 'text-amber-600 bg-amber-50 border-amber-200'
        : 'text-gray-600 bg-gray-50 border-gray-200';

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition">
      <div className="flex items-start justify-between gap-4">
        {/* Left */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
              {rank}
            </span>
            <h3 className="truncate text-lg font-semibold text-gray-900">{job.title}</h3>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
            {job.company && (
              <span className="flex items-center gap-1">
                <BuildingIcon /> {job.company}
              </span>
            )}
            {job.location && (
              <span className="flex items-center gap-1">
                <MapPinIcon /> {job.location}
              </span>
            )}
          </div>

          {/* Scores */}
          <div className="mt-3 flex flex-wrap gap-3 text-xs">
            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 font-medium text-indigo-700">
              Semantic: {job.similarity}%
            </span>
            <span className="rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 font-medium text-purple-700">
              Skill Overlap: {job.skill_overlap}%
            </span>
          </div>

          {/* Matched skills */}
          {job.matched_skills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {job.matched_skills.map((s) => (
                <span
                  key={s}
                  className="rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 border border-green-200"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right — Final score */}
        <div className={`flex flex-col items-center rounded-xl border px-4 py-3 ${scoreColor}`}>
          <span className="text-2xl font-bold">{job.final_score}%</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider">Match</span>
        </div>
      </div>

      {/* View Job link */}
      {job.link && (
        <a
          href={job.link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition"
        >
          View Job &rarr;
        </a>
      )}
    </div>
  );
}

/* ── Tiny Icons ────────────────────────────────────────── */

function UploadIcon() {
  return (
    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L8 8m4-4l4 4M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );
}
