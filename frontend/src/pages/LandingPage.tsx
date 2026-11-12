import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BookOpenText,
  Boxes,
  Check,
  Clock3,
  FileSearch,
  FileStack,
  Fingerprint,
  History,
  ScanSearch,
  Search,
  ShieldCheck,
  Tags,
  Workflow,
} from 'lucide-react'
import { RecordContextSection } from '../components/RecordContextSection'
import { ResearchFitSection } from '../components/ResearchFitSection'
import { OrganizationValueSection } from '../components/OrganizationValueSection'
import { ProductQuestions } from '../components/ProductQuestions'
import { SiteHeader } from '../components/layout/SiteHeader'

const SIGN_IN_URL = '/sign-in'

const capabilities = [
  {
    icon: FileStack,
    title: 'Document control',
    body: 'Upload research material by document type, retain its versions, and keep the authoritative record clear.',
  },
  {
    icon: Tags,
    title: 'Research classification',
    body: 'Describe records using structured metadata, tags, projects, collections, sites, regions, and periods.',
  },
  {
    icon: ScanSearch,
    title: 'Search and retrieval',
    body: 'Retrieve evidence through metadata, indexes, document content, and OCR-assisted text discovery.',
  },
  {
    icon: Workflow,
    title: 'Review workflow',
    body: 'Move records through submission, review, correction, and approval with a visible process.',
  },
  {
    icon: ShieldCheck,
    title: 'Access governance',
    body: 'Collaborate on shared research while keeping sensitive collections available only to the right people.',
  },
  {
    icon: History,
    title: 'Research continuity',
    body: 'Preserve version history, provenance, and an accountable record of how research material evolves.',
  },
]

const workflow = [
  { number: '01', title: 'Capture', body: 'Bring digital records into a managed repository with a defined document type.' },
  { number: '02', title: 'Describe', body: 'Add research context through metadata, tags, cabinets, and consistent naming.' },
  { number: '03', title: 'Discover', body: 'Search and filter the collection to return the right evidence quickly.' },
  { number: '04', title: 'Trace', body: 'Retain document versions and a clear history as records evolve.' },
]

