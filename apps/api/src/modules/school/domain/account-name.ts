/* One rule for "does the bank's account name look like this school", shared by the preview (verify) and the real setup,
   so the screen can never say "matches" while saving flags a mismatch. */
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w.length > 2);

export function accountNameMatchesSchool(schoolName: string, accountName: string): boolean {
    const schoolWords = new Set(words(schoolName));
    return words(accountName).some(w => schoolWords.has(w));
}
