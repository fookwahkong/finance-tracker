import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import NewsList from "./NewsList";

const ok = (data) => ({ status: "ok", data, error: null });

const story = (url, headline) => ({
  url, headline, source: "Reuters", datetime: 1770000000,
});

describe("NewsList", () => {
  it("keeps only stories that name the stock", () => {
    const news = ok([
      story("/a", "NVDA jumps on datacenter demand"),
      story("/b", "Nvidia unveils a new accelerator"),
      story("/c", "Fed holds rates steady"),
      story("/d", "Retail sales beat expectations"),
    ]);
    render(<NewsList news={news} symbol="NVDA" name="NVIDIA Corp" />);

    expect(screen.getByText("NVDA jumps on datacenter demand")).toBeInTheDocument();
    expect(screen.getByText("Nvidia unveils a new accelerator")).toBeInTheDocument();
    expect(screen.queryByText("Fed holds rates steady")).toBeNull();
    expect(screen.queryByText("Retail sales beat expectations")).toBeNull();
  });

  it("renders the shared two-column grid, with no repeated ticker chip", () => {
    const news = ok([story("/a", "NVDA jumps on datacenter demand")]);
    const { container } = render(<NewsList news={news} symbol="NVDA" name="NVIDIA Corp" />);

    expect(container.querySelector(".news-grid")).toBeInTheDocument();
    expect(container.querySelector(".news-chip")).toBeNull();
  });

  it("explains an empty result rather than showing a blank grid", () => {
    const news = ok([story("/c", "Fed holds rates steady")]);
    render(<NewsList news={news} symbol="NVDA" name="NVIDIA Corp" />);

    expect(screen.getByText(/no recent stories mention nvda/i)).toBeInTheDocument();
    expect(screen.queryByText("Fed holds rates steady")).toBeNull();
  });

  it("still filters before the company name resolves", () => {
    const news = ok([
      story("/a", "NVDA jumps on datacenter demand"),
      story("/c", "Fed holds rates steady"),
    ]);
    render(<NewsList news={news} symbol="NVDA" name={null} />);

    expect(screen.getByText("NVDA jumps on datacenter demand")).toBeInTheDocument();
    expect(screen.queryByText("Fed holds rates steady")).toBeNull();
  });
});
