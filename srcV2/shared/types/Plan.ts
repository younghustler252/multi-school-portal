export type Plan = 
  | "FREE"
  | "BASIC"
  | "PRO";

// optional helper array for Mongoose enum
export const Plans: Plan[] = ["FREE", "BASIC", "PRO"];