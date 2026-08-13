import { useEffect, useRef, useState } from 'react'
import type { SessionUtilisateur } from '../../../shared/types'
import { PRODUIT } from '../lib/produit'
import { MarqueNafasoft, MotNafasoft } from './Logo'

interface Props {
  onAuth: (session: SessionUtilisateur) => void
}

type Mode = 'connexion' | 'config' | 'oubli' | 'change'

/** Un cadre de promotion Nafasoft, affiché à tour de rôle sur le portail. */
interface Promo {
  icone: string
  titre: string
  texte: string
}

const PROMOS: Promo[] = [
  {
    icone: '◈',
    titre: 'Conseil informatique',
    texte: 'Nous auditons votre système et orientons vos choix technologiques.'
  },
  {
    icone: '§',
    titre: 'Juriste informaticien',
    texte: 'Le droit du numérique au service de votre conformité et de vos contrats.'
  },
  {
    icone: '◑',
    titre: 'Études & ingénierie',
    texte: "De l'analyse du besoin au cahier des charges, sur des bases solides."
  },
  {
    icone: '❖',
    titre: 'Solutions sur mesure',
    texte: 'Des applications conçues pour votre métier, robustes et évolutives.'
  },
  {
    icone: '★',
    titre: "Les meilleures applications d'Afrique",
    texte: "L'excellence logicielle, pensée et bâtie depuis le Burkina Faso."
  }
]

/**
 * Portail Nafasoft · l'écran d'ouverture de l'application.
 *
 * À gauche, la vitrine Nafasoft : marque, cadres de promotion qui défilent,
 * signature discrète du fondateur et contact. À droite, l'accès : on saisit le
 * mot de passe, et l'on entre alors dans l'espace de travail de l'entreprise
 * cliente. Un seul portail habille l'ensemble ; le client vit à l'intérieur.
 */
const msg = (e: unknown): string => String((e as Error)?.message ?? e)

