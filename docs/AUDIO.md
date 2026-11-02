# Audio provisoire adouci

Retour utilisateur : sons trop artificiels ou agressifs. Première correction ciblée, sans changer les mécaniques : variantes `*-soft.wav`, anciens fichiers conservés.

`scripts/generate_soft_audio.py` génère six sons mono PCM 16 bits / 44,1 kHz avec Python standard et une graine fixe. Les sons sont synthétiques, pas des enregistrements réalistes. Le bruit est filtré pour réduire les aigus ; les transitoires ont une courte montée et une extinction pour limiter les clics ; les impacts n'ont plus les tonalités métalliques aiguës fixes. L'ambiance est un souffle filtré de 12 secondes avec raccord recouvert, plutôt qu'une boucle très courte. Le grognement devient un souffle rauque stylisé : une vraie prise vocale serait préférable pour une voix naturelle.

## Lecture et équilibre

- Weapon.ts : tir 0,5 ; impact décor 0,3 ; impact zombie 0,35 ; clic à vide 0,3. Ce sont des gains linéaires, pas une échelle perceptuelle en pourcentage.
- Game.ts : ambiance 0,15 ; pause à la perte du Pointer Lock, reprise au retour, arrêt en fin de partie. Réactivation du contexte Web Audio depuis l'événement de verrouillage et avertissement si chargement impossible.
- Zombie.ts : son spatial 0,3 au lieu de 0,9, intervalle 7–12 secondes au lieu de 4–8, arrêt des grognements en pause ou fin. L'atténuation spatiale existante est conservée ; pas d'occlusion sonore à travers les murs.

Les sons de tir et impacts utilisent encore HTMLAudio ; ambiance et zombies utilisent Three.js/Web Audio. Aucune refonte ni dépendance ajoutée. Les sons très courts de l'arme peuvent finir leur lecture après Échap ; ambiance et grognements sont interrompus.

## Vérification et écoute

Build réussi ; six fichiers contrôlés (format, durée, absence d'écrêtage et raccord numérique de boucle). Aucun test navigateur ni validation auditive par l'assistant. À vérifier au casque ou aux enceintes : équilibre tir/impact, identification gauche/droite d'un zombie, répétition de l'ambiance, Échap/reprise et fin de partie. Ne pas juger le mixage uniquement en écoutant chaque fichier isolément.

Pour régénérer : `python scripts/generate_soft_audio.py`. Pour revenir aux anciens sons, retirer `-soft` des chemins dans Weapon.ts et Game.ts ; les réglages de gain et de pause restent indépendants des fichiers.
