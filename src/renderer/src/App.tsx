import { useEffect, useState } from 'react'
import type {
  AppConfig,
  EmployeurRegistre,
  ModePortefeuille,
  SessionUtilisateur
} from '../../shared/types'
import { espaceDemarrage } from '../../shared/espace'
import { jouer } from './lib/son'
import { chargerConfig } from './lib/config'
import { PRODUIT, monogramme, titreFenetre } from './lib/produit'
import { definirCouleurDocuments } from './lib/print'
import { Icone, type NomIcone } from './components/Icones'
import { SessionContexte } from './lib/session'
import { MarqueNafasoft } from './components/Logo'
import { Horloge } from './components/Horloge'
import { Dashboard } from './pages/Dashboard'
import { EmployeesPage } from './pages/EmployeesPage'
import { PlanningPage } from './pages/PlanningPage'
import { LeavesPage } from './pages/LeavesPage'
import { TimePage } from './pages/TimePage'
import { RegisterPage } from './pages/RegisterPage'
import { ContractsPage } from './pages/ContractsPage'
import { DossiersPage } from './pages/DossiersPage'
import { PayrollPage } from './pages/PayrollPage'
import { AdjustmentsPage } from './pages/AdjustmentsPage'
import { DeclarationsPage } from './pages/DeclarationsPage'
import { UsersPage } from './pages/UsersPage'
import { ParametresPage } from './pages/ParametresPage'
import { PortefeuillePage } from './pages/PortefeuillePage'
import { PremierDemarrage } from './components/PremierDemarrage'
import { LoginGate } from './components/LoginGate'

export type Route =
  | 'dashboard'
  | 'employees'
  | 'contracts'
  | 'dossiers'
  | 'planning'
  | 'register'
  | 'leaves'
  | 'time'
  | 'adjustments'
  | 'payroll'
  | 'declarations'
  | 'users'
  | 'parametres'

interface NavEntry {
  route: Route
  label: string
  icone: NomIcone
}

interface NavGroupe {
  titre: string
  entrees: NavEntry[]
}

const NAV: NavGroupe[] = [
  {
    titre: 'Pilotage',
    entrees: [{ route: 'dashboard', label: 'Tableau de bord', icone: 'dashboard' }]
  },
  {
    titre: 'Personnel',
    entrees: [
      { route: 'employees', label: 'Employés', icone: 'employes' },
      { route: 'contracts', label: 'Contrats', icone: 'contrats' },
      { route: 'dossiers', label: 'Dossiers & actes', icone: 'dossiers' }
    ]
  },
  {
    titre: 'Temps de travail',
    entrees: [
      { route: 'planning', label: 'Planning', icone: 'planning' },
      { route: 'register', label: 'Registre de pointage', icone: 'pointage' },
      { route: 'time', label: 'Heures travaillées', icone: 'heures' },
      { route: 'leaves', label: 'Congés & absences', icone: 'conges' }
    ]
  },
  {
    titre: 'Rémunération',
    entrees: [
      { route: 'adjustments', label: 'Ajustements', icone: 'ajustements' },
      { route: 'payroll', label: 'Paie & bulletins', icone: 'paie' },
      { route: 'declarations', label: 'Déclarations CNSS', icone: 'declarations' }
    ]
  }
]

// Groupe réservé aux gestionnaires (concepteur / administrateur).
const ADMIN_NAV: NavGroupe = {
  titre: 'Administration',
  entrees: [
    { route: 'parametres', label: 'Paramètres', icone: 'parametres' },
    { route: 'users', label: 'Utilisateurs', icone: 'utilisateurs' }
  ]
}

/** Libellé de la section courante, pour la barre supérieure. */
function libelleRoute(r: Route): string {
  for (const g of [...NAV, ADMIN_NAV]) {
    const e = g.entrees.find((x) => x.route === r)
    if (e) return e.label
  }
  return ''
}

const LIBELLE_ROLE: Record<SessionUtilisateur['role'], string> = {
  concepteur: 'Concepteur',
  administrateur: 'Administrateur',
  utilisateur: 'Utilisateur'
}

