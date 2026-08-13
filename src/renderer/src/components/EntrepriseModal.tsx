import { useEffect, useState } from 'react'
import type { AppConfig } from '../../../shared/types'
import { chargerConfig, sauverConfig } from '../lib/config'
import { importerLogo } from '../lib/image'
import { monogramme, titreFenetre } from '../lib/produit'
import { jouer } from '../lib/son'

/**
 * Formulaire « Entreprise & modèle de contrat » du module Paramètres.
 * Il se charge et s'enregistre lui-même ; `onSaved` prévient le reste de
 * l'application (barre latérale, titre de la fenêtre) du nouveau nom.
 */
export function EntrepriseForm({ onSaved }: { onSaved?: (c: AppConfig) => void }): JSX.Element {
  const [form, setForm] = useState<AppConfig | null>(null)
  const [enreg, setEnreg] = useState(false)
  const [ok, setOk] = useState(false)
  const [logoCharge, setLogoCharge] = useState(false)

  useEffect(() => {
    chargerConfig().then(setForm)
  }, [])

  function set<K extends keyof AppConfig>(cle: K, val: AppConfig[K]): void {
    setForm((f) => (f ? { ...f, [cle]: val } : f))
    setOk(false)
  }

  async function choisirLogo(): Promise<void> {
    setLogoCharge(true)
    try {
      const logo = await importerLogo()
      if (logo) set('logo', logo)
    } finally {
      setLogoCharge(false)
    }
  }

  async function enregistrer(): Promise<void> {
    if (!form) return
    setEnreg(true)
    try {
      await sauverConfig(form)
      window.api.window.setTitle(titreFenetre(form.entreprise_nom))
      setOk(true)
      jouer('succes')
      onSaved?.(form)
    } finally {
      setEnreg(false)
    }
  }

  if (!form) return <p className="vide-doux">Chargement…</p>

  return (
    <div className="param-form">
      <h3 className="section-titre" style={{ marginTop: 0 }}>
        Identité
      </h3>

      <div className="logo-choix">
        {form.logo ? (
          <img className="logo-apercu" src={form.logo} alt="Logo de l'entreprise" />
        ) : (
          <div className="logo-apercu logo-vide">{monogramme(form.entreprise_nom)}</div>
        )}
        <div className="logo-actions">
          <button
            type="button"
            className="btn btn-secondaire btn-sm"
            onClick={choisirLogo}
            disabled={logoCharge}
          >
            {logoCharge ? 'Import…' : form.logo ? 'Remplacer le logo' : 'Choisir un logo'}
          </button>
          {form.logo && (
            <button type="button" className="btn-danger btn-sm" onClick={() => set('logo', null)}>
              Retirer
            </button>
          )}
          <span className="aide">
            Apparaît dans la barre latérale, l'écran d'accueil et sur tous les documents. PNG
            transparent recommandé.
          </span>
        </div>
      </div>

      <div className="grille-champs">
        <div className="champ">
          <label>Nom de l'établissement</label>
          <input value={form.entreprise_nom} onChange={(e) => set('entreprise_nom', e.target.value)} />
        </div>
        <div className="champ">
          <label>Activité</label>
          <input value={form.entreprise_activite} onChange={(e) => set('entreprise_activite', e.target.value)} />
        </div>
        <div className="champ">
          <label>Adresse</label>
          <input value={form.entreprise_adresse} onChange={(e) => set('entreprise_adresse', e.target.value)} />
        </div>
        <div className="champ">
          <label>Ville</label>
          <input value={form.entreprise_ville} onChange={(e) => set('entreprise_ville', e.target.value)} />
        </div>
        <div className="champ">
          <label>Téléphone</label>
          <input
            value={form.entreprise_telephone}
            onChange={(e) => set('entreprise_telephone', e.target.value)}
          />
        </div>
        <div className="champ">
          <label>E-mail</label>
          <input value={form.entreprise_email} onChange={(e) => set('entreprise_email', e.target.value)} />
        </div>
        <div className="champ">
          <label>Représentant (signataire)</label>
          <input value={form.representant} onChange={(e) => set('representant', e.target.value)} />
        </div>
        <div className="champ">
          <label>Devise</label>
          <input value={form.devise} onChange={(e) => set('devise', e.target.value)} />
        </div>
      </div>

      <h3 className="section-titre">Couleur des documents</h3>
      <div className="doc-couleur">
        <input
          type="color"
          className="dc-picker"
          value={form.doc_couleur || '#334155'}
          onChange={(e) => set('doc_couleur', e.target.value)}
          aria-label="Couleur d'accent des documents"
        />
        <div className="dc-presets">
          {['', '#1d4ed8', '#0e7490', '#15803d', '#9d174d', '#b45309', '#334155'].map((c) => (
            <button
              key={c || 'neutre'}
              type="button"
              className={`dc-swatch ${(form.doc_couleur || '') === c ? 'actif' : ''}`}
              style={c ? { background: c } : undefined}
              onClick={() => set('doc_couleur', c)}
              title={c || 'Neutre'}
            >
              {c ? '' : 'N'}
            </button>
          ))}
        </div>
        <span className="aide">
          {form.doc_couleur ? `Accent ${form.doc_couleur.toUpperCase()}` : 'Neutre (graphite) · par défaut'}.
          Colore les titres, filets et fonds de tableau des documents imprimés.
        </span>
      </div>

      <h3 className="section-titre">Identifiants légaux</h3>
      <div className="encart" style={{ marginBottom: 'var(--e4)' }}>
        Le <strong>numéro employeur CNSS</strong> est obligatoire sur la DRS et le BNTS.
        Renseignez-le pour que vos déclarations soient recevables.
      </div>
      <div className="grille-champs">
        <div className="champ">
          <label>N° employeur CNSS</label>
          <input
            value={form.numero_employeur_cnss}
            placeholder="ex. 12345 A"
            onChange={(e) => set('numero_employeur_cnss', e.target.value)}
          />
        </div>
        <div className="champ">
          <label>IFU</label>
          <input value={form.ifu} onChange={(e) => set('ifu', e.target.value)} />
          <span className="aide">Identifiant Financier Unique</span>
        </div>
        <div className="champ">
          <label>RCCM</label>
          <input value={form.rccm} onChange={(e) => set('rccm', e.target.value)} />
          <span className="aide">Registre du commerce</span>
        </div>
      </div>

      <h3 className="section-titre">Modèle de contrat par défaut</h3>
      <div className="grille-champs">
        <div className="champ">
          <label>Durée par défaut (mois)</label>
          <input
            type="number"
            min="1"
            value={form.contrat_duree_mois}
            onChange={(e) => set('contrat_duree_mois', Number(e.target.value) || 1)}
          />
        </div>
        <div className="champ">
          <label>Repos hebdomadaire (jours)</label>
          <input
            type="number"
            min="0"
            max="7"
            value={form.contrat_jours_repos}
            onChange={(e) => set('contrat_jours_repos', Number(e.target.value) || 0)}
          />
        </div>
        <div className="champ">
          <label>Période d'essai</label>
          <input
            value={form.contrat_periode_essai}
            onChange={(e) => set('contrat_periode_essai', e.target.value)}
          />
        </div>
        <div className="champ pleine-largeur">
          <label>Clauses par défaut</label>
          <textarea value={form.contrat_clauses} onChange={(e) => set('contrat_clauses', e.target.value)} />
        </div>
      </div>

      <div className="param-actions">
        {ok && <span className="param-ok">✓ Enregistré</span>}
        <button className="btn btn-primaire" onClick={enregistrer} disabled={enreg}>
          {enreg ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  )
}
