require('dotenv').config();

const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET ist nicht gesetzt. Server wird aus Sicherheitsgründen nicht gestartet.');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = 10;

// Request Logger
app.use((req, res, next) => {
  console.log(`📥 Eingehender Request: ${req.method} ${req.url}`);
  next();
});

// Middleware (CORS - gleicht URLs flexibel ab und ignoriert Slashes am Ende)
const allowedOrigins = [
  'http://localhost:4200',
  'https://rtgr-schulden.vercel.app',
  'https://rtgr-schulden-oncrsbnms-luismeinhardtwien-2884s-projects.vercel.app' // Deine aus der früheren Konfig falls benötigt
];

app.use(cors({
  origin: function (origin, callback) {
    // Erlaube Requests ohne Origin (z.B. Postman, Server-to-Server)
    if (!origin) return callback(null, true);

    // Normalisiere die Origin (entferne einen eventuellen Slash am Ende)
    const normalizedOrigin = origin.replace(/\/$/, '');

    // Prüfe, ob die Domain in der Allowlist ist oder ein Vercel-Preview-Deployment
    // exakt dieses Projekts ist (NICHT irgendeine beliebige *.vercel.app Domain).
    const isAllowed =
      allowedOrigins.some(allowed => allowed.replace(/\/$/, '') === normalizedOrigin) ||
      /^https:\/\/rtgr-schulden-[a-z0-9-]+-luismeinhardtwien-2884s-projects\.vercel\.app$/.test(normalizedOrigin);

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`❌ CORS Blocked Origin: ${origin}`);
      callback(new Error('CORS policy violation: Origin not allowed'));
    }
  },
  credentials: true
}));

app.use(express.json());

// MySQL Verbindungspool (mit Umgebungsvariablen & SSL für Aiven)
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'schulden_db',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true,
  ssl: {
    rejectUnauthorized: false
  }
});

// Tabellen beim Start sicherstellen
async function initDB() {
  try {
    const connection = await pool.getConnection();

    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        token_version INT NOT NULL DEFAULT 0,
        preferred_currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
        reduce_motion TINYINT(1) NOT NULL DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    for (const column of [
      "ADD COLUMN token_version INT NOT NULL DEFAULT 0",
      "ADD COLUMN preferred_currency VARCHAR(3) NOT NULL DEFAULT 'EUR'",
      "ADD COLUMN reduce_motion TINYINT(1) NOT NULL DEFAULT 0",
      // NULL = aktives Konto. Wird beim Löschen gesetzt statt die Zeile zu
      // entfernen (siehe DELETE /api/profile) - verhindert, dass gemeinsame
      // Rechnungen mit anderen Usern durch ON DELETE CASCADE mitgerissen werden.
      "ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL"
    ]) {
      try {
        await connection.query(`ALTER TABLE users ${column}`);
      } catch (err) {
        if (err.code !== 'ER_DUP_FIELDNAME') throw err;
      }
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        paid_by INT NOT NULL,
        created_by INT NOT NULL,
        date VARCHAR(50) NOT NULL DEFAULT 'Heute',
        category VARCHAR(32) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (paid_by) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    try {
      await connection.query("ALTER TABLE expenses ADD COLUMN category VARCHAR(32) DEFAULT NULL");
    } catch (err) {
      if (err.code !== 'ER_DUP_FIELDNAME') throw err;
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS expense_splits (
        id INT AUTO_INCREMENT PRIMARY KEY,
        expense_id INT NOT NULL,
        creditor_id INT NOT NULL,
        debtor_id INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        is_paid TINYINT(1) DEFAULT 0,
        pending_confirmation TINYINT(1) DEFAULT 0,
        confirmation_initiated_by INT DEFAULT NULL,
        confirmed_at TIMESTAMP NULL DEFAULT NULL,
        FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
        FOREIGN KEY (creditor_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (debtor_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (confirmation_initiated_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    connection.release();
    console.log('✅ Erfolgreich mit der MySQL-Datenbank verbunden & Tabellen überprüft!');
  } catch (err) {
    console.error('❌ Fehler bei der Datenbank-Initialisierung:', err.message);
  }
}

initDB();

// --- KEEP-ALIVE INTERVALL ---
setInterval(() => {
  console.log('🔄 Keep-Alive Ping: Server läuft stabil.');
}, 60 * 60 * 1000);

// --- RATE LIMITING (Brute-Force-Schutz für Login/Registrierung) ---
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Versuche. Bitte später erneut probieren.' }
});

// --- AUTH MIDDLEWARE ---
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Kein Token vorhanden.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const [users] = await pool.query('SELECT token_version FROM users WHERE id = ?', [payload.userId]);
    const tokenVersion = payload.tokenVersion ?? 0;
    if (users.length === 0 || users[0].token_version !== tokenVersion) {
      return res.status(403).json({ error: 'Sitzung nicht mehr gültig.' });
    }
    req.userId = payload.userId;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token ungültig oder abgelaufen.' });
  }
}

function createToken(user) {
  return jwt.sign(
    { userId: user.id, username: user.username, tokenVersion: user.token_version },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// --- AUTH ROUTEN ---

app.post('/api/register', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Benutzername und Passwort erforderlich.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen lang sein.' });
    }

    const [existing] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Benutzername bereits vergeben.' });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    await pool.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);

    res.status(201).json({ message: 'Erfolgreich registriert.' });
  } catch (err) {
    console.error('Registrierungsfehler:', err);
    res.status(500).json({ error: 'Serverfehler bei der Registrierung.' });
  }
});

app.post('/api/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Benutzername und Passwort erforderlich.' });
    }

    const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (users.length === 0) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten.' });
    }

    const user = users[0];
    if (user.deleted_at) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten.' });
    }

    const token = createToken(user);

    res.json({
      token,
      user: { id: user.id, username: user.username }
    });
  } catch (err) {
    console.error('Login-Fehler:', err);
    res.status(500).json({ error: 'Serverfehler beim Login.' });
  }
});

