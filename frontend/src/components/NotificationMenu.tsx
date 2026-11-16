import { useEffect, useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getNotifications, readAllNotifications, readNotification, type NotificationItem } from '../api/notifications'

function when(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function NotificationMenu({ csrf }: { csrf: string }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [error, setError] = useState('')

  function load(signal?: AbortSignal) {
    getNotifications(signal).then(data => { setItems(data.results); setUnread(data.unread); setError('') })
      .catch(() => { if (!signal?.aborted) setError('Notifications are temporarily unavailable.') })
  }
  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [])

  async function openItem(item: NotificationItem) {
    if (!item.read_at) {
      await readNotification(item.id, csrf).catch(() => undefined)
      setUnread(value => Math.max(0, value - 1))
      setItems(current => current.map(row => row.id === item.id ? { ...row, read_at: new Date().toISOString() } : row))
    }
    setOpen(false)
    if (item.document_id) navigate(`/app/documents/${item.document_id}`)
  }

  async function markAll() {
    await readAllNotifications(csrf)
    setUnread(0)
    setItems(current => current.map(item => ({ ...item, read_at: item.read_at || new Date().toISOString() })))
  }

  return <div className="relative">
    <button onClick={() => { setOpen(value => !value); if (!open) load() }} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open} className="relative grid size-9 place-items-center rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50"><Bell aria-hidden size={17} />{unread > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-5 rounded-full bg-red-600 px-1 text-center text-[0.65rem] font-bold leading-5 text-white">{unread > 99 ? '99+' : unread}</span>}</button>
    {open && <div className="absolute top-12 right-0 z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl">
      <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-5 py-4"><div><h2 className="text-sm font-semibold">Notifications</h2><p className="mt-0.5 text-xs text-stone-500">{unread} unread</p></div>{unread > 0 && <button onClick={markAll} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#365d4d] hover:underline"><CheckCheck aria-hidden size={14} />Mark all read</button>}</div>
      {error ? <p role="alert" className="p-5 text-sm text-red-700">{error}</p> : !items.length ? <p className="p-8 text-center text-sm text-stone-500">You’re all caught up.</p> : <ul className="max-h-96 divide-y divide-stone-100 overflow-y-auto">{items.map(item => <li key={item.id}><button onClick={() => openItem(item)} className={`block w-full px-5 py-4 text-left hover:bg-stone-50 ${item.read_at ? '' : 'bg-emerald-50/50'}`}><span className="flex items-start gap-3"><span className={`mt-1 size-2 shrink-0 rounded-full ${item.read_at ? 'bg-stone-200' : 'bg-emerald-600'}`} /><span><span className="block text-sm font-semibold">{item.title}</span><span className="mt-1 block text-xs leading-5 text-stone-600">{item.body}</span><span className="mt-2 block text-[0.68rem] text-stone-400">{when(item.created_at)}</span></span></span></button></li>)}</ul>}
    </div>}
  </div>
}
