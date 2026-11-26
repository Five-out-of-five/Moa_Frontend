import { z } from "zod";

export const WIDGET_EDIT_HEARTBEAT = 3_000;
export const WIDGET_EDIT_TIMEOUT = 10_000;

const widgetEditing = z.object({
  widgetId: z.number().int().positive(),
  accountId: z.number().int().positive(),
  editing: z.boolean(),
});

type ActiveEditor = { widgetId: number; accountId: number; expiresAt: number };

export function updateWidgetEditors(editors: ActiveEditor[], payload: unknown, myAccountId: number, now: number) {
  const result = widgetEditing.safeParse(payload);
  if (!result.success || result.data.accountId === myAccountId) return editors;
  const { widgetId, accountId, editing } = result.data;
  if (editing) {
    return [
      ...editors.filter((editor) => editor.accountId !== accountId),
      { widgetId, accountId, expiresAt: now + WIDGET_EDIT_TIMEOUT },
    ];
  }
  return editors.filter((editor) => editor.accountId !== accountId || editor.widgetId !== widgetId);
}

export type { ActiveEditor };
