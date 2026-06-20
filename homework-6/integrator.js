const fs = require('fs');
const path = require('path');

const { MESSAGE_TYPES, TRANSACTION_STATUSES } = require('./src/constants');
const { createMessage } = require('./src/utils/message');
const { log } = require('./src/utils/logger');
const validator = require('./agents/transaction_validator');
const fraudDetector = require('./agents/fraud_detector');
const complianceChecker = require('./agents/compliance_checker');

const SHARED_DIR = path.join(__dirname, 'shared');
const SAMPLE_TRANSACTIONS_PATH = path.join(__dirname, 'sample-transactions.json');
const SUBDIRS = ['input', 'processing', 'output', 'results'];

const setupSharedDirs = (sharedDir) => {
  for (const subdir of SUBDIRS) {
    fs.mkdirSync(path.join(sharedDir, subdir), { recursive: true });
  }
};

const clearSharedDirs = (sharedDir) => {
  for (const subdir of SUBDIRS) {
    const dir = path.join(sharedDir, subdir);
    if (fs.existsSync(dir)) {
      for (const file of fs.readdirSync(dir)) {
        fs.unlinkSync(path.join(dir, file));
      }
    }
  }
};

const loadTransactions = (filePath) => {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
};

const writeToInput = (transactions, sharedDir) => {
  const inputDir = path.join(sharedDir, 'input');
  for (const txn of transactions) {
    const message = createMessage(
      'integrator',
      'transaction_validator',
      MESSAGE_TYPES.NEW_TRANSACTION,
      { ...txn, status: TRANSACTION_STATUSES.PENDING },
    );
    fs.writeFileSync(
      path.join(inputDir, `${txn.transaction_id}.json`),
      JSON.stringify(message, null, 2),
    );
  }
};

const collectResults = (sharedDir) => {
  const resultsDir = path.join(sharedDir, 'results');
  const files = fs.readdirSync(resultsDir).filter((f) => f.endsWith('.json'));

  return files.map((file) => {
    const message = JSON.parse(fs.readFileSync(path.join(resultsDir, file), 'utf8'));
    return message.data;
  });
};

const printSummary = (results) => {
  const summary = { total: 0, rejected: 0, compliant: 0, flagged: 0 };

  for (const data of results) {
    summary.total++;
    if (data.status === TRANSACTION_STATUSES.REJECTED) summary.rejected++;
    else if (data.status === TRANSACTION_STATUSES.COMPLIANT) summary.compliant++;
    else if (data.status === TRANSACTION_STATUSES.FLAGGED) summary.flagged++;
  }

  console.log('\n════════════════════════════════════════════════════════');
  console.log('                   PIPELINE SUMMARY');
  console.log('════════════════════════════════════════════════════════');
  console.log(`  Total processed : ${summary.total}`);
  console.log(`  Compliant       : ${summary.compliant}`);
  console.log(`  Flagged         : ${summary.flagged}`);
  console.log(`  Rejected        : ${summary.rejected}`);
  console.log('────────────────────────────────────────────────────────');

  const sorted = [...results].sort((a, b) => a.transaction_id.localeCompare(b.transaction_id));
  for (const r of sorted) {
    const risk = r.risk_level ? `risk:${r.risk_level.padEnd(9)}` : '           ';
    const detail = r.rejection_reason
      || (r.compliance_flags && r.compliance_flags.join(', '))
      || 'none';
    console.log(`  ${r.transaction_id}  ${String(r.amount).padEnd(10)} ${r.currency}  ${r.status.padEnd(10)}  ${risk}  ${detail}`);
  }

  console.log('════════════════════════════════════════════════════════\n');
  return summary;
};

const runPipeline = (sharedDir, transactionsPath) => {
  const baseDir = sharedDir || SHARED_DIR;
  const txPath = transactionsPath || SAMPLE_TRANSACTIONS_PATH;

  console.log('\n[integrator] Starting banking transaction pipeline...');

  setupSharedDirs(baseDir);
  clearSharedDirs(baseDir);
  setupSharedDirs(baseDir);

  const transactions = loadTransactions(txPath);
  log('integrator', `${transactions.length} transactions`, 'loaded from input file');

  writeToInput(transactions, baseDir);
  log('integrator', 'all transactions', 'written to shared/input/');

  console.log('\n[Phase 1] Transaction Validator');
  const validatorStats = validator.process(baseDir);
  console.log(`  validated: ${validatorStats.validated}  rejected: ${validatorStats.rejected}`);

  console.log('\n[Phase 2] Fraud Detector');
  const fraudStats = fraudDetector.process(baseDir);
  console.log(`  low risk: ${fraudStats.low}  elevated: ${fraudStats.elevated}`);

  console.log('\n[Phase 3] Compliance Checker');
  const complianceStats = complianceChecker.process(baseDir);
  console.log(`  compliant: ${complianceStats.compliant}  flagged: ${complianceStats.flagged}`);

  const results = collectResults(baseDir);
  const summary = printSummary(results);

  return { ...summary, validatorStats, fraudStats, complianceStats };
};

if (require.main === module) {
  runPipeline();
}

module.exports = { runPipeline, setupSharedDirs, clearSharedDirs, loadTransactions, writeToInput };
