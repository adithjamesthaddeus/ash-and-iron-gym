const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const db = new sqlite3.Database('./database.sqlite');
const PORT = process.env.PORT || 3000;
const SECRET_KEY = "SUPER_SECRET_KEY";

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Initialize Database
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT DEFAULT 'member',
        phone TEXT,
        height REAL,
        weight REAL,
        monthly_price REAL,
        yearly_price REAL,
        expiry TEXT
    )`, (err) => {
        if(!err) {
            // Create super admin if not exists
            const stmt = db.prepare('SELECT * FROM users WHERE role = ?');
            stmt.get('admin', (err, row) => {
                if(!row) {
                    bcrypt.hash('admin123', 10, (err, hash) => {
                        db.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", ["superadmin", hash, "admin"]);
                        console.log("Super admin created: username=superadmin, password=admin123");
                    });
                }
            });
            stmt.finalize();
        }
    });

    db.run(`CREATE TABLE IF NOT EXISTS tracker_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        date TEXT,
        log_text TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);
});

// Auth Middleware
const authenticateToken = (req, res, next) => {
    const header = req.headers['authorization'];
    const token = header && header.split(' ')[1];
    if(!token) return res.sendStatus(401);
    
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if(err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

const isAdmin = (req, res, next) => {
    if(req.user.role !== 'admin') return res.sendStatus(403);
    next();
};

// --- API ROUTES --- //

// Login Route
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err || !user) return res.status(401).json({ error: "Invalid credentials" });
        bcrypt.compare(password, user.password, (err, match) => {
            if(!match) return res.status(401).json({ error: "Invalid credentials" });
            const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET_KEY, { expiresIn: '12h' });
            res.json({ token, role: user.role });
        });
    });
});

// Public Signup Route
app.post('/api/signup', (req, res) => {
    const { username, password, phone, height, weight } = req.body;
    bcrypt.hash(password || 'password123', 10, (err, hash) => {
        db.run(`INSERT INTO users (username, password, role, phone, height, weight) 
                VALUES (?, ?, 'member', ?, ?, ?)`, 
        [username, hash, phone, height, weight], function(err) {
            if (err) return res.status(400).json({ error: "Username already exists or invalid data" });
            res.json({ message: "Signup successful. You can now login.", id: this.lastID });
        });
    });
});

// Admin Routes to manage members
app.get('/api/admin/members', authenticateToken, isAdmin, (req, res) => {
    db.all("SELECT id, username, phone, height, weight, monthly_price, yearly_price, expiry FROM users WHERE role = 'member'", (err, rows) => {
        if(err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/admin/members', authenticateToken, isAdmin, (req, res) => {
    const { username, password, phone, height, weight, monthly_price, yearly_price, expiry } = req.body;
    bcrypt.hash(password || 'password123', 10, (err, hash) => {
        db.run(`INSERT INTO users (username, password, role, phone, height, weight, monthly_price, yearly_price, expiry) 
                VALUES (?, ?, 'member', ?, ?, ?, ?, ?, ?)`, 
        [username, hash, phone, height, weight, monthly_price, yearly_price, expiry], function(err) {
            if (err) return res.status(400).json({ error: "Username already exists or invalid data" });
            res.json({ message: "Member added successfully", id: this.lastID });
        });
    });
});

app.put('/api/admin/members/:id', authenticateToken, isAdmin, (req, res) => {
    const { id } = req.params;
    const { username, phone, height, weight, monthly_price, yearly_price, expiry } = req.body;
    db.run(`UPDATE users SET username=?, phone=?, height=?, weight=?, monthly_price=?, yearly_price=?, expiry=? WHERE id=?`,
        [username, phone, height, weight, monthly_price, yearly_price, expiry, id], function(err) {
            if(err) return res.status(400).json({ error: err.message });
            res.json({ message: "Member updated successfully" });
    });
});

app.delete('/api/admin/members/:id', authenticateToken, isAdmin, (req, res) => {
    const { id } = req.params;
    db.run(`DELETE FROM users WHERE id=? AND role='member'`, [id], function(err) {
        if(err) return res.status(500).json({ error: err.message });
        res.json({ message: "Member deleted successfully" });
    });
});

// Member Dashboard Routes
app.get('/api/member/me', authenticateToken, (req, res) => {
    db.get("SELECT id, username, phone, height, weight, monthly_price, yearly_price, expiry FROM users WHERE id = ?", [req.user.id], (err, user) => {
        if(err || !user) return res.status(404).json({ error: "User not found" });
        res.json(user);
    });
});

// Tracker Logs
app.get('/api/member/tracker', authenticateToken, (req, res) => {
    db.all("SELECT id, date, log_text FROM tracker_logs WHERE user_id = ? ORDER BY date DESC, id DESC", [req.user.id], (err, rows) => {
        if(err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/member/tracker', authenticateToken, (req, res) => {
    const { log_text, date, weight } = req.body;
    if (!date) return res.status(400).json({ error: "Date is required" });
    
    if (weight) {
        db.run("UPDATE users SET weight = ? WHERE id = ?", [weight, req.user.id]);
    }
    
    db.run("INSERT INTO tracker_logs (user_id, date, log_text) VALUES (?, ?, ?)", [req.user.id, date, log_text], function(err) {
        if(err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, date, log_text });
    });
});

// Member Plan Enrollment
app.post('/api/member/enroll', authenticateToken, (req, res) => {
    const { planType } = req.body;
    let monthly_price = 0;
    let yearly_price = 0;
    let expiry = new Date();

    if (planType === 'monthly') {
        monthly_price = 50;
        expiry.setMonth(expiry.getMonth() + 1);
    } else if (planType === 'yearly') {
        yearly_price = 500;
        expiry.setFullYear(expiry.getFullYear() + 1);
    } else {
        return res.status(400).json({ error: "Invalid plan type" });
    }

    const expiryStr = expiry.toISOString().split('T')[0];
    
    db.run("UPDATE users SET monthly_price = ?, yearly_price = ?, expiry = ? WHERE id = ?", 
        [monthly_price, yearly_price, expiryStr, req.user.id], function(err) {
        if(err) return res.status(500).json({ error: err.message });
        res.json({ message: "Successfully enrolled in " + planType + " plan!", expiry: expiryStr, monthly_price, yearly_price });
    });
});

// Single Page App fallback
app.use((req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
