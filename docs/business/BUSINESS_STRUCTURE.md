# Spike Land - Business Structure Documentation

> **Last Updated**: March 2026 **Decision**: Form UK Limited Company
> **Company Name**: SPIKE LAND LTD (Company #16906682)

---

## Decision Summary

| Factor | Status |
| ------------------------- | ---------------------------------------- |
| **Current Structure** | UK Limited Company (incorporated) |
| **Commercial Status** | Pre-revenue public beta |
| **Funding Readiness** | Seeking SEIS Advance Assurance |
| **Formation Cost** | £12 (Companies House online) |
| **Incorporation Date** | 12 December 2025 |

---

## Why Limited Company?

### Key Drivers

1. **Limited Liability** - Personal assets protected from business
   debts/lawsuits
2. **GDPR Protection** - Fines against company, not personally (up to £17.5m or
   4% revenue)
3. **Tax Efficiency** - Corporation Tax (19-25%) vs Income Tax + NI (up to 47%)
4. **Professional Credibility** - "Spike Land Ltd" for B2B and user trust
5. **Investment Ready** - Can issue shares to investors if needed
6. **Exit Potential** - Can sell the company (not just assets)

### Risk Mitigation

| Risk          | Sole Trader             | Ltd Company               |
| ------------- | ----------------------- | ------------------------- |
| Lawsuit       | Personal assets at risk | Limited to company assets |
| GDPR fine     | Personal liability      | Company liability         |
| Business debt | Personal debt           | Company debt              |
| Tax audit     | Personal records        | Company records only      |

---

## Company Details

| Field                         | Value                                       |
| ----------------------------- | ------------------------------------------- |
| **Company Name**              | SPIKE LAND LTD                              |
| **Company Number**            | 16906682                                    |
| **Application Reference**     | 112-184507                                  |
| **Corporation Tax Reference** | BRCT00003618256                             |
| **Registered Office**         | Brighton, UK |
| **Director(s)**               | Founder                                |
| **Shareholder(s)**            | Founder (100%)                         |
| **SIC Codes**                 | 62090 (IT consultancy), 63120 (Web portals) |
| **Application Date**          | December 2025                               |
| **Incorporation Date**        | 12 December 2025                            |

---

## Formation Checklist

### Phase 1: Company Formation (Days 1-2) ✅ SUBMITTED

- [x] Check "SPIKE LAND LTD" availability at Companies House
- [x] Register company online at gov.uk
- [x] Provide required details:
  - Company name: SPIKE LAND LTD
  - Registered office address
  - Director details (Founder)
  - Shareholder details (1 share @ £1)
  - SIC codes: 62090, 63120
- [x] Application submitted (Reference: 112-184507)
- [x] Corporation Tax registration submitted (Reference: BRCT00003618256)
- [x] Receive Certificate of Incorporation (12 December 2025)

### Phase 2: Post-Formation Priorities

- [x] Open business bank account (Monzo Business)
- [ ] Register for Corporation Tax with HMRC (within 3 months of incorporation)
- [ ] Update Stripe account to company details
- [ ] Set up accounting software (FreeAgent, Xero, or QuickBooks)
- [ ] Consider professional indemnity insurance

### Phase 3: Platform Updates

- [ ] Update Terms of Service (`src/app/terms/page.tsx`) with company name
- [ ] Update Privacy Policy (`src/app/privacy/page.tsx`) with company name
- [ ] Add company number to footer (optional)
- [ ] Update any invoicing/receipt templates

---

## Annual Compliance Requirements

| Requirement                 | Deadline                         | Cost        |
| --------------------------- | -------------------------------- | ----------- |
| **Confirmation Statement**  | Annual (from incorporation date) | £13         |
| **Annual Accounts**         | 9 months after year-end          | £0 (filing) |
| **Corporation Tax Return**  | 12 months after year-end         | £0 (filing) |
| **Corporation Tax Payment** | 9 months + 1 day after year-end  | Variable    |

### Recommended Services

- **Accountant**: £500-2000/year (highly recommended for first year)
- **Registered Office Service**: £50-150/year (if not using home address)
- **Business Bank Account**: Usually free (Starling, Tide)

---

## Tax Structure

### Corporation Tax (2024/25)

| Profit Level       | Rate                     |
| ------------------ | ------------------------ |
| £0 - £50,000       | 19% (Small Profits Rate) |
| £50,001 - £250,000 | Marginal relief (19-25%) |
| Over £250,000      | 25% (Main Rate)          |

### Director Salary + Dividends (Tax Efficient)

Optimal strategy (consult accountant for your situation):

1. **Salary**: £12,570/year (Personal Allowance, no Income Tax)
2. **Employer NI**: Avoided if under NI threshold
3. **Dividends**: Take remaining profits as dividends
   - £1,000 dividend allowance (tax-free)
   - Basic rate: 8.75%
   - Higher rate: 33.75%
   - Additional rate: 39.35%

---

## Comparison: Sole Trader vs Ltd

### Sole Trader (Prior Default)

**Pros:**

- Zero setup cost
- Simple accounting (Self Assessment)
- Full control, no formalities
- Privacy (no public filings)

**Cons:**

- Unlimited personal liability
- Higher taxes above ~£50k profit
- Cannot raise investment
- GDPR fines = personal liability
- Less professional perception

### Limited Company (Recommended)

**Pros:**

- Limited liability protection
- Tax efficient above £30k profit
- Professional credibility
- Investment ready
- GDPR protection
- Brand/name protection
- Exit potential (can sell company)

**Cons:**

- £12 setup + £13/year filing
- Annual accounts (public record)
- Director responsibilities (Companies Act 2006)
- More complex accounting
- Public disclosure of directors

---

## Director Responsibilities

As a company director, you must:

1. **Act within powers** - Follow company constitution
2. **Promote company success** - Act in shareholders' best interests
3. **Exercise independent judgment** - Make own decisions
4. **Exercise care, skill, diligence** - Apply reasonable competence
5. **Avoid conflicts of interest** - Disclose any personal interests
6. **Not accept third-party benefits** - No bribes/inducements
7. **Declare interests in transactions** - Transparency requirement

### Statutory Filings

- File Confirmation Statement annually
- File Annual Accounts on time
- Notify Companies House of changes (address, directors, shares)
- Maintain statutory registers (can be kept at Companies House)

---

## Historical Record

### Decision Made: December 2025

**Context:**

- Public beta live at spike.land
- Billing and onboarding work in progress ahead of commercial launch
- User data stored (images, accounts)
- Pre-revenue position maintained for the current platform

**Decision:** Form UK Limited Company

**Rationale:**

1. Personal liability protection worth more than £12 formation cost
2. GDPR compliance requires professional structure
3. Tax efficiency becomes relevant as revenue begins
4. Professional credibility for user trust

---

## Resources

- [Companies House - Register a Company](https://www.gov.uk/register-a-company-online)
- [HMRC - Corporation Tax](https://www.gov.uk/corporation-tax)
- [Companies House - Check Name Availability](https://find-and-update.company-information.service.gov.uk/)
- [Gov.uk - Running a Limited Company](https://www.gov.uk/running-a-limited-company)
- [ICO - GDPR for Small Business](https://ico.org.uk/for-organisations/sme-web-hub/)

---

## Related Documentation

| Document                               | Description                             |
| -------------------------------------- | --------------------------------------- |
| [ZOLTAN_ERDOS.md](./ZOLTAN_ERDOS.md)   | Founder profile, background, and vision |
| [CEO_DECISIONS.md](./CEO_DECISIONS.md) | Strategic decisions log                 |
