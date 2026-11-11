const outcomes = [
  { number: '01', title: 'Keep knowledge beyond the project.', body: 'Give future teams the records and context they need to build on earlier research—even when people, projects, and priorities change.' },
  { number: '02', title: 'Make evidence easier to find.', body: 'Bring reports, scans, and supporting material into a connected collection. Follow the site, period, or project instead of remembering a filename.' },
  { number: '03', title: 'Share with confidence.', body: 'Support collaboration while controlling access to unpublished findings and sensitive collections. Keep responsibility connected to the record.' },
]

export function OrganizationValueSection() {
  return (
    <section id="value" className="bg-[#17201e] py-20 text-white sm:py-28">
      <div className="mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-24 lg:px-10">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-amber-200 uppercase">Built for lasting institutional knowledge</p>
          <h2 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">Research moves forward.<br /><span className="font-serif font-normal italic text-amber-200">Its context should come with it.</span></h2>
          <p className="mt-7 leading-7 text-stone-300">For research departments, archives, and heritage teams, the value of a collection grows when its evidence remains understandable and usable.</p>
        </div>
        <div className="divide-y divide-white/15 border-y border-white/15">
          {outcomes.map((item) => (
            <article key={item.number} className="grid grid-cols-[2rem_1fr] gap-5 py-8 sm:gap-8">
              <span className="pt-1 font-mono text-sm text-amber-200">{item.number}</span>
              <div><h3 className="text-xl font-semibold sm:text-2xl">{item.title}</h3><p className="mt-3 leading-7 text-stone-300">{item.body}</p></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
