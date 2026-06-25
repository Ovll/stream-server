const clients = new Set();

let catalogVersion = 0;
let debounceTimer = null;

export function createCatalogEventsRouter() {
    return function catalogEventsHandler(req, res) {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'X-Accel-Buffering': 'no',
        });

        const client = {
            id: Date.now() + Math.random(),
            res,
        };

        clients.add(client);

        sendEvent(res, 'connected', {
            version: catalogVersion,
        });

        const keepAlive = setInterval(() => {
            res.write(': keep-alive\n\n');
        }, 25_000);

        req.on('close', () => {
            clearInterval(keepAlive);
            clients.delete(client);
        });
    };
}

export function notifyCatalogChanged(reason = 'catalog-changed', details = {}) {
    catalogVersion += 1;

    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
        broadcastCatalogChanged(reason, details);
    }, 1000);
}

function broadcastCatalogChanged(reason, details) {
    const payload = {
        type: 'catalog-changed',
        version: catalogVersion,
        reason,
        details,
        at: new Date().toISOString(),
    };

    for (const client of clients) {
        sendEvent(client.res, 'catalog-changed', payload);
    }

    console.log(`Catalog change event sent to ${clients.size} client(s): ${reason}`);
}

export function broadcastServerEvent(eventName, data = {}) {
    for (const client of clients) {
        sendEvent(client.res, eventName, { ...data, at: new Date().toISOString() });
    }
}

function sendEvent(res, eventName, data) {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
}