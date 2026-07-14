/* @vitest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';

import { TopicModeSwitch } from '../TopicModeSwitch';

describe('TopicModeSwitch', () => {
  afterEach(cleanup);

  it('renders Arena and Ratings tabs', () => {
    render(<TopicModeSwitch mode="arena" onModeChange={vi.fn()} />);

    expect(screen.getByRole('tab', { name: /arena/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /ratings/i })).toBeInTheDocument();
  });

  it('marks Arena tab as selected when mode is arena', () => {
    render(<TopicModeSwitch mode="arena" onModeChange={vi.fn()} />);

    expect(screen.getByRole('tab', { name: /arena/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /ratings/i })).toHaveAttribute('aria-selected', 'false');
  });

  it('marks Ratings tab as selected when mode is ratings', () => {
    render(<TopicModeSwitch mode="ratings" onModeChange={vi.fn()} />);

    expect(screen.getByRole('tab', { name: /arena/i })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: /ratings/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('calls onModeChange with "ratings" when Ratings tab is clicked', async () => {
    const onModeChange = vi.fn();
    render(<TopicModeSwitch mode="arena" onModeChange={onModeChange} />);

    await userEvent.click(screen.getByRole('tab', { name: /ratings/i }));
    expect(onModeChange).toHaveBeenCalledWith('ratings');
  });

  it('calls onModeChange with "arena" when Arena tab is clicked', async () => {
    const onModeChange = vi.fn();
    render(<TopicModeSwitch mode="ratings" onModeChange={onModeChange} />);

    await userEvent.click(screen.getByRole('tab', { name: /arena/i }));
    expect(onModeChange).toHaveBeenCalledWith('arena');
  });

  it('supports keyboard navigation via ArrowRight/ArrowLeft', async () => {
    const onModeChange = vi.fn();
    render(<TopicModeSwitch mode="arena" onModeChange={onModeChange} />);

    // Focus the Arena tab and press ArrowRight
    const arenaTab = screen.getByRole('tab', { name: /arena/i });
    arenaTab.focus();
    await userEvent.keyboard('{ArrowRight}');

    expect(onModeChange).toHaveBeenCalledWith('ratings');
  });

  it('renders with proper tablist role and aria-label', () => {
    render(<TopicModeSwitch mode="arena" onModeChange={vi.fn()} />);

    expect(screen.getByRole('tablist', { name: /topic interaction mode/i })).toBeInTheDocument();
  });

  it('sets tabIndex correctly for roving focus', () => {
    render(<TopicModeSwitch mode="arena" onModeChange={vi.fn()} />);

    expect(screen.getByRole('tab', { name: /arena/i })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: /ratings/i })).toHaveAttribute('tabindex', '-1');
  });

  it('Arena tab controls panel-arena', () => {
    render(<TopicModeSwitch mode="arena" onModeChange={vi.fn()} />);

    expect(screen.getByRole('tab', { name: /arena/i })).toHaveAttribute('aria-controls', 'panel-arena');
    expect(screen.getByRole('tab', { name: /ratings/i })).toHaveAttribute('aria-controls', 'panel-ratings');
  });
});
