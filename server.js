
const express = require("express");
const { Pool } = require("pg");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL
    ? { rejectUnauthorized: false }
    : false
});

// AUTENTICAÇÃO DO ADMINISTRADOR
function protegerAdmin(req, res, next) {
  const senhaCorreta = process.env.ADMIN_TOKEN;
  const autorizacao = req.headers.authorization || "";

  if (!senhaCorreta) {
    return res.status(503).json({
      erro: "ADMIN_TOKEN não configurado."
    });
  }

  if (!autorizacao.startsWith("Bearer ")) {
    return res.status(401).json({
      erro: "Acesso não autorizado."
    });
  }

  const senhaEnviada = autorizacao.slice(7);

  const enviada = Buffer.from(senhaEnviada, "utf8");
  const correta = Buffer.from(senhaCorreta, "utf8");

  if (
    enviada.length !== correta.length ||
    !crypto.timingSafeEqual(enviada, correta)
  ) {
    return res.status(401).json({
      erro: "Senha incorreta."
    });
  }

  next();
}

// PÁGINA INICIAL
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

// VERIFICAÇÃO DO ADMIN
app.get("/api/admin/verificar", protegerAdmin, (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({
    autenticado: true
  });
});

// SAÚDE DO SERVIDOR
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      status: "online",
      banco: "conectado"
    });
  } catch (error) {
    res.status(500).json({
      status: "erro",
      banco: "desconectado"
    });
  }
});

// CRIAR TABELA
async function iniciarBanco() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS catalogo (
      id SERIAL PRIMARY KEY,
      titulo VARCHAR(255) NOT NULL,
      categoria VARCHAR(50) NOT NULL,
      ano INTEGER,
      descricao TEXT,
      capa TEXT,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// LISTAR CATÁLOGO
app.get("/api/catalogo", async (req, res) => {
  try {
    const resultado = await pool.query(
      "SELECT * FROM catalogo ORDER BY id DESC"
    );

    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao consultar catálogo."
    });
  }
});

// CONSULTAR POR ID
app.get("/api/catalogo/:id", async (req, res) => {
  try {
    const resultado = await pool.query(
      "SELECT * FROM catalogo WHERE id = $1",
      [req.params.id]
    );

    if (!resultado.rows.length) {
      return res.status(404).json({
        erro: "Conteúdo não encontrado."
      });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao consultar conteúdo."
    });
  }
});

// CADASTRAR
app.post("/api/catalogo", protegerAdmin, async (req, res) => {
  try {
    const { titulo, categoria, ano, descricao, capa } = req.body;

    if (!titulo || !categoria) {
      return res.status(400).json({
        erro: "Título e categoria são obrigatórios."
      });
    }

    const resultado = await pool.query(
      `INSERT INTO catalogo
       (titulo, categoria, ano, descricao, capa)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        titulo,
        categoria,
        ano || null,
        descricao || "",
        capa || ""
      ]
    );

    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao cadastrar."
    });
  }
});

// EDITAR
app.put("/api/catalogo/:id", protegerAdmin, async (req, res) => {
  try {
    const { titulo, categoria, ano, descricao, capa } = req.body;

    if (!titulo || !categoria) {
      return res.status(400).json({
        erro: "Título e categoria são obrigatórios."
      });
    }

    const resultado = await pool.query(
      `UPDATE catalogo
       SET titulo=$1, categoria=$2, ano=$3,
           descricao=$4, capa=$5
       WHERE id=$6 RETURNING *`,
      [
        titulo,
        categoria,
        ano || null,
        descricao || "",
        capa || "",
        req.params.id
      ]
    );

    if (!resultado.rows.length) {
      return res.status(404).json({
        erro: "Conteúdo não encontrado."
      });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao editar."
    });
  }
});

// EXCLUIR
app.delete("/api/catalogo/:id", protegerAdmin, async (req, res) => {
  try {
    const resultado = await pool.query(
      "DELETE FROM catalogo WHERE id=$1 RETURNING id",
      [req.params.id]
    );

    if (!resultado.rows.length) {
      return res.status(404).json({
        erro: "Conteúdo não encontrado."
      });
    }

    res.json({
      mensagem: "Conteúdo excluído."
    });
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao excluir."
    });
  }
});

// INICIAR SERVIDOR
iniciarBanco()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log("NEXUS MEDIA iniciado na porta " + PORT);
    });
  })
  .catch(error => {
    console.error("Erro ao iniciar:", error.message);
    process.exit(1);
  });
