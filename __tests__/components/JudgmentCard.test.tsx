import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JudgmentCard } from '@/components/JudgmentCard';
import userEvent from '@testing-library/user-event';

// Mock clipboard API
const mockClipboardWriteText = vi.fn();
vi.stubGlobal('navigator', {
  clipboard: {
    writeText: mockClipboardWriteText,
  },
});

describe('JudgmentCard', () => {
  const mockOnShare = vi.fn();
  const mockOnCopy = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render judgment card with question', () => {
    render(
      <JudgmentCard
        question="相亲男让我AA这杯咖啡"
        arenaType="toxic"
        redRatio={0.7}
        blueRatio={0.3}
        topRedComments={['转给他']}
        topBlueComments={['算了']}
        onShare={mockOnShare}
        onCopy={mockOnCopy}
      />
    );

    expect(screen.getByText('帮我评评理')).toBeInTheDocument();
    expect(screen.getByText('相亲男让我AA这杯咖啡')).toBeInTheDocument();
    expect(screen.getByText('70%')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
  });

  it('should display arena icon correctly', () => {
    render(
      <JudgmentCard
        question="test"
        arenaType="toxic"
        redRatio={0.5}
        blueRatio={0.5}
        topRedComments={[]}
        topBlueComments={[]}
        onShare={mockOnShare}
      />
    );

    expect(screen.getByText('🔥')).toBeInTheDocument();
  });

  it('should show red side with comments', () => {
    render(
      <JudgmentCard
        question="test"
        arenaType="toxic"
        redRatio={0.6}
        blueRatio={0.4}
        topRedComments={['转给他', '别惯着']}
        topBlueComments={['算了']}
        onShare={mockOnShare}
      />
    );

    expect(screen.getByText('红方 60%')).toBeInTheDocument();
    expect(screen.getByText('转给他')).toBeInTheDocument();
    expect(screen.getByText('别惯着')).toBeInTheDocument();
  });

  it('should show blue side with comments', () => {
    render(
      <JudgmentCard
        question="test"
        arenaType="comfort"
        redRatio={0.3}
        blueRatio={0.7}
        topRedComments={['a']}
        topBlueComments={['算了', '大度点']}
        onShare={mockOnShare}
      />
    );

    expect(screen.getByText('蓝方 70%')).toBeInTheDocument();
    expect(screen.getByText('算了')).toBeInTheDocument();
    expect(screen.getByText('大度点')).toBeInTheDocument();
  });

  it('should display empty comments gracefully', () => {
    render(
      <JudgmentCard
        question="test"
        arenaType="rational"
        redRatio={0.5}
        blueRatio={0.5}
        topRedComments={[]}
        topBlueComments={[]}
        onShare={mockOnShare}
      />
    );

    expect(screen.getByText('暂无金句')).toBeInTheDocument();
  });

  it('should render footer with branding', () => {
    render(
      <JudgmentCard
        question="test"
        arenaType="toxic"
        redRatio={0.5}
        blueRatio={0.5}
        topRedComments={[]}
        topBlueComments={[]}
        onShare={mockOnShare}
      />
    );

    expect(screen.getByText('AI判决书')).toBeInTheDocument();
  });

  it('should handle different arena types', () => {
    render(
      <JudgmentCard
        question="test"
        arenaType="toxic"
        redRatio={0.5}
        blueRatio={0.5}
        topRedComments={[]}
        topBlueComments={[]}
        onShare={mockOnShare}
      />
    );

    expect(screen.getByText('🔥 毒舌场')).toBeInTheDocument();
  });

  it('should render action buttons', () => {
    render(
      <JudgmentCard
        question="test"
        arenaType="toxic"
        redRatio={0.5}
        blueRatio={0.5}
        topRedComments={['a']}
        topBlueComments={['b']}
        onShare={mockOnShare}
        onCopy={mockOnCopy}
      />
    );

    expect(screen.getByRole('button', { name: /分享判决/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /复制金句/i })).toBeInTheDocument();
  });

  it('should call onShare when share button clicked', async () => {
    render(
      <JudgmentCard
        question="test"
        arenaType="toxic"
        redRatio={0.5}
        blueRatio={0.5}
        topRedComments={['a']}
        topBlueComments={['b']}
        onShare={mockOnShare}
        onCopy={mockOnCopy}
      />
    );

    const shareBtn = screen.getByRole('button', { name: /分享判决/i });
    await userEvent.click(shareBtn);

    expect(mockOnShare).toHaveBeenCalled();
  });

  it('should call onCopy and write to clipboard when copy button clicked', async () => {
    mockClipboardWriteText.mockResolvedValue(undefined);

    render(
      <JudgmentCard
        question="test"
        arenaType="toxic"
        redRatio={0.5}
        blueRatio={0.5}
        topRedComments={['金句1', '金句2']}
        topBlueComments={['金句3']}
        onShare={mockOnShare}
        onCopy={mockOnCopy}
      />
    );

    const copyBtn = screen.getByRole('button', { name: /复制金句/i });
    await userEvent.click(copyBtn);

    expect(mockClipboardWriteText).toHaveBeenCalledWith('金句1\n金句2\n金句3');
    expect(mockOnCopy).toHaveBeenCalled();
  });
});
