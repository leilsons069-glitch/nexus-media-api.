
const express = require("express");
const { Pool } = require("pg");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "6mb" }));

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

  const senhaEnviada = Buffer.from(
    autorizacao.slice(7),
    "utf8"
  );

  const correta = Buffer.from(senhaCorreta, "utf8");

  if (
    senhaEnviada.length !== correta.length ||
    !crypto.timingSafeEqual(senhaEnviada, correta)
  ) {
    return res.status(401).json({
      erro: "Senha incorreta."
    });
  }

  next();
}

// SITE PÚBLICO
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public.html"));
});

// PAINEL ADMINISTRATIVO
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

// VERIFICAR ADMINISTRADOR
app.get("/api/admin/verificar", protegerAdmin, (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ autenticado: true });
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

// CRIAR E ATUALIZAR ESTRUTURA DO BANCO
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

  // Adiciona a coluna sem apagar os conteúdos antigos.
  await pool.query(`
    ALTER TABLE catalogo
    ADD COLUMN IF NOT EXISTS temporadas JSONB
    NOT NULL DEFAULT '[]'::jsonb
  `);
}

// VALIDAR DADOS
function validarConteudo(dados) {
  const { titulo, categoria, ano } = dados;

  const categorias = ["filme", "serie", "anime"];

  if (!titulo || !String(titulo).trim()) {
    return "Informe o título.";
  }

  if (!categorias.includes(categoria)) {
    return "Categoria inválida.";
  }

  if (
    ano !== null &&
    ano !== undefined &&
    ano !== "" &&
    (!Number.isInteger(Number(ano)) ||
      Number(ano) < 1888 ||
      Number(ano) > 2200)
  ) {
    return "Ano inválido.";
  }

  if (
    dados.temporadas !== undefined &&
    !Array.isArray(dados.temporadas)
  ) {
    return "Temporadas devem ser uma lista.";
  }

  return null;
}

// LISTAR CATÁLOGO
app.get("/api/catalogo", async (req, res) => {
  try {
    const resultado = await pool.query(
      "SELECT * FROM catalogo ORDER BY id DESC"
    );

    res.json(resultado.rows);
  } catch (error) {
    console.error(error);

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
    console.error(error);

    res.status(500).json({
      erro: "Erro ao consultar conteúdo."
    });
  }
});

// CADASTRAR CONTEÚDO
app.post("/api/catalogo", protegerAdmin, async (req, res) => {
  try {
    const erro = validarConteudo(req.body);

    if (erro) {
      return res.status(400).json({ erro });
    }

    const {
      titulo,
      categoria,
      ano,
      descricao,
      capa,
      temporadas
    } = req.body;

    const resultado = await pool.query(
      `INSERT INTO catalogo
       (titulo, categoria, ano, descricao, capa, temporadas)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        String(titulo).trim(),
        categoria,
        ano ? Number(ano) : null,
        descricao || "",
        capa || "",
        JSON.stringify(temporadas || [])
      ]
    );

    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      erro: "Erro ao cadastrar conteúdo."
    });
  }
});

// EDITAR CONTEÚDO
app.put("/api/catalogo/:id", protegerAdmin, async (req, res) => {
  try {
    const erro = validarConteudo(req.body);

    if (erro) {
      return res.status(400).json({ erro });
    }

    const {
      titulo,
      categoria,
      ano,
      descricao,
      capa,
      temporadas
    } = req.body;

    const resultado = await pool.query(
      `UPDATE catalogo
       SET titulo = $1,
           categoria = $2,
           ano = $3,
           descricao = $4,
           capa = $5,
           temporadas = $6
       WHERE id = $7
       RETURNING *`,
      [
        String(titulo).trim(),
        categoria,
        ano ? Number(ano) : null,
        descricao || "",
        capa || "",
        JSON.stringify(temporadas || []),
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
    console.error(error);

    res.status(500).json({
      erro: "Erro ao editar conteúdo."
    });
  }
});

// EXCLUIR CONTEÚDO
app.delete("/api/catalogo/:id", protegerAdmin, async (req, res) => {
  try {
    const resultado = await pool.query(
      "DELETE FROM catalogo WHERE id = $1 RETURNING id",
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
    console.error(error);

    res.status(500).json({
      erro: "Erro ao excluir conteúdo."
    });
  }
});

// INICIAR SERVIDOR
iniciarBanco()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(
        "NEXUS MEDIA API iniciado na porta " + PORT
      );
    });
  })
  .catch(error => {
    console.error(
      "Erro ao iniciar servidor:",
      error.message
    );

    process.exit(1);
  });
               
