async function doar(){

const valor=
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

const r=
await fetch(
"pagar",
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

const data=
await r.json();

window.location=
data.url;

}
