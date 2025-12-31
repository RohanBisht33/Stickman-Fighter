import { UI } from './UI.js';

export class NetworkManager {
    constructor() {
        this.peer = null;
        this.conn = null;
        this.onData = null;
    }

    init(username, isHost, targetId, onConnect) {
        // Check if PeerJS is loaded
        if (typeof Peer === 'undefined') {
            alert('PeerJS library not loaded. Please refresh the page.');
            return;
        }

        const peerOpt = isHost ? {
            debug: 1,
            id: this.generateRoomCode()
        } : { debug: 1 };

        try {
            this.peer = new Peer(isHost ? peerOpt.id : null, { debug: 1 });
        } catch (err) {
            alert('Failed to initialize PeerJS: ' + err.message);
            console.error(err);
            return;
        }

        this.peer.on('open', (id) => {
            console.log('Peer opened with ID:', id);
            if (isHost) {
                const el = document.getElementById('myRoomId');
                if (el) el.textContent = id;
                this.setupHost(onConnect);
            } else {
                this.connect(targetId, username, onConnect);
            }
        });
        this.peer.on('error', (err) => {
            console.error('Peer error:', err);
            alert("Net Error: " + err.type);
        });
    }

    setupHost(onConnect) {
        this.peer.on('connection', (conn) => {
            if (this.conn && this.conn.open) this.conn.close();
            this.handleConn(conn, onConnect);
        });
    }

    connect(id, username, onConnect) {
        const conn = this.peer.connect(id);
        conn.on('open', () => {
            this.handleConn(conn, onConnect);
            this.send({ type: 'handshake', username: username });
        });
        conn.on('error', () => {
            alert("Could not find room!");
            location.reload();
        });
    }

    handleConn(conn, onConnect) {
        this.conn = conn;
        conn.on('data', (data) => {
            if (this.onData) this.onData(data);
        });
        conn.on('close', () => {
            UI.showToast("Opponent Left");
            // Handle disconnect logic via callbacks ideally
            alert("Session Ended");
            location.reload();
        });
        if (onConnect) onConnect();
    }

    send(data) {
        if (this.conn && this.conn.open) this.conn.send(data);
    }

    generateRoomCode() {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let result = '';
        for (let i = 0; i < 4; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
        return result;
    }
}
