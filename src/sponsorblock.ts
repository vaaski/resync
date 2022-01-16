import { Category } from "sponsorblock-api"

export const allCategories: Array<Category> = [
  "sponsor",
  "intro",
  "outro",
  "interaction",
  "selfpromo",
  "music_offtopic",
  "preview",
]

export type SegmentColorSettings = Partial<Record<Category, string>>
