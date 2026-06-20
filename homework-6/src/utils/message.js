const { randomUUID } = require('crypto');

const createMessage = (sourceAgent, targetAgent, messageType, data) => ({
  message_id: randomUUID(),
  timestamp: new Date().toISOString(),
  source_agent: sourceAgent,
  target_agent: targetAgent,
  message_type: messageType,
  data,
});

module.exports = { createMessage };
