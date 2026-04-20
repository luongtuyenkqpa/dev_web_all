// ======================================================
// SERVER.JS - KEY SERVER HOÀN CHỈNH 1 FILE (FULL FEATURES)
// Đã gộp tất cả chức năng + 5 tính năng bạn yêu cầu
// Không mất code nào - Sẵn sàng up Render / Railway
// ======================================================

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// ====================== CONFIG ======================
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public')); // nếu bạn muốn thêm folder public sau

app.use(session({
    secret: 'keyserver-super-secret-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 1 ngày
}));

// ====================== DATA & PERSISTENCE ======================
let data = {
    users: [],   // { id, username, passwordHash, role: 'admin'|'user', vip: boolean, createdAt }
    keys: []     // { id, keyCode, type: 'VIP'|'NORMAL', status: 'active'|'expired'|'banned', 
                 //   expiresAt, ownerUserId, usedIPs: [], usageCount, createdAt, lastUsedAt }
};

const DATA_FILE = './data.json';

function loadData() {
    if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        data = JSON.parse(raw);
    } else {
        // Tạo admin mặc định
        const adminHash = bcrypt.hashSync('admin123', 10);
        data.users.push({
            id: 1,
            username: 'admin',
            passwordHash: adminHash,
            role: 'admin',
            vip: true,
            createdAt: new Date().toISOString()
        });
        saveData();
    }
}

function saveData() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

loadData();

// ====================== HELPER FUNCTIONS ======================
function generateKey() {
    return 'KEY-' + crypto.randomBytes(16).toString('hex').toUpperCase();
}

function getClientIP(req) {
    return req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
}

function isKeyExpired(key) {
    return new Date(key.expiresAt) < new Date();
}

function updateKeyStatus(key) {
    if (key.status === 'banned') return;
    if (isKeyExpired(key)) {
        key.status = 'expired';
    }
}

// ====================== MIDDLEWARE ======================
function isLoggedIn(req, res, next) {
    if (req.session.user) return next();
    res.redirect('/login');
}

function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') return next();
    res.send('<h2 style="color:red;text-align:center;margin-top:50px">⛔ Chỉ Admin mới vào được trang này!</h2>');
}

// ====================== ROUTES ======================

// ------------------- PUBLIC & USER -------------------
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <title>Key Server - Đăng nhập</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
        <style>body { background: linear-gradient(135deg, #667eea, #764ba2); min-height: 100vh; }</style>
    </head>
    <body>
        <div class="container mt-5">
            <div class="row justify-content-center">
                <div class="col-md-5">
                    <div class="card shadow">
                        <div class="card-body text-center p-5">
                            <h2 class="mb-4">🔑 Key Server</h2>
                            <a href="/login" class="btn btn-primary btn-lg w-100 mb-3">👤 Đăng nhập User</a>
                            <a href="/admin/login" class="btn btn-dark btn-lg w-100">🛠️ Admin Dashboard</a>
                            <hr>
                            <small class="text-muted">Phiên bản full - 20/04/2026</small>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>`);
});

// USER LOGIN
app.get('/login', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head><meta charset="UTF-8"><title>Đăng nhập User</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet"></head>
    <body class="bg-light">
    <div class="container mt-5">
        <div class="row justify-content-center">
            <div class="col-md-4">
                <h3 class="text-center mb-4">👤 Đăng nhập tài khoản</h3>
                <form method="POST" action="/login-user">
                    <div class="mb-3">
                        <input type="text" name="username" class="form-control" placeholder="Tên đăng nhập" required>
                    </div>
                    <div class="mb-3">
                        <input type="password" name="password" class="form-control" placeholder="Mật khẩu" required>
                    </div>
                    <button type="submit" class="btn btn-success w-100">Đăng nhập</button>
                </form>
                <div class="text-center mt-3">
                    <a href="/register">Chưa có tài khoản? Đăng ký ngay</a>
                </div>
                <a href="/" class="btn btn-link w-100 mt-3">← Về trang chủ</a>
            </div>
        </div>
    </div>
    </body></html>`);
});

