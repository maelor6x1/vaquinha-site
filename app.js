async function doar(){

try{

const valor=
Number(
document
.getElementById(
"valor"
).value
);

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
JSON.stringify(
data,
null,
2
)
);

if(
!data.qr
){

document
.getElementById(
"msg"
)
.innerHTML=
`
Erro:
<br><br>

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

document
.getElementById(
"msg"
)
.innerHTML=
`
<img
src="data:image/png;base64,${data.qr}"
style="
width:220px;
">

<br><br>

<textarea>

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
