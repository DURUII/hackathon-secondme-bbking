import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuestionInput } from '@/components/QuestionInput';
import userEvent from '@testing-library/user-event';

describe('QuestionInput', () => {
  const mockOnSubmit = vi.fn();
  const mockOnArenaChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to expand the input
  const expandInput = async () => {
    const trigger = screen.getByText('有什么想让 AI 评评理？');
    await userEvent.click(trigger);
  };

  it('should render collapsed state initially', () => {
    render(
      <QuestionInput
        onSubmit={mockOnSubmit}
        onArenaChange={mockOnArenaChange}
        isLoading={false}
      />
    );

    expect(screen.getByText('有什么想让 AI 评评理？')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('输入你的社交难题...')).not.toBeInTheDocument();
  });

  it('should expand when clicked', async () => {
    render(
      <QuestionInput
        onSubmit={mockOnSubmit}
        onArenaChange={mockOnArenaChange}
        isLoading={false}
      />
    );

    await expandInput();

    expect(screen.getByPlaceholderText('输入你的社交难题...')).toBeInTheDocument();
    expect(screen.getByText('毒舌')).toBeInTheDocument();
    expect(screen.getByText('安慰')).toBeInTheDocument();
    expect(screen.getByText('理性')).toBeInTheDocument();
    expect(screen.getByText('发布')).toBeInTheDocument();
  });

  it('should switch arena when clicked', async () => {
    render(
      <QuestionInput
        onSubmit={mockOnSubmit}
        onArenaChange={mockOnArenaChange}
        isLoading={false}
      />
    );

    await expandInput();

    const comfortBtn = screen.getByText('安慰').closest('button');
    await userEvent.click(comfortBtn!);

    expect(mockOnArenaChange).toHaveBeenCalledWith('comfort');
  });

  it('should show toxic as default arena', async () => {
    render(
      <QuestionInput
        onSubmit={mockOnSubmit}
        onArenaChange={mockOnArenaChange}
        isLoading={false}
      />
    );

    await expandInput();

    const toxicBtn = screen.getByText('毒舌').closest('button');
    // Check if it has selected styles (border-stone-900)
    expect(toxicBtn).toHaveClass('border-stone-900');
  });

  it('should call onSubmit when form is submitted', async () => {
    render(
      <QuestionInput
        onSubmit={mockOnSubmit}
        onArenaChange={mockOnArenaChange}
        isLoading={false}
      />
    );

    await expandInput();

    const textarea = screen.getByPlaceholderText('输入你的社交难题...');
    await userEvent.type(textarea, '相亲男让我AA这杯咖啡');

    const submitBtn = screen.getByText('发布');
    await userEvent.click(submitBtn);

    expect(mockOnSubmit).toHaveBeenCalledWith({
      content: '相亲男让我AA这杯咖啡',
      arenaType: 'toxic',
    });
  });

  it('should not submit empty content', async () => {
    render(
      <QuestionInput
        onSubmit={mockOnSubmit}
        onArenaChange={mockOnArenaChange}
        isLoading={false}
      />
    );

    await expandInput();

    const submitBtn = screen.getByText('发布');
    await userEvent.click(submitBtn);

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('should show loading state when isLoading is true', async () => {
    // Note: isLoading might affect initial render if passed initially? 
    // The component logic says: "if content empty and not loading -> collapse".
    // If loading=true, it shouldn't collapse?
    // Let's test passing isLoading=true to expanded component
    
    // We render with loading=false first to expand, then rerender?
    // Or just pass loading=true and initialContent?
    
    const { rerender } = render(
      <QuestionInput
        onSubmit={mockOnSubmit}
        onArenaChange={mockOnArenaChange}
        isLoading={false}
      />
    );
    
    await expandInput();
    const textarea = screen.getByPlaceholderText('输入你的社交难题...');
    await userEvent.type(textarea, 'test');
    
    rerender(
      <QuestionInput
        onSubmit={mockOnSubmit}
        onArenaChange={mockOnArenaChange}
        isLoading={true}
      />
    );

    const submitBtn = screen.getByRole('button', { name: '发布中' });
    expect(submitBtn).toBeDisabled();
    expect(textarea).toBeDisabled();
  });
});
