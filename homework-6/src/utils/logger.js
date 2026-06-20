const log = (agentName, transactionId, outcome) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${agentName}] ${transactionId} → ${outcome}`);
};

module.exports = { log };
