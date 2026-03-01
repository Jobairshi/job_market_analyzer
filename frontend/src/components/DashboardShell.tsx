'use client';

import { useState, ReactNode, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import Link from 'next/link';

/* ── Section definitions ──────────────────────────────── */

export interface Section {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: number;
}

export const SECTIONS: Section[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v-5.5a.75.75 0 011.5 0v5.5m0 0h-3m3 0h3" />
      </svg>
    ),
  },
  {
    id: 'jobs',
    label: 'Jobs',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.073a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V14.15m16.5 0a1.5 1.5 0 00.348-.848l-1.323-5.953A1.5 1.5 0 0017.795 6H6.205a1.5 1.5 0 00-1.48 1.349L3.403 13.3a1.5 1.5 0 00.347.849m16.5 0H3.75m7.5-6.75V3.375c0-.621.504-1.125 1.125-1.125h.75c.621 0 1.125.504 1.125 1.125V7.4" />
      </svg>
    ),
  },
  {
    id: 'ai-chat',
    label: 'AI Chat',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715l-.75 2.625-.75-2.625a3.375 3.375 0 00-2.318-2.318L11.816 5.25l2.625-.75a3.375 3.375 0 002.318-2.318L17.509 0l.75 2.182a3.375 3.375 0 002.318 2.318l2.625.75-2.625.75a3.375 3.375 0 00-2.318 2.715z" />
      </svg>
    ),
  },
  {
    id: 'resume',
    label: 'Resume Match',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    id: 'recommend',
    label: 'For You',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    ),
  },
  {
    id: 'skills',
    label: 'Skill Analysis',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
      </svg>
    ),
  },
  {
    id: 'insights',
    label: 'Market Intel',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
      </svg>
    ),
  },
  {
    id: 'map',
    label: 'Map',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.92 17.92 0 01-8.716-4.247m0 0A8.966 8.966 0 013 12c0-1.777.514-3.433 1.4-4.83" />
      </svg>
    ),
  },
];

/* ── Animated active indicator (tracks highlighted item) ── */

function ActiveIndicator({ top, collapsed }: { top: number; collapsed: boolean }) {
  return (
    <div
      className="absolute left-0 z-0 transition-all duration-300 ease-smooth pointer-events-none"
      style={{ top, height: 44 }}
    >
      {/* Colored bar on the left edge */}
      <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-brand-500 shadow-glow" />
      {/* Background highlight */}
      <div
        className={`absolute inset-0 rounded-xl bg-brand-500/[0.08] dark:bg-brand-400/[0.12] transition-all duration-300 ${
          collapsed ? 'left-1 right-1' : 'left-2 right-2'
        }`}
      />
    </div>
  );
}

/* ── Dark mode toggle button ──────────────────────────── */

function ThemeToggle() {
  const { isDark, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      className="relative flex h-8 w-[60px] items-center rounded-full p-0.5 transition-colors duration-300
        bg-gray-200 dark:bg-surface-800"
      aria-label="Toggle dark mode"
    >
      {/* Sliding knob */}
      <div
        className={`flex h-7 w-7 items-center justify-center rounded-full shadow-md transition-all duration-300 ease-smooth
          ${isDark ? 'translate-x-[28px] bg-surface-900' : 'translate-x-0 bg-white'}`}
      >
        {isDark ? (
          <svg className="h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
          </svg>
        ) : (
          <svg className="h-4 w-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
          </svg>
        )}
      </div>
    </button>
  );
}

/* ── Shell component ──────────────────────────────────── */

interface Props {
  activeSection: string;
  onSectionChange: (id: string) => void;
  children: ReactNode;
}

