import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ArenaDisplay } from '@/components/ArenaDisplay';

describe('ArenaDisplay', () => {
  const mockOnViewResult = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state when isLoading', () => {
    render(
      <ArenaDisplay
        question="相亲男让我AA"
        arenaType="toxic"
        isLoading={true}
        onViewResult={mockOnViewResult}
      />
    );

    expect(screen.getByText('AI 正在评理中...')).toBeInTheDocument();
    expect(screen.getByText('相亲男让我AA')).toBeInTheDocument();
  });

  it('should show pending text when not collected', () => {
    render(
      <ArenaDisplay
        question="test question"
        arenaType="comfort"
        isLoading={false}
        status="pending"
        onViewResult={mockOnViewResult}
      />
    );

    expect(screen.getByText('等待 AI 评理中...')).toBeInTheDocument();
  });

  it('should show result when collected', async () => {
    render(
      <ArenaDisplay
        question="相亲男让我AA"
        arenaType="toxic"
        isLoading={false}
        status="collected"
        redRatio={0.7}
        blueRatio={0.3}
        topRedComments={['转给他']}
        topBlueComments={['算了']}
        onViewResult={mockOnViewResult}
      />
    );

    // Wait for animation
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 1100));
    });

    // Verify result content is displayed
    // The exact text might be split or formatted, check for container or parts
    expect(screen.getByText(/红方 70%/)).toBeInTheDocument();
    expect(screen.getByText(/蓝方 30%/)).toBeInTheDocument();
    expect(screen.getByText('转给他')).toBeInTheDocument();
    expect(screen.getByText('算了')).toBeInTheDocument();
  });

  it('should display progress bars when collected', async () => {
    render(
      <ArenaDisplay
        question="test"
        arenaType="rational"
        isLoading={false}
        status="collected"
        redRatio={0.6}
        blueRatio={0.4}
        topRedComments={['comment1']}
        topBlueComments={['comment3']}
        onViewResult={mockOnViewResult}
      />
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 1100));
    });

    const redBar = screen.getByTestId('red-progress');
    const blueBar = screen.getByTestId('blue-progress');
    expect(redBar).toHaveStyle({ width: '60%' });
    expect(blueBar).toHaveStyle({ width: '40%' });
  });

  it('should show arena type badge', () => {
    render(
      <ArenaDisplay
        question="test"
        arenaType="comfort"
        isLoading={false}
        onViewResult={mockOnViewResult}
      />
    );

    expect(screen.getByText('安慰场')).toBeInTheDocument();
  });
});
