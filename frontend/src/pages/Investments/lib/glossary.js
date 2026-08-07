// Curated plain-English explanations for the metric labels on the Stock Detail
// page. Static data, not AI-generated — the wording is meant to stay stable so
// a reader learns the term rather than a fresh paraphrase each visit.
//
// Each entry has:
//   meaning     — what the number is, in 1–2 sentences.
//   implication — what high vs. low tends to signal, plus the usual trap.

// "ratio" carries no meaning of its own, so "P/E" and "PE ratio" collapse to
// the same key. Everything else is handled by ALIASES.
const NOISE = new Set(["ratio"]);

// "Mkt. cap" → "mktcap", "P/E ratio" → "pe", "Cash & equivalents" → "cashequivalents"
function normalize(label) {
  if (typeof label !== "string") return "";
  return label
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !NOISE.has(w))
    .join("");
}

const TERMS = {
  // ── Stat grid ──
  open: {
    term: "Open",
    meaning: "The price of the first trade of the session.",
    implication:
      "A large gap between the open and the previous close means news broke while the market was shut. On its own the open says little — it matters mostly as the reference point for the day's move.",
  },
  high: {
    term: "High",
    meaning: "The highest price the stock traded at during the session.",
    implication:
      "Closing near the high suggests buyers stayed in control into the bell. A high far above the close can mean an intraday spike that sellers erased — one day of it is noise, not a signal.",
  },
  low: {
    term: "Low",
    meaning: "The lowest price the stock traded at during the session.",
    implication:
      "Closing near the low suggests sellers had the upper hand. A wide high-to-low range on ordinary volume usually reflects thin liquidity rather than genuine disagreement about value.",
  },
  volume: {
    term: "Volume",
    meaning: "The number of shares that changed hands during the session.",
    implication:
      "High volume means many participants agreed the price should move, so the move carries more weight. A big price change on low volume is easy to reverse. Volume is only meaningful against the same stock's own average, never across stocks.",
  },
  mktcap: {
    term: "Market cap",
    meaning:
      "The total market value of the company's shares: share price times shares outstanding.",
    implication:
      "Large caps tend to move less and survive downturns better; small caps swing harder in both directions. Market cap ignores debt, so a heavily borrowed company is worth more to buy outright than its market cap suggests.",
  },
  dividendyield: {
    term: "Dividend yield",
    meaning:
      "The annual dividend as a percentage of the current share price.",
    implication:
      "A higher yield returns more cash per dollar invested. But yield rises when the price falls, so an unusually high yield is often a market saying it expects the dividend to be cut — check whether earnings actually cover the payout.",
  },
  quarterlydividend: {
    term: "Quarterly dividend",
    meaning:
      "The cash paid per share in the most recent quarterly distribution.",
    implication:
      "Steady or rising payments signal management's confidence in future cash flow; a cut is one of the strongest negative signals a board can send. Some companies pay monthly or annually instead, which makes a single quarter's figure misleading.",
  },
  exdividenddate: {
    term: "Ex-dividend date",
    meaning:
      "The first day the stock trades without the right to the upcoming dividend. You must own it before this date to be paid.",
    implication:
      "The price typically drops by roughly the dividend amount on this day — that fall is mechanical, not bad news. Buying just to capture a dividend gains nothing, since you pay for it in the higher pre-ex price.",
  },

  // ── Income statement ──
  revenue: {
    term: "Revenue",
    meaning:
      "Total money from sales before any costs are subtracted — the top line.",
    implication:
      "Growing revenue shows demand is expanding. But revenue says nothing about whether the sales are profitable; a company can grow revenue for years while losing money on every unit.",
  },
  grossprofit: {
    term: "Gross profit",
    meaning:
      "Revenue minus the direct cost of producing what was sold.",
    implication:
      "A high gross profit relative to revenue means pricing power and room to cover overheads. A thin or shrinking one leaves little margin for error and often signals rising input costs or price competition.",
  },
  operatingincome: {
    term: "Operating income",
    meaning:
      "Profit from the core business after operating expenses, but before interest and tax.",
    implication:
      "This is the cleanest read on whether the actual business works, since it excludes financing choices and tax quirks. Positive net income alongside negative operating income usually means one-off gains are propping up the bottom line.",
  },
  netincome: {
    term: "Net income",
    meaning:
      "What's left after every expense, including interest and tax — the bottom line.",
    implication:
      "Sustained net income is what ultimately funds dividends and buybacks. It is also the easiest figure to distort with one-time items like asset sales or writedowns, so compare it against operating cash flow.",
  },
  eps: {
    term: "EPS (earnings per share)",
    meaning: "Net income divided by the number of shares outstanding.",
    implication:
      "Rising EPS means each share owns a bigger slice of profit. It can also rise purely from buybacks shrinking the share count, so check whether net income itself grew before reading it as improvement.",
  },

  // ── Balance sheet ──
  totalassets: {
    term: "Total assets",
    meaning:
      "Everything the company owns that has value: cash, inventory, property, equipment, investments.",
    implication:
      "A larger asset base can mean scale, or it can mean capital tied up in things that earn little. Assets are recorded at historical cost, so long-held property is often worth far more than the balance sheet shows.",
  },
  totalliabilities: {
    term: "Total liabilities",
    meaning: "Everything the company owes: debt, payables, and other obligations.",
    implication:
      "Liabilities approaching total assets leave little cushion for a bad year. Debt is not inherently bad — cheap borrowing can boost returns — but it becomes dangerous when earnings are volatile.",
  },
  totalequity: {
    term: "Total equity",
    meaning:
      "Total assets minus total liabilities — the shareholders' residual claim, also called book value.",
    implication:
      "Growing equity means the company is retaining more than it loses. Negative equity is a warning sign, though it can also result harmlessly from years of large buybacks at profitable companies.",
  },
  cashequivalents: {
    term: "Cash & equivalents",
    meaning:
      "Cash plus holdings that can be converted to cash almost immediately, like short-term treasuries.",
    implication:
      "A large cash pile is a buffer against downturns and a war chest for acquisitions. Held too long without being deployed, it drags on returns — and it may be trapped overseas or already earmarked for debt repayment.",
  },

  // ── Cash flow ──
  operatingcashflow: {
    term: "Operating cash flow",
    meaning:
      "Actual cash generated by running the business, before investment and financing.",
    implication:
      "Cash is much harder to manipulate than accounting profit, so this is a reality check on net income. Profit that consistently exceeds operating cash flow suggests aggressive revenue recognition or customers who aren't paying.",
  },
  capex: {
    term: "CapEx (capital expenditure)",
    meaning:
      "Cash spent on long-lived assets like factories, equipment, and property.",
    implication:
      "Heavy CapEx can mean investment in future growth, or simply that the business is expensive to maintain. Cutting CapEx flatters near-term cash flow while quietly borrowing from future capacity.",
  },
  freecashflow: {
    term: "Free cash flow",
    meaning:
      "Operating cash flow minus capital expenditure — the cash genuinely available to pay down debt, buy back shares, or pay dividends.",
    implication:
      "Consistently positive free cash flow means the business funds itself. Persistently negative free cash flow means it depends on raising money, which works until credit markets tighten.",
  },
  netchangeincash: {
    term: "Net change in cash",
    meaning:
      "How much the cash balance moved over the period, across operating, investing, and financing activities.",
    implication:
      "A rise driven by operations is healthy; the same rise driven by issuing debt or shares is not. Always check which of the three activities produced the change before reading anything into it.",
  },

  // ── Earnings ──
  period: {
    term: "Period",
    meaning:
      "The fiscal quarter and year the results cover, for example Q3 2026.",
    implication:
      "Fiscal years often don't match calendar years, so a company's Q1 may end in April. Compare a quarter against the same quarter a year earlier, not the one just before it, or seasonality will mislead you.",
  },
  epsestimate: {
    term: "EPS estimate",
    meaning:
      "The consensus earnings per share that analysts expected for the period before results were published.",
    implication:
      "This is the bar the stock is priced against, not a forecast of value. Companies routinely guide analysts to a beatable number, so meeting the estimate exactly is closer to neutral than to good.",
  },
  epsactual: {
    term: "EPS actual",
    meaning: "The earnings per share the company actually reported.",
    implication:
      "What moves the price is the gap against the estimate, not the absolute figure. A record EPS that lands below expectations often sells off, which is why the two numbers only make sense read together.",
  },
  revenueestimate: {
    term: "Revenue estimate",
    meaning: "The consensus revenue analysts expected for the period.",
    implication:
      "Revenue is harder to massage than EPS, so a revenue miss alongside an EPS beat usually means costs were cut rather than the business growing.",
  },
  revenueactual: {
    term: "Revenue actual",
    meaning: "The revenue the company actually reported.",
    implication:
      "Compare it to the estimate and to the same quarter last year. Growth that only appears against the previous quarter may just be seasonality.",
  },
  // ── Valuation ──
  pe: {
    term: "P/E (price-to-earnings)",
    meaning:
      "The share price divided by earnings per share — what you pay for each dollar of annual profit.",
    implication:
      "A high P/E means the market expects strong growth; a low one means it expects little, or sees risk. Neither is good or bad on its own — a P/E is only readable against the same company's history and its industry peers, and it is meaningless when earnings are negative.",
  },
  peg: {
    term: "PEG (price/earnings-to-growth)",
    meaning:
      "The P/E divided by the expected earnings growth rate, which adjusts valuation for how fast profits are growing.",
    implication:
      "Below 1.0 is the conventional rule of thumb for a reasonable price. The catch is that it depends entirely on a forecast growth rate, and forecasts for fast-growing companies are the least reliable ones.",
  },

  surprise: {
    term: "Earnings surprise",
    meaning:
      "The difference between reported earnings and the consensus estimate, usually shown as a percentage.",
    implication:
      "Positive surprises tend to be followed by further drift upward, negative ones downward. The size matters less than the direction of guidance issued alongside it — a beat paired with a weak outlook usually still sells off.",
  },
};

