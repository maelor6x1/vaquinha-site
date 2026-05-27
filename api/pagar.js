export default async function handler(
req,
res
){

try{

const {
valor
}=req.body;

const resposta =
await fetch(

"https://app.sigilopay.com.br/api/v1",

{

method:"POST",

headers:{

Authorization:
`Bearer ${process.env.SIGILO_KEY}`,

"Content-Type":
"application/json",

Accept:
"application/json"

},

body:
JSON.stringify({

amount:
Number(valor),

type:
"pix"

})

}

);

const texto =
await resposta.text();

return res.json({

status:
resposta.status,

resposta:
texto

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
