import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './styles.css'

const API_BASE = 'http://localhost:3001'
const POLL_MS = 30_000

/* ——— Types mirroring GET /api/analytics/summary ——— */
interface ClickRow {
  element: string
  page: string
  count: number
}
interface FunnelRow {
  step: string
  completed: boolean
  count: number
}
interface CarrierRow {
  carrierId: string
  quotes: number
  avgLatencyMs: number
  winRate: number
}
interface DailyRow {
  date: string
  sessions: number
}
interface Summary {
  clicksByElement: ClickRow[]
  funnel: FunnelRow[]
  carriers: CarrierRow[]
  dailySessions: DailyRow[]
}

type TabId = 'clicks' | 'funnel' | 'carriers' | 'sessions'

const TABS: { id: TabId; label: string }[] = [
  { id: 'clicks', label: 'Clicks by element' },
  { id: 'funnel', label: 'Wizard funnel' },
  { id: 'carriers', label: 'Carrier performance' },
  { id: 'sessions', label: 'Daily sessions' },
]

/* Canonical wizard order (CONTEXT: 5-step wizard + quotes page) */
const FUNNEL_LABELS: Record<string, string> = {
  wizard_step_1: 'Step 1 · Location',
  wizard_step_2: 'Step 2 · Drivers',
  wizard_step_3: 'Step 3 · Vehicle',
  wizard_step_4: 'Step 4 · Coverage',
  wizard_step_5: 'Step 5 · Contact',
  quotes_viewed: 'Quotes viewed',
}
const FUNNEL_ORDER = Object.keys(FUNNEL_LABELS)

const truncate = (s: string, n = 36) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

/* ————————————————— Hand-rolled SVG charts ————————————————— */

function SvgDefs() {
  return (
    <defs>
      <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#6ea8fe" />
        <stop offset="100%" stopColor="#a78bfa" />
      </linearGradient>
      <linearGradient id="barGradientAlt" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#34d399" />
        <stop offset="100%" stopColor="#67e8f9" />
      </linearGradient>
    </defs>
  )
}

