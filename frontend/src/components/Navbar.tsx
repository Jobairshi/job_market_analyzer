'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="text-xl font-bold text-indigo-600">
          AI&nbsp;Jobs
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-4 text-sm font-medium">
          <Link
            href="/dashboard"
            className="rounded-lg bg-indigo-50 px-4 py-2 text-indigo-700 hover:bg-indigo-100 transition font-semibold"
          >
            Open Dashboard
          </Link>

          {user ? (
            <>
              <span className="hidden sm:inline text-gray-500">
                {user.name}
                {user.role === 'admin' && (
                  <span className="ml-1 rounded bg-indigo-100 px-1.5 py-0.5 text-xs text-indigo-700">
                    admin
                  </span>
                )}
              </span>
              <button
                onClick={logout}
                className="rounded-md bg-gray-100 px-3 py-1.5 text-gray-700 hover:bg-gray-200 transition"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-gray-600 hover:text-indigo-600 transition"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-indigo-600 px-4 py-1.5 text-white hover:bg-indigo-700 transition"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
