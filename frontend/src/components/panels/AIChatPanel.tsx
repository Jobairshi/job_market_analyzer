'use client';

/**
 * AI Chat panel — RAG-powered Q&A (from /ai page).
 */

import { useState, useRef, useEffect } from 'react';
import { api, AIQueryResponse } from '@/lib/api';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  data?: AIQueryResponse;
}

export default function AIChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async () => {
    const query = input.trim();
    if (!query || loading) return;

    const userMsg: Message = { id: nextId.current++, role: 'user', content: query };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const data = await api.aiQuery(query);
      setMessages((prev) => [...prev, { id: nextId.current++, role: 'assistant', content: data.summary, data }]);
    } catch (err: any) {
      setMessages((prev) => [...prev, { id: nextId.current++, role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col p-4 sm:p-6">
      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            <div className="text-center">
              <p className="text-3xl">&#x1F4A1;</p>
              <p className="mt-3 font-medium text-gray-500">Ask anything about the job market</p>
              <div className="mt-4 space-y-2">
                {[
                  'What backend skills are trending?',
                  'Which companies are hiring AI engineers?',
                  'Is remote demand increasing?',
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-gray-600 hover:border-indigo-300 hover:bg-indigo-50 transition"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
              msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-800'
            }`}>
              <p>{msg.content}</p>
              {msg.data && (
                <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                  {msg.data.top_skills?.length > 0 && (
                    <div>
                      <span className="text-xs font-semibold text-gray-500">Top Skills:</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {msg.data.top_skills.map((s) => (
                          <span key={s} className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700 border border-indigo-200">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {msg.data.top_companies?.length > 0 && (
                    <div>
                      <span className="text-xs font-semibold text-gray-500">Top Companies:</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {msg.data.top_companies.map((c) => (
                          <span key={c} className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 border border-emerald-200">{c}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {msg.data.insight && (
                    <div>
                      <span className="text-xs font-semibold text-gray-500">Insight:</span>
                      <p className="mt-1 text-xs text-gray-600">{msg.data.insight}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-white border border-gray-200 px-4 py-3">
              <div className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
                <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
                <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask about the job market..."
          className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          disabled={loading}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading}
          className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          Send
        </button>
      </div>
    </div>
  );
}
