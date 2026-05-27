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

`${process.env.SIGILO_URL}/payment`,

{

method:
"POST",

headers:{

Authorization:
process.env.SIGILO_KEY,

"Content-Type":
"application/json"

},

body:
JSON.stringify({

amount:
Number(valor),

method:
"pix"

})

}

);

const data =
await resposta.json();

return res.json({

pix:
data.pix,

qr:
data.qr

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
