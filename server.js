
const express = require("express");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;

const catalogo = [
  {
    id: 1,
    titulo: "Filme de exemplo",
    categoria: "filme",
    ano: 2026,
    descricao: "Filme de demonstração"
  },
  {
    id: 2,
    titulo: "Série de exemplo",
    categoria: "serie",
    ano: 2026,
    descricao: "Série de demonstração"
  },
  {
    id: 3,
    titulo: "Anime de exemplo",
    categoria: "anime",
    ano: 2026,
    descricao: "Anime de demonstração"
  }
];

app.get("/", (req, res) => {
  res.json({
    nome: "NEXUS MEDIA API",
    status: "online",
    versao: "1.0.0"
  });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "online" });
});

app.get("/api/catalogo", (req, res) => {
  let resultado = [...catalogo];

  if (req.query.categoria) {
    resultado = resultado.filter(item =>
      item.categoria === req.query.categoria.toLowerCase()
    );
  }

  if (req.query.busca) {
    resultado = resultado.filter(item =>
      item.titulo.toLowerCase().includes(
        req.query.busca.toLowerCase()
      )
    );
  }

  res.json({
    total: resultado.length,
    resultados: resultado
  });
});

app.get("/api/catalogo/:id", (req, res) => {
  const item = catalogo.find(
    item => item.id === Number(req.params.id)
  );

  if (!item) {
    return res.status(404).json({
      erro: "Conteúdo não encontrado"
    });
  }

  res.json(item);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("NEXUS MEDIA API funcionando!");
});
