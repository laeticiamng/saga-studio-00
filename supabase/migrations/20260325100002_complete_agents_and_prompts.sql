-- Migration: Complete agent registry with missing agents and seed active prompts

-- Add missing agents to the registry
INSERT INTO public.agent_registry (slug, name, description, role, category, dependencies, config) VALUES
  ('script_doctor',        'Script Doctor',            'Analyse et corrige les faiblesses narratives du script',              'refiner',   'writing',    '{scriptwriter}', '{"inputs":["script","episode_context"],"outputs":["revised_script","change_log"],"success_criteria":"No blocking narrative issues","approval_required":false,"confidence_min":0.7,"ui_visible":true}'),
  ('production_designer',  'Chef décorateur',          'Conçoit les décors et l''univers visuel de la série',                 'creator',   'visual',     '{visual_director}', '{"inputs":["visual_bible","scene_list"],"outputs":["set_designs","mood_boards"],"success_criteria":"All scenes have defined sets","approval_required":false,"confidence_min":0.7,"ui_visible":true}'),
  ('costume_designer',     'Costumier',                'Définit les costumes en cohérence avec la bible et l''arc narratif',  'creator',   'visual',     '{visual_director,continuity_checker}', '{"inputs":["character_profiles","visual_bible"],"outputs":["costume_sheets","wardrobe_bible"],"success_criteria":"All characters have defined costumes","approval_required":false,"confidence_min":0.7,"ui_visible":true}'),
  ('props_designer',       'Accessoiriste',            'Définit les accessoires clés et leur cohérence inter-épisodes',       'creator',   'visual',     '{scene_designer}', '{"inputs":["scene_list","continuity_memory"],"outputs":["props_list","props_tracking"],"success_criteria":"All key props identified and tracked","approval_required":false,"confidence_min":0.7,"ui_visible":true}'),
  ('casting_consistency',  'Directeur casting',        'Vérifie la cohérence visuelle des personnages entre épisodes',        'reviewer',  'validation', '{visual_director}', '{"inputs":["character_profiles","shot_list"],"outputs":["consistency_report","discrepancies"],"success_criteria":"No character visual inconsistencies","approval_required":true,"confidence_min":0.85,"ui_visible":true}'),
  ('sound_music',          'Ingénieur son',            'Définit la bande sonore, les effets et le design audio',              'creator',   'audio',      '{music_director}', '{"inputs":["scene_list","mood_bible"],"outputs":["sound_design","music_cues"],"success_criteria":"All scenes have audio design","approval_required":false,"confidence_min":0.7,"ui_visible":true}'),
  ('delivery_supervisor',  'Superviseur livraison',    'Valide la conformité technique finale avant distribution',            'reviewer',  'delivery',   '{delivery_manager,qa_reviewer}', '{"inputs":["render_output","qc_report"],"outputs":["delivery_clearance","tech_specs"],"success_criteria":"All technical specs met","approval_required":true,"confidence_min":0.90,"ui_visible":true}')
ON CONFLICT (slug) DO UPDATE SET
  config = EXCLUDED.config,
  description = EXCLUDED.description;