app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    // Gelöschte (anonymisierte) Konten sollen für neue Rechnungen nicht mehr
    // auswählbar sein, tauchen aber weiterhin korrekt in alten Transaktionen auf.
    const [users] = await pool.query('SELECT id, username FROM users WHERE deleted_at IS NULL');
    res.json(users);
  } catch (err) {
    console.error('Fehler beim Laden der Benutzer:', err);
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

// --- PROFILE & ACCOUNT ROUTEN ---

app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, username, preferred_currency AS preferredCurrency, reduce_motion AS reduceMotion FROM users WHERE id = ?',
      [req.userId]
    );
    if (!users.length) return res.status(404).json({ error: 'Profil nicht gefunden.' });
    res.json({ ...users[0], reduceMotion: Boolean(users[0].reduceMotion) });
  } catch (err) {
    res.status(500).json({ error: 'Profil konnte nicht geladen werden.' });
  }
});

app.patch('/api/profile', authenticateToken, async (req, res) => {
  try {
    const { username, preferredCurrency, reduceMotion } = req.body;
    const [current] = await pool.query('SELECT * FROM users WHERE id = ?', [req.userId]);
    if (!current.length) return res.status(404).json({ error: 'Profil nicht gefunden.' });

    const user = current[0];
    const nextUsername = username === undefined ? user.username : String(username).trim();
    const nextCurrency = preferredCurrency === undefined ? user.preferred_currency : preferredCurrency;
    const nextReduceMotion = reduceMotion === undefined ? user.reduce_motion : Boolean(reduceMotion);
    if (!nextUsername) return res.status(400).json({ error: 'Der Name darf nicht leer sein.' });
    if (!['EUR', 'USD', 'CHF', 'GBP'].includes(nextCurrency)) return res.status(400).json({ error: 'Ungültige Währung.' });

    const [sameName] = await pool.query('SELECT id FROM users WHERE username = ? AND id != ?', [nextUsername, req.userId]);
    if (sameName.length) return res.status(400).json({ error: 'Dieser Name ist bereits vergeben.' });

    await pool.query(
      'UPDATE users SET username = ?, preferred_currency = ?, reduce_motion = ? WHERE id = ?',
      [nextUsername, nextCurrency, nextReduceMotion, req.userId]
    );
    const updatedUser = { ...user, username: nextUsername, preferred_currency: nextCurrency, reduce_motion: nextReduceMotion };
    res.json({
      user: { id: user.id, username: nextUsername },
      preferredCurrency: nextCurrency,
      reduceMotion: Boolean(nextReduceMotion),
      token: createToken(updatedUser)
    });
  } catch (err) {
    res.status(500).json({ error: 'Profil konnte nicht gespeichert werden.' });
  }
});

