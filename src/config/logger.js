const fs = require('node:fs');
const path = require('node:path');
const winston = require('winston');

const logFile = path.resolve(process.env.LOG_FILE || 'logs/app.log');
const logDirectory = path.dirname(logFile);
fs.mkdirSync(logDirectory, { recursive: true });

const exceptionLog = () => new winston.transports.File({
  filename: path.join(logDirectory, 'exceptions.log')
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: logFile })
  ],
  exceptionHandlers: [exceptionLog()],
  rejectionHandlers: [exceptionLog()]
});

module.exports = logger;
