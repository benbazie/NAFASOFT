import { useEffect, useMemo, useState } from 'react'
import type { Employee, Presence, PresenceCode } from '../../../shared/types'
import { TYPES_PRESENCE } from '../../../shared/types'
import { toCsv } from '../lib/print'

const LETTRES_JOURS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

function moisCourant(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Liste des jours d'un mois YYYY-MM, avec leur position dans la semaine. */
function joursDuMois(mois: string): { date: string; jour: number; semaine: number }[] {
  const [y, m] = mois.split('-').map(Number)
  const nb = new Date(y, m, 0).getDate()
  return Array.from({ length: nb }, (_, i) => {
    const jour = i + 1
    const d = new Date(y, m - 1, jour)
    return {
      date: `${mois}-${String(jour).padStart(2, '0')}`,
      jour,
      semaine: (d.getDay() + 6) % 7 // 0 = lundi
    }
  })
}

const TYPE_PAR_CODE = new Map(TYPES_PRESENCE.map((t) => [t.code, t]))

export function RegisterPage(): JSX.Element {
  const [mois, setMois] = useState(moisCourant)
  const [employes, setEmployes] = useState<Employee[]>([])
  const [presences, setPresences] = useState<Map<string, PresenceCode>>(new Map())
  const [pinceau, setPinceau] = useState<PresenceCode>('P')
  const [chargement, setChargement] = useState(false)

  const jours = useMemo(() => joursDuMois(mois), [mois])
  const start = jours[0]?.date ?? `${mois}-01`
  const end = jours[jours.length - 1]?.date ?? `${mois}-28`

  async function charger(): Promise<void> {
    setChargement(true)
    try {
      const liste = await window.api.presences.listByRange(start, end)
      const map = new Map<string, PresenceCode>()
      for (const p of liste as Presence[]) map.set(`${p.employee_id}|${p.date}`, p.code)
      setPresences(map)
    } finally {
      setChargement(false)
    }
  }

  useEffect(() => {
    window.api.employees.list(false).then(setEmployes)
  }, [])

  useEffect(() => {
    charger()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end])

  /** Applique le code du pinceau à une case (ou l'efface si le code est déjà posé). */
  async function poser(employeeId: number, date: string): Promise<void> {
    const cle = `${employeeId}|${date}`
    const actuel = presences.get(cle)
    const suivant = actuel === pinceau ? null : pinceau

    // Mise à jour optimiste : la grille reste fluide même sur un mois complet.
    setPresences((prev) => {
      const copie = new Map(prev)
      if (suivant) copie.set(cle, suivant)
      else copie.delete(cle)
      return copie
    })

    if (suivant) await window.api.presences.set({ employee_id: employeeId, date, code: suivant, commentaire: null })
    else await window.api.presences.clear(employeeId, date)
  }

  async function prefill(): Promise<void> {
    await window.api.presences.prefillMonth(start, end, [6]) // dimanche = repos par défaut
    charger()
  }

  /** Totaux par employé, calculés depuis la grille affichée. */
  const totaux = useMemo(() => {
    const map = new Map<number, Record<PresenceCode, number>>()
    for (const e of employes) {
      map.set(e.id, { P: 0, A: 0, C: 0, R: 0, M: 0, F: 0 })
    }
    for (const [cle, code] of presences) {
      const id = Number(cle.split('|')[0])
      const compteur = map.get(id)
      if (compteur) compteur[code]++
    }
    return map
  }, [employes, presences])

  async function exporter(): Promise<void> {
    const entetes = ['Matricule', 'Nom', 'Prénom', ...jours.map((j) => String(j.jour)), 'Présents', 'Absents', 'Déduits']
    const lignes = employes.map((e) => {
      const t = totaux.get(e.id)!
      return [
        e.matricule ?? String(e.id).padStart(4, '0'),
        e.nom,
        e.prenom,
        ...jours.map((j) => presences.get(`${e.id}|${j.date}`) ?? ''),
        t.P,
        t.A,
        t.A + t.F
      ]
    })
    await window.api.exportCsv(`registre_pointage_${mois}.csv`, toCsv(entetes, lignes))
  }

  return (
    <>
      <header className="entete-page">
        <div>
          <h1>Registre de pointage</h1>
          <p>Présences et absences jour par jour · alimente directement la paie</p>
        </div>
        <div className="groupe" style={{ display: 'flex', gap: 'var(--e2)' }}>
          <button className="btn btn-secondaire" onClick={prefill} disabled={employes.length === 0}>
            Pré-remplir le mois
          </button>
          <button className="btn btn-secondaire" onClick={exporter} disabled={employes.length === 0}>
            Exporter
          </button>
        </div>
      </header>

      <div className="page-corps">
        <div className="barre-outils">
          <div className="groupe">
            <input
              className="selecteur"
              type="month"
              value={mois}
              onChange={(e) => setMois(e.target.value)}
            />
            <span className="texte-petit texte-gris" style={{ marginLeft: 'var(--e2)' }}>
              Marquer comme :
            </span>
            {TYPES_PRESENCE.map((t) => (
              <button
                key={t.code}
                className={`btn btn-sm ${pinceau === t.code ? 'btn-primaire' : 'btn-secondaire'}`}
                onClick={() => setPinceau(t.code)}
                title={t.label}
              >
                {t.code} · {t.label}
              </button>
            ))}
          </div>
        </div>

        {employes.length === 0 ? (
          <div className="carte vide">
            <div className="icone-vide">👥</div>
            <p>Ajoutez des employés actifs pour tenir le registre.</p>
          </div>
        ) : (
          <>
            <div className="registre-conteneur">
              <table className="registre">
                <thead>
                  <tr>
                    <th className="col-employe">Salarié</th>
                    {jours.map((j) => (
                      <th key={j.date} className={j.semaine >= 5 ? 'weekend' : ''}>
                        <div className="jour-num">{j.jour}</div>
                        <div className="jour-lettre">{LETTRES_JOURS[j.semaine]}</div>
                      </th>
                    ))}
                    <th className="col-total">Bilan</th>
                  </tr>
                </thead>
                <tbody>
                  {employes.map((e) => {
                    const t = totaux.get(e.id)!
                    const deduits = t.A + t.F
                    return (
                      <tr key={e.id}>
                        <td className="col-employe">
                          <div className="cellule-principale texte-petit">
                            {e.nom.toUpperCase()} {e.prenom}
                          </div>
                          <div className="cellule-secondaire texte-xs">{e.poste || 'Non renseigné'}</div>
                        </td>
                        {jours.map((j) => {
                          const code = presences.get(`${e.id}|${j.date}`)
                          return (
                            <td key={j.date}>
                              <button
                                className={`case-presence ${code ? `case-${code}` : ''}`}
                                onClick={() => poser(e.id, j.date)}
                                title={`${e.prenom} ${e.nom} · ${j.jour}/${mois.split('-')[1]} : ${
                                  code ? TYPE_PAR_CODE.get(code)?.label : 'non renseigné'
                                }`}
                              >
                                {code ?? '·'}
                              </button>
                            </td>
                          )
                        })}
                        <td className="col-total">
                          <div>
                            <strong>{t.P}</strong> <span className="texte-gris texte-xs">prés.</span>
                          </div>
                          {deduits > 0 && (
                            <div className="texte-xs" style={{ color: 'var(--erreur)' }}>
                              {deduits} déduit(s)
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="legende">
              {TYPES_PRESENCE.map((t) => (
                <span key={t.code} className="legende-item">
                  <span className={`legende-pastille case-${t.code}`}>{t.code}</span>
                  {t.label}
                  {t.deduit && <span className="badge badge-erreur">retenue</span>}
                </span>
              ))}
            </div>

            <p className="texte-petit texte-gris" style={{ marginTop: 'var(--e3)' }}>
              {chargement ? 'Chargement…' : 'Cliquez sur une case pour appliquer le marquage sélectionné ; recliquez pour l’effacer.'}
            </p>
          </>
        )}
      </div>
    </>
  )
}
