import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../../lib/api';
import {
  sendDiagnosticMessage, startDiagnostic,
  type DiagnosticSession, type Severity,
} from '../../lib/diagnostics';
import { VEHICLE_TYPE_LABELS, type VehicleType } from '../../lib/mechanic';
import { cn } from '../../lib/utils';

const FIELD =
  'w-full glass-card px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-all';
const LABEL = 'text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500';
const VEHICLE_ICONS: Record<VehicleType, string> = { BIKE: '🛵', CAR: '🚗' };

const SEVERITY_TONE: Record<Severity, string> = {
  LOW: 'bg-white/5 border-white/15 text-zinc-300',
  MEDIUM: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
  HIGH: 'bg-red-500/10 border-red-500/30 text-red-300',
};

export default function Troubleshoot() {
  const navigate = useNavigate();
  const [vehicleType, setVehicleType] = useState<VehicleType | null>(null);
  const [problem, setProblem] = useState('');
  const [answer, setAnswer] = useState('');
  const [session, setSession] = useState<DiagnosticSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Progressive enhancement: not implemented in every environment (e.g. jsdom).
    endRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [session?.messages.length]);

  const begin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!vehicleType) return;
    setBusy(true);
    setError('');
    try {
      setSession(await startDiagnostic(vehicleType, problem));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start the diagnostic.');
    } finally {
      setBusy(false);
    }
  };

  const reply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!session || !answer.trim()) return;
    setBusy(true);
    setError('');
    try {
      setSession(await sendDiagnosticMessage(session.id, answer));
      setAnswer('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send that answer.');
    } finally {
      setBusy(false);
    }
  };

  const result = session?.result;
  const hasCauses = !!result?.possible_causes.length;

  /* --------------------------------------------------------------- setup */

  if (!session) {
    return (
      <div data-testid="troubleshoot"
        className="relative overflow-hidden glass-panel p-8">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-3 block">
          AI vehicle troubleshooter
        </span>
        <h2 className="text-2xl font-semibold text-white tracking-tight">
          Let&apos;s work out what&apos;s wrong
        </h2>
        <p className="text-zinc-400 text-sm mt-1 mb-8">
          A few questions to narrow it down before a mechanic arrives. Advice only — it
          never replaces a proper inspection.
        </p>

        {error && (
          <div data-testid="diagnostic-error" role="alert"
            className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={begin} className="space-y-6">
          <div className="space-y-3">
            <span className={LABEL}>Vehicle type</span>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              {(['BIKE', 'CAR'] as VehicleType[]).map((type) => (
                <button key={type} type="button" onClick={() => setVehicleType(type)}
                  aria-pressed={vehicleType === type} data-testid={`vehicle-${type}`}
                  className={`h-20 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-colors ${
                    vehicleType === type
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                      : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'
                  }`}>
                  <span className="text-2xl">{VEHICLE_ICONS[type]}</span>
                  <span className="text-sm font-medium">{VEHICLE_TYPE_LABELS[type]}</span>
                </button>
              ))}
            </div>
          </div>

          {vehicleType && (
            <div className="space-y-3" data-testid="problem-step">
              <span className={LABEL}>What&apos;s happening?</span>
              <textarea rows={4} value={problem} minLength={5} required
                onChange={(e) => setProblem(e.target.value)} data-testid="problem-input"
                placeholder="My bike won't start this morning…" className={FIELD} />
            </div>
          )}

          {vehicleType && (
            <button type="submit" disabled={busy || problem.trim().length < 5}
              data-testid="start-diagnostic"
              className="h-12 px-8 rounded-2xl bg-emerald-500 text-zinc-950 font-semibold disabled:opacity-40">
              {busy ? 'Thinking…' : 'Start troubleshooting'}
            </button>
          )}
        </form>
      </div>
    );
  }

  /* --------------------------------------------------------- conversation */

  return (
    <div data-testid="troubleshoot" className="space-y-6">
      <div className="relative overflow-hidden glass-panel">
        <header className="px-8 pt-8 pb-4 border-b border-white/5">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">
            AI vehicle troubleshooter
          </span>
          <div className="flex items-center gap-3 mt-2">
            <h2 className="text-xl font-semibold text-white tracking-tight">
              {VEHICLE_ICONS[session.vehicle_type]} {VEHICLE_TYPE_LABELS[session.vehicle_type]}
            </h2>
          </div>
        </header>

        <div data-testid="conversation" className="px-8 py-6 space-y-4 max-h-[46vh] overflow-y-auto">
          {session.messages.map((m) => (
            <div key={m.id} data-testid={`msg-${m.role}`}
              className={m.role === 'USER' ? 'flex justify-end' : 'flex justify-start'}>
              <div className={cn(
                  'rounded-2xl px-5 py-3.5 max-w-[85%] text-[15px] leading-relaxed',
                  m.role === 'USER'
                  ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-50'
                  : 'glass-base bg-white/[0.04] border border-white/10 text-zinc-200 backdrop-blur-md'
                )}>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] mb-1 opacity-50">
                  {m.role === 'USER' ? 'You' : 'Wrench AI'}
                </p>
                {m.content}
              </div>
            </div>
          ))}
          {busy && (
            <p data-testid="diagnostic-thinking" className="text-zinc-500 text-sm">
              Wrench AI is thinking…
            </p>
          )}
          <div ref={endRef} />
        </div>

        {!!result?.follow_up_questions.length && (
          <div data-testid="follow-ups" className="px-8 pb-4 flex flex-wrap gap-2">
            {result.follow_up_questions.map((q) => (
              <span key={q} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-zinc-400">
                {q}
              </span>
            ))}
          </div>
        )}

        {error && (
          <div data-testid="diagnostic-error" role="alert"
            className="mx-8 mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={reply} className="px-8 pb-8 pt-2 flex gap-3 border-t border-white/5">
          <input value={answer} onChange={(e) => setAnswer(e.target.value)}
            data-testid="answer-input" placeholder="Type your answer…"
            className={FIELD} />
          <button type="submit" disabled={busy || !answer.trim()} data-testid="send-answer"
            className="h-[46px] px-6 rounded-2xl bg-emerald-500 text-zinc-950 font-semibold disabled:opacity-40">
            Send
          </button>
        </form>
      </div>

      {/* Structured result */}
      {(hasCauses || result?.needs_mechanic) && (
        <div data-testid="diagnostic-result"
          className="relative overflow-hidden glass-panel p-8 space-y-5">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 block">
            Preliminary assessment
          </span>

          {hasCauses && (
            <div>
              <p className={LABEL}>Possible causes</p>
              <ul className="mt-2 space-y-1">
                {result!.possible_causes.map((c) => (
                  <li key={c} className="text-zinc-200 text-sm">• {c}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-6">
            {result?.severity && (
              <div>
                <p className={LABEL}>Severity</p>
                <span data-testid="severity" data-value={result.severity}
                  className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-medium ${SEVERITY_TONE[result.severity]}`}>
                  {result.severity}
                </span>
              </div>
            )}
            {typeof result?.confidence === 'number' && (
              <div>
                <p className={LABEL}>Confidence</p>
                <p data-testid="confidence" className="text-zinc-200 text-sm mt-2">
                  {Math.round(result.confidence * 100)}%
                </p>
              </div>
            )}
          </div>

          {result?.needs_mechanic && (
            <p data-testid="recommendation" className="text-zinc-300 text-sm">
              Based on the information provided, consider having a mechanic inspect the
              vehicle.
            </p>
          )}

          <button type="button" onClick={() => navigate('/dashboard/find')}
            data-testid="find-a-mechanic"
            className="h-12 px-8 rounded-2xl bg-emerald-500 text-zinc-950 font-semibold">
            Find a mechanic
          </button>
          <p className="text-zinc-600 text-xs">
            This is preliminary advice, not a diagnosis. A mechanic&apos;s inspection is
            always required to confirm.
          </p>
        </div>
      )}
    </div>
  );
}
