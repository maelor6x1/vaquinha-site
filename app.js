async function doar(){

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

const msg =
document
.getElementById(
"msg"
);

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

msg.innerHTML =

`

<img

src="${data.qr}"

style="
width:220px;
"

>

<br><br>

<textarea

style="
width:100%;
height:90px;
">

${data.pix}

</textarea>

`;

}
catch(e){

msg.innerHTML =
e.message;

}

}
