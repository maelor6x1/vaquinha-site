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

msg.innerHTML =
"Consultando API...";

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

<pre
style="
text-align:left;
white-space:pre-wrap;
">

${JSON.stringify(
data,
null,
2
)}

</pre>

`;

}
catch(e){

msg.innerHTML =
e.message;

}

}
