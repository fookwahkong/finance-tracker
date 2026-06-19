def month_range(month: str) -> tuple[str, str]:
    year, mon = int(month.split("-")[0]), int(month.split("-")[1])
    next_mon = 1 if mon == 12 else mon + 1
    next_year = year + 1 if mon == 12 else year
    return f"{month}-01", f"{next_year}-{next_mon:02d}-01"
