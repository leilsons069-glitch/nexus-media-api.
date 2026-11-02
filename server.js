
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NEXUS MEDIA - Admin</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#090d18;color:#fff;font-family:Arial,sans-serif}
header{padding:22px;background:#111a2b;border-bottom:1px solid #26344c}
header h1{margin:0;color:#55d6ff;letter-spacing:2px}
header p{color:#9aabc4}
main{max-width:950px;margin:25px auto;padding:15px}
.card{background:#121c2e;border:1px solid #263852;border-radius:15px;padding:20px;margin-bottom:18px}
h2{margin-top:0;color:#55d6ff}
input,textarea,select{width:100%;padding:13px;margin:7px 0 13px;background:#091322;color:white;border:1px solid #344763;border-radius:8px;font-size:15px}
textarea{min-height:90px}
button{padding:12px 17px;border:0;border-radius:8px;background:#16a9d5;color:white;font-weight:bold;margin:4px}
.danger{background:#d83d52}
.secondary{background:#344763}
.hidden{display:none}
.item{display:flex;gap:14px;align-items:center;border-bottom:1px solid #293950;padding:13px 0}
.item img{width:65px;height:90px;object-fit:cover;border-radius:7px}
.item-info{flex:1;min-width:0}
.item-info strong{display:block;overflow-wrap:anywhere}
.item-info small{color:#9aabc4}
.actions{display:flex;flex-wrap:wrap}
#mensagem{padding:10px;color:#55d6ff}
@media(max-width:550px){.item{align-items:flex-start}.actions button{padding:9px;font-size:12px}}
</style>
</head>
<body>
<header>
<h1>NEXUS MEDIA</h1>
<p>Painel de gerenciamento de conteúdo</p>
</header>
<main>
<div class="card" id="login">
<h2>🔐 Acesso administrativo</h2>
<p>Digite sua senha de administrador.</p>
<input type="password" id="token" placeholder="Senha de administrador">
<button onclick="entrar()">Entrar no painel</button>
<div id="loginMsg"></div>
</div>

<div id="painel" class="hidden">
<div class="card">
<h2 id="formTitulo">＋ Adicionar conteúdo</h2>
<input type="hidden" id="id">
<label>Título</label>
<input id="titulo" placeholder="Nome do filme, série ou anime">
<label>Categoria</label>
<select id="categoria">
<option value="filme">Filme</option>
<option value="serie">Série</option>
<option value="anime">Anime</option>
</select>
<label>Ano</label>
<input id="ano" type="number" placeholder="2026">
<label>Endereço da imagem da capa</label>
<input id="capa" type="url" placeholder="https://site.com/capa.jpg">
<label>Descrição</label>
<textarea id="descricao" placeholder="Descrição do conteúdo..."></textarea>
<button onclick="salvar()">Salvar conteúdo</button>
<button class="secondary" onclick="limpar()">Limpar</button>
</div>
<div class="card">
<h2>🎬 Catálogo</h2>
<input id="busca" placeholder="Buscar conteúdo..." oninput="carregar()">
<select id="filtro" onchange="carregar()">
<option value="">Todas as categorias</option>
<option value="filme">Filmes</option>
<option value="serie">Séries</option>
<option value="anime">Animes</option>
</select>
<div id="lista">Carregando catálogo...</div>
</div>
<button class="danger" onclick="sair()">Sair do painel</button>
</div>
<div id="mensagem"></div>
</main>

<script>
let token="";

function mensagem(texto){
 document.getElementById("mensagem").textContent=texto;
}

async function requisicao(url,opcoes={}){
 opcoes.headers={
  ...(opcoes.headers||{}),
  "Authorization":"Bearer "+token
 };
 return fetch(url,opcoes);
}

async function entrar(){
 const valor=document.getElementById("token").value.trim();
 const msg=document.getElementById("loginMsg");

 if(!valor){
  msg.textContent="Digite sua senha.";
  return;
 }

 token=valor;
 msg.textContent="Verificando acesso...";

 try{
  const resposta=await requisicao("/api/admin/verificar");

  if(!resposta.ok){
   token="";
   msg.textContent=resposta.status===401
    ?"Senha incorreta."
    :"Erro ao verificar acesso. Tente novamente.";
   return;
  }

  document.getElementById("login").classList.add("hidden");
  document.getElementById("painel").classList.remove("hidden");
  msg.textContent="";
  carregar();
 }catch(error){
  token="";
  msg.textContent="Não foi possível conectar ao servidor.";
 }
}

function sair(){
 token="";
 document.getElementById("painel").classList.add("hidden");
 document.getElementById("login").classList.remove("hidden");
 document.getElementById("token").value="";
}

async function carregar(){
 try{
  const busca=document.getElementById("busca").value;
  const categoria=document.getElementById("filtro").value;
  const params=new URLSearchParams();
  if(busca)params.set("busca",busca);
  if(categoria)params.set("categoria",categoria);

  const resposta=await fetch("/api/catalogo?"+params.toString());
  if(!resposta.ok)throw new Error("Erro ao carregar catálogo.");

  const dados=await resposta.json();
  mostrarLista(dados.resultados||[]);
 }catch(error){
  mensagem(error.message);
 }
}

function mostrarLista(itens){
 const lista=document.getElementById("lista");
 lista.innerHTML="";

 if(!itens.length){
  lista.textContent="Nenhum conteúdo encontrado.";
  return;
 }

 itens.forEach(item=>{
  const div=document.createElement("div");
  div.className="item";

  const img=document.createElement("img");
  img.src=item.capa||"";
  img.alt="Capa";
  img.onerror=()=>img.style.display="none";

  const info=document.createElement("div");
  info.className="item-info";

  const titulo=document.createElement("strong");
  titulo.textContent=item.titulo;

  const detalhe=document.createElement("small");
  detalhe.textContent=item.categoria+" • "+(item.ano||"Ano não informado");

  info.append(titulo,detalhe);

  const acoes=document.createElement("div");
  acoes.className="actions";

  const editar=document.createElement("button");
  editar.className="secondary";
  editar.textContent="Editar";
  editar.onclick=()=>editarItem(item);

  const excluir=document.createElement("button");
  excluir.className="danger";
  excluir.textContent="Excluir";
  excluir.onclick=()=>excluirItem(item.id);

  acoes.append(editar,excluir);
  div.append(img,info,acoes);
  lista.append(div);
 });
}

async function salvar(){
 const id=document.getElementById("id").value;
 const titulo=document.getElementById("titulo").value.trim();
 const categoria=document.getElementById("categoria").value;
 const ano=document.getElementById("ano").value;
 const capa=document.getElementById("capa").value.trim();
 const descricao=document.getElementById("descricao").value.trim();

 if(!titulo){
  mensagem("Digite o título.");
  return;
 }

 const dados={
  titulo,categoria,
  ano:ano?Number(ano):null,
  capa,descricao
 };

 try{
  const resposta=await requisicao(
   id?"/api/catalogo/"+id:"/api/catalogo",
   {
    method:id?"PUT":"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(dados)
   }
  );

  if(!resposta.ok){
   const erro=await resposta.json();
   throw new Error(erro.erro||"Erro ao salvar.");
  }

  mensagem("Conteúdo salvo com sucesso!");
  limpar();
  carregar();
 }catch(error){
  mensagem(error.message);
 }
}

function editarItem(item){
 document.getElementById("id").value=item.id;
 document.getElementById("titulo").value=item.titulo||"";
 document.getElementById("categoria").value=item.categoria||"filme";
 document.getElementById("ano").value=item.ano||"";
 document.getElementById("capa").value=item.capa||"";
 document.getElementById("descricao").value=item.descricao||"";
 document.getElementById("formTitulo").textContent="✏️ Editar conteúdo";
 window.scrollTo({top:0,behavior:"smooth"});
}

async function excluirItem(id){
 if(!confirm("Deseja realmente excluir este conteúdo?"))return;

 try{
  const resposta=await requisicao("/api/catalogo/"+id,{method:"DELETE"});
  if(!resposta.ok){
   const erro=await resposta.json();
   throw new Error(erro.erro||"Erro ao excluir.");
  }
  mensagem("Conteúdo excluído.");
  carregar();
 }catch(error){
  mensagem(error.message);
 }
}

function limpar(){
 ["id","titulo","ano","capa","descricao"].forEach(id=>{
  document.getElementById(id).value="";
 });
 document.getElementById("formTitulo").textContent="＋ Adicionar conteúdo";
}
</script>
</body>
</html>
