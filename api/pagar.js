export default async function handler(req,res){

if(req.method!=="POST"){
return res.status(405).end();
}

const {valor}=req.body;

const resposta=
await fetch(
"https://api.mercadopago.com/checkout/preferences",
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

items:[

{
title:"Contribuição",
quantity:1,
currency_id:"BRL",
unit_price:Number(valor)

}

]

})

}

);

const data=
await resposta.json();

res.json({
url:data.init_point
});

}