export function LandingPage() {
  return (
    <div id="top" className="min-h-screen bg-stone-50 text-stone-950">
      <a className="sr-only z-50 rounded bg-white px-4 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3" href="#main-content">
        Skip to content
      </a>
      <SiteHeader />

      <main id="main-content">
        <section className="hero-grid relative overflow-hidden bg-[#17201e] pt-36 text-white sm:pt-40">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_30%,rgba(198,153,78,0.16),transparent_34%)]" />
          <div className="relative mx-auto grid max-w-7xl gap-14 px-5 pb-20 sm:px-8 sm:pb-28 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:gap-20 lg:px-10 lg:pb-32">
            <div>
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-amber-200/20 bg-amber-100/10 px-3.5 py-2 text-xs font-semibold tracking-[0.13em] text-amber-100 uppercase">
                <Fingerprint aria-hidden="true" size={15} />
                Research records with provenance
              </div>
              <h1 className="max-w-4xl text-5xl leading-[1.02] font-semibold tracking-[-0.045em] text-balance sm:text-6xl lg:text-[4.6rem]">
                Preserve the record.<br /><span className="font-serif font-normal italic text-amber-200">Carry the story forward.</span>
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-stone-300 sm:text-xl">
                ArcheoECM helps archaeology and historical research teams collect, classify, review, discover, and preserve the documents behind their work.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-300 px-6 py-3.5 text-sm font-bold text-stone-950 transition hover:bg-amber-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300" href="#record">
                  See the record in context
                  <ArrowRight aria-hidden="true" size={17} />
                </a>
                <a className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-3.5 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" href="#capabilities">
                  Explore the platform
                </a>
              </div>
              <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-stone-300">
                {['Connected context', 'Discoverable evidence', 'Controlled collaboration'].map((item) => (
                  <span className="inline-flex items-center gap-2" key={item}>
                    <Check className="text-amber-300" aria-hidden="true" size={15} strokeWidth={2.5} />
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-xl lg:mx-0">
              <div className="absolute -inset-8 rounded-full bg-amber-200/5 blur-3xl" />
              <div className="relative overflow-hidden rounded-[1.75rem] border border-white/15 bg-white/[0.07] p-3 shadow-2xl shadow-black/20 backdrop-blur">
                <div className="rounded-[1.25rem] bg-stone-50 p-5 text-stone-950 sm:p-7">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-200 pb-5">
                    <div>
                      <p className="text-xs font-semibold tracking-[0.16em] text-stone-500 uppercase">Research collection</p>
                      <h2 className="mt-1 text-xl font-semibold tracking-tight">Collection overview</h2>
                    </div>
                    <span className="rounded-full border border-stone-200 px-3 py-1 text-xs text-stone-500">Product illustration</span>
                  </div>
                  <div className="mt-5 flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 text-stone-500 shadow-sm">
                    <Search aria-hidden="true" size={17} />
                    <span className="text-sm">Search records, metadata, or tags</span>
                  </div>
                  <div className="mt-3 flex gap-2 overflow-hidden text-xs">
                    <span className="rounded-full bg-[#263a34] px-3 py-1.5 font-medium text-white">All records</span>
                    <span className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-stone-600">Fieldwork</span>
                    <span className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-stone-600">Reports</span>
                  </div>
                  <div className="mt-6 grid gap-3">
                    <RecordRow icon={FileSearch} label="Field records" detail="Structured documents" tone="bg-amber-100 text-amber-800" />
                    <RecordRow icon={BookOpenText} label="Research reports" detail="Version-controlled files" tone="bg-emerald-100 text-emerald-800" />
                    <RecordRow icon={Boxes} label="Supporting material" detail="Organized collections" tone="bg-sky-100 text-sky-800" />
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <InfoCard icon={Clock3} title="Version history" body="Track how records change." />
                    <InfoCard icon={ShieldCheck} title="Controlled access" body="Match access to responsibility." />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="capabilities" className="scroll-mt-8 py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <SectionHeading eyebrow="Core capabilities" title="Everything essential to a trustworthy research record" body="ArcheoECM brings the full document lifecycle together, from initial submission and research classification to review, retrieval, and controlled preservation." />
            <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-stone-200 bg-stone-200 md:grid-cols-2 lg:grid-cols-3">
              {capabilities.map(({ icon: Icon, title, body }) => (
                <article className="bg-white p-7 sm:p-8" key={title}>
                  <span className="grid size-11 place-items-center rounded-xl bg-[#e8eee9] text-[#244d3f]">
                    <Icon aria-hidden="true" size={21} strokeWidth={1.8} />
                  </span>
                  <h3 className="mt-6 text-lg font-semibold tracking-tight">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-stone-600">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <RecordContextSection />

        <section id="workflow" className="scroll-mt-8 border-y border-stone-200 bg-white py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
              <SectionHeading eyebrow="A clear record lifecycle" title="From field record to reusable evidence" body="Keep the connection between collection, interpretation, and discovery. A consistent record lifecycle helps teams return to the evidence and understand how it evolved." />
              <ol className="grid gap-8 sm:grid-cols-2">
                {workflow.map((step) => (
                  <li className="border-t border-stone-300 pt-5" key={step.number}>
                    <span className="font-mono text-xs font-semibold tracking-widest text-[#8a682d]">{step.number}</span>
                    <h3 className="mt-3 text-xl font-semibold tracking-tight">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-stone-600">{step.body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <OrganizationValueSection />

        <ResearchFitSection />
        <ProductQuestions />
      </main>

      <footer className="border-t border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-sm text-stone-500 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <p><span className="font-semibold text-stone-800">ArcheoECM</span> · Heritage document management</p>
          <Link className="font-medium text-stone-600 transition hover:text-stone-950" to={SIGN_IN_URL}>Organization sign in</Link>
        </div>
      </footer>
    </div>
  )
}

type IconComponent = typeof FileSearch

function RecordRow({ icon: Icon, label, detail, tone }: { icon: IconComponent; label: string; detail: string; tone: string }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-stone-200 bg-white p-3.5">
      <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${tone}`}>
        <Icon aria-hidden="true" size={19} strokeWidth={1.9} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{label}</p>
        <p className="mt-0.5 truncate text-xs text-stone-500">{detail}</p>
      </div>
    </div>
  )
}

function InfoCard({ icon: Icon, title, body }: { icon: IconComponent; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <Icon className="text-stone-500" aria-hidden="true" size={18} />
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5 text-stone-500">{body}</p>
    </div>
  )
}

function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-bold tracking-[0.18em] text-[#8a682d] uppercase">{eyebrow}</p>
      <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-balance sm:text-4xl">{title}</h2>
      <p className="mt-5 max-w-2xl leading-7 text-stone-600">{body}</p>
    </div>
  )
}
