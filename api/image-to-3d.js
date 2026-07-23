const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function send(res, status, payload){
  res.status(status).setHeader("Content-Type","application/json");
  res.setHeader("Cache-Control","no-store");
  res.end(JSON.stringify(payload));
}

export default async function handler(req,res){
  if(req.method!=="POST") return send(res,405,{error:"method_not_allowed"});

  const providerUrl=(process.env.ATLAS_FORGE_IMAGE3D_URL||"").trim();
  if(!providerUrl){
    return send(res,503,{
      error:"provider_not_configured",
      message:"O motor 3D externo ainda não foi conectado na Vercel.",
      requiredEnv:["ATLAS_FORGE_IMAGE3D_URL","ATLAS_FORGE_API_KEY (opcional)"]
    });
  }

  try{
    const {imageBase64,fileName,prompt="",options={}}=req.body||{};
    if(typeof imageBase64!=="string"||!imageBase64.startsWith("data:image/")){
      return send(res,400,{error:"invalid_image",message:"Envie imageBase64 como data URL de imagem."});
    }
    const estimatedBytes=Math.ceil((imageBase64.length-imageBase64.indexOf(",")-1)*0.75);
    if(estimatedBytes>MAX_IMAGE_BYTES){
      return send(res,413,{error:"image_too_large",message:"Imagem acima de 8 MB."});
    }

    const headers={"Content-Type":"application/json"};
    if(process.env.ATLAS_FORGE_API_KEY){
      headers.Authorization=`Bearer ${process.env.ATLAS_FORGE_API_KEY}`;
    }

    const response=await fetch(providerUrl,{
      method:"POST",
      headers,
      body:JSON.stringify({imageBase64,fileName,prompt,format:"glb",options})
    });
    const text=await response.text();
    let data={};
    try{ data=text?JSON.parse(text):{}; }catch{ data={raw:text}; }

    if(!response.ok){
      return send(res,response.status,{error:"provider_error",message:data.message||`Motor 3D respondeu ${response.status}.`,details:data});
    }

    const modelUrl=data.modelUrl||data.glbUrl||data.url||null;
    const jobId=data.jobId||data.id||data.taskId||null;
    const status=data.status|| (modelUrl?"completed":"processing");
    return send(res,modelUrl?200:202,{status,jobId,modelUrl,provider:data});
  }catch(error){
    console.error(error);
    return send(res,500,{error:"internal_error",message:error?.message||"Falha no processamento."});
  }
}
