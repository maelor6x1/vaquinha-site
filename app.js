let meta=5000;
let arrecadado=500;

function atualizar(){

let p=(arrecadado/meta)*100;

document.getElementById(
"bar"
).style.width=p+"%";

document.getElementById(
"info"
).innerText=
`R$ ${arrecadado} de R$ ${meta}`;

}

function doar(){

let valor=
Number(
document.getElementById(
"valor"
).value
);

if(!valor)return;

arrecadado+=valor;

atualizar();

alert(
"Obrigado pela contribuição ❤️"
);

}

atualizar();