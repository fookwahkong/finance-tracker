

## 🚀 Core Architecture

- Frontend (Vercel): React / Next.js app handles the UI, mathematical calculations, and direct financial API polling.
- Backend Database (Supabase): Free-tier Postgres database. It stores user profiles, transaction history, and end-of-day (EOD) historical prices.

- Financial APIs: 

| Feature              | Recommended API       |
| -------------------- | --------------------- |
| Live prices          | Polygon / Finnhub     |
| Historical charts    | Polygon / Twelve Data |
| Company profile      | Finnhub               |
| Financial statements | FMP                   |
| Ratios               | FMP                   |
| Earnings calendar    | Finnhub               |
| News                 | Finnhub               |
| Insider trading      | Finnhub               |
| Analyst ratings      | Finnhub               |
| Economic indicators  | Finnhub               |




## 📊 Database Setup (Supabase Tables)

- transactions table: Fields for user_id, ticker, type (BUY/SELL), quantity, price_per_share, and transaction_date. Used to calculate your cost basis.
price_cache table: Fields for ticker, closing_price, and updated_at. Saves EOD historical data to prevent hitting external API rate limits.

## ⏱️ Data Pipeline & Performance Guardrails
- Client-Side Polling: React updates live stock prices directly via HTTPS/REST fetch requests every 15 seconds.
- No Vercel API Proxies: Fetch market data directly in React components. Do not route live feeds through Vercel Serverless Functions to avoid execution timeouts.
- Tab Visibility Protection: Use the browser's Page Visibility API to pause the 15-second polling interval whenever you minimize or switch tabs.
- Local UI Math: Fetch transactions once, aggregate positions, map the live price hooks over them, and compute live absolute returns in-memory.

## 3. State Management & Real-Time Return Calculations
Rather than reading and writing live market data to your database continuously, execute the financial math directly inside the client browser.
Load Transactions: When the React app loads, pull the user's historical transactions list from Supabase.
Aggregate Positions: Compute the total shares owned and the average cost basis locally using JavaScript array methods.
Merge Live Streams: Map your custom React polling hook over your current active positions.
Calculate Returns: Compute live absolute returns and percentage gains entirely in memory.
\(\text{Current\ Value}=\text{Total\ Shares\ Owned}\times \text{Live\ Price}\)
\(\text{Total\ Cost\ Basis}=\text{Total\ Shares\ Owned}\times \text{Average\ Purchase\ Price}\)
\(\text{Live\ Absolute\ Return}=\text{Current\ Value}-\text{Total\ Cost\ Basis}\)
📈 Indicators & Rules Engine
Portfolio Tracking: Implement Max Drawdown (tracking live drop from peak portfolio value) and Portfolio Beta (weighted average volatility vs SPY). Sharpe Ratio. Asset Allocation Deviation (how far off your target goals)
Valuation & Entry Metrics: Display the P/E Ratio (flag if 25% above 5-yr average), PEG Ratio (ideal if < 1.0), and RSI (14-Day) (oversold if ≤ 30, overbought if ≥ 70).
Deterministic Hints: Code a simple JavaScript utility function that evaluates your calculated portfolio states against thresholds to output specific text and color-coded badges (e.g., Take Profits at +30%, Cut Losses at -15%).

Moving Average Crossovers (SMA 50 vs. SMA 200): A classic momentum indicator.
System Design: When the app loads, make a single frontend REST call to Alpaca or Finnhub for the stock's historical daily closing prices. Calculate the 50-day and 200-day Simple Moving Averages in JavaScript. [1, 2, 3, 4, 5]
Distance from 52-Week High/Low: Tracks how close a stock is to its yearly extremes.
System Design: Free tiers of Alpaca and Finnhub provide high52 and low52 metrics in their basic quote endpoints. Fetch these values alongside your regular 15-second live price polling. 
Automated "Action Hints" (Rules Engine)
To keep the app free and avoid paying for AI models or cloud servers, build a deterministic client-side rules engine in React. This engine evaluates your live portfolio data against preset thresholds and displays dynamic text badges.
Indicator Signal 
Rule / Condition
Frontend Action Hint Display
Overextended Gains
Current Price is > 30% above your Average Cost Basis
🟢 Hint: Consider taking partial profits
Stop-Loss / Risk Alert
Current Price is > 15% below your Average Cost Basis
🔴 Hint: Review fundamentals or cut losses
Golden Cross (Bullish)
50-day SMA crosses above the 200-day SMA
🚀 Hint: Strong upward momentum building
Death Cross (Bearish)
50-day SMA crosses below the 200-day SMA
⚠️ Hint: Downward trend; pause buying
Portfolio Drift
Actual Asset Weight is 5% higher than Target Weight
🔄 Hint: Trim position to rebalance portfolio
