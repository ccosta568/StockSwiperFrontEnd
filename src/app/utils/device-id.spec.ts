import { generateDeviceId } from './device-id';

describe('generateDeviceId', () => {
  it('creates and stores a UUID in localStorage', () => {
    const key = 'stockswiper-device-id';
    localStorage.removeItem(key);
    const id1 = generateDeviceId();
    expect(id1).toBeTruthy();
    const id2 = generateDeviceId();
    expect(id2).toBe(id1);
    const stored = localStorage.getItem(key);
    expect(stored).toBe(id1);
  });
});
