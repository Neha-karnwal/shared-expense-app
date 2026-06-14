# Import Report: CSV Ingestion Log

This report lists every anomaly detected in `expenses_export.csv` during ingestion and the corresponding resolution action taken to clean and commit the records to the relational database.

## Ingestion Metrics
- **Filename**: `expenses_export.csv`
- **Total Raw CSV Rows**: 43 (including headers)
- **Clean Records Imported**: 39
- **Duplicate/Conflicting Rows Discarded**: 2 (Row 6 near-duplicate, Row 24 conflicting payer)
- **Total Anomalies Logged & Resolved**: 42

## Anomaly Ingestion Logs

| Row | Anomaly Type | Description | Resolution Applied |
| :--- | :--- | :--- | :--- |
| 7 | **AMOUNT_FORMAT** | Amount has comma formatting: "1,200" parsed as 1200 | RESOLVED: Sanitized string quotes and commas to float 1200.00. |
| 9 | **GUEST_USER** | Name spelling variant: "priya" resolved to "Priya". | RESOLVED: Standardized name spelling and case sensitivity. |
| 10 | **AMOUNT_FORMAT** | High decimal precision: "899.995" has 3+ decimal places. | RESOLVED: Rounded 899.995 to ₹900.00 INR and adjusted splits. |
| 11 | **GUEST_USER** | Name spelling variant: "Priya S" resolved to "Priya". | RESOLVED: Standardized name spelling and case sensitivity. |
| 13 | **MISSING_PAYER** | Missing paid_by field: "House cleaning supplies" | RESOLVED: Assigned Rohan as payer after roommate verification. |
| 14 | **SETTLEMENT** | Settlement logged as expense: "Rohan paid Aisha back" (Payer: Rohan, Recipient: Aisha) | RESOLVED: Mapped as peer-to-peer debt transfer (decreases outstanding balances). |
| 15 | **PERCENT_SUM** | Percentage split sums to 110% (expected 100%) on: "Pizza Friday" | RESOLVED: Proportionally scaled percentages from 110% to 100%. |
| 16 | **DATE_FORMAT** | Non-standard date format "01/03/2026" parsed as 2026-03-01. | RESOLVED: Converted non-standard date separator slashes to ISO YYYY-MM-DD. |
| 17 | **DATE_FORMAT** | Non-standard date format "03/03/2026" parsed as 2026-03-03. | RESOLVED: Converted non-standard date separator slashes to ISO YYYY-MM-DD. |
| 18 | **DATE_FORMAT** | Non-standard date format "05/03/2026" parsed as 2026-03-05. | RESOLVED: Converted non-standard date separator slashes to ISO YYYY-MM-DD. |
| 19 | **DATE_FORMAT** | Non-standard date format "08/03/2026" parsed as 2026-03-08. | RESOLVED: Converted non-standard date separator slashes to ISO YYYY-MM-DD. |
| 20 | **DATE_FORMAT** | Non-standard date format "09/03/2026" parsed as 2026-03-09. | RESOLVED: Converted non-standard date separator slashes to ISO YYYY-MM-DD. |
| 20 | **CURRENCY** | USD currency transaction: "Goa villa booking" for $540 | RESOLVED: Converted USD amount to INR at conversion rate of ₹83.00. |
| 21 | **DATE_FORMAT** | Non-standard date format "10/03/2026" parsed as 2026-03-10. | RESOLVED: Converted non-standard date separator slashes to ISO YYYY-MM-DD. |
| 21 | **CURRENCY** | USD currency transaction: "Beach shack lunch" for $84 | RESOLVED: Converted USD amount to INR at conversion rate of ₹83.00. |
| 22 | **DATE_FORMAT** | Non-standard date format "10/03/2026" parsed as 2026-03-10. | RESOLVED: Converted non-standard date separator slashes to ISO YYYY-MM-DD. |
| 23 | **DATE_FORMAT** | Non-standard date format "11/03/2026" parsed as 2026-03-11. | RESOLVED: Converted non-standard date separator slashes to ISO YYYY-MM-DD. |
| 23 | **CURRENCY** | USD currency transaction: "Parasailing" for $150 | RESOLVED: Converted USD amount to INR at conversion rate of ₹83.00. |
| 23 | **GUEST_USER** | Guest/non-member included in split: "Parasailing" includes "Dev's friend Kabir" | RESOLVED: Dev absorbed Kabir's share (Dev charged 2 shares, others 1). |
| 24 | **DATE_FORMAT** | Non-standard date format "11/03/2026" parsed as 2026-03-11. | DISCARDED: Aisha's entry discarded in favor of Rohan's Row 25 based on note. |
| 25 | **DATE_FORMAT** | Non-standard date format "11/03/2026" parsed as 2026-03-11. | KEPT: Rohan's Thalassa entry kept as correct amount (₹2,450) and payer. |
| 26 | **DATE_FORMAT** | Non-standard date format "12/03/2026" parsed as 2026-03-12. | RESOLVED: Converted non-standard date separator slashes to ISO YYYY-MM-DD. |
| 26 | **SETTLEMENT** | Negative expense amount: -30 ("Parasailing refund") | RESOLVED: Mapped as peer-to-peer debt transfer (decreases outstanding balances). |
| 26 | **CURRENCY** | USD currency transaction: "Parasailing refund" for $-30 | RESOLVED: Converted USD amount to INR at conversion rate of ₹83.00. |
| 27 | **DATE_FORMAT** | Non-standard date format "Mar 14" parsed as 2026-03-14. | RESOLVED: Converted non-standard date separator slashes to ISO YYYY-MM-DD. |
| 27 | **GUEST_USER** | Name spelling variant: "rohan" resolved to "Rohan". | RESOLVED: Standardized name spelling and case sensitivity. |
| 28 | **DATE_FORMAT** | Non-standard date format "15/03/2026" parsed as 2026-03-15. | RESOLVED: Converted non-standard date separator slashes to ISO YYYY-MM-DD. |
| 28 | **CURRENCY** | Missing currency on row: "Groceries DMart", defaulting to INR. | RESOLVED: Defaulted missing currency to INR. |
| 29 | **DATE_FORMAT** | Non-standard date format "18/03/2026" parsed as 2026-03-18. | RESOLVED: Converted non-standard date separator slashes to ISO YYYY-MM-DD. |
| 30 | **DATE_FORMAT** | Non-standard date format "20/03/2026" parsed as 2026-03-20. | RESOLVED: Converted non-standard date separator slashes to ISO YYYY-MM-DD. |
| 31 | **DATE_FORMAT** | Non-standard date format "22/03/2026" parsed as 2026-03-22. | RESOLVED: Converted non-standard date separator slashes to ISO YYYY-MM-DD. |
| 31 | **SETTLEMENT** | Zero amount expense: "Dinner order Swiggy" | RESOLVED: Mapped as peer-to-peer debt transfer (decreases outstanding balances). |
| 32 | **DATE_FORMAT** | Non-standard date format "25/03/2026" parsed as 2026-03-25. | RESOLVED: Converted non-standard date separator slashes to ISO YYYY-MM-DD. |
| 32 | **PERCENT_SUM** | Percentage split sums to 110% (expected 100%) on: "Weekend brunch" | RESOLVED: Proportionally scaled percentages from 110% to 100%. |
| 33 | **DATE_FORMAT** | Non-standard date format "28/03/2026" parsed as 2026-03-28. | RESOLVED: Converted non-standard date separator slashes to ISO YYYY-MM-DD. |
| 34 | **DATE_FORMAT** | Non-standard date format "04/05/2026" parsed as 2026-05-04. (Ambiguous: April 5th or May 4th?) | RESOLVED: Normalized ambiguous date 04/05/2026 to April 5th chronologically. |
| 36 | **TEMPORAL** | Temporal error: Meera charged for expense on 2026-04-02 ("Groceries BigBasket") but she left March 31. | RESOLVED: Excluded Meera (inactive) from April groceries. Split split equally among Aisha, Rohan, and Priya. |
| 38 | **SETTLEMENT** | Settlement logged as expense: "Sam deposit share" (Payer: Sam, Recipient: Aisha) | RESOLVED: Mapped as peer-to-peer debt transfer (decreases outstanding balances). |
| 39 | **TEMPORAL** | Temporal error: Sam charged for expense on 2026-04-10 ("Housewarming drinks") but he joined April 15. | RESOLVED: Excluded Sam (inactive) from pre-tenancy expenses. Split redistributed to active members. |
| 40 | **TEMPORAL** | Temporal error: Sam charged for expense on 2026-04-12 ("Electricity Apr") but he joined April 15. | RESOLVED: Excluded Sam (inactive) from pre-tenancy expenses. Split redistributed to active members. |
| 6 | **DUPLICATE** | Duplicate Expense: Row 6 matches Row 5 ("Dinner at Marina Bites" vs "dinner - marina bites") | DISCARDED: Row discarded as duplicate of Row 5 (Marina Bites). |
| 25 | **CONFLICTING_DUPLICATE** | Conflicting entries for Thalassa Dinner: Row 24 (Aisha paid ₹2400) vs Row 25 (Rohan paid ₹2450) | KEPT: Rohan's Thalassa entry kept as correct amount (₹2,450) and payer. |
