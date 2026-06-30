/**
 * Unit tests for AIChatBubble component
 * Verifies chat history loading, message persistence, and clearing
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AIChatBubble } from '@/components/dashboard/ai/chat-bubble';
import { getChatHistory, saveMessages, clearChatHistory } from '@/app/actions/chat-history';
import { useChat } from '@ai-sdk/react';
import type { UIMessage } from 'ai';

jest.mock('@/app/actions/chat-history');
jest.mock('@ai-sdk/react');
jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));
jest.mock('next/navigation', () => ({ usePathname: () => '/test-path' }));
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}));

const mockMsg = (id: string, role: 'user' | 'assistant', text: string): UIMessage =>
  ({ id, role, parts: [{ type: 'text', text }] }) as unknown as UIMessage;

const mockMessages = [mockMsg('1', 'user', 'Hello'), mockMsg('2', 'assistant', 'Hi there')];

describe('AIChatBubble', () => {
  let capturedOnFinish: ((opts: { messages: UIMessage[] }) => void) | undefined;

  const defaultUseChatReturn = {
    messages: [] as UIMessage[],
    status: 'ready' as const,
    sendMessage: jest.fn(),
    setMessages: jest.fn(),
  };

  beforeEach(() => {
    capturedOnFinish = undefined;
    jest.clearAllMocks();
    (getChatHistory as jest.Mock).mockResolvedValue([]);
    (saveMessages as jest.Mock).mockResolvedValue(undefined);
    (clearChatHistory as jest.Mock).mockResolvedValue(undefined);
    (useChat as jest.Mock).mockImplementation((opts: any) => {
      capturedOnFinish = opts?.onFinish;
      return defaultUseChatReturn;
    });
  });

  describe('chat history loading', () => {
    it('calls getChatHistory on mount', async () => {
      render(<AIChatBubble />);
      await waitFor(() => expect(getChatHistory).toHaveBeenCalled());
    });

    it('populates messages via setMessages when history exists', async () => {
      const mockSetMessages = jest.fn();
      (getChatHistory as jest.Mock).mockResolvedValue(mockMessages);
      (useChat as jest.Mock).mockImplementation((opts: any) => {
        capturedOnFinish = opts?.onFinish;
        return { ...defaultUseChatReturn, setMessages: mockSetMessages };
      });

      render(<AIChatBubble />);
      await waitFor(() => expect(mockSetMessages).toHaveBeenCalledWith(mockMessages));
    });

    it('does not call setMessages when history is empty', async () => {
      const mockSetMessages = jest.fn();
      (useChat as jest.Mock).mockImplementation((opts: any) => {
        capturedOnFinish = opts?.onFinish;
        return { ...defaultUseChatReturn, setMessages: mockSetMessages };
      });

      render(<AIChatBubble />);
      await waitFor(() => expect(getChatHistory).toHaveBeenCalled());
      expect(mockSetMessages).not.toHaveBeenCalled();
    });

    it('marks loaded message IDs as saved so onFinish does not re-save them', async () => {
      const mockSetMessages = jest.fn();
      (getChatHistory as jest.Mock).mockResolvedValue(mockMessages);
      (useChat as jest.Mock).mockImplementation((opts: any) => {
        capturedOnFinish = opts?.onFinish;
        return { ...defaultUseChatReturn, setMessages: mockSetMessages };
      });

      render(<AIChatBubble />);
      await waitFor(() => expect(mockSetMessages).toHaveBeenCalledWith(mockMessages));

      // onFinish fires with the same messages that were loaded — none should be saved
      capturedOnFinish!({ messages: mockMessages });
      expect(saveMessages).not.toHaveBeenCalled();
    });
  });

  describe('message persistence via onFinish', () => {
    it('passes onFinish callback to useChat', () => {
      render(<AIChatBubble />);
      expect(capturedOnFinish).toBeInstanceOf(Function);
    });

    it('saves new messages when onFinish fires', async () => {
      render(<AIChatBubble />);
      await waitFor(() => expect(getChatHistory).toHaveBeenCalled());

      const newMsg = mockMsg('new-1', 'user', 'New message');
      capturedOnFinish!({ messages: [newMsg] });

      await waitFor(() => expect(saveMessages).toHaveBeenCalledWith([newMsg]));
    });

    it('saves only unsaved messages — skips messages already loaded from history', async () => {
      const loaded = mockMsg('old', 'user', 'Old');
      const fresh = mockMsg('fresh', 'assistant', 'Fresh');
      const mockSetMessages = jest.fn();

      (getChatHistory as jest.Mock).mockResolvedValue([loaded]);
      (useChat as jest.Mock).mockImplementation((opts: any) => {
        capturedOnFinish = opts?.onFinish;
        return { ...defaultUseChatReturn, setMessages: mockSetMessages };
      });

      render(<AIChatBubble />);
      await waitFor(() => expect(mockSetMessages).toHaveBeenCalledWith([loaded]));

      // onFinish fires with both old + new
      capturedOnFinish!({ messages: [loaded, fresh] });

      await waitFor(() => expect(saveMessages).toHaveBeenCalledWith([fresh]));
      // loaded message should not appear in the save call
      expect(saveMessages).not.toHaveBeenCalledWith(expect.arrayContaining([loaded]));
    });

    it('does not call saveMessages when all messages are already saved', async () => {
      (getChatHistory as jest.Mock).mockResolvedValue(mockMessages);
      const mockSetMessages = jest.fn();
      (useChat as jest.Mock).mockImplementation((opts: any) => {
        capturedOnFinish = opts?.onFinish;
        return { ...defaultUseChatReturn, setMessages: mockSetMessages };
      });

      render(<AIChatBubble />);
      await waitFor(() => expect(mockSetMessages).toHaveBeenCalledWith(mockMessages));

      capturedOnFinish!({ messages: mockMessages });
      expect(saveMessages).not.toHaveBeenCalled();
    });

    it('handles saveMessages rejection gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      (saveMessages as jest.Mock).mockRejectedValue(new Error('Save failed'));

      render(<AIChatBubble />);
      await waitFor(() => expect(getChatHistory).toHaveBeenCalled());

      capturedOnFinish!({ messages: [mockMsg('x', 'user', 'Test')] });

      await waitFor(() =>
        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to save chat messages:', expect.any(Error))
      );
      // Component still renders
      expect(screen.getByRole('button', { name: /chat assistant/i })).toBeInTheDocument();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('clear chat history', () => {
    it('renders clear button in header', async () => {
      (useChat as jest.Mock).mockImplementation((opts: any) => {
        capturedOnFinish = opts?.onFinish;
        return { ...defaultUseChatReturn, messages: mockMessages };
      });

      render(<AIChatBubble />);
      const toggleButton = screen.getByRole('button', { name: /chat assistant/i });
      await userEvent.click(toggleButton);

      expect(screen.getByTitle('Clear conversation')).toBeInTheDocument();
    });

    it('calls clearChatHistory when clear button is clicked', async () => {
      (useChat as jest.Mock).mockImplementation((opts: any) => {
        capturedOnFinish = opts?.onFinish;
        return { ...defaultUseChatReturn, messages: mockMessages };
      });

      render(<AIChatBubble />);
      await userEvent.click(screen.getByRole('button', { name: /chat assistant/i }));
      await userEvent.click(screen.getByTitle('Clear conversation'));

      await waitFor(() => expect(clearChatHistory).toHaveBeenCalled());
    });

    it('resets messages via setMessages([]) when clear is clicked', async () => {
      const mockSetMessages = jest.fn();
      (useChat as jest.Mock).mockImplementation((opts: any) => {
        capturedOnFinish = opts?.onFinish;
        return { ...defaultUseChatReturn, messages: mockMessages, setMessages: mockSetMessages };
      });

      render(<AIChatBubble />);
      await userEvent.click(screen.getByRole('button', { name: /chat assistant/i }));
      await userEvent.click(screen.getByTitle('Clear conversation'));

      await waitFor(() => expect(mockSetMessages).toHaveBeenCalledWith([]));
    });

    it('allows new messages to be saved after clearing', async () => {
      const mockSetMessages = jest.fn();
      (getChatHistory as jest.Mock).mockResolvedValue(mockMessages);
      (useChat as jest.Mock).mockImplementation((opts: any) => {
        capturedOnFinish = opts?.onFinish;
        return { ...defaultUseChatReturn, messages: mockMessages, setMessages: mockSetMessages };
      });

      render(<AIChatBubble />);
      await waitFor(() => expect(mockSetMessages).toHaveBeenCalledWith(mockMessages));

      // Clear the conversation
      await userEvent.click(screen.getByRole('button', { name: /chat assistant/i }));
      await userEvent.click(screen.getByTitle('Clear conversation'));
      await waitFor(() => expect(clearChatHistory).toHaveBeenCalled());

      // After clearing, a new message sent via onFinish should be saved
      (saveMessages as jest.Mock).mockClear();
      const newMsg = mockMsg('post-clear', 'user', 'Fresh start');
      capturedOnFinish!({ messages: [newMsg] });

      await waitFor(() => expect(saveMessages).toHaveBeenCalledWith([newMsg]));
    });
  });

  describe('component initialization', () => {
    it('renders the toggle button', () => {
      render(<AIChatBubble />);
      expect(screen.getByRole('button', { name: /chat assistant/i })).toBeInTheDocument();
    });

    it('opens chat bubble when toggle button is clicked', async () => {
      render(<AIChatBubble />);
      expect(screen.queryByPlaceholderText(/ask your assistant/i)).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: /chat assistant/i }));
      await waitFor(() =>
        expect(screen.getByPlaceholderText(/ask your assistant/i)).toBeInTheDocument()
      );
    });

    it('handles getChatHistory rejection gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      (getChatHistory as jest.Mock).mockRejectedValue(new Error('Load failed'));

      render(<AIChatBubble />);
      await waitFor(() => expect(getChatHistory).toHaveBeenCalled());

      expect(screen.getByRole('button', { name: /chat assistant/i })).toBeInTheDocument();
      await waitFor(() =>
        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load chat history:', expect.any(Error))
      );
      consoleErrorSpy.mockRestore();
    });
  });
});
