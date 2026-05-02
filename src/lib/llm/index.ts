import type { LLMProvider } from "./types";
import { GeminiAdapter } from "./gemini-adapter";

function createProvider(): LLMProvider {
  const provider = process.env.LLM_PROVIDER ?? "gemini";

  if (provider === "openai_compatible") {
    // Dynamic import to avoid bundling OpenAI SDK when not needed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const OpenAI = require("openai");
    const client = new OpenAI.default({
      baseURL: process.env.LLM_BASE_URL ?? "http://localhost:11434/v1",
      apiKey: process.env.LLM_API_KEY ?? "ollama",
    });
    const model = process.env.LLM_MODEL ?? "llama3.1:8b";

    // Thin OpenAI-compatible wrapper
    return {
      async chat(messages, tools) {
        const openaiTools = tools.map((t) => ({
          type: "function" as const,
          function: { name: t.name, description: t.description, parameters: t.parameters },
        }));

        const response = await client.chat.completions.create({
          model,
          messages,
          tools: openaiTools.length > 0 ? openaiTools : undefined,
          tool_choice: openaiTools.length > 0 ? "auto" : undefined,
        });

        const choice = response.choices[0];
        const toolCalls = choice.message.tool_calls?.map(
          (tc: { id: string; function: { name: string; arguments: string } }) => ({
            id: tc.id,
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments),
          })
        );

        return {
          content: choice.message.content ?? "",
          toolCalls,
        };
      },
    };
  }

  // Default: Gemini
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY is not set");
  return new GeminiAdapter(apiKey);
}

export const llm: LLMProvider = createProvider();
