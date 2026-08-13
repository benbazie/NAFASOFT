import { useEffect, useRef, useState } from 'react'
import type { MoisPaie, Part } from '../../../shared/types'

/**
 * Graphiques du tableau de bord, dessinés en SVG à la main.
 *
 * Aucune bibliothèque de graphiques : elles pèsent plusieurs centaines de kilo-
 * octets, imposent leur propre palette et donnent à tous les tableaux de bord
 * la même allure. Ici chaque tracé utilise les variables de `:root`, donc suit
 * la marque, et le poids ajouté est nul.
 */

/** Vrai si l'utilisateur a demandé à limiter les animations. */
function animationsReduites(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Compteur qui monte jusqu'à `cible`. Sert aux grands chiffres : la valeur
 * finale reste exacte, seule l'arrivée est progressive.
 */
export function useCompteur(cible: number, duree = 900): number {
  const [valeur, setValeur] = useState(() => (animationsReduites() ? cible : 0))
  const precedent = useRef(cible)

  useEffect(() => {
    if (animationsReduites()) {
      setValeur(cible)
      return
    }
    const depart = precedent.current
    precedent.current = cible
    const t0 = performance.now()
    let brut = 0
    const pas = (t: number): void => {
      const p = Math.min(1, (t - t0) / duree)
      // Sortie douce : rapide au début, freine à l'arrivée.
      const e = 1 - Math.pow(1 - p, 3)
      setValeur(Math.round(depart + (cible - depart) * e))
      if (p < 1) brut = requestAnimationFrame(pas)
    }
    brut = requestAnimationFrame(pas)

    // Filet de sécurité : dans une fenêtre réduite ou en arrière-plan, le
    // navigateur suspend requestAnimationFrame. Sans ce garde-fou, le
    // compteur resterait figé sur sa valeur de départ et afficherait un
    // montant faux · bien pire qu'une animation manquée.
    const secours = setTimeout(() => setValeur(cible), duree + 80)

    return () => {
      cancelAnimationFrame(brut)
      clearTimeout(secours)
    }
  }, [cible, duree])

  return valeur
}

// ------------------------------------------------------------------ courbe

interface CourbeProps {
  mois: MoisPaie[]
  formatValeur: (n: number) => string
}

/**
 * Masse salariale sur douze mois : aire dégradée + ligne, avec survol mois par
 * mois. Le tracé se dessine à l'ouverture (stroke-dashoffset).
 */
export function CourbeMasse({ mois, formatValeur }: CourbeProps): JSX.Element {
  const [survol, setSurvol] = useState<number | null>(null)
  const L = 720
  const H = 210
  const margeH = 34
  const margeB = 26

  const max = Math.max(1, ...mois.map((m) => m.brut))
  const pasX = mois.length > 1 ? (L - margeH * 2) / (mois.length - 1) : 0
  const x = (i: number): number => margeH + i * pasX
  const y = (v: number): number => H - margeB - (v / max) * (H - margeB - 18)

  const points = mois.map((m, i) => `${x(i)},${y(m.brut)}`).join(' ')
  const aire = `M ${x(0)},${H - margeB} L ${points.split(' ').join(' L ')} L ${x(mois.length - 1)},${H - margeB} Z`

  return (
    <div className="graphe">
      <svg viewBox={`0 0 ${L} ${H}`} role="img" aria-label="Masse salariale sur douze mois">
        <defs>
          <linearGradient id="grad-aire" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="aire-haut" />
            <stop offset="100%" className="aire-bas" />
          </linearGradient>
        </defs>

        {/* Lignes de repère horizontales */}
        {[0, 0.5, 1].map((f) => (
          <line key={f} className="g-grille" x1={margeH} x2={L - margeH} y1={y(max * f)} y2={y(max * f)} />
        ))}

        <path className="courbe-aire" d={aire} fill="url(#grad-aire)" />
        <polyline className="courbe-trait" points={points} />

        {mois.map((m, i) => (
          <g key={m.mois}>
            {m.bulletins > 0 && (
              <circle
                className={`courbe-point ${survol === i ? 'actif' : ''}`}
                cx={x(i)}
                cy={y(m.brut)}
                r={survol === i ? 5.5 : 3.5}
              />
            )}
            {/* Le SVG étant mis à l'échelle, la légende rétrécit avec lui : sur
                écran étroit on n'en garde qu'un mois sur deux, agrandi. */}
            <text
              className={`courbe-legende ${i % 2 === 0 ? 'lg-pair' : 'lg-impair'}`}
              x={x(i)}
              y={H - 8}
              textAnchor="middle"
            >
              {m.libelle}
            </text>
            {/* Bande de survol large : viser un point de 3 px serait pénible. */}
            <rect
              className="courbe-zone"
              x={x(i) - pasX / 2}
              y={0}
              width={pasX || L}
              height={H - margeB}
              onMouseEnter={() => setSurvol(i)}
              onMouseLeave={() => setSurvol(null)}
            />
          </g>
        ))}
      </svg>

      <div className={`graphe-infobulle ${survol !== null ? 'visible' : ''}`}>
        {survol !== null && (
          <>
            <span className="gi-mois">{mois[survol].libelle}</span>
            <span className="gi-valeur">{formatValeur(mois[survol].brut)}</span>
            <span className="gi-detail">
              {mois[survol].bulletins} bulletin(s) · net {formatValeur(mois[survol].net)}
            </span>
          </>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ g-anneau

interface Tranche {
  libelle: string
  valeur: number
  teinte: string // nom de classe : an-1, an-2, an-3
}

/**
 * Anneau de répartition. Chaque arc part de zéro à l'affichage : c'est le seul
 * moyen d'animer un `stroke-dasharray` sans recalculer à chaque image.
 */
export function AnneauRepartition({
  tranches,
  centre,
  legende,
  formatValeur
}: {
  tranches: Tranche[]
  centre: string
  legende: string
  formatValeur: (n: number) => string
}): JSX.Element {
  const total = tranches.reduce((t, x) => t + Math.max(0, x.valeur), 0)
  const R = 52
  const C = 2 * Math.PI * R
  let cumul = 0

  return (
    <div className="g-anneau">
      <svg viewBox="0 0 140 140" role="img" aria-label={legende}>
        <circle className="g-anneau-fond" cx="70" cy="70" r={R} />
        {total > 0 &&
          tranches.map((t) => {
            const part = Math.max(0, t.valeur) / total
            const arc = (
              <circle
                key={t.libelle}
                className={`g-anneau-arc ${t.teinte}`}
                cx="70"
                cy="70"
                r={R}
                strokeDasharray={`${part * C} ${C}`}
                strokeDashoffset={-cumul * C}
              />
            )
            cumul += part
            return arc
          })}
        <text className="g-anneau-centre" x="70" y="66" textAnchor="middle">
          {centre}
        </text>
        <text className="g-anneau-sous" x="70" y="82" textAnchor="middle">
          {legende}
        </text>
      </svg>
      <ul className="g-anneau-legende">
        {tranches.map((t) => (
          <li key={t.libelle}>
            <span className={`g-puce ${t.teinte}`} aria-hidden="true" />
            <span className="g-lib">{t.libelle}</span>
            <span className="g-val">{formatValeur(t.valeur)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ------------------------------------------------------------------ g-barres

/** Répartition en g-barres horizontales, remplies à l'affichage. */
export function BarresParts({
  parts,
  unite = ''
}: {
  parts: Part[]
  unite?: string
}): JSX.Element {
  const max = Math.max(1, ...parts.map((p) => p.valeur))
  if (parts.length === 0) return <p className="vide-doux">Aucune donnée à répartir.</p>
  return (
    <ul className="g-barres">
      {parts.map((p, i) => (
        <li key={p.cle} style={{ ['--retard' as string]: `${i * 70}ms` }}>
          <span className="b-lib" title={p.libelle}>
            {p.libelle}
          </span>
          <span className="b-piste">
            <span className="b-remplissage" style={{ ['--part' as string]: `${(p.valeur / max) * 100}%` }} />
          </span>
          <span className="b-val">
            {p.valeur}
            {unite}
          </span>
        </li>
      ))}
    </ul>
  )
}

// ------------------------------------------------------------------- g-jauge

/** Demi-arc de progression, pour un taux exprimé en pourcentage. */
export function JaugeArc({
  taux,
  libelle,
  detail
}: {
  taux: number
  libelle: string
  detail: string
}): JSX.Element {
  const borne = Math.max(0, Math.min(100, taux))
  const R = 56
  // Demi-cercle : la longueur utile vaut π·R, pas 2π·R.
  const longueur = Math.PI * R
  const etat = borne >= 90 ? 'bon' : borne >= 75 ? 'moyen' : 'faible'

  return (
    <div className="g-jauge">
      <svg viewBox="0 0 140 82" role="img" aria-label={`${libelle} : ${borne} %`}>
        <path className="g-jauge-fond" d={`M 14 70 A ${R} ${R} 0 0 1 126 70`} />
        <path
          className={`g-jauge-arc ${etat}`}
          d={`M 14 70 A ${R} ${R} 0 0 1 126 70`}
          strokeDasharray={`${(borne / 100) * longueur} ${longueur}`}
        />
        <text className="g-jauge-valeur" x="70" y="62" textAnchor="middle">
          {borne.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %
        </text>
      </svg>
      <div className="g-jauge-pied">
        <strong>{libelle}</strong>
        <span>{detail}</span>
      </div>
    </div>
  )
}
