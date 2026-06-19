export const NOTE_CATEGORIES = ["General Note", "Client Update", "Next Date", "Task"] as const;
export type NoteCategory = (typeof NOTE_CATEGORIES)[number];