app.post('/api/profile/password', authLimiter, authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Bitte gib das aktuelle und ein neues Passwort mit mindestens 6 Zeichen ein.' });
    }
    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [req.userId]);
    const user = users[0];
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(400).json({ error: 'Das aktuelle Passwort stimmt nicht.' });
    }
    const password = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.query('UPDATE users SET password = ?, token_version = token_version + 1 WHERE id = ?', [password, req.userId]);
    const [updated] = await pool.query('SELECT * FROM users WHERE id = ?', [req.userId]);
    res.json({ message: 'Passwort geändert. Andere Sitzungen wurden abgemeldet.', token: createToken(updated[0]) });
  } catch (err) {
    res.status(500).json({ error: 'Passwort konnte nicht geändert werden.' });
  }
});

app.post('/api/profile/logout-all', authenticateToken, async (req, res) => {
  await pool.query('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [req.userId]);
  res.json({ message: 'Alle Sitzungen wurden abgemeldet.' });
});

app.get('/api/profile/export', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT e.date, e.title, es.amount, es.is_paid AS isPaid, creditor.username AS creditor, debtor.username AS debtor
      FROM expense_splits es
      JOIN expenses e ON es.expense_id = e.id
      JOIN users creditor ON creditor.id = es.creditor_id
      JOIN users debtor ON debtor.id = es.debtor_id
      WHERE es.creditor_id = ? OR es.debtor_id = ? ORDER BY e.id DESC`, [req.userId, req.userId]);
    const esc = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = ['Datum,Titel,Betrag,Bezahlt,Gläubiger,Schuldner', ...rows.map(row =>
      [row.date, row.title, Number(row.amount).toFixed(2), row.isPaid ? 'Ja' : 'Nein', row.creditor, row.debtor].map(esc).join(',')
    )].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="schuldenapp-export.csv"');
    res.send('\uFEFF' + csv);
  } catch (err) {
    res.status(500).json({ error: 'Export konnte nicht erstellt werden.' });
  }
});

app.delete('/api/profile', authenticateToken, async (req, res) => {
  try {
    const { currentPassword } = req.body;
    const [users] = await pool.query('SELECT password FROM users WHERE id = ?', [req.userId]);
    if (!users.length || !(await bcrypt.compare(currentPassword || '', users[0].password))) {
      return res.status(400).json({ error: 'Passwort ist nicht korrekt.' });
    }

    // Anonymisieren statt hart löschen: expenses/expense_splits hängen per
    // ON DELETE CASCADE an users.id, ein echtes DELETE würde also auch alle
    // gemeinsamen Rechnungen der GEGENSEITE mitreißen (z.B. "Bob schuldet
    // Alice 50€" verschwindet ersatzlos, nur weil Alice ihr Konto löscht).
    // Stattdessen: Name/Passwort unkenntlich machen, alle Sitzungen killen,
    // Konto für Login und als Teilnehmer neuer Rechnungen sperren - alte
    // Salden/Transaktionen bleiben für die jeweils andere Seite intakt.
    const anonymizedUsername = `Gelöschtes Konto #${req.userId}-${crypto.randomBytes(3).toString('hex')}`;
    const unusablePassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), SALT_ROUNDS);

    await pool.query(
      `UPDATE users
       SET username = ?, password = ?, token_version = token_version + 1, deleted_at = NOW()
       WHERE id = ?`,
      [anonymizedUsername, unusablePassword, req.userId]
    );

    res.json({ message: 'Konto wurde gelöscht.' });
  } catch (err) {
    console.error('Fehler beim Löschen des Kontos:', err);
    res.status(500).json({ error: 'Konto konnte nicht gelöscht werden.' });
  }
});

// --- TRANSACTIONS & BILLS ROUTEN ---

