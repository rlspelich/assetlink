export type Tab = 'pay-items' | 'estimates' | 'contractors' | 'head-to-head' | 'bid-tabs' | 'market-analysis' | 'letting-report' | 'pi-detail';

/**
 * Cross-tab navigation parameters.
 * When navigating to a tab, optional params pre-fill/select data in the target.
 */
export interface EstimatorNavParams {
  contractId?: string;
  contractorPk?: string;
  payItemCode?: string;
  county?: string;
  district?: string;
  year?: string;
  sourceTab?: string;
}

export interface PricingOptions {
  adjustInflation: boolean;
  targetState: string;
}

export const US_STATES = [
  { code: 'AL', name: 'Alabama', factor: 0.87 }, { code: 'AK', name: 'Alaska', factor: 1.28 },
  { code: 'AZ', name: 'Arizona', factor: 0.92 }, { code: 'AR', name: 'Arkansas', factor: 0.84 },
  { code: 'CA', name: 'California', factor: 1.25 }, { code: 'CO', name: 'Colorado', factor: 0.98 },
  { code: 'CT', name: 'Connecticut', factor: 1.15 }, { code: 'DE', name: 'Delaware', factor: 1.02 },
  { code: 'DC', name: 'District of Columbia', factor: 1.08 },
  { code: 'FL', name: 'Florida', factor: 0.89 }, { code: 'GA', name: 'Georgia', factor: 0.88 },
  { code: 'HI', name: 'Hawaii', factor: 1.32 }, { code: 'ID', name: 'Idaho', factor: 0.91 },
  { code: 'IL', name: 'Illinois', factor: 1.00 }, { code: 'IN', name: 'Indiana', factor: 0.95 },
  { code: 'IA', name: 'Iowa', factor: 0.93 }, { code: 'KS', name: 'Kansas', factor: 0.90 },
  { code: 'KY', name: 'Kentucky', factor: 0.89 }, { code: 'LA', name: 'Louisiana', factor: 0.86 },
  { code: 'ME', name: 'Maine', factor: 0.96 }, { code: 'MD', name: 'Maryland', factor: 1.01 },
  { code: 'MA', name: 'Massachusetts', factor: 1.18 }, { code: 'MI', name: 'Michigan', factor: 0.97 },
  { code: 'MN', name: 'Minnesota', factor: 1.03 }, { code: 'MS', name: 'Mississippi', factor: 0.82 },
  { code: 'MO', name: 'Missouri', factor: 0.94 }, { code: 'MT', name: 'Montana', factor: 0.92 },
  { code: 'NE', name: 'Nebraska', factor: 0.91 }, { code: 'NV', name: 'Nevada', factor: 1.02 },
  { code: 'NH', name: 'New Hampshire', factor: 1.00 }, { code: 'NJ', name: 'New Jersey', factor: 1.16 },
  { code: 'NM', name: 'New Mexico', factor: 0.89 }, { code: 'NY', name: 'New York', factor: 1.22 },
  { code: 'NC', name: 'North Carolina', factor: 0.86 }, { code: 'ND', name: 'North Dakota', factor: 0.91 },
  { code: 'OH', name: 'Ohio', factor: 0.96 }, { code: 'OK', name: 'Oklahoma', factor: 0.85 },
  { code: 'OR', name: 'Oregon', factor: 1.01 }, { code: 'PA', name: 'Pennsylvania', factor: 1.05 },
  { code: 'RI', name: 'Rhode Island', factor: 1.12 }, { code: 'SC', name: 'South Carolina', factor: 0.84 },
  { code: 'SD', name: 'South Dakota', factor: 0.88 }, { code: 'TN', name: 'Tennessee', factor: 0.87 },
  { code: 'TX', name: 'Texas', factor: 0.88 }, { code: 'UT', name: 'Utah', factor: 0.93 },
  { code: 'VT', name: 'Vermont', factor: 0.95 }, { code: 'VA', name: 'Virginia', factor: 0.94 },
  { code: 'WA', name: 'Washington', factor: 1.05 }, { code: 'WV', name: 'West Virginia', factor: 0.92 },
  { code: 'WI', name: 'Wisconsin', factor: 0.98 }, { code: 'WY', name: 'Wyoming', factor: 0.90 },
];

export const CONTINGENCY_PHASES = [
  { label: 'Conceptual (25%)', value: 25 },
  { label: 'Preliminary (15%)', value: 15 },
  { label: 'Final Design (10%)', value: 10 },
  { label: 'Custom', value: -1 },
] as const;
