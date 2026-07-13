/* @vitest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { Sparkline } from '../Sparkline';

const sampleData = [
  { timestamp: '2026-01-01T00:00:00Z', avgScore: 5, count: 10 },
  { timestamp: '2026-01-02T00:00:00Z', avgScore: 6, count: 12 },
  { timestamp: '2026-01-03T00:00:00Z', avgScore: 7, count: 15 },
  { timestamp: '2026-01-04T00:00:00Z', avgScore: 8, count: 18 },
];

describe('Sparkline', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders fallback em-dash when data has fewer than 2 points', () => {
    const { container } = render(
      <Sparkline data={[{ timestamp: '2026-01-01T00:00:00Z', avgScore: 5, count: 10 }]} color="#ff0000" />
    );

    expect(container.querySelector('svg')).not.toBeInTheDocument();
    expect(container.textContent).toBe('\u2014');
  });

  it('renders fallback for empty data array', () => {
    const { container } = render(<Sparkline data={[]} color="#ff0000" />);

    expect(container.querySelector('svg')).not.toBeInTheDocument();
    expect(container.textContent).toBe('\u2014');
  });

  it('renders SVG with a line path when data has 2+ points', () => {
    const { container } = render(<Sparkline data={sampleData} color="#4F8DF0" />);

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();

    const paths = container.querySelectorAll('path');
    const linePath = Array.from(paths).find(p => p.getAttribute('stroke') === '#4F8DF0');
    expect(linePath).toBeDefined();
    expect(linePath!.getAttribute('d')).toContain('M');
    expect(linePath!.getAttribute('d')).toContain('L');
  });

  it('applies width and height props to the SVG', () => {
    const { container } = render(
      <Sparkline data={sampleData} color="#ff0000" width={120} height={40} />
    );

    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '120');
    expect(svg).toHaveAttribute('height', '40');
    expect(svg).toHaveAttribute('viewBox', '0 0 120 40');
  });

  it('applies stroke color from the color prop', () => {
    const { container } = render(
      <Sparkline data={sampleData} color="#A855F7" />
    );

    const paths = container.querySelectorAll('path');
    const linePath = Array.from(paths).find(p => p.getAttribute('stroke') === '#A855F7');
    expect(linePath).toBeDefined();
  });

  it('applies custom strokeWidth', () => {
    const { container } = render(
      <Sparkline data={sampleData} color="#ff0000" strokeWidth={3} />
    );

    const paths = container.querySelectorAll('path');
    const linePath = Array.from(paths).find(p => p.getAttribute('stroke') === '#ff0000');
    expect(linePath).toBeDefined();
    expect(linePath!.getAttribute('stroke-width')).toBe('3');
  });

  it('renders an area path when showArea is true (default)', () => {
    const { container } = render(
      <Sparkline data={sampleData} color="#4ECB71" />
    );

    const paths = container.querySelectorAll('path');
    const areaPath = Array.from(paths).find(p => {
      const fill = p.getAttribute('fill');
      return fill !== null && fill !== 'none' && fill.startsWith('url(');
    });
    expect(areaPath).toBeDefined();
    expect(areaPath!.getAttribute('d')).toContain('Z');
  });

  it('does not render area path when showArea is false', () => {
    const { container } = render(
      <Sparkline data={sampleData} color="#4ECB71" showArea={false} />
    );

    const paths = container.querySelectorAll('path');
    const areaPath = Array.from(paths).find(p => {
      const fill = p.getAttribute('fill');
      return fill !== null && fill !== 'none' && fill.startsWith('url(');
    });
    expect(areaPath).toBeUndefined();
  });

  it('renders end dot circle at the last data point', () => {
    const { container } = render(
      <Sparkline data={sampleData} color="#06b6d4" />
    );

    const circle = container.querySelector('circle');
    expect(circle).toBeInTheDocument();
    expect(circle).toHaveAttribute('fill', '#06b6d4');
    expect(circle).toHaveAttribute('r', '2');
  });

  it('shows trend indicator (up arrow) when last score > first score', () => {
    const upTrendData = [
      { timestamp: '2026-01-01T00:00:00Z', avgScore: 5, count: 10 },
      { timestamp: '2026-01-02T00:00:00Z', avgScore: 7, count: 12 },
    ];

    const { container } = render(
      <Sparkline data={upTrendData} color="#ff0000" showTrendIndicator={true} />
    );

    expect(container.textContent).toContain('\u25B2');
    expect(container.textContent).toContain('2.0');
  });

  it('shows trend indicator (down arrow) when last score < first score', () => {
    const downTrendData = [
      { timestamp: '2026-01-01T00:00:00Z', avgScore: 8, count: 10 },
      { timestamp: '2026-01-02T00:00:00Z', avgScore: 5, count: 12 },
    ];

    const { container } = render(
      <Sparkline data={downTrendData} color="#ff0000" showTrendIndicator={true} />
    );

    expect(container.textContent).toContain('\u25BC');
    expect(container.textContent).toContain('3.0');
  });

  it('does not show trend indicator when showTrendIndicator is false', () => {
    const { container } = render(
      <Sparkline data={sampleData} color="#ff0000" showTrendIndicator={false} />
    );

    expect(container.textContent).not.toContain('\u25B2');
    expect(container.textContent).not.toContain('\u25BC');
  });

  it('does not show trend indicator when trend is less than 0.05', () => {
    const flatData = [
      { timestamp: '2026-01-01T00:00:00Z', avgScore: 5.0, count: 10 },
      { timestamp: '2026-01-02T00:00:00Z', avgScore: 5.04, count: 12 },
    ];

    const { container } = render(
      <Sparkline data={flatData} color="#ff0000" showTrendIndicator={true} />
    );

    expect(container.textContent).not.toContain('\u25B2');
    expect(container.textContent).not.toContain('\u25BC');
  });

  it('uses default width=80 and height=24', () => {
    const { container } = render(
      <Sparkline data={sampleData} color="#ff0000" />
    );

    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '80');
    expect(svg).toHaveAttribute('height', '24');
  });
});
