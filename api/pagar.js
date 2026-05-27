export default async function handler(req, res) {

if (req.method !== "POST") {
return res.status(405).json({
erro:"Método inválido"
});
}

try {

const { valor } = req.body;

const resposta =
await fetch(
"https://api.mercadopago.com/v1/payments",
{

method:"POST",

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

description:
"Contribuição Vaquinha",

payment_method_id:
"pix",

payer:{
email:
"comprador@email.com"
}

})

}

);

const data =
await resposta.json();

res.json({

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
data

});

}
catch(e){

res
.status(500)
.json({

erro:
e.message

});

}

}