app.post('/login-user', (req, res) => {
    const { username, password } = req.body;
    const user = data.users.find(u => u.username === username);
    if (user && bcrypt.compareSync(password, user.passwordHash)) {
        req.session.user = { id: user.id, username: user.username, role: user.role, vip: user.vip };
        res.redirect('/dashboard');
    } else {
        res.send('<h3 style="color:red;text-align:center;margin-top:100px">❌ Sai tài khoản hoặc mật khẩu!</h3><a href="/login">Quay lại</a>');
    }
});

// USER REGISTER
app.get('/register', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head><meta charset="UTF-8"><title>Đăng ký User</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet"></head>
    <body class="bg-light">
    <div class="container mt-5">
        <div class="row justify-content-center">
            <div class="col-md-4">
                <h3 class="text-center mb-4">📝 Đăng ký tài khoản mới</h3>
                <form method="POST" action="/register-user">
                    <div class="mb-3"><input type="text" name="username" class="form-control" placeholder="Tên đăng nhập" required></div>
                    <div class="mb-3"><input type="password" name="password" class="form-control" placeholder="Mật khẩu" required></div>
                    <button type="submit" class="btn btn-primary w-100">Đăng ký</button>
                </form>
                <a href="/login" class="btn btn-link w-100 mt-3">← Đã có tài khoản</a>
            </div>
        </div>
    </div>
    </body></html>`);
});

app.post('/register-user', (req, res) => {
    const { username, password } = req.body;
    if (data.users.find(u => u.username === username)) {
        return res.send('<h3 style="color:red;text-align:center">Tên đăng nhập đã tồn tại!</h3><a href="/register">Quay lại</a>');
    }
    const hash = bcrypt.hashSync(password, 10);
    const newUser = {
        id: Date.now(),
        username,
        passwordHash: hash,
        role: 'user',
        vip: false,
        createdAt: new Date().toISOString()
    };
    data.users.push(newUser);
    saveData();
    res.send('<h3 style="color:green;text-align:center;margin-top:100px">✅ Đăng ký thành công! <a href="/login">Đăng nhập ngay</a></h3>');
});

// USER DASHBOARD + NHẬP KEY
app.get('/dashboard', isLoggedIn, (req, res) => {
    const user = req.session.user;
    const myKeys = data.keys.filter(k => k.ownerUserId === user.id);
    
    let htmlKeys = myKeys.length ? myKeys.map(k => `
        <tr>
            <td>${k.keyCode}</td>
            <td><span class="badge bg-\( {k.type==='VIP'?'success':'info'}"> \){k.type}</span></td>
            <td><span class="badge bg-\( {k.status==='active'?'success':k.status==='expired'?'warning':'danger'}"> \){k.status}</span></td>
            <td>${new Date(k.expiresAt).toLocaleDateString('vi-VN')}</td>
        </tr>`).join('') : '<tr><td colspan="4" class="text-center">Chưa có key nào</td></tr>';

    res.send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head><meta charset="UTF-8"><title>Dashboard - ${user.username}</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet"></head>
    <body>
    <nav class="navbar navbar-dark bg-dark">
        <div class="container">
            <a class="navbar-brand" href="/dashboard">🔑 Key Server</a>
            <span class="navbar-text">Xin chào <b>${user.username}</b> ${user.vip ? '⭐ VIP' : '👤 Thường'}</span>
            <a href="/logout" class="btn btn-outline-light">Đăng xuất</a>
        </div>
    </nav>
    <div class="container mt-4">
        <h2>👋 Chào ${user.username}!</h2>
        <div class="row">
            <div class="col-md-8">
                <div class="card">
                    <div class="card-header bg-primary text-white">Nhập Key để kích hoạt</div>
                    <div class="card-body">
                        <form method="POST" action="/enter-key">
                            <div class="input-group">
                                <input type="text" name="keyCode" class="form-control" placeholder="Dán key vào đây (ví dụ: KEY-...)" required>
                                <button type="submit" class="btn btn-success">Kích hoạt</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card h-100">
                    <div class="card-body text-center">
                        <h5>Trạng thái tài khoản</h5>
                        <h1 class="display-4 \( {user.vip ? 'text-success' : 'text-secondary'}"> \){user.vip ? '⭐ VIP' : '👤 Thường'}</h1>
                    </div>
                </div>
            </div>
        </div>
        <h4 class="mt-5">Key đã kích hoạt</h4>
        <table class="table table-bordered">${htmlKeys}</table>
    </div>
    </body></html>`);
});

