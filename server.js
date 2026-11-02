
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NEXUS MEDIA - Administração</title>

<style>
*{box-sizing:border-box}
body{
  margin:0;
  padding:20px;
  background:#0b1020;
  color:#fff;
  font-family:Arial,sans-serif;
}
.container{max-width:900px;margin:auto}
h1{color:#7c8cff;text-align:center}
h2{color:#aab5ff}
.card{
  background:#151d32;
  padding:20px;
  border-radius:14px;
  margin:18px 0;
}
input,select,textarea,button{
  width:100%;
  padding:13px;
  margin:7px 0;
  border:0;
  border-radius:8px;
  font-size:15px;
}
input,select,textarea{
  background:#25304b;
  color:white;
}
button{
  background:#5865f2;
  color:white;
  font-weight:bold;
  cursor:pointer;
}
button.danger{background:#d93650}
button.secondary{background:#394765}
.hidden{display:none!important}
.item{
  background:#202b45;
  padding:14px;
  border-radius:10px;
  margin:10px 0;
}
.item strong{color:#aab5ff}
.item button{width:auto;margin-right:5px}
.msg{color:#ff9c9c;min-height:20px}
small{color:#aeb9d1}
</style>
</head>

<body>
<div class="container">

<h1>NEXUS MEDIA</h1>
<p style="text-align:center">Painel administrativo</p>

<!-- LOGIN -->
<div class="card" id="login">
  <h2>Entrar no painel</h2>
  <input
    type="password"
    id="token"
    placeholder="Senha de administrador"
    autocomplete="current-password"
  >
  <button id="btnEntrar" onclick="entrar()">ENTRAR</button>
  <p class="msg" id="loginMsg"></p>
</div>

<!-- PAINEL -->
<div id="painel" class="hidden">

  <div class="card">
    <h2>Adicionar conteúdo</h2>

    <input id="titulo" placeholder="Título do conteúdo">

    <select id="categoria">
      <option value="filme">Filme</option>
      <option value="serie">Série</option>
      <option value="anime">Anime</option>
    </select>

    <input id="ano" type="number" placeholder="Ano de lançamento">

    <input id="capa" placeholder="URL da imagem da capa">

    <textarea id="descricao" rows="4"
      placeholder="Descrição do conteúdo"></textarea>

    <button onclick="salvar()">SALVAR CONTEÚDO</button>
    <button class="secondary hidden" id="cancelar"
      onclick="cancelarEdicao()">CANCELAR EDIÇÃO</button>

    <p class="msg" id="formMsg"></p>
  </div>

  <div class="card">
    <h2>Catálogo</h2>
    <input id="pesquisa" placeholder="Pesquisar conteúdo..."
      oninput="filtrar()">
    <button class="secondary" onclick="carregar()">ATUALIZAR LISTA</button>
    <div id="lista"></div>
  </div>

  <button class="danger" onclick="sair()">SAIR DO PAINEL</button>
</div>

</div>

<script>
"use strict";

let token = "";
let catalogo = [];
let editandoId = null;

const $ = id => document.getElementById(id);

async function requisicao(url, opcoes = {}) {
  const cabecalhos = {
    ...(opcoes.headers || {}),
    "Authorization": "Bearer " + token
  };

  if (opcoes.body) {
    cabecalhos["Content-Type"] = "application/json";
  }

  return fetch(url, {
    ...opcoes,
    headers: cabecalhos
  });
}

async function entrar() {
  const valor = $("token").value.trim();
  const msg = $("loginMsg");
  const botao = $("btnEntrar");

  if (!valor) {
    msg.textContent = "Digite sua senha.";
    return;
  }

  botao.disabled = true;
  msg.textContent = "Verificando acesso...";

  try {
    const resposta = await fetch("/api/admin/verificar", {
      method: "GET",
      headers: {
        "Authorization": "Bearer " + valor
      },
      cache: "no-store"
    });

    if (!resposta.ok) {
      msg.textContent =
        resposta.status === 401
          ? "Senha incorreta."
          : "Não foi possível verificar o acesso.";

      return;
    }

    const dados = await resposta.json();

    if (dados.autenticado !== true) {
      msg.textContent = "Resposta de autenticação inválida.";
      return;
    }

    token = valor;

    $("login").classList.add("hidden");
    $("painel").classList.remove("hidden");

    msg.textContent = "";
    await carregar();

  } catch (erro) {
    msg.textContent = "Erro ao conectar ao servidor.";
  } finally {
    botao.disabled = false;
  }
}

function sair() {
  token = "";
  catalogo = [];
  editandoId = null;

  $("token").value = "";
  $("login").classList.remove("hidden");
  $("painel").classList.add("hidden");
  $("lista").innerHTML = "";
}

async function carregar() {
  $("lista").innerHTML = "Carregando catálogo...";

  try {
    const resposta = await requisicao("/api/catalogo");

    if (resposta.status === 401) {
      alert("Sua autorização expirou. Entre novamente.");
      sair();
      return;
    }

    if (!resposta.ok) {
      $("lista").textContent = "Erro ao carregar catálogo.";
      return;
    }

    const dados = await resposta.json();

    catalogo = Array.isArray(dados) ? dados : [];
    filtrar();

  } catch (erro) {
    $("lista").textContent = "Não foi possível conectar ao servidor.";
  }
}

function filtrar() {
  const termo = $("pesquisa").value.toLowerCase();

  const encontrados = catalogo.filter(item =>
    String(item.titulo || "").toLowerCase().includes(termo)
  );

  mostrar(encontrados);
}

function mostrar(itens) {
  const lista = $("lista");
  lista.innerHTML = "";

  if (!itens.length) {
    lista.textContent = "Nenhum conteúdo encontrado.";
    return;
  }

  itens.forEach(item => {
    const div = document.createElement("div");
    div.className = "item";

    const titulo = document.createElement("strong");
    titulo.textContent = item.titulo || "Sem título";

    const info = document.createElement("p");
    info.textContent =
      (item.categoria || "") + " • " + (item.ano || "");

    const editar = document.createElement("button");
    editar.textContent = "EDITAR";
    editar.onclick = () => editarItem(item);

    const excluir = document.createElement("button");
    excluir.textContent = "EXCLUIR";
    excluir.className = "danger";
    excluir.onclick = () => excluirItem(item.id);

    div.append(titulo, info, editar, excluir);
    lista.appendChild(div);
  });
}

function limparFormulario() {
  $("titulo").value = "";
  $("categoria").value = "filme";
  $("ano").value = "";
  $("capa").value = "";
  $("descricao").value = "";
}

function editarItem(item) {
  editandoId = item.id;

  $("titulo").value = item.titulo || "";
  $("categoria").value = item.categoria || "filme";
  $("ano").value = item.ano || "";
  $("capa").value = item.capa || "";
  $("descricao").value = item.descricao || "";

  $("cancelar").classList.remove("hidden");
  $("formMsg").textContent = "Editando conteúdo.";
  window.scrollTo({top: 0, behavior: "smooth"});
}

function cancelarEdicao() {
  editandoId = null;
  limparFormulario();
  $("cancelar").classList.add("hidden");
  $("formMsg").textContent = "";
}

async function salvar() {
  const titulo = $("titulo").value.trim();

  if (!titulo) {
    $("formMsg").textContent = "Informe o título.";
    return;
  }

  const conteudo = {
    titulo,
    categoria: $("categoria").value,
    ano: $("ano").value ? Number($("ano").value) : null,
    capa: $("capa").value.trim(),
    descricao: $("descricao").value.trim()
  };

  const editando = editandoId !== null;

  try {
    const resposta = await requisicao(
      editando
        ? "/api/catalogo/" + encodeURIComponent(editandoId)
        : "/api/catalogo",
      {
        method: editando ? "PUT" : "POST",
        body: JSON.stringify(conteudo)
      }
    );

    if (resposta.status === 401) {
      alert("Acesso não autorizado.");
      sair();
      return;
    }

    if (!resposta.ok) {
      $("formMsg").textContent = "Erro ao salvar conteúdo.";
      return;
    }

    $("formMsg").textContent = "Conteúdo salvo com sucesso!";
    cancelarEdicao();
    await carregar();

  } catch (erro) {
    $("formMsg").textContent = "Erro de conexão.";
  }
}

async function excluirItem(id) {
  if (!confirm("Deseja realmente excluir este conteúdo?")) {
    return;
  }

  try {
    const resposta = await requisicao(
      "/api/catalogo/" + encodeURIComponent(id),
      { method: "DELETE" }
    );

    if (resposta.status === 401) {
      alert("Acesso não autorizado.");
      sair();
      return;
    }

    if (!resposta.ok) {
      alert("Não foi possível excluir.");
      return;
    }

    await carregar();

  } catch (erro) {
    alert("Erro de conexão.");
  }
}
</script>

</body>
</html>
