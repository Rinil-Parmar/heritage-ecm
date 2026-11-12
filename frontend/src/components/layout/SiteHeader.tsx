import { Archive, ArrowUpRight } from 'lucide-react'

const SIGN_IN_URL = '/sign-in'

export function SiteHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-20 border-b border-white/10">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
        <a className="flex items-center gap-3 text-white" href="#top" aria-label="ArcheoECM home">
          <span className="grid size-10 place-items-center rounded-xl border border-white/15 bg-white/10">
            <Archive aria-hidden="true" size={21} strokeWidth={1.8} />
          </span>
          <span>
            <span className="block text-[0.69rem] font-semibold tracking-[0.22em] text-stone-300 uppercase">Heritage records</span>
            <span className="block text-lg font-semibold tracking-tight">ArcheoECM</span>
          </span>
        </a>

        <nav className="hidden items-center gap-8 text-sm font-medium text-stone-300 md:flex" aria-label="Main navigation">
          <a className="transition hover:text-white" href="#capabilities">Capabilities</a>
          <a className="transition hover:text-white" href="#record">Record model</a>
          <a className="transition hover:text-white" href="#value">Why ArcheoECM</a>
        </nav>

        <a
          className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
          href={SIGN_IN_URL}
        >
          Sign in
          <ArrowUpRight aria-hidden="true" size={16} />
        </a>
      </div>
    </header>
  )
}
