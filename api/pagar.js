export default async function handler(
req,
res
){

if(
req.method!=="POST"
){

return res
.status(405)
.end();

}

const {
valor
}=req.body;

const r=
await fetch(
"https://api.mercadopago.com/v1/payments",
{

method:"POST",

headers:{

Authorization:
`Bearer ${process.env.MP_TOKEN}`,

"Content-Type":
"application/json"

},

body:
JSON.stringify({

transaction_amount:
Number(valor),

description:
"Contribuição",

payment_method_id:
"pix",

payer:{

email:
"comprador@email.com"

}

})

}

);

const data=
await r.json();

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
?.qr_code_base64

});

}
