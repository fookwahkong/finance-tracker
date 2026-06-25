# Scrubbed slice of a real POSB savings statement, as pdfplumber linearizes it.
# Each transaction's date line carries the amount + balance; detail lines follow.
# Balances chain exactly: every |delta| equals the stated amount.
SAMPLE_LINES = [
    "ePOSBkids Account Account No. 999-99999-9",
    "Date Description Withdrawal (-) Deposit (+) Balance (SGD)",
    "Balance Brought Forward 28,087.62",
    "01/05/2026 FAST Payment / Receipt 350.00 28,437.62",
    "INCOMING PAYNOW REF 5425794",
    "FROM: CHUA WEN LI DANA",
    "PAYNOW TRANSFER",
    "OTHER",
    "02/05/2026 Debit Card transaction 2.40 28,435.22",
    "OTTIE PANCAKES SINGAPORE SGP 29APR",
    "5264-7110-1081-0259",
    "000002370679534",
    "03/05/2026 Funds Transfer 8.90 28,426.32",
    "TOP-UP TO PAYLAH! :",
    "FOOK WAH",
    "PLPE4612306185333634",
    "12/05/2026 FAST Collection 129.34 28,296.98",
    "019E1B85A96C791497254FED14048B85",
    "SGA12056JKC3VE9S",
    "COLLECTION PAYMENT",
    "31/05/2026 Interest Earned 1.01 28,297.99",
    "4 4 4 4 4",
    "Total Balance Carried Forward: 140.64 351.01 28,297.99",
]
