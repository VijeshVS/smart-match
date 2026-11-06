import type { LLMProvider } from '@talent-ai/shared-types';
import { config } from '../config.js';
import type { LlmClient, LlmCompletionRequest } from './types.js';

export class ProviderError extends Error {
  readonly statusCode?: number;
  readonly retryable: boolean;

  constructor(message: string, statusCode?: number, retryable = false) {
    super(message);
    this.name = 'ProviderError';
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

interface OpenAiChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

class OpenAiCompatibleClient implements LlmClient {
  readonly provider: LLMProvider;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly endpoint: string;
  private readonly jsonMode: boolean;

  constructor(options: {
    provider: LLMProvider;
    apiKey: string;
    model: string;
    endpoint: string;
    jsonMode: boolean;
  }) {
    this.provider = options.provider;
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.endpoint = options.endpoint;
    this.jsonMode = options.jsonMode;
  }

  async complete(request: LlmCompletionRequest): Promise<string> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: request.system },
          { role: 'user', content: request.prompt },
        ],
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxTokens ?? 1_024,
        ...(this.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: AbortSignal.timeout(config.ai.timeoutMs),
    });

    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 500);
      throw new ProviderError(
        `${this.provider} responded with HTTP ${response.status}${detail ? `: ${detail}` : ''}`,
        response.status,
        response.status === 429 || response.status >= 500,
      );
    }

    const body = (await response.json()) as OpenAiChatResponse;
    const content = body.choices?.[0]?.message?.content;
    if (!content || content.trim().length === 0) {
      throw new ProviderError(`${this.provider} returned an empty completion`);
    }
    return content;
  }
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  promptFeedback?: { blockReason?: string };
}

class GeminiClient implements LlmClient {
  readonly provider = 'gemini' as const;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async complete(request: LlmCompletionRequest): Promise<string> {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent` +
      `?key=${encodeURIComponent(this.apiKey)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.system }] },
        contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
        generationConfig: {
          temperature: request.temperature ?? 0.2,
          maxOutputTokens: request.maxTokens ?? 1_024,
          responseMimeType: 'application/json',
        },
      }),
      signal: AbortSignal.timeout(config.ai.timeoutMs),
    });

    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 500);
      throw new ProviderError(
        `gemini responded with HTTP ${response.status}${detail ? `: ${detail}` : ''}`,
        response.status,
        response.status === 429 || response.status >= 500,
      );
    }

    const body = (await response.json()) as GeminiResponse;
    if (body.promptFeedback?.blockReason) {
      throw new ProviderError(`gemini blocked the prompt: ${body.promptFeedback.blockReason}`);
    }

    const content = (body.candidates?.[0]?.content?.parts ?? [])
      .map((part) => part.text ?? '')
      .join('')
      .trim();

    if (!content) {
      throw new ProviderError('gemini returned an empty completion');
    }
    return content;
  }
}

/** Builds one client per provider that has a configured API key. */
export function createLlmClients(): Map<LLMProvider, LlmClient> {
  const clients = new Map<LLMProvider, LlmClient>();

  if (config.providers.groq.apiKey) {
    clients.set(
      'groq',
      new OpenAiCompatibleClient({
        provider: 'groq',
        apiKey: config.providers.groq.apiKey,
        model: config.providers.groq.model,
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
        jsonMode: false,
      }),
    );
  }

  if (config.providers.openai.apiKey) {
    clients.set(
      'openai',
      new OpenAiCompatibleClient({
        provider: 'openai',
        apiKey: config.providers.openai.apiKey,
        model: config.providers.openai.model,
        endpoint: 'https://api.openai.com/v1/chat/completions',
        jsonMode: true,
      }),
    );
  }

  if (config.providers.gemini.apiKey) {
    clients.set(
      'gemini',
      new GeminiClient(config.providers.gemini.apiKey, config.providers.gemini.model),
    );
  }

  return clients;
}
