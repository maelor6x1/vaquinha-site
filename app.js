async function contribuir(){

const valor =
document
.getElementById(
"valor"
)
.value;

if(
!valor
){

alert(
"Digite um valor"
);

return;

}

const botao =
document
.getElementById(
"btn"
);

botao.disabled =
true;

botao.innerText =
"Gerando PIX...";

try{

const resposta =
await fetch(
"/api/pagar",
{

method:
"POST",

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
await resposta.json();

if(
data.erro
){

alert(
JSON.stringify(
data.erro
)
);

botao.disabled =
false;

botao.innerText =
"Contribuir ❤️";

return;

}

document
.getElementById(
"resultado"
)
.innerHTML =

`

<h2>

Pague via PIX

</h2>

<img
src="data:image/png;base64,${data.qr}"
style="
width:220px;
border-radius:20px;
">

<br><br>

<textarea
readonly
style="
width:100%;
height:120px;
">

${data.pix}

</textarea>

`;

}
catch(e){

alert(
e.message
);

}

botao.disabled =
false;

botao.innerText =
"Contribuir ❤️";

}
