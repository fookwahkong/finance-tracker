import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithClient, createTestQueryClient } from "../testUtils";

const getTransactions = vi.fn();
const getCategories = vi.fn();
vi.mock("../api/client", () => ({
  getTransactions: (...a) => getTransactions(...a),
  getCategories: (...a) => getCategories(...a),
  createTransaction: vi.fn(), updateTransaction: vi.fn(), deleteTransaction: vi.fn(), getFxRate: vi.fn(),
}));
vi.mock("../api/claims", () => ({
  getClaims: vi.fn().mockResolvedValue([]),
  createClaim: vi.fn(), linkCredit: vi.fn(), settleClaim: vi.fn(),
  reopenClaim: vi.fn(), deleteClaim: vi.fn(), unlinkCredit: vi.fn(),
}));

const travelMocks = vi.hoisted(() => ({
  getTravelGroups: vi.fn(),
  createTravelGroup: vi.fn(),
  updateTravelGroup: vi.fn(),
  deleteTravelGroup: vi.fn(),
  setTravelOverride: vi.fn().mockResolvedValue({}),
  clearTravelOverride: vi.fn().mockResolvedValue({}),
}));
vi.mock("../api/travel", () => travelMocks);

import Travel from "./Travel";

const JAPAN = {
  id: "g1", name: "Japan", destination: "Tokyo",
  start_date: "2026-08-18", end_date: "2026-08-20", overrides: [],
};

const TRANSACTIONS = [
  { id: "flight", date: "2026-07-04", item: "ANA flights", amount: -880, category: "Travel" },
  { id: "t1", date: "2026-08-18", item: "Airport train", amount: -12, category: "Transport" },
  { id: "t2", date: "2026-08-19", item: "Ramen", amount: -18, category: "Food & Drink" },
  { id: "rent", date: "2026-08-19", item: "Rent", amount: -1800, category: "Housing" },
  { id: "t3", date: "2026-09-01", item: "Home groceries", amount: -40, category: "Groceries" },
];

const renderTravel = () => renderWithClient(<Travel />, createTestQueryClient());

