const net = require('net');
const EventEmitter = require('events');
const ipLib = require('ip');
const dns = require('dns').promises;

class Semaphore {
    constructor(max) {
        this.max = max;
        this.count = 0;
        this.queue = [];
    }

    async acquire() {
        if (this.count < this.max) {
            this.count++;
            return;
        }
        await new Promise(resolve => this.queue.push(resolve));
    }

    release() {
        this.count--;
        if (this.queue.length > 0) {
            this.count++;
            const resolve = this.queue.shift();
            resolve();
        }
    }
}

class Scanner extends EventEmitter {
    constructor() {
        super();
        this.concurrency = 50; // Scan 50 IPs at a time
        this.timeout = 1000;   // 1 second timeout per port
        this.ports = [80, 443, 135]; // Common ports to check
        this.isScanning = false;
        this.hostnameSemaphore = new Semaphore(2); // Limit concurrent hostname lookups
    }

    async scanIP(ip) {
        // We will assert the device is "UP" if any of the ports respond.
        // We can check them in parallel for speed.
        const checks = this.ports.map(port => this.checkPort(ip, port));

        try {
            // If any promise resolves true, the device is up.
            await Promise.any(checks);

            // Try to resolve hostname
            const hostname = await this.resolveHostname(ip);
            return { ip, status: 'active', hostname };
        } catch (error) {
            // AggregateError means all promises rejected (ports closed/timeout)
            return { ip, status: 'inactive' };
        }
    }

    async resolveHostname(ip) {
        await this.hostnameSemaphore.acquire();
        try {
            // Priority 1: standard reverse lookup
            try {
                const reversePromise = dns.reverse(ip);
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('timeout')), 2000)
                );

                const hostnames = await Promise.race([reversePromise, timeoutPromise]);

