import {
  CalendarDays,
  CheckCircle2,
  FileText,
  GitBranch,
  MapPin,
  Tag,
} from 'lucide-react'

const contextPoints = [
  'A controlled file with its versions kept together',
  'Metadata that preserves archaeological context',
  'Tags and collections that support later discovery',
]

export function RecordContextSection() {
  return (
    <section id="record" className="scroll-mt-8 overflow-hidden bg-[#eee9df] py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:gap-20 lg:px-10">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-[#8a682d] uppercase">One record, complete context</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-balance sm:text-5xl">
            A document becomes useful when its story stays attached.
          </h2>
          <p className="mt-6 max-w-xl text-lg leading-8 text-stone-600">
            ArcheoECM brings the file, descriptive metadata, classification, and version history into one record so evidence remains understandable after the fieldwork ends.
          </p>
          <ul className="mt-8 space-y-4">
            {contextPoints.map((point) => (
              <li className="flex items-start gap-3 text-sm leading-6 text-stone-700" key={point}>
                <CheckCircle2 className="mt-0.5 shrink-0 text-[#356653]" aria-hidden="true" size={19} />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <div className="absolute -top-16 -right-16 size-48 rounded-full bg-amber-300/25 blur-3xl" />
          <div className="relative overflow-hidden rounded-[1.75rem] border border-stone-300/80 bg-[#f9f8f4] shadow-[0_24px_80px_rgba(67,54,36,0.14)]">
            <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4 sm:px-7">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-[#356653]" />
                <span className="text-xs font-semibold tracking-[0.14em] text-stone-500 uppercase">Illustrative record view</span>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">Current version</span>
            </div>

            <div className="grid md:grid-cols-[0.84fr_1.16fr]">
              <div className="relative min-h-96 overflow-hidden bg-[#cbbd9f] p-7 sm:p-9">
                <div className="strata-lines absolute inset-x-0 bottom-0 h-40 opacity-45" />
                <div className="relative mx-auto flex min-h-72 max-w-64 flex-col rounded-sm bg-[#fffdf7] p-7 shadow-2xl shadow-stone-800/20">
                  <div className="flex items-center justify-between border-b-2 border-stone-800 pb-3">
                    <span className="text-[0.62rem] font-black tracking-[0.18em] uppercase">Field record</span>
                    <FileText aria-hidden="true" size={15} />
                  </div>
                  <p className="mt-7 text-xs font-semibold text-stone-500">Record reference</p>
                  <p className="mt-1 font-mono text-lg font-bold tracking-tight">ARC-SAMPLE-014</p>
                  <div className="mt-6 space-y-3">
                    <div className="h-2 rounded bg-stone-200" />
                    <div className="h-2 w-4/5 rounded bg-stone-200" />
                    <div className="h-2 w-11/12 rounded bg-stone-200" />
                  </div>
                  <div className="mt-auto border-t border-dashed border-stone-300 pt-4 text-[0.65rem] text-stone-500">
                    Example content for interface preview
                  </div>
                </div>
              </div>

              <div className="p-6 sm:p-8">
                <p className="text-xs font-semibold tracking-[0.15em] text-stone-500 uppercase">Record details</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight">Field observation record</h3>
                <p className="mt-2 text-sm leading-6 text-stone-500">A structured example showing how document information can appear to an authorized researcher.</p>

                <dl className="mt-7 grid gap-5 sm:grid-cols-2">
                  <MetadataItem icon={MapPin} term="Collection" value="Survey records" />
                  <MetadataItem icon={CalendarDays} term="Record date" value="Sample date" />
                  <MetadataItem icon={Tag} term="Document type" value="Field record" />
                  <MetadataItem icon={GitBranch} term="Version" value="Version 1" />
                </dl>

                <div className="mt-8 border-t border-stone-200 pt-6">
                  <p className="text-xs font-semibold tracking-[0.15em] text-stone-500 uppercase">Classification</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {['Fieldwork', 'Observation', 'Research record'].map((tag) => (
                      <span className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700" key={tag}>{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

type IconComponent = typeof MapPin

function MetadataItem({ icon: Icon, term, value }: { icon: IconComponent; term: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-stone-100 text-stone-600">
        <Icon aria-hidden="true" size={17} />
      </span>
      <div>
        <dt className="text-xs text-stone-500">{term}</dt>
        <dd className="mt-1 text-sm font-semibold text-stone-800">{value}</dd>
      </div>
    </div>
  )
}
