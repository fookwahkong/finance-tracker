import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
  });
}

export function renderWithClient(ui, client = createTestQueryClient()) {
  const result = render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  );
  return { client, ...result };
}
