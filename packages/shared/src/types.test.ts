import { describe, expect, it } from 'vitest';
import { directConvId } from './types';

describe('directConvId', () => {
  it('is stable regardless of argument order', () => {
    expect(directConvId('user-a', 'user-b')).toBe(directConvId('user-b', 'user-a'));
  });

  it('uses sorted user ids', () => {
    expect(directConvId('zzz', 'aaa')).toBe('direct#aaa#zzz');
  });
});
