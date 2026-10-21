import Anthropic from "@anthropic-ai/sdk";
import { ASSISTANT_PROMPT } from "@/lib/assistantPrompt";

type ChatMessage = { role: "user" | "assistant"; content: string };

function errorStatus(error: unknown) {
  if (typeof error === "object" && error !== null && "status" in error) return String(error.status);
  return "unknown";
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
    return Response.json({ error: "no-key" }, { status: 503 });
  }
  let body: { messages?: unknown; labState?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!Array.isArray(body.messages)) return Response.json({ error: "Messages are required." }, { status: 400 });
  const receivedMessages: ChatMessage[] = body.messages.slice(-20).flatMap((message): ChatMessage[] => {
    if (!message || typeof message !== "object") return [];
    const item = message as Record<string, unknown>;
    if ((item.role !== "user" && item.role !== "assistant") || typeof item.content !== "string") return [];
    return [{ role: item.role, content: item.content.slice(0, 8000) }];
  });
  const firstUserIndex = receivedMessages.findIndex((message) => message.role === "user");
  const messages = firstUserIndex < 0 ? [] : receivedMessages.slice(firstUserIndex).reduce<ChatMessage[]>((merged, message) => {
    const previous = merged[merged.length - 1];
    if (previous?.role === message.role) {
      previous.content = `${previous.content}\n\n${message.content}`.slice(-8000);
    } else {
      merged.push({ ...message });
    }
    return merged;
  }, []);
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

  if (process.env.ANTHROPIC_API_KEY) {
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
    } catch (error) {
      console.error(`Anthropic assistant request failed with status ${errorStatus(error)}`);
      return Response.json({ error: "The assistant could not respond right now. Check your API key and model, then try again." }, { status: 502 });
    }
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
        max_tokens: 1500,
        messages: [{ role: "system", content: ASSISTANT_PROMPT }, ...messages],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      console.error(`OpenAI assistant request failed with status ${response.status}`);
      return Response.json({ error: "The assistant could not respond right now. Check your API key and model, then try again." }, { status: 502 });
    }
    const result = await response.json() as { choices?: { message?: { content?: unknown } }[] };
    const reply = result.choices?.[0]?.message?.content;
    if (typeof reply !== "string") {
      console.error(`OpenAI assistant response had no text content (status ${response.status})`);
      return Response.json({ error: "The assistant could not respond right now. Check your API key and model, then try again." }, { status: 502 });
    }
    return Response.json({ reply });
  } catch (error) {
    console.error(`OpenAI assistant request failed with status ${errorStatus(error)}`);
    return Response.json({ error: "The assistant could not respond right now. Check your API key and model, then try again." }, { status: 502 });
  }
}
