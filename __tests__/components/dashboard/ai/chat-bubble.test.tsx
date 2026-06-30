/**
 * Unit tests for AIChatBubble component
 * Verifies chat history loading, message persistence, and clearing
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AIChatBubble } from '@/components/dashboard/ai/chat-bubble';
import { getChatHistory, saveMessages, clearChatHistory } from '@/app/actions/chat-history';
import { useChat } from '@ai-sdk/react';
import type { UIMessage } from 'ai';

// Mock dependencies
jest.mock('@/app/actions/chat-history');
jest.mock('@ai-sdk/react');
jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));
jest.mock('next/navigation', () => ({
  usePathname: () => '/test-path',
}));
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}));

describe('AIChatBubble', () => {
  const mockMessages: UIMessage[] = [
    { id: '1', role: 'user', content: 'Hello' },
    { id: '2', role: 'assistant', content: 'Hi there' },
  ];

  const defaultUseChatReturn = {
    messages: [],
    status: 'ready' as const,
    sendMessage: jest.fn(),
    setMessages: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getChatHistory as jest.Mock).mockResolvedValue([]);
    (saveMessages as jest.Mock).mockResolvedValue(undefined);
    (clearChatHistory as jest.Mock).mockResolvedValue(undefined);
    (useChat as jest.Mock).mockReturnValue(defaultUseChatReturn);
  });

  describe('chat history loading', () => {
    it('calls getChatHistory on mount', async () => {
      render(<AIChatBubble />);

      await waitFor(() => {
        expect(getChatHistory).toHaveBeenCalled();
      });
    });

    it('loads chat history and populates messages on mount', async () => {
      const mockSetMessages = jest.fn();
      (getChatHistory as jest.Mock).mockResolvedValue(mockMessages);
      (useChat as jest.Mock).mockReturnValue({
        ...defaultUseChatReturn,
        setMessages: mockSetMessages,
      });

      render(<AIChatBubble />);

      await waitFor(() => {
        expect(mockSetMessages).toHaveBeenCalledWith(mockMessages);
      });
    });

    it('does not call setMessages when history is empty', async () => {
      const mockSetMessages = jest.fn();
      (getChatHistory as jest.Mock).mockResolvedValue([]);
      (useChat as jest.Mock).mockReturnValue({
        ...defaultUseChatReturn,
        setMessages: mockSetMessages,
      });

      render(<AIChatBubble />);

      await waitFor(() => {
        expect(getChatHistory).toHaveBeenCalled();
      });

      expect(mockSetMessages).not.toHaveBeenCalled();
    });

    it('marks loaded message IDs as saved in savedIdsRef', async () => {
      const mockSetMessages = jest.fn();
      (getChatHistory as jest.Mock).mockResolvedValue(mockMessages);
      (useChat as jest.Mock).mockReturnValue({
        ...defaultUseChatReturn,
        setMessages: mockSetMessages,
      });

      render(<AIChatBubble />);

      await waitFor(() => {
        expect(mockSetMessages).toHaveBeenCalled();
      });

      // Verify that after loading, the component would not re-save these messages
      // This is verified by checking saveMessages is not called when status changes
      // We'll test this in the next test
    });
  });

  describe('message persistence', () => {
    it('saves unsaved messages when status transitions to ready', async () => {
      const newMessage: UIMessage = {
        id: 'new-msg-1',
        role: 'user',
        content: 'New message',
      };

      const mockSetMessages = jest.fn();
      let useChatState = {
        ...defaultUseChatReturn,
        messages: [],
        status: 'submitted' as const,
        setMessages: mockSetMessages,
      };

      const useChatMock = jest.fn(() => useChatState);
      (useChat as jest.Mock).mockImplementation(useChatMock);
      (getChatHistory as jest.Mock).mockResolvedValue([]);

      const { rerender } = render(<AIChatBubble />);

      await waitFor(() => {
        expect(getChatHistory).toHaveBeenCalled();
      });

      // Simulate status change to 'ready' with a new message
      useChatState = {
        ...useChatState,
        messages: [newMessage],
        status: 'ready',
      };
      useChatMock.mockReturnValue(useChatState);

      rerender(<AIChatBubble />);

      await waitFor(() => {
        expect(saveMessages).toHaveBeenCalledWith([newMessage]);
      });
    });

    it('does not save messages that were already loaded from history', async () => {
      const mockSetMessages = jest.fn();
      let useChatState = {
        ...defaultUseChatReturn,
        messages: mockMessages,
        status: 'ready' as const,
        setMessages: mockSetMessages,
      };

      const useChatMock = jest.fn(() => useChatState);
      (useChat as jest.Mock).mockImplementation(useChatMock);
      (getChatHistory as jest.Mock).mockResolvedValue(mockMessages);

      render(<AIChatBubble />);

      await waitFor(() => {
        expect(mockSetMessages).toHaveBeenCalledWith(mockMessages);
      });

      // Status is already 'ready', so no transition should trigger a save
      expect(saveMessages).not.toHaveBeenCalled();
    });

    it('saves only unsaved messages on status transition to ready', async () => {
      const savedMessage: UIMessage = {
        id: '1',
        role: 'user',
        content: 'Old message',
      };
      const newMessage: UIMessage = {
        id: 'new',
        role: 'assistant',
        content: 'New message',
      };

      const mockSetMessages = jest.fn();
      let useChatState = {
        ...defaultUseChatReturn,
        messages: [],
        status: 'submitted' as const,
        setMessages: mockSetMessages,
      };

      const useChatMock = jest.fn(() => useChatState);
      (useChat as jest.Mock).mockImplementation(useChatMock);
      (getChatHistory as jest.Mock).mockResolvedValue([savedMessage]);

      const { rerender } = render(<AIChatBubble />);

      await waitFor(() => {
        expect(mockSetMessages).toHaveBeenCalledWith([savedMessage]);
      });

      // Transition to ready with both old and new message
      useChatState = {
        ...useChatState,
        messages: [savedMessage, newMessage],
        status: 'ready',
      };
      useChatMock.mockReturnValue(useChatState);

      rerender(<AIChatBubble />);

      await waitFor(() => {
        // Should only save the new message, not the one loaded from history
        expect(saveMessages).toHaveBeenCalledWith([newMessage]);
      });
    });

    it('does not save empty message array on status transition', async () => {
      const mockSetMessages = jest.fn();
      let useChatState = {
        ...defaultUseChatReturn,
        messages: [],
        status: 'submitted' as const,
        setMessages: mockSetMessages,
      };

      const useChatMock = jest.fn(() => useChatState);
      (useChat as jest.Mock).mockImplementation(useChatMock);
      (getChatHistory as jest.Mock).mockResolvedValue([]);

      const { rerender } = render(<AIChatBubble />);

      await waitFor(() => {
        expect(getChatHistory).toHaveBeenCalled();
      });

      // Transition to ready with no messages
      useChatState = {
        ...useChatState,
        status: 'ready',
        messages: [],
      };
      useChatMock.mockReturnValue(useChatState);

      rerender(<AIChatBubble />);

      // saveMessages should not be called if there are no new messages
      expect(saveMessages).not.toHaveBeenCalled();
    });
  });

  describe('clear chat history', () => {
    it('renders clear button in header', async () => {
      (useChat as jest.Mock).mockReturnValue({
        ...defaultUseChatReturn,
        messages: mockMessages,
      });

      render(<AIChatBubble />);

      // Open the chat bubble
      const toggleButton = screen.getByRole('button', { name: /chat assistant/i });
      await userEvent.click(toggleButton);

      // Look for the trash icon button or element with clear title
      const clearButton = screen.getByTitle('Clear conversation');
      expect(clearButton).toBeInTheDocument();
    });

    it('calls clearChatHistory when clear button is clicked', async () => {
      const mockSetMessages = jest.fn();
      (useChat as jest.Mock).mockReturnValue({
        ...defaultUseChatReturn,
        messages: mockMessages,
        setMessages: mockSetMessages,
      });

      render(<AIChatBubble />);

      // Open the chat bubble
      const toggleButton = screen.getByRole('button', { name: /chat assistant/i });
      await userEvent.click(toggleButton);

      // Click the clear button
      const clearButton = screen.getByTitle('Clear conversation');
      await userEvent.click(clearButton);

      await waitFor(() => {
        expect(clearChatHistory).toHaveBeenCalled();
      });
    });

    it('resets messages when clear button is clicked', async () => {
      const mockSetMessages = jest.fn();
      (useChat as jest.Mock).mockReturnValue({
        ...defaultUseChatReturn,
        messages: mockMessages,
        setMessages: mockSetMessages,
      });

      render(<AIChatBubble />);

      // Open the chat bubble
      const toggleButton = screen.getByRole('button', { name: /chat assistant/i });
      await userEvent.click(toggleButton);

      // Click the clear button
      const clearButton = screen.getByTitle('Clear conversation');
      await userEvent.click(clearButton);

      await waitFor(() => {
        expect(mockSetMessages).toHaveBeenCalledWith([]);
      });
    });

    it('clears savedIdsRef when clear button is clicked', async () => {
      const mockSetMessages = jest.fn();
      (useChat as jest.Mock).mockReturnValue({
        ...defaultUseChatReturn,
        messages: mockMessages,
        setMessages: mockSetMessages,
      });
      (getChatHistory as jest.Mock).mockResolvedValue(mockMessages);

      const { rerender } = render(<AIChatBubble />);

      await waitFor(() => {
        expect(mockSetMessages).toHaveBeenCalledWith(mockMessages);
      });

      // Open the chat bubble
      const toggleButton = screen.getByRole('button', { name: /chat assistant/i });
      await userEvent.click(toggleButton);

      // Click the clear button
      const clearButton = screen.getByTitle('Clear conversation');
      await userEvent.click(clearButton);

      await waitFor(() => {
        expect(clearChatHistory).toHaveBeenCalled();
      });

      // After clearing, if status transitions to ready with new message,
      // it should not be marked as saved anymore
      const newMessage: UIMessage = {
        id: 'new-msg',
        role: 'user',
        content: 'After clear',
      };

      let useChatState = {
        ...defaultUseChatReturn,
        messages: [newMessage],
        status: 'submitted' as const,
        setMessages: mockSetMessages,
      };

      const useChatMock = jest.fn(() => useChatState);
      (useChat as jest.Mock).mockImplementation(useChatMock);

      rerender(<AIChatBubble />);

      // Reset mock to start fresh for this phase
      (saveMessages as jest.Mock).mockClear();

      // Transition to ready
      useChatState.status = 'ready';
      useChatMock.mockReturnValue(useChatState);

      rerender(<AIChatBubble />);

      await waitFor(() => {
        expect(saveMessages).toHaveBeenCalledWith([newMessage]);
      });
    });
  });

  describe('component initialization', () => {
    it('renders toggle button', () => {
      render(<AIChatBubble />);

      // The toggle button should always be rendered
      const toggleButton = screen.getByRole('button', {
        name: /chat assistant/i,
      });
      expect(toggleButton).toBeInTheDocument();
    });

    it('opens chat bubble when toggle button is clicked', async () => {
      const mockSetMessages = jest.fn();
      (useChat as jest.Mock).mockReturnValue({
        ...defaultUseChatReturn,
        setMessages: mockSetMessages,
      });

      render(<AIChatBubble />);

      expect(screen.queryByPlaceholderText(/ask your assistant/i)).not.toBeInTheDocument();

      const toggleButton = screen.getByRole('button', { name: /chat assistant/i });
      await userEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/ask your assistant/i)).toBeInTheDocument();
      });
    });
  });

  describe('edge cases', () => {
    it('handles getChatHistory rejection gracefully', async () => {
      const mockSetMessages = jest.fn();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      (getChatHistory as jest.Mock).mockRejectedValue(new Error('Load failed'));
      (useChat as jest.Mock).mockReturnValue({
        ...defaultUseChatReturn,
        setMessages: mockSetMessages,
      });

      render(<AIChatBubble />);

      await waitFor(() => {
        expect(getChatHistory).toHaveBeenCalled();
      });

      // Component should still render
      expect(screen.getByRole('button', { name: /chat assistant/i })).toBeInTheDocument();

      // Error should be logged
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to load chat history:',
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });

    it('handles saveMessages rejection gracefully', async () => {
      const mockSetMessages = jest.fn();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const newMessage: UIMessage = {
        id: 'msg-1',
        role: 'user',
        content: 'Test',
      };

      let useChatState = {
        ...defaultUseChatReturn,
        messages: [],
        status: 'submitted' as const,
        setMessages: mockSetMessages,
      };

      const useChatMock = jest.fn(() => useChatState);
      (useChat as jest.Mock).mockImplementation(useChatMock);
      (getChatHistory as jest.Mock).mockResolvedValue([]);
      (saveMessages as jest.Mock).mockRejectedValue(new Error('Save failed'));

      const { rerender } = render(<AIChatBubble />);

      await waitFor(() => {
        expect(getChatHistory).toHaveBeenCalled();
      });

      // Transition to ready
      useChatState = {
        ...useChatState,
        messages: [newMessage],
        status: 'ready',
      };
      useChatMock.mockReturnValue(useChatState);

      rerender(<AIChatBubble />);

      // Error should be logged
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to save chat messages:',
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });
  });
});
