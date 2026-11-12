const questions = [
  ['What makes ArcheoECM relevant to research?', 'A research record needs more than a filename. ArcheoECM connects documents with descriptive context such as site, historical period, collection, and project, helping teams understand where evidence belongs and why it matters.'],
  ['How can existing collections fit into the system?', 'Reports, field records, historical scans, and supporting files can be organized around a consistent classification model. Planning document types and metadata first helps an organization bring its existing material into a useful collection.'],
  ['Can scanned historical documents become searchable?', 'OCR can help make printed text discoverable while the original scan remains part of the record. Results depend on image quality and language; handwriting, damaged pages, and unusual scripts may require human transcription.'],
  ['How does the product support sensitive research?', 'Access controls let an organization determine who can work with particular records and collections. This supports collaboration around unpublished findings and sensitive site information without making every record broadly available.'],
]

export function ProductQuestions() {
  return (
    <section id="questions" className="border-t border-stone-200 bg-white py-20">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[0.7fr_1.3fr] lg:gap-24 lg:px-10">
        <div><p className="text-xs font-bold tracking-[0.18em] text-[#8a682d] uppercase">A closer look</p><h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Built around the questions research teams ask.</h2></div>
        <div className="divide-y divide-stone-200 border-y border-stone-200">
          {questions.map(([question, answer]) => (
            <details key={question} className="group py-5">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 rounded text-lg font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#356653] [&::-webkit-details-marker]:hidden">
                {question}<span aria-hidden="true" className="shrink-0 text-[#8a682d] group-open:rotate-45">+</span>
              </summary>
              <p className="mt-4 max-w-2xl leading-7 text-stone-600">{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
