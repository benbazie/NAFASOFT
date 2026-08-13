import { useEffect, useState } from 'react'
import type { RoleUtilisateur, SessionUtilisateur, Utilisateur } from '../../../shared/types'
import { ROLES_UTILISATEUR } from '../../../shared/types'
import { formatDate } from '../lib/format'
import { Modale } from '../components/Modale'
import { Confirm } from '../components/Confirm'

const msg = (e: unknown): string => String((e as Error)?.message ?? e)

const LIB_ROLE: Record<RoleUtilisateur, string> = {
  concepteur: 'Concepteur',
  administrateur: 'Administrateur',
  utilisateur: 'Utilisateur'
}

/**
 * Comptes de l'installation. Réservé au concepteur et aux administrateurs.
 * En haut, « Mon compte » (mot de passe, question de secours) ; en dessous,
 * la gestion des autres comptes : rôle, réinitialisation, suppression.
 */
export function UsersPage({ session }: { session: SessionUtilisateur }): JSX.Element {
  const [users, setUsers] = useState<Utilisateur[]>([])
  const [erreur, setErreur] = useState('')
  const [info, setInfo] = useState('')
  const [creer, setCreer] = useState(false)
  const [reset, setReset] = useState<Utilisateur | null>(null)
  const [aSupprimer, setASupprimer] = useState<Utilisateur | null>(null)

  function charger(): void {
    window.api.users.list().then(setUsers)
  }
  useEffect(charger, [])

  function flash(m: string, ok = true): void {
    setInfo(ok ? m : '')
    setErreur(ok ? '' : m)
    window.setTimeout(() => {
      setInfo('')
      setErreur('')
    }, 4500)
  }

  async function changerRole(u: Utilisateur, role: RoleUtilisateur): Promise<void> {
    try {
      await window.api.users.setRole(u.id, role)
      charger()
      flash(`Rôle de ${u.nom} mis à jour.`)
    } catch (e) {
      flash(msg(e), false)
    }
  }

  async function supprimer(): Promise<void> {
    if (!aSupprimer) return
    try {
      await window.api.users.remove(aSupprimer.id)
      setASupprimer(null)
      charger()
      flash('Compte supprimé.')
    } catch (e) {
      setASupprimer(null)
      flash(msg(e), false)
    }
  }

  return (
    <>
      <header className="entete-page">
        <div>
          <h1>Utilisateurs</h1>
          <p>Comptes d’accès à cette installation, rôles et récupération</p>
        </div>
        <button className="btn btn-primaire" onClick={() => setCreer(true)}>
          + Nouvel utilisateur
        </button>
      </header>

      <div className="page-corps">
        {(info || erreur) && (
          <div className={`bandeau ${erreur ? 'erreur' : 'succes'}`} role="status">
            {erreur || info}
          </div>
        )}

        <MonCompte session={session} onMessage={flash} />

        <section>
          <h2 className="section-titre">Comptes de l’installation</h2>
          {users.length === 0 ? (
            <div className="carte vide">
              <div className="icone-vide">◐</div>
              <p>Aucun compte enregistré.</p>
            </div>
          ) : (
            <div className="tableau-conteneur">
              <table>
                <thead>
                  <tr>
                    <th>Identifiant</th>
                    <th>Nom</th>
                    <th>Rôle</th>
                    <th>Récupération</th>
                    <th>Créé le</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const soi = !session.concepteur && u.username === session.username
                    return (
                      <tr key={u.id}>
                        <td className="mono">
                          {u.username}
                          {soi && <span className="pastille a-immat">vous</span>}
                          {u.must_change && (
                            <span className="pastille sortant" title="Mot de passe provisoire">
                              à renouveler
                            </span>
                          )}
                        </td>
                        <td>{u.nom}</td>
                        <td>
                          <select
                            className="selecteur"
                            style={{ padding: '2px 6px', fontSize: 'var(--t-sm)' }}
                            value={u.role}
                            disabled={soi}
                            onChange={(e) => changerRole(u, e.target.value as RoleUtilisateur)}
                          >
                            {ROLES_UTILISATEUR.map((r) => (
                              <option key={r.role} value={r.role}>
                                {r.libelle}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="texte-petit">
                          {u.a_recuperation ? 'Question définie' : 'Non renseigné'}
                        </td>
                        <td className="texte-petit">{formatDate(u.created_at.slice(0, 10))}</td>
                        <td>
                          <div className="actions-cellule">
                            <button className="btn-discret btn-sm" onClick={() => setReset(u)}>
                              Réinitialiser
                            </button>
                            <button
                              className="btn-danger btn-sm"
                              disabled={soi}
                              onClick={() => setASupprimer(u)}
                            >
                              Supprimer
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="note-champs">
            Le compte <strong>concepteur</strong> (maître Nafasoft) n’apparaît pas ici : il ouvre
            toute installation et ne peut pas être supprimé.
          </p>
        </section>
      </div>

      {creer && (
        <CreerUtilisateur
          onClose={() => setCreer(false)}
          onCree={() => {
            setCreer(false)
            charger()
            flash('Utilisateur créé. Il devra changer son mot de passe à la première connexion.')
          }}
          onErreur={(m) => flash(m, false)}
        />
      )}

      {reset && (
        <ReinitialiserModal
          user={reset}
          onClose={() => setReset(null)}
          onFait={() => {
            setReset(null)
            charger()
            flash('Mot de passe réinitialisé (provisoire).')
          }}
          onErreur={(m) => {
            setReset(null)
            flash(m, false)
          }}
        />
      )}

      {aSupprimer && (
        <Confirm
          titre="Supprimer le compte"
          message={`Supprimer le compte « ${aSupprimer.username} » (${aSupprimer.nom}) ? Cette personne perdra l’accès.`}
          danger
          onConfirm={supprimer}
          onCancel={() => setASupprimer(null)}
        />
      )}
    </>
  )
}

/** Bloc « Mon compte » : changer son mot de passe, définir sa question de secours. */
function MonCompte({
  session,
  onMessage
}: {
  session: SessionUtilisateur
  onMessage: (m: string, ok?: boolean) => void
}): JSX.Element {
  const [ancien, setAncien] = useState('')
  const [nouveau, setNouveau] = useState('')
  const [confirme, setConfirme] = useState('')
  const [question, setQuestion] = useState('')
  const [reponse, setReponse] = useState('')

  async function changerMdp(): Promise<void> {
    if (nouveau.length < 4) return onMessage('Le nouveau mot de passe est trop court.', false)
    if (nouveau !== confirme) return onMessage('Les deux mots de passe ne correspondent pas.', false)
    try {
      await window.api.auth.changePassword(session.username, ancien, nouveau)
      setAncien('')
      setNouveau('')
      setConfirme('')
      onMessage('Votre mot de passe a été changé.')
    } catch (e) {
      onMessage(msg(e), false)
    }
  }

  async function enregistrerSecours(): Promise<void> {
    try {
      await window.api.users.setRecovery(session.username, question, reponse)
      setReponse('')
      onMessage('Question de secours enregistrée.')
    } catch (e) {
      onMessage(msg(e), false)
    }
  }

  return (
    <section className="mon-compte">
      <h2 className="section-titre">Mon compte</h2>
      <div className="mc-tete">
        <span className="mc-avatar" aria-hidden="true">
          {(session.nom || session.username).slice(0, 1).toUpperCase()}
        </span>
        <div>
          <div className="mc-nom">{session.nom || session.username}</div>
          <div className="mc-role">
            {LIB_ROLE[session.role]} · <span className="mono">{session.username}</span>
          </div>
        </div>
      </div>

      {session.concepteur ? (
        <p className="note-champs">
          Vous êtes connecté avec le <strong>compte maître universel</strong>. Son mot de passe se
          change dans le code de l’application (<span className="mono">npm run maitre</span>), pas
          ici.
        </p>
      ) : (
        <div className="mc-grille">
          <div className="carte-form">
            <h3 className="cf-titre">Changer mon mot de passe</h3>
            <div className="champ">
              <label>Mot de passe actuel</label>
              <input type="password" value={ancien} onChange={(e) => setAncien(e.target.value)} />
            </div>
            <div className="champ">
              <label>Nouveau mot de passe</label>
              <input type="password" value={nouveau} onChange={(e) => setNouveau(e.target.value)} />
            </div>
            <div className="champ">
              <label>Confirmer</label>
              <input type="password" value={confirme} onChange={(e) => setConfirme(e.target.value)} />
            </div>
            <button className="btn btn-secondaire btn-sm" onClick={changerMdp}>
              Mettre à jour
            </button>
          </div>

          <div className="carte-form">
            <h3 className="cf-titre">Question de secours</h3>
            <p className="cf-aide">
              Elle permet de réinitialiser votre mot de passe vous-même, sans administrateur.
            </p>
            <div className="champ">
              <label>Question</label>
              <input
                value={question}
                placeholder="ex. Nom de mon premier employeur ?"
                onChange={(e) => setQuestion(e.target.value)}
              />
            </div>
            <div className="champ">
              <label>Réponse</label>
              <input value={reponse} onChange={(e) => setReponse(e.target.value)} />
            </div>
            <button className="btn btn-secondaire btn-sm" onClick={enregistrerSecours}>
              Enregistrer
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

/** Création d'un compte : identifiant, nom, rôle, mot de passe provisoire. */
function CreerUtilisateur({
  onClose,
  onCree,
  onErreur
}: {
  onClose: () => void
  onCree: () => void
  onErreur: (m: string) => void
}): JSX.Element {
  const [username, setUsername] = useState('')
  const [nom, setNom] = useState('')
  const [role, setRole] = useState<RoleUtilisateur>('utilisateur')
  const [motDePasse, setMotDePasse] = useState('')

  async function valider(): Promise<void> {
    try {
      await window.api.users.create({ username, nom, role, motDePasse })
      onCree()
    } catch (e) {
      onErreur(msg(e))
    }
  }

  return (
    <Modale
      titre="Nouvel utilisateur"
      onClose={onClose}
      pied={
        <>
          <button className="btn btn-secondaire" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-primaire" onClick={valider}>
            Créer le compte
          </button>
        </>
      }
    >
      <div className="grille-champs">
        <div className="champ">
          <label>Identifiant de connexion</label>
          <input value={username} placeholder="ex. awa" onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div className="champ">
          <label>Nom affiché</label>
          <input value={nom} placeholder="ex. Awa Traoré" onChange={(e) => setNom(e.target.value)} />
        </div>
        <div className="champ">
          <label>Rôle</label>
          <select value={role} onChange={(e) => setRole(e.target.value as RoleUtilisateur)}>
            {ROLES_UTILISATEUR.map((r) => (
              <option key={r.role} value={r.role}>
                {r.libelle}
              </option>
            ))}
          </select>
          <span className="aide">{ROLES_UTILISATEUR.find((r) => r.role === role)?.description}</span>
        </div>
        <div className="champ">
          <label>Mot de passe provisoire</label>
          <input value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} />
          <span className="aide">L’utilisateur devra le changer à sa première connexion.</span>
        </div>
      </div>
    </Modale>
  )
}

/** Réinitialisation par un administrateur : fixe un mot de passe provisoire. */
function ReinitialiserModal({
  user,
  onClose,
  onFait,
  onErreur
}: {
  user: Utilisateur
  onClose: () => void
  onFait: () => void
  onErreur: (m: string) => void
}): JSX.Element {
  const [motDePasse, setMotDePasse] = useState('')

  async function valider(): Promise<void> {
    try {
      await window.api.users.resetPassword(user.id, motDePasse)
      onFait()
    } catch (e) {
      onErreur(msg(e))
    }
  }

  return (
    <Modale
      titre={`Réinitialiser · ${user.nom}`}
      onClose={onClose}
      pied={
        <>
          <button className="btn btn-secondaire" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-primaire" onClick={valider}>
            Réinitialiser
          </button>
        </>
      }
    >
      <p>
        Donnez un mot de passe <strong>provisoire</strong> à <strong>{user.username}</strong>. Il
        devra le changer à sa prochaine connexion.
      </p>
      <div className="champ">
        <label>Mot de passe provisoire</label>
        <input value={motDePasse} autoFocus onChange={(e) => setMotDePasse(e.target.value)} />
      </div>
    </Modale>
  )
}
