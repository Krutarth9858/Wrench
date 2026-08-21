import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Troubleshoot from './Troubleshoot';
import { ApiError } from '../../lib/api';
import * as diagnostics from '../../lib/diagnostics';

vi.mock('../../lib/diagnostics', () => ({
  startDiagnostic: vi.fn(),
  sendDiagnosticMessage: vi.fn(),
  getDiagnostic: vi.fn(),
}));

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

const session = (over: Partial<diagnostics.DiagnosticSession> = {}): diagnostics.DiagnosticSession => ({
  id: 's-1', vehicle_type: 'BIKE', problem_description: "My bike won't start.",
  status: 'ACTIVE', created_at: null,
  result: { severity: 'LOW', confidence: 0.2, needs_mechanic: false,
    possible_causes: [], follow_up_questions: ['Do the headlights come on?'] },
  messages: [
    { id: 'm-1', role: 'USER', content: "My bike won't start." },
    { id: 'm-2', role: 'ASSISTANT', content: 'Based on the information provided, I need more detail.' },
  ],
  ...over,
});

const resolved = session({
  result: { severity: 'MEDIUM', confidence: 0.72, needs_mechanic: true,
    possible_causes: ['Weak or discharged battery', 'Starter connection issue'],
    follow_up_questions: [] },
  messages: [
    ...session().messages,
    { id: 'm-3', role: 'USER', content: 'The headlights are dim.' },
    { id: 'm-4', role: 'ASSISTANT', content: 'A possible cause is a weak battery.' },
  ],
});

const renderPage = () => render(<MemoryRouter><Troubleshoot /></MemoryRouter>);

async function begin(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId('vehicle-BIKE'));
  await user.type(screen.getByTestId('problem-input'), "My bike won't start.");
  await user.click(screen.getByTestId('start-diagnostic'));
}

describe('Troubleshoot', () => {
  beforeEach(() => {
    vi.mocked(diagnostics.startDiagnostic).mockResolvedValue(session());
    vi.mocked(diagnostics.sendDiagnosticMessage).mockResolvedValue(resolved);
    navigate.mockClear();
  });
  afterEach(() => vi.clearAllMocks());

  it('asks for a vehicle type before anything else', () => {
    renderPage();
    expect(screen.getByTestId('vehicle-BIKE')).toBeInTheDocument();
    expect(screen.getByTestId('vehicle-CAR')).toBeInTheDocument();
    expect(screen.queryByTestId('problem-step')).not.toBeInTheDocument();
  });

  it('needs no saved vehicle', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByTestId('vehicle-BIKE'));
    expect(screen.getByTestId('problem-step')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('starts a session with the chosen type and problem', async () => {
    const user = userEvent.setup();
    renderPage();
    await begin(user);
    await waitFor(() =>
      expect(diagnostics.startDiagnostic).toHaveBeenCalledWith('BIKE', "My bike won't start."));
  });

  it('renders the conversation from the backend', async () => {
    const user = userEvent.setup();
    renderPage();
    await begin(user);
    await waitFor(() => expect(screen.getByTestId('conversation')).toBeInTheDocument());
    expect(screen.getAllByTestId('msg-USER')).toHaveLength(1);
    expect(screen.getAllByTestId('msg-ASSISTANT')).toHaveLength(1);
    expect(screen.getByText(/I need more detail/)).toBeInTheDocument();
  });

  it('shows follow-up questions while the AI still needs information', async () => {
    const user = userEvent.setup();
    renderPage();
    await begin(user);
    await waitFor(() => expect(screen.getByTestId('follow-ups')).toHaveTextContent('headlights'));
    // no assessment yet — no causes and no mechanic recommendation
    expect(screen.queryByTestId('diagnostic-result')).not.toBeInTheDocument();
  });

  it('sends an answer and updates the conversation', async () => {
    const user = userEvent.setup();
    renderPage();
    await begin(user);
    await waitFor(() => expect(screen.getByTestId('answer-input')).toBeInTheDocument());

    await user.type(screen.getByTestId('answer-input'), 'The headlights are dim.');
    await user.click(screen.getByTestId('send-answer'));

    await waitFor(() =>
      expect(diagnostics.sendDiagnosticMessage).toHaveBeenCalledWith('s-1', 'The headlights are dim.'));
    await waitFor(() => expect(screen.getAllByTestId('msg-USER')).toHaveLength(2));
  });

  it('shows the structured result once causes exist', async () => {
    const user = userEvent.setup();
    vi.mocked(diagnostics.startDiagnostic).mockResolvedValue(resolved);
    renderPage();
    await begin(user);

    const panel = await screen.findByTestId('diagnostic-result');
    expect(panel).toHaveTextContent('Weak or discharged battery');
    expect(screen.getByTestId('severity')).toHaveAttribute('data-value', 'MEDIUM');
    expect(screen.getByTestId('confidence')).toHaveTextContent('72%');
    expect(screen.getByTestId('recommendation')).toHaveTextContent('consider having a mechanic');
  });

  it('never claims certainty', async () => {
    const user = userEvent.setup();
    vi.mocked(diagnostics.startDiagnostic).mockResolvedValue(resolved);
    renderPage();
    await begin(user);
    const panel = await screen.findByTestId('diagnostic-result');
    expect(panel).toHaveTextContent(/preliminary advice, not a diagnosis/i);
  });

  it('routes Find a mechanic into the existing discovery flow', async () => {
    const user = userEvent.setup();
    vi.mocked(diagnostics.startDiagnostic).mockResolvedValue(resolved);
    renderPage();
    await begin(user);
    await user.click(await screen.findByTestId('find-a-mechanic'));
    expect(navigate).toHaveBeenCalledWith('/dashboard/find');
  });

  it('shows a thinking state while waiting', async () => {
    const user = userEvent.setup();
    let release: (s: diagnostics.DiagnosticSession) => void = () => {};
    vi.mocked(diagnostics.startDiagnostic).mockReturnValue(
      new Promise((resolve) => { release = resolve; }));
    renderPage();
    await user.click(screen.getByTestId('vehicle-BIKE'));
    await user.type(screen.getByTestId('problem-input'), "My bike won't start.");
    await user.click(screen.getByTestId('start-diagnostic'));

    expect(screen.getByTestId('start-diagnostic')).toBeDisabled();
    release(session());
    await waitFor(() => expect(screen.getByTestId('conversation')).toBeInTheDocument());
  });

  it('surfaces an AI outage without losing the page', async () => {
    const user = userEvent.setup();
    vi.mocked(diagnostics.startDiagnostic).mockRejectedValue(
      new ApiError(503, null, 'The diagnostic assistant is unavailable right now.'));
    renderPage();
    await begin(user);
    await waitFor(() =>
      expect(screen.getByTestId('diagnostic-error')).toHaveTextContent('unavailable'));
    expect(screen.getByTestId('start-diagnostic')).toBeEnabled();
  });

  it('surfaces a failed reply', async () => {
    const user = userEvent.setup();
    vi.mocked(diagnostics.sendDiagnosticMessage).mockRejectedValue(
      new ApiError(503, null, 'The diagnostic assistant is unavailable right now.'));
    renderPage();
    await begin(user);
    await waitFor(() => expect(screen.getByTestId('answer-input')).toBeInTheDocument());
    await user.type(screen.getByTestId('answer-input'), 'dim');
    await user.click(screen.getByTestId('send-answer'));
    await waitFor(() =>
      expect(screen.getByTestId('diagnostic-error')).toHaveTextContent('unavailable'));
  });
});
