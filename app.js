async function doar(){

const valor =
document
.getElementById(
"valor"
)
.value;

const msg =
document
.getElementById(
"msg"
);

if(
!valor
||
Number(valor)<=0
){

alert(
"Digite um valor"
);

return;

}

msg.innerHTML =
"Gerando PIX...";

try{

const r =
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
await r.json();

if(
data.erro
){

msg.innerHTML =

`

<pre>

${JSON.stringify(
data,
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

PIX Gerado

</h2>

<img

src="${data.qr}"

style="
width:220px;
border-radius:16px;
"

>

<br><br>

<textarea

style="
width:100%;
height:120px;
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
