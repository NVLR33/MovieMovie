import assert from "node:assert/strict";
import { test } from "node:test";
import { PET_ITEMS, PET_UPGRADES } from "../src/lib/cinema-pet";
import {
  petCareState,
  petPurchaseGoals,
} from "../src/lib/cinema-pet-workspace";

test("studio goals use policy prices and expected levels, exclude owned items without reserving currency", () => {
  const pet = {
    projectorLevel: 2,
    archiveLevel: 1,
    owned: ["accessory:bowtie"],
  };
  const before = structuredClone(pet),
    goals = petPurchaseGoals(pet);
  assert.deepEqual(goals[0], {
    id: "projector:2",
    label: "Проектор · уровень 3",
    price: PET_UPGRADES.projector.prices[2],
    purchase: { action: "upgrade", kind: "projector", expectedLevel: 2 },
  });
  assert.equal(goals[1].price, PET_UPGRADES.archive.prices[1]);
  assert(!goals.some((g) => g.id === "accessory:bowtie"));
  for (const item of PET_ITEMS.filter((i) => !pet.owned.includes(i.id))) {
    assert.deepEqual(goals.find((g) => g.id === item.id)?.purchase, {
      action: "buy",
      id: item.id,
    });
    assert.equal(goals.find((g) => g.id === item.id)?.price, item.price);
  }
  assert.deepEqual(pet, before);
});
test("completed collection and maximum upgrades yield no phantom goals", () => {
  assert.deepEqual(
    petPurchaseGoals({
      projectorLevel: 5,
      archiveLevel: 3,
      owned: PET_ITEMS.map((i) => i.id),
    }),
    [],
  );
});
test("care explains level locks, missing currency, completion and archive XP using authoritative policies", () => {
  const pet = {
    experience: 0,
    archiveLevel: 0,
    balance: 8,
    cared: [] as string[],
  };
  assert.deepEqual(petCareState(pet, "feed"), {
    done: false,
    locked: false,
    missing: 0,
    ready: true,
    experience: 10,
  });
  assert.equal(petCareState(pet, "play").missing, 4);
  assert.equal(petCareState(pet, "train").locked, true);
  assert.equal(petCareState({ ...pet, balance: 100 }, "train").ready, false);
  assert.equal(petCareState({ ...pet, cared: ["feed"] }, "feed").ready, false);
  assert.equal(
    petCareState({ ...pet, experience: 80, balance: 20 }, "train").ready,
    true,
  );
  assert.equal(
    petCareState({ ...pet, archiveLevel: 3 }, "play").experience,
    20,
  );
  assert.deepEqual(pet.cared, []);
});
