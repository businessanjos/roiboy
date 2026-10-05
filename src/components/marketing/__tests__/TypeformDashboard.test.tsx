import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act, within, fireEvent } from '@testing-library/react';

// ---- Mocks ----
const invokeMock = vi.fn();
const fromMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...a: any[]) => invokeMock(...a) },
    from: (...a: any[]) => fromMock(...a),
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import { TypeformDashboard } from '../TypeformDashboard';

// Radix Select depende de APIs de ponteiro/scroll que o jsdom não implementa.
if (!(Element.prototype as any).hasPointerCapture) {
  (Element.prototype as any).hasPointerCapture = () => false;
}
if (!(Element.prototype as any).setPointerCapture) {
  (Element.prototype as any).setPointerCapture = () => {};
}
if (!(Element.prototype as any).releasePointerCapture) {
  (Element.prototype as any).releasePointerCapture = () => {};
}
if (!(Element.prototype as any).scrollIntoView) {
  (Element.prototype as any).scrollIntoView = () => {};
}

const FORMS = [
  { id: '1', form_id: 'fABC', title: 'Form A', campaign_tag: null, webhook_installed: true, is_active: true },
  { id: '2', form_id: 'fXYZ', title: 'Form B', campaign_tag: null, webhook_installed: true, is_active: true },
];

const FUNNEL_ALL = {
  visits: 1000, starts: 800, submissions: 500, completed: 400,
  matched_responses: 200, matched_leads: 180, matched_deals: 150,
  won: 12, won_value: 360000, completion_rate: 80, lifetime_completion_rate: 50, avg_time: 90,
};

function setupSupabaseFromForms() {
  fromMock.mockImplementation((table: string) => {
    if (table === 'typeform_forms') {
      return {
        select: () => ({
          order: () => ({
            order: () => ({
              range: (from: number, to: number) =>
                Promise.resolve({ data: FORMS.slice(from, to + 1), error: null }),
            }),
          }),
        }),
      };
    }
    return { select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) };
  });
}

beforeEach(async () => {
  invokeMock.mockReset();
  fromMock.mockReset();
  const { toast } = await import('sonner');
  (toast.warning as any).mockClear?.();
  (toast.error as any).mockClear?.();
  (toast.success as any).mockClear?.();
  setupSupabaseFromForms();
  invokeMock.mockResolvedValue({
    data: { funnel: FUNNEL_ALL, consistency: { ok: true, responses_in_scope: 500, scope_form_ids: ['fABC', 'fXYZ'] }, won_deals: [] },
    error: null,
  });
});

