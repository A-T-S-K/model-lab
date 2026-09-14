import { executeNoncanonical } from './noncanonical-producer.js';
self.onmessage=async event=>{try{self.postMessage({envelope:await executeNoncanonical(event.data)});}catch(error){self.postMessage({error:String(error)});}};