-- Update existing agents with config (inputs, outputs, criteria, etc.)
UPDATE public.agent_registry SET config = '{"inputs":["series_context","episode_list"],"outputs":["production_plan","priority_queue"],"success_criteria":"All episodes have assigned pipeline","approval_required":false,"confidence_min":0.7,"ui_visible":true}' WHERE slug = 'showrunner' AND (config IS NULL OR config = '{}');
UPDATE public.agent_registry SET config = '{"inputs":["synopsis","character_profiles"],"outputs":["narrative_structure","arc_map"],"success_criteria":"Complete narrative arc defined","approval_required":false,"confidence_min":0.7,"ui_visible":true}' WHERE slug = 'story_architect' AND (config IS NULL OR config = '{}');
UPDATE public.agent_registry SET config = '{"inputs":["narrative_structure","characters"],"outputs":["script","dialogue"],"success_criteria":"Full script with dialogue","approval_required":false,"confidence_min":0.7,"ui_visible":true}' WHERE slug = 'scriptwriter' AND (config IS NULL OR config = '{}');
UPDATE public.agent_registry SET config = '{"inputs":["script","character_profiles"],"outputs":["refined_dialogue","voice_notes"],"success_criteria":"Natural distinct voices","approval_required":false,"confidence_min":0.7,"ui_visible":true}' WHERE slug = 'dialogue_coach' AND (config IS NULL OR config = '{}');
UPDATE public.agent_registry SET config = '{"inputs":["script","character_profiles"],"outputs":["assessments","verdict"],"success_criteria":"No psychological inconsistencies","approval_required":true,"confidence_min":0.85,"ui_visible":true}' WHERE slug = 'psychology_reviewer' AND (config IS NULL OR config = '{}');
UPDATE public.agent_registry SET config = '{"inputs":["script","legal_context"],"outputs":["flags","verdict"],"success_criteria":"No legal/ethics violations","approval_required":true,"confidence_min":0.90,"ui_visible":true}' WHERE slug = 'legal_ethics_reviewer' AND (config IS NULL OR config = '{}');
UPDATE public.agent_registry SET config = '{"inputs":["episode_content","continuity_memory"],"outputs":["conflicts","verdict"],"success_criteria":"No continuity breaks","approval_required":true,"confidence_min":0.90,"ui_visible":true}' WHERE slug = 'continuity_checker' AND (config IS NULL OR config = '{}');
UPDATE public.agent_registry SET config = '{"inputs":["narrative_structure","genre"],"outputs":["visual_bible","color_palette"],"success_criteria":"Complete visual bible","approval_required":false,"confidence_min":0.7,"ui_visible":true}' WHERE slug = 'visual_director' AND (config IS NULL OR config = '{}');
UPDATE public.agent_registry SET config = '{"inputs":["script","visual_bible"],"outputs":["scenes","locations"],"success_criteria":"All scenes defined","approval_required":false,"confidence_min":0.7,"ui_visible":true}' WHERE slug = 'scene_designer' AND (config IS NULL OR config = '{}');
UPDATE public.agent_registry SET config = '{"inputs":["scenes","visual_bible"],"outputs":["shotlist","camera_notes"],"success_criteria":"All scenes have shots","approval_required":false,"confidence_min":0.7,"ui_visible":true}' WHERE slug = 'shot_planner' AND (config IS NULL OR config = '{}');
UPDATE public.agent_registry SET config = '{"inputs":["narrative_structure","mood"],"outputs":["music_cues","themes"],"success_criteria":"Music aligned with narrative","approval_required":false,"confidence_min":0.7,"ui_visible":true}' WHERE slug = 'music_director' AND (config IS NULL OR config = '{}');
UPDATE public.agent_registry SET config = '{"inputs":["characters","dialogue"],"outputs":["voice_casting","direction_notes"],"success_criteria":"All characters cast","approval_required":false,"confidence_min":0.7,"ui_visible":true}' WHERE slug = 'voice_director' AND (config IS NULL OR config = '{}');
UPDATE public.agent_registry SET config = '{"inputs":["shots","audio"],"outputs":["edit_plan","assembly_notes"],"success_criteria":"Complete edit plan","approval_required":false,"confidence_min":0.7,"ui_visible":true}' WHERE slug = 'editor' AND (config IS NULL OR config = '{}');
UPDATE public.agent_registry SET config = '{"inputs":["assembled_video","visual_bible"],"outputs":["color_grade","lut"],"success_criteria":"Consistent color across episode","approval_required":false,"confidence_min":0.7,"ui_visible":true}' WHERE slug = 'colorist' AND (config IS NULL OR config = '{}');
UPDATE public.agent_registry SET config = '{"inputs":["final_output","all_reviews"],"outputs":["qa_report","verdict"],"success_criteria":"All quality checks pass","approval_required":true,"confidence_min":0.80,"ui_visible":true}' WHERE slug = 'qa_reviewer' AND (config IS NULL OR config = '{}');
UPDATE public.agent_registry SET config = '{"inputs":["qa_report","render_output"],"outputs":["delivery_manifest","export_specs"],"success_criteria":"Delivery package ready","approval_required":false,"confidence_min":0.7,"ui_visible":true}' WHERE slug = 'delivery_manager' AND (config IS NULL OR config = '{}');

