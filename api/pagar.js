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
"Método inválido"

});

}

try{

const {
valor
}=req.body;

const r =
await fetch(

"https://app.sigilopay.com.br/api/v1",

{

method:
"POST",

headers:{

Authorization:
`Bearer ${process.env.MP_TOKEN}`,

"Content-Type":
"application/json",

"X-Idempotency-Key":
crypto.randomUUID()

},

body:
JSON.stringify({

transaction_amount:
Number(valor),

payment_method_id:
"pix",

description:
"Vaquinha",

payer:{

email:
"teste@email.com"

}

})

}

);

const data =
await r.json();

return res
.status(
r.status
)
.json({

pix:

data
?.point_of_interaction
?.transaction_data
?.qr_code,

qr:

data
?.point_of_interaction
?.transaction_data
?.qr_code_base64,

erro:

r.ok
?null
:data

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