app.get('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.userId;

    const query = `
      SELECT
        es.id,
        e.title AS reason,
        e.date,
        e.category AS category,
        es.amount,
        es.is_paid AS isPaid,
        es.pending_confirmation AS pendingConfirmation,
        es.confirmation_initiated_by AS confirmationInitiatedBy,
        creditor.id AS creditor_id,
        creditor.username AS creditor_name,
        debtor.id AS debtor_id,
        debtor.username AS debtor_name
      FROM expense_splits es
      JOIN expenses e ON es.expense_id = e.id
      JOIN users creditor ON es.creditor_id = creditor.id
      JOIN users debtor ON es.debtor_id = debtor.id
      WHERE es.creditor_id = ? OR es.debtor_id = ?
      ORDER BY e.id DESC
    `;

    const [rows] = await pool.query(query, [currentUserId, currentUserId]);

    const formattedTransactions = rows.map(row => {
      const isOwedToMe = row.creditor_id === currentUserId;
      const otherPerson = isOwedToMe ? row.debtor_name : row.creditor_name;
      const type = isOwedToMe ? 'owedToMe' : 'iOwe';

      const confirmationInitiatedByMe = row.pendingConfirmation && row.confirmationInitiatedBy === currentUserId;

      return {
        id: String(row.id),
        person: otherPerson,
        reason: row.reason,
        date: row.date || 'Heute',
        category: row.category || null,
        amount: Number(row.amount),
        isPaid: Boolean(row.isPaid),
        type: type,
        pendingConfirmation: Boolean(row.pendingConfirmation),
        confirmationInitiatedByMe: confirmationInitiatedByMe
      };
    });

    res.json(formattedTransactions);
  } catch (err) {
    console.error('Fehler beim Laden der Transaktionen:', err);
    res.status(500).json({ error: 'Serverfehler beim Laden der Transaktionen.' });
  }
});

app.post('/api/bills', authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const currentUserId = req.userId;
    const { title, totalAmount, paidBy, participants, date, category, customSplits } = req.body;

    const totalAmountNum = Number(totalAmount);

    if (!title || !title.trim() || !participants || !Array.isArray(participants) || participants.length === 0) {
      connection.release();
      return res.status(400).json({ error: 'Ungültige Rechnungsdaten.' });
    }

    if (!Number.isFinite(totalAmountNum) || totalAmountNum <= 0) {
      connection.release();
      return res.status(400).json({ error: 'Der Betrag muss eine positive Zahl sein.' });
    }

    const ALLOWED_CATEGORIES = ['food', 'shopping', 'transport', 'home', 'leisure', 'travel', 'other'];
    const normalizedCategory = ALLOWED_CATEGORIES.includes(category) ? category : null;

    let paidById = currentUserId;
    if (paidBy !== 'Ich') {
      const [payerRows] = await connection.query('SELECT id FROM users WHERE username = ?', [paidBy]);
      if (payerRows.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ error: `Benutzer "${paidBy}" wurde nicht gefunden.` });
      }
      paidById = payerRows[0].id;
    }

    const [expenseResult] = await connection.query(
      'INSERT INTO expenses (title, total_amount, paid_by, created_by, date, category) VALUES (?, ?, ?, ?, ?, ?)',
      [title.trim(), totalAmountNum, paidById, currentUserId, date || 'Heute', normalizedCategory]
    );
    const expenseId = expenseResult.insertId;

    const allParticipantUsernames = Array.from(new Set(participants.map(p => p === 'Ich' ? null : p).filter(Boolean)));
    
    const usernameToIdMap = new Map();
    usernameToIdMap.set('Ich', currentUserId);

    if (allParticipantUsernames.length > 0) {
      const [userRows] = await connection.query('SELECT id, username FROM users WHERE username IN (?)', [allParticipantUsernames]);
      for (const u of userRows) {
        usernameToIdMap.set(u.username, u.id);
      }
    }

    const participantIds = [];
    for (const p of participants) {
      const id = p === 'Ich' ? currentUserId : usernameToIdMap.get(p);
      if (!id) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ error: `Teilnehmer "${p}" nicht gefunden.` });
      }
      participantIds.push(id);
    }

    // Duplikate entfernen (z.B. falls derselbe Teilnehmer zweimal ausgewählt wurde),
    // sonst würde dieselbe Person zweimal eine Schuld für dieselbe Rechnung bekommen.
    const uniqueParticipantIds = Array.from(new Set(participantIds));
    const totalCents = Math.round(totalAmountNum * 100);

    if (customSplits && typeof customSplits === 'object' && !Array.isArray(customSplits)) {
      // Benutzerdefinierte Aufteilung (exakte Beträge oder vom Frontend
      // bereits aus Prozenten in € umgerechnet). Summe muss exakt dem
      // Gesamtbetrag entsprechen (1 Cent Toleranz für Rundung).
      const centsById = new Map();
      let sumCents = 0;

      for (const p of participants) {
        const id = p === 'Ich' ? currentUserId : usernameToIdMap.get(p);
        const rawAmount = Number(customSplits[p]);
        if (!Number.isFinite(rawAmount) || rawAmount < 0) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({ error: `Ungültiger Betrag für "${p}".` });
        }
        const cents = Math.round(rawAmount * 100);
        centsById.set(id, (centsById.get(id) || 0) + cents);
        sumCents += cents;
      }

      if (Math.abs(sumCents - totalCents) > 1) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ error: 'Die Aufteilung ergibt nicht den Gesamtbetrag.' });
      }

      for (const debtorId of uniqueParticipantIds) {
        if (debtorId === paidById) continue;
        const cents = centsById.get(debtorId) || 0;
        if (cents <= 0) continue;

        await connection.query(
          'INSERT INTO expense_splits (expense_id, creditor_id, debtor_id, amount) VALUES (?, ?, ?, ?)',
          [expenseId, paidById, debtorId, cents / 100]
        );
      }
    } else {
      // Gleich-Aufteilung: Cent-basiert statt Fließkomma-Division, damit die
      // Summe aller Anteile exakt totalAmount ergibt (kein Rundungsverlust
      // wie z.B. bei 100 / 3 = 33.33 + 33.33 + 33.33 = 99.99). Der Rest-Cent
      // wird auf die ersten Teilnehmer verteilt.
      const participantCount = uniqueParticipantIds.length;
      const baseCents = Math.floor(totalCents / participantCount);
      const remainderCents = totalCents - baseCents * participantCount;

      for (let i = 0; i < uniqueParticipantIds.length; i++) {
        const debtorId = uniqueParticipantIds[i];
        if (debtorId === paidById) {
          continue;
        }

        const shareCents = baseCents + (i < remainderCents ? 1 : 0);
        const shareAmount = shareCents / 100;

        await connection.query(
          'INSERT INTO expense_splits (expense_id, creditor_id, debtor_id, amount) VALUES (?, ?, ?, ?)',
          [expenseId, paidById, debtorId, shareAmount]
        );
      }
    }

    await connection.commit();
    connection.release();

    res.status(201).json({ message: 'Rechnung erfolgreich erstellt und aufgeteilt.', expenseId });
  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error('Fehler beim Erstellen der Rechnung:', err);
    res.status(500).json({ error: 'Serverfehler beim Erstellen der Rechnung.' });
  }
});

