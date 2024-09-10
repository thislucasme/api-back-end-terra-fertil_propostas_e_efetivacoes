  const express = require('express');
  const sqlite3 = require('sqlite3').verbose();
  const bodyParser = require('body-parser');
  const cors = require('cors');
  const bcrypt = require('bcrypt');
  const saltRounds = 10;

  const app = express();
  const port = 3000;

  // Configurar o middleware
  app.use(cors());
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  // Conectar ao banco de dados SQLite
  const db = new sqlite3.Database('data.db', (err) => {
    if (err) {
      console.error('Erro ao conectar ao banco de dados', err);
    } else {
      console.log('Conectado ao banco de dados SQLite');
    }
  });

  // Criar as tabelas se não existirem
  db.serialize(() => {
    // Tabela de propostas
    db.run(`
      CREATE TABLE IF NOT EXISTS propostas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT,
        phone1 TEXT,
        phone2 TEXT,
        operationCode TEXT,
        operationCodeComplement TEXT,
        productionGroup TEXT,
        paymentMethod TEXT,
        installments TEXT,
        contractType TEXT,
        insuranceType TEXT,
        analystId INTEGER,
        creationDate TEXT,  -- Nova coluna para a data de criação
        FOREIGN KEY (analystId) REFERENCES analistas(id)
      )
    `, (err) => {
      if (err) {
        console.error('Erro ao criar tabela de propostas', err);
      } else {
        console.log('Tabela de propostas criada ou já existe');
      }
    });

    // Tabela de analistas
    db.run(`
      CREATE TABLE IF NOT EXISTS analistas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT,
        usuario TEXT UNIQUE,
        senha TEXT
      )
    `, (err) => {
      if (err) {
        console.error('Erro ao criar tabela de analistas', err);
      } else {
        console.log('Tabela de analistas criada ou já existe');
      }
    });
  });

  // Rota para adicionar uma nova proposta
  app.post('/api/propostas', (req, res) => {
    const {
      name,
      email,
      phone1,
      phone2,
      operationCode,
      operationCodeComplement,
      productionGroup,
      paymentMethod,
      installments,
      contractType,
      insuranceType,
      analystId
    } = req.body;

    // Captura a data atual e formata como YYYY-MM-DD
    const creationDate = new Date().toISOString().split('T')[0];

    const stmt = db.prepare(`
      INSERT INTO propostas (name, email, phone1, phone2, operationCode, operationCodeComplement, productionGroup, paymentMethod, installments, contractType, insuranceType, analystId, creationDate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(name, email, phone1, phone2, operationCode, operationCodeComplement, productionGroup, paymentMethod, installments, contractType, insuranceType, analystId, creationDate, function(err) {
      if (err) {
        console.error('Erro ao inserir proposta', err);
        res.status(500).json({ error: 'Erro ao inserir proposta' });
      } else {
        console.log(`Proposta adicionada com ID ${this.lastID}`);
        res.status(201).json({ id: this.lastID });
      }
    });

    stmt.finalize();
  });

// Rota para obter propostas por intervalo de datas
app.get('/api/propostas', (req, res) => {
  const { startDate, endDate } = req.query;

  // Validação básica das datas
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Parâmetros startDate e endDate são obrigatórios' });
  }

  // Formato esperado: YYYY-MM-DD
  const start = new Date(startDate).toISOString().split('T')[0];
  const end = new Date(endDate).toISOString().split('T')[0];

  db.all(
    `SELECT p.id, p.name, p.email, p.phone1, p.phone2, p.operationCode, p.operationCodeComplement, 
            p.productionGroup, p.paymentMethod, p.installments, p.contractType, p.insuranceType, 
            a.nome AS analystName, p.creationDate
     FROM propostas p
     JOIN analistas a ON p.analystId = a.id
     WHERE DATE(p.creationDate) >= DATE(?) AND DATE(p.creationDate) <= DATE(?)`,
    [start, end],
    (err, rows) => {
      if (err) {
        console.error('Erro ao obter propostas por intervalo de datas', err);
        res.status(500).json({ error: 'Erro ao obter propostas' });
      } else {
        console.log(`Propostas entre ${start} e ${end} retornadas`);
        res.json(rows);
      }
    }
  );
});

  // Rota para obter uma proposta por ID
  app.get('/api/propostas/:id', (req, res) => {
    const id = req.params.id;
    db.get('SELECT * FROM propostas WHERE id = ?', [id], (err, row) => {
      if (err) {
        console.error('Erro ao obter proposta', err);
        res.status(500).json({ error: 'Erro ao obter proposta' });
      } else if (row) {
        console.log(`Dados da proposta com ID ${id} retornados`);
        res.json(row);
      } else {
        console.log(`Proposta com ID ${id} não encontrada`);
        res.status(404).json({ error: 'Proposta não encontrada' });
      }
    });
  });

  // Rota para atualizar uma proposta
  app.put('/api/propostas/:id', (req, res) => {
    const id = req.params.id;
    const {
      name,
      email,
      phone1,
      phone2,
      operationCode,
      operationCodeComplement,
      productionGroup,
      paymentMethod,
      installments,
      contractType,
      insuranceType
    } = req.body;

    const stmt = db.prepare(`
      UPDATE propostas
      SET name = ?, email = ?, phone1 = ?, phone2 = ?, operationCode = ?, operationCodeComplement = ?, productionGroup = ?, paymentMethod = ?, installments = ?, contractType = ?, insuranceType = ?
      WHERE id = ?
    `);

    stmt.run(name, email, phone1, phone2, operationCode, operationCodeComplement, productionGroup, paymentMethod, installments, contractType, insuranceType, id, function(err) {
      if (err) {
        console.error('Erro ao atualizar proposta', err);
        res.status(500).json({ error: 'Erro ao atualizar proposta' });
      } else if (this.changes > 0) {
        console.log(`Proposta com ID ${id} atualizada`);
        res.status(200).json({ changes: this.changes });
      } else {
        console.log(`Proposta com ID ${id} não encontrada para atualização`);
        res.status(404).json({ error: 'Proposta não encontrada' });
      }
    });

    stmt.finalize();
  });

  // Rota para deletar uma proposta
  app.delete('/api/propostas/:id', (req, res) => {
    const id = req.params.id;

    db.run('DELETE FROM propostas WHERE id = ?', [id], function(err) {
      if (err) {
        console.error('Erro ao deletar proposta', err);
        res.status(500).json({ error: 'Erro ao deletar proposta' });
      } else if (this.changes > 0) {
        console.log(`Proposta com ID ${id} deletada`);
        res.status(200).json({ changes: this.changes });
      } else {
        console.log(`Proposta com ID ${id} não encontrada para deleção`);
        res.status(404).json({ error: 'Proposta não encontrada' });
      }
    });
  });

  // Rota para adicionar um novo analista
  app.post('/api/analistas', (req, res) => {
    const { nome, usuario, senha } = req.body;

    bcrypt.hash(senha, saltRounds, (err, hashedPassword) => {
      if (err) {
        console.error('Erro ao hash da senha', err);
        return res.status(500).json({ error: 'Erro ao criar analista' });
      }

      const stmt = db.prepare(`
        INSERT INTO analistas (nome, usuario, senha)
        VALUES (?, ?, ?)
      `);

      stmt.run(nome, usuario, hashedPassword, function(err) {
        if (err) {
          console.error('Erro ao inserir analista', err);
          res.status(500).json({ error: 'Erro ao criar analista' });
        } else {
          console.log(`Analista adicionado com ID ${this.lastID}`);
          res.status(201).json({ id: this.lastID });
        }
      });

      stmt.finalize();
    });
  });

  // Rota de login
  app.post('/api/login', (req, res) => {
    const { usuario, senha } = req.body;

    db.get('SELECT * FROM analistas WHERE usuario = ?', [usuario], (err, row) => {
      if (err) {
        console.error('Erro ao buscar analista', err);
        return res.status(500).json({ error: 'Erro ao fazer login' });
      }

      if (row) {
        bcrypt.compare(senha, row.senha, (err, result) => {
          if (err) {
            console.error('Erro ao comparar senha', err);
            return res.status(500).json({ error: 'Erro ao fazer login' });
          }

          if (result) {
            res.status(200).json({ message: 'Login bem-sucedido', id: row.id });
          } else {
            res.status(401).json({ error: 'Credenciais inválidas' });
          }
        });
      } else {
        res.status(401).json({ error: 'Credenciais inválidas' });
      }
    });
  });

  // Iniciar o servidor
  app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
  });
