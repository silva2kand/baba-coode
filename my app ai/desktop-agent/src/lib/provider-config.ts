export type ProviderConnectionConfig = {
  apiKey: string
  baseUrl?: string
  model?: string
}

const STORAGE_KEY = 'silva-provider-configs'

export function loadProviderConfigs(): Record<string, ProviderConnectionConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw) as Record<string, ProviderConnectionConfig>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function getProviderConfig(providerId: string): ProviderConnectionConfig | null {
  const map = loadProviderConfigs()
  return map[providerId] ?? null
}

export function saveProviderConfig(providerId: string, config: ProviderConnectionConfig) {
  const map = loadProviderConfigs()
  map[providerId] = {
    apiKey: config.apiKey || '',
    baseUrl: config.baseUrl || '',
    model: config.model || '',
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}

export function removeProviderConfig(providerId: string) {
  const map = loadProviderConfigs()
  delete map[providerId]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}

