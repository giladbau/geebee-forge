import { infer, rasterize, validateModel, type Model } from './cnn';
let model: Model | null = null;
self.onmessage = async ({data}) => {
  try {
    if (data.type === 'load') {
      const response = await fetch('/models/shape-cnn-v1.json');
      if (!response.ok) throw Error(`Model HTTP ${response.status}`);
      model = validateModel(await response.json());
      self.postMessage({type:'ready', model:{checkpointSha256:model.checkpointSha256,epoch:model.epoch,labels:model.labels,renderingConfig:model.renderingConfig}});
    } else if (data.type === 'infer') {
      if (!model) throw Error('Model is not loaded');
      const start = performance.now(), pixels = rasterize(data.strokes);
      const result = infer(model, pixels);
      self.postMessage({type:'result',id:data.id,tile:data.tile,revision:data.revision,result,pixels:Array.from(pixels),ms:performance.now()-start});
    } else throw Error('Unknown worker request');
  } catch (error) {
    self.postMessage({type:'error',id:data.id,tile:data.tile,revision:data.revision,error:error instanceof Error?error.message:String(error)});
  }
};
