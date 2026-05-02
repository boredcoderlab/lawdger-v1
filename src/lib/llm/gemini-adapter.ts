import {
  GoogleGenerativeAI,
  Content,
  Part,
  FunctionDeclaration,
  Tool as GeminiTool,
  FunctionCallingMode,
} from "@google/generative-ai";
import type { LLMMessage, LLMTool, LLMResponse, LLMProvider, LLMToolCall } from "./types";

export class GeminiAdapter implements LLMProvider {
  private client: GoogleGenerativeAI;
  private modelName: string;

  constructor(apiKey: string, modelName = "gemini-2.5-flash") {
    this.client = new GoogleGenerativeAI(apiKey);
    this.modelName = modelName;
  }

  async chat(messages: LLMMessage[], tools: LLMTool[]): Promise<LLMResponse> {
    // Extract system message (Gemini handles it separately)
    const systemMessage = messages.find((m) => m.role === "system");
    const conversationMessages = messages.filter((m) => m.role !== "system");

    // Convert tools → Gemini FunctionDeclarations
    const functionDeclarations: FunctionDeclaration[] = tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters as FunctionDeclaration["parameters"],
    }));

    const geminiTools: GeminiTool[] = functionDeclarations.length > 0
      ? [{ functionDeclarations }]
      : [];

    const model = this.client.getGenerativeModel({
      model: this.modelName,
      systemInstruction: systemMessage?.content,
      tools: geminiTools.length > 0 ? geminiTools : undefined,
      toolConfig: geminiTools.length > 0
        ? { functionCallingConfig: { mode: FunctionCallingMode.AUTO } }
        : undefined,
    });

    // Convert OpenAI-style messages → Gemini Content[]
    const contents: Content[] = this.toGeminiContents(conversationMessages);

    const result = await model.generateContent({ contents });
    const response = result.response;

    // Check for function calls in the response
    const toolCalls: LLMToolCall[] = [];
    const candidate = response.candidates?.[0];

    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.functionCall) {
          toolCalls.push({
            id: `call_${part.functionCall.name}_${Date.now()}`,
            name: part.functionCall.name,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            args: (part.functionCall.args as Record<string, any>) ?? {},
          });
        }
      }
    }

    const textContent = response.text() ?? "";

    return {
      content: textContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  private toGeminiContents(messages: LLMMessage[]): Content[] {
    const contents: Content[] = [];

    for (const msg of messages) {
      if (msg.role === "user") {
        contents.push({ role: "user", parts: [{ text: msg.content }] });
      } else if (msg.role === "assistant") {
        const parts: Part[] = [];
        // Text content (may be empty when only tool calls)
        if (msg.content) {
          parts.push({ text: msg.content });
        }
        // Tool calls from assistant turn
        if (msg.tool_calls) {
          for (const tc of msg.tool_calls) {
            parts.push({
              functionCall: { name: tc.name, args: tc.args },
            });
          }
        }
        if (parts.length > 0) {
          contents.push({ role: "model", parts });
        }
      } else if (msg.role === "tool") {
        // Gemini expects function responses in the user role
        // Find the corresponding tool call name from the tool_call_id
        // We encode the name into the id as "call_{name}_{ts}"
        const name = msg.tool_call_id?.replace(/^call_/, "").replace(/_\d+$/, "") ?? "unknown";
        contents.push({
          role: "user",
          parts: [
            {
              functionResponse: {
                name,
                response: { result: msg.content },
              },
            },
          ],
        });
      }
    }

    return contents;
  }
}
