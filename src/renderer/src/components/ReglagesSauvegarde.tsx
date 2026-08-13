import { useEffect, useState } from 'react'
import type { EmployeurRegistre, Manifeste } from '../../../shared/types'
import { Icone } from './Icones'
import { Confirm } from './Confirm'
import { jouer } from '../lib/son'

const msg = (e: unknown): string => String((e as Error)?.message ?? e)

function poids(octets: number): string {
  if (octets < 1024) return `${octets} o`
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`
}

function dateLisible(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('fr-FR')} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
}

/** Ancienneté de la dernière sauvegarde, et à quel point c'est inquiétant. */
function anciennete(iso: string | null): { texte: string; ton: 'succes' | 'alerte' | 'erreur' } {
  if (!iso) {
    return {
      texte: 'Aucune sauvegarde n’a jamais été faite sur ce poste.',
      ton: 'erreur'
    }
  }
  const jours = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  const quand = `Dernière sauvegarde le ${dateLisible(iso)}`
  if (jours <= 7) return { texte: `${quand}.`, ton: 'succes' }
  if (jours <= 30) return { texte: `${quand}, il y a ${jours} jours.`, ton: 'alerte' }
  return { texte: `${quand}, il y a ${jours} jours · c’est beaucoup trop.`, ton: 'erreur' }
}

type EnCours = null | 'sauvegarde' | 'restauration'

/**
 * Sauvegarde et restauration.
 *
 * Trois gestes distincts, volontairement séparés : sauvegarder (sans risque),
 * exporter le dossier d'un seul client (pour le lui remettre), et restaurer
 * (qui écrase). Le dernier n'agit jamais sans avoir d'abord montré ce que
 * contient la sauvegarde choisie.
 */
export function ReglagesSauvegarde(): JSX.Element {
  const [employeurs, setEmployeurs] = useState<EmployeurRegistre[]>([])
  const [derniere, setDerniere] = useState<string | null>(null)
  const [erreur, setErreur] = useState('')
  const [succes, setSucces] = useState<{ texte: string; dossier?: string } | null>(null)
  const [occupe, setOccupe] = useState<EnCours>(null)

  // Sauvegarde choisie pour restauration, et ce qu'elle contient.
  const [source, setSource] = useState<{ dossier: string; manifeste: Manifeste } | null>(null)
  const [confirmation, setConfirmation] = useState<null | { quoi: 'portefeuille' | 'remplacer'; id?: number; nom: string }>(null)

  async function charger(): Promise<void> {
    const [l, d] = await Promise.all([
      window.api.employeurs.list(true),
      window.api.sauvegarde.derniere()
    ])
    setEmployeurs(l)
    setDerniere(d)
  }
  useEffect(() => {
    void charger()
  }, [])

  const etat = anciennete(derniere)

  function reinitialiser(): void {
    setErreur('')
    setSucces(null)
  }

  async function sauvegarder(employeurId?: number): Promise<void> {
    reinitialiser()
    setOccupe('sauvegarde')
    try {
      const r = await window.api.sauvegarde.creer(employeurId)
      if (r) {
        jouer('succes')
        setSucces({
          texte: `Sauvegarde terminée : ${r.manifeste.employeurs.length} dossier(s), ${r.manifeste.pieces} pièce(s) jointe(s), ${poids(r.octets)}.`,
          dossier: r.dossier
        })
        await charger()
      }
    } catch (e) {
      setErreur(msg(e))
    } finally {
      setOccupe(null)
    }
  }

  async function choisirSource(): Promise<void> {
    reinitialiser()
    try {
      const r = await window.api.sauvegarde.choisir()
      if (r) setSource(r)
    } catch (e) {
      setErreur(msg(e))
    }
  }

  async function restaurer(): Promise<void> {
    if (!source || !confirmation) return
    setOccupe('restauration')
    const cible = confirmation
    setConfirmation(null)
    try {
      if (cible.quoi === 'portefeuille') {
        const r = await window.api.sauvegarde.restaurer(source.dossier)
        setSucces({
          texte: `Portefeuille restauré (${r.manifeste.employeurs.length} dossier(s)). L’état précédent a été mis de côté avant l’écrasement. Redémarrez l’application.`,
          dossier: r.abri
        })
      } else {
        const r = await window.api.sauvegarde.importer(source.dossier, cible.id)
        setSucces({
          texte: cible.id
            ? `Dossier « ${r.nom} » remplacé. L’état précédent a été mis de côté.`
            : `Dossier « ${r.nom} » importé comme nouveau client.`,
          dossier: r.abri ?? undefined
        })
      }
      setSource(null)
      await charger()
    } catch (e) {
      setErreur(msg(e))
    } finally {
      setOccupe(null)
    }
  }

  return (
    <div className="sv">
      <div className={`sv-etat ${etat.ton}`}>
        <Icone nom={etat.ton === 'succes' ? 'declarations' : 'alerte'} size={22} />
        <div>
          <strong>{etat.texte}</strong>
          <span>
            Une sauvegarde est un dossier lisible : les bases, les pièces jointes et un
            manifeste qui décrit ce qu’il contient. Copiez-le sur une clé USB ou un disque
            externe · un fichier resté sur le même disque ne protège de rien.
          </span>
        </div>
      </div>

      {erreur && <p className="bandeau erreur">{erreur}</p>}
      {succes && (
        <div className="bandeau succes sv-succes">
          <span>{succes.texte}</span>
          {succes.dossier && (
            <button
              className="btn btn-discret btn-sm"
              onClick={() => void window.api.sauvegarde.ouvrirDossier(succes.dossier!)}
            >
              Ouvrir le dossier
            </button>
          )}
        </div>
      )}

      <section className="sv-bloc">
        <h3>Sauvegarder</h3>
        <p>
          Les bases sont recopiées par le moteur SQLite lui-même, pas octet par octet :
          la sauvegarde reste fiable même pendant que l’application travaille.
        </p>
        <button
          className="btn btn-primaire"
          disabled={occupe !== null}
          onClick={() => void sauvegarder()}
        >
          <Icone nom="archive" size={16} />
          {occupe === 'sauvegarde'
            ? 'Sauvegarde en cours…'
            : employeurs.length > 1
              ? `Sauvegarder les ${employeurs.length} dossiers`
              : 'Sauvegarder'}
        </button>
      </section>

      <section className="sv-bloc">
        <h3>Remettre son dossier à un client</h3>
        <p>
          Exporte un seul employeur, sans le registre ni les autres dossiers du cabinet.
          C’est ce qu’on transmet à un client qui reprend sa paie ou change de comptable.
        </p>
        <ul className="sv-liste">
          {employeurs.map((e) => (
            <li key={e.id}>
              <span
                className="sv-pastille"
                style={{ background: e.couleur || 'var(--primaire)' }}
                aria-hidden="true"
              />
              <span className="sv-nom">
                {e.nom}
                {e.ville && <span className="sv-ville"> · {e.ville}</span>}
              </span>
              <button
                className="btn btn-secondaire btn-sm"
                disabled={occupe !== null}
                onClick={() => void sauvegarder(e.id)}
              >
                Exporter
              </button>
            </li>
          ))}
          {employeurs.length === 0 && <li className="sv-vide">Aucun dossier enregistré.</li>}
        </ul>
      </section>

      <section className="sv-bloc danger">
        <h3>Restaurer</h3>
        <p>
          Une restauration <strong>écrase</strong> les données actuelles. L’état d’avant est
          systématiquement mis de côté, mais examinez d’abord ce que contient la sauvegarde.
        </p>

        <button className="btn btn-secondaire" disabled={occupe !== null} onClick={() => void choisirSource()}>
          <Icone nom="dossiers" size={16} />
          Choisir une sauvegarde…
        </button>

        {source && (
          <div className="sv-apercu">
            <div className="sva-tete">
              <strong>
                {source.manifeste.type === 'portefeuille'
                  ? 'Sauvegarde complète du portefeuille'
                  : 'Dossier d’un seul employeur'}
              </strong>
              <span>
                Créée le {dateLisible(source.manifeste.cree_le)} · Nafasoft v
                {source.manifeste.version} · {source.manifeste.pieces} pièce(s) jointe(s)
              </span>
            </div>
            <table className="sva-table">
              <thead>
                <tr>
                  <th>Dossier</th>
                  <th className="num">Effectif</th>
                  <th className="num">Bulletins</th>
                  <th className="num">Taille</th>
                </tr>
              </thead>
              <tbody>
                {source.manifeste.employeurs.map((e) => (
                  <tr key={e.id}>
                    <td>
                      {e.nom}
                      {e.ville && <span className="sv-ville"> · {e.ville}</span>}
                    </td>
                    <td className="num">{e.effectif}</td>
                    <td className="num">{e.bulletins}</td>
                    <td className="num">{poids(e.taille)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="sva-actions">
              {source.manifeste.type === 'portefeuille' ? (
                <button
                  className="btn btn-danger"
                  disabled={occupe !== null}
                  onClick={() =>
                    setConfirmation({ quoi: 'portefeuille', nom: 'tout le portefeuille' })
                  }
                >
                  Restaurer tout le portefeuille
                </button>
              ) : (
                <>
                  <button
                    className="btn btn-primaire"
                    disabled={occupe !== null}
                    onClick={() =>
                      setConfirmation({
                        quoi: 'remplacer',
                        nom: source.manifeste.employeurs[0].nom
                      })
                    }
                  >
                    Importer comme nouveau dossier
                  </button>
                  <label className="sva-remplacer">
                    ou remplacer&nbsp;:
                    <select
                      defaultValue=""
                      disabled={occupe !== null}
                      onChange={(ev) => {
                        const id = Number(ev.target.value)
                        const e = employeurs.find((x) => x.id === id)
                        if (e) setConfirmation({ quoi: 'remplacer', id: e.id, nom: e.nom })
                        ev.target.value = ''
                      }}
                    >
                      <option value="">Choisir un dossier existant…</option>
                      {employeurs.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.nom}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              <button className="btn btn-discret" onClick={() => setSource(null)}>
                Annuler
              </button>
            </div>
          </div>
        )}
      </section>

      {confirmation && (
        <Confirm
          titre={
            confirmation.quoi === 'portefeuille'
              ? 'Restaurer tout le portefeuille ?'
              : confirmation.id
                ? `Remplacer « ${confirmation.nom} » ?`
                : 'Importer ce dossier ?'
          }
          message={
            confirmation.quoi === 'portefeuille'
              ? 'Le registre et toutes les bases actuelles seront remplacés par ceux de la sauvegarde. Une copie de l’état actuel est prise juste avant, mais tout ce qui a été saisi depuis la sauvegarde sera perdu.'
              : confirmation.id
                ? `Les données actuelles de « ${confirmation.nom} » seront remplacées par celles de la sauvegarde. Une copie de l’état actuel est prise juste avant.`
                : `Le dossier entrera comme nouveau client, sans toucher aux dossiers existants.`
          }
          danger={confirmation.quoi === 'portefeuille' || Boolean(confirmation.id)}
          onConfirm={() => void restaurer()}
          onCancel={() => setConfirmation(null)}
        />
      )}
    </div>
  )
}
