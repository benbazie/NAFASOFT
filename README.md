# Nafasoft — Gestion du personnel & de la paie

Application de bureau (Windows) pour la gestion du personnel et de la paie au Burkina Faso : fiches employés, contrats, planning, congés, pointage, bulletins de paie, déclarations CNSS (BNTS/DRS) et actes RH. Fonctionne **entièrement hors ligne** — aucun serveur, aucune donnée envoyée nulle part.

Conçue pour deux usages :
- **une seule entreprise**  l'application s'ouvre directement sur son dossier ;
- **un cabinet** (comptable, agent CNSS, prestataire RH) un portefeuille suit plusieurs employeurs, chacun dans sa propre base de données, totalement isolée des autres.

## Stack

- **Electron** + **React** + **TypeScript**
- **SQLite** via `better-sqlite3` — une base par employeur, aucune donnée en ligne
- **electron-vite** (build) + **electron-builder** (installateur `.exe`)

## Démarrage en développement

```bash
npm install
npm run dev
```

## Générer l'installateur Windows

```bash
npm run dist
```

L'installateur est produit dans `dist-app/`. La version de l'application est incrémentée automatiquement à chaque exécution.

## Modules

| Module | Description |
|---|---|
| Tableau de bord | Ce qui presse aujourd'hui : déclarations, bulletins, contrats à échéance |
| Portefeuille | Vue consolidée de tous les employeurs suivis (mode cabinet) |
| Employés & Dossiers | Fiches complètes, actes RH, pièces jointes, filiation |
| Contrats | Rédaction, avenants, renouvellements, historique |
| Planning, Pointage, Congés | Suivi du temps de travail et des absences |
| Paie | Calcul CNSS/IUTS, éléments personnalisés, bulletins A4 |
| Déclarations CNSS | BNTS et DRS conformes aux imprimés officiels |
| Paramètres | Entreprise, barème social/fiscal, installation, sauvegarde, sons |

## Données & sauvegarde

Chaque employeur a son propre fichier SQLite, dans `%APPDATA%/gestion-personnel/employeurs/`. Une sauvegarde (Paramètres → Sauvegarde) produit un dossier lisible — bases, pièces jointes et un manifeste — que l'on peut copier sur une clé USB ou remettre à un client qui reprend sa paie.

## Architecture

- `src/main/` — processus principal Electron (fenêtre, bases de données, IPC, sauvegarde)
- `src/preload/` — pont sécurisé exposant une API typée au renderer
- `src/renderer/` — interface React
- `src/shared/` — types et règles métier partagés main/renderer
- `scripts/` — outils de build et de diagnostic (icône, version, mot de passe maître)

## Conçu par

**AFRICA-TIC** *Les TIC au service de l'humanité.*
