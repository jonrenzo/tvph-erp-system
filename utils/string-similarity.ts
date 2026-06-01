export function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,    // Deletion
          dp[i][j - 1] + 1,    // Insertion
          dp[i - 1][j - 1] + 1 // Substitution
        );
      }
    }
  }
  return dp[m][n];
}

/**
 * Calculates a similarity score between two strings, from 0.0 (totally different) to 1.0 (identical).
 * Normalizes input strings by removing special characters and lowercasing.
 */
export function stringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  const s2 = str2.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;

  const dist = levenshteinDistance(s1, s2);
  const maxLen = Math.max(s1.length, s2.length);
  return 1.0 - dist / maxLen;
}
