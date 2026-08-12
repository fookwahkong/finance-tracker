import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendAgentChat = vi.fn();
vi.mock("../api/agent", () => ({
  sendAgentChat: (...args) => sendAgentChat(...args),
}));

import AssistantWidget from "./AssistantWidget";

describe("AssistantWidget", () => {
  beforeEach(() => {
    sendAgentChat.mockReset();
  });

  it("starts closed, opens on bubble click", () => {
    render(<AssistantWidget />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /open assistant/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("sends a message and renders the assistant's reply", async () => {
    sendAgentChat.mockResolvedValue({
      reply: "You spent $200 this month.",
      history: [{ role: "user", content: "How much did I spend?" }],
    });
    render(<AssistantWidget />);
    fireEvent.click(screen.getByRole("button", { name: /open assistant/i }));

    fireEvent.change(screen.getByPlaceholderText(/ask about your finances/i), {
      target: { value: "How much did I spend?" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(screen.getByText("How much did I spend?")).toBeInTheDocument();
    await waitFor(() => expect(sendAgentChat).toHaveBeenCalledWith("How much did I spend?", []));
    expect(await screen.findByText("You spent $200 this month.")).toBeInTheDocument();
  });

  it("renders the assistant's reply as markdown", async () => {
    sendAgentChat.mockResolvedValue({
      reply: "**Total spent:** $200\n\n- Food: $80\n- Transport: $120",
      history: [],
    });
    render(<AssistantWidget />);
    fireEvent.click(screen.getByRole("button", { name: /open assistant/i }));

    fireEvent.change(screen.getByPlaceholderText(/ask about your finances/i), {
      target: { value: "How much did I spend?" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    const bold = await screen.findByText("Total spent:");
    expect(bold.tagName).toBe("STRONG");
    const items = screen.getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual(["Food: $80", "Transport: $120"]);
  });

  it("shows a distinct rate-limited notice on a 429 error", async () => {
    sendAgentChat.mockRejectedValue({ status: 429, message: "Demo AI limit reached" });
    render(<AssistantWidget />);
    fireEvent.click(screen.getByRole("button", { name: /open assistant/i }));

    fireEvent.change(screen.getByPlaceholderText(/ask about your finances/i), {
      target: { value: "hi" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    const notice = await screen.findByText(/rate limited/i);
    expect(notice.closest(".assistant-msg").className).toMatch(/rate-limited/);
  });
});
