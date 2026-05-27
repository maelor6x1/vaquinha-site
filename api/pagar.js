function parseBrl(valor){

return Number(

valor
.replace(/\./g,"")
.replace(",",".")
.replace(/[^\d.]/g,"")

);

}

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

const valor =
parseBrl(
req.body.valor
);

const resposta =
await fetch(

"https://app.sigilopay.com.br/api/v1/gateway/pix/receive",

{

method:"POST",

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
"vak_"+Date.now(),

amount:
valor,

client:{

name:
"Contribuinte",

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
`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(data?.pix?.code||"")}`

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