// Label variants that appear in the UI or that a reader might reasonably type,
// mapped to the canonical key above.
const ALIASES = {
  marketcap: "mktcap",
  marketcapitalisation: "mktcap",
  marketcapitalization: "mktcap",
  dividend: "dividendyield",
  yield: "dividendyield",
  exdividend: "exdividenddate",
  exdate: "exdividenddate",
  earningspershare: "eps",
  priceearnings: "pe",
  pricetoearnings: "pe",
  priceearningsgrowth: "peg",
  operatingprofit: "operatingincome",
  netprofit: "netincome",
  netearnings: "netincome",
  bottomline: "netincome",
  topline: "revenue",
  sales: "revenue",
  bookvalue: "totalequity",
  totalshareholdersequity: "totalequity",
  totalstockholdersequity: "totalequity",
  cash: "cashequivalents",
  cashandequivalents: "cashequivalents",
  cashandcashequivalents: "cashequivalents",
  capitalexpenditure: "capex",
  capitalexpenditures: "capex",
  fcf: "freecashflow",
  ocf: "operatingcashflow",
  cashfromoperations: "operatingcashflow",
  epsest: "epsestimate",
  epsconsensus: "epsestimate",
  revest: "revenueestimate",
  revenueest: "revenueestimate",
  revactual: "revenueactual",
  earningssurprise: "surprise",
  epssurprise: "surprise",
};

// Returns the entry for a label, or null when the label isn't a known term.
// Callers rely on null to render the label untouched, so wrapping any label is
// safe whether or not the glossary covers it.
export function lookupTerm(label) {
  const key = normalize(label);
  if (!key) return null;
  return TERMS[key] || TERMS[ALIASES[key]] || null;
}
