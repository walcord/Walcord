export const bannedWords = [
  "hate", "racist", "nazi", "terrorist", "dick", "pussy", "chink", "motherfucker", "faggot",
  "fuck", "shit", "bitch", "cunt","cock", "cum", "ass", "nigro", "nigga", "whore", "hoe", "slut"
];

export function containsBannedText(input: string) {
  const txt = (input || "").toLowerCase();
  return bannedWords.some(w => txt.includes(w));
}
