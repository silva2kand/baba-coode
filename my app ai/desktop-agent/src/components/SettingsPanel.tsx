import { queryEngine } from '../lib/query-engine'

export function SettingsPanel() {
  const providers = queryEngine.getProviders()

  return (
    <section className="p-4">
      <h2 className="mb-3 text-sm font-semibold">Providers</h2>
      <div className="space-y-2">
        {providers.length === 0 ? (
          <div className="text-sm opacity-70">No providers registered.</div>
        ) : (
          providers.map((provider) => (
            <div key={provider.id} className="rounded border border-gray-700 p-2 text-sm">
              <div>{provider.name}</div>
              <div className="text-xs opacity-70">{provider.available ? 'connected' : 'available (not connected)'}</div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
