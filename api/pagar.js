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

const resposta =
await fetch(

process.env.SIGILO_URL,

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
Number(valor)

})

}

);

const data =
await resposta.json();

res.json(data);

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
