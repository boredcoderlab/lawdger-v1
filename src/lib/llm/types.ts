// Shared LLM provider interface — OpenAI-style internally.
// Swapping providers (Gemini ↔ Llama/Ollama) only requires a new adapter.

export type LLMMessageRole = "system" | "user" | "assistant" | "tool";

export interface LLMMessage {
  role: LLMMessageRole;
  content: string;
  /** Only present for role="tool" — matches the tool_call_id from the assistant */
  tool_call_id?: string;
  /** Only present for role="assistant" when the message contains tool calls */
  tool_calls?: LLMToolCall[];
}

export interface LLMToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface LLMTool {
  name: string;
  description: string;
  // JSON Schema object describing the parameters
  parameters: Record<string, unknown>;
}

export interface LLMResponse {
  content: string;
  toolCalls?: LLMToolCall[];
}

export interface LLMProvider {
  chat(messages: LLMMessage[], tools: LLMTool[]): Promise<LLMResponse>;
}
