# A hand-built, minimal single-page PDF with no text content. pdfplumber (via
# pypdfium2) tolerates the missing xref table and opens it as a normal
# one-page, zero-char document - good enough to exercise the scanned-PDF
# routing path and page-image rendering without any extra dependencies.
BLANK_PDF_BYTES = b"""%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj
trailer<</Size 4/Root 1 0 R>>
"""
