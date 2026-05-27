let meta=5000;

let arrecadado=0;

function atualizar(){

let porcentagem=
(arrecadado/meta)*100;

document
.getElementById(
"bar"
)
.style.width=
porcentagem+"%";

document
.getElementById(
"info"
)
.innerHTML=
`R$ ${
arrecadado
}
 / R$ ${
meta
}`;

localStorage
.setItem(
"valor",
arrecadado
);

}

function doar(){

let valor=
Number(
document
.getElementById(
"valor"
)
.value
);

if(
valor<=0
){

alert(
"Digite um valor"
);

return;

}

arrecadado+=valor;

atualizar();

document
.getElementById(
"msg"
)
.innerHTML=
"❤️ Obrigado pela contribuição";

document
.getElementById(
"valor"
)
.value="";

}

arrecadado=
Number(
localStorage
.getItem(
"valor"
)
)||0;

atualizar();
