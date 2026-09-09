export type ChecklistItem = { flag: boolean; detail: string; photo: boolean };
export type ChecklistKey = "defects" | "missingItems" | "packedCorrectly" | "otherPartsUsed" | "otherIssues";

/** Shared by the Server Component page (building `initial`) and the client checklist form — no "use client"/"use server" here, so either can call it. */
export function toItem(flag: boolean | null, detail: string | null, photo: boolean | null): ChecklistItem {
  return { flag: flag ?? false, detail: detail ?? "", photo: photo ?? false };
}
