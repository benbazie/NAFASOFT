/**
 * Jeu d'icônes de l'application · SVG en ligne, trait cohérent (1,7 px, bouts
 * arrondis), `currentColor`. Un seul style pour toute la navigation, à la place
 * des glyphes Unicode disparates.
 */
export type NomIcone =
  | 'dashboard'
  | 'employes'
  | 'contrats'
  | 'dossiers'
  | 'planning'
  | 'pointage'
  | 'heures'
  | 'conges'
  | 'ajustements'
  | 'paie'
  | 'declarations'
  | 'parametres'
  | 'utilisateurs'
  | 'recherche'
  | 'deconnexion'
  | 'chevron'
  | 'entreprise'
  | 'portefeuille'
  | 'plus'
  | 'alerte'
  | 'archive'
  | 'crayon'
  | 'poubelle'
  | 'bascule'

const TRACES: Record<NomIcone, JSX.Element> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7.5" height="8.5" rx="1.6" />
      <rect x="13.5" y="3" width="7.5" height="5" rx="1.6" />
      <rect x="13.5" y="11.5" width="7.5" height="9.5" rx="1.6" />
      <rect x="3" y="15" width="7.5" height="6" rx="1.6" />
    </>
  ),
  employes: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c0-3 2.6-5 5.5-5s5.5 2 5.5 5" />
      <path d="M16.5 5.4a3.2 3.2 0 0 1 0 6.1" />
      <path d="M18 15.2c2.2.5 3.6 2.3 3.6 4.8" />
    </>
  ),
  contrats: (
    <>
      <path d="M6.5 3h6.5l5 5v12a1 1 0 0 1-1 1H6.5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M13 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 16.5h4" />
    </>
  ),
  dossiers: (
    <>
      <path d="M3 7.5a1 1 0 0 1 1-1h4.6l2 2H20a1 1 0 0 1 1 1v8.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
    </>
  ),
  planning: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5h17" />
      <path d="M8 3.2v3.4" />
      <path d="M16 3.2v3.4" />
    </>
  ),
  pointage: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5h17" />
      <path d="M8 3.2v3.4" />
      <path d="M16 3.2v3.4" />
      <path d="M8.5 14.5l2.2 2.2 4-4.2" />
    </>
  ),
  heures: (
    <>
      <circle cx="12" cy="12.5" r="8.5" />
      <path d="M12 7.5v5.2l3.2 2" />
    </>
  ),
  conges: (
    <>
      <path d="M12 21.5V11" />
      <path d="M12 11c-3.4-3-7.4-1.8-8.4 1.6" />
      <path d="M12 11c3.4-3 7.4-1.8 8.4 1.6" />
      <path d="M12 11c0-4 2.2-7 5.4-8.2" />
      <path d="M12 11c0-4-2.2-7-5.4-8.2" />
    </>
  ),
  ajustements: (
    <>
      <path d="M4 8h9" />
      <path d="M18.5 8H20" />
      <circle cx="15.5" cy="8" r="2.4" />
      <path d="M4 16.5h3.5" />
      <path d="M13 16.5h7" />
      <circle cx="9.5" cy="16.5" r="2.4" />
    </>
  ),
  paie: (
    <>
      <rect x="2.5" y="6.5" width="19" height="11.5" rx="2" />
      <circle cx="12" cy="12.2" r="2.6" />
      <path d="M6 10.5v3.4" />
      <path d="M18 10.5v3.4" />
    </>
  ),
  declarations: (
    <>
      <path d="M12 2.8l7.2 2.9v5.1c0 4.6-3.1 8.2-7.2 10.3-4.1-2.1-7.2-5.7-7.2-10.3V5.7z" />
      <path d="M9 12l2.1 2.1 4-4.3" />
    </>
  ),
  parametres: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.6v2.6M12 18.8v2.6M4.6 12H2M22 12h-2.6M5.5 5.5l1.9 1.9M16.6 16.6l1.9 1.9M18.5 5.5l-1.9 1.9M7.4 16.6l-1.9 1.9" />
    </>
  ),
  utilisateurs: (
    <>
      <circle cx="10" cy="8" r="3.2" />
      <path d="M4 20c0-3.3 2.7-6 6-6 1.4 0 2.7.5 3.7 1.3" />
      <circle cx="17.5" cy="16.5" r="3.3" />
      <path d="M17.5 14.6v1.9l1.3.9" />
    </>
  ),
  recherche: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M16.2 16.2L21 21" />
    </>
  ),
  deconnexion: (
    <>
      <path d="M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8" />
      <path d="M16 12H9.5" />
      <path d="M18.5 9.5L21 12l-2.5 2.5" />
    </>
  ),
  chevron: <path d="M9 6l6 6-6 6" />,
  entreprise: (
    <>
      <path d="M3.5 20.5h17" />
      <path d="M5 20.5V6.2a1 1 0 0 1 .7-1l6-2a1 1 0 0 1 1.3 1v16.3" />
      <path d="M13 10.5h5.3a1 1 0 0 1 1 1v9" />
      <path d="M8 8.5h1.5M8 12h1.5M8 15.5h1.5M15.5 14h1.2M15.5 17.3h1.2" />
    </>
  ),
  portefeuille: (
    <>
      <rect x="2.8" y="6.5" width="18.4" height="13.2" rx="2.2" />
      <path d="M8.2 6.5V5.2a1.6 1.6 0 0 1 1.6-1.6h4.4a1.6 1.6 0 0 1 1.6 1.6v1.3" />
      <path d="M2.8 11.5h18.4" />
      <path d="M11 14.2h2" />
    </>
  ),
  plus: <path d="M12 5.2v13.6M5.2 12h13.6" />,
  alerte: (
    <>
      <path d="M12 3.8L21 19.5H3z" />
      <path d="M12 9.6v4.4" />
      <path d="M12 16.9h.01" />
    </>
  ),
  archive: (
    <>
      <rect x="3" y="4.2" width="18" height="4.2" rx="1.2" />
      <path d="M4.8 8.4v10a1.4 1.4 0 0 0 1.4 1.4h11.6a1.4 1.4 0 0 0 1.4-1.4v-10" />
      <path d="M10 12.2h4" />
    </>
  ),
  crayon: (
    <>
      <path d="M4 20h4.2L19.4 8.8a2.1 2.1 0 0 0 0-3l-1.2-1.2a2.1 2.1 0 0 0-3 0L4 15.8z" />
      <path d="M14.6 5.4l4 4" />
    </>
  ),
  poubelle: (
    <>
      <path d="M4 6.6h16" />
      <path d="M9.4 6.6V4.8a1.2 1.2 0 0 1 1.2-1.2h2.8a1.2 1.2 0 0 1 1.2 1.2v1.8" />
      <path d="M6.2 6.6l.9 12.4a1.4 1.4 0 0 0 1.4 1.3h7a1.4 1.4 0 0 0 1.4-1.3l.9-12.4" />
      <path d="M10.4 10.4v6M13.6 10.4v6" />
    </>
  ),
  bascule: (
    <>
      <path d="M3.6 8.2h13.2" />
      <path d="M13.6 5l3.2 3.2-3.2 3.2" />
      <path d="M20.4 15.8H7.2" />
      <path d="M10.4 12.6l-3.2 3.2 3.2 3.2" />
    </>
  )
}

export function Icone({
  nom,
  size = 20,
  className = ''
}: {
  nom: NomIcone
  size?: number
  className?: string
}): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {TRACES[nom]}
    </svg>
  )
}
