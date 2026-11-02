
const express = require("express");
const { Pool } = require("pg");

const app = express();
app.use(express.json({ limit: "5mb" }));

const PORT = process.env.PORT || 3000;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL não configurada");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function iniciarBanco() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS catalogo (
      id SERIAL PRIMARY KEY,
      titulo TEXT NOT NULL,
      categoria TEXT NOT NULL,
      ano INTEGER,
      descricao TEXT,
      capa TEXT,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function protegerAdmin(req, res, next) {
  const token = process.env.ADMIN_TOKEN;

  if (!token) {
    return res.status(503).json({
      erro: "ADMIN_TOKEN ainda não configurado"
    });
  }

  if (req.headers.authorization !== `Bearer ${token}`) {
    return res.status(401).json({
      erro: "Acesso não autorizado"
    });
  }

  next();
}

app.get("/", (req, res) => {
  res.json({
    nome: "NEXUS MEDIA API",
    status: "online",
    banco: "PostgreSQL"
  });
});

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "online", banco: "conectado" });
  } catch (error) {
    res.status(500).json({ status: "erro no banco" });
  }
});

app.get("/api/catalogo", async (req, res) => {
  try {
    let sql = "SELECT * FROM catalogo";
    const valores = [];
    const filtros = [];

    if (req.query.categoria) {
      valores.push(req.query.categoria.toLowerCase());
      filtros.push(`categoria = $${valores.length}`);
    }

    if (req.query.busca) {
      valores.push(`%${req.query.busca}%`);
      filtros.push(`titulo ILIKE $${valores.length}`);
    }

    if (filtros.length) {
      sql += " WHERE " + filtros.join(" AND ");
    }

    sql += " ORDER BY criado_em DESC";

    const resultado = await pool.query(sql, valores);

    res.json({
      total: resultado.rows.length,
      resultados: resultado.rows
    });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao consultar catálogo" });
  }
});

app.get("/api/catalogo/:id", async (req, res) => {
  try {
    const resultado = await pool.query(
      "SELECT * FROM catalogo WHERE id = $1",
      [req.params.id]
    );

    if (!resultado.rows.length) {
      return res.status(404).json({
        erro: "Conteúdo não encontrado"
      });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ erro: "Erro ao buscar conteúdo" });
  }
});

app.post("/api/catalogo", protegerAdmin, async (req, res) => {
  try {
    const { titulo, categoria, ano, descricao, capa } = req.body;

    if (!titulo || !categoria) {
      return res.status(400).json({
        erro: "Título e categoria são obrigatórios"
      });
    }

    const categorias = ["filme", "serie", "anime"];

    if (!categorias.includes(categoria.toLowerCase())) {
      return res.status(400).json({
        erro: "Categoria inválida"
      });
    }

    const resultado = await pool.query(
      `INSERT INTO catalogo
       (titulo, categoria, ano, descricao, capa)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [titulo, categoria.toLowerCase(), ano || null,
       descricao || null, capa || null]
    );

    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ erro: "Erro ao cadastrar conteúdo" });
  }
});

app.put("/api/catalogo/:id", protegerAdmin, async (req, res) => {
  try {
    const { titulo, categoria, ano, descricao, capa } = req.body;

    const resultado = await pool.query(
      `UPDATE catalogo
       SET titulo = COALESCE($1, titulo),
           categoria = COALESCE($2, categoria),
           ano = COALESCE($3, ano),
           descricao = COALESCE($4, descricao),
           capa = COALESCE($5, capa)
       WHERE id = $6
       RETURNING *`,
      [titulo, categoria, ano, descricao, capa, req.params.id]
    );

    if (!resultado.rows.length) {
      return res.status(404).json({
        erro: "Conteúdo não encontrado"
      });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ erro: "Erro ao editar conteúdo" });
  }
});

app.delete("/api/catalogo/:id", protegerAdmin, async (req, res) => {
  try {
    const resultado = await pool.query(
      "DELETE FROM catalogo WHERE id = $1 RETURNING *",
      [req.params.id]
    );

    if (!resultado.rows.length) {
      return res.status(404).json({
        erro: "Conteúdo não encontrado"
      });
    }

    res.json({ mensagem: "Conteúdo excluído" });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao excluir conteúdo" });
  }
});

iniciarBanco()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log("NEXUS MEDIA API funcionando!");
    });
  })
  .catch(error => {
    console.error("Erro ao iniciar banco:", error);
    process.exit(1);
  });