app.post('/enter-key', isLoggedIn, (req, res) => {
    const { keyCode } = req.body;
    const user = req.session.user;
    let key = data.keys.find(k => k.keyCode === keyCode);

    if (!key) return res.send('<h3 style="color:red;text-align:center">❌ Key không tồn tại!</h3><a href="/dashboard">Quay lại</a>');
    if (key.status === 'banned') return res.send('<h3 style="color:red;text-align:center">⛔ Key đã bị cấm!</h3><a href="/dashboard">Quay lại</a>');

    updateKeyStatus(key);
    if (key.status === 'expired') return res.send('<h3 style="color:orange;text-align:center">⏰ Key đã hết hạn!</h3><a href="/dashboard">Quay lại</a>');

    // Anti-share thông minh
    const ip = getClientIP(req);
    if (!key.usedIPs.includes(ip)) {
        key.usedIPs.push(ip);
        if (key.usedIPs.length > 3) { // Giới hạn 3 IP
            key.status = 'banned';
            saveData();
            return res.send('<h3 style="color:red;text-align:center">🚫 Key bị tự động BAN vì share quá 3 IP!</h3><a href="/dashboard">Quay lại</a>');
        }
    }

    key.usageCount = (key.usageCount || 0) + 1;
    key.lastUsedAt = new Date().toISOString();
    if (!key.ownerUserId) key.ownerUserId = user.id;

    // Phân quyền VIP / Thường
    if (key.type === 'VIP') user.vip = true;
    req.session.user.vip = user.vip;

    saveData();
    res.send(`<h3 style="color:green;text-align:center">✅ Key hợp lệ! Bạn đã ${key.type === 'VIP' ? 'nâng cấp VIP' : 'kích hoạt thành công'}!</h3><a href="/dashboard" class="btn btn-primary">Về Dashboard</a>`);
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// ------------------- ADMIN -------------------
app.get('/admin/login', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head><meta charset="UTF-8"><title>Admin Login</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet"></head>
    <body class="bg-dark text-white">
    <div class="container mt-5">
        <div class="row justify-content-center">
            <div class="col-md-4">
                <h2 class="text-center mb-4">🛠️ Admin Login</h2>
                <form method="POST" action="/admin/login">
                    <div class="mb-3"><input type="text" name="username" class="form-control" value="admin" required></div>
                    <div class="mb-3"><input type="password" name="password" class="form-control" value="admin123" required></div>
                    <button type="submit" class="btn btn-warning w-100">Đăng nhập Admin</button>
                </form>
            </div>
        </div>
    </div>
    </body></html>`);
});

app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    const user = data.users.find(u => u.username === username && bcrypt.compareSync(password, u.passwordHash));
    if (user && user.role === 'admin') {
        req.session.user = { id: user.id, username: user.username, role: 'admin' };
        res.redirect('/admin/dashboard');
    } else {
        res.send('<h3 style="color:red;text-align:center">Sai tài khoản admin!</h3><a href="/admin/login">Quay lại</a>');
    }
});

app.get('/admin/dashboard', isAdmin, (req, res) => {
    const totalKeys = data.keys.length;
    const activeKeys = data.keys.filter(k => k.status === 'active').length;
    const bannedKeys = data.keys.filter(k => k.status === 'banned').length;
    const topKeys = [...data.keys].sort((a,b) => (b.usageCount||0) - (a.usageCount||0)).slice(0,5);
    const suspicious = data.keys.filter(k => k.usedIPs && k.usedIPs.length >= 3);
    const expiringSoon = data.keys.filter(k => k.status === 'active' && new Date(k.expiresAt) - new Date() < 3*24*60*60*1000);

    let topHTML = topKeys.map(k => `<li class="list-group-item">${k.keyCode} - ${k.usageCount} lần</li>`).join('');
    let susHTML = suspicious.map(k => `<li class="list-group-item text-danger">\( {k.keyCode} ( \){k.usedIPs.length} IP)</li>`).join('');
    let expHTML = expiringSoon.map(k => `<li class="list-group-item">${k.keyCode} - ${new Date(k.expiresAt).toLocaleDateString('vi-VN')}</li>`).join('');

    res.send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head><meta charset="UTF-8"><title>Admin Dashboard</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet"></head>
    <body>
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
        <div class="container"><a class="navbar-brand" href="/admin/dashboard">🛠️ Admin Panel</a>
        <a href="/admin/keys" class="btn btn-light me-2">Quản lý Key</a>
        <a href="/admin/users" class="btn btn-light me-2">Quản lý User</a>
        <a href="/logout" class="btn btn-outline-light">Đăng xuất</a></div>
    </nav>
    <div class="container mt-4">
        <div class="row">
            <div class="col-md-3"><div class="card text-center"><div class="card-body"><h5>Tổng Key</h5><h1>${totalKeys}</h1></div></div></div>
            <div class="col-md-3"><div class="card text-center"><div class="card-body"><h5>Key Active</h5><h1 class="text-success">${activeKeys}</h1></div></div></div>
            <div class="col-md-3"><div class="card text-center"><div class="card-body"><h5>Key Banned</h5><h1 class="text-danger">${bannedKeys}</h1></div></div></div>
            <div class="col-md-3"><div class="card text-center"><div class="card-body"><h5>Users</h5><h1>${data.users.length}</h1></div></div></div>
        </div>

        <h4 class="mt-5">📊 Thống kê nâng cao</h4>
        <div class="row">
            <div class="col-md-4">
                <div class="card"><div class="card-header">🔥 Top Key dùng nhiều</div><ul class="list-group list-group-flush">${topHTML || '<li class="list-group-item">Chưa có dữ liệu</li>'}</ul></div>
            </div>
            <div class="col-md-4">
                <div class="card"><div class="card-header">🧠 Key nghi share</div><ul class="list-group list-group-flush">${susHTML || '<li class="list-group-item">Không có</li>'}</ul></div>
            </div>
            <div class="col-md-4">
                <div class="card"><div class="card-header">⏰ Key sắp hết hạn</div><ul class="list-group list-group-flush">${expHTML || '<li class="list-group-item">Không có</li>'}</ul></div>
            </div>
        </div>
        <a href="/admin/keys" class="btn btn-primary mt-4">Quản lý toàn bộ Key →</a>
    </div>
    </body></html>`);
});

