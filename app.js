async function doar(){

try{

const valor=
Number(
document
.getElementById(
"valor"
).value
);

alert("Criando pagamento");

const r=
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

const data=
await r.json();

alert(
JSON.stringify(data)
);

window.location=
data.url;

}
catch(e){

alert(
e.message
);

}

}
