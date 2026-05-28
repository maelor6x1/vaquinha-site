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

const resposta =
await fetch(

"https://api.misticpay.com/api/transactions/create",

{

method:"POST",

headers:{

"Content-Type":
"application/json",

ci:
process.env.MISTIC_CLIENT_ID,

cs:
process.env.MISTIC_CLIENT_SECRET

},

body:
JSON.stringify({

amount:
valor,

payerName:
"Contribuinte",

payerDocument:
"12345678909",

transactionId:
"vak_"+Date.now(),

description:
"Contribuição Vaquinha"

})

}

);

const data =
await resposta.json();

if(
!resposta.ok
){

return res
.status(400)
.json({

erro:
data

});

}

return res.json({

pix:
data
?.data
?.copyPaste,

qr:
data
?.data
?.qrCodeBase64,

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
