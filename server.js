const express = require('express');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const mysql = require('mysql2');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Configuração do banco de dados
const db = mysql.createConnection({
    host: 'localhost',
    user: 'denny', // Substitua pelo seu usuário do banco de dados
    password: '123456789', // Substitua pela sua senha do banco de dados
    database: 'darcksoftware' // Substitua pelo nome do seu banco de dados
});

// Conectar ao banco de dados
db.connect((err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados:', err);
    } else {
        console.log('Conectado ao banco de dados MySQL.');
    }
});

// Configuração de sessão
app.use(session({
    secret: '14112024', // Chave secreta para criptografar a sessão
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Defina como true se estiver usando HTTPS
}));

// Inicializar Passport
app.use(passport.initialize());
app.use(passport.session());

// Estratégia de autenticação local
passport.use(new LocalStrategy(
    (username, password, done) => {
        db.query('SELECT * FROM atendentes WHERE nome = ?', [username], (err, results) => {
            if (err) return done(err);
            if (results.length === 0) return done(null, false, { message: 'Usuário não encontrado.' });

            const user = results[0];
            if (user.senha !== password) { // Aqui você deve usar bcrypt para comparar senhas em um cenário real
                return done(null, false, { message: 'Senha incorreta.' });
            }

            return done(null, user);
        });
    }
));

// Serializar e desserializar o usuário
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    db.query('SELECT * FROM atendentes WHERE id = ?', [id], (err, results) => {
        if (err) return done(err);
        done(null, results[0]);
    });
});

// Middleware para verificar autenticação
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login'); // Redireciona para a página de login se não estiver autenticado
}

// Rota raiz (redireciona para o login)
app.get('/', (req, res) => {
    res.redirect('/login'); // Redireciona para a página de login
});

// Rota de login
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', passport.authenticate('local', {
    successRedirect: '/index', // Redireciona para o painel index.html após o login
    failureRedirect: '/login', // Redireciona de volta para o login em caso de falha
    failureFlash: true // Habilita mensagens de erro
}));

// Rota de logout
app.get('/logout', (req, res) => {
    req.logout();
    res.redirect('/login');
});

// Rota para o painel index.html (apenas para atendentes autenticados)
app.get('/index', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota para o painel consultar.html (acesso livre para clientes)
app.get('/consultar', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'consultar.html'));
});

// Middleware para processar dados do formulário
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

// Verificar e criar o diretório de uploads
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Configuração do multer para salvar o arquivo no servidor
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir); // Diretório onde a imagem será salva
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname); // Nome do arquivo
    }
});

const upload = multer({ storage: storage });

app.post('/salvar-servico', upload.single('imagem'), (req, res) => {
    console.log(req.body);  // Dados do formulário
    console.log(req.file);  // Dados do arquivo enviado

    const { nome, computador, telefone, endereco, problema, codigo_acompanhamento, status, tecnico, observacoes } = req.body;
    const imagem = req.file ? req.file.filename : null; // Nome do arquivo salvo

    if (!nome || !computador || !telefone || !endereco || !problema || !codigo_acompanhamento) {
        console.log('Erro: algum campo não foi preenchido.');
        return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos.' });
    }

    const query = `
        INSERT INTO externo (
            codigo_acompanhamento, nome, computador, telefone, endereco, problema, 
            status, tecnico, observacoes, imagem
        ) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(query, [
        codigo_acompanhamento, nome, computador, telefone, endereco, problema,
        status || 'Em andamento',
        tecnico || null,
        observacoes || null,
        imagem || null
    ], (err, result) => {
        if (err) {
            console.error('Erro ao salvar no banco de dados:', err);
            return res.status(500).json({ error: 'Erro ao salvar o serviço.', details: err.message });
        }
        console.log('Serviço salvo com sucesso:', result);
        res.status(201).json({ message: 'Serviço salvo com sucesso!', id: result.insertId });
    });
});

// Rota para buscar os serviços
app.get('/servicos', (req, res) => {
    const { codigo_acompanhamento, nome } = req.query;
    let query = `
        SELECT nome, computador, problema, status, data_prevista, valor_estimado, pecas_utilizadas, imagem
        FROM externo
        WHERE 1=1
    `;

    const params = [];

    if (codigo_acompanhamento) {
        query += ` AND codigo_acompanhamento = ?`;
        params.push(codigo_acompanhamento);
    }

    if (nome) {
        query += ` AND nome LIKE ?`;
        params.push(`%${nome}%`);
    }

    db.query(query, params, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Erro ao consultar o banco de dados' });
        }
        res.json(results);
    });
});

// Iniciar o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});