app.patch('/api/transactions/:id/settlement', authenticateToken, async (req, res) => {
  try {
    const splitId = req.params.id;
    const { action } = req.body; 
    const currentUserId = req.userId;

    const [splits] = await pool.query('SELECT * FROM expense_splits WHERE id = ?', [splitId]);
    if (splits.length === 0) {
      return res.status(404).json({ error: 'Transaktion nicht gefunden.' });
    }

    const split = splits[0];
    const isCreditor = split.creditor_id === currentUserId;
    const isDebtor = split.debtor_id === currentUserId;

    if (!isCreditor && !isDebtor) {
      return res.status(403).json({ error: 'Keine Berechtigung für diese Transaktion.' });
    }

    if (action === 'request') {
      await pool.query(
        'UPDATE expense_splits SET pending_confirmation = 1, confirmation_initiated_by = ? WHERE id = ?',
        [currentUserId, splitId]
      );
    } 
    else if (action === 'confirm') {
      if (!split.pending_confirmation) {
        return res.status(400).json({ error: 'Keine offene Bestätigungsanfrage vorhanden.' });
      }
      if (split.confirmation_initiated_by === currentUserId) {
        return res.status(400).json({ error: 'Man kann seine eigene Anfrage nicht selbst bestätigen.' });
      }

      await pool.query(
        'UPDATE expense_splits SET is_paid = 1, pending_confirmation = 0, confirmation_initiated_by = NULL, confirmed_at = NOW() WHERE id = ?',
        [splitId]
      );
    }
    else if (action === 'cancel') {
      if (!split.pending_confirmation || split.confirmation_initiated_by !== currentUserId) {
        return res.status(400).json({ error: 'Keine eigene Anfrage zum Zurückziehen vorhanden.' });
      }

      await pool.query(
        'UPDATE expense_splits SET pending_confirmation = 0, confirmation_initiated_by = NULL WHERE id = ?',
        [splitId]
      );
    }
    else if (action === 'reopen') {
      if (!split.is_paid) {
        return res.status(400).json({ error: 'Transaktion ist nicht als bezahlt markiert.' });
      }

      await pool.query(
        'UPDATE expense_splits SET is_paid = 0, pending_confirmation = 0, confirmation_initiated_by = NULL, confirmed_at = NULL WHERE id = ?',
        [splitId]
      );
    }
    else {
      return res.status(400).json({ error: 'Ungültige Aktion.' });
    }

    res.json({ message: 'Settlement erfolgreich aktualisiert.' });
  } catch (err) {
    console.error('Fehler beim Settlement:', err);
    res.status(500).json({ error: 'Serverfehler beim Aktualisieren des Status.' });
  }
});