export function LoginGate({ onAuth }: Props): JSX.Element {
  const [statut, setStatut] = useState<{ configure: boolean } | null>(null)
  const [mode, setMode] = useState<Mode>('connexion')
  const [identifiant, setIdentifiant] = useState('')
  const [nom, setNom] = useState('')
  const [mdp, setMdp] = useState('')
  const [mdp2, setMdp2] = useState('')
  const [reponse, setReponse] = useState('')
  const [question, setQuestion] = useState<string | null>(null)
  const [erreur, setErreur] = useState('')
  const [info, setInfo] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [promo, setPromo] = useState(0)
  const minuterie = useRef<ReturnType<typeof setInterval> | null>(null)
  // Session gardée entre la connexion et le changement de mot de passe imposé.
  const sessionRef = useRef<SessionUtilisateur | null>(null)
  const ancienRef = useRef('')

  useEffect(() => {
    window.api.auth.status().then((s) => {
      setStatut(s)
      setMode(s.configure ? 'connexion' : 'config')
    })
  }, [])

  // Défilement automatique des cadres, neutralisé si l'utilisateur refuse les
  // animations. Les puces permettent alors la navigation manuelle.
  useEffect(() => {
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduit) return
    minuterie.current = setInterval(() => setPromo((pp) => (pp + 1) % PROMOS.length), 4800)
    return () => {
      if (minuterie.current) clearInterval(minuterie.current)
    }
  }, [])

  function allerPromo(i: number): void {
    setPromo(i)
    if (minuterie.current) clearInterval(minuterie.current)
  }

  function raz(): void {
    setErreur('')
    setInfo('')
  }

  function versMode(m: Mode): void {
    raz()
    setMdp('')
    setMdp2('')
    setReponse('')
    setQuestion(null)
    setMode(m)
  }

  async function configurer(): Promise<void> {
    raz()
    if (identifiant.trim().length < 3)
      return setErreur('L’identifiant doit contenir au moins 3 caractères.')
    if (mdp.length < 4) return setErreur('Le mot de passe doit contenir au moins 4 caractères.')
    if (mdp !== mdp2) return setErreur('Les deux mots de passe ne correspondent pas.')
    setOccupe(true)
    try {
      const r = await window.api.auth.setupPremier(identifiant, nom, mdp)
      if (r.ok && r.session) onAuth(r.session)
      else setErreur(r.erreur ?? 'Échec de la configuration.')
    } catch (e) {
      setErreur(msg(e))
    } finally {
      setOccupe(false)
    }
  }

  async function connecter(): Promise<void> {
    raz()
    setOccupe(true)
    try {
      const r = await window.api.auth.login(identifiant, mdp)
      if (!r.ok || !r.session) return setErreur(r.erreur ?? 'Connexion refusée.')
      if (r.session.must_change) {
        sessionRef.current = r.session
        ancienRef.current = mdp
        setMdp('')
        setMdp2('')
        setMode('change')
        setInfo('Ce mot de passe est provisoire : choisissez-en un nouveau.')
      } else {
        onAuth(r.session)
      }
    } catch (e) {
      setErreur(msg(e))
    } finally {
      setOccupe(false)
    }
  }

  async function changer(): Promise<void> {
    raz()
    if (mdp.length < 4) return setErreur('Le nouveau mot de passe doit contenir au moins 4 caractères.')
    if (mdp !== mdp2) return setErreur('Les deux mots de passe ne correspondent pas.')
    const s = sessionRef.current
    if (!s) return setMode('connexion')
    setOccupe(true)
    try {
      await window.api.auth.changePassword(s.username, ancienRef.current, mdp)
      onAuth({ ...s, must_change: false })
    } catch (e) {
      setErreur(msg(e))
    } finally {
      setOccupe(false)
    }
  }

  async function chercherQuestion(): Promise<void> {
    raz()
    if (identifiant.trim().length < 3) return setErreur('Saisissez votre identifiant.')
    setOccupe(true)
    try {
      const r = await window.api.auth.recoverStart(identifiant)
      if (r) setQuestion(r.question)
      else {
        setQuestion(null)
        setInfo(
          "Aucune récupération n'est configurée pour ce compte. Demandez à un administrateur · ou au concepteur · de le réinitialiser."
        )
      }
    } finally {
      setOccupe(false)
    }
  }

  async function recuperer(): Promise<void> {
    raz()
    if (mdp.length < 4) return setErreur('Le nouveau mot de passe doit contenir au moins 4 caractères.')
    if (mdp !== mdp2) return setErreur('Les deux mots de passe ne correspondent pas.')
    setOccupe(true)
    try {
      const ok = await window.api.auth.recover(identifiant, reponse, mdp)
      if (ok) {
        versMode('connexion')
        setInfo('Mot de passe réinitialisé. Connectez-vous avec le nouveau.')
      } else setErreur('Réponse de secours incorrecte.')
    } catch (e) {
      setErreur(msg(e))
    } finally {
      setOccupe(false)
    }
  }

  const p = PROMOS[promo]

  const titres: Record<Mode, { titre: string; sous: string }> = {
    connexion: {
      titre: 'Espace de travail',
      sous: "Connectez-vous pour ouvrir l'espace de l'entreprise."
    },
    config: {
      titre: 'Première configuration',
      sous: 'Créez le compte administrateur qui gérera cette installation.'
    },
    oubli: {
      titre: 'Mot de passe oublié',
      sous: 'Retrouvez l’accès grâce à votre question de secours.'
    },
    change: {
      titre: 'Nouveau mot de passe',
      sous: 'Votre mot de passe est provisoire : choisissez-en un définitif.'
    }
  }

  return (
    <div className="portail">
      <div className="portail-halo halo-a" aria-hidden="true" />
      <div className="portail-halo halo-b" aria-hidden="true" />
      <div className="portail-quadrillage" aria-hidden="true" />

      <div className="portail-corps">
        {/* --------------------------------- vitrine Nafasoft ------------- */}
        <section className="portail-hero">
          <div className="hero-marque">
            <div className="hero-anneau">
              <span className="anneau" aria-hidden="true" />
              <MarqueNafasoft size={72} className="hero-logo" />
            </div>
            <div>
              <MotNafasoft className="hero-mot" />
              <div className="hero-tagline">{PRODUIT.tagline}</div>
            </div>
          </div>

          <div className="promo">
            <div className="promo-carte" key={promo}>
              <span className="promo-ico" aria-hidden="true">
                {p.icone}
              </span>
              <div>
                <div className="promo-titre">{p.titre}</div>
                <div className="promo-texte">{p.texte}</div>
              </div>
            </div>
            <div className="promo-puces">
              {PROMOS.map((_, i) => (
                <button
                  key={i}
                  className={`promo-puce ${i === promo ? 'actif' : ''}`}
                  aria-label={`Cadre ${i + 1}`}
                  onClick={() => allerPromo(i)}
                />
              ))}
            </div>
          </div>

          <div className="hero-pied">
            <div className="hero-fondateur">
              <span className="furtif">Conçu par</span> AFRICA-TIC
            </div>
            <div className="hero-contact">
              <a href="mailto:nafasoft@gmail.com">nafasoft@gmail.com</a>
              <span aria-hidden="true">·</span>
              <span>+226 66 03 32 28</span>
            </div>
            {/* Signature du développeur : discrète, jamais devant la marque du
                cabinet — un simple filigrane pour qui cherche à savoir. */}
            <a href="https://bazie.dev" className="hero-signature" target="_blank" rel="noreferrer">
              bazie.dev
            </a>
          </div>
        </section>

        {/* --------------------------------- accès protégé --------------- */}
        <section className="portail-acces">
          <div className="acces-card">
            <h1 className="acces-titre">{titres[mode].titre}</h1>
            <p className="acces-sous">{titres[mode].sous}</p>

            {statut === null ? (
              <p className="acces-chargement">Ouverture…</p>
            ) : (
              <>
                {erreur && (
                  <div className="acces-erreur" role="alert">
                    {erreur}
                  </div>
                )}
                {info && (
                  <div className="acces-info" role="status">
                    {info}
                  </div>
                )}

                {mode === 'config' && (
                  <>
                    <Champ label="Identifiant administrateur" id="id" value={identifiant} onChange={setIdentifiant} placeholder="ex. gerant" autoFocus />
                    <Champ label="Nom affiché" id="nom" value={nom} onChange={setNom} placeholder="ex. Awa Traoré" />
                    <Champ label="Mot de passe" id="mdp" type="password" value={mdp} onChange={setMdp} />
                    <Champ label="Confirmer le mot de passe" id="mdp2" type="password" value={mdp2} onChange={setMdp2} onEnter={configurer} />
                    <button className="acces-btn sheen" disabled={occupe} onClick={configurer}>
                      {occupe ? 'Création…' : 'Créer et entrer'}
                    </button>
                    <button type="button" className="acces-lien" onClick={() => versMode('connexion')}>
                      Accès concepteur →
                    </button>
                  </>
                )}

                {mode === 'connexion' && (
                  <>
                    <Champ label="Identifiant" id="id" value={identifiant} onChange={setIdentifiant} placeholder="votre identifiant" autoFocus onEnter={connecter} />
                    <Champ label="Mot de passe" id="mdp" type="password" value={mdp} onChange={setMdp} onEnter={connecter} />
                    <button className="acces-btn sheen" disabled={occupe} onClick={connecter}>
                      {occupe ? 'Vérification…' : "Ouvrir l'espace"}
                    </button>
                    <button type="button" className="acces-lien" onClick={() => versMode('oubli')}>
                      Mot de passe oublié ?
                    </button>
                    {statut && !statut.configure && (
                      <button type="button" className="acces-lien" onClick={() => versMode('config')}>
                        ← Première configuration de l'entreprise
                      </button>
                    )}
                  </>
                )}

                {mode === 'change' && (
                  <>
                    <Champ label="Nouveau mot de passe" id="mdp" type="password" value={mdp} onChange={setMdp} autoFocus />
                    <Champ label="Confirmer" id="mdp2" type="password" value={mdp2} onChange={setMdp2} onEnter={changer} />
                    <button className="acces-btn sheen" disabled={occupe} onClick={changer}>
                      {occupe ? 'Enregistrement…' : 'Enregistrer et entrer'}
                    </button>
                  </>
                )}

                {mode === 'oubli' && (
                  <>
                    <Champ label="Identifiant" id="id" value={identifiant} onChange={setIdentifiant} autoFocus disabled={question !== null} onEnter={question ? recuperer : chercherQuestion} />
                    {question === null ? (
                      <button className="acces-btn sheen" disabled={occupe} onClick={chercherQuestion}>
                        {occupe ? '…' : 'Continuer'}
                      </button>
                    ) : (
                      <>
                        <div className="acces-question">{question}</div>
                        <Champ label="Réponse de secours" id="rep" value={reponse} onChange={setReponse} autoFocus />
                        <Champ label="Nouveau mot de passe" id="mdp" type="password" value={mdp} onChange={setMdp} />
                        <Champ label="Confirmer" id="mdp2" type="password" value={mdp2} onChange={setMdp2} onEnter={recuperer} />
                        <button className="acces-btn sheen" disabled={occupe} onClick={recuperer}>
                          {occupe ? '…' : 'Réinitialiser le mot de passe'}
                        </button>
                      </>
                    )}
                    <button type="button" className="acces-lien" onClick={() => versMode('connexion')}>
                      ← Retour à la connexion
                    </button>
                  </>
                )}
              </>
            )}

            <p className="acces-pied">Données stockées localement, sur ce poste.</p>
          </div>
        </section>
      </div>

      <div className="portail-signature">
        © {new Date().getFullYear()} {PRODUIT.nom} · {PRODUIT.tagline}
      </div>
    </div>
  )
}

/** Champ étiqueté de la carte d'accès, avec validation à la touche Entrée. */
function Champ({
  label,
  id,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoFocus,
  disabled,
  onEnter
}: {
  label: string
  id: string
  value: string
  onChange: (v: string) => void
  type?: 'text' | 'password'
  placeholder?: string
  autoFocus?: boolean
  disabled?: boolean
  onEnter?: () => void
}): JSX.Element {
  return (
    <div className="acces-champ">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onEnter) onEnter()
        }}
      />
    </div>
  )
}