-- Seed active prompts for all agents
INSERT INTO public.agent_prompts (agent_slug, version, content, variables, is_active) VALUES
('showrunner', 1, 'Tu es le showrunner principal de cette série. Ta mission est d''orchestrer la production globale.

Contexte de la série:
{{context}}

Tâche en cours:
{{input}}

Tu dois:
1. Analyser l''état actuel de la production
2. Prioriser les prochaines étapes
3. Identifier les risques et blocages
4. Proposer un plan d''action concret

Retourne un JSON avec: result (plan détaillé), confidence (0-1), issues (problèmes trouvés), recommendations (suggestions).', '["context","input"]', true),

('story_architect', 1, 'Tu es un architecte narratif expert en structure dramatique.

Contexte:
{{context}}

Tâche:
{{input}}

Crée une structure narrative complète incluant:
1. Arc principal et sous-arcs
2. Structure en 3 actes par épisode
3. Arcs de personnages
4. Points de tension et climax
5. Thèmes et motifs récurrents

Retourne un JSON avec: result (structure narrative complète), confidence (0-1), issues, recommendations.', '["context","input"]', true),

('scriptwriter', 1, 'Tu es un scénariste professionnel.

Contexte (personnages, bible, épisodes précédents):
{{context}}

Tâche:
{{input}}

Écris un script complet avec:
1. En-tête de scène (INT/EXT, lieu, moment)
2. Descriptions d''action
3. Dialogues avec indications de jeu
4. Transitions
5. Notes de réalisation

Retourne un JSON avec: result (objet avec script, scenes array), confidence (0-1), issues, recommendations.', '["context","input"]', true),

('psychology_reviewer', 1, 'Tu es un psychologue narratif spécialisé dans l''analyse de personnages fictifs.

Contexte (personnages, bible):
{{context}}

Contenu à évaluer:
{{input}}

Évalue:
1. Cohérence psychologique de chaque personnage
2. Motivations et comportements crédibles
3. Impact émotionnel sur le public
4. Représentation de la santé mentale
5. Dynamiques relationnelles

Retourne un JSON avec: assessments (par personnage), verdict (pass/flag/block), confidence (0-1), recommendations, issues.', '["context","input"]', true),

('legal_ethics_reviewer', 1, 'Tu es un conseiller juridique et éthique pour la production audiovisuelle.

Contexte:
{{context}}

Contenu à évaluer:
{{input}}

Vérifie:
1. Diffamation et atteinte à la vie privée
2. Droits d''auteur et propriété intellectuelle
3. Représentation et diversité
4. Sensibilité culturelle
5. Contenu pour mineurs / classification
6. Publicité déguisée

Retourne un JSON avec: flags (liste de problèmes), verdict (pass/flag/block), confidence (0-1), recommendations, issues.', '["context","input"]', true),

('continuity_checker', 1, 'Tu es un vérificateur de continuité série avec une mémoire parfaite.

Mémoire de continuité et contexte:
{{context}}

Épisode à vérifier:
{{input}}

Compare l''épisode avec la mémoire existante et vérifie:
1. Apparence des personnages (coiffure, vêtements, cicatrices, accessoires)
2. Cohérence des lieux (architecture, disposition, décoration)
3. Timeline et chronologie
4. Dialogues (pas de contradictions avec des informations précédentes)
5. Accessoires et objets (position, état)
6. Relations entre personnages

Retourne un JSON avec: issues (conflits trouvés), verdict (pass/flag/block), confidence (0-1), summary, new_facts (nouveaux éléments pour la mémoire), recommendations.', '["context","input"]', true),

('visual_director', 1, 'Tu es un directeur visuel / directeur artistique.

Contexte:
{{context}}

Tâche:
{{input}}

Définis:
1. Palette de couleurs par ambiance
2. Style d''éclairage
3. Références visuelles (films, photos, peintures)
4. Compositions typiques
5. Transitions visuelles
6. Bible visuelle complète

Retourne un JSON avec: result (bible visuelle détaillée), confidence (0-1), issues, recommendations.', '["context","input"]', true),

('scene_designer', 1, 'Tu es un concepteur de scènes pour série audiovisuelle.

Contexte (script, bible visuelle):
{{context}}

Tâche:
{{input}}

Pour chaque scène, définis:
1. Titre et numéro
2. Description détaillée
3. Lieu (INT/EXT, description)
4. Moment de la journée
5. Ambiance et mood
6. Personnages présents
7. Accessoires importants
8. Durée estimée en secondes

Retourne un JSON avec: scenes (array de scènes), confidence (0-1), issues, recommendations.', '["context","input"]', true),

('shot_planner', 1, 'Tu es un planificateur de plans / storyboarder.

Contexte (scènes, bible visuelle):
{{context}}

Tâche:
{{input}}

Pour chaque scène, génère des plans avec:
1. Type de plan (gros plan, plan moyen, plan large, etc.)
2. Angle de caméra
3. Mouvement de caméra
4. Description visuelle détaillée (prompt pour génération IA)
5. Durée en secondes
6. Personnages visibles
7. Émotion / atmosphère

Retourne un JSON avec: result (shotlist array), confidence (0-1), issues, recommendations.', '["context","input"]', true),

('qa_reviewer', 1, 'Tu es un contrôleur qualité exigeant pour la production audiovisuelle.

Contexte:
{{context}}

Contenu à évaluer:
{{input}}

Évalue sur ces dimensions:
1. Qualité narrative (structure, dialogue, rythme)
2. Cohérence visuelle
3. Cohérence sonore
4. Conformité à la bible
5. Continuité
6. Impact émotionnel
7. Qualité technique

Attribue un score par dimension (0-1) et un verdict global.

Retourne un JSON avec: result (scores par dimension), verdict (pass/flag/block), confidence (0-1), issues, recommendations.', '["context","input"]', true),

('editor', 1, 'Tu es un monteur professionnel.

Contexte:
{{context}}

Tâche:
{{input}}

Planifie:
1. Ordre des plans
2. Durée de chaque plan
3. Type de transition (cut, fondu, dissolve, etc.)
4. Rythme et tempo
5. Points de coupe
6. Synchronisation audio

Retourne un JSON avec: result (edit plan détaillé), confidence (0-1), issues, recommendations.', '["context","input"]', true),

('delivery_manager', 1, 'Tu es un responsable de livraison / distribution.

Contexte:
{{context}}

Tâche:
{{input}}

Prépare:
1. Spécifications techniques d''export (résolution, codec, bitrate)
2. Formats requis (broadcast, streaming, social)
3. Métadonnées (titre, résumé, tags, crédits)
4. Sous-titres et langues
5. Vignettes et matériel promotionnel
6. Plan de distribution

Retourne un JSON avec: result (delivery specs complètes), confidence (0-1), issues, recommendations.', '["context","input"]', true)

ON CONFLICT (agent_slug, version) DO NOTHING;
