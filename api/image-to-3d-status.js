function send(res,status,payload){
  res.status(status).setHeader("Content-Type","application/json");
  res.setHeader("Cache-Control","no-store");
  res.end(JSON.stringify(payload));
}

export default async function handler(req,res){
  if(req.method!=="GET") return send(res,405,{error:"method_not_allowed"});
  const jobId=String(req.query?.jobId||"").trim();
  if(!jobId) return send(res,400,{error:"missing_job_id"});

  const statusUrl=(process.env.ATLAS_FORGE_IMAGE3D_STATUS_URL||process.env.ATLAS_FORGE_IMAGE3D_URL||"").trim();
  if(!statusUrl) return send(res,503,{error:"provider_not_configured",message:"A rota de status do motor 3D não foi configurada."});

  try{
    const url=new URL(statusUrl);
    url.searchParams.set("jobId",jobId);
    const headers={};
    if(process.env.ATLAS_FORGE_API_KEY) headers.Authorization=`Bearer ${process.env.ATLAS_FORGE_API_KEY}`;
    const response=await fetch(url,{headers});
    const text=await response.text();
    let data={};
    try{ data=text?JSON.parse(text):{}; }catch{ data={raw:text}; }
    if(!response.ok) return send(res,response.status,{error:"provider_error",message:data.message||`Motor 3D respondeu ${response.status}.`,details:data});

    const modelUrl=data.modelUrl||data.glbUrl||data.url||null;
    const status=data.status||data.state||(modelUrl?"completed":"processing");
    return send(res,200,{status,jobId,modelUrl,progress:data.progress??null,provider:data});
  }catch(error){
    console.error(error);
    return send(res,500,{error:"internal_error",message:error?.message||"Falha ao consultar job."});
  }
}
