import { useEffect, useMemo, useState } from 'react'
import type { ElementPaie, ElementPaieInput, Employee, SensElement } from '../../../shared/types'
import { MODELES_ELEMENTS } from '../../../shared/types'
import { Modale } from './Modale'
import { Confirm } from './Confirm'
import { formatMoney } from '../lib/format'

/** Ligne vierge, pré-réglée sur le premier modèle proposé. */
function vide(employeeId: number, start: string, end: string): ElementPaieInput {
  const m = MODELES_ELEMENTS[0]
  return {
    employee_id: employeeId,
    libelle: m.libelle,
    sens: m.sens,
    base: null,
    taux: null,
    montant: 0,
    soumis_cnss: m.soumis_cnss,
    soumis_iuts: m.soumis_iuts,
    periode_debut: start,
    periode_fin: end,
    notes: null
  }
}

/**
 * Saisie des primes, indemnités et retenues d'une période.
 * Un élément sans période s'applique tous les mois ; sinon il ne vaut que
 * pour la période saisie.
 */
export function ElementsPaie({
  employes,
  start,
  end,
  onChange
}: {
  employes: Employee[]
  start: string
  end: string
  onChange: () => void
}): JSX.Element {
  const [parEmploye, setParEmploye] = useState<Map<number, ElementPaie[]>>(new Map())
  const [edition, setEdition] = useState<{ employee: Employee; element: ElementPaie | null } | null>(
    null
  )
  const [aSupprimer, setASupprimer] = useState<ElementPaie | null>(null)
  const [recherche, setRecherche] = useState('')

  async function charger(): Promise<void> {
    const map = new Map<number, ElementPaie[]>()
    for (const e of employes) {
      map.set(e.id, await window.api.elements.listPourPeriode(e.id, start, end))
    }
    setParEmploye(map)
  }

  useEffect(() => {
    charger()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employes, start, end])

  const liste = useMemo(() => {
    const r = recherche.trim().toLowerCase()
    return employes.filter((e) => !r || `${e.nom} ${e.prenom} ${e.poste}`.toLowerCase().includes(r))
  }, [employes, recherche])

  async function supprimer(): Promise<void> {
    if (!aSupprimer) return
    await window.api.elements.remove(aSupprimer.id)
    setASupprimer(null)
    await charger()
    onChange()
  }

  /** Solde des éléments d'un salarié : gains moins retenues. */
  function solde(els: ElementPaie[]): number {
    return els.reduce((t, el) => t + (el.sens === 'gain' ? el.montant : -el.montant), 0)
  }

  if (employes.length === 0) {
    return (
      <div className="carte vide">
        <div className="icone-vide">◫</div>
        <p>Aucun salarié actif.</p>
      </div>
    )
  }

  return (
    <>
      <div className="barre-outils">
        <input
          className="recherche"
          placeholder="Rechercher un salarié…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
        <div className="groupe texte-petit texte-gris">
          Éléments applicables du {start} au {end}
        </div>
      </div>

      <div className="liste-elements">
        {liste.map((emp) => {
          const els = parEmploye.get(emp.id) ?? []
          const s = solde(els)
          return (
            <div className="carte bloc-elements" key={emp.id}>
              <div className="be-entete">
                <div>
                  <div className="cellule-principale">
                    {emp.nom.toUpperCase()} {emp.prenom}
                  </div>
                  <div className="cellule-secondaire">{emp.poste || 'Non renseigné'}</div>
                </div>
                <div className="be-actions">
                  {els.length > 0 && (
                    <span className={`badge ${s >= 0 ? 'badge-succes' : 'badge-erreur'}`}>
                      {s >= 0 ? '+' : ''}
                      {formatMoney(s)}
                    </span>
                  )}
                  <button
                    className="btn btn-sm btn-secondaire"
                    onClick={() => setEdition({ employee: emp, element: null })}
                  >
                    + Ajouter
                  </button>
                </div>
              </div>

              {els.length === 0 ? (
                <p className="texte-petit texte-gris" style={{ margin: 0 }}>
                  Aucune prime ni retenue sur cette période.
                </p>
              ) : (
                <table className="table-elements">
                  <tbody>
                    {els.map((el) => (
                      <tr key={el.id}>
                        <td>
                          <span className={`badge ${el.sens === 'gain' ? 'badge-succes' : 'badge-erreur'}`}>
                            {el.sens === 'gain' ? 'Gain' : 'Retenue'}
                          </span>
                        </td>
                        <td className="cellule-principale">
                          {el.libelle}
                          {el.notes && <div className="cellule-secondaire">{el.notes}</div>}
                        </td>
                        <td className="texte-xs texte-gris">
                          {el.periode_debut ? 'cette période' : 'tous les mois'}
                          {!el.soumis_cnss && <div>hors cotisations</div>}
                        </td>
                        <td className="num">
                          <strong>
                            {el.sens === 'retenue' ? '− ' : ''}
                            {formatMoney(el.montant)}
                          </strong>
                        </td>
                        <td>
                          <div className="actions-cellule">
                            <button
                              className="btn-discret btn-sm"
                              onClick={() => setEdition({ employee: emp, element: el })}
                            >
                              Modifier
                            </button>
                            <button className="btn-danger btn-sm" onClick={() => setASupprimer(el)}>
                              Retirer
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )
        })}
      </div>

      {edition && (
        <FormElement
          employee={edition.employee}
          element={edition.element}
          start={start}
          end={end}
          onClose={() => setEdition(null)}
          onSaved={async () => {
            setEdition(null)
            await charger()
            onChange()
          }}
        />
      )}

      {aSupprimer && (
        <Confirm
          titre="Retirer cet élément"
          message={`Retirer « ${aSupprimer.libelle} » (${formatMoney(aSupprimer.montant)}) ? La paie sera à recalculer.`}
          danger
          onCancel={() => setASupprimer(null)}
          onConfirm={supprimer}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------- formulaire

function FormElement({
  employee,
  element,
  start,
  end,
  onClose,
  onSaved
}: {
  employee: Employee
  element: ElementPaie | null
  start: string
  end: string
  onClose: () => void
  onSaved: () => void
}): JSX.Element {
  const [form, setForm] = useState<ElementPaieInput>(() =>
    element ? { ...element } : vide(employee.id, start, end)
  )
  const [enreg, setEnreg] = useState(false)

  function set<K extends keyof ElementPaieInput>(cle: K, val: ElementPaieInput[K]): void {
    setForm((f) => ({ ...f, [cle]: val }))
  }

  /** Applique un modèle : libellé, sens et assujettissement d'un coup. */
  function appliquerModele(libelle: string): void {
    const m = MODELES_ELEMENTS.find((x) => x.libelle === libelle)
    if (!m) return set('libelle', libelle)
    setForm((f) => ({
      ...f,
      libelle: m.libelle,
      sens: m.sens,
      soumis_cnss: m.soumis_cnss,
      soumis_iuts: m.soumis_iuts
    }))
  }

  // Quantité × valeur unitaire : le montant se calcule tout seul.
  useEffect(() => {
    if (form.base != null && form.taux != null) {
      setForm((f) => ({ ...f, montant: Math.round((f.base ?? 0) * (f.taux ?? 0)) }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.base, form.taux])

  async function enregistrer(): Promise<void> {
    setEnreg(true)
    try {
      if (element) await window.api.elements.update(element.id, form)
      else await window.api.elements.create(form)
      onSaved()
    } finally {
      setEnreg(false)
    }
  }

  const permanent = form.periode_debut === null

  return (
    <Modale
      titre={`${element ? 'Modifier' : 'Ajouter'} · ${employee.prenom} ${employee.nom.toUpperCase()}`}
      onClose={onClose}
      pied={
        <>
          <button className="btn btn-secondaire" onClick={onClose}>
            Annuler
          </button>
          <button
            className="btn btn-primaire"
            onClick={enregistrer}
            disabled={enreg || !form.libelle.trim()}
          >
            {enreg ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <div className="grille-champs">
        <div className="champ pleine-largeur">
          <label>Modèle courant</label>
          <select value={form.libelle} onChange={(e) => appliquerModele(e.target.value)}>
            {MODELES_ELEMENTS.map((m) => (
              <option key={m.libelle} value={m.libelle}>
                {m.libelle} · {m.sens === 'gain' ? 'gain' : 'retenue'}
              </option>
            ))}
            {!MODELES_ELEMENTS.some((m) => m.libelle === form.libelle) && (
              <option value={form.libelle}>{form.libelle}</option>
            )}
          </select>
          <span className="aide">Règle le sens et l'assujettissement automatiquement</span>
        </div>

        <div className="champ pleine-largeur">
          <label>Libellé sur le bulletin *</label>
          <input value={form.libelle} onChange={(e) => set('libelle', e.target.value)} />
        </div>

        <div className="champ">
          <label>Sens</label>
          <select value={form.sens} onChange={(e) => set('sens', e.target.value as SensElement)}>
            <option value="gain">Gain · s'ajoute au salaire</option>
            <option value="retenue">Retenue · se déduit du net</option>
          </select>
        </div>
        <div className="champ">
          <label>Montant ({employee.salaire_mensuel != null ? 'FCFA' : 'FCFA'}) *</label>
          <input
            type="number"
            min="0"
            value={form.montant}
            onChange={(e) => set('montant', Number(e.target.value) || 0)}
          />
        </div>

        <div className="champ">
          <label>Quantité (facultatif)</label>
          <input
            type="number"
            step="0.01"
            value={form.base ?? ''}
            placeholder="ex. 6 heures"
            onChange={(e) => set('base', e.target.value === '' ? null : Number(e.target.value))}
          />
        </div>
        <div className="champ">
          <label>Valeur unitaire (facultatif)</label>
          <input
            type="number"
            step="1"
            value={form.taux ?? ''}
            placeholder="ex. 1 500"
            onChange={(e) => set('taux', e.target.value === '' ? null : Number(e.target.value))}
          />
          <span className="aide">Si les deux sont saisis, le montant se calcule</span>
        </div>

        <div className="champ pleine-largeur">
          <label>Motif / observation</label>
          <input
            value={form.notes ?? ''}
            placeholder="ex. Avance accordée le 12/08 pour frais médicaux"
            onChange={(e) => set('notes', e.target.value || null)}
          />
        </div>
      </div>

      <h3 className="section-titre">Application</h3>
      <label className="case-a-cocher" style={{ marginBottom: 'var(--e3)' }}>
        <input
          type="checkbox"
          checked={permanent}
          onChange={(e) => {
            set('periode_debut', e.target.checked ? null : start)
            set('periode_fin', e.target.checked ? null : end)
          }}
        />
        Élément permanent · repris automatiquement chaque mois
      </label>
      {!permanent && (
        <div className="grille-champs">
          <div className="champ">
            <label>Du</label>
            <input
              type="date"
              value={form.periode_debut ?? start}
              onChange={(e) => set('periode_debut', e.target.value)}
            />
          </div>
          <div className="champ">
            <label>Au</label>
            <input
              type="date"
              value={form.periode_fin ?? end}
              onChange={(e) => set('periode_fin', e.target.value)}
            />
          </div>
        </div>
      )}

      <h3 className="section-titre">Assujettissement</h3>
      <div className="encart" style={{ marginBottom: 'var(--e3)' }}>
        Détermine si l'élément entre dans l'assiette des cotisations et de l'impôt. Une prime de
        rendement y entre ; une indemnité de transport ou un remboursement de frais, non.
      </div>
      <label className="case-a-cocher">
        <input
          type="checkbox"
          checked={form.soumis_cnss}
          onChange={(e) => set('soumis_cnss', e.target.checked)}
        />
        Soumis aux cotisations CNSS
      </label>
      <label className="case-a-cocher" style={{ marginTop: 'var(--e2)' }}>
        <input
          type="checkbox"
          checked={form.soumis_iuts}
          onChange={(e) => set('soumis_iuts', e.target.checked)}
        />
        Soumis à l'impôt sur salaire (IUTS)
      </label>
    </Modale>
  )
}
