let meta = 5000;

let arrecadado =
Number(
localStorage.getItem(
"valor"
)
) || 0;

function atualizar(){

let porcentagem =
(arrecadado/meta)*100;

document
.getElementById(
"bar"
)
.style.width =
porcentagem+"%";

document
.getElementById(
"info"
)
.innerHTML =
`R$ ${arrecadado} / R$ ${meta}`;

}

async function doar(){

try{

const valor =
Number(
document
.getElementById(
"valor"
)
.value
);

if(
!valor
||
valor<=0
){

alert(
"Digite um valor"
);

return;

}

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
!data.qr
){

alert(
JSON.stringify(
data,
null,
2
)
);

return;

}

document
.getElementById(
"msg"
)
.innerHTML =

`

<h2>

PIX:

</h2>

<img

src="data:image/png;base64,${data.qr}"

style="

width:220px;

border-radius:20px;

">

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

alert(
e.message
);

}

}

atualizar();
