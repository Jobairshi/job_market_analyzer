'use client';

/**
 * Unified Dashboard — command-center layout with sidebar navigation.
 * All features accessible from one place. Smooth panel transitions.
 */

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import DashboardShell from '@/components/DashboardShell';

/* ── Lazy-load panels for code splitting ──────────────── */

const OverviewPanel  = dynamic(() => import('@/components/panels/OverviewPanel'),  { ssr: false, loading: () => <PanelLoader /> });
const JobsPanel      = dynamic(() => import('@/components/panels/JobsPanel'),      { ssr: false, loading: () => <PanelLoader /> });
const AIChatPanel    = dynamic(() => import('@/components/panels/AIChatPanel'),    { ssr: false, loading: () => <PanelLoader /> });
const ResumePanel    = dynamic(() => import('@/components/panels/ResumePanel'),    { ssr: false, loading: () => <PanelLoader /> });
const RecommendPanel = dynamic(() => import('@/components/panels/RecommendPanel'), { ssr: false, loading: () => <PanelLoader /> });
const SkillsPanel    = dynamic(() => import('@/components/panels/SkillsPanel'),    { ssr: false, loading: () => <PanelLoader /> });
const InsightsPanel  = dynamic(() => import('@/components/panels/InsightsPanel'),  { ssr: false, loading: () => <PanelLoader /> });
const MapPanel       = dynamic(() => import('@/components/panels/MapPanel'),       { ssr: false, loading: () => <PanelLoader /> });

/* ── Panel map ────────────────────────────────────────── */

const PANEL_MAP: Record<string, React.ComponentType> = {
  overview:  OverviewPanel,
  jobs:      JobsPanel,
  'ai-chat': AIChatPanel,
  resume:    ResumePanel,
  recommend: RecommendPanel,
  skills:    SkillsPanel,
  insights:  InsightsPanel,
  map:       MapPanel,
};

/* Full-height panels (they manage their own height) */
const FULL_HEIGHT_PANELS = new Set(['ai-chat', 'map']);

/* ── Page ─────────────────────────────────────────────── */

export default function DashboardPage() {
  const [active, setActive] = useState('overview');
  const [transitionKey, setTransitionKey] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  /* Persist active tab in URL hash for shareable links */
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && PANEL_MAP[hash]) setActive(hash);
  }, []);

  const handleChange = (id: string) => {
    if (id === active) return;
    setActive(id);
    setTransitionKey((k) => k + 1);
    window.history.replaceState(null, '', `#${id}`);
  };

  const Panel = PANEL_MAP[active] ?? OverviewPanel;
  const isFullHeight = FULL_HEIGHT_PANELS.has(active);

  return (
    <DashboardShell activeSection={active} onSectionChange={handleChange}>
      <div
        key={transitionKey}
        ref={panelRef}
        className={`panel-enter ${isFullHeight ? 'h-full' : 'p-1'}`}
      >
        <Panel />
      </div>
    </DashboardShell>
  );
}

/* ── Loading placeholder ──────────────────────────────── */

function PanelLoader() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="relative">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-brand-500/30 border-t-brand-500" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-3 w-3 rounded-full bg-brand-500/60 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
