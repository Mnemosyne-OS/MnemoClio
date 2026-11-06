/** An iframe served an older SDK build (no onAgentActions) warns and serves nothing: never a crash. */
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./host', () => ({ inShell: () => true, sdk: {} }));
const { ClioAgentActions } = await import('./ClioAgentActions');

describe('ClioAgentActions', () => {
  it('an SDK build without onAgentActions is warned about, never a crash', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => render(<ClioAgentActions {...({} as unknown as Parameters<typeof ClioAgentActions>[0])} />)).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no onAgentActions'));
    warn.mockRestore();
  });
});
