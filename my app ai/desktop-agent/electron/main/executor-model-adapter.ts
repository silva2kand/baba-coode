import type { ExecutorModelConfig, ExecutorModelAction, ExecutorToolSchema } from '../../src/types/electron-api'
// OpenAI-compatible fetching
export class ExecutorModelAdapter {
  async generateNextAction(input: {
    config: ExecutorModelConfig;
    messages: Array<{
      role: 'system' | 'user' | 'assistant' | 'tool';
      content: string;
      name?: string;
    }>;
    tools: ExecutorToolSchema[];
  }): Promise<ExecutorModelAction> {
    const { config, messages, tools } = input
    
    // Fallback to openai URL if none specified
    const endpoint = config.baseUrl || 'https://api.openai.com/v1'
    const url = endpoint.endsWith('/') ? `${endpoint}chat/completions` : `${endpoint}/chat/completions`

    const body: any = {
      model: config.model,
      messages: messages,
      tools: tools.length > 0 ? tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description || '',
          parameters: t.parameters
        }
      })) : undefined,
      temperature: config.temperature ?? 0.2,
      max_tokens: config.maxTokens,
      tool_choice: tools.length > 0 ? 'auto' : 'none'
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        throw new Error(`Model request failed: ${response.status} ${response.statusText}`)
      }

      const json = await response.json()
      const message = json.choices?.[0]?.message

      if (!message) {
        throw new Error('No message returned from model')
      }

      if (message.tool_calls && message.tool_calls.length > 0) {
        const toolCall = message.tool_calls[0]
        return {
          type: 'tool_call',
          toolCall: {
            id: toolCall.id,
            name: toolCall.function.name,
            arguments: JSON.parse(toolCall.function.arguments)
          }
        }
      }

      // Distinguish terminal replies from intermediate assistant messages.
      // Empty content between tool turns is NOT terminal — treat it as a pass-through
      // assistant message so the loop requests another action from the model.
      const content = typeof message.content === 'string' ? message.content.trim() : ''
      const isTerminal = content.length > 0 &&
        /(^done\b|task complete|completed successfully|finished successfully|all done|no further|nothing else to do)/i.test(content)

      if (isTerminal) {
        return { type: 'final_completion', content }
      }

      return { type: 'assistant_message', content }
      
    } catch (err: any) {
      console.error('Executor Model Adapter Error:', err)
      throw err
    }
  }
}