/** Puce du compte connecté et son menu déroulant, dans la barre supérieure. */
function UserChip({
  session,
  ouvert,
  gestionnaire,
  onBasculer,
  onFermer,
  onCompte,
  onDeconnexion
}: {
  session: SessionUtilisateur
  ouvert: boolean
  gestionnaire: boolean
  onBasculer: () => void
  onFermer: () => void
  onCompte: () => void
  onDeconnexion: () => void
}): JSX.Element {
  const initiale = (session.nom || session.username).slice(0, 1).toUpperCase()
  return (
    <div className="user-zone">
      <button className={`user-chip ${ouvert ? 'ouvert' : ''}`} onClick={onBasculer}>
        <span className="uc-avatar" aria-hidden="true">
          {initiale}
        </span>
        <span className="uc-corps">
          <span className="uc-nom">{session.nom || session.username}</span>
          <span className={`uc-role ${session.concepteur ? 'concepteur' : ''}`}>
            {LIBELLE_ROLE[session.role]}
          </span>
        </span>
        <Icone nom="chevron" size={15} className="uc-chevron" />
      </button>
      {ouvert && (
        <>
          <div className="menu-fond" onClick={onFermer} />
          <div className="user-menu" role="menu">
            <div className="um-tete">
              <span className="um-nom">{session.nom || session.username}</span>
              <span className="um-id">
                @{session.username} · {LIBELLE_ROLE[session.role]}
              </span>
            </div>
            {gestionnaire && (
              <button className="um-item" onClick={onCompte}>
                <Icone nom="utilisateurs" size={17} />
                Mon compte &amp; utilisateurs
              </button>
            )}
            <button className="um-item danger" onClick={onDeconnexion}>
              <Icone nom="deconnexion" size={17} />
              Se déconnecter
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function App(): JSX.Element {
  const [session, setSession] = useState<SessionUtilisateur | null>(null)
  const [route, setRoute] = useState<Route>('dashboard')
  const [config, setConfig] = useState<AppConfig | null>(null)
  // Employeur dont la base est ouverte. `null` = on est au portefeuille.
  const [employeur, setEmployeur] = useState<EmployeurRegistre | null>(null)
  const [modePorte, setModePorte] = useState<ModePortefeuille>('auto')
  const [nbEmployeurs, setNbEmployeurs] = useState(0)
  // Aucun employeur enregistré = installation neuve : on demande à quoi elle sert.
  const [installationNeuve, setInstallationNeuve] = useState(false)
  // Tant que l'espace de travail n'est pas tranché, on n'affiche ni le
  // portefeuille ni l'application : cela évitait un clignotement de l'un
  // vers l'autre au démarrage.
  const [espacePret, setEspacePret] = useState(false)
  const [menuUser, setMenuUser] = useState(false)
  // Menu de la barre horizontale actuellement deroule (titre du groupe).
  const [menuOuvert, setMenuOuvert] = useState<string | null>(null)
  // Barre latérale repliée en rail d'icônes · le choix est mémorisé.
  const [rail, setRail] = useState(() => localStorage.getItem('nav-rail') === '1')
  const [filtreNav, setFiltreNav] = useState('')
  // Numéro réel de l'application (app.getVersion()), pas une constante figée
  // dans le code : `npm run dist` incrémente le numéro à chaque construction,
  // un texte codé en dur se serait désynchronisé dès la deuxième version.
  const [version, setVersion] = useState('')

  useEffect(() => {
    window.api.employeurs.version().then(setVersion)
  }, [])

  function basculerRail(): void {
    setRail((v) => {
      localStorage.setItem('nav-rail', v ? '0' : '1')
      return !v
    })
  }

  // Choix de l'espace de travail, juste après la connexion.
  //
  // Mono-entreprise (ou un seul client enregistré) : on ouvre directement sa
  // base, l'utilisateur ne voit jamais le portefeuille. Cabinet : on affiche le
  // portefeuille, car c'est LUI l'écran d'accueil du gestionnaire de comptes.
  useEffect(() => {
    if (!session) return
    let annule = false
    ;(async () => {
      const [liste, m] = await Promise.all([
        window.api.employeurs.list(),
        window.api.employeurs.mode()
      ])
      if (annule) return
      setModePorte(m)
      setNbEmployeurs(liste.length)
      const espace = espaceDemarrage(liste.length, m)
      setInstallationNeuve(espace === 'configuration')
      if (espace === 'ouverture-directe') {
        const e = await window.api.employeurs.ouvrir(liste[0].id)
        if (!annule) setEmployeur(e)
      }
      if (!annule) setEspacePret(true)
    })()
    return () => {
      annule = true
    }
  }, [session])

  function deconnecter(): void {
    void window.api.employeurs.fermer()
    setSession(null)
    setConfig(null)
    setEmployeur(null)
    setEspacePret(false)
    setRoute('dashboard')
  }

  async function ouvrirEmployeur(id: number): Promise<void> {
    const e = await window.api.employeurs.ouvrir(id)
    jouer('bascule')
    setEmployeur(e)
    setInstallationNeuve(false)
    setRoute('dashboard')
  }

  /** Sortie de l'assistant : on relit le mode choisi et on entre dans le dossier. */
  async function terminerConfiguration(id: number): Promise<void> {
    setModePorte(await window.api.employeurs.mode())
    await ouvrirEmployeur(id)
  }

  async function retourPortefeuille(): Promise<void> {
    await window.api.employeurs.fermer()
    setEmployeur(null)
    setConfig(null)
    setMenuUser(false)
    window.api.window.setTitle(titreFenetre(null))
  }

  // Marque du client (nom, logo) : chargée une fois la base employeur ouverte, elle
  // habille la barre latérale et le titre de la fenêtre. Le titre porte le nom
  // du client d'abord · c'est SON poste de travail · le produit ensuite.
  useEffect(() => {
    if (!session || !employeur) return
    chargerConfig().then((c) => {
      setConfig(c)
      window.api.window.setTitle(titreFenetre(c.entreprise_nom || employeur.nom))
      definirCouleurDocuments(c.doc_couleur)
    })
  }, [session, employeur])

  if (!session) {
    return <LoginGate onAuth={setSession} />
  }

  // Concepteur et administrateur gèrent les comptes ; l'utilisateur ne les voit pas.
  const estGestionnaire = session.role === 'concepteur' || session.role === 'administrateur'

  if (!espacePret) {
    return <div className="ecran-attente">Ouverture de l'espace de travail...</div>
  }

  // Installation neuve : le mode (une entreprise / un cabinet) se choisit ici,
  // une fois pour toutes, au lieu d'être deviné du nombre de dossiers.
  if (installationNeuve) {
    return <PremierDemarrage onTermine={(id) => void terminerConfiguration(id)} />
  }

  if (!employeur) {
    return (
      <PortefeuillePage
        session={session}
        onOuvrir={(id) => void ouvrirEmployeur(id)}
        onDeconnexion={deconnecter}
      />
    )
  }

  const nomClient = config?.entreprise_nom?.trim() || employeur.nom
  const gestionnaire = estGestionnaire
  // La puce de bascule apparaît exactement quand le portefeuille est l'écran
  // d'accueil · donc quand l'utilisateur EN VIENT et doit pouvoir y retourner.
  // La lier au seul mode « cabinet » l'avait fait disparaître dès que le
  // réglage valait « auto » : plusieurs dossiers, et plus aucun moyen de
  // changer de client. On réutilise la règle de démarrage plutôt que d'en
  // écrire une seconde, qui finirait par la contredire.
  const peutBasculer = espaceDemarrage(nbEmployeurs, modePorte) === 'portefeuille'

  // Table exhaustive : le type Record<Route, …> impose une page pour chaque
  // route. Ajouter une entrée au menu sans écrire sa page devient une erreur
  // de compilation, au lieu d'une zone de contenu vide à l'exécution.
  const PAGES: Record<Route, () => JSX.Element> = {
    dashboard: () => <Dashboard onNavigate={setRoute} />,
    employees: () => <EmployeesPage />,
    contracts: () => <ContractsPage onNavigate={setRoute} />,
    dossiers: () => <DossiersPage onNavigate={setRoute} />,
    planning: () => <PlanningPage />,
    register: () => <RegisterPage />,
    time: () => <TimePage />,
    leaves: () => <LeavesPage />,
    adjustments: () => <AdjustmentsPage />,
    payroll: () => <PayrollPage />,
    declarations: () => <DeclarationsPage />,
    users: () => <UsersPage session={session} />,
    parametres: () => (
      <ParametresPage
        onConfigSaved={(c) => {
          setConfig(c)
          window.api.window.setTitle(titreFenetre(c.entreprise_nom))
          definirCouleurDocuments(c.doc_couleur)
        }}
      />
    )
  }

  // Les pages d'administration ne sont atteignables que par un gestionnaire —
  // garde-fou au cas où la route serait forcée autrement que par le menu.
  const routeEffective: Route =
    (route === 'users' || route === 'parametres') && !gestionnaire ? 'dashboard' : route
  // Groupes de menu : le groupe Administration n'apparaît que pour un gestionnaire.
  const navVisible = gestionnaire ? [...NAV, ADMIN_NAV] : NAV

  // Recherche dans le menu : filtre les entrées, masque les groupes devenus vides.
  const q = filtreNav.trim().toLowerCase()
  const navFiltree = q
    ? navVisible
        .map((g) => ({ ...g, entrees: g.entrees.filter((e) => e.label.toLowerCase().includes(q)) }))
        .filter((g) => g.entrees.length > 0)
    : navVisible

  // Groupe de la page courante : ses entrées forment la navigation horizontale.
  const groupeCourant = navVisible.find((g) => g.entrees.some((e) => e.route === routeEffective))

  return (
    <SessionContexte.Provider value={session}>
    <div className={`app ${rail ? 'rail' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-marque">
          {config?.logo ? (
            <img className="logo logo-img" src={config.logo} alt="" />
          ) : (
            <span className="logo">{monogramme(nomClient)}</span>
          )}
          <span className="marque-texte">
            <span className="nom">{nomClient}</span>
            <span className="sous">Personnel &amp; paie</span>
          </span>
          <button
            className="rail-bouton"
            onClick={basculerRail}
            title={rail ? 'Déplier le menu' : 'Replier le menu'}
            aria-label={rail ? 'Déplier le menu' : 'Replier le menu'}
          >
            <Icone nom="chevron" size={16} />
          </button>
        </div>

        {!rail && (
          <div className="nav-recherche">
            <Icone nom="recherche" size={15} className="nr-ico" />
            <input
              value={filtreNav}
              placeholder="Rechercher un module…"
              onChange={(e) => setFiltreNav(e.target.value)}
            />
            {filtreNav && (
              <button className="nr-vider" onClick={() => setFiltreNav('')} aria-label="Effacer">
                ✕
              </button>
            )}
          </div>
        )}

        <nav className="sidebar-nav">
          {navFiltree.map((groupe) => (
            <div className="nav-groupe-bloc" key={groupe.titre}>
              <div className="nav-groupe">{groupe.titre}</div>
              {groupe.entrees.map((n) => (
                <button
                  key={n.route}
                  className={`nav-item ${routeEffective === n.route ? 'actif' : ''}`}
                  onClick={() => setRoute(n.route)}
                  title={rail ? n.label : undefined}
                >
                  <span className="nav-ico">
                    <Icone nom={n.icone} size={19} />
                  </span>
                  <span className="nav-label">{n.label}</span>
                </button>
              ))}
            </div>
          ))}
          {navFiltree.length === 0 && <p className="nav-vide">Aucun module trouvé.</p>}
        </nav>

        <div className="sidebar-pied">
          <div className="sidebar-produit">
            <MarqueNafasoft size={22} className="sidebar-produit-logo" />
            <span className="sidebar-produit-texte">
              <span className="sidebar-produit-lib">Propulsé par</span>
              {PRODUIT.nom} <span className="sidebar-produit-ver">v{version}</span>
            </span>
          </div>
        </div>
      </aside>

      <main className="contenu">
        <header className="topbar">
          <div className="topbar-haut">
            <div className="topbar-fil">
              <span className="tf-espace">{groupeCourant?.titre ?? 'Espace de travail'}</span>
              <Icone nom="chevron" size={13} className="tf-sep" />
              <span className="tf-section">{libelleRoute(routeEffective)}</span>
            </div>
            <div className="topbar-actions">
              {peutBasculer && (
                <button
                  className="client-chip"
                  onClick={() => void retourPortefeuille()}
                  title="Revenir au portefeuille pour changer de client"
                  style={{ ['--teinte' as string]: employeur.couleur || 'var(--primaire)' }}
                >
                  <span className="cc-pastille" aria-hidden="true" />
                  <span className="cc-corps">
                    <span className="cc-lib">Dossier ouvert</span>
                    <span className="cc-nom">{employeur.nom}</span>
                  </span>
                  <Icone nom="bascule" size={15} className="cc-ico" />
                </button>
              )}
              <Horloge />
              <UserChip
                session={session}
                ouvert={menuUser}
                gestionnaire={gestionnaire}
                onBasculer={() => setMenuUser((v) => !v)}
                onFermer={() => setMenuUser(false)}
                onCompte={() => {
                  setMenuUser(false)
                  setRoute('users')
                }}
                onDeconnexion={() => {
                  setMenuUser(false)
                  deconnecter()
                }}
              />
            </div>
          </div>

          {/* Barre de menus : un menu par domaine, ouvrant la liste de ses
              modules. C'est la navigation horizontale des logiciels de gestion
              · elle donne accès à TOUT depuis n'importe quelle page, sans
              dépendre du groupe où l'on se trouve. Elle occupe sa PROPRE
              rangée : elle n'entre donc jamais en concurrence d'espace avec le
              fil d'Ariane ni avec l'horloge, ce qui la faisait déborder. */}
          <div className="topbar-menu">
            <nav className="menubar" aria-label="Menu principal">
              {navVisible.map((g) => {
                const ouvert = menuOuvert === g.titre
                // Un domaine à module unique (le tableau de bord) devient un
                // bouton direct : dérouler un menu d'un seul élément n'a pas
                // de sens et coûte un clic de plus.
                if (g.entrees.length === 1) {
                  const n = g.entrees[0]
                  return (
                    <button
                      key={g.titre}
                      className={`mb-bouton direct ${routeEffective === n.route ? 'actif' : ''}`}
                      onClick={() => {
                        setMenuOuvert(null)
                        setRoute(n.route)
                      }}
                      onMouseEnter={() => menuOuvert !== null && setMenuOuvert(null)}
                    >
                      <Icone nom={n.icone} size={16} className="mb-ico" />
                      <span>{n.label}</span>
                    </button>
                  )
                }
                return (
                  <div key={g.titre} className="mb-groupe">
                    <button
                      className={`mb-bouton ${groupeCourant?.titre === g.titre ? 'actif' : ''} ${
                        ouvert ? 'ouvert' : ''
                      }`}
                      onClick={() => setMenuOuvert(ouvert ? null : g.titre)}
                      // Une fois un menu ouvert, le survol des autres bascule
                      // directement · comportement attendu d'une barre de menus.
                      onMouseEnter={() => menuOuvert !== null && setMenuOuvert(g.titre)}
                    >
                      <span>{g.titre}</span>
                      <Icone nom="chevron" size={12} className="mb-chevron" />
                    </button>
                    {ouvert && (
                      <div className="mb-panneau" role="menu">
                        {g.entrees.map((n) => (
                          <button
                            key={n.route}
                            className={`mb-item ${routeEffective === n.route ? 'actif' : ''}`}
                            role="menuitem"
                            onClick={() => {
                              setRoute(n.route)
                              setMenuOuvert(null)
                            }}
                          >
                            <Icone nom={n.icone} size={17} className="mbi-ico" />
                            <span>{n.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </nav>
            {menuOuvert !== null && (
              <div className="menu-fond" onClick={() => setMenuOuvert(null)} />
            )}
          </div>
        </header>
        <div className="contenu-scroll">{PAGES[routeEffective]()}</div>
      </main>
    </div>
    </SessionContexte.Provider>
  )
}

export default App