                if (hostnames && hostnames.length > 0) {
                    return hostnames[0];
                }
            } catch (err) {
                // Ignore DNS errors (code ENOTFOUND, etc) or timeout
            }

            // Fallback to Local/OS resolution (LLMNR/NetBIOS via OS)
            if (!process.env.NO_OS_LOOKUP) {
                try {
                    // Try to resolve using OS mechanisms (ping -a equivalent)
                    // We use port 80 as a dummy port; we only care about the hostname.
                    const name = await this.resolveLocalHostname(ip);
                    if (name) return name;
                } catch (err) {
                    // Ignore
                }
            }

            return null;
        } finally {
            this.hostnameSemaphore.release();
        }
    }

    async resolveLocalHostname(ip) {
        try {
            const lookupPromise = dns.lookupService(ip, 80);
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('timeout')), 10000)
            );

            const result = await Promise.race([lookupPromise, timeoutPromise]);
            return result.hostname;
        } catch (error) {
            return null;
        }
    }


    checkPort(ip, port) {
        return new Promise((resolve, reject) => {
            const socket = new net.Socket();

            socket.setTimeout(this.timeout);

            socket.on('connect', () => {
                socket.destroy();
                resolve('open');
            });

            socket.on('timeout', () => {
                socket.destroy();
                reject('timeout');
            });

            socket.on('error', (err) => {
                socket.destroy();
                reject(err);
            });

            socket.connect(port, ip);
        });
    }

    async scanRange(arg1, arg2) {
        let ipList = [];
        const errorHelp = `
Acceptable formats:
- CIDR: 192.168.1.0/24
- Range: 192.168.1.1-192.168.2.255
- List: 192.168.1.21, 192.168.1.42, 192.168.3.69`;

        try {
            if (!arg1) throw new Error('No IP range provided.' + errorHelp);

            const input = arg1.trim();

            // Case 0: Comma Separated List (arg1="1.1.1.1, 2.2.2.2")
            if (!arg2 && input.includes(',')) {
                const parts = input.split(',').map(p => p.trim()).filter(p => p);
                for (const p of parts) {
                    if (net.isIPv4(p)) {
                        ipList.push(p);
                    } else {
                        throw new Error(`Invalid IP in list: '${p}'.` + errorHelp);
                    }
                }
            }
            // Case 1: CIDR (arg1="192.168.1.0/24")
            else if (!arg2 && input.includes('/')) {
                try {
                    const subnet = ipLib.cidrSubnet(input);
                    const start = ipLib.toLong(subnet.firstAddress);
                    const end = ipLib.toLong(subnet.lastAddress);
                    for (let i = start; i <= end; i++) {
                        ipList.push(ipLib.fromLong(i));
                    }
                } catch (e) {
                    throw new Error('Invalid CIDR format.' + errorHelp);
                }
            }
            // Case 2: Hyphenated Range String (arg1="10.0.0.1 - 10.0.0.5")
            else if (!arg2 && input.includes('-')) {
                const parts = input.split('-');
                if (parts.length === 2) {
                    const startIP = parts[0].trim();
                    const endIP = parts[1].trim();
                    if (net.isIPv4(startIP) && net.isIPv4(endIP)) {
                        const start = ipLib.toLong(startIP);
                        const end = ipLib.toLong(endIP);
                        // Ensure start <= end
                        if (start <= end) {
                            for (let i = start; i <= end; i++) {
                                ipList.push(ipLib.fromLong(i));
                            }
                        } else {
                            throw new Error('Start IP must be less than or equal to End IP.' + errorHelp);
                        }
                    } else {
                        throw new Error('Invalid IP format in range.' + errorHelp);
                    }
                } else {
                    throw new Error('Invalid range format.' + errorHelp);
                }
            }
            // Case 3: Start and End IP (Legacy/IPC called with two args)
            else if (arg1 && arg2) {
                if (net.isIPv4(arg1) && net.isIPv4(arg2)) {
                    const start = ipLib.toLong(arg1);
                    const end = ipLib.toLong(arg2);
                    if (start <= end) {
                        for (let i = start; i <= end; i++) {
                            ipList.push(ipLib.fromLong(i));
                        }
                    } else {
                        throw new Error('Start IP must be less than End IP.' + errorHelp);
                    }
                } else {
                    throw new Error('Invalid IP parameters.' + errorHelp);
                }
            }
            // Case 4: Single IP
            else {
                if (net.isIPv4(input)) {
                    ipList.push(input);
                } else {
                    // Start of a typo-ed range/cidr or just garbage? 
                    // throw error
                    throw new Error('Invalid IP format.' + errorHelp);
                }
            }

            if (ipList.length === 0) {
                throw new Error('No valid IPs found.' + errorHelp);
            }

            return await this.scanList(ipList);

        } catch (err) {
            console.error('Range Generation Failed:', err);
            require('./logger').log(`Range error: ${err.message}`);
            this.emit('error', err.message); // Send message string to be cleaner on frontend
            return [];
        }
    }

    cancelScan() {
        this.isScanning = false;
    }

    // Scan a list of IPs with controlled concurrency
    async scanList(ipList) {
        this.isScanning = true;
        this.emit('scan:start', { total: ipList.length, ipList });

        const results = [];
        const queue = [...ipList];
        const activeWorkers = [];

        const worker = async () => {
            while (queue.length > 0 && this.isScanning) {
                const ip = queue.shift();

                // Notify that we are about to scan this IP
                if (this.isScanning) {
                    this.emit('scan:initiate', ip);
                }

                const result = await this.scanIP(ip);

                // Only push/emit if still scanning
                if (this.isScanning) {
                    results.push(result);
                    this.emit('scan:result', result);
                }
            }
        };

        // Start initial workers
        for (let i = 0; i < Math.min(this.concurrency, ipList.length); i++) {
            activeWorkers.push(worker());
        }

        await Promise.all(activeWorkers);

        this.isScanning = false;
        this.emit('scan:complete', results);
        return results;
    }
}

module.exports = new Scanner();


