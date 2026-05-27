export default async function handler(req, res) {

if (req.method !== "POST") {
return res.status(405).json({
erro:"Método não permitido"
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
"Contribuição",

payment_method_id:
"pix",

payer:{
email:
"teste@email.com"
}

})

}

);

const dados =
await resposta.json();

if (
!dados.point_of_interaction
){

return res
.status(400)
.json({
erro:dados
});

}

return res.json({

pix:
dados
.point_of_interaction
.transaction_data
.qr_code,

qr:
dados
.point_of_interaction
.transaction_data
.qr_code_base64

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