function HorizontalBars({
  items,
}: {
  items: { label: string; sub?: string; value: number; format?: (v: number) => string }[]
}) {
  const max = Math.max(1, ...items.map((i) => i.value))
  const rowH = 46
  const height = items.length * rowH + 12
  return (
    <svg viewBox={`0 0 660 ${height}`} className="chart" role="img" aria-label="Horizontal bar chart">
      <SvgDefs />
      {items.map((it, i) => {
        const w = Math.max(4, (it.value / max) * 360)
        const y = 8 + i * rowH
        return (
          <g key={i}>
            <text x={0} y={y + 13} className="chart-label">
              {truncate(it.label)}
            </text>
            {it.sub && (
              <text x={0} y={y + 30} className="chart-sub">
                {truncate(it.sub, 28)}
              </text>
            )}
            <rect x={215} y={y} width={w} height={24} rx={6} className="bar" />
            <text x={215 + w + 8} y={y + 17} className="chart-val">
              {it.format ? it.format(it.value) : it.value.toLocaleString()}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function FunnelBars({ rows }: { rows: { label: string; count: number }[] }) {
  const baseline = Math.max(1, rows[0]?.count ?? 1)
  const max = Math.max(1, ...rows.map((r) => r.count))
  const rowH = 52
  const height = rows.length * rowH + 12
  return (
    <svg viewBox={`0 0 660 ${height}`} className="chart" role="img" aria-label="Wizard funnel chart">
      <SvgDefs />
      {rows.map((r, i) => {
        const w = Math.max(4, (r.count / max) * 330)
        const y = 8 + i * rowH
        const conv = ((r.count / baseline) * 100).toFixed(0)
        return (
          <g key={i}>
            <text x={0} y={y + 14} className="chart-label">
              {r.label}
            </text>
            <text x={0} y={y + 32} className="chart-sub">
              step {i + 1} of {rows.length}
            </text>
            <rect x={215} y={y} width={w} height={26} rx={8} className={i === rows.length - 1 ? 'bar-alt' : 'bar'} />
            <text x={215 + w + 8} y={y + 18} className="chart-val">
              {r.count.toLocaleString()}
            </text>
            <text x={560} y={y + 18} className="funnel-conv">
              {conv}% of entry
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function VerticalBars({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  const bw = 34
  const gap = 22
  const width = Math.max(items.length * (bw + gap) + gap, 320)
  const height = 260
  const plotH = 190
  const base = 30 + plotH
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="chart" role="img" aria-label="Daily sessions bar chart">
      <SvgDefs />
      {items.map((it, i) => {
        const h = Math.max(3, (it.value / max) * plotH)
        const x = gap + i * (bw + gap)
        return (
          <g key={i}>
            <rect x={x} y={base - h} width={bw} height={h} rx={6} className="bar-alt" />
            <text x={x + bw / 2} y={base - h - 6} textAnchor="middle" className="chart-val">
              {it.value}
            </text>
            <text x={x + bw / 2} y={base + 16} textAnchor="middle" className="chart-axis">
              {it.label.slice(5)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/* ————————————————— App ————————————————— */

export default function App() {
  const [tab, setTab] = useState<TabId>('clicks')
  const [data, setData] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [sending, setSending] = useState(false)
  const timer = useRef<number | null>(null)

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/analytics/summary`)
      if (!res.ok) throw new Error(`API responded ${res.status}`)
      const json = (await res.json()) as Partial<Summary>
      setData({
        clicksByElement: json.clicksByElement ?? [],
        funnel: json.funnel ?? [],
        carriers: json.carriers ?? [],
        dailySessions: json.dailySessions ?? [],
      })
      setError(null)
      setLastUpdated(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reach the API')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSummary()
    timer.current = window.setInterval(fetchSummary, POLL_MS)
    return () => {
      if (timer.current) window.clearInterval(timer.current)
    }
  }, [fetchSummary])

  const sendTestEvent = async () => {
    setSending(true)
    try {
      await fetch(`${API_BASE}/api/analytics/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'cta_clicked',
          page: 'dashboard',
          element: 'send-test-event',
          sessionId: `dashboard-${Date.now()}`,
        }),
      })
      await fetchSummary()
    } catch {
      /* banner already shows connection errors */
    } finally {
      setSending(false)
    }
  }

  const hasData = useMemo(() => {
    if (!data) return false
    return (
      data.clicksByElement.length > 0 ||
      data.funnel.length > 0 ||
      data.carriers.length > 0 ||
      data.dailySessions.length > 0
    )
  }, [data])

  const funnelRows = useMemo(() => {
    if (!data) return []
    const rows = data.funnel.map((r) => ({
      label: FUNNEL_LABELS[r.step] ?? r.step,
      count: r.count,
      order: FUNNEL_ORDER.includes(r.step) ? FUNNEL_ORDER.indexOf(r.step) : 99,
    }))
    return rows.sort((a, b) => a.order - b.order)
  }, [data])

  const topClicks = useMemo(
    () => (data ? [...data.clicksByElement].sort((a, b) => b.count - a.count).slice(0, 15) : []),
    [data],
  )

  const sortedCarriers = useMemo(
    () => (data ? [...data.carriers].sort((a, b) => b.quotes - a.quotes) : []),
    [data],
  )

  const dailyRows = useMemo(
    () =>
      (data ? [...data.dailySessions] : [])
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-14)
        .map((d) => ({ label: d.date, value: d.sessions })),
    [data],
  )

  return (
    <div className="app">
      <a className="skip-link" href="#dashboard-main">
        Skip to dashboard content
      </a>

      <header className="topbar">
        <div className="brand">
          <h1>
            QuotePilot <span className="dash-accent">Usage Dashboard</span>
          </h1>
          <p>Clicks · wizard funnel · carrier performance · daily sessions</p>
        </div>
        <div className="topbar-actions">
          {lastUpdated && (
            <span className="last-updated" aria-live="off">
              updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button className="btn" onClick={fetchSummary} aria-label="Refresh dashboard data">
            ↻ Refresh
          </button>
          <button className="btn btn-primary" onClick={sendTestEvent} disabled={sending}>
            {sending ? 'Sending…' : 'Send test event'}
          </button>
        </div>
      </header>

      {error && (
        <div className="error-banner" role="alert">
          <span>
            <strong>API unreachable:</strong> {error}. Is the API running on {API_BASE}?
          </span>
          <button className="btn" onClick={fetchSummary}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="panel">
          <div className="skeleton" aria-label="Loading dashboard data" />
        </div>
      ) : !hasData ? (
        <div className="panel empty">
          <div className="empty-icon" aria-hidden="true">
            📊
          </div>
          <h2>No events yet</h2>
          <p>
            No analytics events recorded so far. Use the main app to generate data — or fire a test event
            from here.
          </p>
          <button className="btn btn-primary" onClick={sendTestEvent} disabled={sending}>
            {sending ? 'Sending…' : 'Send test event'}
          </button>
        </div>
      ) : (
        <>
          <nav className="tabs" role="tablist" aria-label="Dashboard views">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                className="tab"
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <main id="dashboard-main" tabIndex={-1}>
            {tab === 'clicks' && (
              <section className="panel" aria-label="Clicks by element">
                <h2>Clicks by element</h2>
                <p className="panel-sub">Top clicked UI elements across pages (auto-refreshes every 30s).</p>
                {topClicks.length === 0 ? (
                  <p>No click data yet.</p>
                ) : (
                  <HorizontalBars
                    items={topClicks.map((c) => ({
                      label: c.element,
                      sub: c.page,
                      value: c.count,
                    }))}
                  />
                )}
              </section>
            )}

            {tab === 'funnel' && (
              <section className="panel" aria-label="Wizard funnel">
                <h2>Wizard funnel</h2>
                <p className="panel-sub">Step-by-step completion, wizard step 1 → 5 and quotes viewed.</p>
                {funnelRows.length === 0 ? (
                  <p>No funnel data yet.</p>
                ) : (
                  <FunnelBars rows={funnelRows} />
                )}
              </section>
            )}

            {tab === 'carriers' && (
              <section className="panel" aria-label="Carrier performance">
                <h2>Carrier performance</h2>
                <p className="panel-sub">
                  Quotes produced, average adapter latency, and win rate (share of cheapest quotes).
                </p>
                {sortedCarriers.length === 0 ? (
                  <p>No carrier data yet.</p>
                ) : (
                  <div className="table-wrap">
                    <table className="carriers">
                      <thead>
                        <tr>
                          <th scope="col">Carrier</th>
                          <th scope="col">Quotes</th>
                          <th scope="col">Avg latency</th>
                          <th scope="col">Win rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedCarriers.map((c) => {
                          const wr = c.winRate <= 1 ? c.winRate * 100 : c.winRate
                          return (
                            <tr key={c.carrierId}>
                              <td className="carrier-name">{c.carrierId}</td>
                              <td className="num">{c.quotes.toLocaleString()}</td>
                              <td className="num">{Math.round(c.avgLatencyMs).toLocaleString()} ms</td>
                              <td>
                                <span className="winbar">
                                  <span className="winbar-track" aria-hidden="true">
                                    <span
                                      className="winbar-fill"
                                      style={{ width: `${Math.min(100, Math.max(0, wr))}%` }}
                                    />
                                  </span>
                                  <span className="num">{wr.toFixed(1)}%</span>
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {tab === 'sessions' && (
              <section className="panel" aria-label="Daily active sessions">
                <h2>Daily active sessions</h2>
                <p className="panel-sub">Unique sessions per day (last 14 days).</p>
                {dailyRows.length === 0 ? (
                  <p>No session data yet.</p>
                ) : (
                  <VerticalBars items={dailyRows} />
                )}
              </section>
            )}
          </main>
        </>
      )}

      <footer className="footer-note">
        QuotePilot analytics · polls <code>/api/analytics/summary</code> every 30s · no PII is collected or
        displayed
      </footer>
    </div>
  )
}
