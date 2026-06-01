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
req.method !== "POST"
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

if(
valor < 1
){

return res
.status(400)
.json({

erro:
"Valor minimo R$ 1,00"

});

}

const resposta =
await fetch(

"https://nexuspag.com/api/pix/create",

{

method:"POST",

headers:{

"Content-Type":
"application/json",

"x-api-key":
process.env.NEXUSPAG_API_KEY

},

body:
JSON.stringify({

amount:
valor,

description:
"Contribuição Vaquinha",

external_id:
"vak_"+Date.now(),

expiration:
1800

})

}

);

const data =
await resposta.json();

if(
!resposta.ok
){

return res
.status(
resposta.status
)
.json({

erro:
data

});

}

return res.json({

pix:
data
?.transaction
?.pix_copia_cola,

qr:
data
?.transaction
?.qr_code_base64,

id:
data
?.transaction
?.id,

status:
data
?.transaction
?.status

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
