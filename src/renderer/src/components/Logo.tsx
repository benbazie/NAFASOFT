import { useId } from 'react'

/**
 * Marque Nafasoft : emblème hexagonal · un « N » doré sur un hexagone bleu
 * cerclé d'or. Signe de la maison d'édition, décliné sur chaque logiciel.
 *
 * SVG en ligne · net à toute taille, aucune ressource à charger. Les
 * identifiants de dégradé sont préfixés par `useId` : plusieurs marques peuvent
 * coexister sur la même page (portail, barre latérale) sans collision d'id.
 */
export function MarqueNafasoft({
  size = 64,
  className = ''
}: {
  size?: number
  className?: string
}): JSX.Element {
  const uid = useId().replace(/:/g, '')
  const hex = `hex-${uid}`
  const or = `or-${uid}`
  // Hexagone pointe-en-haut, centré, inséré de sorte que le liseré ne touche
  // jamais le bord du cadre.
  const contour = '100,12 176,56 176,144 100,188 24,144 24,56'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={className}
      role="img"
      aria-label="Nafasoft"
    >
      <defs>
        <linearGradient id={hex} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2f6bff" />
          <stop offset="1" stopColor="#081f63" />
        </linearGradient>
        <linearGradient id={or} x1="0.15" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor="#ffe487" />
          <stop offset="0.5" stopColor="#f4b820" />
          <stop offset="1" stopColor="#cf8605" />
        </linearGradient>
      </defs>
      <polygon points={contour} fill={`url(#${hex})`} />
      {/* Reflet en haut de l'hexagone, pour le relief */}
      <polygon points="100,12 176,56 176,80 24,80 24,56" fill="#ffffff" opacity="0.07" />
      <polygon points={contour} fill="none" stroke={`url(#${or})`} strokeWidth="5" strokeLinejoin="round" />
      {/* Monogramme N : deux montants blancs, diagonale dorée */}
      <line x1="75" y1="70" x2="125" y2="130" stroke={`url(#${or})`} strokeWidth="18" strokeLinecap="round" />
      <rect x="66" y="62" width="17" height="76" rx="4" fill="#ffffff" />
      <rect x="117" y="62" width="17" height="76" rx="4" fill="#ffffff" />
    </svg>
  )
}

/** Mot-symbole « Nafasoft » : « Nafa » clair, « soft » doré. */
export function MotNafasoft({ className = '' }: { className?: string }): JSX.Element {
  return (
    <span className={`nafa-mot ${className}`}>
      Nafa<span className="nafa-soft">soft</span>
    </span>
  )
}
