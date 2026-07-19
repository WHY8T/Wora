export const Session = {
  cookieName: "wora_sid",
  maxAgeMs: 365 * 24 * 60 * 60 * 1000,
} as const;

export const ErrorMessages = {
  unauthenticated: "Authentication required",
  insufficientRole: "Insufficient permissions",
} as const;

export const Paths = {
  login: "/login",
} as const;

export const GENRES = [
  "Fiction",
  "Fantasy",
  "Sci-Fi",
  "Mystery",
  "Thriller",
  "Romance",
  "Horror",
  "Historical Fiction",
  "Young Adult",
  "Classics",
  "Non-Fiction",
  "Biography",
  "Science",
  "Self-Help",
  "Poetry",
  "Graphic Novels",
] as const;

export const COMMUNITY_COLORS = [
  "#b45309",
  "#0f766e",
  "#1d4ed8",
  "#a21caf",
  "#be123c",
  "#4d7c0f",
  "#0e7490",
  "#7c2d12",
] as const;
