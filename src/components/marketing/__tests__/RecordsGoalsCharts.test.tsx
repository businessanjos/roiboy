import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RecordsGoalsCharts } from '../RecordsGoalsCharts';

const WEEKLY = [
  { year: 2026, month: 11, week: 1, views: 100, reach: 50, interactions: 10, followers: 5, profile_visits: 3, link_clicks: 1 },
  { year: 2026, month: 11, week: 2, views: 200, reach: 80, interactions: 20, followers: 8, profile_visits: 6, link_clicks: 2 },
];
const GOALS = [
  { year: 2026, month: 11, views: 500, reach: 300, interactions: 60, followers: 40, profile_visits: 20, link_clicks: 10 },
];

const pill = (label: string) => screen.getByRole('button', { name: label });

describe('seleção de métrica no comparativo de crescimento', () => {
  it('desmarca a métrica quando se clica de novo nela', () => {
    render(<RecordsGoalsCharts weekly={WEEKLY} goals={GOALS} year={2026} month={11} />);

    expect(pill('Visualizações')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(pill('Visualizações'));

    expect(pill('Visualizações')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Escolha uma métrica acima para ver o comparativo.')).toBeInTheDocument();
  });

  it('mantém só uma métrica ativa ao trocar e permite desmarcar a nova', () => {
    render(<RecordsGoalsCharts weekly={WEEKLY} goals={GOALS} year={2026} month={11} />);

    fireEvent.click(pill('Interações'));

    expect(pill('Interações')).toHaveAttribute('aria-pressed', 'true');
    expect(pill('Visualizações')).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(pill('Interações'));

    expect(pill('Interações')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Escolha uma métrica acima para ver o comparativo.')).toBeInTheDocument();
  });

  it('avisa o componente pai quando a métrica é desmarcada', () => {
    const onMetricChange = vi.fn();
    render(
      <RecordsGoalsCharts
        weekly={WEEKLY}
        goals={GOALS}
        year={2026}
        month={11}
        metric="reach"
        onMetricChange={onMetricChange}
      />,
    );

    fireEvent.click(pill('Contas alcançadas'));

    expect(onMetricChange).toHaveBeenLastCalledWith(null);
  });

  it('avisa o componente pai com a métrica escolhida ao marcar outra', () => {
    const onMetricChange = vi.fn();
    render(
      <RecordsGoalsCharts
        weekly={WEEKLY}
        goals={GOALS}
        year={2026}
        month={11}
        metric="reach"
        onMetricChange={onMetricChange}
      />,
    );

    fireEvent.click(pill('Cliques no link externo'));

    expect(onMetricChange).toHaveBeenLastCalledWith('link_clicks');
  });
});