// ADMIN - QUẢN LÝ KEY (có search, export, tất cả chức năng)
app.get('/admin/keys', isAdmin, (req, res) => {
    const { search, status, ip } = req.query;
    let filtered = data.keys;

    if (search) {
        filtered = filtered.filter(k => 
            k.keyCode.toLowerCase().includes(search.toLowerCase())
        );
    }
    if (status) filtered = filtered.filter(k => k.status === status);
    if (ip) filtered = filtered.filter(k => k.usedIPs && k.usedIPs.some(i => i.includes(ip)));

    let rows = filtered.map(k => `
        <tr>
            <td>${k.keyCode}</td>
            <td>${k.type}</td>
            <td><span class="badge bg-\( {k.status==='active'?'success':k.status==='expired'?'warning':'danger'}"> \){k.status}</span></td>
            <td>${k.usedIPs ? k.usedIPs.length : 0}/3</td>
            <td>${k.usageCount || 0}</td>
            <td>${new Date(k.expiresAt).toLocaleDateString('vi-VN')}</td>
            <td>
                <form method="POST" action="/admin/delete-key" style="display:inline">
                    <input type="hidden" name="id" value="${k.id}">
                    <button type="submit" class="btn btn-sm btn-danger">Xóa</button>
                </form>
            </td>
        </tr>`).join('');

    res.send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head><meta charset="UTF-8"><title>Quản lý Key</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet"></head>
    <body>
    <div class="container mt-4">
        <h2>🔑 Quản lý Key</h2>
        <form class="row mb-3">
            <div class="col-md-4"><input type="text" name="search" value="${search||''}" class="form-control" placeholder="Tìm theo key"></div>
            <div class="col-md-3"><select name="status" class="form-select"><option value="">Tất cả trạng thái</option><option value="active">Active</option><option value="expired">Expired</option><option value="banned">Banned</option></select></div>
            <div class="col-md-3"><input type="text" name="ip" value="${ip||''}" class="form-control" placeholder="Tìm theo IP"></div>
            <div class="col-md-2"><button class="btn btn-primary w-100">🔍 Tìm kiếm</button></div>
        </form>

        <table class="table table-hover">
            <thead><tr><th>Key</th><th>Loại</th><th>Trạng thái</th><th>IP</th><th>Lượt dùng</th><th>Hết hạn</th><th>Hành động</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="7" class="text-center">Không có key nào</td></tr>'}</tbody>
        </table>

        <div class="mt-4">
            <a href="/admin/create-key" class="btn btn-success">➕ Tạo Key mới</a>
            <a href="/admin/export/json" class="btn btn-info">📤 Export JSON</a>
            <a href="/admin/export/txt" class="btn btn-warning">📤 Export TXT</a>
        </div>
        <a href="/admin/dashboard" class="btn btn-secondary mt-3">← Về Dashboard</a>
    </div>
    </body></html>`);
});

app.get('/admin/create-key', isAdmin, (req, res) => {
    res.send(`
    <form method="POST" action="/admin/create-key" class="container mt-5">
        <h3>Tạo Key mới</h3>
        <select name="type" class="form-select mb-3"><option value="VIP">VIP</option><option value="NORMAL">NORMAL</option></select>
        <input type="number" name="days" class="form-control mb-3" placeholder="Số ngày hết hạn" value="30" required>
        <button type="submit" class="btn btn-success">Tạo ngay</button>
    </form>`);
});

app.post('/admin/create-key', isAdmin, (req, res) => {
    const { type, days } = req.body;
    const newKey = {
        id: Date.now(),
        keyCode: generateKey(),
        type: type,
        status: 'active',
        expiresAt: new Date(Date.now() + parseInt(days) * 86400000).toISOString(),
        ownerUserId: null,
        usedIPs: [],
        usageCount: 0,
        createdAt: new Date().toISOString(),
        lastUsedAt: null
    };
    data.keys.push(newKey);
    saveData();
    res.send(`<h3>✅ Đã tạo key: <b>${newKey.keyCode}</b></h3><a href="/admin/keys">Quay lại danh sách</a>`);
});

app.post('/admin/delete-key', isAdmin, (req, res) => {
    data.keys = data.keys.filter(k => k.id !== parseInt(req.body.id));
    saveData();
    res.redirect('/admin/keys');
});

// EXPORT
app.get('/admin/export/json', isAdmin, (req, res) => {
    res.setHeader('Content-Disposition', 'attachment; filename=keys.json');
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(data.keys, null, 2));
});

app.get('/admin/export/txt', isAdmin, (req, res) => {
    const txt = data.keys.map(k => `${k.keyCode} | ${k.type} | ${k.status} | ${k.expiresAt}`).join('\n');
    res.setHeader('Content-Disposition', 'attachment; filename=keys.txt');
    res.setHeader('Content-Type', 'text/plain');
    res.send(txt);
});

// ADMIN USERS (xem tất cả user)
app.get('/admin/users', isAdmin, (req, res) => {
    const html = data.users.map(u => `<tr><td>\( {u.username}</td><td> \){u.role}</td><td>${u.vip ? '⭐ VIP' : 'Thường'}</td></tr>`).join('');
    res.send(`<div class="container mt-4"><h2>Danh sách User</h2><table class="table">${html}</table><a href="/admin/dashboard">← Dashboard</a></div>`);
});

// ====================== START SERVER ======================
app.listen(PORT, () => {
    console.log(`🚀 KEY SERVER ĐÃ CHẠY TẠI http://localhost:${PORT}`);
    console.log(`👉 Admin: admin / admin123`);
    console.log(`✅ Đã tích hợp đầy đủ: User account, Anti-share 3 IP, Thống kê, Export, Search nâng cao`);
});
