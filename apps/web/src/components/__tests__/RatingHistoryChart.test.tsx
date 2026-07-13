/* @vitest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/chart-colors', () => ({
  CHART_COLORS: ['#4F8DF0', '#FF6B6B', '#4ECB71', '#F0A94F'],
}));

import { RatingHistoryChart } from '../RatingHistoryChart';

function makeHistory(days: number, baseScore: number) {
  const points = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(Date.now() - (days - i) * 24 * 60 * 60 * 1000);
    points.push({
      timestamp: date.toISOString(),
      avgScore: baseScore + (i * 0.1),
      count: 10 + i,
    });
  }
  return points;
}

const validData = [
  { optionId: 'opt1', optionName: 'VS Code', history: makeHistory(10, 7) },
  { optionId: 'opt2', optionName: 'Vim', history: makeHistory(10, 6) },
];

describe('RatingHistoryChart', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no options have enough history', () => {
    const data = [
      { optionId: 'opt1', optionName: 'VS Code', history: [{ timestamp: '2026-01-01T00:00:00Z', avgScore: 7, count: 10 }] },
    ];

    render(<RatingHistoryChart data={data} />);

    expect(screen.getByText(/not enough voting history/i)).toBeInTheDocument();
  });

  it('renders empty state when data is empty', () => {
    render(<RatingHistoryChart data={[]} />);

    expect(screen.getByText(/not enough voting history/i)).toBeInTheDocument();
  });

  it('renders the Score History title', () => {
    render(<RatingHistoryChart data={validData} />);

    expect(screen.getByText('Score History')).toBeInTheDocument();
  });

  it('renders SVG chart with paths for each option', () => {
    const { container } = render(<RatingHistoryChart data={validData} />);

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();

    // Find paths with stroke-width 2.5 (option line paths)
    const allPaths = container.querySelectorAll('path');
    const optionPaths = Array.from(allPaths).filter(
      p => p.getAttribute('stroke-width') === '2.5'
    );
    expect(optionPaths.length).toBe(2);
  });

  it('renders option paths with correct colors from CHART_COLORS', () => {
    const { container } = render(<RatingHistoryChart data={validData} />);

    const allPaths = container.querySelectorAll('path');
    const optionPaths = Array.from(allPaths).filter(
      p => p.getAttribute('stroke-width') === '2.5'
    );
    expect(optionPaths[0]).toHaveAttribute('stroke', '#4F8DF0');
    expect(optionPaths[1]).toHaveAttribute('stroke', '#FF6B6B');
  });

  it('renders time range buttons (7D, 14D, 30D, All)', () => {
    render(<RatingHistoryChart data={validData} />);

    expect(screen.getByRole('button', { name: '7D' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '14D' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30D' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
  });

  it('30D button is selected by default', () => {
    render(<RatingHistoryChart data={validData} />);

    const btn30d = screen.getByRole('button', { name: '30D' });
    expect(btn30d.className).toContain('bg-muted-foreground');
  });

  it('clicking a time range button changes active state', async () => {
    render(<RatingHistoryChart data={validData} />);

    const user = userEvent.setup();
    const btn7d = screen.getByRole('button', { name: '7D' });
    const btn30d = screen.getByRole('button', { name: '30D' });

    await user.click(btn7d);

    expect(btn7d.className).toContain('bg-muted-foreground');
    expect(btn30d.className).not.toContain('bg-muted-foreground');
  });

  it('renders legend with option names and latest scores', () => {
    render(<RatingHistoryChart data={validData} />);

    expect(screen.getByText('VS Code')).toBeInTheDocument();
    expect(screen.getByText('Vim')).toBeInTheDocument();
  });

  it('renders Y-axis grid labels (1, 3, 5, 7, 9)', () => {
    const { container } = render(<RatingHistoryChart data={validData} />);

    const textElements = container.querySelectorAll('svg text');
    const yLabels = Array.from(textElements).map(el => el.textContent);
    expect(yLabels).toContain('1');
    expect(yLabels).toContain('3');
    expect(yLabels).toContain('5');
    expect(yLabels).toContain('7');
    expect(yLabels).toContain('9');
  });

  it('shows "No data in selected time range" when filter excludes all data', async () => {
    const oldData = [
      {
        optionId: 'opt1',
        optionName: 'VS Code',
        history: [
          { timestamp: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(), avgScore: 7, count: 10 },
          { timestamp: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), avgScore: 8, count: 12 },
        ],
      },
    ];

    render(<RatingHistoryChart data={oldData} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '7D' }));

    expect(screen.getByText(/no data in selected time range/i)).toBeInTheDocument();
  });

  it('renders legend color dots matching path stroke colors', () => {
    const { container } = render(<RatingHistoryChart data={validData} />);

    const legendDots = container.querySelectorAll('.rounded-full');
    const dotColors = Array.from(legendDots).map(d => (d as HTMLElement).style.backgroundColor);
    expect(dotColors).toContain('rgb(79, 141, 240)');
    expect(dotColors).toContain('rgb(255, 107, 107)');
  });
});
