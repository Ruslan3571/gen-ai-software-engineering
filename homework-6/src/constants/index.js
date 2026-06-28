const { Decimal } = require('decimal.js');

const ISO_4217_CURRENCIES = new Set([
  'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN',
  'BAM', 'BBD', 'BDT', 'BGN', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL',
  'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY',
  'COP', 'CRC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD', 'EGP',
  'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHS', 'GIP', 'GMD',
  'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HRK', 'HTG', 'HUF', 'IDR', 'ILS',
  'INR', 'IQD', 'IRR', 'ISK', 'JMD', 'JOD', 'JPY', 'KES', 'KGS', 'KHR',
  'KMF', 'KPW', 'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR', 'LRD',
  'LSL', 'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU',
  'MUR', 'MVR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK',
  'NPR', 'NZD', 'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG',
  'QAR', 'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SDG', 'SEK',
  'SGD', 'SHP', 'SLL', 'SOS', 'SRD', 'STN', 'SVC', 'SYP', 'SZL', 'THB',
  'TJS', 'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS', 'UAH', 'UGX',
  'USD', 'UYU', 'UZS', 'VES', 'VND', 'VUV', 'WST', 'XAF', 'XCD', 'XOF',
  'XPF', 'YER', 'ZAR', 'ZMW', 'ZWL',
]);

const REQUIRED_TRANSACTION_FIELDS = [
  'transaction_id',
  'timestamp',
  'source_account',
  'destination_account',
  'amount',
  'currency',
  'transaction_type',
];

const FRAUD_THRESHOLDS = {
  HIGH_VALUE: new Decimal('10000'),
  STRUCTURING_LOW: new Decimal('9000'),
};

const RISK_LEVELS = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
};

const RISK_SCORE_THRESHOLDS = {
  CRITICAL: new Decimal('0.70'),
  HIGH: new Decimal('0.50'),
  MEDIUM: new Decimal('0.30'),
};

const RISK_WEIGHTS = {
  HIGH_VALUE: new Decimal('0.60'),
  STRUCTURING: new Decimal('0.30'),
  UNUSUAL_HOUR: new Decimal('0.20'),
  CROSS_BORDER: new Decimal('0.15'),
};

const SUSPICIOUS_HOURS = { START: 0, END: 6 };

const SUSPICIOUS_ACCOUNTS = new Set(['ACC-9999']);

const AML_THRESHOLD = new Decimal('10000');

const MESSAGE_TYPES = {
  NEW_TRANSACTION: 'new_transaction',
  VALIDATED: 'validated',
  REJECTED: 'rejected',
  FRAUD_SCORED: 'fraud_scored',
  COMPLIANCE_REVIEWED: 'compliance_reviewed',
};

const TRANSACTION_STATUSES = {
  PENDING: 'pending',
  VALIDATED: 'validated',
  REJECTED: 'rejected',
  FRAUD_SCORED: 'fraud_scored',
  COMPLIANT: 'compliant',
  FLAGGED: 'flagged',
};

const COMPLIANCE_FLAGS = {
  SUSPICIOUS_DESTINATION: 'suspicious_destination',
  AML_REPORTING_REQUIRED: 'aml_reporting_required',
  MANUAL_REVIEW_REQUIRED: 'manual_review_required',
};

module.exports = {
  ISO_4217_CURRENCIES,
  REQUIRED_TRANSACTION_FIELDS,
  FRAUD_THRESHOLDS,
  RISK_LEVELS,
  RISK_SCORE_THRESHOLDS,
  RISK_WEIGHTS,
  SUSPICIOUS_HOURS,
  SUSPICIOUS_ACCOUNTS,
  AML_THRESHOLD,
  MESSAGE_TYPES,
  TRANSACTION_STATUSES,
  COMPLIANCE_FLAGS,
};
