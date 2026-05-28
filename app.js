const input =
document.getElementById(
"valor"
);

const meta = 5000;

let arrecadado =
Number(
localStorage.getItem(
"arrecadado"
)
)||0;

atualizarBarra();

function atualizarBarra(){

const porcentagem =
(arrecadado/meta)*100;

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

`R$ ${arrecadado.toFixed(2)} arrecadados`;

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
"Digite um valor"
);

return;

}

const btn =
document.getElementById(
"btn"
);

btn.disabled=true;

btn.innerText=
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

<pre style="
text-align:left;
white-space:pre-wrap;
">

${JSON.stringify(
data.erro,
null,
2
)}

</pre>

`;

btn.disabled=false;
btn.innerText="Contribuir ❤️";

return;

}

resultado.innerHTML =

`

<h2>

Escaneie o PIX

</h2>

<img
src="${data.qr}"
style="
width:230px;
border-radius:20px;
"

>

<textarea readonly>

${data.pix}

</textarea>

<br><br>

<button onclick="copiarPix()">
Copiar código PIX
</button>

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
e.message;

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
"PIX copiado!"
);

}
