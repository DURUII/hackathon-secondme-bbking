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
    const trigger = screen.getByText(/发布一个没有标答的辩题/);
    await userEvent.click(trigger);
  };

  it('should render collapsed state initially', () => {
    render(
      <QuestionInput
        onSubmit={mockOnSubmit}
        isLoading={false}
      />
    );

    expect(screen.getByText(/发布一个没有标答的辩题/)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('请输入你需要大家评理的事情经过...')).not.toBeInTheDocument();
  });

  it('should expand when clicked', async () => {
    render(
      <QuestionInput
        onSubmit={mockOnSubmit}
        isLoading={false}
      />
    );

    await expandInput();

    expect(screen.getByPlaceholderText('请输入你需要大家评理的事情经过...')).toBeInTheDocument();
    expect(screen.getByText('发布话题')).toBeInTheDocument();
  });

  it('should call onSubmit when form is submitted', async () => {
    render(
      <QuestionInput
        onSubmit={mockOnSubmit}
        isLoading={false}
      />
    );

    await expandInput();

    const textarea = screen.getByPlaceholderText('请输入你需要大家评理的事情经过...');
    await userEvent.type(textarea, '相亲男让我AA这杯咖啡');

    const submitBtn = screen.getByText('发布话题');
    await userEvent.click(submitBtn);

    expect(mockOnSubmit).toHaveBeenCalledWith({
      content: '相亲男让我AA这杯咖啡',
    });
  });

  it('should not submit empty content', async () => {
    render(
      <QuestionInput
        onSubmit={mockOnSubmit}
        isLoading={false}
      />
    );

    await expandInput();

    const submitBtn = screen.getByText('发布话题');
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
        isLoading={false}
      />
    );
    
    await expandInput();
    const textarea = screen.getByPlaceholderText('请输入你需要大家评理的事情经过...');
    await userEvent.type(textarea, 'test');
    
    rerender(
      <QuestionInput
        onSubmit={mockOnSubmit}
        isLoading={true}
      />
    );

    const submitBtn = screen.getByRole('button', { name: '发布中' });
    expect(submitBtn).toBeDisabled();
    expect(textarea).toBeDisabled();
  });
});
