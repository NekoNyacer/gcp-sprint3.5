# CAT WALK agent instructions

Before planning or changing this project, read [`CONTEXT.md`](./CONTEXT.md).

## Project memory

- Treat `CONTEXT.md` as the source of truth for product direction, scope, constraints, terminology, and unresolved decisions.
- Update `CONTEXT.md` whenever a product, technical, delivery, or project-management decision is confirmed.
- Do not silently turn an open question into a decision. Record it as unresolved until the user confirms it.

## Repository-local skills

The shared Matt Pocock skill collection is versioned under [`skills-main/`](./skills-main/).

- When the user invokes `grill-me`, read `skills-main/skills/productivity/grill-me/SKILL.md` and follow its pointer to `skills-main/skills/productivity/grilling/SKILL.md`.
- When another skill in this collection is named, locate and read its complete `SKILL.md` before acting.
- Treat `skills-main` as shared third-party workflow source. Do not modify it unless the user explicitly asks to customize or update the skill collection.

## Planning artifacts

- Keep Azure Boards planning and import artifacts under `docs/azure-boards/` once scope is confirmed.
- Optimize the two-month project for a coherent, convincing demo rather than production readiness.

