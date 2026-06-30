/** @jest-environment node */

/**
 * Unit tests for chat history server actions
 * Verifies getChatHistory, saveMessages, and clearChatHistory
 */

import { getChatHistory, saveMessages, clearChatHistory } from '@/app/actions/chat-history';
import { createClient } from '@/utils/supabase/server';
import type { UIMessage } from 'ai';

// UIMessage uses parts[], not content — cast opaque blobs for DB layer tests
const mockMsg = (id: string, role: 'user' | 'assistant', text: string): UIMessage =>
  ({ id, role, parts: [{ type: 'text', text }] }) as unknown as UIMessage;

jest.mock('@/utils/supabase/server');

describe('chat-history server actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getChatHistory', () => {
    describe('happy path', () => {
      it('returns messages in chronological order (oldest first)', async () => {
        const mockMessages = [
          { message: mockMsg('3', 'user', 'Latest') },
          { message: mockMsg('2', 'assistant', 'Middle') },
          { message: mockMsg('1', 'user', 'Oldest') },
        ];

        const mockSupabase = {
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: { id: 'user-123' } },
            }),
          },
          from: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({
                    data: mockMessages,
                  }),
                }),
              }),
            }),
          }),
        };

        (createClient as jest.Mock).mockResolvedValue(mockSupabase);

        const result = await getChatHistory();

        // Should be reversed (oldest first)
        expect(result).toHaveLength(3);
        expect(result[0].id).toBe('1');
        expect(result[1].id).toBe('2');
        expect(result[2].id).toBe('3');
      });

      it('returns messages with correct UIMessage structure', async () => {
        const mockMessage = mockMsg('msg-1', 'user', 'Hello');

        const mockSupabase = {
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: { id: 'user-123' } },
            }),
          },
          from: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({
                    data: [{ message: mockMessage }],
                  }),
                }),
              }),
            }),
          }),
        };

        (createClient as jest.Mock).mockResolvedValue(mockSupabase);

        const result = await getChatHistory();

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(mockMessage);
      });

      it('limits to 50 messages', async () => {
        const mockSupabase = {
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: { id: 'user-123' } },
            }),
          },
          from: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({
                    data: [],
                  }),
                }),
              }),
            }),
          }),
        };

        (createClient as jest.Mock).mockResolvedValue(mockSupabase);

        await getChatHistory();

        // Verify limit(50) was called
        const limitCall = mockSupabase.from().select().eq().order().limit;
        expect(limitCall).toHaveBeenCalledWith(50);
      });
    });

    describe('edge cases', () => {
      it('returns empty array when user is not authenticated', async () => {
        const mockSupabase = {
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: null },
            }),
          },
        };

        (createClient as jest.Mock).mockResolvedValue(mockSupabase);

        const result = await getChatHistory();

        expect(result).toEqual([]);
      });

      it('returns empty array when no messages exist', async () => {
        const mockSupabase = {
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: { id: 'user-123' } },
            }),
          },
          from: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({
                    data: null,
                  }),
                }),
              }),
            }),
          }),
        };

        (createClient as jest.Mock).mockResolvedValue(mockSupabase);

        const result = await getChatHistory();

        expect(result).toEqual([]);
      });

      it('handles empty data array', async () => {
        const mockSupabase = {
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: { id: 'user-123' } },
            }),
          },
          from: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({
                    data: [],
                  }),
                }),
              }),
            }),
          }),
        };

        (createClient as jest.Mock).mockResolvedValue(mockSupabase);

        const result = await getChatHistory();

        expect(result).toEqual([]);
      });

      it('queries with correct user_id filter', async () => {
        const userId = 'user-specific-id';
        const mockSupabase = {
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: { id: userId } },
            }),
          },
          from: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({
                    data: [],
                  }),
                }),
              }),
            }),
          }),
        };

        (createClient as jest.Mock).mockResolvedValue(mockSupabase);

        await getChatHistory();

        expect(mockSupabase.from().select().eq).toHaveBeenCalledWith('user_id', userId);
      });

      it('queries from chat_messages table', async () => {
        const mockSupabase = {
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: { id: 'user-123' } },
            }),
          },
          from: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({
                    data: [],
                  }),
                }),
              }),
            }),
          }),
        };

        (createClient as jest.Mock).mockResolvedValue(mockSupabase);

        await getChatHistory();

        expect(mockSupabase.from).toHaveBeenCalledWith('chat_messages');
      });

      it('orders by created_at descending', async () => {
        const mockSupabase = {
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: { id: 'user-123' } },
            }),
          },
          from: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({
                    data: [],
                  }),
                }),
              }),
            }),
          }),
        };

        (createClient as jest.Mock).mockResolvedValue(mockSupabase);

        await getChatHistory();

        const orderCall = mockSupabase.from().select().eq().order;
        expect(orderCall).toHaveBeenCalledWith('created_at', { ascending: false });
      });
    });
  });

  describe('saveMessages', () => {
    describe('happy path', () => {
      it('upserts messages with correct shape', async () => {
        const messages = [mockMsg('msg-1', 'user', 'Hello'), mockMsg('msg-2', 'assistant', 'Hi there')];

        const mockSupabase = {
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: { id: 'user-123' } },
            }),
          },
          from: jest.fn().mockReturnValue({
            upsert: jest.fn().mockResolvedValue({}),
          }),
        };

        (createClient as jest.Mock).mockResolvedValue(mockSupabase);

        await saveMessages(messages);

        expect(mockSupabase.from).toHaveBeenCalledWith('chat_messages');
        expect(mockSupabase.from().upsert).toHaveBeenCalledWith(
          [
            { id: 'msg-1', user_id: 'user-123', message: messages[0] },
            { id: 'msg-2', user_id: 'user-123', message: messages[1] },
          ],
          { onConflict: 'id' }
        );
      });

      it('preserves full UIMessage structure in upsert', async () => {
        const messages = [mockMsg('msg-1', 'user', 'Test content')];

        const mockSupabase = {
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: { id: 'user-123' } },
            }),
          },
          from: jest.fn().mockReturnValue({
            upsert: jest.fn().mockResolvedValue({}),
          }),
        };

        (createClient as jest.Mock).mockResolvedValue(mockSupabase);

        await saveMessages(messages);

        const upsertCall = mockSupabase.from().upsert.mock.calls[0][0];
        expect(upsertCall[0].message).toEqual(messages[0]);
      });

      it('handles multiple messages', async () => {
        const messages = Array.from({ length: 10 }, (_, i) =>
          mockMsg(`msg-${i}`, i % 2 === 0 ? 'user' : 'assistant', `Message ${i}`));

        const mockSupabase = {
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: { id: 'user-123' } },
            }),
          },
          from: jest.fn().mockReturnValue({
            upsert: jest.fn().mockResolvedValue({}),
          }),
        };

        (createClient as jest.Mock).mockResolvedValue(mockSupabase);

        await saveMessages(messages);

        const upsertCall = mockSupabase.from().upsert.mock.calls[0][0];
        expect(upsertCall).toHaveLength(10);
      });
    });

    describe('edge cases', () => {
      it('returns early when user is not authenticated', async () => {
        const messages = [mockMsg('msg-1', 'user', 'Hello')];

        const mockSupabase = {
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: null },
            }),
          },
          from: jest.fn(),
        };

        (createClient as jest.Mock).mockResolvedValue(mockSupabase);

        await saveMessages(messages);

        // Should not call from() when user is null
        expect(mockSupabase.from).not.toHaveBeenCalled();
      });

      it('handles empty message array', async () => {
        const messages: UIMessage[] = [];

        const mockSupabase = {
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: { id: 'user-123' } },
            }),
          },
          from: jest.fn().mockReturnValue({
            upsert: jest.fn().mockResolvedValue({}),
          }),
        };

        (createClient as jest.Mock).mockResolvedValue(mockSupabase);

        await saveMessages(messages);

        expect(mockSupabase.from().upsert).toHaveBeenCalledWith([], { onConflict: 'id' });
      });

      it('includes user_id for each message', async () => {
        const userId = 'specific-user-id';
        const messages = [mockMsg('msg-1', 'user', 'Hello'), mockMsg('msg-2', 'assistant', 'Hi')];

        const mockSupabase = {
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: { id: userId } },
            }),
          },
          from: jest.fn().mockReturnValue({
            upsert: jest.fn().mockResolvedValue({}),
          }),
        };

        (createClient as jest.Mock).mockResolvedValue(mockSupabase);

        await saveMessages(messages);

        const upsertCall = mockSupabase.from().upsert.mock.calls[0][0];
        upsertCall.forEach((record: any) => {
          expect(record.user_id).toBe(userId);
        });
      });
    });
  });

  describe('clearChatHistory', () => {
    describe('happy path', () => {
      it('deletes all messages for the user', async () => {
        const mockSupabase = {
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: { id: 'user-123' } },
            }),
          },
          from: jest.fn().mockReturnValue({
            delete: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({}),
            }),
          }),
        };

        (createClient as jest.Mock).mockResolvedValue(mockSupabase);

        await clearChatHistory();

        expect(mockSupabase.from).toHaveBeenCalledWith('chat_messages');
        expect(mockSupabase.from().delete().eq).toHaveBeenCalledWith('user_id', 'user-123');
      });

      it('deletes with correct user_id', async () => {
        const userId = 'specific-user-delete-id';
        const mockSupabase = {
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: { id: userId } },
            }),
          },
          from: jest.fn().mockReturnValue({
            delete: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({}),
            }),
          }),
        };

        (createClient as jest.Mock).mockResolvedValue(mockSupabase);

        await clearChatHistory();

        expect(mockSupabase.from().delete().eq).toHaveBeenCalledWith('user_id', userId);
      });
    });

    describe('edge cases', () => {
      it('returns early when user is not authenticated', async () => {
        const mockSupabase = {
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: null },
            }),
          },
          from: jest.fn(),
        };

        (createClient as jest.Mock).mockResolvedValue(mockSupabase);

        await clearChatHistory();

        // Should not call from() when user is null
        expect(mockSupabase.from).not.toHaveBeenCalled();
      });

      it('queries from chat_messages table', async () => {
        const mockSupabase = {
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: { id: 'user-123' } },
            }),
          },
          from: jest.fn().mockReturnValue({
            delete: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({}),
            }),
          }),
        };

        (createClient as jest.Mock).mockResolvedValue(mockSupabase);

        await clearChatHistory();

        expect(mockSupabase.from).toHaveBeenCalledWith('chat_messages');
      });
    });
  });
});
