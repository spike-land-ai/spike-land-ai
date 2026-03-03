export function CareerHero() {
  return (
    <section className="relative overflow-hidden py-24 px-4">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/10 to-transparent" />
      <div className="relative container mx-auto text-center max-w-3xl">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
          Discover Your Ideal Career Path
        </h1>
        <p className="text-lg text-zinc-300 mb-8 leading-relaxed">
          Powered by the European Skills, Competences, Qualifications and Occupations (ESCO)
          framework. Assess your skills, explore occupations, and find your perfect career match.
        </p>
      </div>
    </section>
  );
}
