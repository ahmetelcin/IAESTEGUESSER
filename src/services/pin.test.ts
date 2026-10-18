import { describe, expect, it } from 'vitest';
import { createPinGate } from './pin';

describe('admin PIN gate', () => {
  it('accepts the right PIN', () => {
    expect(createPinGate('4821').check('4821', 0)).toBe('ok');
  });

  it('rejects a wrong PIN', () => {
    expect(createPinGate('4821').check('1234', 0)).toBe('wrong');
  });

  it('locks after 5 wrong tries, for 30 s', () => {
    const gate = createPinGate('4821');
    for (let i = 0; i < 4; i++) expect(gate.check('0000', 1000)).toBe('wrong');
    expect(gate.check('0000', 1000)).toBe('locked');
    // Even the right PIN is refused while locked.
    expect(gate.check('4821', 20_000)).toBe('locked');
    expect(gate.lockedUntil).toBe(31_000);
    expect(gate.check('4821', 31_000)).toBe('ok');
  });

  it('a success resets the wrong-try counter', () => {
    const gate = createPinGate('4821');
    for (let i = 0; i < 4; i++) gate.check('0000', 0);
    expect(gate.check('4821', 0)).toBe('ok');
    for (let i = 0; i < 4; i++) expect(gate.check('0000', 0)).toBe('wrong');
  });

  it('is unusable without a valid 4-digit PIN configured', () => {
    for (const pin of [undefined, '', '123', '12345', 'abcd']) {
      const gate = createPinGate(pin);
      expect(gate.configured).toBe(false);
      expect(gate.check(pin ?? '', 0)).toBe('unconfigured');
    }
  });
});
