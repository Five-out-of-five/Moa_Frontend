import { z } from "zod";

const reference = z.object({ id: z.number().int().positive(), title: z.string() });
const references = z.object({ cards: z.array(reference), tasks: z.array(reference), votes: z.array(reference) });
const assistantEvent = z.discriminatedUnion("event", [
  z.object({ event: z.literal("delta"), data: z.object({ text: z.string() }) }),
  z.object({ event: z.literal("references"), data: references }),
  z.object({ event: z.literal("done"), data: z.object({ messageId: z.union([z.number(), z.string()]), status: z.enum(["COMPLETED", "PARTIAL"]) }) }),
  z.object({ event: z.literal("error"), data: z.object({ code: z.string() }) }),
]);

export function parseReferences(value: unknown) {
  try {
    const result = references.safeParse(typeof value === "string" ? JSON.parse(value) : value);
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

export function encodeAssistantEvent(event: z.infer<typeof assistantEvent>) {
  return new TextEncoder().encode(`event:${event.event}\ndata:${JSON.stringify(event.data)}\n\n`);
}

export async function* readAssistantEvents(body: ReadableStream<Uint8Array>, onChunk: () => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const separator = /\r?\n\r?\n/;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      onChunk();
      buffer += decoder.decode(value, { stream: true });
      let boundary: RegExpExecArray | null;
      while ((boundary = separator.exec(buffer))) {
        const block = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const event = /^event:(.*)$/m.exec(block)?.[1]?.trim();
        const data = /^data:(.*)$/m.exec(block)?.[1];
        if (!event || !data) continue;
        const parsed = assistantEvent.safeParse({ event, data: JSON.parse(data) });
        if (parsed.success) yield parsed.data;
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