describe("Travel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTransactions.mockResolvedValue(TRANSACTIONS);
    getCategories.mockResolvedValue([]);
    travelMocks.getTravelGroups.mockResolvedValue([JAPAN]);
    travelMocks.setTravelOverride.mockResolvedValue({});
    travelMocks.clearTravelOverride.mockResolvedValue({});
  });

  it("invites the user to create a trip when there are none", async () => {
    travelMocks.getTravelGroups.mockResolvedValue([]);
    renderTravel();

    expect(await screen.findByText("No trips yet")).toBeInTheDocument();
    expect(screen.getByText(/lands here automatically/i)).toBeInTheDocument();
  });

  it("selects the first trip and shows only its transactions", async () => {
    renderTravel();

    expect(await screen.findByText("Airport train")).toBeInTheDocument();
    expect(screen.getByText("Ramen")).toBeInTheDocument();
    // Outside the date range, and no override pulls them in.
    expect(screen.queryByText("ANA flights")).not.toBeInTheDocument();
    expect(screen.queryByText("Home groceries")).not.toBeInTheDocument();
  });

  it("summarises the trip on its card", async () => {
    renderTravel();

    const card = await screen.findByRole("button", { name: /Japan/ });
    expect(within(card).getByText(/18–20 Aug 2026 · 3 days/)).toBeInTheDocument();
    expect(within(card).getByText("$1,830.00")).toBeInTheDocument(); // 12 + 18 + 1800
    expect(within(card).getByText(/3 transactions/)).toBeInTheDocument();
  });

  it("switches to the Day Summary subtab", async () => {
    renderTravel();
    fireEvent.click(await screen.findByRole("button", { name: "Day Summary" }));

    expect(await screen.findByText(/Day 1 · Tue 18 Aug/)).toBeInTheDocument();
    expect(screen.getByText("Spending by category")).toBeInTheDocument();
  });

  it("creates a trip and previews what the dates will sweep in", async () => {
    travelMocks.getTravelGroups.mockResolvedValue([]);
    travelMocks.createTravelGroup.mockResolvedValue({ ...JAPAN, id: "g2" });
    renderTravel();

    fireEvent.click(await screen.findByRole("button", { name: /new trip/i }));
    fireEvent.change(screen.getByLabelText("Trip name"), { target: { value: "Japan" } });
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-08-18" } });
    fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2026-08-20" } });

    // The live preview is the point of deriving membership from the range.
    expect(await screen.findByRole("status")).toHaveTextContent("3 transactions in this range");

    fireEvent.click(screen.getByRole("button", { name: /create trip/i }));
    await waitFor(() => expect(travelMocks.createTravelGroup).toHaveBeenCalledWith({
      name: "Japan", destination: null, start_date: "2026-08-18", end_date: "2026-08-20",
    }));
  });

  it("surfaces an overlap rejection against the clashing trip by name", async () => {
    travelMocks.createTravelGroup.mockRejectedValue({
      response: { data: { detail: "These dates overlap your 'Japan' trip (2026-08-18 to 2026-08-20)." } },
    });
    renderTravel();

    fireEvent.click(await screen.findByRole("button", { name: /new trip/i }));
    fireEvent.change(screen.getByLabelText("Trip name"), { target: { value: "Osaka" } });
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-08-19" } });
    fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2026-08-25" } });
    fireEvent.click(screen.getByRole("button", { name: /create trip/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/overlap your 'Japan' trip/);
  });

  it("blocks submitting an inverted date range", async () => {
    renderTravel();
    fireEvent.click(await screen.findByRole("button", { name: /new trip/i }));
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-08-20" } });
    fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2026-08-18" } });

    expect(screen.getByRole("alert")).toHaveTextContent(/end date cannot be before/i);
    expect(screen.getByRole("button", { name: /create trip/i })).toBeDisabled();
  });

  it("promises the transactions survive when deleting a trip", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    travelMocks.deleteTravelGroup.mockResolvedValue({});
    renderTravel();

    fireEvent.click(await screen.findByRole("button", { name: /^✕ Delete$/ }));

    expect(confirm.mock.calls[0][0]).toMatch(/transactions stay in Spending/i);
    await waitFor(() => expect(travelMocks.deleteTravelGroup).toHaveBeenCalledWith("g1"));
    confirm.mockRestore();
  });

  it("removes a mid-trip bill from the trip with an exclude override", async () => {
    renderTravel();

    const row = (await screen.findByText("Rent")).closest(".row");
    fireEvent.click(within(row).getByRole("button", { name: /transaction actions/i }));
    fireEvent.click(screen.getByText(/remove from trip/i));

    await waitFor(() => expect(travelMocks.setTravelOverride).toHaveBeenCalledWith("g1", "rent", "exclude"));
  });

  it("adds a pre-trip booking through the picker", async () => {
    renderTravel();

    fireEvent.click(await screen.findByRole("button", { name: /add existing transaction/i }));
    const dialog = screen.getByRole("dialog", { name: /add to japan/i });

    // The 60-day lookback reaches back to the July flight.
    const flightRow = within(dialog).getByText("ANA flights").closest(".row");
    fireEvent.click(within(flightRow).getByRole("button", { name: "Add" }));

    await waitFor(() => expect(travelMocks.setTravelOverride).toHaveBeenCalledWith("g1", "flight", "include"));
  });

  it("lists an existing override and can undo it", async () => {
    travelMocks.getTravelGroups.mockResolvedValue([
      { ...JAPAN, overrides: [{ transaction_id: "rent", mode: "exclude" }] },
    ]);
    renderTravel();

    // The excluded bill is gone from the trip.
    await screen.findByText("Airport train");
    expect(screen.queryByText("Rent")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /add existing transaction/i }));
    const dialog = screen.getByRole("dialog", { name: /add to japan/i });
    expect(within(dialog).getByText(/Removed from this trip/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(travelMocks.clearTravelOverride).toHaveBeenCalledWith("g1", "rent"));
  });

  it("pulls an include-override transaction into the trip totals", async () => {
    travelMocks.getTravelGroups.mockResolvedValue([
      { ...JAPAN, overrides: [{ transaction_id: "flight", mode: "include" }] },
    ]);
    renderTravel();

    expect(await screen.findByText("ANA flights")).toBeInTheDocument();
    const card = screen.getByRole("button", { name: /Japan/ });
    expect(within(card).getByText("$2,710.00")).toBeInTheDocument(); // 1830 + 880
  });

  it("reads transactions from the same cache key as the Spending tab", async () => {
    renderTravel();
    await screen.findByText("Airport train");

    // One fetch, on the shared ["transactions", "all"] key — the mechanism
    // that keeps the two tabs in sync.
    expect(getTransactions).toHaveBeenCalledTimes(1);
  });
});
