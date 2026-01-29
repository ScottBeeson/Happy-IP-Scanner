const fs = require('fs');
const path = require('path');

const logPath = path.join(process.cwd(), 'debug-log.txt');

function log(message) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(logPath, line);
}

module.exports = { log };
