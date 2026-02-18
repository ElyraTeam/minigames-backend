export const findMajority = (
  nums: number[],
  totalVotes?: number,
): number | null => {
  if (nums.length === 0) return null;

  let count = 0;
  let candidate: number | null = null;

  // Phase 1: Find candidate
  for (const num of nums) {
    if (count === 0) {
      candidate = num;
      count = 1;
    } else if (num === candidate) {
      count++;
    } else {
      count--;
    }
  }

  // Phase 2: Verify candidate
  count = 0; // RESET COUNT
  for (const num of nums) {
    if (num === candidate) count++;
  }

  // Return candidate if it's a true majority based on provided total or current array length
  const threshold = (totalVotes ?? nums.length) / 2;
  return count > threshold ? candidate : null;
};
