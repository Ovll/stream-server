const { app, Tray, Menu, nativeImage, shell, Notification, powerSaveBlocker } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');
const http = require('http');

const CONFIG_DIR = path.join(os.homedir(), 'Library', 'Application Support', 'stream-server');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG = {
    port: 4000,
    mediaDir: path.join(os.homedir(), 'Movies'),
    tmdbApiKey: '',
    dbPath: path.join(CONFIG_DIR, 'stream-server.db'),
};

function loadConfig() {
    if (!fs.existsSync(CONFIG_PATH)) {
        console.log('[desktop] config.json not found, creating defaults at', CONFIG_PATH);
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
        return { ...DEFAULT_CONFIG };
    }
    try {
        return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) };
    } catch {
        return { ...DEFAULT_CONFIG };
    }
}

function getServerPath() {
    return app.isPackaged
        ? path.join(process.resourcesPath, 'server', 'server.js')
        : path.join(__dirname, '..', 'server.js');
}

function findNode() {
    // Prefer NODE_BINARY env override.
    if (process.env.NODE_BINARY && fs.existsSync(process.env.NODE_BINARY)) {
        return process.env.NODE_BINARY;
    }
    // Ask the login shell — inherits fnm/nvm/etc. env so we get the right version.
    for (const shell of [process.env.SHELL, '/bin/zsh', '/bin/bash'].filter(Boolean)) {
        try {
            const p = require('child_process')
                .execSync(`${shell} -lc "which node"`, { encoding: 'utf8', timeout: 4000 })
                .trim();
            if (p && fs.existsSync(p)) return p;
        } catch {}
    }
    // Hard-coded fallbacks.
    for (const p of ['/opt/homebrew/bin/node', '/usr/local/bin/node', '/usr/bin/node']) {
        if (fs.existsSync(p)) return p;
    }
    return 'node';
}

let tray = null;
let serverProcess = null;
let currentPort = null;
let statusLabel = 'Server: Starting…';
let config = loadConfig();
let sseReq = null;
let powerSaveId = null;

function isPortFree(port) {
    return new Promise((resolve) => {
        const srv = net.createServer();
        srv.once('error', () => resolve(false));
        srv.once('listening', () => { srv.close(); resolve(true); });
        srv.listen(port, '127.0.0.1');
    });
}

async function findFreePort(startPort, attempts = 3) {
    for (let i = 0; i < attempts; i++) {
        if (await isPortFree(startPort + i)) return startPort + i;
    }
    return null;
}

async function startServerProcess() {
    const port = await findFreePort(config.port);
    if (port === null) {
        statusLabel = 'Server: No free port';
        updateMenu();
        new Notification({ title: 'Stream Server', body: 'Could not find a free port.' }).show();
        return;
    }

    currentPort = port;
    statusLabel = 'Server: Starting…';
    updateMenu();

    const serverPath = getServerPath();
    const nodeBin = findNode();

    const webUiDir = app.isPackaged
        ? path.join(process.resourcesPath, 'server', 'ui', 'dist', 'web')
        : path.join(__dirname, '..', 'ui', 'dist', 'common');

    const env = {
        ...process.env,
        PORT: String(port),
        MEDIA_DIR: config.mediaDir,
        DB_PATH: config.dbPath,
        APP_CONFIG_PATH: CONFIG_PATH,
        PUBLIC_DIR: webUiDir,
    };
    if (config.tmdbApiKey) env.TMDB_API_KEY = config.tmdbApiKey;

    serverProcess = spawn(nodeBin, [serverPath], {
        env,
        cwd: path.dirname(serverPath),
    });

    powerSaveId = powerSaveBlocker.start('prevent-app-suspension');

    serverProcess.stdout.on('data', (data) => {
        const text = data.toString();
        process.stdout.write('[server] ' + text);
        if (text.includes('Server listening')) {
            statusLabel = `Server: Running on :${currentPort}`;
            updateMenu();
            subscribeToServerEvents(currentPort);
        }
    });

    serverProcess.stderr.on('data', (data) => {
        process.stderr.write('[server] ' + data.toString());
    });

    serverProcess.on('exit', (code) => {
        serverProcess = null;
        sseReq?.destroy();
        sseReq = null;
        currentPort = null;
        statusLabel = code === 0 || code === null ? 'Server: Stopped' : `Server: Exited (${code})`;
        updateMenu();
    });
}

function stopServerProcess() {
    sseReq?.destroy();
    sseReq = null;
    if (powerSaveId !== null) {
        powerSaveBlocker.stop(powerSaveId);
        powerSaveId = null;
    }
    if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
        currentPort = null;
        statusLabel = 'Server: Stopped';
        updateMenu();
    }
}

async function restartServerProcess() {
    stopServerProcess();
    config = loadConfig();
    await startServerProcess();
}

function subscribeToServerEvents(port) {
    sseReq?.destroy();

    const req = http.request({ hostname: 'localhost', port, path: '/api/events' }, (res) => {
        let buf = '';
        let eventType = '';
        res.on('data', (chunk) => {
            buf += chunk.toString();
            const lines = buf.split('\n');
            buf = lines.pop();
            for (const line of lines) {
                if (line.startsWith('event: ')) {
                    eventType = line.slice(7).trim();
                } else if (line.startsWith('data: ') && eventType === 'restart-required') {
                    restartServerProcess();
                    eventType = '';
                } else if (line === '') {
                    eventType = '';
                }
            }
        });
        res.on('end', () => { sseReq = null; });
    });
    req.on('error', () => { sseReq = null; });
    req.end();
    sseReq = req;
}

function buildMenu() {
    const canOpen = !!currentPort;
    return Menu.buildFromTemplate([
        {
            label: 'Open Dashboard',
            enabled: canOpen,
            click: () => shell.openExternal(`http://localhost:${currentPort}`),
        },
        {
            label: 'Settings…',
            enabled: canOpen,
            click: () => shell.openExternal(`http://localhost:${currentPort}/settings`),
        },
        { type: 'separator' },
        { label: statusLabel, enabled: false },
        serverProcess
            ? { label: 'Stop Server', click: stopServerProcess }
            : { label: 'Start Server', click: () => startServerProcess() },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => { stopServerProcess(); app.quit(); },
        },
    ]);
}

function updateMenu() {
    if (tray) tray.setContextMenu(buildMenu());
}

app.whenReady().then(async () => {
    app.dock?.hide();

    const iconPath = path.join(__dirname, 'assets', 'icon.png');
    const icon = nativeImage.createFromBuffer(fs.readFileSync(iconPath), { scaleFactor: 1.0 });
    icon.setTemplateImage(true);

    tray = new Tray(icon);
    tray.setToolTip('Stream Server');
    tray.setContextMenu(buildMenu());

    await startServerProcess();
});

app.on('window-all-closed', () => {
    // stay alive as menu bar app
});

app.on('before-quit', () => {
    stopServerProcess();
});