export default function DashboardShell({ activeSection, onSectionChange, children }: Props) {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  /* Track position of the active indicator */
  const navRef = useRef<HTMLElement>(null);
  const [indicatorTop, setIndicatorTop] = useState(0);

  useEffect(() => {
    if (!navRef.current) return;
    const activeIdx = SECTIONS.findIndex((s) => s.id === activeSection);
    if (activeIdx === -1) return;
    const btn = navRef.current.children[activeIdx] as HTMLElement | undefined;
    if (btn) {
      setIndicatorTop(btn.offsetTop);
    }
  }, [activeSection, collapsed]);

  return (
    <div className="flex h-screen overflow-hidden bg-surface-50 dark:bg-surface-950 transition-colors duration-300">
      {/* ── Mobile overlay ─────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden transition-opacity duration-300"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ────────────────────────────────────── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col
          bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl
          border-r border-gray-200/60 dark:border-white/[0.06]
          shadow-[1px_0_30px_-10px_rgba(0,0,0,0.08)] dark:shadow-[1px_0_30px_-10px_rgba(0,0,0,0.3)]
          transition-all duration-300 ease-smooth
          lg:static lg:z-auto
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${collapsed ? 'w-[72px]' : 'w-[260px]'}
        `}
      >
        {/* Logo area */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-gray-100/80 dark:border-white/[0.04]">
          {!collapsed && (
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow transition-shadow group-hover:shadow-glow-lg">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12" />
                </svg>
              </div>
              <span className="text-base font-bold bg-gradient-to-r from-brand-600 to-brand-500 dark:from-brand-400 dark:to-brand-300 bg-clip-text text-transparent">
                AI Jobs
              </span>
            </Link>
          )}
          {collapsed && (
            <Link href="/" className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12" />
              </svg>
            </Link>
          )}
          <button
            onClick={() => { setCollapsed((c) => !c); setMobileOpen(false); }}
            className="hidden lg:flex items-center justify-center rounded-lg p-1.5
              text-gray-400 hover:text-gray-600 hover:bg-gray-100/80
              dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-white/[0.06]
              transition-all duration-200"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg className={`h-4 w-4 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
        </div>

        {/* Nav items with animated indicator */}
        <nav ref={navRef} className="relative flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          <ActiveIndicator top={indicatorTop} collapsed={collapsed} />

          {SECTIONS.map((section) => {
            const active = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => { onSectionChange(section.id); setMobileOpen(false); }}
                title={collapsed ? section.label : undefined}
                className={`
                  relative z-10 group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium
                  transition-all duration-200
                  ${active
                    ? 'text-brand-700 dark:text-brand-300'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100/60 dark:hover:bg-white/[0.04]'
                  }
                  ${collapsed ? 'justify-center' : ''}
                `}
              >
                <span className={`flex-shrink-0 transition-colors duration-200
                  ${active ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'}
                `}>
                  {section.icon}
                </span>
                {!collapsed && (
                  <span className="truncate transition-opacity duration-200">{section.label}</span>
                )}
                {!collapsed && section.badge != null && section.badge > 0 && (
                  <span className="ml-auto inline-flex items-center rounded-full bg-brand-100 dark:bg-brand-900/40 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:text-brand-300">
                    {section.badge}
                  </span>
                )}

                {/* Tooltip for collapsed state */}
                {collapsed && (
                  <div className="absolute left-full ml-2 hidden group-hover:flex items-center z-[100]">
                    <div className="rounded-lg bg-surface-900 dark:bg-surface-800 px-3 py-1.5 text-xs font-medium text-white shadow-lg whitespace-nowrap">
                      {section.label}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom controls: theme toggle + user */}
        <div className="border-t border-gray-100/80 dark:border-white/[0.04] p-3 space-y-3">
          {/* Dark mode toggle */}
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
            {!collapsed && (
              <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Theme</span>
            )}
            <ThemeToggle />
          </div>

          {/* User area */}
          {user ? (
            <div className={`flex items-center gap-3 rounded-xl p-2
              bg-gray-50/80 dark:bg-white/[0.03]
              ${collapsed ? 'justify-center' : ''}`}>
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg
                bg-gradient-to-br from-brand-500 to-brand-600 text-xs font-bold text-white shadow-sm">
                {user.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{user.name}</p>
                  <button
                    onClick={logout}
                    className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors duration-200"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className={`flex gap-2 ${collapsed ? 'flex-col items-center' : ''}`}>
              <Link
                href="/login"
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400
                  hover:bg-gray-100/80 dark:hover:bg-white/[0.06] transition-colors duration-200"
              >
                {collapsed ? '→' : 'Log in'}
              </Link>
              {!collapsed && (
                <Link
                  href="/register"
                  className="rounded-lg bg-gradient-to-r from-brand-600 to-brand-500 px-3 py-1.5 text-xs font-medium text-white
                    shadow-sm hover:shadow-glow transition-all duration-200"
                >
                  Sign up
                </Link>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="flex h-14 items-center gap-3 border-b border-gray-200/60 dark:border-white/[0.06]
          bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl px-4 lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-white/[0.06] transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {SECTIONS.find((s) => s.id === activeSection)?.label ?? 'Dashboard'}
          </span>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto bg-surface-50/50 dark:bg-surface-950/50">
          {children}
        </main>
      </div>
    </div>
  );
}
