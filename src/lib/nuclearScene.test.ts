import { describe, expect, it } from "vitest";
import { decayChain, neutronHit } from "./nuclearScene";
import type { NuclearStep } from "./nuclearScene";

function emittedNucleons(step: NuclearStep): number {
  return step.emitted.reduce((total, emission) => {
    if (emission.type === "n" || emission.type === "p") return total + emission.count;
    if (emission.type === "alpha") return total + emission.count * 4;
    return total;
  }, 0);
}

function expectConserved(step: NuclearStep, incidentNeutrons = 0): void {
  const input = step.from.z + step.from.n + incidentNeutrons;
  const output =
    step.to.reduce((total, nucleus) => total + nucleus.z + nucleus.n, 0) +
    emittedNucleons(step);
  expect(output).toBe(input);
}

describe("nuclear scene data", () => {
  it("starts uranium-238 decay with alpha emission to thorium-234", () => {
    const [first] = decayChain(92, 146);

    expect(first.kind).toBe("alpha");
    expect(first.to[0].name).toBe("Thorium-234");
  });

  it("returns one stable step for iron-56", () => {
    const chain = decayChain(26, 30);

    expect(chain).toHaveLength(1);
    expect(chain[0].kind).toBe("stable");
  });

  it("splits a neutron-hit uranium nucleus and conserves energy-scale outputs", () => {
    const step = neutronHit(92, 143);

    expect(step.kind).toBe("fission");
    expect(step.to).toHaveLength(2);
    expect(step.emitted.find((emission) => emission.type === "n")?.count).toBeGreaterThanOrEqual(2);
    expect(step.emitted.find((emission) => emission.type === "n")?.count).toBeLessThanOrEqual(3);
    expect(step.energyMeV).toBeGreaterThanOrEqual(120);
    expect(step.energyMeV).toBeLessThanOrEqual(250);
    expectConserved(step, 1);
  });

  it("captures a neutron and emits gamma for iron-56", () => {
    const step = neutronHit(26, 30);

    expect(step.kind).toBe("neutron-capture");
    expect(step.emitted.some((emission) => emission.type === "gamma")).toBe(true);
    expectConserved(step, 1);
  });

  it("keeps superheavy decay chains within eight steps", () => {
    const chain = decayChain(120, 184);

    expect(chain.length).toBeLessThanOrEqual(8);
    expect(chain[chain.length - 1].kind === "fission" || chain.length <= 8).toBe(true);
  });

  it("gives neutron-rich oxygen a drip or beta-minus first step", () => {
    const [first] = decayChain(8, 20);

    expect(["neutron-drip", "beta-minus"]).toContain(first.kind);
  });

  it("conserves nucleon count in every emitted decay step", () => {
    const chains = [
      decayChain(92, 146),
      decayChain(120, 184),
      decayChain(8, 20),
      decayChain(26, 30),
    ];

    for (const chain of chains) {
      for (const step of chain) expectConserved(step);
    }
    expectConserved(neutronHit(92, 143), 1);
    expectConserved(neutronHit(26, 30), 1);
  });
});