app.delete('/api/transactions/:id', authenticateToken, async (req, res) => {
  try {
    const splitId = req.params.id;
    const currentUserId = req.userId;

    const [splits] = await pool.query('SELECT * FROM expense_splits WHERE id = ?', [splitId]);
    if (splits.length === 0) {
      return res.status(404).json({ error: 'Transaktion nicht gefunden.' });
    }

    const split = splits[0];
    if (split.creditor_id !== currentUserId && split.debtor_id !== currentUserId) {
      return res.status(403).json({ error: 'Keine Berechtigung zum Löschen.' });
    }

    await pool.query('DELETE FROM expense_splits WHERE id = ?', [splitId]);
    res.json({ message: 'Transaktion erfolgreich gelöscht.' });
  } catch (err) {
    console.error('Fehler beim Löschen:', err);
    res.status(500).json({ error: 'Serverfehler beim Löschen.' });
  }
});

app.get('/api/friends', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.userId;

    // Bewusst OHNE deleted_at-Filter: ein gelöschtes Konto kann noch einen
    // offenen Saldo haben (siehe Anonymisierung statt Hard-Delete weiter
    // unten) - der muss hier sichtbar bleiben, sonst "verschwindet" eine
    // offene Schuld/Forderung nur weil die Gegenseite ihr Konto gelöscht hat.
    const [users] = await pool.query('SELECT id, username FROM users WHERE id != ?', [currentUserId]);
    const [splits] = await pool.query(`
      SELECT creditor_id, debtor_id, amount, is_paid 
      FROM expense_splits 
      WHERE creditor_id = ? OR debtor_id = ?
    `, [currentUserId, currentUserId]);

    const friendsList = users.map(user => {
      let balance = 0;

      splits.forEach(split => {
        const amount = Number(split.amount);
        if (!split.is_paid) {
          if (split.creditor_id === currentUserId && split.debtor_id === user.id) {
            balance += amount; 
          } else if (split.debtor_id === currentUserId && split.creditor_id === user.id) {
            balance -= amount; 
          }
        }
      });

      return {
        id: String(user.id),
        name: user.username,
        balance: Number(balance.toFixed(2))
      };
    });

    res.json(friendsList);
  } catch (err) {
    console.error('Fehler beim Laden der Freunde:', err);
    res.status(500).json({ error: 'Serverfehler beim Laden der Freunde.' });
  }
});

app.get('/api/friends/statistics', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.userId;

    const [splits] = await pool.query(`
      SELECT creditor_id, debtor_id, amount, is_paid 
      FROM expense_splits 
      WHERE creditor_id = ? OR debtor_id = ?
    `, [currentUserId, currentUserId]);

    let totalSpent = 0;    
    let totalReceived = 0;  
    const activeFriendsSet = new Set();

    splits.forEach(split => {
      const amount = Number(split.amount);
      if (!split.is_paid) {
        if (split.creditor_id === currentUserId) {
          totalReceived += amount;
          activeFriendsSet.add(split.debtor_id);
        } else if (split.debtor_id === currentUserId) {
          totalSpent += amount;
          activeFriendsSet.add(split.creditor_id);
        }
      }
    });

    res.json({
      totalSpent: Number(totalSpent.toFixed(2)),
      totalReceived: Number(totalReceived.toFixed(2)),
      activeFriendsCount: activeFriendsSet.size
    });
  } catch (err) {
    console.error('Fehler beim Laden der Statistiken:', err);
    res.status(500).json({ error: 'Serverfehler beim Laden der Statistiken.' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server läuft auf http://localhost:${PORT}`);
});
