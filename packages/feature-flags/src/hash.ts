export function hash32(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function stickyPercentBucket(flagId: string, customerId: string): number {
  return hash32(`${flagId}:${customerId}`) % 100;
}