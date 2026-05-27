async function doar(){

const valor=
Number(
document
.getElementById(
"valor"
)
.value
);

const r=
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

const data=
await r.json();

document
.getElementById(
"msg"
)
.innerHTML=
`
<img
style="
width:220px;
"
src="
data:image/png;base64,
${data.qr}
">

<br><br>

PIX:

<br>

<textarea
style="
width:100%;
height:80px;
">

${data.pix}

</textarea>
`;

}
