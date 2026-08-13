import { useEffect, useState } from 'react'
import type { PayrollSettings } from '../../../shared/types'
import { PARAMS_PAIE_DEFAUT } from '../../../shared/types'
import { chargerParamsPaie, sauverParamsPaie } from '../lib/config'

/** Saisie d'un taux exprimé en pourcentage (stocké en décimal). */
function ChampTaux({
  label,
  valeur,
  onChange,
  aide
}: {
  label: string
  valeur: number
  onChange: (v: number) => void
  aide?: string
}): JSX.Element {
  return (
    <div className="champ">
      <label>{label}</label>
      <input
        type="number"
        step="0.01"
        min="0"
        value={+(valeur * 100).toFixed(2)}
        onChange={(e) => onChange((Number(e.target.value) || 0) / 100)}
      />
      {aide && <span className="aide">{aide}</span>}
    </div>
  )
}

/**
 * Formulaire « Barème & cotisations » du module Paramètres. Les taux burkinabè
 * sont pré-remplis mais restent modifiables : la réglementation évolue et doit
 * être validée par un comptable.
 */
export function ParamsPaieForm(): JSX.Element {
  const [form, setForm] = useState<PayrollSettings | null>(null)
  const [enreg, setEnreg] = useState(false)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    chargerParamsPaie().then(setForm)
  }, [])

  function set<K extends keyof PayrollSettings>(cle: K, val: PayrollSettings[K]): void {
    setForm((f) => (f ? { ...f, [cle]: val } : f))
    setOk(false)
  }

  function setTranche(index: number, taux: number): void {
    setForm((f) =>
      f ? { ...f, iuts_bareme: f.iuts_bareme.map((t, i) => (i === index ? { ...t, taux } : t)) } : f
    )
    setOk(false)
  }

  async function enregistrer(): Promise<void> {
    if (!form) return
    setEnreg(true)
    try {
      await sauverParamsPaie(form)
      setOk(true)
    } finally {
      setEnreg(false)
    }
  }

  if (!form) return <p className="vide-doux">Chargement…</p>

  const fmt = (n: number): string => n.toLocaleString('fr-FR')

  return (
    <div className="param-form">
      <div className="encart" style={{ marginBottom: 'var(--e4)' }}>
        Ces taux sont pré-remplis selon la réglementation du <strong>Burkina Faso</strong>.
        Vérifiez-les avec votre comptable : ils déterminent le net à payer de chaque bulletin.
      </div>

      <h3 className="section-titre" style={{ marginTop: 0 }}>
        Cotisations sociales (CNSS)
      </h3>
      <div className="grille-champs">
        <ChampTaux
          label="Part salariale (%)"
          valeur={form.cnss_salarie}
          onChange={(v) => set('cnss_salarie', v)}
          aide="Retenue sur le salaire du travailleur"
        />
        <div className="champ">
          <label>Plafond mensuel cotisable</label>
          <input
            type="number"
            step="1000"
            min="0"
            value={form.cnss_plafond}
            onChange={(e) => set('cnss_plafond', Number(e.target.value) || 0)}
          />
          <span className="aide">{fmt(form.cnss_plafond)} FCFA · arrêté n° 2022-067</span>
        </div>
        <div className="champ">
          <label>SMIG mensuel</label>
          <input
            type="number"
            step="1000"
            min="0"
            value={form.smig}
            onChange={(e) => set('smig', Number(e.target.value) || 0)}
          />
          <span className="aide">Plancher de cotisation</span>
        </div>
        <ChampTaux
          label="Employeur · pension (%)"
          valeur={form.cnss_employeur_pension}
          onChange={(v) => set('cnss_employeur_pension', v)}
        />
        <ChampTaux
          label="Employeur · prestations familiales (%)"
          valeur={form.cnss_employeur_familiales}
          onChange={(v) => set('cnss_employeur_familiales', v)}
        />
        <ChampTaux
          label="Employeur · risques professionnels (%)"
          valeur={form.cnss_employeur_risques}
          onChange={(v) => set('cnss_employeur_risques', v)}
        />
        <ChampTaux
          label="Taxe patronale d'apprentissage (%)"
          valeur={form.taxe_patronale}
          onChange={(v) => set('taxe_patronale', v)}
        />
      </div>

      <h3 className="section-titre">Impôt sur les salaires (IUTS)</h3>
      <div className="grille-champs">
        <ChampTaux
          label="Abattement · employés / ouvriers (%)"
          valeur={form.iuts_abattement}
          onChange={(v) => set('iuts_abattement', v)}
          aide="Article 111 du CGI"
        />
        <ChampTaux
          label="Abattement · cadres (%)"
          valeur={form.iuts_abattement_cadre}
          onChange={(v) => set('iuts_abattement_cadre', v)}
          aide="Cadres moyens et supérieurs"
        />
        <div className="champ">
          <label>Charges de famille admises</label>
          <input
            type="number"
            min="0"
            max="7"
            value={form.iuts_charges_max}
            onChange={(e) => set('iuts_charges_max', Number(e.target.value) || 0)}
          />
          <span className="aide">Ramené de 7 à 4 depuis 2018</span>
        </div>
      </div>
      <p className="texte-petit texte-gris" style={{ marginBottom: 'var(--e4)' }}>
        Base imposable = brut − retenue pension salariale − abattement forfaitaire. Réductions pour
        charges : {form.iuts_reduction_charge.map((r) => `${(r * 100).toFixed(0)} %`).join(' · ')}.
      </p>

      <div className="tableau-conteneur" style={{ marginBottom: 'var(--e4)' }}>
        <table>
          <thead>
            <tr>
              <th>Tranche mensuelle de revenu imposable</th>
              <th className="num" style={{ width: 130 }}>
                Taux (%)
              </th>
            </tr>
          </thead>
          <tbody>
            {form.iuts_bareme.map((t, i) => {
              const bas = i === 0 ? 0 : (form.iuts_bareme[i - 1].plafond ?? 0)
              return (
                <tr key={i}>
                  <td>
                    {t.plafond === null
                      ? `Au-delà de ${fmt(bas)} FCFA`
                      : `De ${fmt(bas + (i === 0 ? 0 : 1))} à ${fmt(t.plafond)} FCFA`}
                  </td>
                  <td className="num">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      style={{ width: 90, textAlign: 'right' }}
                      value={+(t.taux * 100).toFixed(2)}
                      onChange={(e) => setTranche(i, (Number(e.target.value) || 0) / 100)}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <h3 className="section-titre">Heures supplémentaires</h3>
      <div className="grille-champs">
        <div className="champ">
          <label>Seuil hebdomadaire (heures)</label>
          <input
            type="number"
            step="1"
            min="0"
            value={form.seuil_heures_sup}
            onChange={(e) => set('seuil_heures_sup', Number(e.target.value) || 0)}
          />
          <span className="aide">Au-delà, les heures sont majorées</span>
        </div>
        <ChampTaux
          label="Majoration (%)"
          valeur={form.majoration_sup}
          onChange={(v) => set('majoration_sup', v)}
        />
        <div className="champ">
          <label>Seuil de déclaration mensuelle</label>
          <input
            type="number"
            min="1"
            value={form.seuil_effectif_mensuel}
            onChange={(e) => set('seuil_effectif_mensuel', Number(e.target.value) || 1)}
          />
          <span className="aide">À partir de cet effectif, la déclaration CNSS est mensuelle</span>
        </div>
      </div>

      <h3 className="section-titre">Pénalités de retard</h3>
      <div className="encart" style={{ marginBottom: 'var(--e4)' }}>
        Servent uniquement à <strong>estimer</strong> le risque quand une déclaration dépasse sa date
        limite (loi n° 004-2021/AN). Les cases correspondantes du formulaire restent vides : elles
        sont réservées à la CNSS.
      </div>
      <div className="grille-champs">
        <ChampTaux
          label="Majoration de retard (% par mois)"
          valeur={form.majoration_retard_mois}
          onChange={(v) => set('majoration_retard_mois', v)}
          aide="Tout mois entamé compte pour un mois"
        />
        <ChampTaux
          label="Taxation d'office (%)"
          valeur={form.taxation_office}
          onChange={(v) => set('taxation_office', v)}
          aide="En l'absence totale de déclaration"
        />
        <ChampTaux
          label="Non-production, en part du SMIG (%)"
          valeur={form.non_production_smig}
          onChange={(v) => set('non_production_smig', v)}
          aide="Par salarié non déclaré"
        />
      </div>

      <div className="param-actions">
        {ok && <span className="param-ok">✓ Enregistré</span>}
        <button
          className="btn btn-discret"
          onClick={() => {
            setForm({ ...PARAMS_PAIE_DEFAUT })
            setOk(false)
          }}
          title="Rétablir les taux burkinabè par défaut"
        >
          Réinitialiser
        </button>
        <button className="btn btn-primaire" onClick={enregistrer} disabled={enreg}>
          {enreg ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  )
}
