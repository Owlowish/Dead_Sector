/**
 * DEAD SECTOR — Catalogue et gestion des améliorations de tentative (Atelier F2).
 * Offres gratuites proposées dans le monde pendant les accalmies, sans menu bloquant.
 *
 * Les stèles affichent les icônes pixel art du catalogue ; le HUD décrit leurs effets.
 */

export type UpgradeId = 'ammo_capacity' | 'hip_accuracy' | 'vitality' | 'agility';

export interface UpgradeSpec {
  id: UpgradeId;
  name: string;
  shortDesc: string;
  fullDesc: string;
  iconPlaceholder: string; // Identifiant sémantique historique
  spriteAssetId: string;   // Chemin relatif à public, chargé par la stèle
}

export const UPGRADE_CATALOG: Record<UpgradeId, UpgradeSpec> = {
  ammo_capacity: {
    id: 'ammo_capacity',
    name: 'Cartouchière Renforcée',
    shortDesc: '+50% Réserve max & Ravitaillement',
    fullDesc: 'Augmente la réserve max (Pistolet 60->90, Fusil 30->45) et réapprovisionne instantanément.',
    iconPlaceholder: 'sprite_upgrade_ammo_pouch',
    spriteAssetId: 'assets/sprites/upgrades/upgrade-ammo-pouch.png',
  },
  hip_accuracy: {
    id: 'hip_accuracy',
    name: 'Canon Ajusté',
    shortDesc: 'Précision de hanche accrue',
    fullDesc: 'Ressert le cône de dispersion à la hanche (Pistolet 2.0°->1.2°, Fusil 5.0°->3.5°).',
    iconPlaceholder: 'sprite_upgrade_tight_choke',
    spriteAssetId: 'assets/sprites/upgrades/upgrade-tight-choke.png',
  },
  vitality: {
    id: 'vitality',
    name: 'Élixir de Vitalité',
    shortDesc: '+20 PV Max & Soin de 40 PV',
    fullDesc: 'Augmente la vie maximale à 120 PV et applique un soin immédiat de 40 PV.',
    iconPlaceholder: 'sprite_upgrade_vitality_vial',
    spriteAssetId: 'assets/sprites/upgrades/upgrade-vitality-vial.png',
  },
  agility: {
    id: 'agility',
    name: 'Bottes de Cuir Souple',
    shortDesc: '+12% Vitesse de déplacement',
    fullDesc: 'Allège la démarche : vitesse normale 4.0->4.5 m/s et sprint 6.0->6.7 m/s.',
    iconPlaceholder: 'sprite_upgrade_light_boots',
    spriteAssetId: 'assets/sprites/upgrades/upgrade-light-boots.png',
  },
};

export const UPGRADE_CONFIGS: UpgradeSpec[] = Object.values(UPGRADE_CATALOG);

/**
 * Tire jusqu'à deux améliorations inédites pour le palier courant.
 */
export function drawTierUpgrades(appliedUpgrades: UpgradeId[] = []): UpgradeSpec[] {
  const allIds: UpgradeId[] = ['ammo_capacity', 'hip_accuracy', 'vitality', 'agility'];
  const applied = appliedUpgrades ?? [];
  const available = allIds.filter((id) => !applied.includes(id));
  // Mélange de Fisher-Yates : seules les améliorations encore disponibles sont tirées.
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }
  return available.slice(0, 2).map((id) => UPGRADE_CATALOG[id]);
}
