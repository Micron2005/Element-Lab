import Anthropic from "@anthropic-ai/sdk";
import { ASSISTANT_PROMPT } from "@/lib/assistantPrompt";

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "no-key" }, { status: 503 });
  let body: { messages?: unknown; labState?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!Array.isArray(body.messages)) return Response.json({ error: "Messages are required." }, { status: 400 });
  const messages: ChatMessage[] = body.messages.slice(-20).flatMap((message): ChatMessage[] => {
    if (!message || typeof message !== "object") return [];
    const item = message as Record<string, unknown>;
    if ((item.role !== "user" && item.role !== "assistant") || typeof item.content !== "string") return [];
    return [{ role: item.role, content: item.content.slice(0, 8000) }];
  });
  if (!messages.length) return Response.json({ error: "Add a message before sending." }, { status: 400 });
  if (typeof body.labState === "string" && body.labState.length) {
    const latestUser = messages.findLastIndex((message) => message.role === "user");
    if (latestUser >= 0) {
      messages[latestUser] = {
        ...messages[latestUser],
        content: `CURRENT LAB STATE:\n${body.labState.slice(0, 8000)}\n\nQUESTION:\n${messages[latestUser].content}`,
      };
    }
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
      max_tokens: 1500,
      system: ASSISTANT_PROMPT,
      messages,
    });
    const reply = response.content.filter((block) => block.type === "text").map((block) => block.text).join("\n");
    return Response.json({ reply });
  } catch {
    return Response.json({ error: "The assistant could not respond right now. Check your API key and model, then try again." }, { status: 502 });
  }
}
