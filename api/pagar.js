export default async function handler(
req,
res
){

if(
req.method!=="POST"
){

return res
.status(405)
.json({

erro:
"Metodo invalido"

});

}

try{

const {
valor
}=req.body;

const resposta =
await fetch(

"https://app.sigilopay.com.br/api/v1/gateway/pix/receive",

{

method:
"POST",

headers:{

"Content-Type":
"application/json",

"x-public-key":
process.env.SIGILO_PUBLIC,

"x-secret-key":
process.env.SIGILO_SECRET

},

body:
JSON.stringify({

identifier:
"pix_"+Date.now(),

amount:
Number(valor),

client:{

name:
"Cliente",

email:
"cliente@email.com",

phone:
"11999999999",

document:
"12345678900"

}

})

}

);

const data =
await resposta.json();

return res.json({

pix:
data
?.pix
?.code,

qr:
`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(data?.pix?.code||"")}`,

raw:
data

});

}
catch(e){

return res
.status(500)
.json({

erro:
e.message

});

}

}
