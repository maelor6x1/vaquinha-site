const input =
document.getElementById(
"valor"
);

const meta = 30000;

let arrecadado =
Number(
localStorage.getItem(
"arrecadado"
)
)||437,82;

atualizarBarra();

function atualizarBarra(){

const porcentagem =
Math.min(
(arrecadado/meta)*100,
100
);

document
.getElementById(
"bar"
)
.style.width =
porcentagem+"%";

document
.getElementById(
"valorMeta"
)
.innerText =

`R$ ${arrecadado.toLocaleString(
"pt-BR",
{
minimumFractionDigits:2
}
)} arrecadados`;

}

function setValor(v){

document
.getElementById(
"valor"
)
.value =

v.toLocaleString(
"pt-BR",
{
minimumFractionDigits:2
}
);

}

input.addEventListener(
"input",
(e)=>{

let v =
e.target.value
.replace(/\D/g,"");

v =
(v/100)
.toLocaleString(
"pt-BR",
{
minimumFractionDigits:2
}
);

e.target.value =
v==="0,00"
?""
:v;

}
);

async function doar(){

const valor =
input.value;

if(!valor){

alert(
"Digite um valor para contribuir ❤️"
);

return;

}

const btn =
document.getElementById(
"btn"
);

btn.disabled = true;

btn.innerText =
"Gerando PIX...";

const resultado =
document.getElementById(
"resultado"
);

try{

const r =
await fetch(
"/api/pagar",
{

method:"POST",

headers:{
"Content-Type":
"application/json"
},

body:
JSON.stringify({

valor

})

}

);

const data =
await r.json();

if(data.erro){

resultado.innerHTML =

`

<div style="
background:#ffe5e5;
padding:15px;
border-radius:15px;
color:#b00020;
">

Erro ao gerar PIX

<br><br>

<small>

${JSON.stringify(
data.erro,
null,
2
)}

</small>

</div>

`;

btn.disabled=false;
btn.innerText="Contribuir ❤️";

return;

}

resultado.innerHTML =

`

<div style="
background:white;
padding:20px;
border-radius:25px;
box-shadow:0 5px 15px rgba(0,0,0,.05);
">

<h2>
🎉 Obrigado pelo apoio!
</h2>

<p style="
margin:10px 0 20px;
color:#666;
">
Escaneie o QR Code ou copie o PIX abaixo.
</p>

<img
src="${data.qr}"
style="
width:240px;
border-radius:20px;
margin-bottom:15px;
"
/>

<textarea readonly>

${data.pix}

</textarea>

<br><br>

<button onclick="copiarPix()">
📋 Copiar código PIX
</button>

</div>

`;

window.pixCode =
data.pix;

arrecadado +=
parseFloat(
valor
.replace(".","")
.replace(",",".")
);

localStorage.setItem(
"arrecadado",
arrecadado
);

atualizarBarra();

}
catch(e){

resultado.innerHTML =

`

<div style="
background:#ffe5e5;
padding:15px;
border-radius:15px;
color:#b00020;
">

${e.message}

</div>

`;

}

btn.disabled=false;
btn.innerText="Contribuir ❤️";

}

function copiarPix(){

navigator
.clipboard
.writeText(
window.pixCode
);

alert(
"✅ Código PIX copiado!"
);

}
