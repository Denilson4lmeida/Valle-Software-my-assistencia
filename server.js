const express = require('express');
const path = require('path');
const session = require('express-session');
const mysql = require('mysql2');
const multer = require('multer');
const bcrypt = require('bcrypt');
const fs = require('fs');

const app = express();
const PORT = 3000;

require('dotenv').config();



// Criar conexão com o banco
const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
});

// Conectar ao banco de dados
connection.connect((err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados:', err);
    } else {
        console.log('Conectado ao banco de dados MySQL.');
    }
});

// Configuração de sessão
app.use(session({
    secret: '14112024',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }  // Para produção, considere usar `secure: true` com HTTPS
}));

// Middleware para servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Rota raiz: redireciona sempre para o login
app.get('/', (req, res) => {
    res.redirect('/index.html'); // Redireciona diretamente para o index (login)
});

// Rota para a página de login (index.html)
app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html')); // Serve a página de login
});

// Rota para a página de painel (painel.html) - Redirecionamento após login bem-sucedido
app.get('/painel.html', (req, res) => {
    if (!req.session.authenticated) {
        return res.redirect('/index.html'); // Se não estiver autenticado, vai para o login
    }
    res.sendFile(path.join(__dirname, 'public', 'painel.html')); // Serve a página do painel
});

// Rota para consultar serviços
app.get('/consultar', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'consultar.html'));
});

// Configuração do Multer
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Configuração do multer para salvar as imagens
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // Pasta onde as imagens serão salvas
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)); // Nome do arquivo
    }
});

const upload = multer({ storage: storage });

// Rota para salvar serviço com duas imagens
app.post('/salvar-servico', upload.fields([
    { name: 'imagem1', maxCount: 1 },
    { name: 'imagem2', maxCount: 1 }
]), (req, res) => {
    console.log(req.body, req.files);

    const { nome, computador, telefone, endereco, problema, codigo_acompanhamento, status, tecnico, observacoes } = req.body;

    // Obtém os nomes dos arquivos de imagem
    const imagem1 = req.files['imagem1'] ? req.files['imagem1'][0].filename : null;
    const imagem2 = req.files['imagem2'] ? req.files['imagem2'][0].filename : null;

    // Verifica campos obrigatórios
    if (!nome || !computador || !telefone || !endereco || !problema || !codigo_acompanhamento) {
        return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos.' });
    }

    // Define valores padrão para status e atendente
    const statusFinal = status || 'pendente'; // Valor padrão para status
    const tecnicoFinal = tecnico || null; // Valor padrão para atendente

    // Query SQL corrigida para incluir imagem1 e imagem2
    const query = `
        INSERT INTO bancada (
            codigo_acompanhamento, nome_cliente, computador, telefone, endereco, 
            problema, status, atendente, observacoes, imagem1, imagem2
        ) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Executa a query
    connection.query(query, [
        codigo_acompanhamento, nome, computador, telefone, endereco, problema,
        statusFinal, tecnicoFinal, observacoes || null, imagem1, imagem2
    ], (err, result) => {
        if (err) {
         //   return res.status(500).json({ error: 'Erro ao salvar o serviço.', details: err.message });
        }
        res.status(201).json({ message: 'Serviço salvo com sucesso!' });

    });
});

app.get('/servicos', (req, res) => {
    const { codigo_acompanhamento, nome } = req.query;
    
    let query = `
        SELECT 
            nome_cliente AS nome, 
            computador, 
            problema, 
            status, 
            data_prevista, 
            valor_estimado, 
            pecas_utilizadas, 
            TO_BASE64(imagem1) AS imagem_antes, 
            TO_BASE64(imagem2) AS imagem_depois
        FROM bancada 
        WHERE codigo_acompanhamento = ? AND nome_cliente = ?`;

    connection.query(query, [codigo_acompanhamento, nome], (error, results) => {
        if (error) {
            console.error("Erro ao buscar serviço:", error);
            res.status(500).json({ error: "Erro ao buscar serviço." });
        } else {
            res.json(results);
        }
    });
});

app.get('/servico', (req, res) => {
    // Query para buscar todos os serviços com os campos necessários
    const query = `
        SELECT 
            nome_cliente AS nome, 
            computador, 
            problema, 
            status, 
            data_prevista, 
            atendente, 
            observacoes
        FROM bancada`;

    // Executa a query no banco de dados
    connection.query(query, (error, results) => {
        if (error) {
            console.error("Erro ao buscar serviços:", error);
            return res.status(500).json({ error: "Erro ao buscar serviços." });
        }

        // Retorna os resultados em formato JSON
        res.json(results);
    });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // 1. Busca o usuário no banco de dados
    const query = `SELECT * FROM empresa WHERE atendente_nome = ?`;
    connection.query(query, [username], async (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Erro ao autenticar o usuário.', details: err.message });
        }

        if (results.length > 0) {
            const user = results[0]; // Obtém o primeiro resultado
            const hashedPassword = user.atendente_senha; // Senha criptografada no banco de dados

            // 2. Compara a senha fornecida com a senha criptografada
            const isPasswordValid = await bcrypt.compare(password, hashedPassword);
            if (isPasswordValid) {
                // 3. Autenticação bem-sucedida
                req.session.authenticated = true; // Define a sessão como autenticada
                req.session.username = username; // Armazena o nome do usuário na sessão
                return res.json({ message: 'Login bem-sucedido!', redirect: '/painel.html' });
            } else {
                // 4. Senha incorreta
                return res.status(401).json({ error: 'Nome de usuário ou senha incorretos.' });
            }
        } else {
            // 5. Usuário não encontrado
            return res.status(401).json({ error: 'Nome de usuário ou senha incorretos.' });
        }
    });
});


// Iniciar o servidor
app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));
