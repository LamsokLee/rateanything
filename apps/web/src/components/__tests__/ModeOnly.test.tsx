/* @vitest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let mockMode: 'arena' | 'rate' = 'arena';

vi.mock('@/components/ModeProvider', () => ({
  useMode: () => ({ mode: mockMode, setMode: vi.fn(), toggleMode: vi.fn() }),
}));

import { ModeOnly } from '../ModeOnly';

describe('ModeOnly', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    mockMode = 'arena';
  });

  it('renders children when mode matches current global mode', () => {
    render(
      <ModeOnly mode="arena">
        <span>Arena content</span>
      </ModeOnly>
    );

    expect(screen.getByText('Arena content')).toBeInTheDocument();
  });

  it('does not render children when mode does not match', () => {
    render(
      <ModeOnly mode="rate">
        <span>Rating content</span>
      </ModeOnly>
    );

    expect(screen.queryByText('Rating content')).not.toBeInTheDocument();
  });

  it('renders fallback when mode does not match and fallback is provided', () => {
    render(
      <ModeOnly mode="rate" fallback={<span>Fallback content</span>}>
        <span>Rating content</span>
      </ModeOnly>
    );

    expect(screen.queryByText('Rating content')).not.toBeInTheDocument();
    expect(screen.getByText('Fallback content')).toBeInTheDocument();
  });
});