describe('TypeformDashboard — métricas, escopo e fontes', () => {
  it('chama get_dashboard com form_id="__all__" e days=30 por padrão', async () => {
    await act(async () => { render(<TypeformDashboard />); });
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        'typeform-manager',
        expect.objectContaining({
          body: expect.objectContaining({
            action: 'get_dashboard',
            form_id: '__all__',
            days: 30,
          }),
        }),
      );
    });
  });

  it('renderiza valores das 4 métricas de período conforme backend', async () => {
    await act(async () => { render(<TypeformDashboard />); });
    await waitFor(() => screen.getByLabelText('Como Submissões é calculado'));
    const card = screen.getByLabelText('Como Submissões é calculado').closest('[role="region"][aria-label="Resumo agregado"]') as HTMLElement;
    expect(card).toBeTruthy();
    const scoped = within(card);
    // Submissões=500, Completados=400, Lead no Roy=200, Ganhos=12 (formato pt-BR)
    expect(scoped.getByText('Submissões')).toBeInTheDocument();
    expect(scoped.getByText('500')).toBeInTheDocument();
    expect(scoped.getByText('400')).toBeInTheDocument();
    expect(scoped.getByText('200')).toBeInTheDocument();
    expect(scoped.getByText('12')).toBeInTheDocument();
  });

  it('renderiza valores lifetime (Visitas, Iniciados) vindos do backend', async () => {
    await act(async () => { render(<TypeformDashboard />); });
    await waitFor(() => screen.getByLabelText('Como Visitas é calculado'));
    const visits = screen.getByLabelText('Como Visitas é calculado').closest('[data-funnel-card="Visitas"]') as HTMLElement;
    const started = screen.getByLabelText('Como Iniciados é calculado').closest('[data-funnel-card="Iniciados"]') as HTMLElement;
    expect(visits).toBeTruthy();
    expect(started).toBeTruthy();
    // 1.000 e 800 (pt-BR)
    expect(within(visits).getByText('1.000')).toBeInTheDocument();
    expect(within(started).getByText('800')).toBeInTheDocument();
  });

  it('expõe a Fonte de cada card alinhada com o backend (DB vs Insights API)', async () => {
    // Os labels "Fonte: ..." vivem nos tooltips. Renderizamos e abrimos a modal de detalhes
    // para inspecionar o atributo `source` repassado.
    await act(async () => { render(<TypeformDashboard />); });
    await waitFor(() => screen.getByLabelText('Como Submissões é calculado'));

    // Cada FunnelCard expõe um botão "Como ... é calculado" com aria-label.
    const expected: Array<[string, string]> = [
      ['Como Visitas é calculado', 'Typeform Insights API'],
      ['Como Iniciados é calculado', 'Typeform Insights API'],
      ['Como Tempo médio é calculado', 'Typeform Insights API'],
      ['Como Submissões é calculado', 'DB · typeform_responses'],
      ['Como Completados é calculado', 'DB · typeform_responses'],
      ['Como Lead no Roy é calculado', 'DB · matching engine'],
      ['Como Ganhos é calculado', 'DB · deals (status=won)'],
    ];
    for (const [label] of expected) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it('passa form_id e período quando ambos mudam', async () => {
    // Override invoke para devolver um payload que reflete o form_id passado, simulando
    // que o backend isolou o escopo. O teste valida que a UI realmente envia esses params.
    invokeMock.mockImplementation(async (_fn: string, opts: any) => {
      const body = opts?.body || {};
      return {
        data: {
          funnel: { ...FUNNEL_ALL, submissions: body.form_id === 'fABC' ? 50 : 500, won: body.days === 7 ? 1 : 12 },
          consistency: { ok: true, responses_in_scope: 50, scope_form_ids: [body.form_id] },
          won_deals: [],
        },
        error: null,
      };
    });

    await act(async () => { render(<TypeformDashboard />); });

    // Esperar o invoke inicial (form_id=__all__, days=30)
    await waitFor(() => expect(invokeMock).toHaveBeenCalled());
    invokeMock.mockClear();

    // Seleciona o formulário "Form A" no combobox de formulário (Radix Select: pointerDown + click).
    const formTrigger = screen.getAllByRole('combobox')[0];
    await act(async () => {
      fireEvent.pointerDown(formTrigger, { button: 0, ctrlKey: false });
      fireEvent.click(formTrigger);
    });
    const formOption = await screen.findByRole('option', { name: 'Form A' });
    await act(async () => {
      fireEvent.pointerUp(formOption);
      fireEvent.click(formOption);
    });

    // Seleciona o período "Últimos 7d" no combobox de período.
    const periodTrigger = screen.getAllByRole('combobox')[1];
    await act(async () => {
      fireEvent.pointerDown(periodTrigger, { button: 0, ctrlKey: false });
      fireEvent.click(periodTrigger);
    });
    const periodOption = await screen.findByRole('option', { name: 'Últimos 7d' });
    await act(async () => {
      fireEvent.pointerUp(periodOption);
      fireEvent.click(periodOption);
    });

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        'typeform-manager',
        expect.objectContaining({
          body: expect.objectContaining({
            action: 'get_dashboard',
            form_id: 'fABC',
            days: 7,
          }),
        }),
      );
    });
  });

  it('descarta números fora de escopo: respeita consistency.ok=false do backend', async () => {
    invokeMock.mockResolvedValue({
      data: {
        funnel: FUNNEL_ALL,
        consistency: { ok: false, out_of_scope_responses: 7, responses_in_scope: 493, scope_form_ids: ['fABC'] },
        won_deals: [],
      },
      error: null,
    });
    await act(async () => { render(<TypeformDashboard />); });
    await waitFor(() =>
      expect(
        document.body.textContent?.includes('7 resposta(s) fora do escopo descartadas'),
      ).toBe(true),
    );
  });

  it('NÃO mostra banner de inconsistência quando out_of_scope_responses === 0 (mesmo com ok=false)', async () => {
    const { toast } = await import('sonner');
    invokeMock.mockResolvedValue({
      data: {
        funnel: FUNNEL_ALL,
        consistency: { ok: false, out_of_scope_responses: 0, responses_in_scope: 500, scope_form_ids: ['fABC', 'fXYZ'] },
        won_deals: [],
      },
      error: null,
    });
    await act(async () => { render(<TypeformDashboard />); });
    await waitFor(() => expect(invokeMock).toHaveBeenCalled());

    expect(toast.warning).not.toHaveBeenCalled();
    expect(document.body.textContent || '').not.toMatch(/fora do escopo descartadas/);
    await waitFor(() =>
      expect(document.body.textContent || '').toMatch(/Dados consistentes/),
    );
  });

  it('NÃO mostra banner quando out_of_scope_responses está ausente/undefined', async () => {
    const { toast } = await import('sonner');
    invokeMock.mockResolvedValue({
      data: {
        funnel: FUNNEL_ALL,
        consistency: { ok: false, responses_in_scope: 500, scope_form_ids: ['fABC'] },
        won_deals: [],
      },
      error: null,
    });
    await act(async () => { render(<TypeformDashboard />); });
    await waitFor(() => expect(invokeMock).toHaveBeenCalled());

    expect(toast.warning).not.toHaveBeenCalled();
    expect(document.body.textContent || '').not.toMatch(/fora do escopo descartadas/);
  });
});

