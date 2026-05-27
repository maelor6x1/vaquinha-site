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

const texto =
await resposta.text();

return res.json({

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
