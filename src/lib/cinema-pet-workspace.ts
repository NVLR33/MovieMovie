import {
  PET_CARE,
  PET_ITEMS,
  PET_UPGRADES,
  petProgress,
  type PetSnapshot,
  type PetCare,
} from "./cinema-pet";
export function petPurchaseGoals(
  pet: Pick<PetSnapshot, "projectorLevel" | "archiveLevel" | "owned">,
) {
  return [
    ...Object.entries(PET_UPGRADES).flatMap(([kind, upgrade]) => {
      const level =
          kind === "projector" ? pet.projectorLevel : pet.archiveLevel,
        price = upgrade.prices[level];
      return price === undefined
        ? []
        : [
            {
              id: `${kind}:${level}`,
              label: `${upgrade.label} · уровень ${level + 1}`,
              price,
              purchase: {
                action: "upgrade",
                kind,
                expectedLevel: level,
              } as Record<string, unknown>,
            },
          ];
    }),
    ...PET_ITEMS.filter((item) => !pet.owned.includes(item.id)).map((item) => ({
      id: item.id,
      label: item.label,
      price: item.price,
      purchase: { action: "buy", id: item.id } as Record<string, unknown>,
    })),
  ];
}
/** Display-only state from the same public policies; the server remains authoritative. */
export function petCareState(
  pet: Pick<PetSnapshot, "experience" | "archiveLevel" | "balance" | "cared">,
  kind: PetCare,
) {
  const policy = PET_CARE[kind],
    done = pet.cared.includes(kind),
    locked = petProgress(pet.experience).level < policy.level,
    missing = Math.max(0, policy.cost - pet.balance);
  return {
    done,
    locked,
    missing,
    ready: !done && !locked && !missing,
    experience: Math.floor(policy.xp * (1 + pet.archiveLevel / 10)),
  };
}
