import { ArrowRight, FileScan, Fingerprint, LockKeyhole, MapPinned } from 'lucide-react'

const researchNeeds = [
  {
    icon: Fingerprint,
    title: 'Provenance and traceability',
    body: 'Keep origin, cataloguing context, collection, and record history connected to the source document.',
  },
  {
    icon: MapPinned,
    title: 'Geographic discovery',
    body: 'Organize research by country, region, site code, site name, project, and historical period.',
  },
  {
    icon: FileScan,
    title: 'Historical digitization',
    body: 'Support scanned material and OCR-assisted discovery while retaining the original archival file.',
  },
  {
    icon: LockKeyhole,
    title: 'Sensitive collections',
    body: 'Restrict unpublished research, exact site information, and culturally sensitive records through enforced access rules.',
  },
]

export function ResearchFitSection() {
  return (
    <section id="research-fit" className="scroll-mt-8 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        <div className="grid overflow-hidden rounded-[2rem] bg-[#263a34] text-white lg:grid-cols-[0.88fr_1.12fr]">
          <div className="relative overflow-hidden border-b border-white/10 p-7 sm:p-12 lg:border-r lg:border-b-0 lg:p-14">
            <div className="absolute -bottom-28 -left-24 size-80 rounded-full border border-amber-200/15" />
            <div className="absolute -bottom-16 -left-16 size-56 rounded-full border border-amber-200/15" />
            <div className="relative">
              <p className="text-xs font-bold tracking-[0.18em] text-amber-200 uppercase">Designed for the discipline</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-balance sm:text-5xl">
                Research records carry meaning beyond the file.
              </h2>
              <p className="mt-6 max-w-xl leading-7 text-emerald-50/75">
                ArcheoECM is structured around the context archaeology and historical research teams need to preserve, discover, and govern their evidence.
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2">
            {researchNeeds.map(({ icon: Icon, title, body }, index) => (
              <article className={`p-7 sm:p-9 ${index % 2 === 0 ? 'sm:border-r sm:border-white/10' : ''} ${index < 2 ? 'border-b border-white/10' : ''}`} key={title}>
                <Icon className="text-amber-200" aria-hidden="true" size={22} strokeWidth={1.7} />
                <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-stone-300">{body}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-6 rounded-2xl border border-stone-200 bg-white p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <p className="text-2xl font-semibold tracking-tight text-stone-900">Give your research a lasting home.</p>
            <p className="mt-2 max-w-2xl leading-7 text-stone-600">Connected records. Discoverable evidence. Knowledge your organization can carry forward.</p>
          </div>
          <a className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#17201e] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#294139] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17201e]" href="#record">
            Explore a research record
            <ArrowRight aria-hidden="true" size={17} />
          </a>
        </div>
      </div>
    </section>
  )
}
