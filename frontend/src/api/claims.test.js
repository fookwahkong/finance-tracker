import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.hoisted(() => vi.fn().mockResolvedValue({ data: { id: "link-1" } }));
vi.mock("./http", () => ({ default: { post } }));

import { linkCredit } from "./claims";

describe("linkCredit", () => {
  beforeEach(() => post.mockClear());

  it("targets a specific participant for new claims", async () => {
    await linkCredit("claim-1", "person-1", { credit_tx_id: "credit-1", allocated_amount: 10 });

    expect(post).toHaveBeenCalledWith("/api/claims/claim-1/participants/person-1/credits", {
      credit_tx_id: "credit-1",
      allocated_amount: 10,
    });
  });

  it("keeps the aggregate endpoint for legacy calls", async () => {
    await linkCredit("claim-1", { credit_tx_id: "credit-1", allocated_amount: 10 });

    expect(post).toHaveBeenCalledWith("/api/claims/claim-1/credits", {
      credit_tx_id: "credit-1",
      allocated_amount: 10,
    });
  });
});
