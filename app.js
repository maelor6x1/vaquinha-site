async function doar(){

const valor =
document
.getElementById(
"valor"
)
.value;

if(
!valor
||
Number(valor)<=0
){

alert(
"Digite um valor válido"
);

return;

}

const msg =
document
.getElementById(
"msg"
);

msg.innerHTML =
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

msg.innerHTML =

`

<p>

Erro:

</p>

<pre>

${JSON.stringify(
data.erro,
null,
2
)}

</pre>

`;

return;

}

msg.innerHTML =

`

<h2>

PIX:

</h2>

<img

src="data:image/png;base64,${data.qr}"

style="
width:230px;
border-radius:16px;
"

>

<br><br>

<textarea

style="
width:100%;
height:110px;
"

readonly

>

${data.pix}

</textarea>

`;

}
catch(e){

msg.innerHTML =
e.message;

}

}
