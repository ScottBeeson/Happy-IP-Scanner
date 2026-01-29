const scanner = require('./main/scanner');

async function runTest() {
    console.log('Starting generic scan test...');

    // Test 1: Localhost scan (should act alive)
    // 127.0.0.1 often has ports closed, but let's see. 
    // If windows, 135 (RPC) is usually open.
    console.log('Scanning 127.0.0.1...');
    const result = await scanner.scanIP('127.0.0.1');
    console.log('Result for 127.0.0.1:', result);

    // Test 2: Range scan (small range)
    // 192.168.1.1 to 192.168.1.5 (Mock range, assuming user might not have these active)
    // But we test the range generation and event emission at least.
    console.log('Testing Range Scan (192.168.1.1-192.168.1.3)...');

    scanner.on('scan:start', (data) => console.log('Event: scan:start', data));
    scanner.on('scan:result', (res) => console.log('Event: scan:result', res));
    scanner.on('scan:complete', (res) => console.log('Event: scan:complete', res.length));

    await scanner.scanRange('192.168.1.1', '192.168.1.3');

    console.log('Test Complete.');
}

runTest();
