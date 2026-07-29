const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-bitte-in-produktion-aendern';
const SALT_ROUNDS = 10;

// Request Logger
app.use((req, res, next) => {
  console.log(`📥 Eingehender Request: ${req.method} ${req.url}`);
  next();
});

// Middleware (CORS für Vercel & lokal)
const allowedOrigins = [
  'http://localhost:4200', // Zum lokalen Testen
  'https://rtgr-schulden.vercel.app' // Deine echte Vercel-URL
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
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
    rejectUnauthorized: false // Erforderlich für externe Cloud-DBs wie Aiven
  }
});

// Tabellen beim Start sicherstellen (Variante A)
async function initDB() {
  try {
    const connection = await pool.getConnection();

    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        paid_by INT NOT NULL,
        created_by INT NOT NULL,
        date VARCHAR(50) NOT NULL DEFAULT 'Heute',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (paid_by) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

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

// --- KEEP-ALIVE INTERVALL (Jede Stunde ein Log, damit der Prozess aktiv bleibt) ---
setInterval(() => {
  console.log('🔄 Keep-Alive Ping: Server läuft stabil.');
}, 60 * 60 * 1000); // 1 Stunde in Millisekunden

// --- AUTH MIDDLEWARE ---
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Kein Token vorhanden.' });
  }

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(403).json({ error: 'Ungültiges oder abgelaufenes Token.' });
    }
    req.userId = payload.userId;
    next();
  });
}

// --- AUTH ROUTEN ---

app.post('/api/register', async (req, res) => {
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

app.post('/api/login', async (req, res) => {
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
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten.' });
    }

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

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
    const [users] = await pool.query('SELECT id, username FROM users');
    res.json(users);
  } catch (err) {
    console.error('Fehler beim Laden der Benutzer:', err);
    res.status(500).json({ error: 'Serverfehler.' });
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
    const { title, totalAmount, paidBy, participants, date } = req.body;

    if (!title || !totalAmount || !participants || !Array.isArray(participants) || participants.length === 0) {
      await connection.release();
      return res.status(400).json({ error: 'Ungültige Rechnungsdaten.' });
    }

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
      'INSERT INTO expenses (title, total_amount, paid_by, created_by, date) VALUES (?, ?, ?, ?, ?)',
      [title, totalAmount, paidById, currentUserId, date || 'Heute']
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

    const sharePerPerson = Number((totalAmount / participantIds.length).toFixed(2));

    for (const debtorId of participantIds) {
      if (debtorId === paidById) {
        continue;
      }

      await connection.query(
        'INSERT INTO expense_splits (expense_id, creditor_id, debtor_id, amount) VALUES (?, ?, ?, ?)',
        [expenseId, paidById, debtorId, sharePerPerson]
      );
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