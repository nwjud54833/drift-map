export function KineticText({ text, accent = false, className = "" }: { text: string; accent?: boolean; className?: string }) {
  const words = text.split(" ");
  return (
    <span className={`dm-kinetic ${accent ? "dm-kinetic-accent" : ""} ${className}`} aria-label={text}>
      {words.map((word, wordIndex) => (
        <span key={`${word}-${wordIndex}`} className="dm-kinetic-word" aria-hidden="true">
          {[...word].map((character, characterIndex) => (
            <span key={`${character}-${characterIndex}`} className="dm-kinetic-char" style={{ transitionDelay: `${(wordIndex * 6 + characterIndex) * 18}ms` }}>
              {character}
            </span>
          ))}
          {wordIndex < words.length - 1 ? <span className="dm-kinetic-space" aria-hidden="true">{" "}</span> : null}
        </span>
      ))}
    </span>
  );
}
