import { signDocUrls } from '@/utils/storage';

describe('signDocUrls', () => {
  it('signs matching records in one Storage call and preserves unmatched URLs', async () => {
    const createSignedUrls = jest.fn().mockResolvedValue({
      data: [{ path: 'one.pdf', signedUrl: 'https://signed/one.pdf', error: null }],
    });
    const supabase = { storage: { from: jest.fn(() => ({ createSignedUrls })) } };
    const docs = [
      { id: '1', file_url: 'https://example/storage/v1/object/public/vendor-documents/one.pdf' },
      { id: '2', file_url: 'https://example.com/external.pdf' },
      { id: '3', file_url: 'https://example/storage/v1/object/public/vendor-documents/missing.pdf' },
    ];

    await expect(signDocUrls(supabase as any, 'vendor-documents', docs)).resolves.toEqual([
      { id: '1', file_url: 'https://signed/one.pdf' },
      docs[1],
      docs[2],
    ]);
    expect(createSignedUrls).toHaveBeenCalledWith(['one.pdf', 'missing.pdf'], 3600);
  });

  it('does not call Storage when there are no matching URLs', async () => {
    const createSignedUrls = jest.fn();
    const supabase = { storage: { from: jest.fn(() => ({ createSignedUrls })) } };
    const docs = [{ file_url: 'https://example.com/external.pdf' }];

    await expect(signDocUrls(supabase as any, 'vendor-documents', docs)).resolves.toEqual(docs);
    expect(createSignedUrls).not.toHaveBeenCalled();
  });
});
